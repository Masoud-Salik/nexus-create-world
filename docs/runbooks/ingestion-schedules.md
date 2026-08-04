# Runbook — Ingestion schedules & limits (E4 hardening)

## Scheduled jobs

| Schedule | Cadence | What it does |
| --- | --- | --- |
| `queue-drain` | every minute | POSTs the `worker` function so queued `ocr` / `chunk` / `embed` jobs actually run. Authenticated with the `x-worker-token` header (`WORKER_SCHEDULER_TOKEN`), because cron cannot read the service role key. |
| `reconcile-documents` | every 5 minutes | `public.reconcile_stuck_documents()` — marks documents whose jobs died or stalled as `failed` with a user-safe message. |
| `purge-jobs` | 03:30 daily | `public.purge_jobs()` — deletes completed/dead job rows past their retention window. |

Inspect: `SELECT jobname, schedule, active FROM cron.job;`
Recent runs: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;`

## If uploads are stuck in `queued` / `needs_ocr`

1. Confirm `queue-drain` ran recently (`cron.job_run_details`).
2. Drain manually: POST `/functions/v1/worker` with `Authorization: Bearer <service role key>`.
3. If the worker 401s from cron only, `WORKER_SCHEDULER_TOKEN` no longer matches the token baked into the cron command — rotate both together.
4. Force reconciliation: `SELECT public.reconcile_stuck_documents();`

## Limits

All limits live in `supabase/functions/_shared/ingest/limits.ts` (`FREE_LIMITS`) and are enforced twice:

- **Preflight** (`ingest` action `preflight`) — before the row or upload exists: file size, page count, OCR pages, document count, total storage.
- **Process/retry** — re-verifies the *stored* object's size and MIME type and the real OCR page count, so a crafted client cannot bypass the browser checks and buy unlimited OCR.

Current values: 25 MB/file, 300 pages, 60 OCR pages, 200 documents, 500 MB total, 3 retries per document.

## Retry semantics

`ingest` action `retry` increments `documents.retry_count` and refuses past `maxRetries`. It verifies the source object, the extracted page rows, and the rasterised page images. Missing page images are skipped (`needs_ocr = false`) so the rest of the document still completes; if nothing readable remains, the document fails with an explicit "upload it again" message instead of looping.