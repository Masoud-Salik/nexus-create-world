

# Full Development Plan: Nexus Life Coach -- Lighter, Smarter, Offline-First

---

## Current State Summary

The app is an AI-powered student success platform with four main screens accessible via a bottom navigation bar:

1. **Study Coach** (home) -- AI-generated study plans, Pomodoro timer, task management
2. **AI Chat** -- Conversational AI life coach with memory
3. **The Future** -- AI scenario predictions (1Y/3Y/5Y), skill scores, daily coaching
4. **Settings** -- Account, theme, notifications, privacy

Additional pages exist (Activities, Biography, AI Memory, Friends, Skills, Interests) but are only accessible via the desktop sidebar -- they are hidden from mobile users.

**What works well:** PWA setup, service worker caching, offline queue system, local study plan caching, error boundary, install prompt, guest/demo mode for Study Coach.

**What needs improvement:** Several pages are desktop-only orphans, offline support is partial (only Study Coach truly works offline), the app ships large charting libraries, and many features lack the "light and fast" feel.

---

## Development Plan (14 Steps)

Each step is designed to be a single, focused change. Steps are ordered by impact and dependency.

---

### Phase 1: Make It Lighter

#### Step 1: Remove Unused Pages and Dead Code
Remove pages that are inaccessible on mobile and add unnecessary weight:
- Remove `Activities.tsx` (780 lines with recharts dependency -- heaviest page)
- Remove `Biography.tsx` (duplicate of CompactProfileCard in Settings)
- Remove `CommonScenario.tsx`, `SuccessScenario.tsx`, `Future.tsx`, `Lifecast.tsx` (unused legacy pages)
- Remove unused components: `LifecastDashboard.tsx`, `DailyCheckin.tsx`, `FocusTimer.tsx`, `DocumentsManager.tsx`, `IdeaVault.tsx`, `SituationPhotosManager.tsx`, `ShareToUpgradeDialog.tsx`, `AboutMeEditor.tsx`, `MemoryManager.tsx`
- Remove unused edge functions: `lifecast-predict`, `predict-scenario`, `generate-success-image`, `extract-user-data`

**Impact:** Removes ~2000+ lines of code and drops the recharts/charting bundle from the critical path.

#### Step 2: Lazy-Load Heavy Dependencies
- Move `recharts` imports behind `React.lazy()` boundaries so charts only load when actually viewed
- Ensure `react-markdown` and `react-syntax-highlighter` are only loaded within the Chat page
- Add dynamic imports for `date-fns` locale data

**Impact:** Smaller initial JS bundle, faster first paint.

#### Step 3: Deduplicate QueryClient
Currently, `QueryClient` is created in both `main.tsx` and `App.tsx`. Remove the one in `main.tsx` since `App.tsx` already wraps everything in its own `QueryClientProvider`.

**Impact:** Cleaner architecture, avoids potential context conflicts.

---

### Phase 2: Strengthen Offline Support

#### Step 4: Offline-Ready Study Coach (Complete the Loop)
The Study Coach already caches tasks locally via `useLocalStudyPlan`. Extend this:
- Use `offlineQueue` to queue task completions, starts, and skips when offline
- Register an `ActionProcessor` that syncs queued study actions to the database when back online
- Show a subtle "saved locally" indicator instead of errors when offline

**Impact:** Study Coach becomes fully functional offline -- the core feature works without internet.

#### Step 5: Offline-Ready Settings Page
- Cache profile data using `useOfflineData` hook (already exists but unused in Settings)
- Queue profile updates through `offlineQueue` when offline
- Disable features that require network (like feedback, export) with a visual "requires internet" badge

**Impact:** Users can view and edit their profile offline.

#### Step 6: Offline Fallback for AI Chat
- When offline, show a clear message: "Chat requires internet. Your study tasks are available offline."
- Cache the last 20 messages of the current conversation locally for reading
- Provide a "Quick note" input that saves to local storage and syncs as a message when online

**Impact:** Graceful degradation instead of broken errors.

#### Step 7: Offline Fallback for The Future
- Cache the most recent scenarios, skill scores, and daily coach message using `useOfflineData`
- Display cached data with a "Last updated X ago" indicator
- Disable refresh/generate buttons when offline

**Impact:** Users can review their predictions and scores without internet.

---

### Phase 3: Improve Core UX

#### Step 8: Unified Navigation Cleanup
- Add Activities tracking directly into the Study Coach page as a lightweight "Daily Check-in" card (mood + quick note, no charts)
- Move AI Memory and Biography sub-pages (Skills, Interests, Friends) into the Settings "More" tab as links
- Update the desktop sidebar to match the 4-tab mobile navigation exactly

**Impact:** One consistent navigation model across all devices. No orphan pages.

