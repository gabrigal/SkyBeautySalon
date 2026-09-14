import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any>;

const REMINDER_HORIZON_MS = 24 * 60 * 60 * 1000; // 24 hours in ms

/**
 * Schedules a 24h reminder job for an appointment, if the appointment is
 * more than 24 hours away. Safe to call multiple times — the unique partial
 * index on (appointment_id, job_type) WHERE status IN ('pending','processing')
 * prevents duplicate active reminders.
 *
 * Does NOT create a reminder for appointments within 24 hours (V1 behavior).
 */
export async function scheduleReminder(
  supabase: Supabase,
  input: {
    appointmentId: string;
    businessId: string;
    customerId: string;
    appointmentAt: string; // UTC ISO
  }
): Promise<void> {
  const appointmentTime = new Date(input.appointmentAt).getTime();
  const now = Date.now();

  if (appointmentTime - now <= REMINDER_HORIZON_MS) {
    // Less than or exactly 24h away — do not schedule a 24h reminder
    return;
  }

  const scheduledFor = new Date(appointmentTime - REMINDER_HORIZON_MS).toISOString();

  const { error } = await supabase.from('automation_jobs').insert({
    business_id:    input.businessId,
    appointment_id: input.appointmentId,
    customer_id:    input.customerId,
    job_type:       'appointment_reminder_24h',
    scheduled_for:  scheduledFor,
    status:         'pending',
  });

  if (error && error.code !== '23505') {
    // 23505 = unique_violation — reminder already exists, safe to ignore
    console.error('[scheduleReminder] Failed to schedule reminder:', error.message);
  }
}

/**
 * Cancels all pending or processing reminder jobs for an appointment.
 * Called on cancellation, completion, and no-show.
 */
export async function cancelPendingReminders(
  supabase: Supabase,
  appointmentId: string
): Promise<void> {
  const { error } = await supabase
    .from('automation_jobs')
    .update({
      status:     'cancelled',
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('appointment_id', appointmentId)
    .in('status', ['pending', 'processing']);

  if (error) {
    console.error('[cancelPendingReminders] Failed:', error.message, { appointmentId });
  }
}

/**
 * Updates the scheduled time of a pending 24h reminder after a reschedule.
 *
 * - If the new appointment is > 24h away: update scheduled_for
 * - If the new appointment is ≤ 24h away: cancel the reminder (too late to send)
 * - If the reminder was already sent or failed: no change (V1 — no re-send)
 */
export async function updateReminderSchedule(
  supabase: Supabase,
  appointmentId: string,
  newAppointmentAt: string // UTC ISO
): Promise<void> {
  const appointmentTime = new Date(newAppointmentAt).getTime();
  const now = Date.now();
  const moreThan24hAway = appointmentTime - now > REMINDER_HORIZON_MS;

  if (moreThan24hAway) {
    const newScheduledFor = new Date(appointmentTime - REMINDER_HORIZON_MS).toISOString();
    const { error } = await supabase
      .from('automation_jobs')
      .update({
        scheduled_for: newScheduledFor,
        updated_at:    new Date().toISOString(),
      })
      .eq('appointment_id', appointmentId)
      .eq('job_type', 'appointment_reminder_24h')
      .eq('status', 'pending');

    if (error) {
      console.error('[updateReminderSchedule] Failed to update scheduled_for:', error.message);
    }
  } else {
    // New time is too soon — cancel the pending reminder
    await cancelPendingReminders(supabase, appointmentId);
  }
}
