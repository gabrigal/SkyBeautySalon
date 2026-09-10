import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { logEvent, type EventType } from '@/lib/db/events';

const N8N_EVENT_SECRET = process.env.N8N_EVENT_SECRET;
const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

const ALLOWED_EVENTS: EventType[] = [
  'confirmation_sent',
  'appointment_completed',
  'review_request_sent',
  'automation_failed',
  'automation_triggered',
];

interface N8nEventBody {
  event_type: string;
  appointment_id?: string;
  customer_id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/n8n-event
 *
 * Receives lifecycle events from n8n automations so they appear in the
 * dashboard activity timeline.
 *
 * Authentication: Bearer token in Authorization header (N8N_EVENT_SECRET).
 *
 * Future n8n workflows (reminder, review request, etc.) should POST here
 * after executing their automation steps.
 */
export async function POST(request: NextRequest) {
  // ── Authenticate ──────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '').trim();

  if (!N8N_EVENT_SECRET || token !== N8N_EVENT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: N8nEventBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { event_type, appointment_id, customer_id, metadata } = body;

  if (!event_type) {
    return NextResponse.json({ error: 'event_type is required' }, { status: 400 });
  }

  if (!ALLOWED_EVENTS.includes(event_type as EventType)) {
    return NextResponse.json(
      { error: `Unknown event_type. Allowed: ${ALLOWED_EVENTS.join(', ')}` },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  await logEvent(supabase, {
    businessId: BUSINESS_ID,
    eventType: event_type as EventType,
    appointmentId: appointment_id ?? null,
    customerId: customer_id ?? null,
    metadata: metadata ?? {},
  });

  return NextResponse.json({ success: true });
}
