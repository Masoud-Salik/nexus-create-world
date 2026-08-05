# StudyTime Knowledge Engine Architecture — E5 through E9

## Executive decision

StudyTime’s Knowledge Engine will be an **evidence-led learning system**, not a document-to-flashcard generator.

The permanent value chain is:

```text
Source truth
  → grounded knowledge units
  → validated study-item versions
  → immutable learner responses and grades
  → deterministic scheduling state
  → concept-level mastery projections
  → better future review selection
```

The current M5.1 design is not the production architecture. It eagerly generates mixed items for every chunk immediately after embedding, publishes model output directly, has no validation gate, and stores no review or mastery state. The repository confirms this in `worker/handlers/embed.ts`, `worker/handlers/generate_items.ts`, and `20260805020304_e5_study_items.sql`. The live backend has E4 tables but does **not** yet have `study_items` or `documents.generation_status`, so this is the correct moment to replace M5.1 rather than migrate users later.

### Non-negotiable decisions

1. **Persist source truth and learning evidence; expire unused AI derivations.**
2. **Generate a bounded starter inventory, then replenish on demand.** Never generate an entire document speculatively.
3. **AI proposes; deterministic code validates invariants, schedules reviews, and commits learner state.**
4. **No candidate reaches a learner without exact provenance and a versioned validation policy.**
5. **Review responses, grades, and scheduling decisions are immutable facts.** Mastery and due lists are projections.
6. **FSRS is a pure, versioned library.** The review service is the sole writer of scheduling state.
7. **Concepts are private and owner-scoped in E5–E9.** No cross-user reuse of private material.
8. **The core review loop works during an AI outage.** Generation, AI grading, and tutor chat may degrade; due reviews and deterministic grading do not.
9. **One million users requires logical sharding, bounded queues, and cost budgets from day one**, even if physical sharding is deferred.

---

## 1. Audit basis and current-state corrections

The requested long-term knowledge files are absent from the checkout. The root `ARCHITECTURE.md` describes the older Nexus Life Coach and is not authoritative for E5–E9. This architecture reconciles the approved Blueprint history with:

- `docs/schema-audit.md`
- E2 queue and worker implementation
- E3 governed AI boundary
- E4 ingestion tables, functions, and runbooks
- M5.1 migrations and generation handler
- the live database schema, policies, indexes, schedules, and queue state

### What remains valid

- E2’s Postgres queue, `FOR UPDATE SKIP LOCKED`, leases, stable job keys, retries, and dead-letter handling.
- E3’s single AI boundary, task registry, structured-output validation, metering, limits, trace IDs, and provider fallback.
- E4’s private uploads, client extraction, OCR escalation, deterministic chunking, 1536-dimensional chunk embeddings, provenance offsets, and ingestion limits.
- Expand → migrate → contract migrations and the existing operational runbooks.

### What must change

- `embed` must stop unconditionally enqueuing full-document item generation.
- `study_items` must not be the destination for raw model output.
- `documents.generation_status` must not become a second coarse document state machine.
- User-editable RLS access to pipeline-owned fields and generated learning artifacts must be removed; users issue commands through authenticated APIs.
- The target owner model must be resolved before anonymous review: current E4 tables require `user_id` and reject anonymous callers despite the earlier owner-resolution design.
- The current global HNSW index with a post-filtered tenant predicate is not a viable final retrieval layout for hundreds of millions of chunks.

---

## 2. Core domain model

### 2.1 Source layer

**`sources`** — user-visible logical material: title, owner, status, active version, retention state.

**`source_versions`** — immutable content revisions: source hash, storage object, MIME, extraction policy, parser/OCR versions, page count, created time. A correction creates a version; it never rewrites historical provenance.

**`source_pages`** — extracted page truth for one source version, including OCR confidence and extraction method.

**`source_chunks`** — retrieval units with stable version scope, page and character offsets, content hash, token count, embedding model/version, and vector. Chunks are derived but retained while a published item or citation references them.

### 2.2 Knowledge layer

