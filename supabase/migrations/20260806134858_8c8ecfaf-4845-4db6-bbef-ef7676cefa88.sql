-- ============================================================
-- E5 Knowledge Engine substrate (Blueprint v2)
-- Owner model: owner_id + owner_kind ('user' | 'anon')
-- Client access: read-only on owned durable data; all writes are service-side.
-- ============================================================

CREATE TABLE public.knowledge_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  owner_kind text NOT NULL DEFAULT 'user',
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  source_version integer NOT NULL DEFAULT 1,
  kind text NOT NULL DEFAULT 'fact',
  statement text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  lifecycle text NOT NULL DEFAULT 'proposed',
  content_hash text NOT NULL,
  derivation_version text NOT NULL DEFAULT 'ku@1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_units_kind_chk CHECK (kind IN ('fact','concept','procedure','principle','definition','relationship')),
  CONSTRAINT knowledge_units_lifecycle_chk CHECK (lifecycle IN ('proposed','grounded','active','rejected','superseded','retired')),
  CONSTRAINT knowledge_units_owner_kind_chk CHECK (owner_kind IN ('user','anon')),
  CONSTRAINT knowledge_units_hash_uniq UNIQUE (owner_id, content_hash)
);
CREATE INDEX knowledge_units_owner_doc_idx ON public.knowledge_units (owner_id, document_id, lifecycle);
GRANT SELECT ON public.knowledge_units TO authenticated;
GRANT ALL ON public.knowledge_units TO service_role;
ALTER TABLE public.knowledge_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge_units_owner_select" ON public.knowledge_units
  FOR SELECT TO authenticated USING (owner_kind = 'user' AND owner_id = auth.uid());

