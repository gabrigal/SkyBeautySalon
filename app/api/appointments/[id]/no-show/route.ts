import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient, createServiceClient } from '@/lib/supabase/server';
import { markNoShow } from '@/lib/db/appointments';
import { cancelPendingReminders } from '@/lib/db/automationJobs';
import { logEvent } from '@/lib/db/events';

const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Verify authenticated session
  const ssrClient = await createSSRClient();
  const { data: { user } } = await ssrClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the appointment belongs to this business and is booked
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appt } = await (ssrClient as any)
    .from('appointments')
    .select('id, appointment_status, business_id, customer_id')
    .eq('id', id)
    .eq('business_id', BUSINESS_ID)
    .single();

  if (!appt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (appt.appointment_status !== 'booked') {
    return NextResponse.json(
      { error: 'Only booked appointments can be marked no-show' },
      { status: 409 }
    );
  }

  const serviceClient = createServiceClient();

  try {
    await markNoShow(serviceClient, id);
    await cancelPendingReminders(serviceClient, id);
    await logEvent(serviceClient, {
      businessId: BUSINESS_ID,
      appointmentId: id,
      customerId: appt.customer_id,
      eventType: 'no_show_marked',
      metadata: { marked_by: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/appointments/[id]/no-show] Error:', msg);
    return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 });
  }
}
