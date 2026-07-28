-- =====================================================================
-- E1 / M5, M7, M8 : anonymous identity, exports, admin audit
-- =====================================================================

-- M5: anonymous sessions (owner_kind = 'anon')
CREATE TABLE public.anon_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 minutes'),
  claimed_by uuid,
  claimed_at timestamptz
);

GRANT ALL ON public.anon_sessions TO service_role;
ALTER TABLE public.anon_sessions ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated grants: tokens are only ever resolved server-side.

CREATE INDEX idx_anon_sessions_expires_at ON public.anon_sessions (expires_at);
CREATE INDEX idx_anon_sessions_claimed_by ON public.anon_sessions (claimed_by) WHERE claimed_by IS NOT NULL;

-- M7: account exports
CREATE TABLE public.account_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  file_path text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT ON public.account_exports TO authenticated;
GRANT ALL ON public.account_exports TO service_role;
ALTER TABLE public.account_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own exports"
  ON public.account_exports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users request their own exports"
  ON public.account_exports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_account_exports_user ON public.account_exports (user_id, created_at DESC);

-- M8: admin access audit (append-only)
CREATE TABLE public.admin_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  subject_type text NOT NULL,
  subject_id uuid,
  action text NOT NULL,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_access_log TO authenticated;
GRANT ALL ON public.admin_access_log TO service_role;
ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read the access log"
  ON public.admin_access_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
-- Writes happen through the service role only; no INSERT/UPDATE/DELETE policies.

CREATE INDEX idx_admin_access_log_admin ON public.admin_access_log (admin_user_id, created_at DESC);
CREATE INDEX idx_admin_access_log_subject ON public.admin_access_log (subject_type, subject_id);

-- =====================================================================
-- E1 / M3 : hot-path indexes on existing tables
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
  ON public.conversations (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_user_created
  ON public.messages (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date
  ON public.study_sessions (user_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_study_subjects_user_priority
  ON public.study_subjects (user_id, priority_order);

CREATE INDEX IF NOT EXISTS idx_study_tasks_user_date
  ON public.study_tasks (user_id, task_date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_memory_user_category
  ON public.ai_memory (user_id, category);

CREATE INDEX IF NOT EXISTS idx_user_insights_user_type
  ON public.user_insights (user_id, insight_type);

CREATE INDEX IF NOT EXISTS idx_user_documents_user_created
  ON public.user_documents (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_message_feedback_user_created
  ON public.ai_message_feedback (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_user_created
  ON public.feedback (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_goals_user_created
  ON public.goals (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_habits_user_type
  ON public.habits (user_id, habit_type);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
  ON public.user_roles (user_id, role);