CREATE TABLE public.knowledge_unit_spans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_unit_id uuid NOT NULL REFERENCES public.knowledge_units(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  chunk_id uuid REFERENCES public.document_chunks(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  page_no integer,
  char_start integer NOT NULL DEFAULT 0,
  char_end integer NOT NULL DEFAULT 0,
  quote text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_unit_spans_unit_idx ON public.knowledge_unit_spans (knowledge_unit_id);
CREATE INDEX knowledge_unit_spans_owner_idx ON public.knowledge_unit_spans (owner_id);
GRANT SELECT ON public.knowledge_unit_spans TO authenticated;
GRANT ALL ON public.knowledge_unit_spans TO service_role;
ALTER TABLE public.knowledge_unit_spans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge_unit_spans_owner_select" ON public.knowledge_unit_spans
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.knowledge_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  from_unit_id uuid NOT NULL REFERENCES public.knowledge_units(id) ON DELETE CASCADE,
  to_unit_id uuid NOT NULL REFERENCES public.knowledge_units(id) ON DELETE CASCADE,
  edge_type text NOT NULL,
  confidence real,
  derivation_version text NOT NULL DEFAULT 'kg@1',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_edges_type_chk CHECK (edge_type IN ('prerequisite_of','part_of','related_to','contrasts_with','commonly_confused_with')),
  CONSTRAINT knowledge_edges_no_self CHECK (from_unit_id <> to_unit_id),
  CONSTRAINT knowledge_edges_uniq UNIQUE (from_unit_id, to_unit_id, edge_type)
);
CREATE INDEX knowledge_edges_owner_idx ON public.knowledge_edges (owner_id, edge_type);
GRANT SELECT ON public.knowledge_edges TO authenticated;
GRANT ALL ON public.knowledge_edges TO service_role;
ALTER TABLE public.knowledge_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge_edges_owner_select" ON public.knowledge_edges
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.generation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  owner_kind text NOT NULL DEFAULT 'user',
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  knowledge_unit_id uuid REFERENCES public.knowledge_units(id) ON DELETE CASCADE,
  reason text NOT NULL,
  probe_goal text,
  item_type text,
  requested_count integer NOT NULL DEFAULT 1,
  language text NOT NULL DEFAULT 'en',
  policy_version text NOT NULL DEFAULT 'gen@1',
  status text NOT NULL DEFAULT 'pending',
  cost_cap_usd numeric NOT NULL DEFAULT 0.05,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT generation_requests_reason_chk CHECK (reason IN ('starter','session_shortfall','misconception','coverage_gap','regeneration')),
  CONSTRAINT generation_requests_status_chk CHECK (status IN ('pending','running','done','failed','cancelled'))
);
CREATE INDEX generation_requests_owner_status_idx ON public.generation_requests (owner_id, status, created_at DESC);
GRANT ALL ON public.generation_requests TO service_role;
ALTER TABLE public.generation_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.item_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  owner_kind text NOT NULL DEFAULT 'user',
  request_id uuid REFERENCES public.generation_requests(id) ON DELETE SET NULL,
  knowledge_unit_id uuid REFERENCES public.knowledge_units(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  source_version integer NOT NULL DEFAULT 1,
  item_type text NOT NULL,
  payload jsonb NOT NULL,
  content_hash text NOT NULL,
  generator_model text,
  prompt_version text,
  status text NOT NULL DEFAULT 'generated',
  rejection_reason text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_candidates_status_chk CHECK (status IN ('generated','validating','approved','rejected','published','expired')),
  CONSTRAINT item_candidates_hash_uniq UNIQUE (owner_id, content_hash)
);
CREATE INDEX item_candidates_owner_status_idx ON public.item_candidates (owner_id, status, created_at DESC);
CREATE INDEX item_candidates_expiry_idx ON public.item_candidates (expires_at) WHERE status <> 'published';
GRANT ALL ON public.item_candidates TO service_role;
ALTER TABLE public.item_candidates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.validation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.item_candidates(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  stage text NOT NULL,
  validator_version text NOT NULL,
  decision text NOT NULL,
  reason_codes text[] NOT NULL DEFAULT '{}',
  confidence real,
  latency_ms integer,
  cost_usd numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT validation_runs_decision_chk CHECK (decision IN ('pass','fail','warn'))
);
CREATE INDEX validation_runs_candidate_idx ON public.validation_runs (candidate_id, created_at);
GRANT ALL ON public.validation_runs TO service_role;
ALTER TABLE public.validation_runs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  owner_kind text NOT NULL DEFAULT 'user',
  knowledge_unit_id uuid REFERENCES public.knowledge_units(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  lifecycle text NOT NULL DEFAULT 'active',
  active_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT items_lifecycle_chk CHECK (lifecycle IN ('active','retired','superseded','quarantined'))
);
CREATE INDEX items_owner_lifecycle_idx ON public.items (owner_id, lifecycle);
CREATE INDEX items_owner_unit_idx ON public.items (owner_id, knowledge_unit_id, lifecycle);
GRANT SELECT ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items_owner_select" ON public.items
  FOR SELECT TO authenticated USING (owner_kind = 'user' AND owner_id = auth.uid());

CREATE TABLE public.item_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  item_type text NOT NULL,
  prompt text NOT NULL,
  answer jsonb NOT NULL,
  rubric jsonb,
  explanation text,
  grade_method text NOT NULL DEFAULT 'exact',
  policy_version text NOT NULL DEFAULT 'pub@1',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_versions_type_chk CHECK (item_type IN ('flashcard','mcq','true_false','fill_blank','short_answer','ordering','numeric')),
  CONSTRAINT item_versions_grade_chk CHECK (grade_method IN ('exact','normalized','set','numeric','semantic')),
  CONSTRAINT item_versions_uniq UNIQUE (item_id, version)
);
CREATE INDEX item_versions_owner_idx ON public.item_versions (owner_id, item_id);
GRANT SELECT ON public.item_versions TO authenticated;
GRANT ALL ON public.item_versions TO service_role;
ALTER TABLE public.item_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "item_versions_owner_select" ON public.item_versions
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.item_version_spans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_version_id uuid NOT NULL REFERENCES public.item_versions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  chunk_id uuid REFERENCES public.document_chunks(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  page_no integer,
  char_start integer NOT NULL DEFAULT 0,
  char_end integer NOT NULL DEFAULT 0,
  quote text NOT NULL,
  role text NOT NULL DEFAULT 'question',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_version_spans_role_chk CHECK (role IN ('question','answer','explanation'))
);
CREATE INDEX item_version_spans_version_idx ON public.item_version_spans (item_version_id);
GRANT SELECT ON public.item_version_spans TO authenticated;
GRANT ALL ON public.item_version_spans TO service_role;
ALTER TABLE public.item_version_spans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "item_version_spans_owner_select" ON public.item_version_spans
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.review_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  owner_kind text NOT NULL DEFAULT 'user',
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_minutes integer NOT NULL DEFAULT 10,
  planner_version text NOT NULL DEFAULT 'plan@1',
  scheduler_version text NOT NULL DEFAULT 'fsrs@1',
  status text NOT NULL DEFAULT 'preparing',
  item_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT review_sessions_status_chk CHECK (status IN ('preparing','ready','active','completed','abandoned'))
);
CREATE INDEX review_sessions_owner_idx ON public.review_sessions (owner_id, created_at DESC);
GRANT SELECT ON public.review_sessions TO authenticated;
GRANT ALL ON public.review_sessions TO service_role;
ALTER TABLE public.review_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_sessions_owner_select" ON public.review_sessions
  FOR SELECT TO authenticated USING (owner_kind = 'user' AND owner_id = auth.uid());

