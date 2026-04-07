

# Full Upgrade Plan: Settings Redesign, Background Music, Leaderboard Fix

## Overview

Fix the broken Leaderboard component causing build errors, redesign Settings to match the reference screenshots (single-scroll layout with grouped sections), and integrate the uploaded study music as background audio in Focus Hub and Blueprint.

---

## Step 1: Fix Leaderboard Build Errors

The `Leaderboard.tsx` file is a code snippet (not a valid React component). It's missing imports, component wrapper, state declarations, and named export.

**Rewrite as a complete component:**
- Add all imports (Dialog, DialogHeader, DialogTitle, Button, Tabs, TabsList, TabsTrigger, TabsContent, Trophy, Loader2, cn)
- Wrap in a proper `export function Leaderboard({ open, onOpenChange, userId })` component
- Add state: `activeTab`, `loading`, `entries`, `userScore`
- Add `loadLeaderboard` function calling the `leaderboard` edge function
- Move `RankingsTab` and `UserScoreCard` as internal sub-components
- Add `tierConfig` helper function

## Step 2: Redesign Settings Page (Match Screenshots)

Replace the current tab-based Settings with a single-scroll layout matching the reference images:

**Section 1 — Profile & Account** (card with header)
- Profile card (name, avatar, edit chevron)
- Email row with icon
- Study Selfies row (link to memories)
- Export Data row

**Section 2 — General** (card with green header label)
- Dark Mode toggle
- Timer Sound toggle
- Ringtone selector (collapsible)
- Push Notifications toggle
- Email Updates toggle
- Show Profile Picture toggle (leaderboard)

**Section 3 — About** (card with green header label)
- Share App row
- Privacy Policy row
- Terms of Service row
- Send Feedback row
- About StudyTime row (navigates to About page on desktop, inline on mobile)

**Section 4 — Danger Zone** (red-bordered card)
- Delete Account row (red text)
- Sign Out button (full-width, red)

**Design details:**
- Each row: icon in gray circle + label + chevron/toggle on right
- Section headers: colored label text (green for General/About, red for Danger Zone)
- Remove tabs entirely
- Single scroll, max-w-lg centered

## Step 3: Integrate Background Study Music

Copy the uploaded MP3 (`20_MINUTES_-_STUDY_WITH_ME...mp3`) to `public/audio/study-music.mp3`.

**Create `src/components/study-coach/BackgroundMusicPlayer.tsx`:**
- Compact player: play/pause button + music note icon
- Uses `HTMLAudioElement` with loop enabled
- Volume control (optional slider)
- Persists play state in localStorage
- Shows in Focus Hub header (top-right, next to Standing button)

**Integration points:**
- `StudyCoach.tsx`: Add music player button in header area (visible in both Focus and Blueprint modes)
- Auto-pause music when timer alarm fires
- Resume music option after alarm dismissed

## Step 4: Polish AI Chat Page (Match Screenshots)

Minor tweaks to match the reference:
- Header shows "New Chat" with hamburger menu icon + edit icon
- Welcome screen: centered greeting with task count from study plan
- Quick action chips: "Next task" and "My progress" cards with icons
- These elements already exist but ensure they match the screenshot styling

---

## Files to Create
- `src/components/study-coach/BackgroundMusicPlayer.tsx`

## Files to Modify
- `src/components/study-coach/Leaderboard.tsx` — complete rewrite (fix build)
- `src/pages/Settings.tsx` — redesign to single-scroll grouped layout
- `src/pages/StudyCoach.tsx` — add music player integration

## Files to Copy
- `user-uploads://20_MINUTES_-_STUDY_WITH_ME_...mp3` → `public/audio/study-music.mp3`

## No Database Changes Required

## Priority Order
| Priority | Step | Impact |
|----------|------|--------|
| Critical | 1 | Fixes build — app won't compile without this |
| High | 2 | Settings redesign matching reference screenshots |
| Medium | 3 | Background music for study sessions |
| Low | 4 | Minor AI Chat polish |

