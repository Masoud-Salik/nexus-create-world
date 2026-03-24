-- Add notification preferences to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS push_notifications_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS email_updates_enabled boolean DEFAULT true;

-- Create situation_photos table for different user photos
CREATE TABLE IF NOT EXISTS public.situation_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_type text NOT NULL CHECK (photo_type IN ('profile', 'exercising', 'studying', 'working', 'hobby', 'other')),
  photo_url text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, photo_type)
);

-- Enable RLS on situation_photos
ALTER TABLE public.situation_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies for situation_photos
CREATE POLICY "Users can view own situation photos"
  ON public.situation_photos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own situation photos"
  ON public.situation_photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own situation photos"
  ON public.situation_photos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own situation photos"
  ON public.situation_photos FOR DELETE
  USING (auth.uid() = user_id);

-- Create documents table for user documents
CREATE TABLE IF NOT EXISTS public.user_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  mime_type text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on user_documents
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_documents
CREATE POLICY "Users can view own documents"
  ON public.user_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON public.user_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
  ON public.user_documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
  ON public.user_documents FOR DELETE
  USING (auth.uid() = user_id);

-- Create storage buckets for situation photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('situation-photos', 'situation-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for situation-photos
CREATE POLICY "Users can view situation photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'situation-photos');

CREATE POLICY "Users can upload own situation photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'situation-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own situation photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'situation-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own situation photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'situation-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage bucket for documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-documents', 'user-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for user-documents
CREATE POLICY "Users can view own documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add triggers for updated_at
CREATE TRIGGER update_situation_photos_updated_at
  BEFORE UPDATE ON public.situation_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_documents_updated_at
  BEFORE UPDATE ON public.user_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();