import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { findOrCreateCustomer } from '@/lib/db/customers';
import { logEvent } from '@/lib/db/events';

const IMPORT_SECRET = process.env.IMPORT_SECRET;
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

interface GCalEventPayload {
  gcalEventId: string;
  summary: string;          // e.g. "Hair Cut — Jane Smith"
  description?: string;     // may contain customer details from old n8n workflow
  startAt: string;          // ISO datetime from GCal
  endAt: string;
  status?: string;          // GCal event status (confirmed, cancelled, tentative)
}

/**
 * POST /api/import/gcal-event
 *
 * Receives a single Google Calendar event from the migration n8n workflow
 * and imports it as a historical appointment.
 *
 * Protected by IMPORT_SECRET header (x-import-secret).
 * Idempotent: skips if external_booking_id already exists.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-import-secret');
  if (!IMPORT_SECRET || secret !== IMPORT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: GCalEventPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { gcalEventId, summary, description, startAt, endAt, status: gcalStatus } = body;

  if (!gcalEventId || !summary || !startAt) {
    return NextResponse.json({ error: 'gcalEventId, summary, and startAt are required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // ── Idempotency: check if this GCal event is already imported ─────────────
  const { data: existing } = await supabase
    .from('appointments')
    .select('id')
    .eq('external_booking_id', gcalEventId)
    .eq('business_id', BUSINESS_ID)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ skipped: 'duplicate', external_booking_id: gcalEventId });
  }

  // ── Parse event data ───────────────────────────────────────────────────────
  // GCal summary format: "{service} — {customerName}" (from existing n8n workflow)
  const parsed = parseSummary(summary);
  const descParsed = parseDescription(description ?? '');

  const firstName = descParsed.firstName || (parsed.customerName?.split(' ')[0] ?? 'Unknown');
  const lastName = descParsed.lastName
    || (parsed.customerName?.split(' ').slice(1).join(' ') ?? '');

  // Validate we have at minimum a name
  if (firstName === 'Unknown' && !descParsed.email && !descParsed.phone) {
    return NextResponse.json({
      skipped: 'invalid',
      reason: 'insufficient_customer_data',
      gcalEventId,
    });
  }

  // ── Upsert customer ────────────────────────────────────────────────────────
  let customer;
  try {
    customer = await findOrCreateCustomer(supabase, {
      businessId: BUSINESS_ID,
      firstName,
      lastName,
      email: descParsed.email ?? null,
      phone: descParsed.phone ?? null,
      source: 'historical_import',
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create customer', detail: String(err) }, { status: 500 });
  }

  // ── Determine appointment status ───────────────────────────────────────────
  const appointmentAt = new Date(startAt).toISOString();
  const appointmentEndAt = new Date(endAt).toISOString();
  const isPast = new Date(startAt) < new Date();

  let appointmentStatus: 'completed' | 'cancelled' | 'booked' = 'completed';
  if (gcalStatus === 'cancelled') {
    appointmentStatus = 'cancelled';
  } else if (!isPast) {
    appointmentStatus = 'booked';
  }

  // ── Insert appointment ─────────────────────────────────────────────────────
  const durationMinutes = Math.round(
    (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000
  );

  const { data: appt, error } = await supabase
    .from('appointments')
    .insert({
      business_id: BUSINESS_ID,
      customer_id: customer.id,
      service: parsed.service ?? 'Unknown Service',
      stylist: descParsed.stylist ?? null,
      appointment_at: appointmentAt,
      appointment_end_at: appointmentEndAt,
      duration_minutes: durationMinutes,
      price_cents: null,
      appointment_status: appointmentStatus,
      sync_status: 'synced',
      booking_source: 'historical_import',
      external_booking_id: gcalEventId,
      management_token_hash: null,  // historical records have no management token
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to insert appointment', detail: error.message }, { status: 500 });
  }

  await logEvent(supabase, {
    businessId: BUSINESS_ID,
    appointmentId: appt.id,
    customerId: customer.id,
    eventType: 'appointment_created',
    metadata: { imported: true, gcal_event_id: gcalEventId },
  });

  return NextResponse.json({ imported: true, appointmentId: appt.id });
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseSummary(summary: string): { service?: string; customerName?: string } {
  // Format: "Hair Cut & Style — Jane Smith" or "Hair Cut — Jane Smith"
  const sep = summary.indexOf(' — ');
  if (sep !== -1) {
    return {
      service: summary.slice(0, sep).trim(),
      customerName: summary.slice(sep + 3).trim(),
    };
  }
  return { service: summary.trim() };
}

interface DescriptionParsed {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  stylist?: string;
}

function parseDescription(desc: string): DescriptionParsed {
  const result: DescriptionParsed = {};
  // Try to extract email
  const emailMatch = desc.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  if (emailMatch) result.email = emailMatch[1];
  // Try to extract phone (various formats)
  const phoneMatch = desc.match(/(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
  if (phoneMatch) result.phone = phoneMatch[1];
  // Try to extract name (first line of description often contains customer name)
  const lines = desc.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    const nameLine = lines.find(l =>
      !l.includes('@') && !l.match(/\d{7,}/) && l.length < 50
    );
    if (nameLine) {
      const parts = nameLine.replace(/^(Name:|Client:|Customer:)/i, '').trim().split(/\s+/);
      if (parts.length >= 1) result.firstName = parts[0];
      if (parts.length >= 2) result.lastName = parts.slice(1).join(' ');
    }
  }
  // Try to extract stylist
  const stylistMatch = desc.match(/(?:stylist|with):?\s*([A-Za-z]+)/i);
  if (stylistMatch) result.stylist = stylistMatch[1];
  return result;
}
