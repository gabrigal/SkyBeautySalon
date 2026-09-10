import type { SupabaseClient } from '@supabase/supabase-js';
import type { Customer } from '@/lib/database.types';

// Using untyped SupabaseClient to avoid Database generic inference issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any>;

interface CustomerInput {
  businessId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  source?: 'online_booking' | 'historical_import' | 'manual';
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const n = email.toLowerCase().trim();
  return n.length > 0 ? n : null;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const n = phone.replace(/\D/g, '');
  return n.length >= 7 ? n : null;  // require at least 7 digits to be meaningful
}

/**
 * Finds an existing customer or creates a new one.
 *
 * Dedup logic (conservative — never merges on name alone):
 * 1. Match by (business_id, email_normalized) — strongest match
 * 2. If no email, match by (business_id, phone_normalized)
 * 3. Create new customer if no match found
 *
 * When updating an existing record, last_seen_at is refreshed.
 * Existing non-null email/phone is never overwritten with null (protects richer data).
 */
export async function findOrCreateCustomer(
  supabase: Supabase,
  input: CustomerInput
): Promise<Customer> {
  const { businessId, firstName, lastName, source = 'online_booking' } = input;
  const emailNorm = normalizeEmail(input.email);
  const phoneNorm = normalizePhone(input.phone);

  let existing: Customer | null = null;

  // Try email match first
  if (emailNorm) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .eq('email_normalized', emailNorm)
      .maybeSingle();
    existing = data;
  }

  // Fall back to phone match
  if (!existing && phoneNorm) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .eq('phone_normalized', phoneNorm)
      .maybeSingle();
    existing = data;
  }

  if (existing) {
    // Update last_seen_at and fill in missing fields (never downgrade existing data)
    const updates: Partial<Customer> = {
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!existing.email && input.email) {
      updates.email = input.email;
      updates.email_normalized = emailNorm;
    }
    if (!existing.phone && input.phone) {
      updates.phone = input.phone;
      updates.phone_normalized = phoneNorm;
    }

    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update customer: ${error.message}`);
    return data;
  }

  // Create new customer
  const { data, error } = await supabase
    .from('customers')
    .insert({
      business_id: businessId,
      first_name: firstName,
      last_name: lastName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      email_normalized: emailNorm,
      phone_normalized: phoneNorm,
      source,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create customer: ${error.message}`);
  return data;
}
