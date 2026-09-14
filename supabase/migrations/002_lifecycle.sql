-- GO AI Salon Platform — Step 3: Appointment Lifecycle
-- Run this in the Supabase SQL Editor after 001_initial_schema.sql.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LIFECYCLE TIMESTAMPS on appointments
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS no_show_at   TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. AUTOMATION JOBS
-- Reusable queue for all GO AI automations (reminders, review requests, etc.)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.automation_jobs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  appointment_id  UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  customer_id     UUID        REFERENCES public.customers(id)   ON DELETE SET NULL,
  job_type        TEXT        NOT NULL
                  CHECK (job_type IN (
                    'appointment_reminder_24h',
                    'review_request',
                    'rebooking_reminder',
                    'reactivation',
                    'waitlist_notification'
                  )),
  scheduled_for   TIMESTAMPTZ NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processing','sent','failed','cancelled')),
  attempts        INTEGER     NOT NULL DEFAULT 0,
  claimed_at      TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  last_error      TEXT,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate active 24h reminders for the same appointment.
-- ON CONFLICT DO NOTHING on inserts is safe against this index.
CREATE UNIQUE INDEX IF NOT EXISTS automation_jobs_reminder_unique
  ON public.automation_jobs(appointment_id, job_type)
  WHERE status IN ('pending','processing') AND job_type = 'appointment_reminder_24h';

CREATE INDEX IF NOT EXISTS automation_jobs_due_idx
  ON public.automation_jobs(scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS automation_jobs_biz_idx
  ON public.automation_jobs(business_id);

CREATE INDEX IF NOT EXISTS automation_jobs_appt_idx
  ON public.automation_jobs(appointment_id);

CREATE INDEX IF NOT EXISTS automation_jobs_status_type_idx
  ON public.automation_jobs(status, job_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. APPOINTMENT MANAGEMENT TOKENS
-- Separate table for per-purpose secure tokens (reminders, etc.)
-- Legacy confirmation token remains in appointments.management_token_hash.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.appointment_management_tokens (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  token_hash     TEXT        UNIQUE NOT NULL,
  purpose        TEXT        NOT NULL DEFAULT 'confirmation'
                 CHECK (purpose IN ('confirmation','reminder')),
  expires_at     TIMESTAMPTZ,
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appt_mgmt_tokens_appt_idx
  ON public.appointment_management_tokens(appointment_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ATOMIC JOB CLAIM FUNCTION (SKIP LOCKED — concurrency-safe)
--
-- Handles two cases:
--   a) Fresh pending jobs with scheduled_for <= now()
--   b) Recovery: processing jobs stuck > 30 min with attempts < 3
--
-- Jobs stuck > 30 min with attempts >= 3 are marked failed (not re-queued).
-- Maximum 3 attempts total per job.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.claim_automation_jobs(
  p_job_type TEXT,
  p_limit    INTEGER DEFAULT 25
)
RETURNS SETOF public.automation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Mark exhausted stuck jobs as failed so they surface in the dashboard.
  UPDATE public.automation_jobs
  SET
    status     = 'failed',
    last_error = 'Exceeded maximum retry attempts — timed out in processing',
    updated_at = now()
  WHERE job_type  = p_job_type
    AND status    = 'processing'
    AND claimed_at < now() - interval '30 minutes'
    AND attempts  >= 3;

  -- Claim eligible jobs:
  --   • New pending jobs due now
  --   • Stuck processing jobs within retry limit
  -- FOR UPDATE SKIP LOCKED prevents two concurrent workers from claiming the same row.
  RETURN QUERY
  UPDATE public.automation_jobs
  SET
    status     = 'processing',
    claimed_at = now(),
    attempts   = attempts + 1,
    updated_at = now()
  WHERE id IN (
    SELECT j.id
    FROM   public.automation_jobs j
    JOIN   public.appointments a ON a.id = j.appointment_id
    WHERE  j.job_type = p_job_type
      AND  a.appointment_status = 'booked'
      AND  (
        (j.status = 'pending'     AND j.scheduled_for <= now())
        OR
        (j.status = 'processing'  AND j.claimed_at < now() - interval '30 minutes'
                                  AND j.attempts < 3)
      )
    ORDER  BY j.scheduled_for ASC
    LIMIT  p_limit
    FOR UPDATE OF j SKIP LOCKED
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_automation_jobs(TEXT, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_automation_jobs(TEXT, INTEGER) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.automation_jobs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_management_tokens ENABLE ROW LEVEL SECURITY;

-- Staff can read their business's automation jobs (read-only; mutations via service_role)
CREATE POLICY "automation_jobs_select" ON public.automation_jobs
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT internal.get_user_business_ids()));

-- appointment_management_tokens: no authenticated SELECT policy.
-- Token hashes must never be readable through RLS — service_role only.

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TABLE GRANTS (least privilege)
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON public.automation_jobs              FROM anon, authenticated;
REVOKE ALL ON public.appointment_management_tokens FROM anon, authenticated;

GRANT SELECT ON public.automation_jobs TO authenticated;
-- appointment_management_tokens: no grant to authenticated or anon
