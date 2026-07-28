REVOKE ALL ON FUNCTION public.gc_anon_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_anon_sessions() FROM anon;
REVOKE ALL ON FUNCTION public.gc_anon_sessions() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.gc_anon_sessions() TO service_role;