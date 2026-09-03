-- E5.1 — Extend reconcile_stuck_documents to handle generate_items dead jobs
-- and stale generation_status. Generation failure is independent from
-- ingestion: documents.status is never touched by this addition.

DROP FUNCTION IF EXISTS public.reconcile_stuck_documents(interval);

CREATE OR REPLACE FUNCTION public.reconcile_stuck_documents(_stale interval DEFAULT '00:30:00'::interval)
RETURNS TABLE(dead_reconciled integer, stale_failed integer, gen_failed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  d integer := 0;
  s integer := 0;
  g integer := 0;
BEGIN
  -- Pass 1: dead ingestion jobs (ocr/chunk/embed) -> documents.status = failed
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

  -- Pass 2: stale ingestion documents with no active jobs -> documents.status = failed
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

  -- Pass 3: dead generate_items jobs -> generation_status = failed
  -- The document itself is ready (status = 'ready'); only item generation failed.
  WITH dead_gen AS (
    SELECT DISTINCT ON ((j.payload->>'document_id')::uuid)
      (j.payload->>'document_id')::uuid AS document_id
    FROM public.jobs j
    WHERE j.status = 'dead'
      AND j.kind = 'generate_items'
      AND j.payload ? 'document_id'
    ORDER BY (j.payload->>'document_id')::uuid, j.updated_at DESC
  ), gen_upd AS (
    UPDATE public.documents doc
    SET generation_status = 'failed',
        updated_at = now()
    FROM dead_gen
    WHERE doc.id = dead_gen.document_id
      AND doc.generation_status = 'generating'
    RETURNING 1
  )
  SELECT count(*)::integer INTO g FROM gen_upd;

  -- Pass 3b: stale generation_status = generating with no active generate_items jobs
  WITH stale_gen AS (
    UPDATE public.documents doc
    SET generation_status = 'failed',
        updated_at = now()
    WHERE doc.generation_status = 'generating'
      AND doc.updated_at < now() - _stale
      AND NOT EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.status IN ('pending','running')
          AND j.kind = 'generate_items'
          AND j.payload->>'document_id' = doc.id::text
      )
    RETURNING 1
  )
  SELECT count(*)::integer INTO g FROM gen_upd;

  RETURN QUERY SELECT d, s, g;
END;
$function$;
