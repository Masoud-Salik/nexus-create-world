## E2 Readiness Audit — Durable Job Queue & Worker

### 1. Current queue / background-job state

Verified against the live database and the repository:

- **No queue tables exist.** `public` contains only `anon_sessions` and `account_exports` from E1 — no `jobs`, no outbox.
- **No `claim_jobs` function.** The DB function list contains only pgvector internals plus `update_updated_at_column`, `handle_new_user`, `match_knowledge`, `has_role`, `gc_anon_sessions`.
- **One cron entry exists**: `gc-anon-sessions`, hourly, running `SELECT public.gc_anon_sessions();`. pg_cron 1.6.4 is installed.
- **`pg_net` was explicitly dropped** in migration `20260728024022` (`DROP EXTENSION IF EXISTS pg_net`). Nothing in the database can currently make an HTTP call, so pg_cron cannot invoke an edge function today.
- **No worker function.** `supabase/functions/` holds only request-response services; `_shared/` has `errors.ts`, `logging.ts`, `handler.ts`, `owner.ts`, `ai-gateway.ts` — no `queue.ts`, no `outbox.ts`.
- **Existing async-ish work is synchronous and unsafe.** `account/index.ts` builds the entire export inline inside the request (loops 18 tables), and writes an `account_exports` row with a `pending` status that nothing ever advances. This is the first natural consumer once E2 lands, but E2's rollout says "no consumers yet" — so it stays untouched this epic.
- **Foundations that E2 can reuse are in place**: the `serve()` wrapper (CORS, trace id, error envelope), `requireIdempotencyKey`, structured `Logger` with `elapsedMs()`, `serviceClient()`, and `requireAdmin()` for the admin queue view.

### 2. Missing pieces compared with E2

| E2 deliverable | State |
|---|---|
| M9 `jobs` table + partial indexes | missing |
| M10 `claim_jobs(kind, n)` with `FOR UPDATE SKIP LOCKED` + lease | missing |
| `outbox_enqueue` helper (transactional enqueue) | missing |
| `_shared/queue.ts` (enqueue, complete, fail, backoff, DLQ) | missing |
| `_shared/outbox.ts` | missing |
| `supabase/functions/worker/` with handler registry + drain loop | missing |
| pg_cron `queue-drain` every minute | missing, **and currently impossible** (no `pg_net`) |
| `GET /v1/admin/queue` | missing |
| `job.failed` / `job.dead_lettered` events | missing |
| Tests: concurrency, retry/backoff, poison→DLQ, idempotent-handler contract | missing (no test harness in repo at all) |

### 3. Risks

1. **Drain trigger is blocked.** The blueprint assumes pg_cron drives the worker every minute, but `pg_net` was removed during E1. Either re-enable `pg_net` (smallest corrective action, restores the blueprint's design) or the drain has to be triggered externally. Re-enabling is the recommendation; it is the same mechanism Supabase itself documents for cron→edge-function.
2. **Double-processing.** Overlapping cron ticks. Mitigated by `SKIP LOCKED` + `lease_until` + a per-drain advisory lock, and proven by a concurrency test.
3. **Poison messages consuming the whole budget.** A handler that always throws would be re-claimed forever without an attempt ceiling. Mitigated by `attempts >= max_attempts → status='dead'`.
4. **Edge-function wall-clock limits.** A drain that claims too much work gets killed mid-flight, leaving leases to expire and jobs to retry. Mitigated by a time-boxed drain loop (stop claiming past ~50s) and short leases.
5. **No test infrastructure exists.** E2's acceptance criteria are all test-shaped. Vitest has to be stood up as part of this epic or the acceptance bar cannot be met.
6. **Non-transactional enqueue.** Enqueueing over PostgREST is a separate round-trip from the state change it accompanies — a crash between them loses the job. Mitigated by the `outbox_enqueue` SQL helper so the enqueue happens inside the same statement/function as the write.
7. **Service-role-only surface.** `jobs` must have RLS on with no client policies and no `anon`/`authenticated` grants; only `service_role`. Same intentional linter finding pattern as `anon_sessions` — record it in security memory rather than "fixing" it.

### 4. Implementation plan mapped to E2 milestones

**M2.1 — Queue schema + claim function** *(migration; no app code)*
- `jobs(id, kind, key text unique, payload jsonb, status enum('pending','running','done','failed','dead'), attempts int, max_attempts int, lease_until timestamptz, next_run_at timestamptz, last_error text, trace_id text, created_at, updated_at)`.
- `key` unique gives idempotent enqueue: re-enqueueing the same logical work is a no-op.
- Partial indexes: `(kind, next_run_at) WHERE status='pending'`, `(lease_until) WHERE status='running'`, `(created_at) WHERE status='dead'`.
- GRANTs: `service_role` only. RLS enabled, zero policies.
- `claim_jobs(_kind text, _n int, _lease_seconds int)` — `SECURITY DEFINER`, `SET search_path=public`, selects due pending rows (plus expired leases) `ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT _n`, flips them to `running` with a lease, returns the rows.
- `enqueue_job(...)` and `outbox_enqueue(...)` SQL helpers so a caller can enqueue in the same transaction as its own write.
- `complete_job`, `fail_job(_id, _error)` — the latter applies exponential backoff (`2^attempts` minutes, capped) and dead-letters at `max_attempts`.

**M2.2 — Worker**
- `_shared/queue.ts`: typed `enqueue()`, `claim()`, `complete()`, `fail()` wrappers over those functions; the `JobHandler` contract (`(job, ctx) => Promise<void>`, must be idempotent, receives the job's `trace_id` so the chain stays linked).
- `_shared/outbox.ts`: helper for enqueueing alongside a write.
- `supabase/functions/worker/index.ts`: `serve("worker", ...)`, service-role-authenticated (shared secret header, `verify_jwt = false` in `config.toml`), a handler registry (empty this epic — E4/E5 register into it), and a time-boxed drain loop with a `pg_advisory_xact_lock` guard.
- Re-enable `pg_net` and install the `queue-drain` cron entry (every minute) that posts to the worker. If re-enabling is not acceptable, the fallback is a SQL-only cron that unlocks expired leases and the worker being driven manually until E4 — I'll flag it rather than decide silently.
- Emit `job.failed` and `job.dead_lettered` as structured log lines on the job's trace id.

**M2.3 — Ops & tests**
- `GET /v1/admin/queue` inside the existing admin surface: counts by kind/status, oldest pending age, dead-letter list. `requireAdmin()`, and it writes to `admin_access_log`.
- Vitest set up (`tests/queue/`) with: concurrency test (5 parallel drains, zero double-processing), retry/backoff test, poison-message → DLQ test, idempotent-handler contract test, and a 10k-job drain measuring permanent-failure rate.

**Explicitly not in this epic:** no consumers, no changes to `account/index.ts`, no UI beyond the admin view, no touching legacy tables.

**Acceptance:** 10k jobs drained, <0.1% permanent failure, zero double-processing under 5 concurrent drains.

**Rollback:** unschedule the cron; the table goes inert with no consumers.

### One decision I need from you

Re-enabling `pg_net` is the only way to keep the blueprint's pg_cron→worker drain, and E1 deliberately removed it. I recommend re-enabling it (scoped to the `extensions` schema, `EXECUTE` revoked from PUBLIC) and recording the rationale in security memory. Say the word and M2.2 includes it; otherwise I'll build the worker with a manual/external trigger and leave the cron install to E4.
