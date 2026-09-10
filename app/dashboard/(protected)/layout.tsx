import { redirect } from 'next/navigation';
import { createSSRClient } from '@/lib/supabase/server';
import Link from 'next/link';
import DashboardNav from './DashboardNav';

export const metadata = {
  title: 'Sky Beauty — Staff Dashboard',
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Server-side auth guard (proxy.ts also redirects, but this is the authoritative check)
  if (!user) {
    redirect('/dashboard/login');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawProfile } = await (supabase as any)
    .from('users')
    .select('full_name, role')
    .eq('id', user.id)
    .single();
  const profile = rawProfile as { full_name: string; role: string } | null;

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-[#000000] text-white flex flex-col min-h-screen">
        <div className="px-6 py-6 border-b border-[#222222]">
          <Link href="/" className="block">
            <span className="text-sm font-serif tracking-widest">SKY BEAUTY</span>
          </Link>
          <span className="text-[10px] tracking-widest text-[#888888] uppercase mt-0.5 block">
            Staff Portal
          </span>
        </div>

        <DashboardNav />

        <div className="mt-auto px-6 py-5 border-t border-[#222222]">
          <p className="text-xs text-[#888888] truncate">
            {profile?.full_name || user.email}
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
