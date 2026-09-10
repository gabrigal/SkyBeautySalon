-- GO AI Salon Platform — Initial Schema
-- Run this in the Supabase SQL Editor for your project.
-- Supabase service_role bypasses RLS for all privileged server-side operations.

-- ─────────────────────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─────────────────────────────────────────────────────────────────────────────
-- INTERNAL SCHEMA (for SECURITY DEFINER helpers not exposed via REST API)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS internal;
REVOKE ALL ON SCHEMA internal FROM PUBLIC;
GRANT USAGE ON SCHEMA internal TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- BUSINESSES (tenant table — one row per GO AI client)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.businesses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        UNIQUE NOT NULL,
  timezone    TEXT        NOT NULL DEFAULT 'America/New_York',
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'inactive')),
  config      JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS (profile extension of auth.users)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  full_name   TEXT        NOT NULL DEFAULT '',
  -- role is for application convenience only; never used as the sole security gate.
  -- Only service_role can change this value.
  role        TEXT        NOT NULL DEFAULT 'staff'
                          CHECK (role IN ('staff', 'go_ai_admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- BUSINESS MEMBERSHIPS (links staff users to businesses)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.business_memberships (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'staff'
                          CHECK (role IN ('owner', 'staff')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);

CREATE INDEX IF NOT EXISTS business_memberships_user_id_idx ON public.business_memberships(user_id);
CREATE INDEX IF NOT EXISTS business_memberships_business_id_idx ON public.business_memberships(business_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- CUSTOMERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.customers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  first_name       TEXT        NOT NULL,
  last_name        TEXT        NOT NULL DEFAULT '',
  email            TEXT,
  phone            TEXT,
  email_normalized TEXT,   -- lowercase + trimmed; used for dedup
  phone_normalized TEXT,   -- digits only; used for dedup
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes            TEXT,
  source           TEXT        NOT NULL DEFAULT 'online_booking'
                               CHECK (source IN ('online_booking', 'historical_import', 'manual')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index prevents duplicate email per business (partial: only when email is set)
CREATE UNIQUE INDEX IF NOT EXISTS customers_business_email_idx
  ON public.customers(business_id, email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS customers_business_phone_idx
  ON public.customers(business_id, phone_normalized);

CREATE INDEX IF NOT EXISTS customers_business_id_idx ON public.customers(business_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- APPOINTMENTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.appointments (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id             UUID        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  service                 TEXT        NOT NULL,
  stylist                 TEXT,
  appointment_at          TIMESTAMPTZ NOT NULL,   -- UTC; display in business timezone
  appointment_end_at      TIMESTAMPTZ NOT NULL,   -- derived from service duration
  duration_minutes        INTEGER,
  price_cents             INTEGER,                -- null if unknown (e.g. historical)
  currency                TEXT        NOT NULL DEFAULT 'USD',

  -- APPOINTMENT LIFECYCLE (customer-facing state)
  appointment_status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (appointment_status IN ('pending', 'booked', 'completed', 'cancelled', 'no_show')),

  -- CALENDAR SYNC STATE (integration layer — separate from customer lifecycle)
  sync_status             TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (sync_status IN ('pending', 'synced', 'failed', 'needs_reconciliation')),
  sync_operation          TEXT        -- 'calendar_create' | 'calendar_cancel' | 'calendar_reschedule'
                          CHECK (sync_operation IS NULL OR sync_operation IN (
                            'calendar_create', 'calendar_cancel', 'calendar_reschedule'
                          )),
  last_sync_error         TEXT,
  last_sync_attempt_at    TIMESTAMPTZ,

  booked_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at            TIMESTAMPTZ,
  rescheduled_at          TIMESTAMPTZ,
  -- Preserved on first reschedule; never overwritten after that
  original_appointment_at TIMESTAMPTZ,

  booking_source          TEXT        NOT NULL DEFAULT 'online_booking'
                          CHECK (booking_source IN ('online_booking', 'historical_import', 'manual')),

  -- Google Calendar event ID (deterministic: appointment UUID without dashes)
  external_booking_id     TEXT,

  -- SHA-256 of raw management token — raw token is never stored
  management_token_hash   TEXT        UNIQUE,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Overlap prevention: same stylist cannot have two active appointments in the same time range.
-- Appointments with sync_status='failed' release the slot so it can be retaken.
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    business_id   WITH =,
    stylist       WITH =,
    tstzrange(appointment_at, appointment_end_at, '[)') WITH &&
  ) WHERE (
    appointment_status = 'booked'
    OR (appointment_status = 'pending' AND sync_status != 'failed')
  );

CREATE INDEX IF NOT EXISTS appointments_business_id_idx
  ON public.appointments(business_id);
CREATE INDEX IF NOT EXISTS appointments_customer_id_idx
  ON public.appointments(customer_id);
CREATE INDEX IF NOT EXISTS appointments_appointment_at_idx
  ON public.appointments(appointment_at);
CREATE INDEX IF NOT EXISTS appointments_appointment_status_idx
  ON public.appointments(appointment_status);
CREATE INDEX IF NOT EXISTS appointments_sync_status_idx
  ON public.appointments(sync_status)
  WHERE sync_status IN ('pending', 'failed', 'needs_reconciliation');
CREATE INDEX IF NOT EXISTS appointments_external_booking_id_idx
  ON public.appointments(external_booking_id)
  WHERE external_booking_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- APPOINTMENT EVENTS (immutable timeline log)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.appointment_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  appointment_id  UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  customer_id     UUID        REFERENCES public.customers(id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_events_appointment_id_idx
  ON public.appointment_events(appointment_id);
CREATE INDEX IF NOT EXISTS appointment_events_customer_id_idx
  ON public.appointment_events(customer_id);
CREATE INDEX IF NOT EXISTS appointment_events_business_id_at_idx
  ON public.appointment_events(business_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER: membership lookup (prevents RLS recursion)
-- Lives in internal schema; not exposed via Supabase REST API.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION internal.get_user_business_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''   -- empty: all refs must be fully qualified
STABLE
AS $$
  SELECT business_id
  FROM public.business_memberships
  WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION internal.get_user_business_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION internal.get_user_business_ids() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- AUTH PROFILE AUTO-CREATE TRIGGER
-- Creates a public.users profile whenever a Supabase auth user is created.
-- Role is always 'staff' — never derived from user metadata (prevents escalation).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'staff'  -- always default; role changes require service_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- ATOMIC RESCHEDULE SLOT RESERVATION (prevents double-booking on reschedule)
-- Called server-side via supabase.rpc('try_reserve_reschedule_slot', ...)
-- Returns JSONB: { success, old_start, old_end } or { success: false, error }
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.try_reserve_reschedule_slot(
  p_appointment_id  UUID,
  p_new_start       TIMESTAMPTZ,
  p_new_end         TIMESTAMPTZ,
  p_stylist         TEXT,
  p_business_id     UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_start   TIMESTAMPTZ;
  v_old_end     TIMESTAMPTZ;
  v_conflict    INTEGER;
BEGIN
  -- Lock the row to prevent concurrent reschedule on the same appointment
  SELECT appointment_at, appointment_end_at
    INTO v_old_start, v_old_end
  FROM public.appointments
  WHERE id = p_appointment_id
    AND appointment_status = 'booked'
    AND business_id = p_business_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'appointment_not_found_or_not_booked');
  END IF;

  -- Check new slot conflicts (excluding current appointment)
  SELECT COUNT(*)
    INTO v_conflict
  FROM public.appointments
  WHERE id != p_appointment_id
    AND business_id = p_business_id
    AND stylist = p_stylist
    AND (
      appointment_status = 'booked'
      OR (appointment_status = 'pending' AND sync_status != 'failed')
    )
    AND tstzrange(appointment_at, appointment_end_at, '[)')
     && tstzrange(p_new_start, p_new_end, '[)');

  IF v_conflict > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_unavailable');
  END IF;

  -- Reserve new slot (update appointment to pending at new time)
  UPDATE public.appointments
  SET
    appointment_at          = p_new_start,
    appointment_end_at      = p_new_end,
    sync_status             = 'pending',
    sync_operation          = 'calendar_reschedule',
    last_sync_attempt_at    = now(),
    original_appointment_at = COALESCE(original_appointment_at, v_old_start),
    updated_at              = now()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'success',    true,
    'old_start',  v_old_start,
    'old_end',    v_old_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.try_reserve_reschedule_slot(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_reserve_reschedule_slot(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.businesses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_events   ENABLE ROW LEVEL SECURITY;

-- businesses: members can read their business
CREATE POLICY "businesses_select_member" ON public.businesses
  FOR SELECT TO authenticated
  USING (id IN (SELECT internal.get_user_business_ids()));

-- users: each user can only read their own profile
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- business_memberships: SELECT own membership only — no self-modification
CREATE POLICY "memberships_select_own" ON public.business_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- customers: SELECT only for authenticated (mutations via service_role API routes)
CREATE POLICY "customers_select" ON public.customers
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT internal.get_user_business_ids()));

-- appointments: SELECT only for authenticated (mutations via service_role API routes)
CREATE POLICY "appointments_select" ON public.appointments
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT internal.get_user_business_ids()));

-- appointment_events: SELECT only — immutable to normal staff
CREATE POLICY "events_select" ON public.appointment_events
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT internal.get_user_business_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE GRANTS (least privilege)
-- anon: zero access to all application tables
-- authenticated: SELECT only (mutations via trusted API routes using service_role)
-- service_role: full access (bypasses RLS by default in Supabase)
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON public.businesses           FROM anon, authenticated;
REVOKE ALL ON public.users                FROM anon, authenticated;
REVOKE ALL ON public.business_memberships FROM anon, authenticated;
REVOKE ALL ON public.customers            FROM anon, authenticated;
REVOKE ALL ON public.appointments         FROM anon, authenticated;
REVOKE ALL ON public.appointment_events   FROM anon, authenticated;

GRANT SELECT ON public.businesses           TO authenticated;
GRANT SELECT ON public.users                TO authenticated;
GRANT SELECT ON public.business_memberships TO authenticated;
GRANT SELECT ON public.customers            TO authenticated;
GRANT SELECT ON public.appointments         TO authenticated;
GRANT SELECT ON public.appointment_events   TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: Sky Beauty Salon as Business #1
-- After running this migration, copy the generated UUID into SALON_BUSINESS_ID env var.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.businesses (name, slug, timezone, status)
VALUES ('Sky Beauty Salon', 'sky-beauty', 'America/New_York', 'active')
ON CONFLICT (slug) DO NOTHING;
