-- E3 / M3.2 — AI call ledger. Cost, not compute, is the ceiling.
CREATE TABLE IF NOT EXISTS public.ai_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID,
  task TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'lovable',
  trace_id TEXT,
  prompt_version TEXT,
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok',
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  schema_retries INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rate-limit windows read (owner_id, task, created_at); cost dashboards read (created_at, task).
CREATE INDEX IF NOT EXISTS ai_calls_owner_task_time_idx
  ON public.ai_calls (owner_id, task, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_calls_time_idx
  ON public.ai_calls (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_calls_trace_idx
  ON public.ai_calls (trace_id);

-- Written only by edge functions using the service role; read only by admins.
GRANT ALL ON public.ai_calls TO service_role;
GRANT SELECT ON public.ai_calls TO authenticated;

ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_calls_admin_read" ON public.ai_calls;
CREATE POLICY "ai_calls_admin_read"
  ON public.ai_calls FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Prompt versions are now per-task; NULL means "global default".
ALTER TABLE public.ai_prompt_versions ADD COLUMN IF NOT EXISTS task TEXT;
CREATE INDEX IF NOT EXISTS ai_prompt_versions_task_active_idx
  ON public.ai_prompt_versions (task, is_active);
