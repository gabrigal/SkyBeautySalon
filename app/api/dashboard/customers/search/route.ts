import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';

const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

export async function GET(request: NextRequest) {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ customers: [] });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Normalize phone digits for comparison
  const phoneDigits = q.replace(/\D/g, '');

  const orFilter = [
    `first_name.ilike.%${q}%`,
    `last_name.ilike.%${q}%`,
    `email.ilike.%${q}%`,
    ...(phoneDigits.length >= 4 ? [`phone_normalized.ilike.%${phoneDigits}%`] : []),
  ].join(',');

  const { data, error } = await sb
    .from('customers')
    .select('id, first_name, last_name, email, phone')
    .eq('business_id', BUSINESS_ID)
    .or(orFilter)
    .order('last_seen_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[customers/search] query error:', error.message);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }

  return NextResponse.json({ customers: data ?? [] });
}
