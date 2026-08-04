ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

-- E4 hardening — link the job lifecycle back to the document lifecycle.
-- A dead job, or a working document with no live job, must never leave the
-- Library spinning forever.
CREATE OR REPLACE FUNCTION public.reconcile_stuck_documents(_stale interval DEFAULT interval '30 minutes')
RETURNS TABLE(dead_reconciled integer, stale_failed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d integer := 0;
  s integer := 0;
BEGIN
  WITH dead AS (
    SELECT DISTINCT ON ((j.payload->>'document_id')::uuid)
           (j.payload->>'document_id')::uuid AS document_id, j.kind
    FROM public.jobs j
    WHERE j.status = 'dead'
      AND j.kind IN ('ocr','chunk','embed')
      AND j.payload ? 'document_id'
    ORDER BY (j.payload->>'document_id')::uuid, j.updated_at DESC
  ), upd AS (
    UPDATE public.documents doc
    SET status = 'failed',
        error = CASE dead.kind
          WHEN 'ocr'   THEN 'We could not read the text in this file. Try uploading a clearer copy.'
          WHEN 'chunk' THEN 'We could not organise this document. Try again, or upload it once more.'
          ELSE 'We could not finish indexing this document. Try again in a few minutes.'
        END,
        updated_at = now()
    FROM dead
    WHERE doc.id = dead.document_id
      AND doc.status NOT IN ('failed','ready')
    RETURNING 1
  )
  SELECT count(*)::integer INTO d FROM upd;

  WITH stale AS (
    UPDATE public.documents doc
    SET status = 'failed',
        error = CASE
          WHEN doc.status = 'extracting'
            THEN 'The upload was interrupted. Please upload this file again.'
          ELSE 'Processing stopped unexpectedly. Use retry to run it again.'
        END,
        updated_at = now()
    WHERE doc.status IN ('queued','extracting','needs_ocr','ocr','chunking','embedding')
      AND doc.updated_at < now() - _stale
      AND NOT EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.status IN ('pending','running')
          AND j.payload->>'document_id' = doc.id::text
      )
    RETURNING 1
  )
  SELECT count(*)::integer INTO s FROM stale;

  RETURN QUERY SELECT d, s;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_stuck_documents(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_stuck_documents(interval) TO service_role;

-- E4 hardening — bounded job retention. Active work is never touched.
CREATE OR REPLACE FUNCTION public.purge_jobs(
  _done_retention interval DEFAULT interval '7 days',
  _dead_retention interval DEFAULT interval '30 days'
)
RETURNS TABLE(done_purged integer, dead_purged integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d integer := 0;
  x integer := 0;
BEGIN
  WITH gone AS (
    DELETE FROM public.jobs
    WHERE status = 'done' AND updated_at < now() - _done_retention
    RETURNING 1
  )
  SELECT count(*)::integer INTO d FROM gone;

  WITH gone AS (
    DELETE FROM public.jobs
    WHERE status = 'dead' AND updated_at < now() - _dead_retention
    RETURNING 1
  )
  SELECT count(*)::integer INTO x FROM gone;

  RETURN QUERY SELECT d, x;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_jobs(interval, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_jobs(interval, interval) TO service_role;