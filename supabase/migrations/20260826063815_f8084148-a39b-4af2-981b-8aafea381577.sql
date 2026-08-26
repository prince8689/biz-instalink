CREATE TABLE public.lead_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  category text NOT NULL,
  min_rating numeric NOT NULL DEFAULT 0,
  max_rating numeric NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'completed',
  businesses_found integer NOT NULL DEFAULT 0,
  rating_matches integer NOT NULL DEFAULT 0,
  verified_leads integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_searches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_searches TO authenticated;
GRANT ALL ON public.lead_searches TO service_role;

ALTER TABLE public.lead_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read/write access to lead_searches"
  ON public.lead_searches FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE TABLE public.lead_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id uuid NOT NULL REFERENCES public.lead_searches(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  phone text NOT NULL,
  rating numeric NOT NULL,
  rating_count integer NOT NULL,
  address text,
  category text,
  city text,
  google_maps_url text,
  place_id text,
  instagram_url text NOT NULL,
  instagram_handle text,
  instagram_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'verified',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_results TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_results TO authenticated;
GRANT ALL ON public.lead_results TO service_role;

ALTER TABLE public.lead_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read/write access to lead_results"
  ON public.lead_results FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX idx_lead_results_search_id ON public.lead_results(search_id);
CREATE INDEX idx_lead_searches_created_at ON public.lead_searches(created_at DESC);