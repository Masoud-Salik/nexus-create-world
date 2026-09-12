GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_pages TO authenticated;
GRANT ALL ON public.document_pages TO service_role;