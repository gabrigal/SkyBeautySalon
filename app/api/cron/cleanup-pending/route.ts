import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const CRON_SECRET = process.env.CRON_SECRET;
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;
const STALE_AFTER_MINUTES = 10;

/**
 * GET /api/cron/cleanup-pending
 *
 * Marks stale pending appointments (pending > 10 min with sync_status='pending')
 * as sync_status='failed' so they no longer hold time slots.
 *
 * Run this on a schedule (e.g., every 5 minutes via Vercel Cron).
 * Protected by CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - STALE_AFTER_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('appointments')
    .update({
      sync_status: 'failed',
      last_sync_error: 'Timed out without confirmation — cleaned up by cron',
      updated_at: new Date().toISOString(),
    })
    .eq('appointment_status', 'pending')
    .eq('sync_status', 'pending')
    .lt('created_at', cutoff)
    .eq('business_id', BUSINESS_ID)
    .select('id');

  if (error) {
    console.error('[cleanup-pending] error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ cleaned: data?.length ?? 0 });
}
