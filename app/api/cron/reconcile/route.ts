import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/db/events';

const CRON_SECRET = process.env.CRON_SECRET;
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;
const N8N_RECONCILE_WEBHOOK_URL = process.env.N8N_RECONCILE_WEBHOOK_URL;
const N8N_TIMEOUT_MS = 10_000;

/**
 * GET /api/cron/reconcile
 *
 * For each appointment with sync_status='needs_reconciliation', calls the
 * n8n reconciliation webhook which queries Google Calendar using its existing
 * OAuth credential and returns the current event state.
 *
 * This is the recovery path for network timeouts during booking/cancel/reschedule.
 * Protected by CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!N8N_RECONCILE_WEBHOOK_URL) {
    return NextResponse.json({ error: 'N8N_RECONCILE_WEBHOOK_URL not configured' }, { status: 500 });
  }

  const supabase = createServiceClient();

  const { data: pending, error } = await supabase
    .from('appointments')
    .select('id, sync_operation, external_booking_id, appointment_at, appointment_end_at, business_id, customer_id')
    .eq('sync_status', 'needs_reconciliation')
    .eq('business_id', BUSINESS_ID)
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ id: string; resolved: string }> = [];

  for (const appt of pending ?? []) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

      const res = await fetch(N8N_RECONCILE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: appt.id,
          gcal_event_id: appt.external_booking_id,
          operation: appt.sync_operation,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!res.ok) {
        results.push({ id: appt.id, resolved: 'n8n_error' });
        continue;
      }

      const data = await res.json().catch(() => ({})) as {
        found?: boolean;
        start?: string;
        cancelled?: boolean;
      };

      const op = appt.sync_operation;

      if (op === 'calendar_create') {
        if (data.found) {
          await supabase.from('appointments').update({
            appointment_status: 'booked',
            sync_status: 'synced',
            sync_operation: null,
            last_sync_error: null,
            updated_at: new Date().toISOString(),
          }).eq('id', appt.id);
          await logEvent(supabase, {
            businessId: BUSINESS_ID, appointmentId: appt.id,
            customerId: appt.customer_id,
            eventType: 'appointment_created',
            metadata: { reconciled: true },
          });
          results.push({ id: appt.id, resolved: 'booked' });
        } else {
          // Event absent — retry creation on next reconciliation pass
          // For now mark as failed so slot is released
          await supabase.from('appointments').update({
            sync_status: 'failed',
            last_sync_error: 'GCal event absent after reconciliation; needs manual review',
            updated_at: new Date().toISOString(),
          }).eq('id', appt.id);
          results.push({ id: appt.id, resolved: 'failed_no_event' });
        }
      } else if (op === 'calendar_cancel') {
        if (!data.found || data.cancelled) {
          // Calendar event is gone — mark as cancelled
          await supabase.from('appointments').update({
            appointment_status: 'cancelled',
            sync_status: 'synced',
            sync_operation: null,
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', appt.id);
          await logEvent(supabase, {
            businessId: BUSINESS_ID, appointmentId: appt.id,
            customerId: appt.customer_id,
            eventType: 'appointment_cancelled',
            metadata: { reconciled: true },
          });
          results.push({ id: appt.id, resolved: 'cancelled' });
        } else {
          // Event still present — retry delete next pass
          results.push({ id: appt.id, resolved: 'retry_delete' });
        }
      } else if (op === 'calendar_reschedule') {
        if (data.found && data.start) {
          const gcalStart = new Date(data.start).toISOString();
          const expectedStart = new Date(appt.appointment_at).toISOString();
          if (gcalStart === expectedStart) {
            // Reschedule confirmed in calendar
            await supabase.from('appointments').update({
              appointment_status: 'booked',
              sync_status: 'synced',
              sync_operation: null,
              rescheduled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('id', appt.id);
            await logEvent(supabase, {
              businessId: BUSINESS_ID, appointmentId: appt.id,
              customerId: appt.customer_id,
              eventType: 'appointment_rescheduled',
              metadata: { reconciled: true, new_appointment_at: gcalStart },
            });
            results.push({ id: appt.id, resolved: 'rescheduled' });
          } else {
            results.push({ id: appt.id, resolved: 'gcal_time_mismatch' });
          }
        } else {
          results.push({ id: appt.id, resolved: 'event_absent' });
        }
      }
    } catch {
      results.push({ id: appt.id, resolved: 'timeout' });
    }
  }

  return NextResponse.json({ reconciled: results.length, results });
}
