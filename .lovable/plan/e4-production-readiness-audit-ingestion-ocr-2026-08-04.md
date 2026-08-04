# E4 Production Readiness Audit — Ingestion & OCR

Audit only.

## 1. Complete ingestion flow

```text
User picks file (UploadDropzone)
   |  validateFile: <=25 MB, PDF/image/txt/md
SHA-256 fingerprint (crypto.subtle, browser)
   |
documents INSERT (status=extracting, unique on user_id+sha256)
   |
Client extraction (pdfjs-dist worker)
   |-- page has text layer (>=40 chars) -> text
   +-- no text layer -> page rasterised to PNG @2x, needs_ocr=true
   |
Storage upload: user-documents/{user}/{doc}/source  (+ page-N.png per OCR page)
   |
document_pages upsert (batches of 200, onConflict document_id,page_no)
   |
edge fn `ingest` (verify_jwt) -> ownership check -> enqueue_job
   |-- any needs_ocr page -> kind `ocr`   (status needs_ocr)
   +-- else               -> kind `chunk` (status chunking)
   |
worker drain (service-role only) claims leases (10/batch, 120 s lease, 45 s budget)
   |
ocr handler -> signed URL (300 s) per page -> vision model `ocr_page` -> page.text
   | enqueue chunk
chunk handler -> chunkPages (1200/150, page-scoped, provenance offsets)
   -> document_chunks upsert -> status=embedding -> enqueue embed
   |
embed handler -> batches of 64 rows WHERE embedding IS NULL
   -> openai/text-embedding-3-small@1536 -> UPDATE per row
   |
documents.status = ready
   |
Library polls every 4 s; match_user_chunks() serves retrieval
```

Components: `UploadDropzone`, `uploadDocument.ts`, `extract.ts`, `Library.tsx`/`DocumentRow`, bucket `user-documents`, tables `documents`/`document_pages`/`document_chunks`/`jobs`, edge functions `ingest` + `worker`, handlers `ocr`/`chunk`/`embed`, AI layer `call.ts`/`tasks.ts`, RPC `match_user_chunks`.

---

## 2. Failure paths

| Stage | Failure | Retry | User-visible status | Recovery |
|---|---|---|---|---|
| Validate | too large, wrong type | none | toast | re-pick file |
| Hash/extract | corrupt or encrypted PDF, >300 pages, tab OOM | none | toast (crash shows nothing) | re-upload |
| documents insert | duplicate sha256 (23505) | none | "already uploaded" | fine |
| Source upload | network drop mid-upload | none | toast, row set `failed` | Retry re-enqueues but **never re-uploads the file or page images** — a doc that failed before storage upload can never succeed via Retry |
| Page rows | batch insert error | none | `failed` | same gap |
| `ingest` invoke | expired JWT, >300 pages | none | `failed` + toast | Retry |
| Queue | **no cron drain exists** (`cron.job` holds only `gc-anon-sessions`) | n/a | doc sits in `needs_ocr`/`chunking` forever | manual worker POST |
| OCR | model 429/5xx, missing PNG | job backoff 2^n min, 5 attempts, then `dead` | status frozen at `ocr` | none automatic; dead jobs invisible to the user |
| Chunk | no readable text | none | `failed` with a clear message | good |
| Embed | provider error, vector-count mismatch | job retry, resumes on NULL rows | frozen at `embedding` | good resume semantics, no user signal |
| Dead-letter | any kind | terminal | **document status is never set to `failed`** | admin-queue console only |

Key gap: job death and document status are not linked. `needs_ocr`, `ocr` and `embedding` can hang indefinitely behind a cheerful spinner.

---

## 3. Security audit

Sound:
- All three tables: RLS `FOR ALL TO authenticated` on `auth.uid() = user_id`, correct GRANTs, no anon grant.
- `match_user_chunks` is SECURITY INVOKER with a hard `auth.uid()` filter, revoked from PUBLIC/anon, granted to `authenticated`.
- `user-documents` bucket is private; storage policies scope to `(storage.foldername(name))[1] = auth.uid()`.
- `ingest` verifies the JWT and re-checks `doc.user_id === userId` with the service client.
- `worker` requires the service-role key in `Authorization`; not user reachable.
- OCR signed URLs are per page and expire in 300 s.

Production risks:
1. **Bucket has no `file_size_limit` and no `allowed_mime_types`** (both NULL). The 25 MB and type checks are client-side only; an authenticated user can PUT arbitrary large binaries into their own prefix.
2. **No per-user quota** on documents, pages or bytes. Nothing caps OCR spend on a single account — direct cost exposure.
3. **`documents` and `document_chunks` are fully client-writable.** A user can set `status='ready'`, forge `page_count`/`chunk_count`, or insert arbitrary `content` into their own chunks — bypassing the pipeline and injecting text into their own RAG context. Not cross-tenant, but it makes chunk text untrusted input by definition; the fence in `untrusted.ts` must stay applied at E5.
4. OCR output is raw model text stored verbatim and later reaches prompts — same fencing requirement.
5. `deleteDocument` calls a non-recursive `storage.list()` on the document prefix, which is capped at 100 objects by default: **documents with more than 100 OCR page images leak storage objects on delete.**

