-- GO AI Salon Platform — Step 5: Staff Booking
-- Adds phone, walk_in, instagram, other to the booking_source CHECK constraint.
-- Run after 003_retention.sql.

DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname INTO v_constraint
  FROM   pg_constraint
  WHERE  conrelid = 'public.appointments'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%booking_source%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.appointments DROP CONSTRAINT %I', v_constraint);
  END IF;
END;
$$;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_booking_source_check
  CHECK (booking_source IN (
    'online_booking',
    'historical_import',
    'manual',
    'phone',
    'walk_in',
    'instagram',
    'other'
  ));
