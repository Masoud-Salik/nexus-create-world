
-- 1. Restrict AI knowledge + prompts + training examples to admins for SELECT.
DROP POLICY IF EXISTS "Authenticated can read chunks" ON public.ai_knowledge_chunks;
DROP POLICY IF EXISTS "Authenticated can read docs" ON public.ai_knowledge_docs;
DROP POLICY IF EXISTS "Authenticated can read active prompt" ON public.ai_prompt_versions;
DROP POLICY IF EXISTS "Authenticated can read training examples" ON public.ai_training_examples;

CREATE POLICY "Admins read chunks" ON public.ai_knowledge_chunks
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read docs" ON public.ai_knowledge_docs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read prompts" ON public.ai_prompt_versions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read training examples" ON public.ai_training_examples
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Replace nexus_perf_logs PERMISSIVE false with RESTRICTIVE false (cannot be bypassed).
DROP POLICY IF EXISTS "Deny all client access" ON public.nexus_perf_logs;
CREATE POLICY "Deny all client access" ON public.nexus_perf_logs
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 3. Lock down SECURITY DEFINER function execution.
-- match_knowledge: only edge functions (service_role) should call it.
REVOKE ALL ON FUNCTION public.match_knowledge(vector, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_knowledge(vector, int) TO service_role;

-- has_role: needed inside RLS policies for authenticated; keep that, drop anon/public.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- Trigger-only helpers: no client EXECUTE needed.
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
