/*
# E5 — Trusted Knowledge Substrate

## Purpose
Implements the core E5 data model: versioned sources, grounded knowledge units
with exact source-span provenance, generation requests, temporary AI candidates
with lifecycle/TTL, validation runs, and immutable published item versions with
citations. This is the substrate that E6 (review engine) will consume later.

## Design principles
- AI proposes; deterministic code validates and commits.
- No item reaches a learner without verified source provenance.
- Candidates are temporary and never client-visible.
- Published item versions are immutable.
- All tables are owner-scoped (owner_id + owner_kind).
- Pipeline tables (candidates, validation, generation requests) are
  service-role-only — clients cannot read or write them.
- Published items/versions are owner-readable (authenticated users see their own).

## New Tables

### source_versions
- Immutable content revisions of a document. Each document gets version 1
  on creation; corrections create new versions, never rewriting history.
- Fields: id, document_id (FK→documents), version_no, sha256, storage_path,
  mime, page_count, extraction_policy, parser_version, ocr_version, created_at.

### knowledge_units
- Minimal learnable claims grounded in source spans.
- Fields: id, owner_id, owner_kind, source_version_id (FK→source_versions),
  kind (fact|concept|procedure|principle|definition|relationship),
  statement, language, status (proposed|grounded|active|retired|rejected),
  derivation_version, created_at, updated_at.

### knowledge_unit_spans
- Exact supporting source spans. A unit cannot be active without ≥1 valid span.
- Fields: id, knowledge_unit_id (FK→knowledge_units), document_chunk_id
  (FK→document_chunks), page_no, char_start, char_end, span_hash, created_at.

### generation_requests
- Durable intent to create inventory. Records WHY generation was requested.
- Idempotent via unique key.
- Fields: id, owner_id, owner_kind, source_version_id, knowledge_unit_id,
  probe_goal, item_type, language, policy_version, reason, status
  (pending|fulfilled|cancelled), idempotency_key, created_at, fulfilled_at.

### item_candidates
- Temporary untrusted AI model output. NOT learner-facing. TTL: 30 days.
- Fields: id, owner_id, owner_kind, generation_request_id (FK→generation_requests),
  source_version_id, knowledge_unit_id, item_type, content_hash, payload (jsonb),
  generator_model, prompt_version, schema_version, status
  (pending|validating|approved|rejected|expired|published),
  rejection_reason, expires_at, created_at, updated_at.

### validation_runs
- Append-only validator results. Each stage records its decision.
- Fields: id, item_candidate_id (FK→item_candidates), stage, validator_version,
  decision (pass|fail|warn), reason_codes (text[]), confidence, latency_ms,
  created_at.

### items
- Stable semantic identity of a published probe. Owns lifecycle only.
- Fields: id, owner_id, owner_kind, knowledge_unit_id, item_type,
  lifecycle (active|retired|quarantined|superseded),
  source_version_id, created_at, updated_at.

### item_versions
- Immutable wording, answer shape, rubric, explanation, item type, target unit.
- Historical reviews always reference the exact version shown.
- Fields: id, item_id (FK→items), version_no, item_type, question, answer,
  options (jsonb), correct_answer, explanation, difficulty, rubric (jsonb),
  policy_version, generator_model, prompt_version, schema_version,
  validation_policy_version, source_version_id, created_at.

### item_version_spans
- Exact citations supporting the question, answer, and explanation.
- Fields: id, item_version_id (FK→item_versions), document_chunk_id
  (FK→document_chunks), page_no, char_start, char_end, span_hash, role, created_at.

## Security
- RLS enabled on ALL new tables.
- Pipeline tables (source_versions, knowledge_units, knowledge_unit_spans,
  generation_requests, item_candidates, validation_runs): service-role ONLY.
  No client policies — the anon/authenticated roles get nothing.
- Published tables (items, item_versions, item_version_spans): owner-scoped
  SELECT for authenticated users. No client INSERT/UPDATE/DELETE — publication
  is a server-side operation.
- GRANT ALL to service_role on all tables.
- GRANT SELECT to authenticated on items, item_versions, item_version_spans
  (with RLS filtering by owner_id).

## Important Notes
1. All tables are additive — no existing tables are modified destructively.
2. source_versions references the existing documents table (document_id FK).
3. knowledge_unit_spans and item_version_spans reference document_chunks (FK).
4. item_candidates.expires_at is set at insert time (now() + 30 days).
5. A candidate status of 'published' means it has been consumed into items/
   item_versions — the candidate row is retained for audit but is no longer
   actionable.
6. generation_requests.idempotency_key enforces idempotent generation:
   re-enqueuing the same key is a no-op.
*/

-- ============ source_versions ============
CREATE TABLE IF NOT EXISTS public.source_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_no        integer NOT NULL DEFAULT 1,
  sha256            text NOT NULL,
  storage_path      text,
  mime              text,
  page_count        integer NOT NULL DEFAULT 0,
  extraction_policy text DEFAULT 'client',
  parser_version    text,
  ocr_version       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_versions_doc_version_unique UNIQUE (document_id, version_no)
);

