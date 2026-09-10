import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getAppointmentByToken,
  confirmReschedule,
  revertReschedule,
  markNeedsReconciliation,
} from '@/lib/db/appointments';
import { logEvent } from '@/lib/db/events';

const N8N_RESCHEDULE_WEBHOOK_URL = process.env.N8N_RESCHEDULE_WEBHOOK_URL;
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const N8N_TIMEOUT_MS = 10_000;

interface RescheduleBody {
  newStartISO: string;  // UTC ISO string from the client (selected slot)
  newEndISO: string;
  token: string;        // also in URL params — cross-check
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length !== 64 || !/^[0-9a-f]+$/.test(token)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: RescheduleBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { newStartISO, newEndISO } = body;
  if (!newStartISO || !newEndISO) {
    return NextResponse.json({ error: 'newStartISO and newEndISO are required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const appointment = await getAppointmentByToken(supabase, token);

  if (!appointment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (appointment.appointment_status !== 'booked') {
    return NextResponse.json(
      { error: 'This appointment cannot be rescheduled at this time.' },
      { status: 409 }
    );
  }

  // ── Atomic slot reservation via PostgreSQL RPC ─────────────────────────────
  // This function:
  //   1. Locks the appointment row (FOR UPDATE NOWAIT)
  //   2. Checks for conflicts at the new slot (excluding this appointment)
  //   3. Updates appointment_at to the new slot with sync_status='pending'
  // All in one transaction — prevents double-booking race conditions.
  const { data: reserveResult, error: reserveError } = await supabase.rpc(
    'try_reserve_reschedule_slot',
    {
      p_appointment_id: appointment.id,
      p_new_start: newStartISO,
      p_new_end: newEndISO,
      p_stylist: appointment.stylist ?? '',
      p_business_id: appointment.business_id,
    }
  );

  if (reserveError) {
    console.error('[reschedule] RPC error:', reserveError.message);
    return NextResponse.json({ error: 'Could not reserve slot. Please try again.' }, { status: 500 });
  }

  const reserve = reserveResult as { success: boolean; error?: string; old_start?: string; old_end?: string };

  if (!reserve.success) {
    if (reserve.error === 'slot_unavailable') {
      return NextResponse.json(
        { error: 'That time slot is no longer available. Please choose another.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Appointment not found or no longer bookable.' }, { status: 409 });
  }

  const oldStart = reserve.old_start!;
  const oldEnd = reserve.old_end!;

  const customer = appointment.customers;
  const customerName = customer
    ? `${customer.first_name} ${customer.last_name}`.trim()
    : 'Unknown';

  const manageUrl = `${APP_URL}/manage/${token}`;

  const n8nPayload = {
    event: 'appointment.rescheduled',
    appointment_id: appointment.id,
    business_id: appointment.business_id,
    external_booking_id: appointment.external_booking_id,
    customer_name: customerName,
    customer_email: customer?.email ?? null,
    service: appointment.service,
    stylist: appointment.stylist,
    previous_appointment_at: oldStart,
    new_appointment_at: newStartISO,
    new_end_at: newEndISO,
    rescheduled_at: new Date().toISOString(),
    manage_appointment_url: manageUrl,
    cancel_url: `${manageUrl}?action=cancel`,
    reschedule_url: `${manageUrl}?action=reschedule`,
  };

  if (!appointment.external_booking_id || !N8N_RESCHEDULE_WEBHOOK_URL) {
    // No Calendar event to update — complete in DB only
    await confirmReschedule(supabase, appointment.id, newStartISO, newEndISO, oldStart);
    await logEvent(supabase, {
      businessId: BUSINESS_ID, appointmentId: appointment.id,
      customerId: customer?.id ?? null, eventType: 'appointment_rescheduled',
      metadata: { previous_appointment_at: oldStart, new_appointment_at: newStartISO, note: 'no_calendar_event' },
    });
    return NextResponse.json({ success: true });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

    const n8nRes = await fetch(N8N_RESCHEDULE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nPayload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!n8nRes.ok) {
      const errText = await n8nRes.text().catch(() => 'unknown');
      await revertReschedule(supabase, appointment.id, oldStart, oldEnd, `n8n error ${n8nRes.status}: ${errText}`);
      await logEvent(supabase, {
        businessId: BUSINESS_ID, appointmentId: appointment.id,
        customerId: customer?.id ?? null, eventType: 'automation_failed',
        metadata: { operation: 'calendar_reschedule', error: errText, status: n8nRes.status },
      });
      return NextResponse.json(
        { error: 'Reschedule could not be confirmed. Please try again or contact us.' },
        { status: 502 }
      );
    }

    const n8nData = await n8nRes.json().catch(() => ({}));

    if (n8nData?.success === false) {
      const errMsg = n8nData?.error ?? 'n8n reported failure';
      await revertReschedule(supabase, appointment.id, oldStart, oldEnd, errMsg);
      await logEvent(supabase, {
        businessId: BUSINESS_ID, appointmentId: appointment.id,
        customerId: customer?.id ?? null, eventType: 'automation_failed',
        metadata: { operation: 'calendar_reschedule', error: errMsg },
      });
      return NextResponse.json(
        { error: 'Reschedule could not be confirmed. Please try again or contact us.' },
        { status: 502 }
      );
    }

    // ── Success ─────────────────────────────────────────────────────────────
    await confirmReschedule(supabase, appointment.id, newStartISO, newEndISO, oldStart);
    await logEvent(supabase, {
      businessId: BUSINESS_ID, appointmentId: appointment.id,
      customerId: customer?.id ?? null, eventType: 'appointment_rescheduled',
      metadata: { previous_appointment_at: oldStart, new_appointment_at: newStartISO },
    });

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      // Timeout — appointment is at new time but GCal state is unknown
      await markNeedsReconciliation(supabase, appointment.id, 'calendar_reschedule');
      return NextResponse.json(
        { success: false, pending: true, message: 'Reschedule is processing. Please check back shortly.' },
        { status: 202 }
      );
    }

    const msg = err instanceof Error ? err.message : String(err);
    await revertReschedule(supabase, appointment.id, oldStart, oldEnd, msg);
    await logEvent(supabase, {
      businessId: BUSINESS_ID, appointmentId: appointment.id,
      customerId: customer?.id ?? null, eventType: 'automation_failed',
      metadata: { operation: 'calendar_reschedule', error: msg },
    });
    return NextResponse.json(
      { error: 'Reschedule could not be confirmed. Please try again or contact us.' },
      { status: 502 }
    );
  }
}
