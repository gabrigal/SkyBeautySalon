import { createSSRClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import type { AppointmentStatus, Appointment, Customer, AppointmentEvent, AutomationJob, AutomationJobStatus } from '@/lib/database.types';
import AppointmentActions from './AppointmentActions';

const SALON_TZ = 'America/New_York';
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  booked: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-600',
  no_show: 'bg-red-100 text-red-700',
};

const JOB_STATUS_LABELS: Record<AutomationJobStatus, string> = {
  pending:    'Scheduled',
  processing: 'Processing',
  sent:       'Sent',
  failed:     'Failed',
  cancelled:  'Cancelled',
};

function formatDT(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: SALON_TZ,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function formatShort(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: SALON_TZ,
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

const EVENT_LABELS: Record<string, string> = {
  appointment_created:     'Appointment booked',
  confirmation_sent:       'Confirmation email sent',
  appointment_rescheduled: 'Rescheduled',
  appointment_cancelled:   'Cancelled',
  review_request_sent:     'Review request sent',
  appointment_completed:   'Appointment completed',
  no_show_marked:          'No-show marked',
  reminder_sent:           'Reminder sent',
  rebooking_reminder_sent: 'Rebooking reminder sent',
  reactivation_sent:       'Reactivation sent',
  automation_failed:       'Automation failed',
  automation_triggered:    'Automation triggered',
};

function JobRow({ label, job, fallback }: { label: string; job: AutomationJob | null; fallback?: string }) {
  const statusColor = !job ? 'text-[#AAAAAA]' :
    job.status === 'failed' ? 'text-red-600' :
    job.status === 'sent' ? 'text-green-700' :
    job.status === 'cancelled' ? 'text-[#777777]' :
    job.status === 'processing' ? 'text-yellow-700' :
    'text-[#000000]';

  const statusText = !job
    ? (fallback ?? 'Not applicable')
    : `${JOB_STATUS_LABELS[job.status]}${job.status === 'failed' ? ' — Action Needed' : ''}`;

  const detail = !job ? '' :
    job.status === 'pending'    ? `for ${formatShort(job.scheduled_for)}` :
    job.status === 'processing' ? `Claimed ${formatShort(job.claimed_at!)}` :
    job.status === 'sent'       ? (job.sent_at ? formatShort(job.sent_at) : '') :
    job.status === 'failed'     ? (job.last_error ?? '') :
    job.status === 'cancelled'  ? (job.last_error === 'customer_rebooked' ? 'Customer rebooked' : (job.last_error ?? '')) :
    '';

  return (
    <tr>
      <td className="px-6 py-3 text-[#000000]">{label}</td>
      <td className="px-6 py-3">
        <span className={`text-xs tracking-widest uppercase ${statusColor}`}>{statusText}</span>
      </td>
      <td className="px-6 py-3 text-xs text-[#777777]">{detail}</td>
    </tr>
  );
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AppointmentDetailPage({ params }: Props) {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [
    { data: rawAppt },
    { data: rawEvents },
    { data: rawJobs },
  ] = await Promise.all([
    sb.from('appointments')
      .select('*, customers(*)')
      .eq('id', id)
      .eq('business_id', BUSINESS_ID)
      .single(),
    sb.from('appointment_events')
      .select('*')
      .eq('appointment_id', id)
      .order('created_at', { ascending: false }),
    sb.from('automation_jobs')
      .select('*')
      .eq('appointment_id', id)
      .order('created_at', { ascending: false }),
  ]);

  const appt = rawAppt as (Appointment & { customers: Customer | null }) | null;
  if (!appt) notFound();

  const events = rawEvents as AppointmentEvent[] | null;
  const jobs = rawJobs as AutomationJob[] | null;

  const customer = appt.customers;
  const status = appt.appointment_status;
  const priceDollars = appt.price_cents != null
    ? `$${(appt.price_cents / 100).toFixed(2)}`
    : '—';

  // Find jobs by type (most recent of each type)
  const reminderJob     = (jobs ?? []).find(j => j.job_type === 'appointment_reminder_24h') ?? null;
  const reviewJob       = (jobs ?? []).find(j => j.job_type === 'review_request') ?? null;
  const rebookingJob    = (jobs ?? []).find(j => j.job_type === 'rebooking_reminder') ?? null;
  const reactivationJob = (jobs ?? []).find(j => j.job_type === 'reactivation') ?? null;

  const confirmationEvent = (events ?? []).find(e => e.event_type === 'confirmation_sent');

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/appointments" className="text-xs text-[#777777] hover:text-[#000000] tracking-widest uppercase">
          ← Appointments
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <h1 className="text-2xl font-serif text-[#000000]">{appt.service}</h1>
        <span className={`px-3 py-1 text-xs tracking-widest uppercase font-medium ${STATUS_COLORS[status]}`}>
          {status.replace('_', ' ')}
        </span>
      </div>

      {/* Staff actions — only shown for booked appointments */}
      {status === 'booked' && (
        <AppointmentActions appointmentId={id} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Appointment details */}
        <div className="bg-white border border-[#DDDDDD] p-6">
          <h2 className="text-[10px] tracking-widest uppercase text-[#777777] mb-4">Appointment Details</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-[#777777]">Date & Time</dt>
              <dd className="text-sm text-[#000000] mt-0.5">{formatDT(appt.appointment_at)}</dd>
            </div>
            {appt.original_appointment_at && (
              <div>
                <dt className="text-xs text-[#777777]">Originally Booked For</dt>
                <dd className="text-sm text-[#000000] mt-0.5 line-through">{formatDT(appt.original_appointment_at)}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-[#777777]">Stylist</dt>
              <dd className="text-sm text-[#000000] mt-0.5">{appt.stylist ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#777777]">Duration</dt>
              <dd className="text-sm text-[#000000] mt-0.5">{appt.duration_minutes ? `${appt.duration_minutes} min` : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#777777]">Price</dt>
              <dd className="text-sm text-[#000000] mt-0.5">{priceDollars}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#777777]">Booked On</dt>
              <dd className="text-sm text-[#000000] mt-0.5">{formatShort(appt.booked_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#777777]">Source</dt>
              <dd className="text-sm text-[#000000] mt-0.5">{appt.booking_source.replace('_', ' ')}</dd>
            </div>
            {appt.completed_at && (
              <div>
                <dt className="text-xs text-[#777777]">Completed At</dt>
                <dd className="text-sm text-[#000000] mt-0.5">{formatShort(appt.completed_at)}</dd>
              </div>
            )}
            {appt.sync_status !== 'synced' && (
              <div>
                <dt className="text-xs text-[#777777]">Sync Status</dt>
                <dd className="text-xs text-red-600 mt-0.5 uppercase tracking-widest">{appt.sync_status}</dd>
                {appt.last_sync_error && (
                  <dd className="text-xs text-[#777777] mt-0.5">{appt.last_sync_error}</dd>
                )}
              </div>
            )}
          </dl>
        </div>

        {/* Customer details */}
        {customer && (
          <div className="bg-white border border-[#DDDDDD] p-6">
            <h2 className="text-[10px] tracking-widest uppercase text-[#777777] mb-4">Customer</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-[#777777]">Name</dt>
                <dd className="mt-0.5">
                  <Link href={`/dashboard/customers/${customer.id}`} className="text-sm font-medium text-[#000000] hover:underline">
                    {customer.first_name} {customer.last_name}
                  </Link>
                </dd>
              </div>
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
            </dl>
          </div>
        )}
      </div>

      {/* Automations */}
      <div className="bg-white border border-[#DDDDDD] mb-6">
        <div className="px-6 py-4 border-b border-[#DDDDDD]">
          <h2 className="text-[10px] tracking-widest uppercase text-[#777777]">Automations</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[420px]">
            <thead className="bg-[#F8F8F8] border-b border-[#DDDDDD]">
              <tr>
                <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-6 py-3 font-normal">Automation</th>
                <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-6 py-3 font-normal">Status</th>
                <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-6 py-3 font-normal">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEEEEE]">
              {/* Confirmation */}
              <tr>
                <td className="px-6 py-3 text-[#000000]">Booking Confirmation</td>
                <td className="px-6 py-3">
                  {confirmationEvent ? (
                    <span className="text-xs tracking-widest uppercase text-green-700">Sent</span>
                  ) : (
                    <span className="text-xs tracking-widest uppercase text-[#777777]">—</span>
                  )}
                </td>
                <td className="px-6 py-3 text-xs text-[#777777]">
                  {confirmationEvent ? formatShort(confirmationEvent.created_at) : ''}
                </td>
              </tr>

              {/* 24h Reminder */}
              <JobRow
                label="24h Reminder"
                job={reminderJob}
                fallback="Not scheduled — booked less than 24h before appointment"
              />

              {/* Review Request */}
              <JobRow
                label="Review Request"
                job={reviewJob}
                fallback={status === 'completed' ? 'Not scheduled' : 'Not applicable'}
              />

              {/* Rebooking Reminder */}
              <JobRow
                label="Rebooking Reminder"
                job={rebookingJob}
                fallback={status === 'completed' ? 'No rule configured for this service' : 'Not applicable'}
              />

              {/* Reactivation */}
              <JobRow
                label="Reactivation"
                job={reactivationJob}
                fallback={status === 'completed' ? 'No rule configured for this service' : 'Not applicable'}
              />
            </tbody>
          </table>
        </div>
      </div>

      {/* Events timeline */}
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
                <span className="text-xs text-[#777777] w-28 md:w-40 shrink-0 pt-0.5">
                  {formatShort(ev.created_at)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${ev.event_type === 'automation_failed' ? 'text-red-600' : 'text-[#000000]'}`}>
                    {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                    {ev.event_type === 'automation_failed' && (
                      <span className="ml-2 text-xs uppercase tracking-widest">Action needed</span>
                    )}
                  </p>
                  {ev.event_type === 'automation_failed' && ev.metadata?.error != null && (
                    <p className="text-xs text-[#777777] mt-0.5">{String(ev.metadata.error)}</p>
                  )}
                  {ev.event_type === 'appointment_rescheduled' && ev.metadata?.previous_appointment_at != null && (
                    <p className="text-xs text-[#777777] mt-0.5">
                      From: {formatShort(String(ev.metadata.previous_appointment_at))}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
