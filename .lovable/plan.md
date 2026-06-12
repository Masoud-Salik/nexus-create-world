## Diagnosis

After reading `StudyCoach.tsx`, `focus/FocusCockpit.tsx`, `focus/PreFlight.tsx`, and `supabase/functions/study-coach/index.ts`, here is the honest state of the two surfaces.

### Focus Hub — what works
- `FocusCockpit` with PreFlight → BreathingPrimer → Ring → Debrief flow is solid.
- Wall-clock global timer, soundscape ducking, distraction tracker, keyboard shortcuts are in place.
- Adaptive duration suggestion already pulls from `study_sessions`.

### Focus Hub — weaknesses
1. **Stats strip is fake.** `StudyCoach.tsx` passes `todayMinutes={0} level={1} xpInLevel={0} xpForLevel={100}` — the level/XP/today badges always show zero. The whole gamification spine is decorative.
2. **Session log is thin.** On `onSessionLogged` we insert a `study_sessions` row with no `subject_id`, no distractions, no focus score, no intent tagging. The data needed for adaptive duration to actually learn is being thrown away.
3. **No mid-session quick chat.** `FloatingAIChat anchor="ring"` is gated on `!activeTask`, so the moment a task starts it disappears. The user explicitly asked for AI access while studying.
4. **No distraction feedback loop.** The counter increments silently; user never sees "you tabbed out 3 times — strict mode?" intervention.
5. **Smart breaks are missing.** Break starts as a plain 5-min countdown — no 20-20-20 eye prompt, no stretch card, no NEXUS recall quiz, no hydration nudge.
6. **No session debrief intelligence.** Rating + note are captured but never sent to AI for next-session calibration or memory extraction.
7. **Soundscape mixer is single-select.** "Layered" mixing promised in earlier plan was never built — one sound at a time, no per-layer volume.
8. **Theater mode escape is half-implemented.** No exit affordance besides `Esc`/`F`; on mobile (no keyboard) there is only the small minimize button after the fact.

### Blueprint — what works
- AI generation calls edge function, falls back gracefully on parse fail.
- Local-cache instant updates via `useLocalStudyPlan`.
- "Break the Rules" bonus session block is a nice touch.

### Blueprint — weaknesses
1. **It's a flat list.** The Duolingo-style `StudyPath` referenced in earlier summaries does not exist on disk. Today's Blueprint is `pendingTasks.map(...)` cards — zero spatial story, zero progression feel.
2. **No XP/level/quest system.** "Today's Progress" is just `completed / total`. There is no streak shield, no daily quest pips, no weekly heatmap, no rank.
3. **Adjust plan is mechanical.** The edge function `adjust-plan` multiplies durations and shifts difficulty — no AI, no reshuffle, no preview-before-apply. `PlanAdjusterSheet` referenced earlier doesn't exist.
4. **No weekly view.** Only "today" is visible. User cannot see tomorrow, the week, or drag to reschedule.
5. **No manual task add / edit / reorder.** Everything must come from the AI.
6. **Bonus rounds insert raw rows.** No XP multiplier persisted, no quest credit, no link back to the day's plan.
7. **No "next-up" focus CTA from Blueprint into Focus Hub.** Switching modes requires manual tab tap.
8. **Generation prompt ignores time-of-day.** Despite check-in data being pulled, the model never gets "user studies best 7-10am" type signal, nor topic interleaving constraints in the response schema.

---

## Upgrade Plan

Scope is deliberately split into 4 buckets so credit usage stays modest while still being a major visible jump. No new tables; reuse `study_sessions`, `study_tasks`, `habits`, `daily_checkins`.

### Bucket 1 — Wire the gamification spine (foundation for both pages)

Create `src/hooks/useStudyProgress.ts`:
- Reads `study_sessions` for today and the trailing 7 days.
- Computes: `todayMinutes`, `weekMinutesPerDay[7]`, `totalXp`, `level`, `xpInLevel`, `xpForLevel`, `dailyGoalMinutes` (from `daily_checkins.study_minutes` median or 60 default), `dailyQuestsDone[3]`.
- XP formula already in `src/utils/xp.ts`; reuse.
- Returns `{ progress, refresh }`. Auto-refresh after every session insert via a passed callback.

Update `StudyCoach.tsx` to consume this hook and pass real values to `FocusCockpit` and to a new `LifeProgress` strip on Blueprint.

### Bucket 2 — Blueprint redesign (the major visible upgrade)

New components under `src/components/study-coach/blueprint/`:

