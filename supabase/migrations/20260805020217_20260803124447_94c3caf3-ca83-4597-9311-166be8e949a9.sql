-- ============ E4 / M4.1 — documents ============
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  mime text NOT NULL,
  bytes bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  sha256 text NOT NULL,
  page_count integer NOT NULL DEFAULT 0,
  pages_extracted integer NOT NULL DEFAULT 0,
  chunk_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued',
  error text,
  source text NOT NULL DEFAULT 'upload',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_status_chk CHECK (status IN ('queued','extracting','needs_ocr','ocr','chunking','embedding','ready','failed')),
  CONSTRAINT documents_sha_unique UNIQUE (user_id, sha256)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their documents"
ON public.documents FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX documents_user_created_idx ON public.documents(user_id, created_at DESC);
CREATE INDEX documents_status_idx ON public.documents(status);

CREATE TRIGGER documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ E4 / M4.2 — pages ============
CREATE TABLE public.document_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_no integer NOT NULL,
  text text NOT NULL DEFAULT '',
  has_text_layer boolean NOT NULL DEFAULT false,
  needs_ocr boolean NOT NULL DEFAULT false,
  ocr_confidence real,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_pages_unique UNIQUE (document_id, page_no)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_pages TO authenticated;
GRANT ALL ON public.document_pages TO service_role;

ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their document pages"
ON public.document_pages FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX document_pages_doc_idx ON public.document_pages(document_id, page_no);
CREATE INDEX document_pages_ocr_idx ON public.document_pages(document_id) WHERE needs_ocr;

-- ============ E4 / M4.4 — chunks ============
CREATE TABLE public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  page_no integer,
  char_start integer NOT NULL DEFAULT 0,
  char_end integer NOT NULL DEFAULT 0,
  token_count integer NOT NULL DEFAULT 0,
  embedding vector(1536),
  model_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_chunks_unique UNIQUE (document_id, chunk_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_chunks TO authenticated;
GRANT ALL ON public.document_chunks TO service_role;

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their document chunks"
ON public.document_chunks FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX document_chunks_doc_idx ON public.document_chunks(document_id, chunk_index);
CREATE INDEX document_chunks_pending_idx ON public.document_chunks(document_id) WHERE embedding IS NULL;
CREATE INDEX document_chunks_embedding_idx
  ON public.document_chunks USING hnsw (embedding vector_cosine_ops);

-- Owner-scoped semantic search. SECURITY DEFINER so it can read the table with a
-- hard auth.uid() filter; it can never return another user's chunks.
CREATE OR REPLACE FUNCTION public.match_user_chunks(
  query_embedding vector(1536),
  match_count integer DEFAULT 6
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  page_no integer,
  similarity double precision,
  doc_title text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.document_id, c.content, c.page_no,
         1 - (c.embedding <=> query_embedding) AS similarity,
         d.title AS doc_title
  FROM public.document_chunks c
  JOIN public.documents d ON d.id = c.document_id
  WHERE c.user_id = auth.uid()
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(COALESCE(match_count, 6), 1), 20);
$$;

REVOKE ALL ON FUNCTION public.match_user_chunks(vector, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_user_chunks(vector, integer) TO authenticated;

-- ============ M4.1 — storage rules for the private user-documents bucket ============
CREATE POLICY "Owners read their uploads"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners write their uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners update their uploads"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners delete their uploads"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