**`knowledge_units`** — minimal learnable claims or skills, not arbitrary topic labels. Examples: “mitosis produces two genetically identical daughter cells” or “apply the chain rule to a composite function.” Each unit has a kind (`fact`, `concept`, `procedure`, `principle`, `definition`, `relationship`), language, lifecycle, and derivation version.

**`knowledge_unit_spans`** — one or more exact supporting source spans. A unit cannot become active without at least one valid span.

**`knowledge_edges`** — owner-scoped typed adjacency: `prerequisite_of`, `part_of`, `related_to`, `contrasts_with`, `commonly_confused_with`. Store this relationally; a graph database is unnecessary through E9.

AI may propose units and edges. Deterministic checks enforce ownership, source-version consistency, acyclic `prerequisite_of` edges, duplicate thresholds, and required provenance.

### 2.3 Practice-content layer

**`generation_requests`** — durable intent to create inventory for a source scope, knowledge unit, probe goal, item type, language, and policy version. It records *why* generation was requested: starter inventory, session shortfall, misconception, coverage gap, or explicit regeneration.

**`item_candidates`** — temporary untrusted model output. Includes generator/model/prompt versions, source version, requested specification, content hash, status, expiry, and rejection reason. TTL: normally 7–30 days. Rejected and unused candidates are disposable.

**`validation_runs`** — append-only validator results. Each stage records validator version, decision, reason codes, confidence, latency, and cost.

**`items`** — stable semantic identity of a published probe. It owns lifecycle only: `active`, `retired`, `superseded`, `quarantined`.

**`item_versions`** — immutable wording, answer shape, rubric, explanation, item type, knowledge-unit target, and publication policy. Historical reviews always reference the exact version shown.

**`item_version_spans`** — exact citations supporting the question, answer, and explanation.

### 2.4 Learning-evidence layer

Avoid one overloaded JSON “event” table. Store explicit immutable facts:

**`review_sessions`** — a deterministic session specification: owner, requested duration/scope, scheduler version, selection policy, status, and server timestamps.

**`review_attempts`** — append-only learner response: session, item version, response, response mode, latency, confidence, client occurrence time, server receipt time, device id, and idempotency key.

**`review_grades`** — append-only grading result referencing an attempt: correctness, normalized score, grade method, rubric/grader version, feedback, and optional superseded grade. Never overwrite the original response.

**`scheduling_events`** — append-only deterministic transition: prior state hash, grade, scheduler/parameter version, next state, and due date.

**`user_item_state`** — hot projection of the latest FSRS state per owner/item: stability, difficulty, due time, last review, repetitions, lapses, state version, and last scheduling event. Rebuildable from snapshots plus events.

**`user_knowledge_state`** — concept-level projection: evidence count, weighted success/failure, coverage, confidence interval, predicted recall aggregate, misconception flags, last evidence, and projection version.

**`mastery_snapshots`** — periodic projection checkpoints used for trends and bounded replay. “Mastery” is a transparent estimate with confidence, never a canonical fact or a single magical score.

---

## 3. Canonical, derived, and cached data

| Class | Data | Lifecycle |
|---|---|---|
| Canonical source | Original source versions and user corrections | Durable until owner deletion/retention action |
| Canonical provenance | Pages, referenced chunks, source spans | Durable while referenced |
| Canonical content | Published item identities and immutable versions | Durable; soft-retire only after use |
| Canonical evidence | Attempts, grades, scheduling events | Append-only; account deletion excepted |
| Durable projection | `user_item_state` | Rebuildable, high-write hot state |
| Derived projection | Knowledge state, mastery, due counts, coverage, readiness | Recomputable and versioned |
| Temporary derivation | Candidates, failed validations, session generation buffers | TTL and purge |
| Cache | Embeddings, summaries, hints, ad hoc explanations, retrieval results | Version-keyed, evictable |
| Operational | Jobs, domain events, AI call ledger | Bounded retention by policy |

Rule: **Deleting a source hides it and retires dependent active items, but does not falsify historical learning evidence. Deleting an account hard-deletes all owner data and storage.**

