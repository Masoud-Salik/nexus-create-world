## Goal
Make Focus Hub and Blueprint feel tidy, native, and viewport-locked on mobile — no horizontal overflow, no visual noise, no overlap with the bottom nav or floating chat. Desktop stays untouched.

## Focus Hub — mobile cleanup

1. **Compact the stats strip** (`FocusStatsStrip`)
   - Collapse into a single-row pill: `🔥streak · Lvl · XP mini-bar · today/goal`, tabular numbers, `text-[11px]`.
   - Hide any secondary labels below `sm` breakpoint.

2. **Slim the Pre-Flight card** (`PreFlight.tsx`)
   - Group Intent + Energy in one card, Duration + Soundscape in a second card (rounded-2xl bg-card).
   - Duration chips: shrink to `px-3 py-1.5 text-[11px]`, snap-x scroll, remove horizontal padding leak with `-mx-4 px-4 snap-x`.
   - Energy + Soundscape grids: reduce vertical padding, drop the emoji size on mobile.
   - Move the "60s breathing primer" from a full-width card into a small inline toggle row above the Launch button.
   - Launch button: sticky at the bottom of the PreFlight (not the page) with subtle shadow, so it's always reachable on short phones.

3. **Active session (`FocusCockpit`)**
   - Ring size responsive: `min(300, 78vw)` on mobile (currently fixed 300 clips on 360px screens with padding).
   - Secondary controls row: reduce to 3 icon-buttons (reset · sound · theater), each `h-9 w-9`, gap-1.5, centered.
   - Sound sheet trigger: emoji-only on mobile (label already hidden), fine.
   - Remove the "🌱 Deep work is being deposited" caption on mobile (it eats space and adds noise); keep on `sm+`.
   - Theater X: keep, already correct.

4. **Container hygiene**
   - Wrap FocusCockpit root in `w-full max-w-full overflow-x-hidden` (already partial) and add `px-1` so ring shadow doesn't clip.
   - Ensure `AuroraBackground` uses `overflow-hidden` on parent so blurred blobs never trigger horizontal scroll (verify current `-inset-[20%] blur-3xl` doesn't leak on 360px — clamp to `-inset-[10%]` on mobile).

5. **Mid-session Floating AI**
   - Anchor to a safe spot below the ring on mobile (avoid the ring/control overlap) and above the bottom nav (`bottom: calc(56px + env(safe-area-inset-bottom) + 12px)`).

## Blueprint — mobile cleanup

1. **Remove the fixed full-screen overlay pattern**
   - Current: Blueprint uses `fixed inset-0 bottom-[56px] z-40` on mobile with its own header/close button. This creates a second page-inside-a-page that competes with the top segmented control.
   - Change: render Blueprint inline like Focus and Stats — same segmented control stays visible; drop the mobile-only header/close.

2. **Tighten LifeProgress + WeekRibbon**
   - LifeProgress: reduce to 2 rows (Level + XP bar row / quests pips row), collapse heatmap into a single 7-day strip.
   - WeekRibbon: shrink day cells to `w-9 h-11`, `text-[10px]` label, use gap-1.

3. **StudyPath tidy-up**
   - Reduce `NODE_SIZE` from 56 → 48 on mobile; `ROW_H` 96 → 80; recompute total height.
   - Cap `maxWidth: 100%` (already there) and set container `px-1` to keep ring shadows in-frame.
   - Label under each node: keep only duration on mobile (subject shown in sheet).

4. **Day header + Adjust button**
   - Stack on a single row with `text-xs`; move "Adjust" into a small icon+text chip already; keep.

5. **"Break The Rules" card**
   - Reduce padding (`p-4`) and button size (`px-3 py-2`), keep the celebratory feel but stop it from pushing content off-screen.

6. **Empty state**
   - Shrink the 20×20 sparkle circle to `h-14 w-14` on mobile, `text-lg` heading.

## Global mobile safeguards (StudyCoach page shell)

- Add `overflow-x-hidden` to the outer wrapper (already present) and to each mode's inner wrapper.
- Ensure `max-w-lg mx-auto` container has `w-full min-w-0` so flex children can shrink.
- Guarantee bottom padding accounts for `MobileBottomNav` (56px) + safe-area on every mode content.
- FloatingAIChat: pass a `bottomOffset` prop so both Focus and Blueprint place it above nav without overlapping the "Break The Rules" card or the ring controls.

## Files to edit

- `src/pages/StudyCoach.tsx` — remove Blueprint fixed overlay, unify mode rendering, tighten paddings.
- `src/components/study-coach/focus/FocusCockpit.tsx` — responsive ring size, compact controls row, mobile caption gating.
- `src/components/study-coach/focus/PreFlight.tsx` — grouped cards, inline breathing toggle, smaller chips.
- `src/components/study-coach/focus/FocusStatsStrip.tsx` — single-row compact pill.
- `src/components/study-coach/focus/AuroraBackground.tsx` — clamp inset on mobile.
- `src/components/study-coach/focus/FocusRing.tsx` — accept responsive size or clamp internally.
- `src/components/study-coach/blueprint/StudyPath.tsx` — smaller node/row on mobile.
- `src/components/study-coach/blueprint/LifeProgress.tsx` — condense rows.
- `src/components/study-coach/blueprint/WeekRibbon.tsx` — smaller cells.
- `src/components/study-coach/FloatingAIChat.tsx` — respect bottom nav offset.

## Non-goals
- No backend or logic changes.
- No new features; visual/layout only.
- Desktop layout untouched (all changes gated by mobile breakpoints where they'd differ).
