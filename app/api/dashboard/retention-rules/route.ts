import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient, createServiceClient } from '@/lib/supabase/server';

const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

// GET — list all retention rules for this business
export async function GET() {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('service_retention_rules')
    .select('*')
    .eq('business_id', BUSINESS_ID)
    .order('service_name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

// POST — create a new retention rule
export async function POST(request: NextRequest) {
  const ssrClient = await createSSRClient();
  const { data: { user } } = await ssrClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { service_name?: string; rebook_after_days?: number; reactivation_after_days?: number | null; enabled?: boolean };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { service_name, rebook_after_days, reactivation_after_days = null, enabled = true } = body;

  if (!service_name?.trim()) return NextResponse.json({ error: 'service_name is required' }, { status: 400 });
  if (!rebook_after_days || rebook_after_days < 1) return NextResponse.json({ error: 'rebook_after_days must be >= 1' }, { status: 400 });
  if (reactivation_after_days != null && reactivation_after_days < 1) {
    return NextResponse.json({ error: 'reactivation_after_days must be >= 1 if provided' }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (serviceClient as any)
    .from('service_retention_rules')
    .insert({
      business_id:             BUSINESS_ID,
      service_name:            service_name.trim(),
      rebook_after_days,
      reactivation_after_days: reactivation_after_days ?? null,
      enabled,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'A rule for this service already exists' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rule: data }, { status: 201 });
}
