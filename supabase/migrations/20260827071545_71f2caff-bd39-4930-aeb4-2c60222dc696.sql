ALTER TABLE public.lead_results
  ADD COLUMN IF NOT EXISTS phone_valid boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS phone_line_type text NOT NULL DEFAULT 'unknown';