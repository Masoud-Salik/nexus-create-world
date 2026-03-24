
-- Create daily_checkins table for LIFECAST comprehensive tracking
CREATE TABLE public.daily_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Sleep tracking
  sleep_time TIME,
  wake_time TIME,
  sleep_hours NUMERIC(4,2),
  
  -- Core metrics (1-5 scale)
  mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 5),
  energy_score INTEGER CHECK (energy_score >= 1 AND energy_score <= 5),
  stress_score INTEGER CHECK (stress_score >= 1 AND stress_score <= 5),
  
  -- Productivity metrics
  study_minutes INTEGER DEFAULT 0,
  focused_sessions INTEGER DEFAULT 0,
  creativity_minutes INTEGER DEFAULT 0,
  
  -- Physical activity
  steps INTEGER DEFAULT 0,
  workout_minutes INTEGER DEFAULT 0,
  
  -- Screen & social
  screen_time_minutes INTEGER DEFAULT 0,
  social_activity BOOLEAN DEFAULT FALSE,
  social_minutes INTEGER DEFAULT 0,
  social_type TEXT,
  social_mood_change INTEGER CHECK (social_mood_change >= -2 AND social_mood_change <= 2),
  
  -- Finance tracking
  money_spent NUMERIC(10,2) DEFAULT 0,
  spending_category TEXT,
  spending_planned BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, checkin_date)
);

-- Create habits table for streak tracking
CREATE TABLE public.habits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  habit_type TEXT NOT NULL,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_completed_date DATE,
  total_completions INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, habit_type)
);

-- Create predictions table for storing AI predictions
CREATE TABLE public.predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prediction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Scores (0-100)
  productivity_score INTEGER CHECK (productivity_score >= 0 AND productivity_score <= 100),
  creativity_score INTEGER CHECK (creativity_score >= 0 AND creativity_score <= 100),
  life_score INTEGER CHECK (life_score >= 0 AND life_score <= 100),
  
  -- Risk assessments (0-100)
  burnout_risk INTEGER CHECK (burnout_risk >= 0 AND burnout_risk <= 100),
  overspend_risk INTEGER CHECK (overspend_risk >= 0 AND overspend_risk <= 100),
  
  -- Forecasts
  mood_forecast JSONB DEFAULT '[]'::jsonb,
  study_progress_prediction NUMERIC(5,2),
  creativity_growth_trend NUMERIC(5,2),
  
  -- Scenario data
  current_scenario TEXT,
  optimized_scenario TEXT,
  
  -- Weekly summary
  weekly_wins JSONB DEFAULT '[]'::jsonb,
  weekly_risks JSONB DEFAULT '[]'::jsonb,
  predicted_challenges JSONB DEFAULT '[]'::jsonb,
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  
  explanation TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create weekly_goals table for goal tracking
CREATE TABLE public.weekly_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_category TEXT NOT NULL,
  target_value NUMERIC(10,2) NOT NULL,
  current_value NUMERIC(10,2) DEFAULT 0,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create idea_vault table for creativity tracking
CREATE TABLE public.idea_vault (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idea_vault ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_checkins
CREATE POLICY "Users can view own checkins" ON public.daily_checkins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checkins" ON public.daily_checkins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own checkins" ON public.daily_checkins FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own checkins" ON public.daily_checkins FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for habits
CREATE POLICY "Users can view own habits" ON public.habits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own habits" ON public.habits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own habits" ON public.habits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own habits" ON public.habits FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for predictions
CREATE POLICY "Users can view own predictions" ON public.predictions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own predictions" ON public.predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own predictions" ON public.predictions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own predictions" ON public.predictions FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for weekly_goals
CREATE POLICY "Users can view own weekly_goals" ON public.weekly_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weekly_goals" ON public.weekly_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weekly_goals" ON public.weekly_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own weekly_goals" ON public.weekly_goals FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for idea_vault
CREATE POLICY "Users can view own ideas" ON public.idea_vault FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ideas" ON public.idea_vault FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ideas" ON public.idea_vault FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ideas" ON public.idea_vault FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_daily_checkins_updated_at BEFORE UPDATE ON public.daily_checkins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_habits_updated_at BEFORE UPDATE ON public.habits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_predictions_updated_at BEFORE UPDATE ON public.predictions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_weekly_goals_updated_at BEFORE UPDATE ON public.weekly_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_idea_vault_updated_at BEFORE UPDATE ON public.idea_vault FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
