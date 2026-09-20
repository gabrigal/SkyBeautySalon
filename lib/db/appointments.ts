import type { SupabaseClient } from '@supabase/supabase-js';
import type { Appointment } from '@/lib/database.types';
import { generateManagementToken, hashToken } from '@/lib/tokens';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any>;

export interface CreateAppointmentInput {
  businessId: string;
  customerId: string;
  service: string;
  stylist: string;
  appointmentAt: string;    // ISO string (UTC)
  appointmentEndAt: string; // ISO string (UTC)
  durationMinutes: number;
  priceCents?: number | null;
  bookingSource?: 'online_booking' | 'historical_import' | 'manual' | 'phone' | 'walk_in' | 'instagram' | 'other';
  notes?: string | null;
  externalBookingId?: string | null; // for historical imports with known GCal ID
}

export interface CreatedAppointment {
  appointment: Appointment;
  rawToken: string;
  gcalEventId: string;
}

/**
 * Creates a new appointment in 'pending' status with a secure management token.
 * Returns the raw management token (used in URLs — never stored in DB).
 * The Google Calendar event ID is deterministic: appointment UUID without dashes.
 */
export async function createAppointment(
  supabase: Supabase,
  input: CreateAppointmentInput
): Promise<CreatedAppointment> {
  const appointmentId = crypto.randomUUID();
  const { rawToken, tokenHash, gcalEventId } = generateManagementToken(appointmentId);

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      id: appointmentId,
      business_id: input.businessId,
      customer_id: input.customerId,
      service: input.service,
      stylist: input.stylist,
      appointment_at: input.appointmentAt,
      appointment_end_at: input.appointmentEndAt,
      duration_minutes: input.durationMinutes,
      price_cents: input.priceCents ?? null,
      appointment_status: 'pending',
      sync_status: 'pending',
      sync_operation: 'calendar_create',
      last_sync_attempt_at: new Date().toISOString(),
      booking_source: input.bookingSource ?? 'online_booking',
      external_booking_id: input.externalBookingId ?? gcalEventId,
      management_token_hash: tokenHash,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create appointment: ${error.message}`);
  return { appointment: data, rawToken, gcalEventId };
}

/**
 * Marks a pending appointment as booked after successful GCal creation.
 */
export async function confirmAppointment(
  supabase: Supabase,
  appointmentId: string,
  calendarEventId: string
): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({
      appointment_status: 'booked',
      sync_status: 'synced',
      sync_operation: null,
      external_booking_id: calendarEventId,
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId);

  if (error) throw new Error(`Failed to confirm appointment: ${error.message}`);
}

/**
 * Marks a pending appointment as sync-failed after a confirmed n8n/GCal failure.
 * sync_status='failed' releases the slot in the EXCLUDE constraint.
 */
export async function failAppointmentSync(
  supabase: Supabase,
  appointmentId: string,
  errorMessage: string
): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({
      sync_status: 'failed',
      last_sync_error: errorMessage,
      last_sync_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId);

  if (error) throw new Error(`Failed to mark appointment sync-failed: ${error.message}`);
}

/**
 * Marks a pending appointment as needs_reconciliation after a timeout.
 * The slot remains held until reconciliation resolves the state.
 */
export async function markNeedsReconciliation(
  supabase: Supabase,
  appointmentId: string,
  operation: 'calendar_create' | 'calendar_cancel' | 'calendar_reschedule'
): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({
      sync_status: 'needs_reconciliation',
      sync_operation: operation,
      last_sync_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId);

  if (error) throw new Error(`Failed to mark needs_reconciliation: ${error.message}`);
}

/**
 * Looks up an appointment by raw management token.
 *
 * Checks two token sources in order:
 *   1. appointment_management_tokens table (new — reminder tokens, future purposes)
 *      Validates: not revoked, not expired, appointment is actionable
 *   2. appointments.management_token_hash (legacy — original confirmation tokens)
 *      Validates: appointment is actionable (booked or pending)
 *
 * Returns null if not found, expired, revoked, or appointment is no longer actionable.
 * Callers receive a consistent null — no leakage of whether a token ever existed.
 */
export async function getAppointmentByToken(
  supabase: Supabase,
  rawToken: string
): Promise<Appointment | null> {
  const tokenHash = hashToken(rawToken);

  // ── 1. New appointment_management_tokens table ────────────────────────────
  const { data: tokenRecord } = await supabase
    .from('appointment_management_tokens')
    .select('*, appointments(*, customers(*))')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .maybeSingle();

  if (tokenRecord) {
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      return null; // expired
    }
    const appt = tokenRecord.appointments as Appointment | null;
    if (!appt) return null;
    // Tokens are invalid once the appointment reaches a terminal state
    if (['completed', 'cancelled', 'no_show'].includes(appt.appointment_status)) {
      return null;
    }
    return appt;
  }

  // ── 2. Legacy management_token_hash on appointments table ─────────────────
  const { data } = await supabase
    .from('appointments')
    .select('*, customers(*)')
    .eq('management_token_hash', tokenHash)
    .maybeSingle();

  if (!data) return null;

  // Legacy tokens are also invalid after terminal states
  if (['completed', 'cancelled', 'no_show'].includes(data.appointment_status)) {
    return null;
  }

  return data ?? null;
}

/**
 * Cancels an appointment.
 * Validates status is 'booked' before cancelling.
 * Does NOT reach out to n8n — caller is responsible for that.
 */
export async function cancelAppointmentInDb(
  supabase: Supabase,
  appointmentId: string
): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({
      appointment_status: 'cancelled',
      sync_status: 'synced',
      sync_operation: null,
      cancelled_at: new Date().toISOString(),
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .eq('appointment_status', 'booked');

  if (error) throw new Error(`Failed to cancel appointment: ${error.message}`);
}

/**
 * Marks a cancellation as sync-failed (GCal deletion failed).
 * appointment_status stays 'booked' — calendar is not confirmed deleted.
 */
export async function failCancelSync(
  supabase: Supabase,
  appointmentId: string,
  errorMessage: string
): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({
      sync_status: 'failed',
      sync_operation: 'calendar_cancel',
      last_sync_error: errorMessage,
      last_sync_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId);

  if (error) throw new Error(`Failed to update cancel sync state: ${error.message}`);
}

/**
 * Finalizes a successful reschedule after n8n confirms the GCal event was updated.
 */
export async function confirmReschedule(
  supabase: Supabase,
  appointmentId: string,
  newStart: string,
  newEnd: string,
  oldStart: string
): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({
      appointment_at: newStart,
      appointment_end_at: newEnd,
      appointment_status: 'booked',
      sync_status: 'synced',
      sync_operation: null,
      last_sync_error: null,
      rescheduled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId);

  if (error) throw new Error(`Failed to confirm reschedule: ${error.message}`);
  void oldStart; // oldStart is stored via original_appointment_at in try_reserve_reschedule_slot
}

/**
 * Marks a booked appointment as completed by staff.
 * Only transitions from 'booked' — other states are rejected silently (no rows updated).
 */
export async function completeAppointment(
  supabase: Supabase,
  appointmentId: string
): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({
      appointment_status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .eq('appointment_status', 'booked');

  if (error) throw new Error(`Failed to complete appointment: ${error.message}`);
}

/**
 * Marks a booked appointment as no-show by staff.
 * Only transitions from 'booked' — other states are rejected silently.
 */
export async function markNoShow(
  supabase: Supabase,
  appointmentId: string
): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({
      appointment_status: 'no_show',
      no_show_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .eq('appointment_status', 'booked');

  if (error) throw new Error(`Failed to mark no-show: ${error.message}`);
}

/**
 * Restores a failed reschedule back to the original time.
 * Used when n8n returns a confirmed failure — appointment is restored to old time.
 */
export async function revertReschedule(
  supabase: Supabase,
  appointmentId: string,
  oldStart: string,
  oldEnd: string,
  errorMessage: string
): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({
      appointment_at: oldStart,
      appointment_end_at: oldEnd,
      appointment_status: 'booked',
      sync_status: 'failed',
      sync_operation: 'calendar_reschedule',
      last_sync_error: errorMessage,
      last_sync_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId);

  if (error) throw new Error(`Failed to revert reschedule: ${error.message}`);
}
