-- Enhance profiles table with student-specific fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS education_level text,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS field_of_interest text,
ADD COLUMN IF NOT EXISTS daily_study_hours numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS financial_constraints boolean DEFAULT false;

-- Create skill_scores table for AI scoring system
CREATE TABLE IF NOT EXISTS public.skill_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  score_date date NOT NULL DEFAULT CURRENT_DATE,
  discipline_score integer DEFAULT 50,
  consistency_score integer DEFAULT 50,
  focus_score integer DEFAULT 50,
  learning_efficiency_score integer DEFAULT 50,
  overall_score integer GENERATED ALWAYS AS ((discipline_score + consistency_score + focus_score + learning_efficiency_score) / 4) STORED,
  ai_analysis text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, score_date)
);

-- Enable RLS on skill_scores
ALTER TABLE public.skill_scores ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for skill_scores
CREATE POLICY "Users can view own skill scores" ON public.skill_scores
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own skill scores" ON public.skill_scores
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own skill scores" ON public.skill_scores
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own skill scores" ON public.skill_scores
FOR DELETE USING (auth.uid() = user_id);

-- Create future_scenarios table for AI predictions
CREATE TABLE IF NOT EXISTS public.future_scenarios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  timeframe text NOT NULL CHECK (timeframe IN ('1_year', '3_years', '5_years')),
  scenario_type text NOT NULL CHECK (scenario_type IN ('best_case', 'realistic', 'worst_case')),
  title text NOT NULL,
  description text NOT NULL,
  skills_gained text[],
  opportunities text[],
  risks text[],
  recommendations text[],
  probability_score integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on future_scenarios
ALTER TABLE public.future_scenarios ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for future_scenarios
CREATE POLICY "Users can view own scenarios" ON public.future_scenarios
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scenarios" ON public.future_scenarios
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scenarios" ON public.future_scenarios
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scenarios" ON public.future_scenarios
FOR DELETE USING (auth.uid() = user_id);

-- Create weekly_reports table for AI weekly analysis
CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  progress_trend text NOT NULL CHECK (progress_trend IN ('improving', 'stable', 'declining')),
  summary text NOT NULL,
  main_reason text,
  action_items text[],
  study_hours_logged numeric DEFAULT 0,
  consistency_percentage integer DEFAULT 0,
  compared_to_high_performers text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- Enable RLS on weekly_reports
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for weekly_reports
CREATE POLICY "Users can view own reports" ON public.weekly_reports
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports" ON public.weekly_reports
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports" ON public.weekly_reports
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports" ON public.weekly_reports
FOR DELETE USING (auth.uid() = user_id);

-- Create daily_coach_messages table
CREATE TABLE IF NOT EXISTS public.daily_coach_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  message_date date NOT NULL DEFAULT CURRENT_DATE,
  priority_focus text NOT NULL,
  warning_message text,
  motivation_level text CHECK (motivation_level IN ('low', 'medium', 'high')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_date)
);

-- Enable RLS on daily_coach_messages
ALTER TABLE public.daily_coach_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for daily_coach_messages
CREATE POLICY "Users can view own coach messages" ON public.daily_coach_messages
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own coach messages" ON public.daily_coach_messages
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own coach messages" ON public.daily_coach_messages
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own coach messages" ON public.daily_coach_messages
FOR DELETE USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_skill_scores_updated_at
  BEFORE UPDATE ON public.skill_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_future_scenarios_updated_at
  BEFORE UPDATE ON public.future_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();