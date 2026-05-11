
-- Hot-path indexes used by NEXUS tools every turn
CREATE INDEX IF NOT EXISTS idx_study_tasks_user_date ON public.study_tasks(user_id, task_date);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date ON public.study_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_ai_memory_user_updated ON public.ai_memory(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_insights_user ON public.user_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_study_subjects_user ON public.study_subjects(user_id);

-- Rolling conversation summary (replaces older messages in the prompt)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS summary text;

-- Performance telemetry (service-role only)
CREATE TABLE IF NOT EXISTS public.nexus_perf_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  route        text NOT NULL,
  model        text,
  intent       text,
  tool_calls   integer NOT NULL DEFAULT 0,
  prompt_chars integer NOT NULL DEFAULT 0,
  total_ms     integer NOT NULL DEFAULT 0,
  cache_hit    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nexus_perf_logs ENABLE ROW LEVEL SECURITY;

-- No client-side access; only service role (edge functions) can read/write
CREATE INDEX IF NOT EXISTS idx_nexus_perf_logs_created ON public.nexus_perf_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nexus_perf_logs_user_created ON public.nexus_perf_logs(user_id, created_at DESC);
