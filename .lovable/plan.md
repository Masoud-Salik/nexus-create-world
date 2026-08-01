> Note: `git` shows no untracked stray files; both items below were verified by reading `src/pages/StudyCoach.tsx` (lines 550–730), `supabase/functions/chat/index.ts`, `study-coach`, `extract-memory`, `future-predict`, `generate-chat-title`, `text-to-speech`, `ai-training`, and `_shared/*`.

# Part A — Mini fix: Study hub header

**Selected area** = `src/pages/StudyCoach.tsx` lines 554–595: the row containing `Saturday, August 1`, the streak flame, the music toggle, a Subjects (book) icon button and a Sliders "adjust" icon button.

Changes (frontend only, one file):
1. Remove the Sliders/adjust icon button (lines 577–591) and the now-unused `adjusting` spinner branch from this header. The Adjust action still exists on the day header (line 704) so no functionality is lost.
2. Redesign the row into a clean two-line, labelled header:
   - Left: day name in bold (`Saturday`), and beneath it a muted small line `August 1 · 🔥 5 day streak`.
   - Right: two labelled, equal-size 36px round ghost buttons — music toggle and Subjects — each with `aria-label` ("Study music", "Subjects") and a consistent border/`bg-card` treatment so they read as a pair instead of loose icons.
3. Tighten spacing (`mb-3` → `mb-2.5`) and keep everything inside the existing `max-w-lg` container so mobile stays fitted.

No backend, no logic changes.

# Part B — E3 AI Services Layer Readiness Audit (audit only)

## 1. Current AI architecture

Model call sites (all raw `fetch`, none share a boundary):
| Location | Provider | Notes |
|---|---|---|
| `supabase/functions/chat/index.ts:389` | Lovable gateway `/embeddings` | `google/gemini-embedding-001`, 768 dims |
| `chat/index.ts:447` | Lovable gateway `/chat/completions` | manual model-order fallback loop (l.436–466) |
| `chat/index.ts:609` | **api.openai.com directly** | BYO-key path using `encrypted_api_key` from `ai_providers` |
| `extract-memory/index.ts:50` | Lovable gateway | JSON-schema tool call |
| `future-predict/index.ts:188, 294, 381` | Lovable gateway | 3 separate prompt blobs |
| `generate-chat-title/index.ts:47` | Lovable gateway | `max_tokens: 20` |
| `text-to-speech/index.ts` | TTS provider | raw fetch |
| `ai-training/index.ts:82, 134` | via `_shared/ai-gateway.ts` | only consumer of the helper |

- **Gateway helper**: `supabase/functions/_shared/ai-gateway.ts` (58 lines) — `chat`, `chatStream`, `embed`. Used by exactly one function.
- **Prompt locations**: `chat/index.ts` (`SYSTEM_PROMPT` + DB `ai_prompt_versions`), `future-predict` (3 inline), `extract-memory` (inline), `generate-chat-title` (inline), `study-coach` (inline planning prompts).
- **Prompt versioning**: exists only for chat, via `ai_prompt_versions` (active row, `few_shots`, `persona`) — nothing else is versioned.
- **Structured output**: ad-hoc `tools`/JSON-schema in `extract-memory` and `chat`; no shared validator, no Zod, no rejection path.
- **Retry/fallback**: only `chat/index.ts:436–466` (429/error → next model). No backoff, no jitter.
- **Cache**: `cache_hit` field is logged but there is no cache implementation.
- **Rate limiting**: none for AI. Only the per-IP throttle in `anon`.
- **Cost/token accounting**: `prompt_chars` heuristic written to `nexus_perf_logs` (chat only). No token counts, no cost.
- **Tracing**: E1 gave us `_shared/logging.ts` trace ids and `X-Trace-Id` from `src/core/api/client.ts` — but no AI function uses `_shared/handler.ts`, so traces stop at the AI boundary.
- **User data → AI context**: chat history + tool results (`study-coach` calls at l.305/317), RAG chunks from `ai_knowledge_chunks`, memory insights, and client `userLocalTime`/`userTimeOfDay` (sanitised at l.33/498). `userContext` is deliberately not accepted from the client.

## 2. Blueprint gap analysis (E3: "one governed model boundary")

| # | Gap | Sev | Location | Fix |
|---|---|---|---|---|
| 1 | 8 direct provider calls bypass any gateway | **High** | all functions above | Route through `_shared/ai/` |
| 2 | Duplicated AI utilities (helper vs inline fetch) | High | `_shared/ai-gateway.ts` vs rest | Extend helper, delete inline |
| 3 | No model/task registry — model ids hardcoded per file | High | chat l.17–20, others | `tasks.ts` registry |
| 4 | No prompt versioning outside chat | High | future-predict, extract-memory, study-coach | Move to `ai_prompt_versions` keyed by task |
| 5 | No shared structured-output validation / rejection path | **High** | extract-memory, chat tools | Zod schema guard + repair-once-then-fail |
| 6 | No token/cost accounting, no `ai_calls` ledger | **High** | `nexus_perf_logs` only | New table + meter |
| 7 | No AI rate limits or entitlements | **High** | everywhere | Per-owner window counter + entitlement stub |
| 8 | Trace ids don't reach model calls | Medium | all AI fns | Adopt `_shared/handler.ts` |
| 9 | No redaction of PII before model input | Medium | chat, future-predict | Redactor in the boundary |
| 10 | Untrusted context (RAG chunks, tool results, user notes) is concatenated unfenced | **High** | chat l.389–466, 543 | `untrusted()` wrapper with delimiters + "data, not instructions" preamble |
| 11 | BYO OpenAI key path fully unmanaged (no limits, no ledger, no fallback) | Medium | chat l.594–630 | Route through same boundary as a provider |
| 12 | No injection test corpus / CI check | Medium | — | M3.3 |
| 13 | Fallback loop has no backoff, can hammer on 5xx | Low | chat l.436 | Exponential backoff + jitter |

