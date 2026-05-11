
# NEXUS Speed & Scale Upgrade

## Scope reality check (read first)

A few items in your list assume a Python/Redis/FAISS stack. This project runs on **Lovable Cloud** (Supabase Postgres + Deno edge functions + Lovable AI Gateway). Rather than introduce a new backend, we get the same outcomes natively:

| You asked for | What we'll actually use |
|---|---|
| FastAPI backend | Existing Deno edge functions (already async, already streaming) |
| Redis cache | Postgres `nexus_cache` table with TTL + in-memory edge LRU per warm instance |
| FAISS / Chroma vector DB | `pgvector` extension on the existing Postgres |
| WebSockets | We already use SSE — keep it (lower overhead, works on mobile PWA) |
| asyncio.gather | `Promise.all` — already supported, we'll use it more aggressively |
| Backend rate-limiting infra | Skipping per platform guidance; protection stays at gateway |

Streaming is already implemented. The real wins are **routing, context size, and parallelism**.

---

## 1. Smart model router (biggest perceived-speed win)

Add a tiny pre-classifier that picks the model **before** the main call.

```text
user msg ─► classifier (gemini-2.5-flash-lite, ~150ms, no tools)
              │
              ├─ "chat" / greeting / short Q ─► gemini-3-flash-preview  (fast, no tools)
              ├─ "app action" (plan/tasks/subjects)─► gemini-2.5-flash + tools
              └─ "deep reasoning" (planning, analysis)─► gemini-2.5-pro + reasoning:"low"
```

- Classifier returns `{ intent, needs_tools, complexity }` via tool-calling (structured output).
- Cache the classification per `hash(lastUserMessage)` for 10 min so repeats skip it.
- If classifier fails or times out (>400ms) we default to `gemini-3-flash-preview` with tools — never block on routing.

## 2. Context compression

Today every turn ships the full conversation + raw memories. We'll cap and compress:

- **Sliding window:** keep last 8 messages verbatim. Anything older gets summarized into a single `<conversation_summary>` block stored on the `conversations` row.
- **Rolling summarizer:** when message count crosses 12, fire-and-forget an `extract-memory`-style call that produces a 400-token summary and replaces older messages.
- **Memory packing:** `get_user_preferences` currently returns up to ~80 rows. Rank by `recency × sentiment_strength`, cap at 12 lines, and only inject when the classifier flags `needs_personalization`.
- **Tool list pruning:** only attach tools that match the routed intent (chat intent → no tools, "subjects" intent → only `manage_subjects` + `get_user_profile`). Smaller tool list = faster first token.

Target: drop average prompt from ~6k → ~1.5k tokens.

## 3. Prefetched first token (perceived latency)

The classifier call (~150ms) runs in parallel with **speculative streaming**: we kick off the small-model answer the moment the classifier returns "chat", before the user sees any spinner. UI already streams token-by-token — we just remove the round-trip wait for tool-calling on simple chats.

## 4. Parallel tool execution

In the tool-calling loop (`chat/index.ts` line 499), tools currently run sequentially:

```ts
for (const tc of choice.message.tool_calls) { await executeTool(...) }
```

Replace with `Promise.all(tool_calls.map(executeTool))`. Saves 200–800ms when the model requests multiple reads (`get_study_plan` + `get_user_profile` + `get_weekly_overview`).

Also: `get_user_preferences` already uses `Promise.all` internally — extend the same pattern to `get_weekly_overview` (sessions + tasks + habit can run in parallel).

## 5. Response cache

New table `nexus_cache(key text pk, response jsonb, model text, expires_at timestamptz)` with RLS denied to clients (service-role only).

- Key = `sha256(user_id + routed_model + normalized_prompt + memory_hash)`.
- TTL: 10 min for chat, 60 min for tool results that change rarely (`get_user_profile`).
- Hit → stream cached tokens through SSE with realistic pacing so the UX still feels live.
- In-memory LRU (Map of size 200) inside the warm edge instance for sub-ms hits before touching Postgres.