---

## 4. Complete data lifecycle

### Source lifecycle

```text
created → extracting → processing → ready
                         ├─ failed/retryable
                         └─ quarantined
ready → superseded by a new source_version
ready → archived/deleted
```

Reprocessing creates a new source version. Jobs carry `source_version_id` and content hash; stale work exits without writing.

### Knowledge-unit lifecycle

```text
proposed → grounded → active → superseded/retired
             └─ rejected
```

Source change triggers impact analysis. Unchanged span hashes preserve units; changed spans create new versions or retire affected units.

### Item lifecycle

```text
generation requested
  → candidate generated
  → structural checks
  → source-span resolution
  → grounding/entailment verification
  → answerability and ambiguity checks
  → item-type checks
  → cue/leakage checks
  → semantic duplicate check
  → approved candidate
  → published item version
  → active
  → quarantined / retired / superseded
```

An item version is never edited after being served. Cosmetic corrections create a compatible version that may retain item state; meaning, answer, target-unit, or difficulty-changing corrections create a new item identity and start fresh scheduling state.

### Review lifecycle

1. Server creates a deterministic session manifest from due state and scope.
2. Client may download one session for offline use.
3. Each answer is submitted with an idempotency key.
4. Deterministic answer types grade inside the submit transaction.
5. Free-text attempts are acknowledged immediately and queued for bounded asynchronous grading.
6. A committed grade produces exactly one scheduling event under a row lock.
7. `user_item_state` updates in the same transaction as the scheduling event.
8. Concept/mastery projections update asynchronously and expose `as_of`/`stale_at`.
9. Inventory and coverage rules may request future candidates; they do not block the current answer.

---

## 5. Event-driven architecture

Business events coordinate systems; they do not replace canonical tables.

### Event envelope

Every event has `id`, `type`, `schema_version`, `aggregate_type`, `aggregate_id`, `owner_id`, `owner_kind`, `occurred_at`, `trace_id`, `causation_id`, `correlation_id`, and a size-bounded payload.

### Event transport

- Add a transactional **`domain_events` outbox** for committed business events.
- Keep `jobs` as the work queue. A dispatcher creates idempotent jobs from outbox events and tracks consumer offsets/delivery.
- Existing `outbox_enqueue` is only an alias to job enqueue; it is not a replayable domain outbox and should not be treated as one.
- Delivery is at-least-once. Every consumer has a unique `(consumer, event_id)` receipt or stable job key.
- Events have bounded operational retention after all consumers acknowledge them; canonical evidence stays in its domain tables.

### Core events

- `source.version_ready`
- `knowledge.inventory_requested`
- `knowledge.unit_activated`
- `item.candidate_generated`
- `item.validation_completed`
- `item.published`
- `item.quarantined`
- `review.session_created`
- `review.attempt_received`
- `review.grade_committed`
- `schedule.updated`
- `knowledge.state_updated`
- `inventory.low`
- `coverage.gap_detected`
- `source.version_superseded`
- `policy.version_promoted`

Avoid event storms: a session completion emits one projection/replenishment event, not one fan-out job per statistic.

---

## 6. AI versus deterministic responsibilities

### AI responsibilities

- Propose knowledge units and graph edges from cited spans.
- Generate constrained candidates for a requested unit and probe goal.
- Generate plausible distractors and worked explanations.
- Verify grounding using an independently evaluated model family where required.
- Grade genuinely semantic free-text responses against a fixed rubric.
- Produce cited tutor explanations from retrieved evidence.

### Deterministic responsibilities

- Source hashing, versioning, chunking, ownership, quotas, and provenance checks.
- Candidate schemas and item-type invariants.
- Exact/normalized/set/numeric grading.
- Session inventory selection and due ordering.
- FSRS transitions and due dates.
- Mastery aggregation, coverage, confidence, and readiness calculations.
- Candidate expiry, publication gates, retirement, replay, and idempotency.
- Cost admission control and degraded-mode decisions.

