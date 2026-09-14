import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const N8N_EVENT_SECRET = process.env.N8N_AUTOMATION_SECRET;
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

/**
 * Review automation completion gate (Correction 3).
 * The existing n8n review workflow calls this before sending any review request.
 *
 * Only returns { completed: true } when appointment_status = 'completed'.
 * All other states (no_show, cancelled, booked, pending) return { completed: false }.
 *
 * Authenticated with N8N_EVENT_SECRET (n8n already has this configured).
 * This is a safety gate only — full review job scheduling belongs to Step 4.
 */
export async function POST(request: NextRequest) {
  if (!N8N_EVENT_SECRET) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const auth = request.headers.get('authorization');
  if (!auth || auth !== `Bearer ${N8N_EVENT_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { appointment_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { appointment_id } = body;
  if (!appointment_id || !/^[0-9a-f-]{36}$/.test(appointment_id)) {
    return NextResponse.json({ completed: false, reason: 'invalid_appointment_id' });
  }

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appt } = await (supabase as any)
    .from('appointments')
    .select('appointment_status')
    .eq('id', appointment_id)
    .eq('business_id', BUSINESS_ID)
    .single();

  if (!appt) {
    return NextResponse.json({ completed: false, reason: 'not_found' });
  }

  if (appt.appointment_status === 'completed') {
    return NextResponse.json({ completed: true });
  }

  return NextResponse.json({
    completed: false,
    status: appt.appointment_status,
  });
}
