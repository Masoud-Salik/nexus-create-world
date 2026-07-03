# Mobile fixes, smarter/faster AI, OTP reset, new study music

## 1. Mobile viewport fixes — Focus Hub & Blueprint
Both pages currently overflow horizontally on mobile (user has to scroll left/right). Root cause is typically fixed widths, large `min-w-*`, absolute-positioned decor, and dense multi-column grids in:
- `src/components/study-coach/focus/FocusCockpit.tsx`, `FocusRing.tsx`, `FocusStatsStrip.tsx`, `AuroraBackground.tsx`, `PreFlight.tsx`, `SmartBreakCard.tsx`, `SessionDebrief.tsx`
- `src/components/study-coach/blueprint/StudyPath.tsx`, `WeekRibbon.tsx`, `LifeProgress.tsx`, `PlanAdjusterSheet.tsx`
- `src/pages/StudyCoach.tsx` container

Changes:
- Add `overflow-x-hidden` + `max-w-full` on page containers; wrap horizontally-scrolling ribbons in explicit `overflow-x-auto` scrollers that don't leak.
- Convert desktop 2–3 column grids to `grid-cols-1 md:grid-cols-2` on mobile.
- Shrink Focus Ring radius/stroke on `<sm` (use `useIsMobile`) so the SVG fits within `100vw - padding`.
- Reduce padding, font sizes, and pill counts on mobile; hide non-essential decorative elements (aurora blobs clipped to container).
- Blueprint WeekRibbon becomes horizontal-snap scroller inside a bounded wrapper; StudyPath nodes stack vertically on mobile with reduced spacing.
- Verify: run Playwright at 390×844, screenshot Focus & Blueprint, confirm no horizontal scroll.

## 2. Smarter AI persona
Update the NEXUS system prompt in `supabase/functions/chat/index.ts` (and `study-coach` if it has its own persona):
- Add: human-tutor voice, playful, respectful, occasionally cracks a light joke, Socratic nudges, celebrates wins.
- Keep the existing "1–3 sentence, **Answer** — Reasoning — Actionable tip. Confidence: X% 🎯" format from project memory.
- Add tutor heuristics: ask one probing question when the user is stuck; use analogies; adapt tone to detected mood.

## 3. 6-digit OTP password reset
Replace `resetPasswordForEmail` link-based flow with Supabase OTP:
- `Auth.tsx` "forgot" mode → `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })` (sends 6-digit code via existing template).
- Add a new "verify" step: 6-digit `InputOTP` (already in `src/components/ui/input-otp.tsx`) → `supabase.auth.verifyOtp({ email, token, type: 'email' })` → on success the user is signed in; then optionally prompt to set a new password using `supabase.auth.updateUser({ password })`.
- Update the recovery email template (`supabase/functions/_shared/email-templates/recovery.tsx` if scaffolded, otherwise use default) to prominently show `{{ .Token }}` as a 6-digit code and drop the "resent"/magic link that currently deep-links to lovable sign-in.
- No route change needed — flow stays inside `/auth`.

## 4. Swap study music
- Upload the user's mp3 (`موسیقی_بی_کلام_ایرانی...528هرتز`) to Lovable Assets via `lovable-assets create` and get a CDN URL.
- Update `MUSIC_SRC` in `src/contexts/GlobalMusicContext.tsx` from `/audio/study-music.mp3` to the new asset URL.
- Update label in `BackgroundMusicPlayer.tsx` from "Lo-fi • Ghibli" to "Persian Ambient • 528 Hz".
- Leave `useSoundscape` (silence/brown/rain/binaural 14 Hz) untouched.

## 5. Make AI feel instant
- Switch chat model default from `google/gemini-3-flash-preview` to `google/gemini-3.1-flash-lite` for lower latency on the main `chat` edge function (keep pro model available as fallback).
- Enable priority `service_tier` where model supports it (OpenAI models only — set on the fallback path).
- Confirm streaming (SSE) is on end-to-end: `chat/index.ts` already uses `chatStream`; ensure the client renders tokens as they arrive without buffering (check `src/pages/Index.tsx` reader loop — flush per chunk, no `await` batching).
- Reduce first-token latency: trim system prompt bloat, cap conversation history sent to last N=20 turns, and drop redundant memory blocks when total tokens > 4k.
- Pre-warm the edge function on app mount (fire a tiny GET to `/functions/v1/chat?ping=1`).
- Skip title-generation blocking; run `generate-chat-title` fire-and-forget after first assistant token.

## Technical notes
- OTP type for password-reset-style flow: use `type: 'email'` with `signInWithOtp` (magic-link code). Supabase's `recovery` OTP also works with `verifyOtp({ type: 'recovery' })` and preserves reset intent — will use `recovery` so users land signed-in with a "set new password" screen.
- `emailRedirectTo` will be omitted so no magic link is embedded (code-only email).
- Playwright verification: mobile 390×844 for #1; console + network capture during OTP verify for #3; time-to-first-token measurement before/after for #5.

## Out of scope
- No changes to Soundscape, leaderboard, or unrelated pages.
- No new tables (feedback/roles infra already exists).