AI output cannot directly write `items`, grades, schedules, mastery, or graph edges. It writes candidates/results; a domain service validates and commits.

### Reduce AI work structurally

Extract and validate a grounded knowledge unit once, then render safe cloze, recall, ordering, and numeric variants deterministically where possible. Use AI for content that cannot be produced from templates. Delay MCQ-heavy generation: recognition is weaker evidence and distractor validation is expensive.

---

## 7. Generation and validation strategy

### Hybrid inventory policy

1. **Bounded prewarm after source readiness:** create 8–15 approved items covering representative high-value units. Set a hard token/cost ceiling and stop once a first short session is ready.
2. **Lazy generation on study intent:** the session planner selects existing approved inventory first, then requests only the shortfall plus a small next-session buffer.
3. **Evidence-driven replenishment:** request variants when inventory is low, coverage is weak, an item is quarantined, recognition and production disagree, or repeated errors indicate a misconception.
4. **No blanket refresh:** regenerate only on source/policy/version impact or observed quality failure.

### Trust gates

- Hard structural and provenance checks must pass 100%.
- The production Item Trust Rate target remains at least 97%, measured from sampled audits, verified reports, and grading overrides—not from schema pass rate.
- Prompt/model/policy promotion requires an offline held-out evaluation set.
- Generator and verifier independence is measured; “different model name” alone is not sufficient.
- Low-confidence candidates expire or enter an admin sample queue; they are never silently published.

---

## 8. E6 adaptive learning, review, mastery, and scheduling

### Scheduler

- Use a maintained FSRS implementation as a pure library.
- Store immutable scheduler parameter versions; start with published defaults.
- No per-user parameter optimisation through E9. Optimise only after enough clean evidence exists.
- AI-estimated difficulty is selection metadata only and never initializes or mutates FSRS.
- Server time determines scheduling. Client occurrence time is retained for analytics but cannot set due dates.
- Two-device conflicts use idempotency keys plus a row lock on `user_item_state`. Duplicate attempts are accepted once.

### Session planner

The deterministic planner balances:

1. overdue reviews,
2. predicted forgetting risk,
3. prerequisite order,
4. source/exam scope,
5. knowledge coverage,
6. item diversity and recent exposure,
7. requested duration,
8. inventory availability.

It selects existing validated items. Generation is a replenishment side effect, never part of the hot selection query.

### Mastery model

Do not equate FSRS item stability with concept mastery. Compute concept state from multiple independent probes using a versioned, explainable evidence model:

- correctness and score,
- response mode (recognition, recall, application, transfer),
- item quality/discrimination weight,
- recency and predicted retention,
- confidence calibration,
- source/knowledge-unit coverage,
- repeated misconception patterns.

Expose a band (`unseen`, `building`, `secure`, `fragile`) plus confidence and evidence count. Readiness is a scoped projection over required units and predicted recall at a target date, not a life prediction or motivational score.

---

## 9. Chat and RAG integration

Create one owner-scoped retrieval service used by tutor chat, explanations, and generation.

### Retrieval pipeline

1. Authorize owner and requested source scope.
2. Classify query intent deterministically where possible.
3. Retrieve using hybrid lexical + vector search over active source versions.
4. Optionally expand through a small number of knowledge edges.
5. Rerank by relevance, source scope, freshness, and provenance quality.
6. Return exact spans with citation IDs.
7. Generate an answer through the governed AI boundary with fenced untrusted text.
8. Require citations for source claims; abstain when evidence is insufficient.

Chat may read due state, knowledge state, and misconceptions to personalize teaching. It may not mark mastery, mutate schedules, or treat ordinary conversation as review evidence. A chat quiz counts only when it creates a formal review session and uses a published item version.

Summaries, hints, and conversational explanations are version-keyed caches. If an explanation becomes part of grading or is saved as canonical study content, publish it as an item-version artifact with provenance.

---

## 10. Queue and worker architecture at one million users

Retain the existing Postgres queue initially, but evolve it into isolated lanes:

