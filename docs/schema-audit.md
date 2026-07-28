# Schema Audit — E1 / M1.1

Baseline for the Blueprint v2 migration. 38 public tables. Every table is classified
as **Keep**, **Merge**, or **Deprecate** per the Blueprint v2 data architecture, and
carries a target ownership + RLS state.

## Ownership model

Two owner kinds exist after E1:

| Kind | Identity | Source |
| --- | --- | --- |
| `user` | `auth.uid()` | Supabase JWT |
| `anon` | `anon_sessions.id` | opaque bearer token, 24 h TTL, GC'd hourly |

**[D] Implementation decision (smallest change preserving the architecture):**
the `owner_id` / `owner_kind` union is introduced on **new Blueprint v2 tables only**
(`sources`, `source_pages`, `source_chunks`, `item_candidates`, `items`,
`review_sessions`, `review_events`, `user_item_state`, …). Legacy surviving tables
keep `user_id` and are always `owner_kind = 'user'`; `resolveOwner()` in
`supabase/functions/_shared/owner.ts` normalises both shapes for callers.

Rationale: anonymous identity is only reachable from ingestion and review (E4/E9/E10).
Rewriting the ownership column on ~30 legacy tables — 10 of which are dropped in
Phase 4 — would be churn with real RLS risk and no product value. Tables that survive
to E11+ and need anon support are migrated individually when that need appears.

## Classification

### Keep — user-scoped, survive Blueprint v2

| Table | Owner col | RLS target | Hot-path index |
| --- | --- | --- | --- |
| `profiles` | `id` = auth.uid() | owner CRUD | pk |
| `study_subjects` | `user_id` | owner CRUD | `(user_id, priority_order)` |
| `study_sessions` | `user_id` | owner CRUD | `(user_id, session_date desc)` |
| `conversations` | `user_id` | owner CRUD | `(user_id, updated_at desc)` |
| `messages` | `user_id` | owner read/insert, no update/delete | `(conversation_id, created_at)` |
| `ai_memory` | `user_id` | owner CRUD | `(user_id, category)` |
| `ai_message_feedback` | `user_id` | owner CRUD | `(user_id, created_at desc)` |
| `user_insights` | `user_id` | owner CRUD | `(user_id, insight_type)` |
| `user_documents` | `user_id` | owner CRUD | `(user_id, created_at desc)` |
| `feedback` | `user_id` | owner insert/read only | `(user_id, created_at desc)` |
| `goals` | `user_id` | owner CRUD | `(user_id, created_at desc)` |
| `habits` | `user_id` | owner CRUD | `(user_id, habit_type)` |
| `user_roles` | `user_id` | read via `has_role` only | `(user_id, role)` |

### Keep — system / admin scoped

| Table | Notes |
| --- | --- |
| `ai_prompt_versions` | admin-only; promotion gated by the eval harness (E6) |
| `ai_training_examples` | admin-only |
| `ai_knowledge_docs` / `ai_knowledge_chunks` | **Merge** into `sources` / `source_chunks` with `owner_scope` in E4 |

### Merge

| Tables | Into | Epic |
| --- | --- | --- |
| `daily_checkins` (25 cols), `daily_activities`, `habits` streak fields | `daily_rollup` (derived) | E14 |
| `study_tasks`, `weekly_goals` | `plan_targets` (derived from Readiness) | E12 |
| `ai_knowledge_docs`, `ai_knowledge_chunks` | `sources`, `source_chunks` | E4 |

Raw inputs are retained for the retention window; a rollup's source is never dropped
in the same phase that creates the rollup.

### Deprecate → drop in Phase 4 (E15), after cold-storage snapshot

`predictions`, `future_scenarios`, `abilities_skills`, `skill_scores`, `interests`,
`idea_vault`, `situation_photos`, `study_selfies`, `weekly_reports`,
`friends_identities`, `daily_coach_messages`, `nexus_perf_logs` (replaced by
`ai_calls`), `user_ai_providers` (BYO keys — highest-severity surface, no Blueprint
requirement), `users` (vestigial 2-column table beside `profiles`).

Frozen, decision deferred to E15: `friendships`, `leaderboard_opt_ins`,
`weekly_leaderboard`.

## Known defects found in the audit

1. `users` is a vestigial 2-column table shadowing `profiles`.
2. `user_ai_providers.encrypted_api_key` — weak encryption fallback, delete in Phase 4
   with explicit key destruction.
3. `nexus_perf_logs` has an all-operations-denied policy set and no documented writer.
4. `conversations` / `messages` are the hottest tables and have no stated composite
   indexes.
5. `study_sessions.notes` string-encodes session intent and focus score — promote to
   typed columns before any analytics depends on it.
6. `daily_checkins` is a 25-column survey table, not learning evidence.

## Cascade contract (deletion)

| Action | Effect |
| --- | --- |
| Delete a source | Source hidden, its items retired. `user_item_state` and `review_events` **survive** — they are the moat. |
| Delete an item | Retired, never hard-deleted while review history references it. |
| Delete account | Hard delete of everything, including storage objects and anon sessions. Export offered first. |
| Anon session expiry | Hard delete of all rows owned by that session. |