CREATE TABLE public.review_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.review_sessions(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL,
  owner_kind text NOT NULL DEFAULT 'user',
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  item_version_id uuid NOT NULL REFERENCES public.item_versions(id) ON DELETE RESTRICT,
  response jsonb NOT NULL,
  response_mode text NOT NULL DEFAULT 'recall',
  latency_ms integer,
  self_confidence integer,
  client_occurred_at timestamptz,
  server_received_at timestamptz NOT NULL DEFAULT now(),
  device_id text,
  idempotency_key text NOT NULL,
  CONSTRAINT review_attempts_mode_chk CHECK (response_mode IN ('recognition','recall','application','transfer')),
  CONSTRAINT review_attempts_idem_uniq UNIQUE (owner_id, idempotency_key)
);
CREATE INDEX review_attempts_owner_time_idx ON public.review_attempts (owner_id, server_received_at DESC);
CREATE INDEX review_attempts_item_idx ON public.review_attempts (owner_id, item_id);
GRANT SELECT ON public.review_attempts TO authenticated;
GRANT ALL ON public.review_attempts TO service_role;
ALTER TABLE public.review_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_attempts_owner_select" ON public.review_attempts
  FOR SELECT TO authenticated USING (owner_kind = 'user' AND owner_id = auth.uid());

CREATE TABLE public.review_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.review_attempts(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  is_correct boolean NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  grade_method text NOT NULL,
  grader_version text NOT NULL DEFAULT 'grade@1',
  rubric_version text,
  feedback text,
  supersedes_grade_id uuid REFERENCES public.review_grades(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_grades_method_chk CHECK (grade_method IN ('exact','normalized','set','numeric','semantic','manual'))
);
CREATE INDEX review_grades_attempt_idx ON public.review_grades (attempt_id);
CREATE INDEX review_grades_owner_time_idx ON public.review_grades (owner_id, created_at DESC);
GRANT SELECT ON public.review_grades TO authenticated;
GRANT ALL ON public.review_grades TO service_role;
ALTER TABLE public.review_grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_grades_owner_select" ON public.review_grades
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.scheduling_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  grade_id uuid REFERENCES public.review_grades(id) ON DELETE SET NULL,
  prior_state jsonb,
  next_state jsonb NOT NULL,
  rating integer NOT NULL,
  scheduler_version text NOT NULL DEFAULT 'fsrs@1',
  parameter_version text NOT NULL DEFAULT 'fsrs-params@1',
  due_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scheduling_events_grade_uniq UNIQUE (grade_id)
);
CREATE INDEX scheduling_events_owner_item_idx ON public.scheduling_events (owner_id, item_id, created_at);
GRANT SELECT ON public.scheduling_events TO authenticated;
GRANT ALL ON public.scheduling_events TO service_role;
ALTER TABLE public.scheduling_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scheduling_events_owner_select" ON public.scheduling_events
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.user_item_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  owner_kind text NOT NULL DEFAULT 'user',
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  stability real NOT NULL DEFAULT 0,
  difficulty real NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'new',
  due_at timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz,
  repetitions integer NOT NULL DEFAULT 0,
  lapses integer NOT NULL DEFAULT 0,
  scheduler_version text NOT NULL DEFAULT 'fsrs@1',
  last_event_id uuid REFERENCES public.scheduling_events(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_item_state_state_chk CHECK (state IN ('new','learning','review','relearning','suspended')),
  CONSTRAINT user_item_state_uniq UNIQUE (owner_id, item_id)
);
CREATE INDEX user_item_state_due_idx ON public.user_item_state (owner_id, due_at)
  WHERE state <> 'suspended';