| Lane | Work | Priority/SLO |
|---|---|---|
| `ingest_fast` | control, chunking, source impact | high, seconds |
| `ocr` | page/range OCR | bounded by AI budget |
| `embedding` | batch embeddings/re-embedding | throughput-oriented |
| `generation` | units, candidates, explanations | demand-driven, budgeted |
| `validation` | verifier and quality checks | before publication |
| `grading` | semantic free-text grading | user-visible bounded latency |
| `projection` | mastery, coverage, due counters | resumable background |
| `maintenance` | expiry, purge, reconciliation | low priority |

Add priority, owner/routing key, lane, cost estimate, cancellation marker, source/policy version, and heartbeat/lease extension. Claim by lane and priority. Enforce per-owner, per-lane, and global in-flight limits before enqueue.

Run independent worker functions and concurrency budgets per lane. Immediate notification may reduce latency, but cron remains the recovery backstop. Jobs must be small and resumable: page ranges, embedding batches, generation requests, and projection partitions—not whole documents or users.

At sustained scale, partition jobs and append-only evidence tables. If Postgres queue contention or provider throughput exceeds measured thresholds, replace only the transport with a managed broker; preserve event, idempotency, and handler contracts.

---

## 11. Database and physical scaling design

### Ownership and RLS

- New E5–E9 tables use `owner_id` + `owner_kind` consistently.
- Private user material is never globally deduplicated or shared by default.
- Cross-user reuse is limited to explicitly licensed/public corpora through a separate catalog and grant model.
- Client roles can read owned published/projection data and create narrowly validated commands/attempts. Pipeline tables, validation, grades, scheduling, and projections are service-write-only.

### Indexing

- All hot tables begin with the routing/owner key in indexes.
- Due query: `(owner_id, due_at, state)` partial on active states.
- Session/attempt history: `(owner_id, server_received_at desc)` and unique idempotency key.
- Item inventory: `(owner_id, knowledge_unit_id, lifecycle, item_type)`.
- Provenance: source-version and span indexes.
- Append-only attempts, grades, scheduling events, domain events, and AI calls are time-partitioned once volume requires it.

### Vector scale

The current single global HNSW index plus owner filter will degrade at large tenant counts. E5 should always narrow by owner and source scope before vector ranking. Add an owner-hash routing key and partition vector-bearing chunks when measured corpus size warrants it. The control-plane schema remains shard-ready: IDs are globally unique, all domain rows carry owner/routing keys, and APIs do not expose database location.

One Postgres instance is not assumed to hold hundreds of millions of hot vectors and billions of review facts indefinitely. Scale in gates:

1. vertical database + bounded per-user corpus,
2. owner-hash partitions and cold-source archival,
3. separate retrieval shards/vector plane,
4. database shards routed by owner for the largest cohorts.

Object storage holds original files and cold immutable exports. The relational database holds metadata, hot source text, provenance, items, and learning state.

---

## 12. APIs and command boundaries

Logical versioned endpoints; all mutating calls require auth/guest ownership, trace ID, idempotency key, schema validation, and rate/cost admission:

- `POST /v1/sources/preflight`
- `POST /v1/sources`
- `POST /v1/sources/{id}/process`
- `POST /v1/sources/{id}/versions`
- `DELETE /v1/sources/{id}`
- `GET /v1/sources/{id}/status`
- `POST /v1/inventory/prepare` — request bounded starter/session inventory
- `GET /v1/knowledge/units?source_id=`
- `POST /v1/review/sessions` — deterministic manifest or explicit `preparing` status
- `GET /v1/review/sessions/{id}`
- `POST /v1/review/attempts` — fast durable acknowledgement
- `POST /v1/review/sync` — ordered offline batch with per-attempt results
- `GET /v1/review/due-summary` — incremental projection, no scan
- `GET /v1/mastery?scope=` — projection with version and `as_of`
- `POST /v1/tutor/query` — streamed cited answer
- `POST /v1/items/{id}/report`

