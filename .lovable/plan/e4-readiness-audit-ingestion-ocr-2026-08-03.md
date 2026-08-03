# E4 Readiness Audit — Ingestion & OCR

Audit only. No code written.

## 1. Current ingestion architecture

**Upload flow (user-facing): none for study material.** The only file inputs in the app are the avatar picker, study-selfie capture, situation photos, and a `.txt/.md` file reader in the admin Knowledge tab (`src/components/ai-training/KnowledgeTab.tsx`) which uses `file.text()` in the browser and posts raw text — the file itself is never stored.

**Storage buckets:** `avatars`, `situation-photos`, `study-selfies`, `user-documents` — all private. `user-documents` exists but nothing in the app writes to it; the only reference is the delete-account cleanup.

**PDF/image handling:** none. No PDF library in `package.json`, no client extraction worker, no page rasterisation.

**OCR:** none. No Tesseract, no OCR edge function, no OCR job kind.

**Chunking:** one implementation, server-side, inside `supabase/functions/ai-training/index.ts` (`chunkText`, ~800 chars / 100 overlap, paragraph-then-sentence boundary). Admin-only path, not reusable by a worker.

**Embeddings:** two paths. The legacy `_shared/ai-gateway.ts` `embed()` (still used by `ai-training`) and the E3 boundary `embed()` in `_shared/ai/call.ts`. Both request **768 dimensions**; `ai_knowledge_chunks.embedding` is `vector(768)` with an ivfflat index. Architecture v1's standing decision was **1536-dim**.

**Database tables relevant to ingestion:**
- `ai_knowledge_docs` / `ai_knowledge_chunks` — admin-owned global corpus, RLS: any authenticated user can read every chunk; only admins write. Not per-user, no page/offset metadata, no content hash, no source file pointer.
- `user_documents` — `document_name`, `document_type`, `file_url`, `mime_type`, `file_size`. A metadata stub only: no status, no page count, no extraction result, no checksum, no job link.
- `jobs` + `claim_jobs` / `complete_job` / `fail_job` / `enqueue_job` (E2) — ready and unused.
- `ai_calls` ledger (E3) — ready.

**Edge functions:** `ai-training` (admin ingest/search), `chat` (RAG read path via `match_knowledge`), `worker` (E2 drain loop with an **empty handler registry** — only `__noop` / `__fail`), `admin-queue` (monitoring).

**Frontend pages:** `AITraining.tsx` (admin) is the only ingestion surface. There is no learner-facing Library.

**Workers:** the E2 worker is deployed and correct, but registers zero real kinds. `parse`, `ocr`, `chunk`, `embed` are named in the handler-registry comment as E4's job.

**APIs:** `ai-training` actions `ingest_doc`, `delete_doc`, `test_search`; `match_knowledge(query_embedding, match_count)` RPC (global, not user-scoped).

## 2. Gap analysis vs Blueprint

| Deliverable | Status | Why |
|---|---|---|
| M4.1 Storage & upload | **Partial** | Private `user-documents` bucket exists; no storage RLS policies for it, no upload UI, no signed-upload path, no size/mime enforcement, no `documents` row lifecycle. |
| M4.2 Client extraction | **Missing** | No PDF library, no worker thread, no text-layer extraction, no page rasterisation for scanned pages. |
| M4.3 OCR | **Missing** | No OCR anywhere, no fallback decision logic (text-layer vs scanned), no per-page confidence. |
| M4.4 Chunking & embeddings | **Partial** | A chunker and an embed call exist but are admin-scoped, inline (not job-driven), 768-dim (blueprint says 1536), and write to a globally readable table. No idempotency key, no content hash, no re-embed path. |
| M4.5 Library UI | **Missing** | No learner-facing document list, status, retry, or delete. |
| M4.6 Quality & regression | **Missing** | No fixture corpus, no extraction-quality metric, no ingestion tests. Only `tests/queue` exists. |
| Job pipeline for ingestion | **Missing** | Queue infrastructure is complete; no `parse`/`ocr`/`chunk`/`embed` handlers registered. |

## 3. Risks

- **Dimension mismatch (blocking).** 768-dim column and index versus the 1536-dim standing decision. Deciding this after user content is embedded means a full re-embed. Must be settled before M4.4.
- **Tenancy leak in the corpus.** `ai_knowledge_chunks` grants SELECT to every authenticated user. If user uploads land in the same table, one learner reads another's notes. E4 needs its own per-user `document_chunks` table with `user_id` RLS, not a reuse of the admin corpus.
- **Two embedding paths.** `ai-training` still uses the legacy `_shared/ai-gateway.ts`, bypassing the E3 meter, cache, limits and ledger. Ingestion is the most token-hungry feature in the product; leaving it off the boundary breaks cost governance from day one.
- **Inline ingest blows the request budget.** `ai-training` embeds synchronously in the HTTP handler. A 200-page PDF will time out. Ingestion must be queue-driven.
- **ivfflat with `lists=100`** on a small table gives poor recall and needs rebuilding after bulk loads. HNSW is the safer default for a growing per-user corpus.
- **Client-side extraction is a device-capability risk** on low-end mobile — the primary platform here. Needs a size cap plus a server fallback or an explicit large-file rule.
- **No content hash / idempotency.** Re-uploading the same file duplicates chunks and doubles embedding spend. Queue handlers must be idempotent per E2's contract.
- **Conflicts with E5–E9.** E5 (item generation) needs stable `chunk_id` plus page/offset citations. If chunks lack provenance (`page`, `char_start`, `char_end`, `doc_version`), every generated item becomes uncitable and E7 evidence/review breaks. Design it into the schema now, not later.
- **Storage cost/retention.** No lifecycle rule for original files, no per-user quota.

## 4. Smallest implementation plan

