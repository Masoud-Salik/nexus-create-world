
# AI Chat → Production Rebuild + Admin Training Console

Goal: turn `/chat` into a fast, native-feeling, ChatGPT-class surface, and add an admin-only `/ai-training` page where you control the AI's knowledge, persona, and feedback dataset.

---

## 1. Backend rebuild — AI SDK + smarter pipeline

Migrate `supabase/functions/chat` from hand-rolled OpenAI-compat SSE to the **AI SDK** (`streamText` + `toUIMessageStreamResponse`) over the Lovable AI Gateway. This gives:
- Parts-based streaming (text, tool calls, tool results, reasoning) → no more brittle `data:` line parser.
- True multi-step tool loop (`stopWhen: stepCountIs(8)`) instead of the current single-pass.
- Lower TTFB: drop redundant pre-flight context fetch; lazy-load user context only when a tool requests it.
- Server-side message persistence via `onFinish` (one write, not two) → halves DB round-trips per turn.

New/upgraded server pieces:
- `chat/index.ts` — AI SDK streaming, abort-safe, conversation-scoped, 8k char hard limit kept.
- New action `embed-doc` (called from training page) — chunks + embeds with `google/gemini-embedding-001`.
- New action `rag-search` — vector top-k over the active knowledge base, returns chunks + citations, called as a tool from chat.
- `generate-chat-title` kept but moved to fire on `onFinish` server-side (removes a client round-trip).

Smarter AI:
- System prompt assembled at request time from: base persona + **active prompt version** (from `ai_prompt_versions`) + RAG snippets (when retrieved) + top user memories.
- New tools: `rag_search(query)`, `cite_sources()`, `web_recall(query)` (stub-ready), plus existing study tools.
- Few-shot injection: pull last N gold examples from `ai_training_examples` matching the user's intent (cheap classifier in JS).
- Model routing: `gemini-3-flash-preview` default, auto-fallback to `2.5-flash` on 429, `2.5-pro` when message length > 4k OR user toggles "Think harder".

---

## 2. Frontend rebuild — ChatGPT-dense pro

Replace `src/pages/Index.tsx` with a composed AI-Elements stack:
- `Conversation` / `ConversationContent` / `ConversationScrollButton` — sticky-to-bottom, smooth.
- `Message` + `MessageResponse` — streamed markdown, copy/retry/regenerate, thumbs up/down → writes to `ai_message_feedback`.
- `Tool` parts — collapsed accordions for tool calls (e.g. "Searched knowledge base · 4 sources").
- `PromptInput` + `PromptInputTextarea` + `PromptInputFooter` — submit button right-aligned, slash commands (`/think`, `/cite`, `/plan`), file attach (markdown/PDF for one-off context), model picker chip.
- `Shimmer` "Thinking…" while `status==="submitted"`, optimistic user bubble appended pre-stream.
- New `SourceChips` row under assistant messages when RAG citations exist.
- Sidebar drawer kept but rebuilt: virtualized list, instant fuzzy search, pin/rename/archive/delete, keyboard shortcuts (⌘K search, ⌘⇧O new chat, ⌘/ focus composer).
- Dense ChatGPT vibe: `#0B0F0E` bg, emerald accent (152 76% 36%), IBM Plex Mono for code, Montserrat for UI — keeps project palette/memory rules.

Speed wins:
- Pre-warm edge function on app boot (already exists) + HTTP/2 keep-alive via `fetch` `keepalive: true`.
- Optimistic message render before fetch resolves.
- Suspense + skeleton on first paint; conversations list loaded with `useQuery` + 5-min stale time.
- Stream rendering throttled with `requestAnimationFrame` batching (no React thrash per token).

---

## 3. Admin AI Training page (`/ai-training`)

Gated by `has_role(auth.uid(), 'admin')`. Three tabs:

### Tab A — Knowledge Base (RAG)
- Upload PDF / MD / TXT / paste URL or raw text.
- Server chunks (≈800 tokens, 100 overlap), embeds via Lovable AI Gateway, stores in `ai_knowledge_chunks` with `pgvector`.
- List view: title, size, chunk count, status, last indexed, delete/re-index.
- Test panel: type a query → see top-k chunks with similarity scores (rapid validation).

