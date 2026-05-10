# Fix pack: usability, persistence, guest mode, notifications

## 1. Chat conversation page zoom
The chat reply view scrolls/scales beyond viewport. Add `h-[100dvh] overflow-hidden` containers to `pages/Index.tsx` chat layout, ensure message list uses `flex-1 min-h-0 overflow-y-auto`, cap composer with `shrink-0`. Verify viewport meta already locks zoom (it does).

## 2. Sign-in inline in Settings
In `Settings.tsx` (lines ~176): replace `navigate("/chat")` Sign In/Up buttons with an inline `<AuthDialog />` (reuse `components/Auth.tsx` inside a `Dialog`). Auth happens without leaving Settings.

## 3. "Manage GPT models" inline card
In `AIProvidersSection.tsx` change the "Manage" CTA so it opens an inline collapsible/Dialog with model selector + default toggle + disconnect — no navigation.

## 4 & 10. Persistent timer across navigation + refresh
Already-global `GlobalTimerContext` survives route changes (so #4 should already work — verify no `stop()` is being called on unmount of `StudyCoach`/music player). Add:
- On state change, persist `{type, startedAt, totalSeconds, pausedElapsed, isRunning, taskData, pomodoroData}` to `localStorage` key `studytime.timer.v1`.
- On `GlobalTimerProvider` mount, hydrate: if `isRunning`, recompute elapsed from wall clock (`Date.now() - startedAt + pausedElapsed`) and resume worker with remaining seconds; if finished while away, trigger alarm/done card.
- Same for `BackgroundMusicPlayer` (persist playing + position).

Audit `StudyCoach.tsx` and `BackgroundMusicPlayer.tsx` for any `stop()` calls in cleanup effects and remove them.

## 5. Guest mode (frictionless first impression)
Already partly supported per memory. Ensure:
- Landing → "Try as Guest" CTA leads directly to `/` (StudyCoach) without auth.
- In guest mode: Blueprint timer, Pomodoro, music, Quick AI chat (rate-limited, no history persistence) all work locally via `useLocalStudyPlan` + localStorage.
- Persistent gentle banner: "Save your progress — Sign up" (dismissible, reappears after 1 day).
- Gate only: leaderboard, AI memories, cross-device sync, ChatGPT connection.

## 6. Goal-based daily reminders (max 4/day)
- Use existing `goals` + `habits` data + Web Notifications API + Service Worker.
- New hook `useStudyReminders`: on app load, request permission once (soft prompt card in Settings, not on first visit). Schedule up to 4 local notifications/day at smart times derived from `time_of_day` patterns in `daily_activities` (default: 10:00, 14:00, 18:00, 20:30). Skip a slot if user already studied within last 2h (check `study_sessions`).
- Copy is Duolingo-style ("Your goal misses you 🦉 — 10 min of [subject]?") and includes the active goal title.
- Settings toggle under Notifications: "Daily study reminders".
- Background delivery via existing `sw-timer.js` / service worker `showNotification` triggered by stored schedule on SW activation; refresh schedule when app opens.

## 7. Rename Study Selfies → AI Memories (merged page)
- Rename Settings entry "Study Selfies" → "Memories".
- New `pages/Memories.tsx` (or section) with two tabs: **Photos** (existing `study_selfies`) and **Insights** (existing `user_insights` from `AIMemory.tsx`).
- Redirect `/ai-memory` → `/memories`. Remove duplicated AI Memory link.

## 8. AI Memory / chat zoom oversize
Same root cause as #1 — pages use intrinsic heights causing overflow under `maximum-scale=1`. Wrap `AIMemory.tsx` and chat reply view in `h-[100dvh] overflow-y-auto` with proper `max-w-screen-sm mx-auto px-4` and remove any fixed pixel widths > viewport.

## 9. Reposition Quick AI chat FAB to 60° on timer ring
In `FloatingAIChat.tsx` (positioning) compute placement relative to the Focus ring center. The 14px-stroke ring center is fixed in `StudyCoach.tsx` Focus Hero. Add an anchor: position FAB at `angle = 60°` from ring center (top-right diagonal-ish), radius = ring-radius + 28px so it sits just outside the stroke, never overlapping ring or text. On Blueprint page, mount FAB at a safe bottom-right offset (above bottom nav, clear of cards). Use `position: absolute` inside the ring's relative wrapper; on small screens fall back to anchored bottom-right with same 60° visual.

## Technical notes
- No DB schema changes. All storage = localStorage + existing tables.
- Service worker: extend `public/sw-timer.js` to handle scheduled notifications (`registration.showNotification`) and a `SCHEDULE_REMINDERS` postMessage.
- Files touched (approx):
  - `src/contexts/GlobalTimerContext.tsx` (persist+hydrate)
  - `src/components/study-coach/BackgroundMusicPlayer.tsx` (persist)
  - `src/pages/Index.tsx`, `src/pages/AIMemory.tsx` (layout fix)
  - `src/pages/Settings.tsx` (inline auth, rename, notif toggle)
  - `src/components/settings/AIProvidersSection.tsx` (inline manage)
  - `src/components/study-coach/FloatingAIChat.tsx` (FAB position)
  - new `src/pages/Memories.tsx`, `src/hooks/useStudyReminders.ts`
  - `public/sw-timer.js` (scheduled notifications)
  - `src/App.tsx` (route `/memories`, redirect `/ai-memory`)
  - `src/components/Auth.tsx` reused as dialog
- Guest mode wired via existing auth memory rules.
