# Runbook — Deployment

Order is fixed. Every step is expand-only; nothing is dropped in the same release
that replaces it.

1. **Migration** — additive only (new tables, nullable columns, new indexes).
   Verify the linter output; an intentional finding must already be recorded in
   security memory.
2. **Edge functions** — deploy after the schema they depend on exists.
3. **Frontend** — deploy last, still behind its feature flag.
4. **Verify** — watch the four SLOs for 15 minutes:
   - review submit p95 < 300 ms
   - ingestion time-to-ready (median, 20-page doc) < 60 s
   - production item trust rate ≥ 97%
   - AI cost per active user under the daily ceiling
5. **Enable** — flip the flag internal → 10% → 100%, with at least one hour at each
   step.

## Rules

- A flag stays off for one full release after its code ships.
- Never deploy a migration and its contract (drop / NOT NULL) together.
- Every deploy records the trace-id prefix in the release note so incidents can be
  correlated.