GRANT ALL ON public.source_versions TO service_role;
ALTER TABLE public.source_versions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS source_versions_doc_idx ON public.source_versions(document_id, version_no);

-- ============ knowledge_units ============
CREATE TABLE IF NOT EXISTS public.knowledge_units (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL,
  owner_kind        text NOT NULL DEFAULT 'user',
  source_version_id uuid REFERENCES public.source_versions(id) ON DELETE SET NULL,
  kind              text NOT NULL,
  statement         text NOT NULL,
  language          text NOT NULL DEFAULT 'en',
  status            text NOT NULL DEFAULT 'proposed',
  derivation_version text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ku_kind_chk CHECK (kind IN ('fact','concept','procedure','principle','definition','relationship')),
  CONSTRAINT ku_status_chk CHECK (status IN ('proposed','grounded','active','retired','rejected'))
);

GRANT ALL ON public.knowledge_units TO service_role;
ALTER TABLE public.knowledge_units ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ku_owner_idx ON public.knowledge_units(owner_id, status);
CREATE INDEX IF NOT EXISTS ku_source_idx ON public.knowledge_units(source_version_id);

-- ============ knowledge_unit_spans ============
CREATE TABLE IF NOT EXISTS public.knowledge_unit_spans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_unit_id   uuid NOT NULL REFERENCES public.knowledge_units(id) ON DELETE CASCADE,
  document_chunk_id   uuid REFERENCES public.document_chunks(id) ON DELETE SET NULL,
  page_no             integer NOT NULL,
  char_start          integer NOT NULL DEFAULT 0,
  char_end            integer NOT NULL DEFAULT 0,
  span_hash           text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.knowledge_unit_spans TO service_role;
ALTER TABLE public.knowledge_unit_spans ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS kus_unit_idx ON public.knowledge_unit_spans(knowledge_unit_id);
CREATE INDEX IF NOT EXISTS kus_chunk_idx ON public.knowledge_unit_spans(document_chunk_id);

-- ============ generation_requests ============
CREATE TABLE IF NOT EXISTS public.generation_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL,
  owner_kind        text NOT NULL DEFAULT 'user',
  source_version_id uuid REFERENCES public.source_versions(id) ON DELETE SET NULL,
  knowledge_unit_id uuid REFERENCES public.knowledge_units(id) ON DELETE SET NULL,
  probe_goal        text,
  item_type         text NOT NULL DEFAULT 'flashcard',
  language          text NOT NULL DEFAULT 'en',
  policy_version    text NOT NULL DEFAULT 'e5.v1',
  reason           text NOT NULL DEFAULT 'starter',
  status           text NOT NULL DEFAULT 'pending',
  idempotency_key   text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  fulfilled_at      timestamptz,
  CONSTRAINT gen_req_status_chk CHECK (status IN ('pending','fulfilled','cancelled')),
  CONSTRAINT gen_req_reason_chk CHECK (reason IN ('starter','session_shortfall','misconception','coverage_gap','regeneration')),
  CONSTRAINT gen_req_type_chk CHECK (item_type IN ('flashcard','mcq','true_false','fill_blank','short_answer')),
  CONSTRAINT gen_req_idem_unique UNIQUE (idempotency_key)
);

GRANT ALL ON public.generation_requests TO service_role;
ALTER TABLE public.generation_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS gen_req_owner_idx ON public.generation_requests(owner_id, status);
CREATE INDEX IF NOT EXISTS gen_req_source_idx ON public.generation_requests(source_version_id);

-- ============ item_candidates ============
CREATE TABLE IF NOT EXISTS public.item_candidates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              uuid NOT NULL,
  owner_kind            text NOT NULL DEFAULT 'user',
  generation_request_id uuid REFERENCES public.generation_requests(id) ON DELETE SET NULL,
  source_version_id     uuid REFERENCES public.source_versions(id) ON DELETE SET NULL,
  knowledge_unit_id     uuid REFERENCES public.knowledge_units(id) ON DELETE SET NULL,
  item_type             text NOT NULL,
  content_hash          text NOT NULL,
  payload               jsonb NOT NULL,
  generator_model       text,
  prompt_version        text,
  schema_version        text,
  status                text NOT NULL DEFAULT 'pending',
  rejection_reason      text,
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cand_status_chk CHECK (status IN ('pending','validating','approved','rejected','expired','published')),
  CONSTRAINT cand_type_chk CHECK (item_type IN ('flashcard','mcq','true_false','fill_blank','short_answer'))
);

GRANT ALL ON public.item_candidates TO service_role;
ALTER TABLE public.item_candidates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS cand_owner_idx ON public.item_candidates(owner_id, status);
CREATE INDEX IF NOT EXISTS cand_req_idx ON public.item_candidates(generation_request_id);
CREATE INDEX IF NOT EXISTS cand_expires_idx ON public.item_candidates(expires_at) WHERE status IN ('pending','validating','approved');

