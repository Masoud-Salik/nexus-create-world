-- Add time metadata columns to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS local_time text,
ADD COLUMN IF NOT EXISTS time_of_day text;

-- Add time metadata columns to daily_activities table
ALTER TABLE public.daily_activities 
ADD COLUMN IF NOT EXISTS local_time text,
ADD COLUMN IF NOT EXISTS time_of_day text;

-- Add time metadata columns to goals table
ALTER TABLE public.goals 
ADD COLUMN IF NOT EXISTS local_time text,
ADD COLUMN IF NOT EXISTS time_of_day text;

-- Add time metadata columns to conversations table
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS local_time text,
ADD COLUMN IF NOT EXISTS time_of_day text;