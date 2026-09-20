// ─────────────────────────────────────────────────────────────────────────────
// Domain types (used throughout the application)
// ─────────────────────────────────────────────────────────────────────────────

export type AppointmentStatus = 'pending' | 'booked' | 'completed' | 'cancelled' | 'no_show';
export type AutomationJobStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
export type AutomationJobType =
  | 'appointment_reminder_24h'
  | 'review_request'
  | 'rebooking_reminder'
  | 'reactivation'
  | 'waitlist_notification';
export type SyncStatus = 'pending' | 'synced' | 'failed' | 'needs_reconciliation';
export type SyncOperation = 'calendar_create' | 'calendar_cancel' | 'calendar_reschedule';
export type BookingSource = 'online_booking' | 'historical_import' | 'manual' | 'phone' | 'walk_in' | 'instagram' | 'other';
export type CustomerSource = 'online_booking' | 'historical_import' | 'manual';
export type BusinessStatus = 'active' | 'inactive';
export type UserRole = 'staff' | 'go_ai_admin';
export type MembershipRole = 'owner' | 'staff';

export interface Business {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  status: BusinessStatus;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface BusinessMembership {
  id: string;
  business_id: string;
  user_id: string;
  role: MembershipRole;
  created_at: string;
  businesses?: Business;
}

export interface Customer {
  id: string;
  business_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  email_normalized: string | null;
  phone_normalized: string | null;
  first_seen_at: string;
  last_seen_at: string;
  notes: string | null;
  source: CustomerSource;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  business_id: string;
  customer_id: string;
  service: string;
  stylist: string | null;
  appointment_at: string;
  appointment_end_at: string;
  duration_minutes: number | null;
  price_cents: number | null;
  currency: string;
  appointment_status: AppointmentStatus;
  sync_status: SyncStatus;
  sync_operation: SyncOperation | null;
  last_sync_error: string | null;
  last_sync_attempt_at: string | null;
  booked_at: string;
  updated_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
  no_show_at: string | null;
  rescheduled_at: string | null;
  original_appointment_at: string | null;
  booking_source: BookingSource;
  external_booking_id: string | null;
  management_token_hash: string | null;
  notes: string | null;
  created_at: string;
  customers?: Customer;
}

export interface AutomationJob {
  id: string;
  business_id: string;
  appointment_id: string | null;
  customer_id: string | null;
  job_type: AutomationJobType;
  scheduled_for: string;
  status: AutomationJobStatus;
  attempts: number;
  claimed_at: string | null;
  sent_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ServiceRetentionRule {
  id: string;
  business_id: string;
  service_name: string;
  rebook_after_days: number;
  reactivation_after_days: number | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentManagementToken {
  id: string;
  appointment_id: string;
  token_hash: string;
  purpose: 'confirmation' | 'reminder';
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface AppointmentEvent {
  id: string;
  business_id: string;
  appointment_id: string | null;
  customer_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  appointments?: Pick<Appointment, 'id' | 'service' | 'appointment_at' | 'stylist'>;
  customers?: Pick<Customer, 'id' | 'first_name' | 'last_name' | 'email'>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Database generic type
// Required format: Tables.tableName.{ Row, Insert, Update }
// ─────────────────────────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: Business;
        Insert: Omit<Business, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<Business, 'id' | 'created_at' | 'updated_at'>>;
        Update: Partial<Omit<Business, 'id'>>;
        Relationships: [];
      };
      users: {
        Row: User;
        Insert: Omit<User, 'created_at' | 'updated_at'> & Partial<Pick<User, 'created_at' | 'updated_at'>>;
        Update: Partial<Omit<User, 'id'>>;
        Relationships: [];
      };
      business_memberships: {
        Row: Omit<BusinessMembership, 'businesses'>;
        Insert: Omit<BusinessMembership, 'id' | 'created_at' | 'businesses'> & Partial<Pick<BusinessMembership, 'id' | 'created_at'>>;
        Update: Partial<Omit<BusinessMembership, 'id' | 'businesses'>>;
        Relationships: [];
      };
      customers: {
        Row: Omit<Customer, never>;
        Insert: Omit<Customer, 'id' | 'first_seen_at' | 'last_seen_at' | 'created_at' | 'updated_at'> & Partial<Pick<Customer, 'id' | 'first_seen_at' | 'last_seen_at' | 'created_at' | 'updated_at'>>;
        Update: Partial<Omit<Customer, 'id'>>;
        Relationships: [];
      };
      appointments: {
        Row: Omit<Appointment, 'customers'>;
        Insert: Omit<Appointment, 'booked_at' | 'updated_at' | 'created_at' | 'customers'> & Partial<Pick<Appointment, 'booked_at' | 'updated_at' | 'created_at'>>;
        Update: Partial<Omit<Appointment, 'id' | 'customers'>>;
        Relationships: [];
      };
      appointment_events: {
        Row: Omit<AppointmentEvent, 'appointments' | 'customers'>;
        Insert: Omit<AppointmentEvent, 'id' | 'created_at' | 'appointments' | 'customers'> & Partial<Pick<AppointmentEvent, 'id' | 'created_at'>>;
        Update: Partial<Omit<AppointmentEvent, 'id' | 'appointments' | 'customers'>>;
        Relationships: [];
      };
      automation_jobs: {
        Row: AutomationJob;
        Insert: Omit<AutomationJob, 'id' | 'created_at' | 'updated_at' | 'attempts'> & Partial<Pick<AutomationJob, 'id' | 'created_at' | 'updated_at' | 'attempts'>>;
        Update: Partial<Omit<AutomationJob, 'id'>>;
        Relationships: [];
      };
      appointment_management_tokens: {
        Row: AppointmentManagementToken;
        Insert: Omit<AppointmentManagementToken, 'id' | 'created_at'> & Partial<Pick<AppointmentManagementToken, 'id' | 'created_at'>>;
        Update: Partial<Omit<AppointmentManagementToken, 'id'>>;
        Relationships: [];
      };
      service_retention_rules: {
        Row: ServiceRetentionRule;
        Insert: Omit<ServiceRetentionRule, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<ServiceRetentionRule, 'id' | 'created_at' | 'updated_at'>>;
        Update: Partial<Omit<ServiceRetentionRule, 'id'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      claim_automation_jobs: {
        Args: { p_job_type: string; p_limit?: number };
        Returns: AutomationJob[];
      };
      claim_retention_jobs: {
        Args: { p_job_type: string; p_limit?: number };
        Returns: AutomationJob[];
      };
      try_reserve_reschedule_slot: {
        Args: {
          p_appointment_id: string;
          p_new_start: string;
          p_new_end: string;
          p_stylist: string;
          p_business_id: string;
        };
        Returns: {
          success: boolean;
          error?: string;
          old_start?: string;
          old_end?: string;
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
