CREATE TABLE public.international_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  competition text NOT NULL,
  team1 text,
  team2 text,
  coach1 text,
  coach2 text,
  result text,
  winner text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.international_results TO authenticated;
GRANT SELECT ON public.international_results TO anon;
GRANT ALL ON public.international_results TO service_role;

ALTER TABLE public.international_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read international_results" ON public.international_results FOR SELECT USING (true);
CREATE POLICY "Public write international_results" ON public.international_results FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_international_results_season ON public.international_results(season_id);