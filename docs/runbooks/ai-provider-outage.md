# Runbook — AI Provider Outage

Blueprint v2 requires the core loop to work without any model. This runbook makes
that switch explicit.

## Degraded mode

Set `ai_degraded = true`:

| Capability | Behaviour |
| --- | --- |
| Review of cloze / numeric items | **Fully working** — grading is deterministic |
| Scheduling, due lists, readiness | **Fully working** — no model involved by design |
| Free-text items | Dropped from the queue; existing answers grade when service returns |
| Item generation | Paused; queued jobs wait, they are not failed |
| OCR escalation | Paused; affected pages stay `needs_review` |
| Tutor chat | Unavailable, with an explicit banner |

## Steps

1. Confirm the outage in the `ai_calls` error rate, not from a single failure.
2. Enable degraded mode.
3. Pause the generation and OCR job kinds (leave the queue running for everything
   else).
4. Show the banner. Say what still works — the review loop — not just what is down.
5. On recovery: resume job kinds, let the queue drain, then clear degraded mode.
   Handlers are idempotent, so no manual reconciliation is needed.