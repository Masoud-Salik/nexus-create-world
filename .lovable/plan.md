# StudyTime — Implementation Blueprint (1 engineer)

Blueprint v2 and Architecture v1 are final. Ambiguities are resolved with the smallest decision that preserves the architecture; each is marked **[D]**. With one engineer, **E1–E9 is the committed line (~48 weeks)**; E10–E16 are specified at epic level and scheduled as forecast.

**Standing decisions [D]:** runtime stays Supabase edge + Postgres · client-side pdf.js extraction/rasterisation, server vision-OCR only for low-confidence pages · embeddings 1536-dim, HNSW, `embedding_model`/`embedding_version` stored per chunk · items private per owner · FSRS published defaults, versioned params, no per-user tuning · all migrations expand → migrate → contract · scheduler is a pure library, `review` is the only writer of `user_item_state`.

---

# 1. Epic specifications

### E1 — Data & Security Foundations
- **Objective:** every table owner-scoped, RLS/GRANT correct, indexed; anonymous identity; export/delete; observability base.
- **Deliverables:** owner-scoping migrations; `anon_sessions`; account export + delete; per-table RLS test suite; trace-id logging; four SLO dashboards.
- **Files/modules:** `supabase/migrations/*`, `supabase/functions/_shared/{auth,logging,errors,owner}.ts`, `supabase/functions/account/`, `src/core/api/`, `tests/rls/`.
- **Migrations:** M1–M8 (§6).
- **APIs:** `POST /v1/anon/session`, `POST /v1/account/export`, `DELETE /v1/account`.
- **Edge functions:** `account`, `anon`.
- **Jobs:** `anon-session-gc` (hourly), `export-builder`.
- **Events:** `account.export_requested`, `account.deleted`, `anon.claimed`.
- **Deps:** none.
- **Testing:** RLS policy test per table (select/insert/update/delete as anon, other-user, owner, service); export/delete integration; index EXPLAIN assertions.
- **Rollout:** migrations only, no UI change; deploy behind no flag.
- **Rollback:** expand-only — new columns nullable, no drops; revert edge functions.
- **Acceptance:** 0 tables without owner + RLS; RLS suite green; p95 < 50 ms on the 10 hottest queries; every request carries a trace id.

### E2 — Job Queue & Worker
- **Objective:** durable async execution with retries, leases, dead-letter.
- **Deliverables:** `jobs` table, claim function, worker edge function, pg_cron drain, transactional outbox helper, admin queue view.
- **Files:** `supabase/functions/worker/`, `_shared/queue.ts`, `_shared/outbox.ts`.
- **Migrations:** M9–M10.
- **APIs:** none public; `GET /v1/admin/queue` (admin).
- **Jobs:** `queue-drain` (every minute, cron).
- **Events:** `job.failed`, `job.dead_lettered`.
- **Deps:** E1.
- **Testing:** concurrency test (two drains, no double-processing), retry/backoff, poison-message → DLQ, idempotent handler contract test.
- **Rollout:** no consumers yet.
- **Rollback:** disable cron; table inert.
- **Acceptance:** 10k jobs drained, <0.1% permanent failure, zero double-processing under 5 concurrent drains.

### E3 — AI Services Layer
- **Objective:** one governed model boundary: routing, prompt versions, schema guard, cost, limits, tracing, injection defence, entitlements.
- **Deliverables:** `_shared/ai/` (task registry, router, schema guard, cache, cost meter, rate limiter, tracer, redactor), `ai_calls` table, injection corpus in CI, cost SLO dashboard.
- **Migrations:** M11–M12.
- **APIs:** internal only.
- **Jobs:** `ai-cost-rollup` (nightly).
- **Events:** `ai.call`, `ai.limit_exceeded`.
- **Deps:** E1, E2.
- **Testing:** schema-guard rejection tests; rate-limit and cost-ceiling tests (fail closed); injection corpus (≥50 cases) must show zero instruction-following; provider-outage fallback.
- **Rollout:** migrate the existing `chat` function onto the layer last.
- **Rollback:** keep the legacy call path for `chat` for one release.
- **Acceptance:** 100% of model calls traced with model, prompt version, tokens, cost; injection corpus green; ceilings fail closed.

