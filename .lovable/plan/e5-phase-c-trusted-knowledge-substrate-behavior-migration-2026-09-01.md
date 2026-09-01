# E5 Phase C — Trusted Knowledge Substrate (behavior migration)

Schema and deterministic core (Phase B) are in place. This phase makes the pipeline
actually produce trusted, cited study items — lazily and within a cost ceiling.

## What gets built

### 1. Knowledge unit extraction (`extract_units` job)
- Triggered on source readiness (after `embed` completes), bounded to the top N chunks
  by coverage, never the whole document.
- AI proposes candidate units; deterministic code validates that every unit has at
  least one verbatim source span inside the cited chunk, then writes
  `knowledge_units` + `knowledge_unit_spans`.
- Units that fail span verification are dropped, not published.

### 2. Bounded starter inventory (`generate_candidates` job)
- After extraction, request a single starter batch of 8–15 items covering the
  highest-value units. Hard cap per source version, recorded on `generation_requests`.
- Model output lands in `item_candidates` only — never directly in `items`.
- Lazy top-up: the session planner (E6) requests only the shortfall; the same handler
  serves both paths through `generation_requests`.

### 3. Validation and publication (`validate_candidates` job)
- Deterministic gates, all must pass: structural schema, answer/grader compatibility,
  citation span exists and matches source text, duplicate/near-duplicate rejection,
  no leaked answer in the prompt.
- Independent AI verifier for grounding/entailment, run only on candidates that pass
  the deterministic gates.
- Passing candidates are published as immutable `item_versions` plus an `items` row and
  `item_version_spans`. Failures are quarantined with a reason; low-confidence goes to
  the admin sample queue. Candidates expire by TTL.
- Every run recorded in `validation_runs`.

### 4. Event wiring
Emit and consume through the existing outbox: `source.version_ready` →
`knowledge.inventory_requested` → `item.candidate_generated` →
`item.validation_completed` → `item.published` / `item.quarantined`.
Each hop enqueues an idempotent job keyed on source version + request id, so replays
never double-generate or double-publish.

### 5. Cost and safety fencing
- New AI tasks in the registry (`extract_units`, `generate_items_v2`, `verify_item`)
  with their own token ceilings, window limits and schemas — no call site picks a model.
- Per-source-version spend ceiling enforced before each generation request; exceeding
  it parks the request instead of looping.
- `402`/`403` from the gateway pauses the generation lane; `429` backs off.

## Technical notes
- Handlers: `supabase/functions/worker/handlers/extract_units.ts`,
  `generate_candidates.ts`, `validate_candidates.ts`, registered in `handlers.ts`.
- Shared logic: `_shared/knowledge/units.ts` (span verification),
  `_shared/knowledge/publish.ts` (candidate → item version transaction),
  `_shared/knowledge/validators.ts` (deterministic gates).
- Schemas added to `_shared/ai/schema.ts`; tasks to `_shared/ai/tasks.ts`.
- Client never reads `item_candidates`; service-role only, unchanged RLS posture.

## Verification
- Unit tests for span verification, each deterministic gate, and duplicate rejection.
- Publication idempotency test: replaying a validation event publishes exactly one
  item version.
- Cost-ceiling test: a source at its cap produces no further generation requests.
- Run `vitest` for the knowledge and queue suites; report results and stop.

## Out of scope
Review sessions, FSRS scheduling loop and the session planner stay in E6. No frontend
changes in this phase.