### Tab B — Prompt + Persona Studio
- Edit system prompt with live token counter and diff vs. active version.
- Persona presets (Friendly / Strict tutor / Socratic / Exam mode) — each a saved version row.
- Sliders: temperature, max tokens, tool aggressiveness.
- Few-shot examples editor (user msg ↔ ideal assistant reply).
- Versioning: every save = new row in `ai_prompt_versions`; "Activate" sets `is_active`. Old versions browseable + one-click rollback.
- Sandbox "Test chat" pane runs against the draft version without publishing.

### Tab C — Feedback Dataset
- Stream of all 👍 / 👎 from `ai_message_feedback` joined to the message + conversation.
- Admin can: open the conversation, edit the assistant's reply to an "ideal answer", save to `ai_training_examples` (gold set). These get pulled as few-shots in §1.
- Export gold set as JSONL (for future external fine-tuning).
- Coverage dashboard: counts, 👍/👎 ratio per topic (cheap keyword bucket), avg response time, model fallback rate (from `nexus_perf_logs`).

---

## 4. Database (one migration)

New tables (all with explicit GRANTs + RLS):

```text
app_role enum: 'admin' | 'user'           (existing pattern from memory)
user_roles(id, user_id, role)             — security definer has_role()

ai_prompt_versions
  id, name, system_prompt, persona, temperature, max_tokens,
  few_shots jsonb, is_active bool, created_by, created_at

ai_knowledge_docs
  id, title, source_type, source_url, status, chunk_count,
  created_by, created_at, updated_at

ai_knowledge_chunks
  id, doc_id, chunk_index, content, embedding vector(768),
  token_count, created_at
  -- ivfflat index on embedding vector_cosine_ops

ai_message_feedback
  id, message_id, conversation_id, user_id, rating ('up'|'down'),
  note, created_at

ai_training_examples
  id, source_message_id, user_input, ideal_response,
  tags text[], created_by, created_at
```

Enable `pgvector` extension. RLS: read-own for feedback; admin-only for all `ai_*` training tables; chunks readable by `authenticated` (so chat edge function under user JWT can query them via `rag_search` tool — embedding/cosine done in SQL with parameterized RPC `match_knowledge(query_embedding, top_k)`).

---

## 5. Files

Create:
- `supabase/migrations/<ts>_ai_training_and_roles.sql`
- `supabase/functions/_shared/ai-gateway.ts` (AI SDK provider helper)
- `supabase/functions/chat/index.ts` (rewrite)
- `supabase/functions/ai-training/index.ts` (upload/embed/list/delete docs, save prompts, save gold examples — admin only)
- `src/pages/AITraining.tsx` + `src/components/ai-training/{KnowledgeTab,PromptStudioTab,FeedbackTab,Sandbox}.tsx`
- `src/hooks/useIsAdmin.ts`
- `src/components/ai-elements/*` (installed via `bunx ai-elements@latest add conversation message prompt-input shimmer tool`)
- `src/components/chat/{ChatSidebar,SourceChips,SlashMenu,ModelPicker,FeedbackButtons}.tsx`

Edit:
- `src/pages/Index.tsx` (rewrite to AI-Elements composition)
- `src/App.tsx` (add `/ai-training` route, admin-guarded)
- `src/components/AppSidebar.tsx` + `MobileBottomNav.tsx` (show "AI Training" entry only if admin)
- `supabase/config.toml` (add `ai-training` function entry)

Delete: none — `ChatMessage.tsx`, `TypingIndicator.tsx`, `WelcomeScreen.tsx` become thin or removed once AI Elements lands; will mark deprecated then delete in the same change to keep tree clean.

---

## Out of scope (call out)

- Real external fine-tuning (we export JSONL; actual training of a custom model is not in this build).
- Voice in/out beyond existing TTS.
- Multi-tenant admin (single `admin` role only).
- Migration of existing message history into the new parts shape — old messages render as plain text, new messages get parts.

---

## Verification before done

1. Send a chat message — first token < 800ms on warm path.
2. Ask "what's in my knowledge base about X" after uploading a doc — answer cites the chunk; tool accordion shows `rag_search`.
3. As admin, change persona to "Strict tutor", activate, send same prompt — tone changes.
4. 👎 a reply → edit to ideal → save → next similar prompt receives it as few-shot.
5. Non-admin user hitting `/ai-training` is redirected; RLS denies direct table access.
6. Mobile: composer focuses on load, sticky bottom works, drawer swipe still smooth.