### E4 — Ingestion & OCR
- **Objective:** PDF/image/text → anchored chunks with a published quality score.
- **Deliverables:** upload flow, client pdf.js extractor/rasteriser worker, page/chunk pipeline jobs, vision-OCR escalation, quality scorer, `/app/library`, ingestion status UI.
- **Files:** `src/features/ingestion/`, `src/workers/pdf.worker.ts`, `supabase/functions/ingest/`, `supabase/functions/worker/handlers/{parse,ocr,chunk,embed}.ts`.
- **Migrations:** M13–M16.
- **APIs:** `POST /v1/sources`, `POST /v1/sources/:id/pages`, `GET /v1/sources`, `GET /v1/sources/:id`, `DELETE /v1/sources/:id`.
- **Jobs:** `ocr-page`, `chunk-source`, `embed-chunks`.
- **Events:** `source.uploaded`, `source.ready`, `source.failed`, `page.needs_review`.
- **Deps:** E2, E3.
- **Testing:** corpus regression (20 digital PDFs, 20 scans, 10 photos, 5 math-heavy) with per-corpus accuracy thresholds; anchor round-trip (chunk → page → highlight); malformed/encrypted/huge file handling.
- **Rollout:** flag `ingestion_v1`; internal only for two weeks.
- **Rollback:** flag off hides `/app/library`; tables retained.
- **Acceptance:** ≥95% char accuracy digital, ≥85% scans; 20-page doc ready in <60 s median; every chunk resolves to `(page, start, end)`.

### E5 — Item Generation
- **Objective:** cited candidates in four frozen types.
- **Deliverables:** type planner, generator prompts (versioned), answer-key builder, citation binder, `item_candidates`.
- **Files:** `supabase/functions/worker/handlers/generate.ts`, `_shared/items/schema.ts`.
- **Migrations:** M17.
- **APIs:** `POST /v1/sources/:id/generate`, `GET /v1/sources/:id/items`.
- **Jobs:** `generate-items` (keyed `(source_id, chunk_hash, prompt_version, type)`).
- **Events:** `items.generated`.
- **Deps:** E4.
- **Testing:** schema conformance 100%; citation resolvability 100%; determinism of the job key (re-run creates no duplicates).
- **Rollout:** admin-only trigger first.
- **Rollback:** flag off; candidates never surface to users without E6.
- **Acceptance:** ≥20 candidates per 10 pages; zero unresolvable citations.

### E6 — Validation Pipeline & Eval Harness
- **Objective:** enforce the trust guardrail.
- **Deliverables:** static checks, dup detector, verifier (different model family), critic, aggregator, quarantine + reason codes, gold sets, nightly harness, prompt-promotion gate, admin review UI, user report intake.
- **Files:** `supabase/functions/worker/handlers/validate.ts`, `_shared/items/checks/`, `src/features/admin/`.
- **Migrations:** M18–M20.
- **APIs:** `POST /v1/items/:id/report`, `GET/POST /v1/admin/quarantine`, `POST /v1/admin/prompts/:id/promote`, `GET /v1/admin/trust`.
- **Jobs:** `validate-batch`, `eval-harness` (nightly), `trust-rollup`.
- **Events:** `items.published`, `items.quarantined`, `prompt.promoted`.
- **Deps:** E5, E3.
- **Testing:** gold-set precision/recall; verifier-independence measurement; leakage and duplicate unit tests; harness reproducibility.
- **Rollout:** no item reaches a user before the harness reports on the gold set.
- **Rollback:** raise the publish threshold to 1.0 (publishes nothing) — a config change, not a deploy.
- **Acceptance:** `trust_offline` ≥97% on held-out gold; verifier disagreement always quarantines; promotion impossible without a harness run.

