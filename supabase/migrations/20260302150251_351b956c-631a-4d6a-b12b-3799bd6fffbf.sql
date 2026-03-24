
-- Table: users who opted into leaderboard
CREATE TABLE public.leaderboard_opt_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT 'Anonymous',
  opted_in_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.leaderboard_opt_ins ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can see who's on the leaderboard (needed for ranking display)
CREATE POLICY "Authenticated users can view leaderboard participants"
  ON public.leaderboard_opt_ins FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Users can insert own opt-in"
  ON public.leaderboard_opt_ins FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own opt-in"
  ON public.leaderboard_opt_ins FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own opt-in"
  ON public.leaderboard_opt_ins FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Table: weekly computed scores
CREATE TABLE public.weekly_leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  study_hours numeric NOT NULL DEFAULT 0,
  streak_days integer NOT NULL DEFAULT 0,
  days_studied integer NOT NULL DEFAULT 0,
  discipline_score numeric NOT NULL DEFAULT 0,
  computed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE public.weekly_leaderboard ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view leaderboard scores (public ranking)
CREATE POLICY "Authenticated users can view weekly leaderboard"
  ON public.weekly_leaderboard FOR SELECT
  TO authenticated
  USING (true);

-- Only service role inserts (via edge function)
CREATE POLICY "Service role can manage leaderboard"
  ON public.weekly_leaderboard FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can insert/update their own scores too (for client-side refresh)
CREATE POLICY "Users can upsert own scores"
  ON public.weekly_leaderboard FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scores"
  ON public.weekly_leaderboard FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for fast ranking queries
CREATE INDEX idx_weekly_leaderboard_week_score 
  ON public.weekly_leaderboard(week_start, discipline_score DESC);
