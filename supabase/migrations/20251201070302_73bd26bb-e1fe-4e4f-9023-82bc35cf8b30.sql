-- Create abilities_skills table
CREATE TABLE public.abilities_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  technical_skills TEXT[] DEFAULT '{}',
  soft_skills TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}',
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.abilities_skills ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own abilities"
  ON public.abilities_skills FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own abilities"
  ON public.abilities_skills FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own abilities"
  ON public.abilities_skills FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own abilities"
  ON public.abilities_skills FOR DELETE
  USING (auth.uid() = user_id);

-- Create interests table
CREATE TABLE public.interests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clothing_style TEXT[] DEFAULT '{}',
  favorite_foods TEXT[] DEFAULT '{}',
  hobbies TEXT[] DEFAULT '{}',
  music TEXT[] DEFAULT '{}',
  movies_books TEXT[] DEFAULT '{}',
  environment_preferences TEXT,
  sleep_habits TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own interests"
  ON public.interests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interests"
  ON public.interests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interests"
  ON public.interests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own interests"
  ON public.interests FOR DELETE
  USING (auth.uid() = user_id);

-- Create friends_identities table
CREATE TABLE public.friends_identities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_name TEXT NOT NULL,
  relationship TEXT,
  personality_notes TEXT,
  influence_level INTEGER CHECK (influence_level >= 1 AND influence_level <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.friends_identities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own friends"
  ON public.friends_identities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own friends"
  ON public.friends_identities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own friends"
  ON public.friends_identities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own friends"
  ON public.friends_identities FOR DELETE
  USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_abilities_skills_updated_at
  BEFORE UPDATE ON public.abilities_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_interests_updated_at
  BEFORE UPDATE ON public.interests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_friends_identities_updated_at
  BEFORE UPDATE ON public.friends_identities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();