### E7 — FSRS Scheduler
- **Objective:** deterministic scheduling, load caps, debt forgiveness, leeches.
- **Deliverables:** `packages/scheduler` pure library, `scheduler_params`, projection function.
- **Files:** `src/core/scheduler/` (shared with edge via `_shared/scheduler/`).
- **Migrations:** M21–M22.
- **APIs:** `GET /v1/schedule/due`, `GET /v1/schedule/projection`.
- **Jobs:** `nightly-projection`, `due-count-refresh`.
- **Events:** `schedule.updated`.
- **Deps:** E1.
- **Testing:** property tests (monotonic intervals, no negative due, replay determinism), 90-day cohort simulation showing no debt spiral, params-version replay equality.
- **Rollout:** library only, no UI.
- **Rollback:** n/a (pure).
- **Acceptance:** identical inputs → identical outputs across runs and machines; simulation passes.

### E8 — Grading Engine
- **Objective:** deterministic-first grading with rubric fallback and calibration.
- **Deliverables:** normalizer, exact/numeric matchers with unit and tolerance handling, rubric grader, calibration scorer, override intake.
- **Files:** `src/core/grading/`, `_shared/grading/`, `supabase/functions/grade/`.
- **Migrations:** M23.
- **APIs:** `POST /v1/reviews/:eventId/grade` (internal/async), `POST /v1/reviews/:eventId/override`.
- **Jobs:** `grade-freetext`.
- **Events:** `grade.assigned`, `grade.overridden`.
- **Deps:** E3, E7.
- **Testing:** grading gold set ≥95% human agreement; numeric tolerance table tests; override→quarantine loop test.
- **Rollout:** deterministic types first; free-text behind a flag.
- **Rollback:** flag disables free-text items from the queue.
- **Acceptance:** ≥95% agreement; override rate <5%; every override above threshold quarantines the item.

### E9 — Review Experience (offline-capable)
- **Objective:** the core loop, fast and offline-safe.
- **Deliverables:** `/app/today`, `/app/review/:id`, session store, IndexedDB cache, outbox with idempotency keys, two-phase submit, sync UI, degraded (no-AI) mode.
- **Files:** `src/features/review/`, `src/core/offline/`, `supabase/functions/review/`.
- **Migrations:** M24–M26.
- **APIs:** `POST /v1/sessions`, `POST /v1/sessions/:id/answers`, `POST /v1/sessions/:id/finish`, `GET /v1/sessions/:id`.
- **Jobs:** `mastery-rollup` (async, after commit), `snapshot-item-state` (weekly).
- **Events:** `review.committed`, `session.finished`.
- **Deps:** E6, E7, E8, and the frontend shell refactor (moved here from E15).
- **Testing:** offline simulation (airplane → 30 answers → reconnect, zero loss); duplicate-submit idempotency; two-device race; clock-skew clamping; p95 load test.
- **Rollout:** flag `review_v1`, internal → 10% → all.
- **Rollback:** flag off restores the previous home; review data retained.
- **Acceptance:** p95 submit <300 ms server-side; zero data loss in offline suite; median session <6 min; full function with the AI provider down.

### E10–E16 (forecast, epic level)
- **E10 90-Second Proof** — anon session (E1) + ingest + generate + 5-item review; abuse controls (G2) mandatory. Acceptance: ≥40% proof→signup.
- **E11 Knowledge Model & Encoding** — concepts (user-scoped), edges, binder, async mastery rollups, cached encoding cards. Acceptance: encoding exposure reduces subsequent lapse rate.
- **E12 Readiness & Exams** — exam scope, coverage, deterministic projection, derived daily plan. Acceptance: predicted vs actual within ±10 pts.
- **E13 Grounded Tutor** — migrate `chat` to source-grounded RAG, no schedule write authority. Acceptance: ≥90% answers cite a user source; zero schedule mutations.
- **E14 Analytics & North Star** — versioned retention definition, WAR, trust dashboards. Acceptance: rollups reproducible from the ledger, <5 min nightly.
- **E15 Scope Cut** — delete cut features and tables (Phase 4). Acceptance: no dead tables, no orphan routes.
- **E16 Scale & Cost Hardening** — partitioning, materialised rollups, ceilings, 10× load test.

