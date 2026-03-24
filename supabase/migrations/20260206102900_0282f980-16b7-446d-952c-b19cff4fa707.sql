-- Add the missing updated_at column to the profiles table
ALTER TABLE public.profiles 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Backfill existing rows
UPDATE public.profiles SET updated_at = created_at WHERE updated_at IS NULL;