-- ============ validation_runs ============
CREATE TABLE IF NOT EXISTS public.validation_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_candidate_id   uuid NOT NULL REFERENCES public.item_candidates(id) ON DELETE CASCADE,
  stage               text NOT NULL,
  validator_version   text NOT NULL DEFAULT 'e5.v1',
  decision            text NOT NULL,
  reason_codes        text[] DEFAULT '{}',
  confidence          real,
  latency_ms          integer,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vr_decision_chk CHECK (decision IN ('pass','fail','warn')),
  CONSTRAINT vr_stage_chk CHECK (stage IN ('structural','span_resolution','grounding','answerability','ambiguity_leakage','item_type','duplicate','quality_policy'))
);

GRANT ALL ON public.validation_runs TO service_role;
ALTER TABLE public.validation_runs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS vr_candidate_idx ON public.validation_runs(item_candidate_id);

-- ============ items ============
CREATE TABLE IF NOT EXISTS public.items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL,
  owner_kind        text NOT NULL DEFAULT 'user',
  knowledge_unit_id uuid REFERENCES public.knowledge_units(id) ON DELETE SET NULL,
  item_type         text NOT NULL,
  lifecycle         text NOT NULL DEFAULT 'active',
  source_version_id uuid REFERENCES public.source_versions(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT items_lifecycle_chk CHECK (lifecycle IN ('active','retired','quarantined','superseded')),
  CONSTRAINT items_type_chk CHECK (item_type IN ('flashcard','mcq','true_false','fill_blank','short_answer'))
);

GRANT SELECT ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_items" ON public.items;
CREATE POLICY "select_own_items"
  ON public.items FOR SELECT
  TO authenticated USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS items_owner_idx ON public.items(owner_id, lifecycle);
CREATE INDEX IF NOT EXISTS items_ku_idx ON public.items(knowledge_unit_id);
CREATE INDEX IF NOT EXISTS items_owner_type_idx ON public.items(owner_id, item_type, lifecycle);

-- ============ item_versions ============
CREATE TABLE IF NOT EXISTS public.item_versions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id                 uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  version_no              integer NOT NULL DEFAULT 1,
  item_type               text NOT NULL,
  question               text NOT NULL,
  answer                  text,
  options                 jsonb,
  correct_answer          text,
  explanation             text,
  difficulty              text NOT NULL DEFAULT 'medium',
  rubric                  jsonb,
  policy_version          text NOT NULL DEFAULT 'e5.v1',
  generator_model         text,
  prompt_version          text,
  schema_version          text,
  validation_policy_version text,
  source_version_id       uuid REFERENCES public.source_versions(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT iv_difficulty_chk CHECK (difficulty IN ('easy','medium','hard')),
  CONSTRAINT iv_type_chk CHECK (item_type IN ('flashcard','mcq','true_false','fill_blank','short_answer')),
  CONSTRAINT iv_item_version_unique UNIQUE (item_id, version_no)
);

GRANT SELECT ON public.item_versions TO authenticated;
GRANT ALL ON public.item_versions TO service_role;
ALTER TABLE public.item_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_item_versions" ON public.item_versions;
CREATE POLICY "select_own_item_versions"
  ON public.item_versions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.items WHERE items.id = item_versions.item_id AND items.owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS iv_item_idx ON public.item_versions(item_id);

-- ============ item_version_spans ============
CREATE TABLE IF NOT EXISTS public.item_version_spans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_version_id     uuid NOT NULL REFERENCES public.item_versions(id) ON DELETE CASCADE,
  document_chunk_id   uuid REFERENCES public.document_chunks(id) ON DELETE SET NULL,
  page_no             integer NOT NULL,
  char_start          integer NOT NULL DEFAULT 0,
  char_end            integer NOT NULL DEFAULT 0,
  span_hash           text NOT NULL,
  role                text NOT NULL DEFAULT 'support',
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ivs_role_chk CHECK (role IN ('support','question','answer','explanation'))
);

GRANT SELECT ON public.item_version_spans TO authenticated;
GRANT ALL ON public.item_version_spans TO service_role;
ALTER TABLE public.item_version_spans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_item_version_spans" ON public.item_version_spans;
CREATE POLICY "select_own_item_version_spans"
  ON public.item_version_spans FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.item_versions iv
      JOIN public.items i ON i.id = iv.item_id
      WHERE iv.id = item_version_spans.item_version_id AND i.owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS ivs_version_idx ON public.item_version_spans(item_version_id);

-- ============ Helper: backfill source_versions for existing documents ============
-- Each existing document gets a version 1 row so the E5 pipeline can reference it.
INSERT INTO public.source_versions (document_id, version_no, sha256, storage_path, mime, page_count, extraction_policy)
SELECT d.id, 1, d.sha256, d.storage_path, d.mime, d.page_count, 'client'
FROM public.documents d
WHERE NOT EXISTS (
  SELECT 1 FROM public.source_versions sv WHERE sv.document_id = d.id
)
ON CONFLICT (document_id, version_no) DO NOTHING;