---

# 2. Engineering backlog (Epic → Milestone → Feature → Task)

Tasks are sized under one engineer-day. E1–E9 in full; later epics listed at feature level.

**E1**
- M1.1 Owner scoping — F: audit → T: enumerate all 38 tables into `docs/schema-audit.md`; T: classify owner-scoped vs system; T: write M1 add-column migration; T: backfill script; T: NOT NULL contract migration; T: composite indexes per hot query (one task per 6 tables).
- M1.2 RLS correctness — F: policies → T: policy template + helper; T: rewrite policies (one task per 6 tables); T: GRANT audit; T: `tests/rls/` harness; T: write tests (one task per 6 tables).
- M1.3 Anonymous identity — T: `anon_sessions` migration; T: `owner_id` union resolution helper; T: `POST /v1/anon/session`; T: claim-on-signup transaction; T: GC job; T: tests.
- M1.4 Export & delete — T: export job handler; T: signed download; T: cascade contract table in docs; T: delete endpoint + cascades; T: tests.
- M1.5 Observability — T: trace-id middleware; T: structured logger; T: error envelope; T: four SLO queries; T: dashboard views.

**E2** — M2.1 queue schema + claim fn (T: migration; T: `claim_jobs` SQL fn with SKIP LOCKED + lease; T: enqueue helper; T: outbox helper). M2.2 worker (T: handler registry; T: drain loop; T: backoff; T: DLQ; T: cron install via insert tool). M2.3 ops (T: admin queue view; T: concurrency test; T: poison test; T: load test 10k).

**E3** — M3.1 core (T: task registry types; T: router; T: zod schema guard; T: retry/fallback). M3.2 governance (T: `ai_calls` migration; T: cost meter; T: three-layer rate limiter; T: entitlement stub; T: cache by input hash). M3.3 safety (T: redactor; T: untrusted-context wrapper; T: build injection corpus; T: CI job). M3.4 migration (T: move `chat` onto the layer; T: delete `nexus_perf_logs` writes).

**E4** — M4.1 storage & upload (T: bucket policy; T: signed upload; T: server-side type/size validation; T: `sources` migration). M4.2 client extraction (T: pdf.js worker scaffold; T: text-layer extract; T: page raster; T: confidence heuristic; T: upload page payloads). M4.3 OCR (T: `source_pages` migration; T: vision-OCR handler; T: escalation policy; T: `needs_review` gating; T: region classifier). M4.4 chunking (T: `source_chunks` migration; T: chunker with anchors; T: dedupe; T: embed handler; T: HNSW index). M4.5 UI (T: library list; T: upload dropzone; T: status/progress; T: source detail with page viewer; T: quality badge; T: delete flow). M4.6 quality (T: assemble corpus; T: scoring script; T: regression CI).

**E5** — M5.1 taxonomy (T: freeze item union schema; T: answer-key shapes; T: docs). M5.2 generation (T: chunk selector; T: type planner; T: generator prompt v1; T: answer-key builder; T: citation binder; T: job key + upsert). M5.3 surface (T: candidates admin list; T: generate endpoint).

**E6** — M6.1 static (T: leakage check; T: length/format checks; T: dangling-reference check; T: dup detector via embeddings). M6.2 model checks (T: verifier prompt + different family; T: critic prompt; T: aggregator + thresholds; T: quarantine reason codes). M6.3 harness (T: gold-set schema + seed 200 items; T: held-out slice; T: nightly harness job; T: metrics tables; T: promotion gate). M6.4 human loop (T: quarantine review UI; T: user report endpoint + UI; T: report → quarantine wiring; T: SLA/auto-expire job). M6.5 trust metrics (T: `trust_offline` rollup; T: `trust_production` sampling; T: dashboard).

**E7** — M7.1 core (T: FSRS state types; T: update fn; T: interval fn; T: params table + versioning). M7.2 governance (T: load governor; T: debt forgiveness; T: leech policy; T: new-item introduction rate). M7.3 projection (T: retention projection fn; T: nightly projection job; T: `due_count` incremental maintenance). M7.4 tests (T: property tests; T: replay determinism; T: 90-day simulation harness).

