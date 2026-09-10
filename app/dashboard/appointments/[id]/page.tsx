import { createSSRClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import type { AppointmentStatus, Appointment, Customer, AppointmentEvent } from '@/lib/database.types';

const SALON_TZ = 'America/New_York';
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  booked: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-600',
  no_show: 'bg-red-100 text-red-700',
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
  appointment_created: 'Appointment booked',
  confirmation_sent: 'Confirmation email sent',
  appointment_rescheduled: 'Rescheduled',
  appointment_cancelled: 'Cancelled',
  review_request_sent: 'Review request sent',
  appointment_completed: 'Appointment completed',
  no_show_marked: 'No-show marked',
  automation_failed: 'Automation failed',
  automation_triggered: 'Automation triggered',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AppointmentDetailPage({ params }: Props) {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  const { id } = await params;

  // UUID validation
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawAppt } = await (supabase as any)
    .from('appointments')
    .select(`*, customers(*)`)
    .eq('id', id)
    .eq('business_id', BUSINESS_ID)
    .single();

  const appt = rawAppt as (Appointment & { customers: Customer | null }) | null;
  if (!appt) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawEvents } = await (supabase as any)
    .from('appointment_events')
    .select('*')
    .eq('appointment_id', id)
    .order('created_at', { ascending: false });

  const events = rawEvents as AppointmentEvent[] | null;

  const customer = appt.customers;
  const status = appt.appointment_status;
  const priceDollars = appt.price_cents != null
    ? `$${(appt.price_cents / 100).toFixed(2)}`
    : '—';

  return (
    <div className="p-8 max-w-4xl">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
              <div key={ev.id} className="px-6 py-3 flex gap-4">
                <span className="text-xs text-[#777777] w-40 shrink-0 pt-0.5">
                  {formatShort(ev.created_at)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${ev.event_type === 'automation_failed' ? 'text-red-600' : 'text-[#000000]'}`}>
                    {EVENT_LABELS[ev.event_type] ?? ev.event_type}
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
