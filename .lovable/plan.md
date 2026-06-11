
# Focus Hub — Major Upgrade Plan

## 1. Current State (audit)

**Strengths**
- Solid wall-clock-synced global timer (`GlobalTimerContext` + service worker) with persistence and background notifications.
- Clean SVG ring, gradient stroke, scrub-bar duration selector, preset chips, session pips (6/day), short motivational quote.
- Background music + alarm/ringtone system already wired in.
- Mode toggle (Focus / Blueprint / Stats) and a `FloatingAIChat` anchored near the ring.

**Weaknesses & gaps (vs Forest, Centered, Flow Club, Endel, Brain.fm, Notion Calendar, Duolingo)**

1. **Static & shallow**: ring + numbers + start. No environment, no narrative, no immersion. Looks like every other Pomodoro app.
2. **No adaptive intelligence**: duration is manual; doesn't learn from completion rate, time-of-day energy (we already collect `daily_checkins`), prior session quality, or weekly deficit.
3. **No real "focus" affordances**: no full-screen Deep Focus / theater mode, no distraction shield (tab-switch / blur detection), no commitment device, no "what are you focusing on?" intent capture before each session.
4. **Weak feedback loop**: session ends → toast → break. No reflection (1-tap rating), no flow score, no streak-of-the-day visualization, no XP/level tie-in (we already have `src/utils/xp.ts`).
5. **Ambient/audio is one button**: just lo-fi on/off. No soundscape picker (rain, café, forest, brown noise, binaural beta/alpha), no per-soundscape volume mix, no ducking when alarms play (we have global music but not layered ambience).
6. **No breathing / transition rituals**: studies show 30-60s pre-session priming dramatically lifts focus quality. We jump straight in.
7. **Break time is dumb**: forced 5-min coffee break. No micro-stretch prompts, eye-rest (20-20-20), hydration nudge, breathing exercise, or AI-suggested break activity.
8. **No social / ambient presence**: no "X people focusing right now" counter (we already have leaderboard infra), no co-focus rooms.
9. **NEXUS chat is decorative on the focus screen**: it's not session-aware — can't auto-ask "what's blocking you?" mid-pause, can't summarise the session, can't generate a 60-second recall quiz at the end.
10. **Stats inside Focus Hub are absent**: today's focus minutes, current streak, best session, weekly focus heatmap aren't visible without leaving the screen.
11. **Accessibility & ergonomics**: no haptic patterns per phase, no reduced-motion path for the pulsing ring, contrast on `text-info` break state, no keyboard shortcuts (space=pause, R=reset, B=break).
12. **`StudyTaskTimer` feels disconnected** from the polished Pomodoro UI — different fonts, different controls, no shared "focus chrome".

---

## 2. Vision

A **Focus Cockpit** — cinematic, scientific, alive. Inspired by:
- **Endel / Brain.fm** — adaptive soundscapes tuned to focus state.
- **Flow Club / Centered** — pre-flight ritual + intent capture + flow score.
- **Forest** — commitment device & visible growth.
- **Apple Fitness rings** — daily progress always visible.
- **Linear / Arc** — restrained, premium, keyboard-first.

Three layers:

