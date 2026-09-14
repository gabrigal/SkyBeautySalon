import { createSSRClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const SALON_TZ = 'America/New_York';
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

const FILTER_LABELS: Record<string, string> = {
  all:            'All',
  due_to_rebook:  'Due to Rebook',
  inactive_90:    'Inactive 90+ Days',
  review_pending: 'Review Pending',
};

interface Props {
  searchParams: Promise<{ q?: string; page?: string; filter?: string }>;
}

export default async function CustomersPage({ searchParams }: Props) {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  const params = await searchParams;
  const search = params.q?.trim() ?? '';
  const filter = params.filter ?? 'all';
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const pageSize = 50;
  const from = (page - 1) * pageSize;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // ── Pre-compute filter sets ─────────────────────────────────────────────────
  // Customers with a future booked appointment
  const { data: futureRows } = await sb
    .from('appointments')
    .select('customer_id')
    .eq('business_id', BUSINESS_ID)
    .eq('appointment_status', 'booked')
    .gt('appointment_at', now.toISOString());
  const futureBookedIds = new Set((futureRows ?? []).map((r: { customer_id: string }) => r.customer_id));

  // Customers with pending/processing/sent/failed rebooking jobs
  const { data: rebookJobs } = await sb
    .from('automation_jobs')
    .select('customer_id')
    .eq('business_id', BUSINESS_ID)
    .eq('job_type', 'rebooking_reminder')
    .in('status', ['pending', 'processing', 'sent', 'failed']);
  const rebookCandidateIds = new Set(
    (rebookJobs ?? []).map((j: { customer_id: string }) => j.customer_id).filter(Boolean)
  );
  // "Due to Rebook" = has rebooking job AND no future booking
  const dueToRebookIds = [...rebookCandidateIds].filter(id => !futureBookedIds.has(id));

  // Customers with pending/processing review_request jobs
  const { data: reviewJobs } = await sb
    .from('automation_jobs')
    .select('customer_id')
    .eq('business_id', BUSINESS_ID)
    .eq('job_type', 'review_request')
    .in('status', ['pending', 'processing']);
  const reviewPendingIds = new Set(
    (reviewJobs ?? []).map((j: { customer_id: string }) => j.customer_id).filter(Boolean)
  );

  // ── Build base customer query ───────────────────────────────────────────────
  let query = sb
    .from('customers')
    .select('id, first_name, last_name, email, phone, last_seen_at, created_at', { count: 'exact' })
    .eq('business_id', BUSINESS_ID)
    .order('last_seen_at', { ascending: false });

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  // Apply filter by restricting to specific customer IDs
  if (filter === 'due_to_rebook') {
    if (dueToRebookIds.length === 0) {
      query = query.in('id', ['00000000-0000-0000-0000-000000000000']); // empty result
    } else {
      query = query.in('id', dueToRebookIds);
    }
  } else if (filter === 'inactive_90') {
    query = query.lt('last_seen_at', ninetyDaysAgo).not('id', 'in', `(${[...futureBookedIds].join(',')})`);
  } else if (filter === 'review_pending') {
    const ids = [...reviewPendingIds];
    if (ids.length === 0) {
      query = query.in('id', ['00000000-0000-0000-0000-000000000000']);
    } else {
      query = query.in('id', ids);
    }
  }

  const { data: rawCustomers, count } = await query.range(from, from + pageSize - 1);
  type CustomerRow = { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; last_seen_at: string; created_at: string };
  const customers = rawCustomers as CustomerRow[] | null;
  const totalPages = Math.ceil((count ?? 0) / pageSize);

  // Get appointment counts per customer
  const customerIds = (customers ?? []).map((c: CustomerRow) => c.id);
  type ApptCount = { customer_id: string; appointment_status: string };
  const { data: rawCounts } = customerIds.length > 0
    ? await sb.from('appointments').select('customer_id, appointment_status').in('customer_id', customerIds).neq('appointment_status', 'pending')
    : { data: [] };
  const appointmentCounts = rawCounts as ApptCount[] | null;

  const countMap: Record<string, { total: number }> = {};
  for (const appt of appointmentCounts ?? []) {
    if (!countMap[appt.customer_id]) countMap[appt.customer_id] = { total: 0 };
    countMap[appt.customer_id].total++;
  }

  const baseHref = (f: string) =>
    `/dashboard/customers?filter=${f}${search ? `&q=${encodeURIComponent(search)}` : ''}`;

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-serif text-[#000000] mb-6">Customers</h1>

      {/* Search */}
      <form method="GET" className="mb-4 flex gap-2">
        <input type="hidden" name="filter" value={filter} />
        <input
          name="q"
          defaultValue={search}
          placeholder="Search by name or email…"
          className="border border-[#DDDDDD] px-4 py-2 text-sm focus:outline-none focus:border-[#000000] flex-1 md:flex-none md:w-64"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-[#000000] text-white text-xs tracking-widest uppercase hover:bg-[#333333]"
        >
          Search
        </button>
        {search && (
          <Link href={baseHref(filter)} className="px-4 py-2 border border-[#DDDDDD] text-xs tracking-widest uppercase text-[#777777] hover:border-[#000000]">
            Clear
          </Link>
        )}
      </form>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
        {Object.entries(FILTER_LABELS).map(([key, label]) => (
          <Link
            key={key}
            href={baseHref(key)}
            className={`px-3 py-1.5 text-[10px] tracking-widest uppercase whitespace-nowrap transition-colors border ${
              filter === key
                ? 'bg-[#000000] text-white border-[#000000]'
                : 'border-[#DDDDDD] text-[#777777] hover:border-[#000000] hover:text-[#000000]'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#DDDDDD] overflow-x-auto">
        <table className="w-full text-sm min-w-[400px]">
          <thead className="bg-[#F8F8F8] border-b border-[#DDDDDD]">
            <tr>
              <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-4 py-3 font-normal">Name</th>
              <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-4 py-3 font-normal hidden sm:table-cell">Email</th>
              <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-4 py-3 font-normal hidden md:table-cell">Phone</th>
              <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-4 py-3 font-normal hidden sm:table-cell">Last Visit</th>
              <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-4 py-3 font-normal">Appts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEEEEE]">
            {(customers ?? []).length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[#777777]">No customers found.</td></tr>
            ) : (
              (customers ?? []).map(c => {
                const lastVisit = new Date(c.last_seen_at).toLocaleDateString('en-US', {
                  timeZone: SALON_TZ, month: 'short', day: 'numeric', year: 'numeric',
                });
                const isDueToRebook = dueToRebookIds.includes(c.id);
                return (
                  <tr key={c.id} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/customers/${c.id}`} className="font-medium text-[#000000] hover:underline">
                        {c.first_name} {c.last_name}
                      </Link>
                      {isDueToRebook && (
                        <span className="ml-2 text-[9px] tracking-widest uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 hidden sm:inline">
                          Due to rebook
                        </span>
                      )}
                      {c.email && <p className="text-xs text-[#777777] sm:hidden mt-0.5 truncate max-w-[180px]">{c.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-[#777777] hidden sm:table-cell">{c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-[#777777] hidden md:table-cell">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-[#777777] hidden sm:table-cell">{lastVisit}</td>
                    <td className="px-4 py-3 text-[#000000]">{countMap[c.id]?.total ?? 0}</td>
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
            <Link href={`/dashboard/customers?q=${search}&filter=${filter}&page=${page - 1}`} className="px-3 py-1.5 border border-[#DDDDDD] text-xs hover:border-[#000000]">
              ← Prev
            </Link>
          )}
          <span className="px-3 py-1.5 text-xs text-[#777777]">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`/dashboard/customers?q=${search}&filter=${filter}&page=${page + 1}`} className="px-3 py-1.5 border border-[#DDDDDD] text-xs hover:border-[#000000]">
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