## 3. Worth preserving (do not rewrite)
- `_shared/ai-gateway.ts` — correct base URL/headers. **Extend**, don't replace.
- `_shared/{errors,logging,handler,owner,queue}.ts` — E1/E2 primitives the AI layer should compose with as-is.
- `ai_prompt_versions` + the AI Training console — already the prompt-versioning store; generalise with a `task` column instead of building a new system.
- `chat`'s intent router (l.633–635) and time-field sanitiser (l.33, 498) — move into the boundary, don't re-derive.
- RAG retrieval + `match_knowledge` — untouched; only its output gets fenced.
- Avoidable migration: no need to drop `nexus_perf_logs`; leave it, add `ai_calls` alongside and stop writing new fields to it.

## 4. Smallest E3 migration plan

### M3.1 Core
- Files: new `supabase/functions/_shared/ai/{tasks.ts, router.ts, schema.ts, call.ts}`; edit `_shared/ai-gateway.ts` (export a low-level `raw()`).
- `tasks.ts`: task id → {primary model, fallback chain, max tokens, temperature, output schema, prompt key}.
- `router.ts`: task → model order, absorbing chat's intent router.
- `schema.ts`: Zod parse of model output, one repair retry, then a typed `schema_rejected` error.
- `call.ts`: single `callModel(task, input, ctx)` entry point with backoff+jitter fallback.
- Migrations: none. Tests: unit tests for router order, schema rejection, fallback on 429. Rollout: additive, nothing consumes it yet. Rollback: delete files.
- Accept: `callModel` runs a real gateway request for one task and returns a schema-valid object.

### M3.2 Governance
- Migration: `ai_calls` (owner, task, model, trace_id, prompt/completion tokens, cost_usd, latency_ms, status, cache_hit, schema_retries) — service-role-only RLS + GRANTs; plus `ai_rate_windows` or a counter RPC.
- Files: `_shared/ai/{meter.ts, limits.ts, entitlements.ts, cache.ts}`; `call.ts` wires them in; new `AI Calls` tab reusing `admin-queue` patterns.
- Cache: hash(task+prompt+model) → response, short TTL, for deterministic tasks only (titles, extraction) — never chat.
- Entitlement: stub returning `{ allowed: true, tier: "free" }`.
- Tests: ledger row per call; limit returns 429 envelope; cache hit skips provider. Rollout: metering on, limits in log-only mode first. Rollback: env flag disables limits, ledger writes are non-blocking.
- Accept: every `callModel` produces exactly one `ai_calls` row with tokens and cost.

### M3.3 Safety
- Files: `_shared/ai/{redact.ts, untrusted.ts}`; `tests/ai/injection.test.ts` + `tests/ai/corpus/*.json`; CI step in the vitest config.
- `untrusted()` fences RAG chunks, tool results and user notes; redactor strips emails/tokens/keys before send.
- Accept: ≥20-case injection corpus passes; no raw untrusted string reaches a system message.

### M3.4 Migration
- Order: `generate-chat-title` → `extract-memory` → `future-predict` → `study-coach` → `chat` (largest last, streaming path needs care) → BYO-OpenAI path.
- Delete per-file model constants and inline fetches; keep function contracts identical.
- Rollout: one function per deploy, verify `ai_calls` rows + ledger cost. Rollback: per-function redeploy of the previous version.
- Accept: `rg "ai.gateway.lovable.dev|api.openai.com"` matches only `_shared/ai*`.

## 5. Risks
- **Cost leakage** — no ledger today; a retry loop or BYO-key path can burn credits invisibly. Meter before migrating chat.
- **Security** — `ai_calls` will hold prompt metadata; must be service-role-only, and prompts should be hashed/truncated, never stored raw.
- **Prompt injection** — the RAG + tool-result path is the live hole; fencing must land (M3.3) before E4 ingests user PDFs, or uploaded documents become an instruction channel.
- **Inconsistent outputs** — a schema guard without a rejection path silently degrades E5/E6 item quality and corrupts the ≥97% trust rate metric.
- **Debugging** — if trace ids don't span client → function → model → job, AI failures become unreproducible once E4 runs work async.
- **E4–E13 conflicts** — E5 generation, E6 validation and E8 grading all assume `callModel` + schema guard exist. Building them against raw fetches would mean rewriting three epics.

## 6. Final recommendation
1. **Ready?** Yes — E1 and E2 supply owner resolution, error envelope, trace logging and a durable queue. E3 is additive.
2. **Fix first (small, inside M3.1/M3.2):** decide whether the BYO OpenAI key path stays (it doubles the surface); confirm `ai_prompt_versions` can take a `task` column rather than a parallel table; land the `ai_calls` ledger before migrating `chat`.
3. **Leave untouched:** `_shared/{errors,logging,handler,owner,queue,outbox}.ts`, the jobs/worker stack, `match_knowledge` + RAG retrieval, the AI Training console UI, `nexus_perf_logs` (freeze, don't drop), and all non-AI product surfaces.
