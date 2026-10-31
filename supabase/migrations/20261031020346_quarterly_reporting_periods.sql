-- Allow Admin/HR to open an actual calendar-quarter unit reporting period.
-- This is a reporting-window extension; it does not change reporting authority,
-- staff privacy, existing evidence, appraisals, or the submission RPCs.
-- The same semantic change may already have been rehearsed in staging.
-- Keep the canonical migration safe for a later ordered replay.
ALTER TABLE public.report_periods
  DROP CONSTRAINT IF EXISTS report_periods_quarter_calendar_check;
ALTER TABLE public.report_periods
  DROP CONSTRAINT IF EXISTS report_periods_kind_check;
ALTER TABLE public.report_periods
  ADD CONSTRAINT report_periods_kind_check
  CHECK (kind IN ('week','month','quarter','project','year'));
ALTER TABLE public.report_periods
  ADD CONSTRAINT report_periods_quarter_calendar_check
  CHECK (kind <> 'quarter' OR (
    starts_on IS NOT NULL AND ends_on IS NOT NULL
    AND extract(day from starts_on) = 1
    AND extract(month from starts_on) IN (1,4,7,10)
    AND ends_on = (starts_on + interval '3 months - 1 day')::date
  ));
