import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/db/events';

const AUTOMATION_SECRET = process.env.N8N_AUTOMATION_SECRET;
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

export async function POST(
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
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: { error?: string } = {};
  try {
    body = await request.json();
  } catch {
    // body is optional
  }

  const errorMessage = typeof body.error === 'string' ? body.error.slice(0, 1000) : 'n8n reported failure';

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job } = await (supabase as any)
    .from('automation_jobs')
    .select('id, status, job_type, appointment_id, customer_id, attempts')
    .eq('id', id)
    .single();

  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (job.status !== 'processing') {
    return NextResponse.json(
      { error: `Job is in '${job.status}' state — cannot mark failed` },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('automation_jobs')
    .update({
      status:     'failed',
      last_error: errorMessage,
      updated_at: now,
    })
    .eq('id', id);

  if (updateError) {
    console.error('[/api/automation/jobs/[id]/failed] Update error:', updateError.message);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }

  await logEvent(supabase, {
    businessId:    BUSINESS_ID,
    appointmentId: job.appointment_id,
    customerId:    job.customer_id,
    eventType:     'automation_failed',
    metadata: {
      operation:         job.job_type,
      automation_job_id: id,
      error:             errorMessage,
      attempt_at:        now,
      attempts:          job.attempts,
    },
  });

  return NextResponse.json({ success: true });
}
