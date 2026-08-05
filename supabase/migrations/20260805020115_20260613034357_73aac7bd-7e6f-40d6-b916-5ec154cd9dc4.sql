
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Prompt Versions
CREATE TABLE IF NOT EXISTS public.ai_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  system_prompt text NOT NULL,
  persona text,
  temperature numeric NOT NULL DEFAULT 0.7,
  max_tokens integer NOT NULL DEFAULT 2048,
  tool_aggressiveness text NOT NULL DEFAULT 'balanced',
  few_shots jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_prompt_versions TO authenticated;
GRANT ALL ON public.ai_prompt_versions TO service_role;

ALTER TABLE public.ai_prompt_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read active prompt"
ON public.ai_prompt_versions FOR SELECT TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage prompts"
ON public.ai_prompt_versions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS ai_prompt_versions_active_idx ON public.ai_prompt_versions(is_active) WHERE is_active = true;

-- Knowledge docs
CREATE TABLE IF NOT EXISTS public.ai_knowledge_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source_type text NOT NULL DEFAULT 'text',
  source_url text,
  status text NOT NULL DEFAULT 'pending',
  chunk_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_knowledge_docs TO authenticated;
GRANT ALL ON public.ai_knowledge_docs TO service_role;

ALTER TABLE public.ai_knowledge_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read docs"
ON public.ai_knowledge_docs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage docs"
ON public.ai_knowledge_docs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Knowledge chunks (768-dim to match common embedding configs; we'll request dims=768)
CREATE TABLE IF NOT EXISTS public.ai_knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid NOT NULL REFERENCES public.ai_knowledge_docs(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(768),
  token_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_knowledge_chunks TO authenticated;
GRANT ALL ON public.ai_knowledge_chunks TO service_role;

ALTER TABLE public.ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read chunks"
ON public.ai_knowledge_chunks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage chunks"
ON public.ai_knowledge_chunks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_doc_idx ON public.ai_knowledge_chunks(doc_id);
CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_embedding_idx
  ON public.ai_knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Vector match function
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector(768),
  match_count integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  doc_id uuid,
  content text,
  similarity float,
  doc_title text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.doc_id, c.content,
         1 - (c.embedding <=> query_embedding) AS similarity,
         d.title AS doc_title
  FROM public.ai_knowledge_chunks c
  JOIN public.ai_knowledge_docs d ON d.id = c.doc_id
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_knowledge(vector, integer) TO authenticated, service_role;

-- Message feedback
CREATE TABLE IF NOT EXISTS public.ai_message_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating text NOT NULL CHECK (rating IN ('up','down')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_message_feedback TO authenticated;
GRANT ALL ON public.ai_message_feedback TO service_role;

ALTER TABLE public.ai_message_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own feedback"
ON public.ai_message_feedback FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own feedback"
ON public.ai_message_feedback FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own feedback"
ON public.ai_message_feedback FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own feedback"
ON public.ai_message_feedback FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ai_message_feedback_msg_idx ON public.ai_message_feedback(message_id);

-- Training examples (gold set)
CREATE TABLE IF NOT EXISTS public.ai_training_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  user_input text NOT NULL,
  ideal_response text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_training_examples TO authenticated;
GRANT ALL ON public.ai_training_examples TO service_role;

ALTER TABLE public.ai_training_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage training examples"
ON public.ai_training_examples FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read training examples"
ON public.ai_training_examples FOR SELECT TO authenticated USING (true);

-- updated_at triggers
DROP TRIGGER IF EXISTS ai_prompt_versions_updated_at ON public.ai_prompt_versions;
CREATE TRIGGER ai_prompt_versions_updated_at
  BEFORE UPDATE ON public.ai_prompt_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS ai_knowledge_docs_updated_at ON public.ai_knowledge_docs;
CREATE TRIGGER ai_knowledge_docs_updated_at
  BEFORE UPDATE ON public.ai_knowledge_docs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed a default active prompt mirroring current NEXUS persona
INSERT INTO public.ai_prompt_versions (name, system_prompt, persona, temperature, max_tokens, is_active)
VALUES (
  'NEXUS Default',
  'You are NEXUS — the StudyTime AI companion. You''re brilliant, witty, and genuinely fun to talk to. Think of yourself as the user''s smartest friend who happens to be an expert tutor.

PERSONALITY:
- Be playful and warm — crack smart jokes, use witty observations, and make studying feel less lonely.
- Use 1-2 emojis per message. Vary them.
- Give direct answers (1-3 sentences when possible). Be concise but never cold.
- When the user achieves something, celebrate genuinely. When they struggle, be supportive AND actionable.
- Adapt your tone: match serious with serious, playful with playful.
- Respond in the user''s language.

PERSONALIZATION:
- Use user memories, preferences, likes, and dislikes naturally.
- Reference interests to make studying relatable.
- Save new things you learn via save_user_preference.

APP KNOWLEDGE:
- StudyTime has: Focus Hub (Pomodoro), Blueprint (AI planner), Leaderboard (XP), AI Chat (you).
- Blueprint generates plans; users earn XP for completing tasks; Bonus Round = 1.5x.

TOOLS: Use tools before answering questions about user-specific data. If the user asks about general knowledge that might be in our knowledge base, call rag_search.

FORMAT: Use markdown. Bold key numbers. Keep responses compact.',
  'friendly_tutor',
  0.7,
  2048,
  true
)
ON CONFLICT DO NOTHING;