### M4.1 Storage & Upload
- Files: `src/pages/Library.tsx` (shell), `src/components/library/UploadDropzone.tsx`, `src/core/domain/repositories/DocumentRepository.ts`.
- Migration: `documents` table (`user_id`, `title`, `mime`, `bytes`, `storage_path`, `sha256`, `page_count`, `status`, `error`, `source`) with GRANTs + owner-only RLS; unique `(user_id, sha256)`; storage RLS on `user-documents` scoped to the owner's folder prefix.
- Edge functions: none (direct authenticated upload via the storage client).
- Tests: RLS test proving cross-user read/write denial; upload rejects oversized files and non-PDF/image mime types.
- Rollout: Library route behind an internal flag. Rollback: hide route; table is additive.
- Acceptance: a signed-in user uploads a PDF, sees a `queued` row, and cannot see anyone else's.

### M4.2 Client Extraction
- Files: `src/workers/pdfExtract.worker.ts`, `src/core/ingestion/extract.ts`, wired into the upload flow. Add `pdfjs-dist`.
- Migration: `document_pages` (`document_id`, `page_no`, `text`, `has_text_layer`, `needs_ocr`) with RLS via parent ownership.
- Tests: fixture PDFs (born-digital, mixed, scanned) assert page count and text-layer detection.
- Rollout: extraction result posted as a job payload; failure marks `status='needs_ocr'`. Rollback: flag off, documents stay `queued`.
- Acceptance: a born-digital PDF is fully extracted client-side with zero server AI spend.

### M4.3 OCR
- Files: `supabase/functions/worker/handlers/ocr.ts`, registered in `handlers.ts`.
- Migration: add `ocr_confidence` to `document_pages`.
- Edge function: OCR handler runs only on pages flagged `needs_ocr`, page-at-a-time, idempotent on `(document_id, page_no)`.
- Tests: scanned fixture produces text; re-running the job does not duplicate rows.
- Rollout: cap pages per document; over-cap documents surface a clear message. Rollback: unregister the handler; jobs stay pending.
- Acceptance: a scanned PDF becomes searchable text without blocking the UI.

### M4.4 Chunking & Embeddings
- Files: move `chunkText` out of `ai-training` into `supabase/functions/_shared/ingest/chunk.ts`; add `handlers/chunk.ts` and `handlers/embed.ts`; migrate `ai-training` onto the E3 `embed()` and delete `_shared/ai-gateway.ts`.
- Migration: `document_chunks` (`document_id`, `user_id`, `chunk_index`, `content`, `page_no`, `char_start`, `char_end`, `token_count`, `embedding vector(<agreed dim>)`) with owner-only RLS, an HNSW index, and a `match_user_chunks` SECURITY DEFINER RPC filtered by `auth.uid()`.
- Tests: idempotent re-run yields identical chunk count; embedding batch failure retries without duplicating.
- Rollout: enqueue `chunk` → `embed` on extract/OCR completion. Rollback: unregister handlers; chunks are additive.
- Acceptance: an uploaded doc reaches `ready`, and `match_user_chunks` returns only the owner's chunks.

### M4.5 Library UI
- Files: `src/pages/Library.tsx` (list, status pill, progress, retry, delete), `src/components/library/DocumentRow.tsx`.
- Migration: none. Edge functions: none (RLS reads plus a retry that re-enqueues via RPC).
- Tests: status transitions render; retry re-enqueues exactly one job.
- Rollout/rollback: flag on the route.
- Acceptance: a user watches a document go queued → extracting → ocr → embedding → ready, and can retry a failure.

### M4.6 Quality & Regression
- Files: `tests/ingestion/*.test.ts`, `tests/fixtures/` (3–5 documents).
- Tests: extraction coverage ratio per fixture, chunk-boundary sanity, embedding dimension assertion, end-to-end enqueue→ready in a local drain.
- Rollout: runs in CI alongside `tests/queue`. Rollback: n/a.
- Acceptance: the suite fails loudly if extraction quality or chunk provenance regresses.

## 5. Do not rewrite

- `supabase/functions/worker/*` and `_shared/queue.ts` — E2 semantics are correct; only add handlers.
- `_shared/ai/*` (E3 boundary) — extend the task registry, don't bypass it.
- `_shared/errors.ts`, `logging.ts`, `handler.ts`, `owner.ts`.
- `ai_knowledge_docs` / `ai_knowledge_chunks` and the admin AI Training console — that is the global corpus; build user ingestion beside it.
- Existing storage buckets and their policies for avatars, selfies, situation photos.
- Auth, Focus Hub, Blueprint — untouched by E4.

## 6. Final recommendation

**Is the repo ready for E4?** Yes, structurally — the queue (E2) and the AI boundary (E3) are exactly the foundations E4 needs, and neither is used by ingestion today. The gap is entirely additive: no user-facing ingestion exists at all. Two things must be settled before code: the embedding dimension, and keeping user chunks separate from the admin corpus.

**Implement first:** M4.1 (documents table + storage RLS + upload), because every downstream job hangs off a `documents` row. Do not start M4.4 until the dimension decision is made.

**Decisions needing your approval:**
1. **Embedding dimension** — keep 768 (matches the existing corpus, cheaper, smaller index) or move to the 1536 standing decision (requires re-embedding the admin corpus)?
2. **Separate `document_chunks` table for user content** vs reusing `ai_knowledge_chunks` — I recommend separate, for tenancy.
3. **Client-side extraction with a server OCR fallback**, and the max file size / page cap (proposal: 25 MB, 300 pages).
4. **Migrate `ai-training` onto the E3 boundary and delete `_shared/ai-gateway.ts`** as part of M4.4 — small scope creep, large governance win.
5. **HNSW instead of ivfflat** for the new chunk index.