/*
# E5.1 / M5.1a — Knowledge Engine: study_items table + generation_status

## Purpose
Extends the E4 ingestion pipeline with AI-generated study items (flashcards,
multiple-choice, true/false, fill-in-the-blank, short-answer) linked back to
document chunks for citation.

## New Tables
- `study_items`
  - `id` (uuid, primary key)
  - `document_id` (uuid, FK → documents, ON DELETE CASCADE)
  - `user_id` (uuid, FK → auth.users, ON DELETE CASCADE)
  - `chunk_id` (uuid, FK → document_chunks, ON DELETE SET NULL) — citation link
  - `type` (text) — flashcard | mcq | true_false | fill_blank | short_answer
  - `question` (text, not null)
  - `answer` (text) — flashcard back / short_answer model answer
  - `options` (jsonb) — MCQ: [{text, is_correct}]
  - `correct_answer` (text) — MCQ letter / true_false / fill_blank answer
  - `explanation` (text)
  - `difficulty` (text, default 'medium') — easy | medium | hard
  - `page_no` (integer) — denormalized from chunk for quick display
  - `item_hash` (text, not null) — SHA-256 of normalized question text for dedup
  - `quality_score` (real) — 0.0-1.0, set by validation heuristic (nullable)
  - `created_at`, `updated_at` (timestamptz)

## Modified Tables
- `documents` — adds `generation_status` column (text, default 'pending')
  with CHECK constraint: pending | generating | ready | failed | skipped

## Security
- RLS enabled on `study_items`, owner-scoped (auth.uid() = user_id)
- 4 separate policies: SELECT, INSERT, UPDATE, DELETE for authenticated
- GRANT SELECT, INSERT, UPDATE, DELETE to authenticated; ALL to service_role

## Indexes
- study_items(user_id, document_id) — list items per document
- study_items(user_id, type) — filter by item type
- documents(generation_status) partial — worker queries

## Important Notes
1. All migrations are additive — no existing columns or tables are modified destructively.
2. The UNIQUE constraint on (user_id, item_hash) enforces deduplication —
   INSERT ... ON CONFLICT DO NOTHING is the idempotency mechanism.
3. chunk_id is ON DELETE SET NULL (not CASCADE) so deleting a chunk doesn't lose
   the study item — it just loses the citation link.
4. page_no is denormalized from the chunk at insert time for display without a join.
*/

-- ============ study_items table ============
CREATE TABLE IF NOT EXISTS public.study_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_id        uuid REFERENCES public.document_chunks(id) ON DELETE SET NULL,
  type            text NOT NULL,
  question        text NOT NULL,
  answer          text,
  options         jsonb,
  correct_answer  text,
  explanation     text,
  difficulty      text NOT NULL DEFAULT 'medium',
  page_no         integer,
  item_hash       text NOT NULL,
  quality_score   real,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_items_type_chk CHECK (type IN ('flashcard','mcq','true_false','fill_blank','short_answer')),
  CONSTRAINT study_items_difficulty_chk CHECK (difficulty IN ('easy','medium','hard')),
  CONSTRAINT study_items_hash_unique UNIQUE (user_id, item_hash)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_items TO authenticated;
GRANT ALL ON public.study_items TO service_role;

ALTER TABLE public.study_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_study_items" ON public.study_items;
CREATE POLICY "select_own_study_items"
  ON public.study_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_study_items" ON public.study_items;
CREATE POLICY "insert_own_study_items"
  ON public.study_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_study_items" ON public.study_items;
CREATE POLICY "update_own_study_items"
  ON public.study_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_study_items" ON public.study_items;
CREATE POLICY "delete_own_study_items"
  ON public.study_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS study_items_user_doc_idx ON public.study_items(user_id, document_id);
CREATE INDEX IF NOT EXISTS study_items_user_type_idx ON public.study_items(user_id, type);

-- ============ documents.generation_status ============
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'generation_status'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN generation_status text NOT NULL DEFAULT 'pending';
    ALTER TABLE public.documents ADD CONSTRAINT documents_gen_status_chk
      CHECK (generation_status IN ('pending','generating','ready','failed','skipped'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS documents_gen_status_idx ON public.documents(generation_status)
  WHERE generation_status IN ('pending', 'generating');