GRANT SELECT ON public.user_item_state TO authenticated;
GRANT ALL ON public.user_item_state TO service_role;
ALTER TABLE public.user_item_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_item_state_owner_select" ON public.user_item_state
  FOR SELECT TO authenticated USING (owner_kind = 'user' AND owner_id = auth.uid());

CREATE TABLE public.user_knowledge_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  knowledge_unit_id uuid NOT NULL REFERENCES public.knowledge_units(id) ON DELETE CASCADE,
  evidence_count integer NOT NULL DEFAULT 0,
  weighted_success real NOT NULL DEFAULT 0,
  weighted_failure real NOT NULL DEFAULT 0,
  coverage real NOT NULL DEFAULT 0,
  predicted_recall real,
  confidence real NOT NULL DEFAULT 0,
  band text NOT NULL DEFAULT 'unseen',
  misconception_flags text[] NOT NULL DEFAULT '{}',
  last_evidence_at timestamptz,
  projection_version text NOT NULL DEFAULT 'mastery@1',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_knowledge_state_band_chk CHECK (band IN ('unseen','building','secure','fragile')),
  CONSTRAINT user_knowledge_state_uniq UNIQUE (owner_id, knowledge_unit_id)
);
CREATE INDEX user_knowledge_state_owner_idx ON public.user_knowledge_state (owner_id, band);
GRANT SELECT ON public.user_knowledge_state TO authenticated;
GRANT ALL ON public.user_knowledge_state TO service_role;
ALTER TABLE public.user_knowledge_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_knowledge_state_owner_select" ON public.user_knowledge_state
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.mastery_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  retained_items integer NOT NULL DEFAULT 0,
  units_secure integer NOT NULL DEFAULT 0,
  units_fragile integer NOT NULL DEFAULT 0,
  predicted_recall real,
  projection_version text NOT NULL DEFAULT 'mastery@1',
  as_of timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mastery_snapshots_owner_idx ON public.mastery_snapshots (owner_id, as_of DESC);
GRANT SELECT ON public.mastery_snapshots TO authenticated;
GRANT ALL ON public.mastery_snapshots TO service_role;
ALTER TABLE public.mastery_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mastery_snapshots_owner_select" ON public.mastery_snapshots
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  aggregate_type text NOT NULL,
  aggregate_id uuid,
  owner_id uuid,
  owner_kind text NOT NULL DEFAULT 'user',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  trace_id text,
  causation_id uuid,
  correlation_id uuid,
  dispatched_at timestamptz,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX domain_events_pending_idx ON public.domain_events (occurred_at) WHERE dispatched_at IS NULL;
CREATE INDEX domain_events_owner_idx ON public.domain_events (owner_id, occurred_at DESC);
GRANT ALL ON public.domain_events TO service_role;
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;

-- ---------- queue lanes, priority, backpressure metadata ----------
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS lane text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS cost_estimate_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE INDEX IF NOT EXISTS jobs_lane_claim_idx
  ON public.jobs (lane, status, priority DESC, next_run_at);

CREATE OR REPLACE FUNCTION public.claim_jobs(_kind text, _n integer DEFAULT 10, _lease_seconds integer DEFAULT 120)
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT j.id
    FROM public.jobs j
    WHERE (_kind IS NULL OR j.kind = _kind)
      AND j.cancelled_at IS NULL
      AND (
        (j.status = 'pending' AND j.next_run_at <= now())
        OR (j.status = 'running' AND j.lease_until IS NOT NULL AND j.lease_until < now())
      )
    ORDER BY j.priority DESC, j.next_run_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(COALESCE(_n, 10), 0)
  )
  UPDATE public.jobs j
  SET status = 'running',
      attempts = j.attempts + 1,
      lease_until = now() + make_interval(secs => GREATEST(COALESCE(_lease_seconds, 120), 5))
  FROM claimed c
  WHERE j.id = c.id
  RETURNING j.*;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.claim_jobs(text, integer, integer) FROM anon, authenticated;