- **`StudyPath.tsx`** — Duolingo-style zig-zag SVG path. Each node = one task. States: completed (filled emerald with check), active (pulsing ring, "Start" CTA on tap), locked (greyed, requires prior node). Subject icon inside the node, difficulty ring color. Tapping active node opens a bottom sheet with topic, science_reason, "Start focus" (jumps to Focus Hub pre-seeded), "Mark done", "Skip".
- **`LifeProgress.tsx`** — Top strip with: level badge + XP bar, 3 daily-quest pips ("Complete 1 task", "30+ min focus", "0 distractions in a block"), 7-day mini-heatmap (CSS grid, opacity by minutes), streak flame with shield indicator.
- **`WeekRibbon.tsx`** — Horizontal scrollable Mon–Sun strip above the path. Each day shows mini-dot indicators per task (filled/empty). Tap a day to swap the path to that date's tasks. Today is highlighted, future days dimmed.
- **`PlanAdjusterSheet.tsx`** — Bottom sheet with 4 mode chips (Less time, Tired, Push harder, Reshuffle). On select, calls edge function with `preview: true`, renders a diff card (`old → new` per task), then "Apply" or "Discard".
- **`AddTaskSheet.tsx`** — Manual task creation: subject select, topic input, duration slider (15-90), difficulty chips, date picker. Posts to `study_tasks`.

Layout swap in `StudyCoach.tsx`'s `studyMode === "plan"` branch: `<LifeProgress/>` → `<WeekRibbon/>` → `<StudyPath/>` (replaces the flat card list) → FAB row (Add task, Adjust, Subjects). Empty state and "all done — bonus round" survive but live below the path.

### Bucket 3 — Smarter edge function

Extend `supabase/functions/study-coach/index.ts`:

- **`generate-daily-plan`**: enrich prompt with hourly preference (peak hour computed from past sessions' `created_at`), require `science_reason` and `slot_hint` ("morning"/"afternoon"/"evening") in JSON, enforce interleaving in a post-processing pass (swap adjacent same-subject tasks).
- **New action `adjust-plan-preview`**: same as `adjust-plan` but returns the proposed updates as JSON instead of writing. Used by `PlanAdjusterSheet`.
- **New action `adjust-plan-reshuffle`**: calls the AI to reorder + retitle remaining tasks based on time of day and weak topics. Returns preview.
- **New action `debrief-session`**: takes `{ elapsed, planned, distractions, intent, rating, note }`, returns one-sentence calibration ("Next session try 35m — your sweet spot drops sharply past 40m on low-energy days").

### Bucket 4 — Focus Hub polish

- **Persistent quick chat during sessions.** Add `<FloatingAIChat anchor="ring" mode="focus" taskContext={{intent, elapsed, plannedMinutes}} />` in `FocusCockpit` rendered always (collapsed bubble) so it's reachable mid-study. Single-tap expand.
- **Smart break cards.** Replace the plain break countdown with a rotating `<SmartBreakCard/>` (20-20-20 eye rest, box breathing, hydration nudge, stretch GIF, one NEXUS recall question seeded from `intent`). Card swaps every 30s.
- **Distraction intervention.** When `distractions >= 3` in a single block, show a non-blocking toast: "3 tab-switches — enable Strict mode?" → toggles `useDistractionTracker` strict flag that auto-marks the session "partial" if it hits 5.
- **Session log enrichment.** `onSessionLogged` callback receives `{ minutes, intent, distractions, focusScore, taskId? }` and writes to `study_sessions` with `subject_id` resolved from the active task (when launched from Blueprint) plus a `notes` field encoding `intent|distractions|score`.
- **Debrief AI tip.** After rating, call the new `debrief-session` action and display the one-liner inside `SessionDebrief`.
- **Theater mode mobile exit.** Add a persistent floating `×` in the top-right when `theater === true`.

---

## Technical details (skimmable)

```
src/
  hooks/
    useStudyProgress.ts         NEW — single source of truth for XP/level/today/week
  components/study-coach/
    blueprint/
      StudyPath.tsx             NEW — SVG zig-zag
      LifeProgress.tsx          NEW — level + quests + heatmap
      WeekRibbon.tsx            NEW — day strip
      PlanAdjusterSheet.tsx     NEW — preview diff
      AddTaskSheet.tsx          NEW — manual add
    focus/
      SmartBreakCard.tsx        NEW — rotating break content
      FocusCockpit.tsx          EDIT — wire real stats, persistent chat, theater × button
      SessionDebrief.tsx        EDIT — show AI tip from edge fn
  pages/
    StudyCoach.tsx              EDIT — use useStudyProgress, swap plan layout, enrich onSessionLogged
supabase/functions/study-coach/
  index.ts                      EDIT — prompt upgrade + new actions (adjust-preview, reshuffle, debrief)
```

DB: no schema changes. Bonus sessions already supported via `is_bonus`. Quest progress derived on read.

Out of scope this pass: co-focus rooms, calendar drag-drop, push notifications, mobile native app, new tables. Those can come next round.

---

## Open question

The plan is large but additive — no destructive rewrites. If you'd rather I land it in two waves (Bucket 1 + 2 first, then 3 + 4), say the word; otherwise I'll ship all four in one pass after you approve.
