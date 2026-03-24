-- Add DELETE policy for profiles table to allow users to delete their own profile
-- This enables GDPR compliance by allowing users to exercise their "right to be forgotten"

CREATE POLICY "Users can delete own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = id);