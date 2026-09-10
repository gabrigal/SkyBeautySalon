import { createSSRClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { AppointmentStatus } from '@/lib/database.types';

const SALON_TZ = 'America/New_York';
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

type StatusFilter = AppointmentStatus | 'all';

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Pending',
  booked: 'Booked',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  booked: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-600',
  no_show: 'bg-red-100 text-red-700',
};

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AppointmentsPage({ searchParams }: Props) {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  const params = await searchParams;
  const statusFilter = (params.status as StatusFilter) ?? 'all';
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const pageSize = 50;
  const from = (page - 1) * pageSize;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let query = sb
    .from('appointments')
    .select(`id, service, stylist, appointment_at, appointment_status, sync_status, booked_at, price_cents, currency, customers(first_name, last_name, email)`, { count: 'exact' })
    .eq('business_id', BUSINESS_ID)
    .order('appointment_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (statusFilter !== 'all') {
    query = query.eq('appointment_status', statusFilter);
  }

  const { data: rawAppts, count } = await query;
  type ApptRow = { id: string; service: string; stylist: string | null; appointment_at: string; appointment_status: string; sync_status: string; booked_at: string; price_cents: number | null; currency: string; customers: { first_name: string; last_name: string; email: string | null } | null };
  const appointments = rawAppts as ApptRow[] | null;
  const totalPages = Math.ceil((count ?? 0) / pageSize);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-serif text-[#000000] mb-6">Appointments</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['all', 'booked', 'completed', 'cancelled', 'pending', 'no_show'] as const).map(s => (
          <Link
            key={s}
            href={`/dashboard/appointments?status=${s}`}
            className={`px-3 py-1.5 text-xs tracking-widest uppercase border transition-colors ${
              statusFilter === s
                ? 'bg-[#000000] text-white border-[#000000]'
                : 'bg-white text-[#777777] border-[#DDDDDD] hover:border-[#000000]'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s as AppointmentStatus]}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#DDDDDD] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F8F8] border-b border-[#DDDDDD]">
            <tr>
              <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-4 py-3 font-normal">Customer</th>
              <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-4 py-3 font-normal">Service</th>
              <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-4 py-3 font-normal">Stylist</th>
              <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-4 py-3 font-normal">Date & Time</th>
              <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-4 py-3 font-normal">Status</th>
              <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-4 py-3 font-normal">Booked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEEEEE]">
            {(appointments ?? []).length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[#777777]">No appointments found.</td></tr>
            ) : (
              (appointments ?? []).map(appt => {
                const customer = appt.customers;
                const apptDate = new Date(appt.appointment_at);
                const displayDate = apptDate.toLocaleDateString('en-US', {
                  timeZone: SALON_TZ, month: 'short', day: 'numeric', year: 'numeric',
                });
                const displayTime = apptDate.toLocaleTimeString('en-US', {
                  timeZone: SALON_TZ, hour: 'numeric', minute: '2-digit', hour12: true,
                });
                const bookedDate = new Date(appt.booked_at).toLocaleDateString('en-US', {
                  timeZone: SALON_TZ, month: 'short', day: 'numeric',
                });
                const status = appt.appointment_status as AppointmentStatus;

                return (
                  <tr key={appt.id} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/appointments/${appt.id}`} className="font-medium text-[#000000] hover:underline">
                        {customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown'}
                      </Link>
                      {customer?.email && (
                        <p className="text-xs text-[#777777]">{customer.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#000000]">{appt.service}</td>
                    <td className="px-4 py-3 text-[#777777]">{appt.stylist ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-[#000000]">{displayDate}</span>
                      <span className="text-[#777777] ml-1">{displayTime}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] tracking-widest uppercase font-medium ${STATUS_COLORS[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                      {appt.sync_status === 'failed' && (
                        <span className="ml-1 text-[10px] text-red-500 tracking-widest uppercase">sync failed</span>
                      )}
                      {appt.sync_status === 'needs_reconciliation' && (
                        <span className="ml-1 text-[10px] text-yellow-600 tracking-widest uppercase">reconciling</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#777777] text-xs">{bookedDate}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 mt-4 justify-end">
          {page > 1 && (
            <Link href={`/dashboard/appointments?status=${statusFilter}&page=${page - 1}`} className="px-3 py-1.5 border border-[#DDDDDD] text-xs hover:border-[#000000]">
              ← Prev
            </Link>
          )}
          <span className="px-3 py-1.5 text-xs text-[#777777]">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`/dashboard/appointments?status=${statusFilter}&page=${page + 1}`} className="px-3 py-1.5 border border-[#DDDDDD] text-xs hover:border-[#000000]">
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
