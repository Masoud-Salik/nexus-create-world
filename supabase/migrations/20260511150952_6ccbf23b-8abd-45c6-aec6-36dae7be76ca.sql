
-- 1) users table RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own record" ON public.users;
CREATE POLICY "Users can view own record"
  ON public.users FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 2) weekly_leaderboard: remove client write policies
DROP POLICY IF EXISTS "Users can upsert own scores" ON public.weekly_leaderboard;
DROP POLICY IF EXISTS "Users can update own scores" ON public.weekly_leaderboard;

-- 3) avatars storage: scope SELECT to owner folder
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
CREATE POLICY "Users can view own avatar"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 4) Revoke public EXECUTE on SECURITY DEFINER trigger helpers
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
