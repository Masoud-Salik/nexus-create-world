
-- Explicit deny-all to silence the "RLS enabled, no policy" linter.
-- Service role used by edge functions bypasses RLS.
CREATE POLICY "Deny all client access"
  ON public.nexus_perf_logs
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
