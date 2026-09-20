import { createSSRClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { AppointmentEvent, ServiceRetentionRule } from '@/lib/database.types';

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
    appointment_created:    'Appointment booked',
    confirmation_sent:      'Confirmation sent',
    appointment_rescheduled:'Rescheduled',
    appointment_cancelled:  'Cancelled',
    review_request_sent:    'Review request sent',
    appointment_completed:  'Appointment completed',
    no_show_marked:         'No-show marked',
    automation_failed:      'Automation failed',
    automation_triggered:   'Automation triggered',
    reminder_sent:          'Reminder sent',
    rebooking_reminder_sent:'Rebooking reminder sent',
    reactivation_sent:      'Reactivation sent',
  };
  return labels[type] ?? type;
}

export default async function DashboardPage() {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // ── Core stats ─────────────────────────────────────────────────────────────
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

  // ── Retention metrics ───────────────────────────────────────────────────────
  // Review requests sent (all time)
  const { count: reviewsSent } = await sb
    .from('appointment_events')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', BUSINESS_ID)
    .eq('event_type', 'review_request_sent');

  // Inactive 90+ days: customers whose most recent completed appointment is >= 90 days ago
  // and have no future booked appointment. Use last_seen_at as proxy for last visit.
  const { data: futureBookingCustomers } = await sb
    .from('appointments')
    .select('customer_id')
    .eq('business_id', BUSINESS_ID)
    .eq('appointment_status', 'booked')
    .gt('appointment_at', now.toISOString());
  const futureBookedIds = new Set((futureBookingCustomers ?? []).map((r: { customer_id: string }) => r.customer_id));

  const { count: inactive90Raw } = await sb
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', BUSINESS_ID)
    .lt('last_seen_at', ninetyDaysAgo);
  // Subtract customers who have a future booking from the inactive count
  const { data: recentCustomersWithFuture } = await sb
    .from('customers')
    .select('id')
    .eq('business_id', BUSINESS_ID)
    .lt('last_seen_at', ninetyDaysAgo);
  const inactive90 = (recentCustomersWithFuture ?? []).filter(
    (c: { id: string }) => !futureBookedIds.has(c.id)
  ).length;

  // Due to Rebook: customers with pending/processing/sent rebooking jobs who have no future booking
  const { data: rebookingJobs } = await sb
    .from('automation_jobs')
    .select('customer_id, status')
    .eq('business_id', BUSINESS_ID)
    .eq('job_type', 'rebooking_reminder')
    .in('status', ['pending', 'processing', 'sent', 'failed']);
  const rebookCustomerIds = new Set(
    (rebookingJobs ?? []).map((j: { customer_id: string }) => j.customer_id).filter(Boolean)
  );
  const dueToRebook = [...rebookCustomerIds].filter(cid => !futureBookedIds.has(cid)).length;

  // ── Service retention rules for context ─────────────────────────────────────
  const { data: retentionRules } = await sb
    .from('service_retention_rules')
    .select('service_name, enabled')
    .eq('business_id', BUSINESS_ID);
  const enabledRulesCount = (retentionRules as ServiceRetentionRule[] | null ?? []).filter(r => r.enabled).length;

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

  const coreStats = [
    { label: 'Appointments This Month', value: thisMonth ?? 0 },
    { label: 'Upcoming Appointments',   value: upcoming ?? 0 },
    { label: 'Completed',               value: completed ?? 0 },
    { label: 'Cancelled',               value: cancelled ?? 0 },
    { label: 'Total Customers',         value: totalCustomers ?? 0 },
  ];

  const retentionStats = [
    { label: 'Due to Rebook', value: dueToRebook, href: '/dashboard/customers?filter=due_to_rebook' },
    { label: 'Review Requests Sent', value: reviewsSent ?? 0, href: null },
    { label: 'Inactive 90+ Days', value: inactive90, href: '/dashboard/customers?filter=inactive_90' },
  ];

  void inactive90Raw; // used above via recentCustomersWithFuture

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <h1 className="text-2xl font-serif text-[#000000]">Overview</h1>
        <Link
          href="/dashboard/appointments/new"
          className="bg-[#000000] text-white text-[10px] tracking-widest uppercase px-4 py-2 hover:bg-[#333333] transition-colors"
        >
          + New Appointment
        </Link>
      </div>

      {/* Core stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-6">
        {coreStats.map(({ label, value }) => (
          <div key={label} className="bg-white border border-[#DDDDDD] p-5">
            <p className="text-[10px] tracking-widest text-[#777777] uppercase mb-2">{label}</p>
            <p className="text-3xl font-serif text-[#000000]">{value}</p>
          </div>
        ))}
      </div>

      {/* Retention metrics */}
      <div className="mb-8 md:mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] tracking-widest uppercase text-[#777777]">Retention</h2>
          {enabledRulesCount === 0 && (
            <Link href="/dashboard/settings/retention" className="text-[10px] tracking-widest uppercase text-[#777777] hover:text-[#000000] underline">
              Configure Rules →
            </Link>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {retentionStats.map(({ label, value, href }) => (
            href ? (
              <Link key={label} href={href} className="bg-white border border-[#DDDDDD] p-5 hover:border-[#000000] transition-colors block">
                <p className="text-[10px] tracking-widest text-[#777777] uppercase mb-2">{label}</p>
                <p className="text-3xl font-serif text-[#000000]">{value}</p>
              </Link>
            ) : (
              <div key={label} className="bg-white border border-[#DDDDDD] p-5">
                <p className="text-[10px] tracking-widest text-[#777777] uppercase mb-2">{label}</p>
                <p className="text-3xl font-serif text-[#000000]">{value}</p>
              </div>
            )
          ))}
        </div>
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
              <div key={ev.id} className="px-4 md:px-6 py-3 flex gap-3">
                <span className="text-xs text-[#777777] w-28 md:w-36 shrink-0 pt-0.5">
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
                    <span className="text-xs text-[#999999] ml-1 hidden sm:inline">({ev.appointments.service})</span>
                  )}
                  {ev.event_type === 'automation_failed' && (
                    <span className="block text-xs text-red-500 mt-0.5">Action needed</span>
                  )}
                </div>
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
