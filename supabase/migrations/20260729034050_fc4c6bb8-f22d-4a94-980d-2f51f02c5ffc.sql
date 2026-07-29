REVOKE EXECUTE ON FUNCTION public.enqueue_job(TEXT, TEXT, JSONB, TIMESTAMPTZ, INTEGER, TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.outbox_enqueue(TEXT, TEXT, JSONB, TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_jobs(TEXT, INTEGER, INTEGER) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_job(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_job(UUID, TEXT) FROM anon, authenticated;