import { createSSRClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import type { AppointmentStatus, Customer, AppointmentEvent, AutomationJob } from '@/lib/database.types';

const SALON_TZ = 'America/New_York';
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  booked: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-600',
  no_show: 'bg-red-100 text-red-700',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: SALON_TZ, month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatDT(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: SALON_TZ,
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

const EVENT_LABELS: Record<string, string> = {
  appointment_created:     'Appointment booked',
  confirmation_sent:       'Confirmation sent',
  appointment_rescheduled: 'Rescheduled',
  appointment_cancelled:   'Cancelled',
  review_request_sent:     'Review request sent',
  appointment_completed:   'Appointment completed',
  no_show_marked:          'No-show',
  automation_failed:       'Automation failed',
  reminder_sent:           'Reminder sent',
  rebooking_reminder_sent: 'Rebooking reminder sent',
  reactivation_sent:       'Reactivation sent',
};

type RetentionState = 'Active' | 'Due to Rebook' | 'Inactive' | 'No Rule Configured' | 'In Retention Window';

function getRetentionState(input: {
  hasFutureBooking: boolean;
  lastCompletedAt: string | null;
  rebookJob: AutomationJob | null;
  reactivationJob: AutomationJob | null;
}): { state: RetentionState; color: string } {
  const { hasFutureBooking, lastCompletedAt, rebookJob, reactivationJob } = input;

  if (hasFutureBooking) {
    return { state: 'Active', color: 'text-green-700' };
  }

  if (!lastCompletedAt) {
    return { state: 'Inactive', color: 'text-[#777777]' };
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  if (new Date(lastCompletedAt) < ninetyDaysAgo && !rebookJob && !reactivationJob) {
    return { state: 'Inactive', color: 'text-[#777777]' };
  }

  if (!rebookJob) {
    return { state: 'No Rule Configured', color: 'text-[#999999]' };
  }

  if (['pending', 'processing', 'failed'].includes(rebookJob.status)) {
    const scheduledFor = new Date(rebookJob.scheduled_for);
    if (scheduledFor > new Date()) {
      return { state: 'In Retention Window', color: 'text-blue-700' };
    }
    return { state: 'Due to Rebook', color: 'text-amber-700' };
  }

  return { state: 'In Retention Window', color: 'text-blue-700' };
}

function jobStatusLabel(job: AutomationJob | null, type: string): { label: string; detail: string; color: string } {
  if (!job) return { label: 'Not applicable', detail: '', color: 'text-[#AAAAAA]' };
  switch (job.status) {
    case 'pending':    return { label: 'Scheduled', detail: `for ${formatDT(job.scheduled_for)}`, color: 'text-[#000000]' };
    case 'processing': return { label: 'Processing', detail: '', color: 'text-yellow-700' };
    case 'sent':       return { label: 'Sent', detail: job.sent_at ? formatDT(job.sent_at) : '', color: 'text-green-700' };
    case 'failed':     return { label: 'Failed — Action Needed', detail: job.last_error ?? '', color: 'text-red-600' };
    case 'cancelled':  return { label: 'Cancelled', detail: job.last_error === 'customer_rebooked' ? 'Customer rebooked' : (job.last_error ?? ''), color: 'text-[#777777]' };
    default:           return { label: job.status, detail: '', color: 'text-[#777777]' };
  }
  void type;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [
    { data: rawCustomer },
    { data: rawAppts },
    { data: rawEvents },
    { data: rawJobs },
  ] = await Promise.all([
    sb.from('customers').select('*').eq('id', id).eq('business_id', BUSINESS_ID).single(),
    sb.from('appointments')
      .select('id, service, stylist, appointment_at, appointment_status, price_cents, completed_at')
      .eq('customer_id', id)
      .eq('business_id', BUSINESS_ID)
      .order('appointment_at', { ascending: false }),
    sb.from('appointment_events')
      .select('*')
      .eq('customer_id', id)
      .eq('business_id', BUSINESS_ID)
      .order('created_at', { ascending: false })
      .limit(30),
    sb.from('automation_jobs')
      .select('*')
      .eq('customer_id', id)
      .eq('business_id', BUSINESS_ID)
      .order('created_at', { ascending: false }),
  ]);

  const customer = rawCustomer as Customer | null;
  if (!customer) notFound();

  type ApptRow = { id: string; service: string; stylist: string | null; appointment_at: string; appointment_status: string; price_cents: number | null; completed_at: string | null };
  const appointments = rawAppts as ApptRow[] | null;
  const events = rawEvents as AppointmentEvent[] | null;
  const jobs = rawJobs as AutomationJob[] | null;

  const now = new Date().toISOString();
  const upcoming = (appointments ?? []).filter(a =>
    a.appointment_status === 'booked' && a.appointment_at > now
  );
  const total = (appointments ?? []).filter(a => a.appointment_status !== 'pending').length;
  const completedCount = (appointments ?? []).filter(a => a.appointment_status === 'completed').length;

  // Most recent completed appointment (for retention context)
  const lastCompleted = (appointments ?? []).find(a => a.appointment_status === 'completed') ?? null;
  const hasFutureBooking = upcoming.length > 0;

  // Find the most recent retention jobs
  const reviewJob = (jobs ?? []).find(j => j.job_type === 'review_request') ?? null;
  const rebookJob = (jobs ?? []).find(j => j.job_type === 'rebooking_reminder') ?? null;
  const reactivationJob = (jobs ?? []).find(j => j.job_type === 'reactivation') ?? null;

  const { state: retentionState, color: retentionColor } = getRetentionState({
    hasFutureBooking,
    lastCompletedAt: lastCompleted?.completed_at ?? null,
    rebookJob,
    reactivationJob,
  });

  const reviewStatus = jobStatusLabel(reviewJob, 'review_request');
  const rebookStatus = jobStatusLabel(rebookJob, 'rebooking_reminder');
  const reactivationStatus = jobStatusLabel(reactivationJob, 'reactivation');

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/customers" className="text-xs text-[#777777] hover:text-[#000000] tracking-widest uppercase">
          ← Customers
        </Link>
      </div>

      <h1 className="text-2xl font-serif text-[#000000] mb-8">
        {customer.first_name} {customer.last_name}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Contact */}
        <div className="bg-white border border-[#DDDDDD] p-6">
          <h2 className="text-[10px] tracking-widest uppercase text-[#777777] mb-4">Contact</h2>
          <dl className="space-y-3">
            {customer.email && (
              <div>
                <dt className="text-xs text-[#777777]">Email</dt>
                <dd className="text-sm text-[#000000] mt-0.5">{customer.email}</dd>
              </div>
            )}
            {customer.phone && (
              <div>
                <dt className="text-xs text-[#777777]">Phone</dt>
                <dd className="text-sm text-[#000000] mt-0.5">{customer.phone}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-[#777777]">First Visit</dt>
              <dd className="text-sm text-[#000000] mt-0.5">{formatDate(customer.first_seen_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#777777]">Last Visit</dt>
              <dd className="text-sm text-[#000000] mt-0.5">{formatDate(customer.last_seen_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#777777]">Completed Visits</dt>
              <dd className="text-sm text-[#000000] mt-0.5">{completedCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#777777]">Total Appointments</dt>
              <dd className="text-sm text-[#000000] mt-0.5">{total}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#777777]">Source</dt>
              <dd className="text-sm text-[#000000] mt-0.5">{customer.source.replace('_', ' ')}</dd>
            </div>
          </dl>
        </div>

        {/* Upcoming */}
        <div className="bg-white border border-[#DDDDDD] p-6">
          <h2 className="text-[10px] tracking-widest uppercase text-[#777777] mb-4">Upcoming</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-[#777777]">No upcoming appointments.</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map(a => (
                <Link key={a.id} href={`/dashboard/appointments/${a.id}`} className="block hover:bg-[#FAFAFA] -mx-2 px-2 py-2 rounded">
                  <p className="text-sm font-medium text-[#000000]">{a.service}</p>
                  <p className="text-xs text-[#777777]">{formatDT(a.appointment_at)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Retention */}
      <div className="bg-white border border-[#DDDDDD] mb-6">
        <div className="px-6 py-4 border-b border-[#DDDDDD] flex items-center justify-between">
          <h2 className="text-[10px] tracking-widest uppercase text-[#777777]">Retention</h2>
          <span className={`text-xs font-medium tracking-widest uppercase ${retentionColor}`}>
            {retentionState}
          </span>
        </div>
        <div className="divide-y divide-[#EEEEEE]">
          {/* Last service context */}
          {lastCompleted && (
            <div className="px-6 py-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-[#777777] mb-0.5">Last Service</p>
                <p className="text-sm text-[#000000]">{lastCompleted.service}</p>
                {lastCompleted.completed_at && (
                  <p className="text-xs text-[#777777] mt-0.5">{formatDT(lastCompleted.completed_at)}</p>
                )}
              </div>
              <Link href={`/dashboard/appointments/${lastCompleted.id}`} className="text-[10px] tracking-widest uppercase text-[#777777] hover:text-[#000000] shrink-0 mt-0.5">
                View →
              </Link>
            </div>
          )}

          {/* Review Request */}
          <div className="px-6 py-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[#777777] mb-1">Review Request</p>
              <p className={`text-sm ${reviewStatus.color}`}>{reviewStatus.label}</p>
              {reviewStatus.detail && <p className="text-xs text-[#777777] mt-0.5">{reviewStatus.detail}</p>}
            </div>
          </div>

          {/* Rebooking Reminder */}
          <div className="px-6 py-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[#777777] mb-1">Rebooking Reminder</p>
              <p className={`text-sm ${rebookStatus.color}`}>{rebookStatus.label}</p>
              {rebookStatus.detail && <p className="text-xs text-[#777777] mt-0.5">{rebookStatus.detail}</p>}
            </div>
          </div>

          {/* Reactivation */}
          <div className="px-6 py-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[#777777] mb-1">Reactivation</p>
              <p className={`text-sm ${reactivationStatus.color}`}>{reactivationStatus.label}</p>
              {reactivationStatus.detail && <p className="text-xs text-[#777777] mt-0.5">{reactivationStatus.detail}</p>}
            </div>
          </div>

          {/* Next Appointment */}
          <div className="px-6 py-3">
            <p className="text-xs text-[#777777] mb-1">Next Appointment</p>
            {upcoming.length > 0 ? (
              <p className="text-sm text-[#000000]">
                {upcoming[0].service} — {formatDT(upcoming[0].appointment_at)}
              </p>
            ) : (
              <p className="text-sm text-[#777777]">None scheduled</p>
            )}
          </div>
        </div>
      </div>

      {/* Appointment history */}
      <div className="bg-white border border-[#DDDDDD] mb-6">
        <div className="px-6 py-4 border-b border-[#DDDDDD]">
          <h2 className="text-[10px] tracking-widest uppercase text-[#777777]">Appointment History</h2>
        </div>
        <div className="divide-y divide-[#EEEEEE]">
          {(appointments ?? []).length === 0 ? (
            <p className="px-6 py-6 text-sm text-[#777777]">No appointments.</p>
          ) : (
            (appointments ?? []).map(a => {
              const status = a.appointment_status as AppointmentStatus;
              return (
                <Link key={a.id} href={`/dashboard/appointments/${a.id}`} className="flex items-center gap-4 px-6 py-3 hover:bg-[#FAFAFA] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#000000]">{a.service}</p>
                    <p className="text-xs text-[#777777]">{a.stylist ?? ''} {formatDT(a.appointment_at)}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] tracking-widest uppercase ${STATUS_COLORS[status]}`}>
                    {status.replace('_', ' ')}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Activity timeline */}
      <div className="bg-white border border-[#DDDDDD]">
        <div className="px-6 py-4 border-b border-[#DDDDDD]">
          <h2 className="text-[10px] tracking-widest uppercase text-[#777777]">Activity Timeline</h2>
        </div>
        <div className="divide-y divide-[#EEEEEE]">
          {(events ?? []).length === 0 ? (
            <p className="px-6 py-6 text-sm text-[#777777]">No events recorded.</p>
          ) : (
            (events as AppointmentEvent[]).map(ev => (
              <div key={ev.id} className="px-4 md:px-6 py-3 flex gap-3">
                <span className="text-xs text-[#777777] w-28 md:w-36 shrink-0 pt-0.5">{formatDT(ev.created_at)}</span>
                <p className={`text-sm ${ev.event_type === 'automation_failed' ? 'text-red-600' : 'text-[#000000]'}`}>
                  {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
