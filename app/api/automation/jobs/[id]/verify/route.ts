import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { customerHasFutureBooking } from '@/lib/db/retentionJobs';

const AUTOMATION_SECRET = process.env.N8N_AUTOMATION_SECRET;

/**
 * Pre-send verification gate.
 * n8n calls this immediately before sending any automation email.
 *
 * Returns { sendable: true } only if all eligibility conditions are met.
 * If not sendable, n8n must call /cancel (business-state ineligibility)
 * or /failed (technical error). The reason field indicates which.
 *
 * Eligibility by job type:
 *   appointment_reminder_24h — appointment still 'booked'
 *   review_request           — appointment still 'completed'
 *   rebooking_reminder       — appointment 'completed', customer has no future booking
 *   reactivation             — appointment 'completed', customer has no future booking
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!AUTOMATION_SECRET) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const auth = request.headers.get('authorization');
  if (!auth || auth !== `Bearer ${AUTOMATION_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ sendable: false, reason: 'job_not_found' });
  }

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job } = await (supabase as any)
    .from('automation_jobs')
    .select('id, status, job_type, appointment_id, customer_id, business_id, appointments(appointment_status, customer_id, business_id)')
    .eq('id', id)
    .single();

  if (!job) {
    return NextResponse.json({ sendable: false, reason: 'job_not_found' });
  }

  if (job.status !== 'processing') {
    return NextResponse.json({ sendable: false, reason: 'job_not_processing' });
  }

  const apptStatus = job.appointments?.appointment_status;
  const customerId = job.customer_id ?? job.appointments?.customer_id;
  const businessId = job.business_id ?? job.appointments?.business_id;

  switch (job.job_type) {
    case 'appointment_reminder_24h':
      if (apptStatus !== 'booked') {
        return NextResponse.json({
          sendable: false,
          reason: 'appointment_not_booked',
          appointment_status: apptStatus,
        });
      }
      break;

    case 'review_request':
      if (apptStatus !== 'completed') {
        return NextResponse.json({
          sendable: false,
          reason: 'appointment_not_completed',
          appointment_status: apptStatus,
        });
      }
      break;

    case 'rebooking_reminder':
    case 'reactivation': {
      if (apptStatus !== 'completed') {
        return NextResponse.json({
          sendable: false,
          reason: 'appointment_not_completed',
          appointment_status: apptStatus,
        });
      }
      // Do not send if customer already has a future booked appointment
      if (customerId && businessId) {
        const hasFuture = await customerHasFutureBooking(supabase, customerId, businessId);
        if (hasFuture) {
          return NextResponse.json({
            sendable: false,
            reason: 'customer_already_rebooked',
          });
        }
      }
      break;
    }

    default:
      return NextResponse.json({ sendable: false, reason: 'unknown_job_type' });
  }

  return NextResponse.json({ sendable: true });
}
