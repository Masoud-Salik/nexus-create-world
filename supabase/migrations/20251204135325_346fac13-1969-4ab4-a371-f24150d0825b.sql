-- Create ai_memory table for storing extracted user memories
CREATE TABLE public.ai_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  source_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own memories"
ON public.ai_memory FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memories"
ON public.ai_memory FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memories"
ON public.ai_memory FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories"
ON public.ai_memory FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_ai_memory_updated_at
BEFORE UPDATE ON public.ai_memory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add ai_learning_enabled to profiles
ALTER TABLE public.profiles 
ADD COLUMN ai_learning_enabled BOOLEAN DEFAULT true;