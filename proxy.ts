import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

/**
 * Next.js 16 Proxy (replaces middleware.ts).
 * Runs on /dashboard/* routes to refresh sessions and enforce authentication.
 * /dashboard/login is intentionally excluded to prevent redirect loops.
 *
 * Public routes (/manage/*, /api/book, /api/manage/*, /api/n8n-event, etc.)
 * are not matched — they handle their own auth via management tokens or secrets.
 */
export default async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
