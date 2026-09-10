'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { createClient } from '@/lib/supabase/client';

const navLinks = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/appointments', label: 'Appointments' },
  { href: '/dashboard/customers', label: 'Customers' },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/dashboard/login');
    router.refresh();
  }

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {navLinks.map(({ href, label }) => {
        const isActive =
          href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center px-3 py-2 text-xs tracking-widest uppercase transition-colors',
              isActive
                ? 'bg-white text-[#000000]'
                : 'text-[#AAAAAA] hover:text-white hover:bg-[#222222]'
            )}
          >
            {label}
          </Link>
        );
      })}

      <button
        onClick={handleSignOut}
        className="w-full flex items-center px-3 py-2 text-xs tracking-widest uppercase text-[#AAAAAA] hover:text-white hover:bg-[#222222] transition-colors mt-4"
      >
        Sign Out
      </button>
    </nav>
  );
}
