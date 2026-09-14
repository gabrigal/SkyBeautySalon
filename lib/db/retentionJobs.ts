import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServiceRetentionRule } from '@/lib/database.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any>;

const REVIEW_DELAY_HOURS = 24;

/**
 * Looks up the enabled retention rule for a given service name.
 * Matches case-insensitively. Returns null if no rule exists or rule is disabled.
 */
export async function getServiceRetentionRule(
  supabase: Supabase,
  businessId: string,
  serviceName: string
): Promise<ServiceRetentionRule | null> {
  const { data } = await supabase
    .from('service_retention_rules')
    .select('*')
    .eq('business_id', businessId)
    .ilike('service_name', serviceName)
    .eq('enabled', true)
    .maybeSingle();

  return (data as ServiceRetentionRule | null) ?? null;
}

/**
 * Schedules a review_request job 24h after appointment completion.
 * Safe to call multiple times — unique partial index prevents duplicates.
 */
export async function scheduleReviewRequest(
  supabase: Supabase,
  input: {
    appointmentId: string;
    businessId: string;
    customerId: string;
    completedAt: string; // ISO UTC
  }
): Promise<void> {
  const scheduledFor = new Date(
    new Date(input.completedAt).getTime() + REVIEW_DELAY_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { error } = await supabase.from('automation_jobs').insert({
    business_id:    input.businessId,
    appointment_id: input.appointmentId,
    customer_id:    input.customerId,
    job_type:       'review_request',
    scheduled_for:  scheduledFor,
    status:         'pending',
  });

  if (error && error.code !== '23505') {
    console.error('[scheduleReviewRequest] Failed:', error.message);
  }
}

/**
 * Schedules a rebooking_reminder job based on the service retention rule.
 * scheduled_for = completed_at + rebook_after_days.
 * Safe to call multiple times — unique partial index prevents duplicates.
 */
export async function scheduleRebookingReminder(
  supabase: Supabase,
  input: {
    appointmentId: string;
    businessId: string;
    customerId: string;
    completedAt: string;
    rebookAfterDays: number;
    ruleId: string;
  }
): Promise<void> {
  const scheduledFor = new Date(
    new Date(input.completedAt).getTime() + input.rebookAfterDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error } = await supabase.from('automation_jobs').insert({
    business_id:    input.businessId,
    appointment_id: input.appointmentId,
    customer_id:    input.customerId,
    job_type:       'rebooking_reminder',
    scheduled_for:  scheduledFor,
    status:         'pending',
    metadata:       { rule_id: input.ruleId, rebook_after_days: input.rebookAfterDays },
  });

  if (error && error.code !== '23505') {
    console.error('[scheduleRebookingReminder] Failed:', error.message);
  }
}

/**
 * Schedules a reactivation job based on the service retention rule.
 * scheduled_for = completed_at + reactivation_after_days.
 * Safe to call multiple times — unique partial index prevents duplicates.
 */
export async function scheduleReactivation(
  supabase: Supabase,
  input: {
    appointmentId: string;
    businessId: string;
    customerId: string;
    completedAt: string;
    reactivationAfterDays: number;
    ruleId: string;
  }
): Promise<void> {
  const scheduledFor = new Date(
    new Date(input.completedAt).getTime() + input.reactivationAfterDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error } = await supabase.from('automation_jobs').insert({
    business_id:    input.businessId,
    appointment_id: input.appointmentId,
    customer_id:    input.customerId,
    job_type:       'reactivation',
    scheduled_for:  scheduledFor,
    status:         'pending',
    metadata:       { rule_id: input.ruleId, reactivation_after_days: input.reactivationAfterDays },
  });

  if (error && error.code !== '23505') {
    console.error('[scheduleReactivation] Failed:', error.message);
  }
}

/**
 * Cancels pending/processing rebooking_reminder and reactivation jobs for a customer.
 * Called when a customer books a new appointment, making these jobs irrelevant.
 * Stores a reason so the dashboard can display "customer rebooked".
 */
export async function cancelCustomerRetentionJobs(
  supabase: Supabase,
  customerId: string,
  businessId: string
): Promise<void> {
  const { error } = await supabase
    .from('automation_jobs')
    .update({
      status:     'cancelled',
      last_error: 'customer_rebooked',
      updated_at: new Date().toISOString(),
    })
    .eq('customer_id', customerId)
    .eq('business_id', businessId)
    .in('job_type', ['rebooking_reminder', 'reactivation'])
    .in('status', ['pending', 'processing']);

  if (error) {
    console.error('[cancelCustomerRetentionJobs] Failed:', error.message, { customerId });
  }
}

/**
 * Returns true if the customer has any future booked appointment for this business.
 * Used to gate rebooking_reminder and reactivation sends.
 */
export async function customerHasFutureBooking(
  supabase: Supabase,
  customerId: string,
  businessId: string
): Promise<boolean> {
  const { count } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('business_id', businessId)
    .eq('appointment_status', 'booked')
    .gt('appointment_at', new Date().toISOString());

  return (count ?? 0) > 0;
}
