-- GO AI Salon Platform — Step 4: Retention Engine
-- Run in Supabase SQL Editor after 002_lifecycle.sql.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SERVICE RETENTION RULES
-- Per-business, per-service configuration for rebooking and reactivation timing.
-- Staff/admin configures these; app reads them to schedule retention jobs.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_retention_rules (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  service_name            TEXT        NOT NULL,
  rebook_after_days       INTEGER     NOT NULL CHECK (rebook_after_days > 0),
  reactivation_after_days INTEGER              CHECK (reactivation_after_days IS NULL OR reactivation_after_days > 0),
  enabled                 BOOLEAN     NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One rule per service per business (case-insensitive match via LOWER in app layer)
CREATE UNIQUE INDEX IF NOT EXISTS service_retention_rules_name_idx
  ON public.service_retention_rules(business_id, LOWER(service_name));

CREATE INDEX IF NOT EXISTS service_retention_rules_biz_idx
  ON public.service_retention_rules(business_id) WHERE enabled = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. DEDUP INDEXES for retention job types
-- Prevent duplicate active jobs for the same source appointment.
-- ON CONFLICT DO NOTHING is safe against these indexes.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS automation_jobs_review_unique
  ON public.automation_jobs(appointment_id, job_type)
  WHERE status IN ('pending','processing') AND job_type = 'review_request';

CREATE UNIQUE INDEX IF NOT EXISTS automation_jobs_rebooking_unique
  ON public.automation_jobs(appointment_id, job_type)
  WHERE status IN ('pending','processing') AND job_type = 'rebooking_reminder';

CREATE UNIQUE INDEX IF NOT EXISTS automation_jobs_reactivation_unique
  ON public.automation_jobs(appointment_id, job_type)
  WHERE status IN ('pending','processing') AND job_type = 'reactivation';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. claim_retention_jobs RPC
-- Claims review_request / rebooking_reminder / reactivation jobs.
-- Unlike claim_automation_jobs, does NOT filter by appointment_status = 'booked'
-- because these jobs are linked to completed appointments.
-- Actual eligibility (is appt still completed? customer still inactive?) is
-- verified by the app at /api/automation/jobs/[id]/verify before sending.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.claim_retention_jobs(
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
    WHERE  j.job_type = p_job_type
      AND  (
        (j.status = 'pending'    AND j.scheduled_for <= now())
        OR
        (j.status = 'processing' AND j.claimed_at < now() - interval '30 minutes'
                                 AND j.attempts < 3)
      )
    ORDER  BY j.scheduled_for ASC
    LIMIT  p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_retention_jobs(TEXT, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_retention_jobs(TEXT, INTEGER) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS + GRANTS for service_retention_rules
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.service_retention_rules ENABLE ROW LEVEL SECURITY;

-- Staff can read their business's rules
CREATE POLICY "retention_rules_select" ON public.service_retention_rules
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT internal.get_user_business_ids()));

-- Mutations go through service_role only (API routes)
REVOKE ALL ON public.service_retention_rules FROM anon, authenticated;
GRANT SELECT ON public.service_retention_rules TO authenticated;
