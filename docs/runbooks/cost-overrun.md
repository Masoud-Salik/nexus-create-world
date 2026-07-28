# Runbook — Cost Overrun

Cost, not compute, is the ceiling. This is an SLO from E3, not an E16 concern.

## Alert thresholds

| Level | Trigger | Action |
| --- | --- | --- |
| Warn | 70% of the daily cost ceiling | Investigate which task is driving spend (`ai_calls` grouped by task). |
| Throttle | 85% | Auto-throttle in order: anonymous traffic → item generation → tutor chat. |
| Stop | 100% | Generation and chat refuse with `quota_exceeded`. |

**Review is never throttled.** Deterministic grading and scheduling cost nothing, so
the core loop stays available at any spend level.

## Investigation

1. `ai_calls` grouped by `task`, `model`, `owner_id` for the window.
2. Check for a single owner dominating — usually an abuse pattern or a retry loop.
3. Check the cache hit rate; a drop usually means a prompt version changed and
   invalidated deterministic-input caching.

## Structural fixes

- Cache generation by content hash, not by request.
- Route to the cheapest model that passes the harness for that task.
- Per-owner ceilings, not just global ones.