---

## 4. Performance audit

- **Large PDFs on mobile:** rasterising at scale 2 into a canvas per page is the memory hot spot. A 300-page scanned PDF yields ~300 PNGs of 1–3 MB uploaded serially — realistically a tab crash or a 10+ minute upload. Materially better: cap OCR pages well below 300 (~60), render at 1.5, emit JPEG, and upload 4–6 in parallel.
- **OCR cost:** one vision call per page, sequential, no per-document page cap and no per-user budget. Largest financial risk in the system.
- **Worker throughput:** OCR of a 60-page document cannot fit the 45 s drain budget; the 120 s lease expires mid-document and the job is re-claimed. It converges because pages with text are skipped, but only if drains run repeatedly — and none are scheduled. Splitting OCR into per-page or page-range jobs would remove the lease churn.
- **Embedding writes:** batches of 64 reads, then one UPDATE per chunk. A 500-chunk document costs 500 round trips; a single upsert per batch is a straightforward win.
- **Indexes:** good coverage — `documents(user_id, created_at)`, partial `needs_ocr`, partial `embedding IS NULL`, HNSW on the vector column.
- **Vector search:** HNSW `vector_cosine_ops` at 1536 dims, queried without casts, so the index is actually used. The index is global across users and the `user_id` filter applies post-scan, so recall degrades as the table grows; fine to roughly 1M chunks.
- Library polls every 4 s while anything is in flight; realtime would be cheaper but is not a scale blocker.

---

## 5. Data lifecycle

| Step | State |
|---|---|
| Upload | OK — fingerprint, dedupe, row-first ordering |
| Processing | OK when a drain runs |
| Ready | Set only by `embed`; a document with zero chunks correctly ends `failed` |
| Retry | **Partial** — re-enqueues, but cannot repair missing storage objects or page rows |
| Delete | Row delete cascades to pages and chunks via FK ON DELETE CASCADE — correct |
| Storage cleanup | **Partial** — non-recursive list, 100-object cap, and it runs before the row delete, so a mid-way failure orphans files silently |
| Job cleanup | **Missing** — `jobs` rows are never purged; `done` and `dead` rows accumulate forever |
| Orphan recovery | **Missing** — no sweeper for documents stuck in a working status, no reconciliation from dead jobs to document status, no reaper for storage objects with no document row |

---

## 6. Missing tests

Present today: `tests/ingestion/chunk.test.ts`, `tests/ingestion/embed.test.ts`, `tests/queue/queue.test.ts`.

Unit
- `extract.ts`: text-layer threshold boundary, page-count cap, image and text paths
- `validateFile` matrix (size, mime, extension-only names)
- `sha256Hex` stability across identical content
- chunker: page boundaries, overlap correctness, MIN_CHUNK drop, offset accuracy

Integration
- `ingest`: unauthenticated, wrong owner, unknown action, >300 pages, retry deletes prior job keys
- `ocr` handler: missing page image, model error, idempotent re-run over partially transcribed pages
- `chunk` handler: shrinking re-run deletes tail rows
- `embed`: vector/input count mismatch, resume from partial embedding
- delete cascade plus storage cleanup with more than 100 objects

End-to-end
- Born-digital PDF to `ready`, chunks embedded, retrievable via `match_user_chunks`
- Scanned PDF through OCR to `ready`
- Duplicate upload rejected
- Failure then Retry then `ready`
- Cross-tenant: user B cannot read A's document, page, chunk, storage object, or RPC result

Performance
- 300-page PDF extraction time and memory on a throttled mobile profile
- Drain throughput with 100 queued documents
- Vector search latency at 100k and 1M chunks

Security
- Direct PostgREST writes forging `status` / `chunk_count` / chunk `content`
- Storage PUT outside the caller's own prefix
- Signed URL expiry and reuse after expiry
- `worker` reachable without the service key

---

## 7. Go / No-Go

**No-Go for 10,000 users.**

Blocking issues:
1. **No scheduled drain.** `cron.job` contains only `gc-anon-sessions`; nothing invokes `worker`. Every upload stalls permanently after enqueue. Hardest blocker.
2. **No stuck-document reaper or dead-job reconciliation.** Documents hang in `ocr`/`embedding` with no failure state and no user recourse.
3. **Retry is not a real recovery path** when the failure happened before or during storage upload.
4. **No cost or volume guardrails:** no per-user document/page/byte quota, no OCR page cap, no bucket `file_size_limit` or `allowed_mime_types`.
5. **Mobile extraction will crash** on large scanned PDFs at 300 pages × scale-2 PNG with serial uploads.
6. **Storage delete leaks** for documents with more than 100 objects.
7. **No end-to-end or cross-tenant tests** for the epic.

Recommended once unblocked:
- One upsert per embedding batch instead of per-row UPDATEs.
- Split OCR into per-page or page-range jobs so work fits the drain budget.
- Periodic purge of `done` jobs older than N days.
- Realtime document status instead of 4 s polling.
- Restrict write grants so only the service role sets `status`, `chunk_count`, and chunk `content`.