**E8** — M8.1 deterministic (T: normalizer; T: exact matcher; T: numeric comparator with units/tolerance; T: cloze matcher). M8.2 model grading (T: rubric prompt; T: async grade job; T: timeout + fallback grade). M8.3 calibration & overrides (T: confidence capture contract; T: calibration delta; T: override endpoint; T: threshold → quarantine). M8.4 tests (T: grading gold set 200 items; T: agreement measurement; T: tolerance table tests).

**E9** — M9.1 shell refactor (T: `AppShell`/`FocusLayout`; T: three-item nav; T: module folder migration; T: cross-module import lint rule; T: dissolve `Index.tsx`; T: dissolve `StudyCoach.tsx` — 3 tasks). M9.2 session backend (T: `review_sessions`/`review_events` migrations; T: queue builder; T: start endpoint; T: submit with row lock + idempotency; T: finish endpoint; T: async mastery enqueue). M9.3 session UI (T: today screen; T: item renderers ×4; T: confidence capture; T: feedback state; T: debrief). M9.4 offline (T: IndexedDB schema; T: prefetch; T: outbox; T: flush on reconnect; T: pending/failed UI; T: SW background sync; T: OAuth denylist check). M9.5 hardening (T: snapshot job; T: capped replay; T: clock clamp; T: load test; T: degraded-mode test).

**E10–E16** feature-level: anon proof flow · abuse controls · concepts+binder · mastery rollups · encoding cards · exams+coverage+projection UI · tutor RAG migration · retention metric+dashboards · deprecation notices+drops+cold snapshot · partitioning+materialised views+10× load test.

---

# 3. Implementation order (weeks, 1 engineer)

| Weeks | Work |
|---|---|
| 1–4 | E1 (schema audit, owner scoping, RLS suite, anon identity, export/delete, observability) |
| 5–6 | E2 queue + worker + cron |
| 7–9 | E3 AI services, governance, injection corpus, `chat` migration |
| 10–17 | E4 ingestion & OCR (10–11 storage/upload, 12–13 client extraction, 14 OCR escalation, 15 chunk+embed, 16 library UI, 17 corpus + tuning) |
| 18–20 | E5 item generation |
| 21–27 | E6 validation + gold sets + harness + admin review (longest quality investment; do not compress) |
| 28–30 | E7 scheduler + simulation |
| 31–34 | E8 grading + gold set |
| 35–36 | E9 M9.1 shell refactor (before the review build) |
| 37–42 | E9 M9.2–M9.4 session backend, UI, offline |
| 43–45 | E9 M9.5 hardening, load test, staged rollout |
| 46–48 | Buffer, bug burn-down, launch readiness review |
| 49+ | E10 → E11 → E12 → E13 → E14 → E15 → E16 (forecast, re-scoped quarterly) |

Dependencies respected: E2 before E4; E3 before E5; E6 before any item reaches a user; E7+E8 before E9; shell refactor before the review UI.

---

# 4. Repository architecture

```
src/
  core/
    api/            client, error envelope, zod contracts re-export
    auth/           session, owner resolution, guards
    offline/        indexeddb, outbox, sync, service-worker registration
    scheduler/      re-export of packages/scheduler for the client
    grading/        deterministic matchers shared with edge
    telemetry/      trace ids, event reporting
    ui/             design tokens, primitives, layouts
  features/
    ingestion/      components hooks api types
    library/
    review/         session store, item renderers, debrief
    knowledge/
    readiness/
    tutor/
    admin/
    account/
  workers/          pdf.worker.ts, ocr-preprocess.worker.ts
  routes/           route table, AppShell, FocusLayout, MarketingLayout
packages/
  contracts/        zod schemas + generated types (single source of truth)
  scheduler/        pure FSRS library (no I/O)
  items/            item type union, answer-key schemas, validators
supabase/
  functions/
    _shared/        auth, logging, errors, queue, outbox, ai/, scheduler/, grading/, items/
    anon/ account/ ingest/ items/ review/ grade/ schedule/ readiness/ chat/ admin/ worker/
  migrations/
tests/
  unit/ integration/ property/ rls/ offline/ queue/ perf/ security/ corpus/ gold/
docs/
  architecture/ runbooks/ decisions/ schema-audit.md metrics.md
```

