
-- Fix 1: Restrict weekly_leaderboard SELECT to opted-in users + own data
DROP POLICY IF EXISTS "Authenticated users can view weekly leaderboard" ON public.weekly_leaderboard;

CREATE POLICY "Users can view own leaderboard scores"
  ON public.weekly_leaderboard FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view opted-in leaderboard entries"
  ON public.weekly_leaderboard FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboard_opt_ins
      WHERE leaderboard_opt_ins.user_id = weekly_leaderboard.user_id
      AND leaderboard_opt_ins.is_active = true
    )
  );

-- Fix 2: Make avatars bucket private
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

-- Update avatars SELECT policy to owner-only
DROP POLICY IF EXISTS "Users can view all avatars" ON storage.objects;

CREATE POLICY "Authenticated users can view avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');
