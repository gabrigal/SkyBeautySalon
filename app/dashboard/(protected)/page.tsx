import { createSSRClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { AppointmentEvent } from '@/lib/database.types';

const SALON_TZ = 'America/New_York';
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

function formatEventTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: SALON_TZ,
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    appointment_created: 'Appointment booked',
    confirmation_sent: 'Confirmation sent',
    appointment_rescheduled: 'Rescheduled',
    appointment_cancelled: 'Cancelled',
    review_request_sent: 'Review request sent',
    appointment_completed: 'Appointment completed',
    no_show_marked: 'No-show marked',
    automation_failed: 'Automation failed',
    automation_triggered: 'Automation triggered',
  };
  return labels[type] ?? type;
}

export default async function DashboardPage() {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  // ── Stats ──────────────────────────────────────────────────────────────────
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [
    { count: thisMonth },
    { count: upcoming },
    { count: completed },
    { count: cancelled },
    { count: totalCustomers },
  ] = await Promise.all([
    sb.from('appointments').select('*', { count: 'exact', head: true }).eq('business_id', BUSINESS_ID).gte('booked_at', monthStart),
    sb.from('appointments').select('*', { count: 'exact', head: true }).eq('business_id', BUSINESS_ID).eq('appointment_status', 'booked').gte('appointment_at', now.toISOString()),
    sb.from('appointments').select('*', { count: 'exact', head: true }).eq('business_id', BUSINESS_ID).eq('appointment_status', 'completed'),
    sb.from('appointments').select('*', { count: 'exact', head: true }).eq('business_id', BUSINESS_ID).eq('appointment_status', 'cancelled'),
    sb.from('customers').select('*', { count: 'exact', head: true }).eq('business_id', BUSINESS_ID),
  ]);

  // ── Recent activity ────────────────────────────────────────────────────────
  const { data: rawEvents } = await sb
    .from('appointment_events')
    .select('*, appointments(service, appointment_at, stylist), customers(first_name, last_name)')
    .eq('business_id', BUSINESS_ID)
    .order('created_at', { ascending: false })
    .limit(20);
  type EventRow = AppointmentEvent & {
    appointments?: { service: string; appointment_at: string; stylist: string | null } | null;
    customers?: { first_name: string; last_name: string } | null;
  };
  const recentEvents = rawEvents as EventRow[] | null;

  const stats = [
    { label: 'Appointments This Month', value: thisMonth ?? 0 },
    { label: 'Upcoming Appointments',   value: upcoming ?? 0 },
    { label: 'Completed',               value: completed ?? 0 },
    { label: 'Cancelled',               value: cancelled ?? 0 },
    { label: 'Total Customers',         value: totalCustomers ?? 0 },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-serif text-[#000000] mb-8">Overview</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-white border border-[#DDDDDD] p-5">
            <p className="text-[10px] tracking-widest text-[#777777] uppercase mb-2">{label}</p>
            <p className="text-3xl font-serif text-[#000000]">{value}</p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="bg-white border border-[#DDDDDD]">
        <div className="px-6 py-4 border-b border-[#DDDDDD]">
          <h2 className="text-sm font-serif tracking-widest text-[#000000] uppercase">Recent Activity</h2>
        </div>
        <div className="divide-y divide-[#EEEEEE]">
          {(recentEvents ?? []).length === 0 ? (
            <p className="px-6 py-8 text-sm text-[#777777] text-center">No activity yet.</p>
          ) : (
            (recentEvents ?? []).map(ev => (
              <div key={ev.id} className="px-6 py-3 flex items-center gap-4">
                <span className="text-xs text-[#777777] w-36 shrink-0">
                  {formatEventTime(ev.created_at)}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-[#000000]">{eventLabel(ev.event_type)}</span>
                  {ev.customers && (
                    <span className="text-sm text-[#777777] ml-2">
                      — {ev.customers.first_name} {ev.customers.last_name}
                    </span>
                  )}
                  {ev.appointments?.service && (
                    <span className="text-xs text-[#999999] ml-2">({ev.appointments.service})</span>
                  )}
                </div>
                {ev.event_type === 'automation_failed' && (
                  <span className="text-xs text-red-500 shrink-0">Action needed</span>
                )}
              </div>
            ))
          )}
        </div>
        {(recentEvents ?? []).length > 0 && (
          <div className="px-6 py-4 border-t border-[#DDDDDD]">
            <Link href="/dashboard/appointments" className="text-xs tracking-widest uppercase text-[#000000] hover:underline">
              View All Appointments →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
