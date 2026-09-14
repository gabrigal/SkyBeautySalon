import { createSSRClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CalendarView from './CalendarView';
import type { CalendarAppointment } from './CalendarView';

const SALON_TZ = 'America/New_York';
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function CalendarPage({ searchParams }: Props) {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  const params = await searchParams;

  // Default to current month in salon timezone
  const nowET = new Date().toLocaleDateString('en-US', {
    timeZone: SALON_TZ, year: 'numeric', month: 'numeric', day: 'numeric',
  });
  const [nowM, , nowY] = nowET.split('/').map(Number);

  const year  = parseInt(params.year  ?? String(nowY), 10) || nowY;
  const month = parseInt(params.month ?? String(nowM), 10) || nowM;

  // Fetch bounds: start of month minus 1 day (UTC) to end of month plus 1 day
  const rangeStart = new Date(Date.UTC(year, month - 1, 1) - 86400 * 1000).toISOString();
  const rangeEnd   = new Date(Date.UTC(year, month, 1) + 86400 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: raw } = await (supabase as any)
    .from('appointments')
    .select('id, service, appointment_status, appointment_at, customers(first_name, last_name)')
    .eq('business_id', BUSINESS_ID)
    .neq('appointment_status', 'pending')
    .gte('appointment_at', rangeStart)
    .lt('appointment_at', rangeEnd)
    .order('appointment_at', { ascending: true });

  const appointments = (raw ?? []) as CalendarAppointment[];

  return (
    <CalendarView
      year={year}
      month={month}
      appointments={appointments}
    />
  );
}
