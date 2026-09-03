-- =====================================================================
-- E5 Phase D — Contract.
-- 1. Retire legacy direct-generation schema (snapshot-before-drop).
-- 2. Remove client write grants to pipeline-owned source + knowledge data.
-- No learning-evidence rows are touched.
-- =====================================================================

-- ---------- 1. Legacy direct-generation schema ----------
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.study_items') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.study_items' INTO n;
    IF n > 0 THEN
      -- Snapshot instead of destroy: park the legacy table out of the API schema.
      EXECUTE 'CREATE SCHEMA IF NOT EXISTS legacy_archive';
      EXECUTE 'ALTER TABLE public.study_items SET SCHEMA legacy_archive';
      EXECUTE 'REVOKE ALL ON legacy_archive.study_items FROM anon, authenticated';
    ELSE
      EXECUTE 'DROP TABLE public.study_items';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documents' AND column_name='generation_status'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS public.documents_gen_status_idx';
    EXECUTE 'ALTER TABLE public.documents DROP COLUMN generation_status';
  END IF;
END $$;

-- ---------- 2. Source tables: pipeline-owned columns become backend-only ----------
REVOKE ALL ON public.documents FROM anon, authenticated;
GRANT SELECT, DELETE ON public.documents TO authenticated;
GRANT INSERT (user_id, title, mime, bytes, storage_path, sha256, page_count)
  ON public.documents TO authenticated;
GRANT UPDATE (title, storage_path, pages_extracted) ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;

REVOKE ALL ON public.document_pages FROM anon, authenticated;
GRANT SELECT, DELETE ON public.document_pages TO authenticated;
GRANT INSERT (document_id, user_id, page_no, text, has_text_layer, needs_ocr)
  ON public.document_pages TO authenticated;
GRANT UPDATE (text, has_text_layer, needs_ocr) ON public.document_pages TO authenticated;
GRANT ALL ON public.document_pages TO service_role;

REVOKE ALL ON public.document_chunks FROM anon, authenticated;
GRANT SELECT ON public.document_chunks TO authenticated;
GRANT ALL ON public.document_chunks TO service_role;

-- Chunks are pipeline output: the owner may read, never write.
DROP POLICY IF EXISTS "Owners manage their document chunks" ON public.document_chunks;
CREATE POLICY "document_chunks_owner_select"
  ON public.document_chunks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------- 3. Knowledge-engine tables: owner-read, backend-write ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'knowledge_units','knowledge_unit_spans','knowledge_edges','user_knowledge_state',
    'items','item_versions','item_version_spans',
    'review_sessions','review_attempts','review_grades','user_item_state',
    'scheduling_events','mastery_snapshots'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;

  -- Internal plumbing: no Data API access at all.
  FOREACH t IN ARRAY ARRAY[
    'item_candidates','generation_requests','validation_runs','domain_events','jobs'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
