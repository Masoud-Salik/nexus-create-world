# Runbook — Rollback

**Never revert a migration.** Roll forward with a new expand-only migration.

Order:

1. Turn the feature flag off. This is the only instant lever and it is always tried
   first.
2. Revert the frontend deploy.
3. Revert the edge functions.
4. If data is wrong, write a corrective migration — do not `DROP` to undo.

## Why migrations are never reverted

Learning evidence (`review_events`, `user_item_state`) is the product's moat. A
reverted migration can orphan or destroy it, and the loss is silent. The
expand → migrate → contract discipline means the previous release always still works
against the new schema, so a code rollback is always sufficient.

## Special cases

- **Bad item batch** — raise the publish threshold to 1.0. No deploy needed; nothing
  new publishes and existing items are unaffected.
- **Bad prompt version** — deactivate the version. The previous version resumes
  immediately because prompts are data, not code.
- **Runaway queue** — pause the cron drain. Jobs accumulate safely; handlers are
  idempotent so replay is free.