```text
┌──────────────────────────────────────────────┐
│  AMBIENT LAYER   (background scene + audio) │
│  ┌────────────────────────────────────────┐ │
│  │  COCKPIT       (ring, intent, HUD)     │ │
│  │  ┌──────────────────────────────────┐  │ │
│  │  │  NEXUS COPILOT (slide-in pill)   │  │ │
│  │  └──────────────────────────────────┘  │ │
│  └────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

---

## 3. Feature Upgrades

### A. Pre-Flight Ritual (3-tap launch)
Before the timer starts:
1. **Intent**: "What are you focusing on?" — single-line input, auto-suggests from today's tasks / recent topics. Saved with session.
2. **Energy check**: 3 emoji chips (🥱 / 🙂 / 🔥). Maps to recommended duration:
   - 🥱 → 20-25m, easy material
   - 🙂 → 45m default
   - 🔥 → 60-90m deep block
3. **Soundscape**: 6 presets (Silence, Lo-fi, Rain, Café, Forest, Brown Noise, Binaural 14Hz). Remembers last choice per energy.
4. **60-second breathing primer** (skippable): box-breath SVG animation, ring pre-fills as countdown finishes → seamless transition into focus.

### B. Adaptive Session Engine
Server util `adaptiveDuration(userId)`:
- Reads last 14 days of `study_sessions`, average completion ratio, current `daily_checkin` energy, time-of-day (we have `time-aware-ai-system`), weekly target deficit from `weekly_goals`.
- Returns suggested duration + confidence + science reason ("Your 9-11am completion rate is 92% on 45m blocks").
- Surfaced as a dismissible "✨ Suggested: 45m" chip above the scrub bar; user can accept with one tap.

### C. Cinematic Cockpit (visual upgrade)
- **Aurora background**: subtle CSS conic-gradient that slowly rotates while running, tinted by subject color or soundscape (rain=cool blue, forest=emerald, café=warm amber). Reduced-motion fallback = static gradient.
- **Dual-ring design**: outer ring = current session progress; inner thin ring = daily focus goal (e.g., 4h target). Daily progress always visible.
- **Center stack**: intent text (12pt), monospaced HH:MM:SS, finish time, "🌱 growing" micro-status.
- **Pulse & glow** tied to phase: green at 70%, gold at 100%, red countdown <10s.
- **Theater mode** (`F` key or button): hides nav, sidebar, status bars — true full-screen focus.

### D. Distraction Shield
- Listen for `document.visibilitychange` + `window.blur`. Each tab-switch during an active session increments a `distractions` count and dims the ring slightly.
- End-of-session card shows "Focus Score" = duration weight × (1 − distractions/threshold) × completion ratio.
- Optional "Strict mode" toggle: if user switches away >3 times, session is auto-marked Partial. Pure client-side; no permissions needed.

### E. Layered Soundscapes
- New `useSoundscape` hook with Web Audio API: 6 looping audio sources mixable, each with its own gain. Master volume + per-track sliders behind a small "🎚 Mix" sheet.
- Auto-ducks to 30% when alarm plays, restores after.
- Persists last mix to localStorage.
- All audio lazy-loaded (only fetched when first selected) to keep bundle small.

### F. Smart Breaks
- After a focus block, micro-card rotates through:
  - 20-20-20 eye rest (visual cue)
  - 4-7-8 breathing
  - Quick stretch GIF (CSS-only stick figure)
  - Hydration nudge (every 3rd break)
  - NEXUS-generated 30s recall quiz from the just-completed intent ("Name 3 things you just learned about X").
- Break length adapts: 5m after 25-45m focus, 10m after 60-90m, 15m every 4 sessions (long break rule).

### G. Session Debrief
End card replaces current toast:
- ⭐ rating chips (1-3): Flow / OK / Distracted
- Auto-computed Focus Score (0-100) + XP earned (via `src/utils/xp.ts`)
- "What did you accomplish?" → 1-line input, saved as session note.
- One-tap: Start Next, Take Break, End for the Day.

### H. NEXUS in-Focus Copilot
Upgrade `FloatingAIChat` with `mode="focus"`:
- Auto-seeds: intent, elapsed, distractions, subject.
- Three quick-action chips during pause: "I'm stuck", "Explain this concept", "Quiz me 60s".
- Post-session: auto-prompt "Want a 3-bullet recap?" — uses session intent + duration.

### I. Always-Visible Stats Strip
Slim header strip above the ring:
- 🔥 Streak  |  ⏱ Today XmXX of goal  |  🏆 Level N (Xxp to next)  |  🌎 1,247 focusing now (live count from `weekly_leaderboard` rollup or a lightweight realtime presence).

### J. Keyboard & Haptics
- `Space` pause/resume, `R` reset, `F` theater, `B` break, `M` mute, `1/2/3` energy.
- Haptic patterns: 10ms tap on start, double-tap on 70%, triple on done. Respect Reduced Motion.

### K. StudyTaskTimer parity
Refactor `StudyTaskTimer` to reuse the new `<FocusRing/>` + `<FocusHUD/>` primitives so both Pomodoro and Task modes share the same cockpit shell, with subject icon/color replacing the soundscape theming.

---

## 4. New / Edited Files

**New components** (`src/components/study-coach/focus/`)
- `FocusCockpit.tsx` — top-level shell, mode/state machine.
- `FocusRing.tsx` — dual-ring SVG, glow, pulse, reduced-motion variant.
- `FocusHUD.tsx` — intent / time / finish / status stack.
- `PreFlight.tsx` — intent + energy + soundscape + breathing primer.
- `SoundscapeMixer.tsx` — sheet with 6 layered tracks + per-track sliders.
- `DistractionShield.tsx` — visibility/blur listener + counter UI.
- `SmartBreakCard.tsx` — rotating break activities.
- `SessionDebrief.tsx` — rating, score, XP, note, next-action.
- `FocusStatsStrip.tsx` — streak / today / level / live count.
- `AuroraBackground.tsx` — animated tinted gradient.

**New hooks / utils**
- `src/hooks/useSoundscape.ts` — Web Audio mixer.
- `src/hooks/useDistractionTracker.ts`.
- `src/hooks/useKeyboardShortcuts.ts`.
- `src/utils/adaptiveDuration.ts` — client heuristic (reads cached sessions + checkin).
- `src/utils/focusScore.ts` — formula.

**Edited**
- `src/pages/StudyCoach.tsx` — mount `FocusCockpit` in `studyMode === "timer"` and inside `StudyTaskTimer` path.
- `src/components/study-coach/PomodoroTimer.tsx` — slim wrapper around `FocusCockpit` (keeps API).
- `src/components/study-coach/StudyTaskTimer.tsx` — adopt shared cockpit.
- `src/components/study-coach/FloatingAIChat.tsx` — add `mode="focus"` + auto-seed.
- `src/contexts/GlobalTimerContext.tsx` — extend state with `intent`, `distractions`, `soundscape`, `energy`; persist them.
- `src/index.css` — aurora keyframes, dual-ring tokens, reduced-motion guards.

**Audio assets** (lazy-loaded from `public/sounds/`)
- `rain.mp3`, `cafe.mp3`, `forest.mp3`, `brown-noise.mp3`, `binaural-14hz.mp3`. (Add as small loops, ~30-60s each, looped seamlessly.)

**No DB schema changes required** — we already have `study_sessions` (notes/interruptions columns can hold intent + distractions); if a column is missing we'll write a tiny additive migration with proper GRANTs + RLS, but plan assumes existing columns suffice.

---

## 5. Out of Scope
- Blueprint, Stats tab, Settings, Leaderboard pages (left as-is).
- Mobile native app (`mobile/`).
- Co-focus rooms / WebRTC (parking lot for v2).
- Account-level realtime presence beyond a cheap polled count.

---

## 6. Technical Notes
- All visuals CSS/SVG (no chart libs), per project rules.
- Fonts stay Montserrat / Cormorant / IBM Plex Mono.
- Tokens only (no hardcoded colors); add aurora + soundscape tint tokens to `index.css`.
- Wall-clock timer architecture preserved — new state fields piggyback on existing persistence.
- All new audio behind dynamic `import()` + `<audio preload="none">` so initial bundle is unchanged.
- Accessibility: full keyboard control, ARIA live region for time milestones, prefers-reduced-motion honored throughout.
