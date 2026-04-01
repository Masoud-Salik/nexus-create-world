# Plan: Fix Build Errors and Restore StudyTime to Working State

## Problem

The current commit has build errors from dead/unused code that was added during an architecture refactoring attempt ("~5k lines backup"). These files are not imported by any active routes but still cause TypeScript compilation failures.

## What the user wants

Restore the app to the "Mar 17 at 10:17 PM" version — the most developed version with the best AI chatbot, settings, and About section. Since that version cannot be reverted to via History, we need to fix the current build errors first to get a working baseline.

## Step 1: Remove Dead/Unused Files (fixes all build errors)

These files are **never imported** by any active code in the web app and contain all the build errors:


| File                                                  | Error                               | Why it's dead code               |
| ----------------------------------------------------- | ----------------------------------- | -------------------------------- |
| `src/application/hooks/useErrorHandler.ts`            | Missing `../services/ErrorHandling` | Not imported anywhere            |
| `src/application/hooks/useOfflineSync.ts`             | Missing `../services/SyncService`   | Not imported anywhere            |
| `src/application/hooks/usePerformanceOptimization.ts` | Type mismatch                       | Not imported anywhere            |
| `src/pages/StudyCoachRefactored.tsx`                  | Many type errors                    | Not used in any route            |
| `src/shared/components/TaskCard/TaskCard.tsx`         | Missing model import                | Not imported anywhere            |
| `src/shared/components/Timer/Timer.tsx`               | `NodeJS` namespace                  | Not imported anywhere            |
| `src/shared/components/index.ts`                      | Re-exports broken modules           | Not imported anywhere            |
| `src/core/infrastructure/storage/OfflineStorage.ts`   | `require` without node types        | Only used by dead useOfflineSync |
| `src/core/infrastructure/sync/SyncService.ts`         | (if exists)                         | Only used by dead code           |


## Step 2: Fix Remaining Active File Errors

1. `**src/components/ErrorBoundary.tsx**` — Replace `process.env.NODE_ENV` with `import.meta.env.DEV` (Vite-compatible).
2. `**src/application/stores/authStore.ts**` and `**src/application/stores/studyStore.ts**` — zustand IS in package.json, so this is likely a type resolution issue. Will verify and fix (may just need the package to be installed, or the stores are only used by `StudyCoachRefactored.tsx` and mobile code — if so, they can be removed too).

## Step 3: Confirm Working State

After fixes, the app should build and run with:

- **AI Chat** page (Index.tsx) — full chatbot with conversation history, SSE streaming, context gathering
- **Focus Hub** page (StudyCoach.tsx) — Pomodoro timer + AI study plan with subjects, tasks, leaderboard
- **Settings** page — Profile, theme, notifications, ringtone, privacy, feedback, data export, delete account
- **Mobile bottom nav** + **Desktop sidebar** navigation

## What's Missing vs "Mar 17 at 10:17 PM" Version

Based on your description, after the build is fixed, we may need to add:

1. **About section** as a separate desktop menu item (currently not present)
2. Any AI/chatbot improvements that were in that version
3. Any settings enhancements from that version 
4. And more

I will fix the build errors first, then we can compare the running app to identify any missing features from the target version.

## Technical Details

- Total files to delete: ~8-9 dead files
- Total files to edit: 1 (`ErrorBoundary.tsx`)
- No database changes needed
- No new dependencies needed