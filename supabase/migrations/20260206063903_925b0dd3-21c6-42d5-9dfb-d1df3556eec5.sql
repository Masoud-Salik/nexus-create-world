-- Fix remaining storage policies with unique names
-- Drop and recreate policies that may conflict

DROP POLICY IF EXISTS "Users can upload own situation photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own situation photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own situation photos" ON storage.objects;

-- Recreate with proper owner-scoped policies
CREATE POLICY "Authenticated users can upload own situation photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'situation-photos' AND 
    auth.uid() IS NOT NULL AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Authenticated users can update own situation photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'situation-photos' AND 
    auth.uid() IS NOT NULL AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Authenticated users can delete own situation photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'situation-photos' AND 
    auth.uid() IS NOT NULL AND
    auth.uid()::text = (storage.foldername(name))[1]
  );