---

# 5. API specification

Conventions: all under `/v1`; JSON; bearer JWT unless noted; `Idempotency-Key` header required on every POST that mutates learning state; errors use `{code, message, trace_id}` with codes `unauthorized|forbidden|not_found|validation_failed|conflict|rate_limited|quota_exceeded|internal`; limits are per identity and per IP, failing closed.

| Method · Path | Request | Response | Auth | Errors | Idem | Limit |
|---|---|---|---|---|---|---|
| POST /anon/session | `{}` | `{token, expires_at}` | none | rate_limited | no | 5/h/IP |
| POST /account/export | `{}` | `{job_id}` | user | conflict | yes | 1/day |
| DELETE /account | `{confirm:true}` | `204` | user | validation | yes | 2/day |
| POST /sources | `{name, mime, size, subject_id?}` | `{source_id, upload_url}` | user\|anon | validation, quota | yes | 20/day user, 2/day anon |
| POST /sources/:id/pages | `{pages:[{index,text?,image_ref?,confidence}]}` | `{accepted}` | owner | conflict, validation | yes | — |
| GET /sources | `?cursor` | `{items[],next}` | owner | — | — | 60/min |
| GET /sources/:id | — | `{source, pages_summary, quality}` | owner | not_found | — | 60/min |
| DELETE /sources/:id | — | `204` | owner | not_found | yes | 30/day |
| POST /sources/:id/generate | `{types[], target_count}` | `{job_id}` | owner | quota, conflict | yes | 10/day |
| GET /sources/:id/items | `?status` | `{items[]}` | owner | — | — | 60/min |
| POST /items/:id/report | `{reason, note?}` | `{report_id}` | owner | not_found | yes | 50/day |
| GET /schedule/due | `?limit` | `{due_count, items[]}` | user | — | — | 120/min |
| GET /schedule/projection | `?exam_id` | `{projection[]}` | user | not_found | — | 30/min |
| POST /sessions | `{budget_minutes, scope?}` | `{session_id, queue[]}` | user\|anon | quota | yes | 30/day |
| POST /sessions/:id/answers | `{item_id, response, confidence, client_ts, idem_key}` | `{event_id, grade?, status}` | owner | conflict, not_found | yes (unique) | 600/h |
| POST /sessions/:id/finish | `{}` | `{summary}` | owner | conflict | yes | — |
| POST /reviews/:eventId/override | `{claim:"correct"}` | `{ok}` | owner | not_found | yes | 100/day |
| GET/POST /exams, /exams/:id | scope + date | readiness payload | user | validation | yes | 60/min |
| POST /chat | `{conversation_id?, message}` | SSE stream | user | rate_limited, quota | no | 60/h |
| GET /admin/quarantine, POST /admin/quarantine/:id, POST /admin/prompts/:id/promote, GET /admin/trust, GET /admin/queue | — | — | admin role | forbidden | yes | 120/min |

---

# 6. Database migrations (expand → migrate → contract)

