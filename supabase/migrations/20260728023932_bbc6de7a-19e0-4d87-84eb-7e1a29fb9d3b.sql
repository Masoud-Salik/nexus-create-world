ALTER TABLE public.anon_sessions ADD COLUMN IF NOT EXISTS created_ip text;

CREATE INDEX IF NOT EXISTS idx_anon_sessions_ip_created
  ON public.anon_sessions (created_ip, created_at DESC);

-- Hourly GC: expired and unclaimed guest sessions are hard-deleted.
CREATE OR REPLACE FUNCTION public.gc_anon_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.anon_sessions
  WHERE expires_at < now() - interval '1 hour'
    AND claimed_by IS NULL;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.gc_anon_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gc_anon_sessions() TO service_role;