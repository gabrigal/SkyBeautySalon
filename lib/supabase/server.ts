import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';

/**
 * SSR client for Server Components and Server Actions.
 * Uses the authenticated user's JWT — RLS policies apply automatically.
 * Use this for all dashboard reads.
 */
export async function createSSRClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll may throw in Server Components; safe to ignore for read-only calls
          }
        },
      },
    }
  );
}

/**
 * Service-role client — bypasses RLS.
 * Use ONLY in trusted server-side code:
 *   - /api/book (no user session available at booking time)
 *   - /api/manage/* (management-token auth, not user-session auth)
 *   - /api/import/* and /api/cron/* (internal operations)
 *
 * NEVER expose SUPABASE_SECRET_KEY to client code.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY is not set');
  }
  // Using untyped client here; hand-written Database generics cause inference issues
  // with supabase-js v2. Runtime behavior is correct — types are asserted where needed.
  return createSupabaseClient(url, key, {
    auth: { persistSession: false },
  });
}
