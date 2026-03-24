-- Create table for AI-extracted user insights and habits
CREATE TABLE IF NOT EXISTS public.user_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL, -- 'habit', 'routine', 'preference', 'personality_trait', etc.
  insight_key TEXT NOT NULL, -- e.g., 'morning_routine', 'exercise_habit', 'favorite_activity'
  insight_value TEXT NOT NULL, -- the actual data/description
  confidence_level TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  last_mentioned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, insight_type, insight_key)
);

-- Enable RLS
ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own insights"
  ON public.user_insights
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insights"
  ON public.user_insights
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights"
  ON public.user_insights
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own insights"
  ON public.user_insights
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_insights_updated_at
  BEFORE UPDATE ON public.user_insights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();