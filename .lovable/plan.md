# StudyCoach UI Overhaul

## 1. Blueprint Tab Redesign — Game-Like Experience

Transform the Blueprint tab from a simple task list into an engaging, game-inspired study quest interface (inspired by the first screenshot):

**Layout changes:**

- Add a **"Today's Progress" bar** at the top with percentage and visual progress indicator
- Show **time remaining** and **tasks completed** as pill badges below progress
- Redesign task cards with a left-aligned **subject icon badge**, bold subject name, truncated topic, duration + difficulty badge, and a prominent green **"Start"** button — matching the screenshot style
- Cards get a dashed border with subject color accent
- When all tasks are completed, show a **"Break The Rules"** bonus section — gamified with language like "You crushed your plan. But legends don't stop here." with bonus session options (15m, 25m, 45m) styled as challenge cards with XP multiplier badges

**Files:** `StudyCoach.tsx`, `NextTaskCard.tsx`, `TaskPills.tsx`, `CompactStatsBar.tsx` (replace pills with full card list)

## 2. Disable Mobile Zoom

Currently, the AI chat & Blueprint are zoomed in by default. Fix the issue by making each page fit to the screen(mobile focused).

## 3. Clean Up Focus Hub Header

- **Remove** "Study Hub" text from top-left
- Replace with a single-line date: e.g. "Friday, May 8" in clean typography
- Streak badge stays inline next to date
- **Remove** the Standing button from the header entirely (merged into Stats tab)
- **Reduce** music player container size by 10%
- Make the segmented control (Focus/Blueprint/Stats) slightly smaller — reduce padding and font size

**Files:** `StudyCoach.tsx`, `BackgroundMusicPlayer.tsx`

## 4. Merge Standing (Leaderboard) into Stats Tab

- Remove the Standing button from the header
- Add a "Rankings" section at the bottom of the `StudyAnalytics` component that shows the user's rank, tier, and a button to open the full leaderboard dialog
- The leaderboard dialog itself stays as-is

**Files:** `StudyCoach.tsx`, `StudyAnalytics.tsx`

## 5. Floating AI Chat — Better Positioning + Blueprint Support

- Show `FloatingAIChat` in **both** Focus and Blueprint modes (currently Focus only)
- Change snap positions to avoid overlapping content:
  - In Focus mode: 1. bottom-right, above the bottom nav but below the timer controls. 2, Under the "Stats" text, above the timer ring control. 3. Under the "Focus" text, above the timer ring control. No Ovarlap.
  - In Blueprint mode: 1. bottom-right, above the bottom nav. 2. to clock 2 of the running time, above the timeline. 3. bottom left as there is much free space.
- Use `bottom` + `right` fixed positioning instead of `top` percentage to anchor relative to bottom nav...
- Single snap position: fixed at `bottom: 80px, right: 16px` — no dragging complexity, just a clean floating button that doesn't obstruct any content

**Files:** `FloatingAIChat.tsx`, `StudyCoach.tsx`

---

### Technical Notes

- No new dependencies needed
- All changes are CSS/layout focused except the Blueprint card redesign
- The "Break The Rules" bonus section reuses existing bonus session logic but with more engaging copy and styling
- Viewport zoom lock uses standard mobile web meta tags