#### Step 9: Smart Pomodoro Timer Improvements
- Use the existing `timer-worker.js` Web Worker in the Pomodoro timer (currently it uses `setInterval` which throttles in background tabs)
- Add notification sound using Web Audio API (no external files needed)
- Add browser Notification API permission request and fire notification when timer completes
- Persist running timer state to localStorage so it survives page refresh

**Impact:** Timer actually works reliably in background tabs -- critical for a study app.

#### Step 10: Haptic Feedback and Micro-Interactions
- Add `navigator.vibrate()` calls on task completion, timer finish, and button presses (Android only, graceful fallback)
- Add subtle CSS transitions for task status changes (pending -> in_progress -> completed)
- Add a confetti-like particle effect on study session completion (CSS-only, no library)

**Impact:** The app feels more native and rewarding without adding weight.

#### Step 11: Skeleton Loading States
- Replace the generic spinner (`<Loader2>`) on Study Coach, The Future, and Settings with skeleton placeholders that match the layout
- Use the existing `skeleton.tsx` UI component

**Impact:** Perceived performance improvement -- pages feel faster.

---

### Phase 4: Scientific and Advanced Features

#### Step 12: Study Analytics Mini-Dashboard
- Add a collapsible "This Week" stats section to the Study Coach page
- Show: total minutes studied, tasks completed vs. skipped ratio, streak count, daily breakdown as a simple CSS bar chart (no recharts needed)
- Data comes from local cache + `study_sessions` table
- Cache analytics data for offline viewing

**Impact:** Scientific progress tracking without heavy charting libraries.

#### Step 13: Focus Score Algorithm
- Calculate a real-time "Focus Score" (0-100) based on:
  - Completion rate (completed / total tasks)
  - Time accuracy (actual time vs. planned time)
  - Consistency (streak days / 7)
  - Skip penalty
- Display as a circular progress indicator on the Study Coach header
- Update locally as tasks are completed (instant feedback)
- Sync to `skill_scores` table periodically

**Impact:** Scientifically-grounded metric that gives users actionable insight into their study behavior.

#### Step 14: Spaced Repetition Hints
- When generating study plans, pass previous session data to the AI with a prompt instruction to apply spaced repetition principles
- Add a "Review" tag to tasks that revisit previously-studied topics
- Show a small "science tip" tooltip explaining why a topic is being revisited

**Impact:** Integrates evidence-based learning science into the AI-generated plans.

---

## Technical Details

### Files to Create
- `src/components/study-coach/OfflineSync.tsx` -- Offline queue processor for study actions
- `src/components/study-coach/WeeklyMiniStats.tsx` -- Lightweight weekly stats (CSS bars)
- `src/components/study-coach/FocusScoreRing.tsx` -- Circular focus score display
- `src/components/SkeletonLoaders.tsx` -- Page-specific skeleton layouts

### Files to Modify
- `src/pages/StudyCoach.tsx` -- Add offline sync, focus score, mini stats, worker-based timer
- `src/pages/TheFuture.tsx` -- Add `useOfflineData` caching
- `src/pages/Index.tsx` -- Add offline fallback UI, message caching
- `src/pages/Settings.tsx` -- Add offline profile caching, integrate AI Memory link
- `src/components/MobileBottomNav.tsx` -- No changes needed (already clean)
- `src/components/AppSidebar.tsx` -- Align with mobile nav items
- `src/components/study-coach/PomodoroTimer.tsx` -- Switch to Web Worker, add notifications
- `src/App.tsx` -- Remove routes for deleted pages
- `src/main.tsx` -- Remove duplicate QueryClient
- `vite.config.ts` -- Potentially expand workbox caching patterns

### Files to Delete
- `src/pages/Activities.tsx`, `CommonScenario.tsx`, `SuccessScenario.tsx`, `Future.tsx`, `Lifecast.tsx`
- `src/components/LifecastDashboard.tsx`, `DailyCheckin.tsx`, `FocusTimer.tsx`, `DocumentsManager.tsx`, `IdeaVault.tsx`, `SituationPhotosManager.tsx`, `ShareToUpgradeDialog.tsx`, `AboutMeEditor.tsx`, `MemoryManager.tsx`
- `src/components/InsightsPanel.tsx` (only used in Chat, can be inlined or removed)

### Dependencies
- No new dependencies needed
- `recharts` can potentially be removed entirely if Activities page is deleted and mini-stats use CSS

### Database
- No schema changes required -- all existing tables support these features

---

## Priority Order for Implementation

| Priority | Steps | Theme |
|----------|-------|-------|
| High | 1, 3, 4, 9 | Remove bloat, fix core offline, fix timer |
| Medium | 5, 6, 7, 8, 11 | Complete offline coverage, unify navigation |
| Lower | 2, 10, 12, 13, 14 | Polish, analytics, scientific features |

Each step is independent enough to be implemented one at a time to stay within credit limits.