Never expose direct generic CRUD for system-owned learning tables. Responses use stable error codes (`unauthorized`, `forbidden`, `conflict`, `stale_version`, `inventory_preparing`, `grading_pending`, `quota_exceeded`, `degraded`, `internal`) and never raw provider/database errors.

---

## 13. Security and privacy

- RLS and explicit GRANTs on every public table; automated cross-tenant policy tests.
- Service validation of source size, MIME, ownership, version, and cost before paid work.
- User documents are untrusted prompt input: fenced, size-bounded, no tool authority, no instruction execution.
- Structured AI outputs only for generation, graph proposals, validation, and grading.
- Exact source citations and policy versions make every published item auditable.
- Admin inspection defaults to metadata and cited spans; full-content access is time-bound and written to `admin_access_log`.
- Encryption in transit/at rest, short signed storage URLs, owner-prefixed paths, and no private-content training or cross-user reuse.
- Per-IP, per-owner, per-lane, and global cost limits fail closed.
- Account export includes sources, published items, and learning evidence; deletion removes storage, canonical rows, projections, and queued work.
- Define minors/education privacy policy before school deployment; architecture supports age/consent status without exposing it to AI prompts.

---

## 14. Cost and capacity model

Control unit economics rather than trusting one forecast.

Track per owner and globally:

- OCR pages,
- embedded tokens,
- candidate input/output tokens,
- candidates per published item,
- verifier calls per publication,
- published items per active reviewer,
- percent of published items ever reviewed,
- semantic grading calls,
- cache hit rate,
- cost per completed review and per weekly active reviewer.

The earlier repository model estimates eager generation at roughly five times lazy generation. A separate cohort model shows full M5.1 generation could require tens of millions of calls and hundreds of thousands of dollars for a million-user corpus. The target architecture removes cost before scaling infrastructure:

- hard starter cap,
- deterministic rendering from validated units,
- existing-item reuse within the same owner/source version,
- lazy replenishment,
- no time-based blanket regeneration,
- candidate TTL,
- cheapest model that passes the harness,
- fleet budget circuit breakers.

At 70% of daily AI budget warn; at 85% pause prewarm/background generation; at 100% pause generation and chat while keeping review, deterministic grading, scheduling, and mastery projections online.

---

## 15. Versioning and regeneration

Every derived artifact records:

- source version/content hash,
- extraction/OCR/chunk policy,
- embedding model/version,
- knowledge-unit derivation policy,
- generator model/prompt/schema version,
- validation policy and validator versions,
- item-renderer version,
- grader/rubric version,
- scheduler algorithm and parameter version,
- mastery projection version.

Promotion of a new policy creates an impact set; it does not trigger global regeneration. Reprocess active or requested scopes first. Preserve old item versions and grades. Re-embedding is an online job with dual-read/dual-index cutover, never a blocking schema migration.

---

## 16. E5–E9 delivery architecture

### E5 — Trusted Knowledge Substrate

- Source versioning and impact model.
- Grounded knowledge units and source spans.
- Generation requests, temporary candidates, validation pipeline, immutable published item versions.
- Bounded starter inventory and lazy replenishment.
- Evaluation harness and production trust instrumentation before learner exposure.

**Exit gate:** first session has approved cited items; no raw candidate is queryable by the client; generation cost is bounded per source.

### E6 — Adaptive Review Engine

- Frozen item taxonomy and deterministic graders.
- Review sessions, attempts, grades, scheduling events.
- Versioned FSRS library and `user_item_state` sole-writer transaction.
- Deterministic session planner, due projection, concept-state projection.
- Async free-text grading with timeout/fallback; AI outage test.

**Exit gate:** event replay reproduces scheduling state; duplicate/offline submissions do not double-schedule; review stays available with AI disabled.

### E7 — Knowledge Graph and Encoding

- User-scoped knowledge graph, prerequisite and misconception relationships.
- Encoding activities that establish understanding before difficult retrieval where appropriate.
- Coverage analysis and probe-goal selection.
- Source-change impact propagation across units/items.

**Exit gate:** graph edges are grounded/versioned; no AI edge directly changes scheduler state; coverage gaps produce bounded inventory requests.

