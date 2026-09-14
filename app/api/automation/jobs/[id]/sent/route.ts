import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/db/events';
import type { EventType } from '@/lib/db/events';

const AUTOMATION_SECRET = process.env.N8N_AUTOMATION_SECRET;
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

// Map automation job type to the correct event type logged in the timeline
const JOB_TYPE_TO_EVENT: Record<string, EventType> = {
  appointment_reminder_24h: 'reminder_sent',
  review_request:           'review_request_sent',
  rebooking_reminder:       'rebooking_reminder_sent',
  reactivation:             'reactivation_sent',
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!AUTOMATION_SECRET) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const auth = _request.headers.get('authorization');
  if (!auth || auth !== `Bearer ${AUTOMATION_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job } = await (supabase as any)
    .from('automation_jobs')
    .select('id, status, job_type, appointment_id, customer_id')
    .eq('id', id)
    .single();

  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (job.status !== 'processing') {
    return NextResponse.json(
      { error: `Job is in '${job.status}' state — cannot mark sent` },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('automation_jobs')
    .update({
      status:     'sent',
      sent_at:    now,
      last_error: null,
      updated_at: now,
    })
    .eq('id', id);

  if (updateError) {
    console.error('[/api/automation/jobs/[id]/sent] Update error:', updateError.message);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }

  const eventType = JOB_TYPE_TO_EVENT[job.job_type] ?? 'reminder_sent';

  await logEvent(supabase, {
    businessId:    BUSINESS_ID,
    appointmentId: job.appointment_id,
    customerId:    job.customer_id,
    eventType,
    metadata: {
      automation_job_id: id,
      job_type:          job.job_type,
      sent_at:           now,
    },
  });

  return NextResponse.json({ success: true });
}
