

# Full Upgrade Plan: Leaderboard, Blueprint, and AI Intelligence

## Overview

Three major upgrades: (1) Rich leaderboard with country flags, live studying indicators, XP visualization, and professional "My Progress" tab; (2) Blueprint with smart AI plan adjuster, motivational bonus rounds with 1.5x XP, and polished subject manager; (3) A truly intelligent AI with tool-calling, personality, full app access, auto-naming, and multi-model fallback.

---

## Step 1: Create the `chat` Edge Function

The app references `functions/v1/chat` but the function doesn't exist. Create `supabase/functions/chat/index.ts` with:

- **System prompt**: NEXUS personality — helpful tutor, friendly professional motivator. Knows app features (Focus Hub, Blueprint, Leaderboard, Subjects). Uses user profile context (name, country, goals, subjects, streak, study stats).
- **Tool-calling**: Define tools the AI can invoke:
  - `get_study_plan` — fetch today's tasks
  - `get_weekly_overview` — weekly stats summary
  - `manage_subjects` — add/delete/list subjects
  - `generate_plan` — trigger AI plan generation (daily/weekly/monthly)
  - `adjust_plan` — adjust today's plan (less_time/tired/push_harder)
  - `get_user_profile` — fetch user info
  - `update_task_status` — mark tasks complete/skip
- **Multi-round tool loop**: Up to 5 rounds of tool calling before final response
- **Multi-model fallback**: Try `google/gemini-3-flash-preview` first. On 429/error, fallback to `google/gemini-2.5-flash`, then `google/gemini-2.5-flash-lite`. Never stop responding.
- **Streaming SSE** response back to client
- **Auto-title**: Already handled by `generate-chat-title` function — no changes needed

## Step 2: Database Migration — Add `country` flag support to leaderboard

- Add `country` column to `leaderboard_opt_ins` table (text, nullable)
- Add `is_studying` column to `leaderboard_opt_ins` table (boolean, default false, updated when user starts a study session)
- Create a trigger or rely on client-side updates to set `is_studying = true` when a task starts, `false` when it ends

## Step 3: Upgrade Leaderboard Edge Function

Update `supabase/functions/leaderboard/index.ts`:
- Include `country` and `is_studying` in leaderboard queries
- Add "Global" (all-time) and "Friends" tab data alongside "This Week"
- Return top-3 highlight cards: Top Streak, Most Hours, Best Consistency (matching screenshots)
- Return XP progress bar data: current XP, XP for next level, level number

## Step 4: Redesign Leaderboard Component

Rewrite `src/components/study-coach/Leaderboard.tsx` to match screenshots:

**Header card**: Tier badge icon + "Unranked Tier / Level 1" + PTS score + XP progress bar + 4-stat row (Hours, Streak, Days, Tasks%)

**Rankings tab**:
- Sub-tabs: "This Week" / "Global" / "Friends" (pill buttons)
- Top-3 highlight cards: TOP STREAK (flag + name + days), MOST HOURS (flag + name + hours), CONSISTENCY (flag + name + days)
- Player rows: avatar placeholder + flag emoji + name + streak/hours + tier badge + score. Green dot if `is_studying`.
- Current user highlighted

**My Progress tab**:
- Achievements card: "0/10 unlocked" with progress
- Badges card: "0/10 unlocked" with badge grid
- Weekly trend chart (CSS-only bars for last 4 weeks)
- Insight text from backend

**Leaderboard name** linked to `profiles.name` — read from profile, editing only in Settings.

## Step 5: Upgrade Subject Manager UI

Rewrite `src/components/study-coach/SubjectManager.tsx` to match screenshot (image-10):
- Visual icon picker: 8 icon circles (book, calculator, pen, globe, flask, language, music, atom) with selected highlight ring
- Color picker: 8 color circles (blue, green, orange, red, purple, pink, cyan, orange) with selected ring
- Weekly target: 3 pill buttons (2h, 5h, 10h) + custom minutes input
- Full-width green "Add Subject" button
- Cleaner card layout

## Step 6: Upgrade Smart Adjust Dialog UI

Update the adjust dialog in `StudyCoach.tsx` to match screenshot (image-11):
- Each option gets a colored background tint: blue for "Less time", yellow for "I'm tired", red for "Push harder"
- Emoji icons instead of lucide icons: ⏰, 😴, 🔥
- Right-side icon indicator
- Rounded card style with colored borders

## Step 7: Blueprint Bonus Round System

When all daily tasks are completed:
- Replace "All done for today!" with a motivational "Bonus Round" card
- "Keep going for 1.5x XP!" messaging
- Quick-start buttons for extra sessions (15m, 25m, 45m)
- Bonus sessions logged to `study_sessions` with a `is_bonus` flag (add column via migration)
- XP multiplied by 1.5x in leaderboard score computation for bonus sessions

**Migration**: Add `is_bonus` boolean column (default false) to `study_sessions` table.

## Step 8: Update Leaderboard Score for Bonus XP

Update `supabase/functions/leaderboard/index.ts`:
- When computing weekly score, check `is_bonus` on sessions
- Bonus session minutes count as `minutes * 1.5` toward study_hours
- This naturally rewards users who exceed their daily plan

## Step 9: Wire AI Chat to New Edge Function

Update `src/pages/Index.tsx`:
- When AI returns tool calls, execute them by calling the appropriate Supabase functions/queries
- Display tool results inline (e.g., "Here's your study plan for today:" with formatted task list)
- On rate limit (429), show toast "Switching to faster model..." and retry with fallback — handled server-side transparently

## Step 10: Client-Side `is_studying` Updates

In `StudyCoach.tsx`:
- When `handleStartTask` is called, update `leaderboard_opt_ins` set `is_studying = true`
- When task completes/cancels, set `is_studying = false`
- This enables real-time "currently studying" indicators on the leaderboard

---

## Files to Create
| File | Purpose |
|------|---------|
| `supabase/functions/chat/index.ts` | AI chat with tools, personality, multi-model fallback |

## Files to Modify
| File | Changes |
|------|---------|
| `src/components/study-coach/Leaderboard.tsx` | Full redesign with flags, XP, tabs, highlights |
| `src/components/study-coach/SubjectManager.tsx` | Visual icon/color picker matching screenshot |
| `src/pages/StudyCoach.tsx` | Bonus round UI, is_studying updates, adjust dialog styling |
| `src/pages/Index.tsx` | Wire to new chat function, handle tool-call results |
| `supabase/functions/leaderboard/index.ts` | Country, is_studying, bonus XP, global/friends tabs |

## Database Migrations
1. `leaderboard_opt_ins`: add `country` (text, nullable), `is_studying` (boolean, default false)
2. `study_sessions`: add `is_bonus` (boolean, default false)

## Priority Order
| Priority | Steps | Impact |
|----------|-------|--------|
| Critical | 1 | Chat function doesn't exist — AI chat is broken without it |
| High | 2, 3, 4 | Leaderboard with flags, XP, live indicators |
| High | 7, 8 | Bonus round motivation system |
| Medium | 5, 6 | Subject manager and adjust dialog UI polish |
| Medium | 9, 10 | AI tool integration and studying indicators |

