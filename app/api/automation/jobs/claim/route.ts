import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { randomBytes, createHash } from 'crypto';
import type { AutomationJob } from '@/lib/database.types';

const AUTOMATION_SECRET = process.env.N8N_AUTOMATION_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const SALON_TZ = 'America/New_York';

// Job types that use the retention RPC (linked to completed appointments)
const RETENTION_JOB_TYPES = new Set(['review_request', 'rebooking_reminder', 'reactivation']);

function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: SALON_TZ, month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatDisplayTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: SALON_TZ, hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export async function POST(request: NextRequest) {
  if (!AUTOMATION_SECRET) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const auth = request.headers.get('authorization');
  if (!auth || auth !== `Bearer ${AUTOMATION_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { job_type?: string; limit?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { job_type, limit = 25 } = body;
  if (!job_type) {
    return NextResponse.json({ error: 'job_type is required' }, { status: 400 });
  }

  const claimLimit = Math.min(Math.max(1, Number(limit) || 25), 100);

  const supabase = createServiceClient();
  const isRetentionJob = RETENTION_JOB_TYPES.has(job_type);

  // Route to correct RPC:
  // - appointment_reminder_24h → claim_automation_jobs (filters for booked appointments)
  // - review_request / rebooking_reminder / reactivation → claim_retention_jobs (no appointment_status filter)
  const rpcName = isRetentionJob ? 'claim_retention_jobs' : 'claim_automation_jobs';

  const { data: claimedJobs, error: claimError } = await supabase.rpc(rpcName, {
    p_job_type: job_type,
    p_limit: claimLimit,
  });

  if (claimError) {
    console.error('[/api/automation/jobs/claim] RPC error:', claimError.message);
    return NextResponse.json({ error: 'Failed to claim jobs' }, { status: 500 });
  }

  const jobs = (claimedJobs as AutomationJob[] | null) ?? [];

  if (jobs.length === 0) {
    return NextResponse.json({ jobs: [] });
  }

  // Fetch appointment + customer details for each claimed job
  const appointmentIds = [...new Set(jobs.map(j => j.appointment_id).filter(Boolean))];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appointments } = await (supabase as any)
    .from('appointments')
    .select('id, service, stylist, appointment_at, appointment_end_at, completed_at, customers(first_name, last_name, email, phone)')
    .in('id', appointmentIds);

  type ApptRow = {
    id: string;
    service: string;
    stylist: string | null;
    appointment_at: string;
    completed_at: string | null;
    customers: { first_name: string; last_name: string; email: string | null; phone: string | null } | null;
  };
  const apptMap = new Map<string, ApptRow>(
    (appointments ?? []).map((a: ApptRow) => [a.id, a] as [string, ApptRow])
  );

  const bookingUrl = APP_URL ?? '';

  const responseJobs = await Promise.all(
    jobs.map(async (job) => {
      const appt = job.appointment_id ? apptMap.get(job.appointment_id) : null;
      const customer = appt?.customers ?? null;

      const baseFields = {
        job_id:           job.id,
        job_type:         job.job_type,
        appointment_id:   job.appointment_id,
        customer_name:    customer ? `${customer.first_name} ${customer.last_name}`.trim() : '',
        customer_email:   customer?.email ?? '',
        customer_phone:   customer?.phone ?? '',
        service:          appt?.service ?? '',
        stylist:          appt?.stylist ?? '',
        booking_url:      bookingUrl,
      };

      if (isRetentionJob) {
        // Retention jobs include appointment completion date context
        const refDate = appt?.completed_at ?? appt?.appointment_at ?? '';
        return {
          ...baseFields,
          appointment_at:           appt?.appointment_at ?? '',
          appointment_display_date: appt?.appointment_at ? formatDisplayDate(appt.appointment_at) : '',
          appointment_display_time: appt?.appointment_at ? formatDisplayTime(appt.appointment_at) : '',
          completed_at:             appt?.completed_at ?? '',
          completed_display_date:   refDate ? formatDisplayDate(refDate) : '',
        };
      }

      // 24h reminder — generate management token for cancel/reschedule links
      let manageUrl = '';
      let cancelUrl = '';
      let rescheduleUrl = '';

      if (job.appointment_id && APP_URL) {
        const rawTokenBytes = randomBytes(32);
        const rawToken = rawTokenBytes.toString('hex');
        const tokenHash = createHash('sha256').update(rawTokenBytes).digest('hex');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('appointment_management_tokens').insert({
          appointment_id: job.appointment_id,
          token_hash: tokenHash,
          purpose: 'reminder',
        });

        manageUrl = `${APP_URL}/manage/${rawToken}`;
        cancelUrl = `${manageUrl}?action=cancel`;
        rescheduleUrl = `${manageUrl}?action=reschedule`;
      }

      return {
        ...baseFields,
        appointment_at:           appt?.appointment_at ?? '',
        appointment_display_date: appt?.appointment_at ? formatDisplayDate(appt.appointment_at) : '',
        appointment_display_time: appt?.appointment_at ? formatDisplayTime(appt.appointment_at) : '',
        manage_appointment_url:   manageUrl,
        cancel_url:               cancelUrl,
        reschedule_url:           rescheduleUrl,
      };
    })
  );

  return NextResponse.json({ jobs: responseJobs });
}