| # | Migration |
|---|---|
| M1 | Add nullable `owner_id uuid` + `owner_kind text` to all user-scoped tables (expand) |
| M2 | Backfill `owner_id` from `user_id`; verification query |
| M3 | Composite indexes `(owner_id, created_at)` and per-table hot-path indexes |
| M4 | Enable RLS where missing; replace policies with the owner template; explicit GRANTs |
| M5 | `anon_sessions(id, token_hash, created_at, expires_at)` + GRANT + RLS |
| M6 | Set `owner_id NOT NULL` (contract, after backfill verified) |
| M7 | `account_exports(id, owner_id, status, file_path)` |
| M8 | Audit table `admin_access_log` (append-only, no client grants) |
| M9 | `jobs(id, kind, key unique, payload, status, attempts, lease_until, next_run_at, last_error)` + partial indexes |
| M10 | `claim_jobs(kind, n)` SQL function using FOR UPDATE SKIP LOCKED; `outbox_enqueue` helper |
| M11 | `ai_calls(id, owner_id, task, model, prompt_version, tokens_in/out, cost, latency_ms, trace_id, created_at)` partitioned monthly |
| M12 | `ai_quotas(owner_id, window, used, ceiling)`; deprecate writes to `nexus_perf_logs` |
| M13 | `sources(id, owner_id, owner_kind, name, mime, status, quality_score, subject_id null, version, created_at)` |
| M14 | `source_pages(id, source_id, index, text, ocr_confidence, needs_review, region_map jsonb)` |
| M15 | `source_chunks(id, source_id, page_id, char_start, char_end, content, embedding vector(1536), embedding_model, embedding_version)` |
| M16 | HNSW index on `source_chunks.embedding` scoped by `owner_id`; content-hash unique |
| M17 | `item_candidates(id, source_id, owner_id, type, stem, answer jsonb, rubric jsonb, citation_chunk_id, est_difficulty, prompt_version, job_key unique)` |
| M18 | `items(id, owner_id, candidate_id, concept_id null, type, stem, answer, rubric, citation_chunk_id, status, published_at)` |
| M19 | `item_quarantine(id, candidate_id, reason_code, detail, created_at, resolved_at)`; `item_reports` |
| M20 | `gold_items`, `eval_runs`, `eval_results`, `trust_metrics_daily` |
| M21 | `scheduler_params(id, version, params jsonb, active bool)` seeded with FSRS defaults |
| M22 | `user_item_state(owner_id, item_id, stability, difficulty, due_at, lapses, reps, last_grade, params_version, snapshot_event_id)` PK `(owner_id,item_id)`; index `(owner_id, due_at)` |
| M23 | `grading_gold`, `grade_overrides` |
| M24 | `review_sessions(id, owner_id, started_at, finished_at, budget_minutes)` |
| M25 | `review_events(id, session_id, owner_id, item_id, response, confidence, latency_ms, grade, client_ts, server_received_at, idem_key unique)` append-only, no UPDATE/DELETE grants |
| M26 | `due_counts(owner_id, due_at_day, count)` maintained incrementally; `user_item_state_snapshots` |
| M27+ | (E11–E16) `concepts`, `concept_edges`, `user_concept_mastery`, `encoding_cards`, `exams`, `evidence_events` (partitioned), `metric_rollups_daily`, then Phase-4 drops after cold-storage snapshot |

Every `CREATE TABLE` in `public` is followed in the same migration by GRANTs, then `ENABLE ROW LEVEL SECURITY`, then policies. No drops until at least one release after the replacement ships.

---

# 7. Testing strategy

| Type | Scope | Epics |
|---|---|---|
| Unit | matchers, normalizers, chunker, checks, FSRS math | E4–E8 |
| Property | FSRS monotonicity, replay determinism, interval bounds | E7 |
| Integration | ingest→chunk→generate→validate→review end to end | E4–E9 |
| RLS | per-table matrix (anon/other/owner/service × CRUD) | E1, every migration |
| Offline sync | airplane sessions, duplicate submits, clock skew, retired items, outbox failure | E9 |
| Queue | concurrency, lease expiry, retries, DLQ, idempotency | E2 |
| Performance | submit p95 <300 ms, due list <100 ms, 10k-job drain, 10× load | E2, E7, E9, E16 |
| Security | injection corpus, upload validation, rate/cost ceilings fail closed, admin audit | E3, E4, E6 |
| OCR corpus | 55-document regression with per-class accuracy thresholds | E4 |
| Gold-set eval | item precision, verifier independence, grading agreement; gates prompt promotion | E6, E8 |

CI gates: RLS suite, injection corpus, property tests, and the OCR/gold regressions must pass before merge.

---

