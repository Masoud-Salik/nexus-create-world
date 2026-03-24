
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view situation photos" ON storage.objects;

-- Create owner-scoped SELECT policy
CREATE POLICY "Users can view own situation photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'situation-photos' AND 
    auth.uid() IS NOT NULL AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'situation-photos';