Expected ~15–25% hit rate on greetings, "what's my plan", "summarize my week".

## 6. Database query tightening

Add indexes the AI hits on every turn:

```sql
CREATE INDEX IF NOT EXISTS idx_study_tasks_user_date ON study_tasks(user_id, task_date);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date ON study_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_ai_memory_user_updated ON ai_memory(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_insights_user ON user_insights(user_id);
```

Also collapse the two profile lookups in `get_user_profile` into a single `select profiles.*, goals(...)` join.

## 7. Background precomputation

A new edge function `precompute-insights` (cron every 30 min via `pg_cron`) generates:

- Today's "morning brief" snippet (1 paragraph) per active user → stored in `daily_coach_messages` (already exists).
- Weekly summary refresh on Sunday night.

When the user opens chat, the first assistant turn can hand back the precomputed snippet instantly — no AI call needed for the opener.

## 8. Performance telemetry

New table `nexus_perf_logs(id, user_id, route, model, tokens_in, tokens_out, ttfb_ms, total_ms, cache_hit, created_at)` — service-role only.

Edge function emits one row per request. A new Settings → "AI Performance" panel (admin-gated for now via `has_role('admin')`) renders:

- p50 / p95 TTFB by model
- Cache hit rate
- Tool-call distribution
- Token usage trend

Pure CSS/SVG charts (per project rules — no chart libs).

## 9. UX speed polish

- Optimistic user message (already done) + **typing shimmer** while waiting for first token (currently blank).
- Skeleton row for the assistant bubble at request start.
- `requestIdleCallback` for non-critical post-render work (memory extraction, title generation) — already async, just verify nothing blocks the input field.
- Pre-warm the chat edge function on app boot via a tiny `OPTIONS` ping so cold-start is paid before the user types.

## 10. Vector memory (optional, phase 2)

If/when long-term recall matters more than today, enable `pgvector`, embed each `ai_memory.content` with `google/gemini-embedding-001`, and `get_user_preferences` does a similarity search against the current message instead of returning the top-50 by recency. Keeps prompt size flat as memories grow. Marked **phase 2** because it adds an embedding cost per saved memory and isn't needed until users have 100+ memories.

---

## Files to touch

**Edge functions**
- `supabase/functions/chat/index.ts` — router, parallel tools, cache lookup, perf logging, sliding-window history, sliced tool list
- `supabase/functions/classify-intent/index.ts` *(new)* — tiny classifier
- `supabase/functions/summarize-conversation/index.ts` *(new)* — rolling summary
- `supabase/functions/precompute-insights/index.ts` *(new)* — cron worker

**DB migration**
- `nexus_cache`, `nexus_perf_logs` tables (+ RLS: service-role only)
- Indexes listed in §6
- Add `summary text` column to `conversations`
- pg_cron schedule for `precompute-insights` (every 30 min)

**Frontend**
- `src/pages/Index.tsx` — typing shimmer + skeleton bubble + edge pre-warm on mount
- `src/components/chat/...` — render cache-hit indicator (subtle dot) when in dev
- New `src/pages/admin/AIPerformance.tsx` (admin-only route)

## Out of scope (intentional)

- Backend rate limiting (platform guidance)
- Switching to FastAPI / Redis / FAISS (would require leaving Lovable Cloud — same wins available natively)
- WebSockets (SSE already gives us streaming with less overhead on mobile)

## Expected outcome

| Metric | Today (rough) | After |
|---|---|---|
| TTFB on simple chat | 1.2–2.0s | 250–500ms |
| Tool-calling round (3 tools) | 1.8s | 700ms |
| Avg prompt size | ~6k tokens | ~1.5k tokens |
| Cache-hit response | n/a | <100ms |
| Cold start hit | felt by user | absorbed by pre-warm |
