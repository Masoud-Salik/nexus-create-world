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
SECURITY INVOKER
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