# 8. Operational runbooks (`docs/runbooks/`)

- **Deployment** — migration first (expand only), then edge functions, then frontend; verify SLO dashboard for 15 min; flags stay off for one release.
- **Rollback** — flags off → revert frontend → revert edge functions → never revert a migration; forward-fix with a new expand migration.
- **Incident response** — severity table, trace-id lookup path, comms template, post-mortem within 48 h.
- **Queue failure** — check lease-expiry backlog, drain rate, DLQ; safe replay procedure (idempotent handlers make replay free); pause cron to stop cascading cost.
- **AI provider outage** — flip `ai_degraded=true`: deterministic grading only, free-text items dropped from queues, generation paused, review fully functional; user-visible banner.
- **OCR failures** — inspect `needs_review` rate; if a corpus class regresses, pin the previous prompt/model version and re-queue affected pages.
- **Database recovery** — stated RPO 1 h / RTO 4 h; restore drill quarterly; verify storage objects and DB restore to the same point.
- **Cost overrun** — alert at 70% of daily ceiling; auto-throttle anonymous traffic first, then generation, never review; per-owner ceiling audit.

---

# 9. Implementation risks (by area)

| Area / task | Risk | P | I | Mitigation |
|---|---|---|---|---|
| E1 backfill | NOT NULL applied before backfill completes | M | H | Verify count = 0 nulls in a separate migration before contract |
| E1 anon | Anon rows orphaned or claimable twice | M | H | Single claim transaction, token hash, GC job |
| E2 worker | Double-processing under concurrent cron | M | H | SKIP LOCKED + lease + idempotent handlers, concurrency test in CI |
| E3 limits | Ceilings fail open under error | M | C | Fail-closed default, explicit test |
| E4 client extraction | pdf.js fails on encrypted/odd PDFs | H | H | Fallback to server raster + vision OCR; explicit user-visible failure reason |
| E4 OCR | Math/handwriting below the floor | H | C | Publish quality score, block generation on `needs_review`, paste path always available |
| E4 storage | Client-declared MIME trusted | M | H | Server-side sniffing and size check |
| E5 generation | Duplicate items on re-run | M | M | Job key unique + upsert |
| E6 verifier | Correlated hallucination with generator | H | C | Different model family, measured independence on gold set |
| E6 gold set | Overfitting to iteration slice | M | H | Rotating held-out slice never used for prompt work |
| E6 quarantine | Backlog exceeds solo capacity | H | H | Auto-expire policy + SLA; quarantine defaults to metadata only |
| E7 FSRS | Params mis-tuned for this population | M | M | Published defaults, version everything, tune only from cohort data |
| E8 grading | Free-text disputes erode trust | M | H | Deterministic-first, tight rubrics, override→quarantine loop |
| E9 submit | Two-device race loses a review | M | H | Row lock + unique idem key |
| E9 sync | Unbounded replay on large histories | M | H | Snapshots + capped replay window |
| E9 offline | Silent outbox loss | M | C | Explicit pending/failed UI, manual retry, sync tests |
| E9 latency | Model grading blocks submit | H | H | Two-phase submit with async grade |
| Program | Solo engineer, 48-week critical path | H | C | Commit E1–E9 only; E6 and E4 are the two that must not be compressed |
| Cost | Spend outruns revenue silently | M | C | Cost/user SLO and alert from E3, not E16 |
| Legal | Copyright / minor data | M | H | Private-by-default items, age gate in E1, documented takedown |

---

# 10. Ambiguity resolutions [D] (index)

Runtime unchanged · client-side PDF extraction · 1536-dim embeddings with stored model/version · items private per owner · concepts user-scoped · FSRS defaults with versioned params · `review` is the sole writer of `user_item_state` · `review_events` is the review record of truth and the ledger only references it · mastery rollups async · two-phase submit for free-text grading · scheduler difficulty never seeded from model output · anon identity via `owner_kind` union · deletion retires items but preserves review evidence · events transported as ledger rows plus outbox jobs, no bus · shell refactor moved from E15 into E9.