### E8 — Grounded Tutor and Readiness

- Unified owner-scoped hybrid retrieval service.
- Cited tutor chat and item explanations.
- Scoped readiness and misconception views based only on learning evidence.
- Tutor can launch formal review but cannot manufacture mastery from conversation.

**Exit gate:** citation/abstention evaluation passes; readiness is reproducible from versioned evidence; private content never crosses owners.

### E9 — Offline, Scale, and Production Learning Loop

- Offline one-session manifest and ordered idempotent sync.
- Conflict handling for retired/superseded items and two-device races.
- Queue lanes, priority, backpressure, automated SLO/cost alerts.
- Evidence partitioning, projection snapshots, restore/replay drills, load and security tests.
- Review-first application shell; legacy productivity surfaces no longer obstruct the core loop.

**Exit gate:** production load model passes, recovery meets RPO/RTO, review p95 and sync targets hold, and no AI/provider failure can lose an attempt.

---

## 17. Migration from the current implementation

### Phase A — Stop architecture drift

1. Do not deploy M5.1 as the learner-facing model.
2. Stop `embed` from enqueueing unconditional full-document generation.
3. If `study_items` exists in any environment, quarantine it as legacy; do not attach review history to it.
4. Record the live/repository migration divergence and make deployment verification a release gate.

### Phase B — Expand

1. Add source-version compatibility beside current `documents`/pages/chunks; backfill each current document as version 1.
2. Add knowledge-unit, candidate, validation, item/version/provenance, review, scheduling, and projection tables with owner-scoped RLS and grants.
3. Add domain outbox and queue lane metadata.
4. Keep current Library and ingestion reads working through compatibility views/adapters.

### Phase C — Migrate behavior

1. Route source readiness to bounded unit extraction and starter inventory.
2. Route generation into candidates, then validators, then publication.
3. Ship review on published item versions only.
4. Move due/mastery/tutor reads to projections and the unified retrieval service.
5. Reclassify any existing `study_items` as candidates; publish only after current validation. Delete unused legacy rows after TTL.

### Phase D — Contract

1. Remove `generation_status` and legacy direct-generation code after all environments are migrated.
2. Remove client write grants to pipeline-owned source fields/chunks.
3. Retire compatibility columns/tables one release after readers are gone.
4. Snapshot before destructive cleanup; never delete learning evidence as part of source cleanup.

---

## 18. Architecture-level acceptance criteria

- **Trust:** ≥97% production Item Trust Rate; 100% published items have valid source spans and version metadata.
- **Correctness:** scheduler replay is deterministic; one grade creates at most one scheduling transition.
- **Durability:** acknowledged attempts are never lost; projections are rebuildable.
- **Latency:** attempt acknowledgement p95 <300 ms for deterministic grading; due summary p95 <200 ms; starter session availability has a defined bounded SLO.
- **Resilience:** review and deterministic grading work with all AI providers disabled.
- **Isolation:** automated tests prove no cross-owner source, item, review, mastery, cache, vector, or storage access.
- **Cost:** hard per-source, per-owner, lane, and fleet budgets; review is never throttled for AI spend.
- **Scale:** no request-path full-history replay, full due scan, full-document generation, or cross-tenant vector scan.
- **Auditability:** every answer, grade, item version, source span, AI call, and scheduling transition is traceable by version and trace ID.
- **Maintainability:** domain contracts are versioned and shared; direct provider calls outside the AI boundary and direct client writes to system-owned tables fail CI.

## Final verdict

The long-term architecture should not preserve M5.1’s eager `study_items` pipeline. Retain E2, E3, and the useful E4 substrate, then build E5–E9 around **versioned source truth, grounded knowledge units, temporary candidates, validated immutable item versions, append-only learning evidence, deterministic FSRS, and asynchronous mastery projections**.

This design remains simple enough to build incrementally with one engineer, while creating the boundaries required to scale to one million users without speculative AI spend, contaminated evidence, or a future rewrite of the core learning model.