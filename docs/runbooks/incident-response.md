# Runbook — Incident Response

## Severity

| Sev | Definition | Response |
| --- | --- | --- |
| 1 | Review loop down, or learning data being lost | Immediate. Flags off first, ask questions second. |
| 2 | Ingestion or generation down; review unaffected | Same day. |
| 3 | Degraded quality (trust rate dip, OCR regression) | Next working day; freeze prompt promotion. |
| 4 | Cosmetic or single-user | Backlog. |

## First five minutes

1. Get a trace id from the user report or the error envelope.
2. Search logs by `trace_id` — it spans client, edge function and queue job.
3. Check the four SLO panels for a correlated break.
4. If Sev 1: turn the relevant flag off before diagnosing further.

## Cost and data-loss checks

- Any incident touching the queue: confirm the dead-letter count and the drain rate
  before replaying.
- Any incident touching review: confirm `review_events` row count is still
  monotonically increasing. That table is append-only; a flat line means writes are
  failing and users are losing work.

## After

Post-mortem within 48 hours. Every Sev 1 and Sev 2 produces either a new automated
test or a new alert — never only a fix.