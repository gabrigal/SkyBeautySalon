import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient, createServiceClient } from '@/lib/supabase/server';

const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

// PATCH — update a retention rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ssrClient = await createSSRClient();
  const { data: { user } } = await ssrClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: { rebook_after_days?: number; reactivation_after_days?: number | null; enabled?: boolean };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.rebook_after_days != null) {
    if (body.rebook_after_days < 1) return NextResponse.json({ error: 'rebook_after_days must be >= 1' }, { status: 400 });
    updates.rebook_after_days = body.rebook_after_days;
  }
  if ('reactivation_after_days' in body) {
    if (body.reactivation_after_days != null && body.reactivation_after_days < 1) {
      return NextResponse.json({ error: 'reactivation_after_days must be >= 1 if provided' }, { status: 400 });
    }
    updates.reactivation_after_days = body.reactivation_after_days ?? null;
  }
  if (typeof body.enabled === 'boolean') updates.enabled = body.enabled;

  const serviceClient = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (serviceClient as any)
    .from('service_retention_rules')
    .update(updates)
    .eq('id', id)
    .eq('business_id', BUSINESS_ID)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ rule: data });
}

// DELETE — remove a retention rule
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ssrClient = await createSSRClient();
  const { data: { user } } = await ssrClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const serviceClient = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (serviceClient as any)
    .from('service_retention_rules')
    .delete()
    .eq('id', id)
    .eq('business_id', BUSINESS_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
