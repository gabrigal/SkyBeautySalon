import { createSSRClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const SALON_TZ = 'America/New_York';
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function CustomersPage({ searchParams }: Props) {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  const params = await searchParams;
  const search = params.q?.trim() ?? '';
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const pageSize = 50;
  const from = (page - 1) * pageSize;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let query = sb
    .from('customers')
    .select('id, first_name, last_name, email, phone, last_seen_at, created_at', { count: 'exact' })
    .eq('business_id', BUSINESS_ID)
    .order('last_seen_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const { data: rawCustomers, count } = await query;
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

  return (
    <div className="p-8">
      <h1 className="text-2xl font-serif text-[#000000] mb-6">Customers</h1>

      {/* Search */}
      <form method="GET" className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search by name or email…"
          className="border border-[#DDDDDD] px-4 py-2 text-sm focus:outline-none focus:border-[#000000] w-64"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-[#000000] text-white text-xs tracking-widest uppercase hover:bg-[#333333]"
        >
          Search
        </button>
        {search && (
          <Link href="/dashboard/customers" className="px-4 py-2 border border-[#DDDDDD] text-xs tracking-widest uppercase text-[#777777] hover:border-[#000000]">
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="bg-white border border-[#DDDDDD] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F8F8] border-b border-[#DDDDDD]">
            <tr>
              <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-4 py-3 font-normal">Name</th>
              <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-4 py-3 font-normal">Email</th>
              <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-4 py-3 font-normal">Phone</th>
              <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-4 py-3 font-normal">Last Visit</th>
              <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-4 py-3 font-normal">Appointments</th>
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
                return (
                  <tr key={c.id} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/customers/${c.id}`} className="font-medium text-[#000000] hover:underline">
                        {c.first_name} {c.last_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#777777]">{c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-[#777777]">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-[#777777]">{lastVisit}</td>
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
            <Link href={`/dashboard/customers?q=${search}&page=${page - 1}`} className="px-3 py-1.5 border border-[#DDDDDD] text-xs hover:border-[#000000]">
              ← Prev
            </Link>
          )}
          <span className="px-3 py-1.5 text-xs text-[#777777]">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`/dashboard/customers?q=${search}&page=${page + 1}`} className="px-3 py-1.5 border border-[#DDDDDD] text-xs hover:border-[#000000]">
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
