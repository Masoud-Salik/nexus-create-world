
# Blueprint Page Redesign — Gamified Study Journey

Transform the current flat list of dashed-border task cards into an engaging, science-backed, Duolingo-style learning path with a smarter AI plan engine and an always-available AI copilot while studying.

## 1. New Blueprint UI — "The Path"

Replace the vertical list of task cards with a **gamified learning path**:

- **Path layout**: zig-zag vertical trail of circular "checkpoint" nodes (one per task), connected by an SVG dashed path. Like Duolingo's lesson tree, scoped to today's plan.
- **Node states**:
  - Completed → filled emerald with checkmark + subtle glow
  - Active/next → pulsing primary ring + bouncing "START" label
  - Locked/future → muted with subject color tint and difficulty emoji
  - Bonus round → gold sparkle node at the end
- **Tap node** → expands an inline card with topic, duration, difficulty chip, subject icon, "Start" button, and a small "Ask NEXUS about this" link.
- **Subject color rail**: left edge of each node uses the subject color for instant scanability.
- **Micro-rewards**: confetti burst + XP popup ("+25 XP") on completion; streak flame intensifies as more nodes complete.

## 2. Upgraded "Today's Progress" — Life Progress Bar

Redesign the single thin progress line into a **multi-layer Life Progress strip**:

```text
┌──────────────────────────────────────────────────────┐
│ 🔥 7d   ⚡ Level 12       1240 / 1500 XP   ▓▓▓▓▓░░  │
│ ●●●●●○○○○  Today: 4 / 9 quests       ⏱ 65m left      │
│ Streak ──────────●─────  Weekly goal 62%             │
└──────────────────────────────────────────────────────┘
```

Three stacked rows:
1. **Level + XP bar** — XP awarded per completed task (duration × difficulty multiplier), animated fill, level-up celebration.
2. **Today's quests** — circular pip row (filled = done, empty = pending) + remaining minutes.
3. **Weekly goal & streak heat-strip** — 7-day mini heatmap (intensity = minutes studied), shows where today sits.

All rendered with semantic tokens + CSS/SVG only (no chart libs, per project rules).

## 3. Smarter Plan Generation

Upgrade `supabase/functions/study-coach/index.ts` `generate-daily-plan`:

- **Inputs added to AI context**:
  - Time-of-day energy curve from `daily_checkins` (morning vs evening accuracy)
  - Last 14 days of `study_sessions` per topic for spaced-repetition spacing
  - Goal deadlines from `goals` (urgency weighting)
  - Subject `weekly_target_minutes` vs minutes already logged this week (rebalances under-served subjects)
  - Day-of-week pattern (lighter Mon/Fri, heavier mid-week)
- **Scientific scheduling rules** the model must follow:
  - Interleaving: never schedule the same subject in two consecutive tasks unless only one subject exists
  - Spaced repetition: weak topics resurface at 1d / 3d / 7d intervals
  - Ultradian blocks: 25/45/60-min options aligned to focus cycles, with implicit break nodes between them
  - Difficulty arc: warm-up easy → peak hard → cool-down review
- **Output schema** extended: each task gets `xp_reward`, `science_reason` (e.g. "Spaced review — last studied 3 days ago"), and `block_type` (warmup/peak/review/bonus). Surfaced in node tooltip.
- **Validation layer** on the server: rejects/repairs AI output that breaks interleaving or exceeds daily minute budget; deterministic fallback already exists and gets the same upgrades.

## 4. Smarter Plan Adjustment

Replace the 3-button modal with an **AI Adjuster** that actually re-plans:

- Modes expanded: `less_time`, `tired`, `push_harder`, `quick_review`, `swap_subject`, `reschedule_to_evening`.
- Instead of a flat multiplier, the edge function:
  1. Reads remaining pending tasks
  2. Sends them + the chosen mode + current time + recent check-in to the AI
  3. Returns a reshuffled set with new durations, difficulties, order, and a one-line rationale shown as a toast ("Cut peak block, added a 15-min review since you're low energy").
- Adjuster sheet shows current vs proposed plan side-by-side before applying (Undo within 10s).

## 5. AI Chat While Studying

Keep `FloatingAIChat` available **inside the active study session** (currently it disappears when `activeTask` is set):

- During `StudyTaskTimer`: small chat pill anchored bottom-left (clear of timer ring and controls), labelled "Ask NEXUS".
- Auto-seeds context with current task topic + subject + elapsed minutes so questions like "explain this concept" or "give me a practice question" work without setup.
- Tap-to-pause-timer toggle when opening chat is optional via a setting; default keeps timer running.
- Re-enable for guests with the existing auth prompt rather than hiding it.

## 6. Files to touch

- `src/pages/StudyCoach.tsx` — replace Blueprint task list with new `<StudyPath>`, swap progress block for `<LifeProgress>`, mount `<FloatingAIChat anchor="session" />` during `activeTask`.
- New: `src/components/study-coach/StudyPath.tsx` (zig-zag SVG + nodes + expand card).
- New: `src/components/study-coach/LifeProgress.tsx` (level/XP, quest pips, weekly heat-strip).
- New: `src/components/study-coach/PlanAdjusterSheet.tsx` (side-by-side current vs proposed, undo).
- Update: `src/components/study-coach/FloatingAIChat.tsx` — add `anchor="session"` position + task-context prop.
- Update: `supabase/functions/study-coach/index.ts` — new context queries, expanded prompt, validation, expanded `adjust-plan` action returning proposed tasks instead of writing immediately.
- XP / level derivation: client-side helper `src/utils/xp.ts` (xp = minutes × {easy:1, medium:1.5, hard:2}; level = floor(sqrt(totalXp / 50))). No schema change required — derives from existing `study_sessions`.

## 7. Out of scope (won't change)

- Focus Hub timer, Stats tab, bottom nav, theme tokens.
- Database schema and RLS policies (all new data is derived).
- Main `/chat` page.
