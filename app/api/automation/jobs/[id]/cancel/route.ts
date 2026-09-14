import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const AUTOMATION_SECRET = process.env.N8N_AUTOMATION_SECRET;

/**
 * POST /api/automation/jobs/[id]/cancel
 *
 * Marks a processing job as cancelled — used when the appointment is no longer
 * eligible (cancelled, completed, no-show, rescheduled) at send time.
 *
 * This is an expected operational path, NOT an error. No automation_failed event
 * is logged and the job does not appear as "Action Needed" in the dashboard.
 */
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

  let body: { reason?: string } = {};
  try {
    body = await request.json();
  } catch {
    // body is optional
  }

  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : 'appointment no longer eligible';

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job } = await (supabase as any)
    .from('automation_jobs')
    .select('id, status')
    .eq('id', id)
    .single();

  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (job.status !== 'processing') {
    return NextResponse.json(
      { error: `Job is in '${job.status}' state — cannot cancel` },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('automation_jobs')
    .update({
      status:     'cancelled',
      last_error: reason,
      updated_at: now,
    })
    .eq('id', id);

  if (updateError) {
    console.error('[/api/automation/jobs/[id]/cancel] Update error:', updateError.message);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
