
-- Add country and is_studying to leaderboard_opt_ins
ALTER TABLE public.leaderboard_opt_ins
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS is_studying boolean NOT NULL DEFAULT false;

-- Add is_bonus to study_sessions
ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS is_bonus boolean NOT NULL DEFAULT false;
