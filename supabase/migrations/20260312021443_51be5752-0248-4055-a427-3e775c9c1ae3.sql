
ALTER TABLE public.company_events 
  ADD COLUMN start_date date,
  ADD COLUMN end_date date;

UPDATE public.company_events SET start_date = event_date, end_date = event_date;

ALTER TABLE public.company_events 
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date SET NOT NULL;

ALTER TABLE public.company_events DROP COLUMN event_date;
