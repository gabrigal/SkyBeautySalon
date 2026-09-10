import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any>;

export type EventType =
  | 'appointment_created'
  | 'confirmation_sent'
  | 'appointment_rescheduled'
  | 'appointment_cancelled'
  | 'review_request_sent'
  | 'appointment_completed'
  | 'no_show_marked'
  | 'automation_triggered'
  | 'automation_failed';

interface LogEventInput {
  businessId: string;
  eventType: EventType;
  appointmentId?: string | null;
  customerId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Appends an immutable event to the appointment_events timeline.
 * Used by trusted server-side code only (service_role client).
 * Events are never deleted or modified.
 */
export async function logEvent(
  supabase: Supabase,
  input: LogEventInput
): Promise<void> {
  const { error } = await supabase.from('appointment_events').insert({
    business_id: input.businessId,
    event_type: input.eventType,
    appointment_id: input.appointmentId ?? null,
    customer_id: input.customerId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    // Log event failures should not crash the primary operation.
    console.error('[logEvent] Failed to write event:', error.message, {
      eventType: input.eventType,
      appointmentId: input.appointmentId,
    });
  }
}
