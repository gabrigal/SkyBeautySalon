import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getAppointmentByToken,
  cancelAppointmentInDb,
  failCancelSync,
  markNeedsReconciliation,
} from '@/lib/db/appointments';
import { logEvent } from '@/lib/db/events';

const N8N_CANCEL_WEBHOOK_URL = process.env.N8N_CANCEL_WEBHOOK_URL;
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;
const N8N_TIMEOUT_MS = 10_000;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length !== 64 || !/^[0-9a-f]+$/.test(token)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const supabase = createServiceClient();
  const appointment = await getAppointmentByToken(supabase, token);

  if (!appointment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (appointment.appointment_status === 'cancelled') {
    return NextResponse.json({ error: 'This appointment has already been cancelled' }, { status: 409 });
  }

  if (appointment.appointment_status !== 'booked') {
    return NextResponse.json(
      { error: 'This appointment cannot be cancelled at this time. Please contact us directly.' },
      { status: 409 }
    );
  }

  const customer = appointment.customers;
  const customerName = customer
    ? `${customer.first_name} ${customer.last_name}`.trim()
    : 'Unknown';

  // ── Notify n8n (cancel GCal event + send cancellation email) ──────────────
  const n8nPayload = {
    event: 'appointment.cancelled',
    appointment_id: appointment.id,
    business_id: appointment.business_id,
    external_booking_id: appointment.external_booking_id,
    customer_name: customerName,
    customer_email: customer?.email ?? null,
    service: appointment.service,
    stylist: appointment.stylist,
    previous_appointment_at: appointment.appointment_at,
    cancelled_at: new Date().toISOString(),
  };

  // If there's no external_booking_id (sync_failed booking), skip n8n Calendar step
  if (!appointment.external_booking_id || !N8N_CANCEL_WEBHOOK_URL) {
    // No Calendar event to remove — cancel in DB directly
    await cancelAppointmentInDb(supabase, appointment.id);
    await logEvent(supabase, {
      businessId: BUSINESS_ID,
      appointmentId: appointment.id,
      customerId: customer?.id ?? null,
      eventType: 'appointment_cancelled',
      metadata: { reason: 'no_calendar_event', cancelled_by: 'customer' },
    });
    return NextResponse.json({ success: true });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

    const n8nRes = await fetch(N8N_CANCEL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nPayload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!n8nRes.ok) {
      const errText = await n8nRes.text().catch(() => 'unknown');
      // 404 from GCal = event already gone = idempotent success
      if (n8nRes.status === 404 || errText.toLowerCase().includes('not found')) {
        await cancelAppointmentInDb(supabase, appointment.id);
        await logEvent(supabase, {
          businessId: BUSINESS_ID, appointmentId: appointment.id,
          customerId: customer?.id ?? null, eventType: 'appointment_cancelled',
          metadata: { note: 'calendar_event_already_absent', cancelled_by: 'customer' },
        });
        return NextResponse.json({ success: true });
      }

      await failCancelSync(supabase, appointment.id, `n8n error ${n8nRes.status}: ${errText}`);
      await logEvent(supabase, {
        businessId: BUSINESS_ID, appointmentId: appointment.id,
        customerId: customer?.id ?? null, eventType: 'automation_failed',
        metadata: { operation: 'calendar_cancel', error: errText, status: n8nRes.status },
      });
      return NextResponse.json(
        { error: 'Cancellation could not be completed. Please contact us directly.' },
        { status: 502 }
      );
    }

    const n8nData = await n8nRes.json().catch(() => ({}));

    // n8n may return { success: false } even with 200 if it couldn't delete the event
    if (n8nData?.success === false && !n8nData?.already_deleted) {
      const errMsg = n8nData?.error ?? 'n8n reported failure';
      await failCancelSync(supabase, appointment.id, errMsg);
      await logEvent(supabase, {
        businessId: BUSINESS_ID, appointmentId: appointment.id,
        customerId: customer?.id ?? null, eventType: 'automation_failed',
        metadata: { operation: 'calendar_cancel', error: errMsg },
      });
      return NextResponse.json(
        { error: 'Cancellation could not be completed. Please contact us directly.' },
        { status: 502 }
      );
    }

    // ── Success ─────────────────────────────────────────────────────────────
    await cancelAppointmentInDb(supabase, appointment.id);
    await logEvent(supabase, {
      businessId: BUSINESS_ID,
      appointmentId: appointment.id,
      customerId: customer?.id ?? null,
      eventType: 'appointment_cancelled',
      metadata: { cancelled_by: 'customer', previous_appointment_at: appointment.appointment_at },
    });

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      await markNeedsReconciliation(supabase, appointment.id, 'calendar_cancel');
      return NextResponse.json(
        { error: 'Cancellation is processing. You will receive a confirmation shortly.' },
        { status: 202 }
      );
    }

    const msg = err instanceof Error ? err.message : String(err);
    await failCancelSync(supabase, appointment.id, msg);
    await logEvent(supabase, {
      businessId: BUSINESS_ID, appointmentId: appointment.id,
      customerId: customer?.id ?? null, eventType: 'automation_failed',
      metadata: { operation: 'calendar_cancel', error: msg },
    });
    return NextResponse.json(
      { error: 'Cancellation could not be completed. Please contact us directly.' },
      { status: 502 }
    );
  }
}
