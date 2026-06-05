# Plan — Chat UX polish (4 fixes)

## 1. Fix "zoom / horizontal scroll appearing 1–2s after AI response"

Root cause: Radix `ScrollArea` wraps its children in a `<div style="display: table">` viewport. When the streamed assistant message finishes (and React re-renders with the final markdown), wide intrinsic content (long code lines, tables, unbreakable strings) makes that `table` div expand past 100% width, so the whole chat thread becomes horizontally scrollable.

Changes:
- **`src/index.css`** — globally force every Radix scroll-area viewport's inner table div to behave like a block of width 100%:
  ```css
  [data-radix-scroll-area-viewport] > div[style*="table"] {
    display: block !important;
    width: 100% !important;
    min-width: 0 !important;
  }
  ```
- **`src/pages/Index.tsx`** — on the messages `ScrollArea`, add `[&_[data-radix-scroll-area-viewport]]:!block` belt-and-braces; wrap the `messages.map(...)` in `<div className="w-full max-w-full min-w-0 overflow-x-hidden">`.
- **`src/components/ChatMessage.tsx`** — tighten markdown safety:
  - Add `w-full max-w-full` to the outer `group` div.
  - On the prose div add `[&_*]:max-w-full [&_img]:h-auto [&_a]:break-all`.
  - Wrap `<SyntaxHighlighter>` in a `max-w-full overflow-x-auto` container (already present, verify wrapper has `width:100%`).

## 2. Instant finger-following swipe drawer (no delay open/close)

Current: gesture is detected only on `touchend`, then Radix `Sheet` plays a 300–500ms slide-in. Result feels laggy.

Replace the chat-history Radix `Sheet` with a custom drawer that translates with the finger:
- **`src/pages/Index.tsx`**:
  - Add state `drawerX` (number, px) and `drawerDragging` (bool).
  - On `onTouchStart` inside left 35% of the screen (and not on input/pre/code), start tracking.
  - On `onTouchMove`, set `drawerX = clamp(deltaX, 0, drawerWidth)` and translate the drawer with `transform: translate3d(${drawerX - drawerWidth}px,0,0)` — no transition while dragging.
  - On `onTouchEnd`, decide open/close by threshold (drawerX > drawerWidth * 0.4 OR velocity > 0.5 px/ms) and animate the remainder with a single 150ms transition.
  - Same logic in reverse when drawer is open (touchstart anywhere → drag left to close).
  - Add backdrop element that fades opacity proportionally to `drawerX / drawerWidth`.
- Keep the `Menu` button as a tap-to-open fallback that animates open with the same 150ms transition.

## 3. Shrink chat-history drawer to ~65% width

In the new custom drawer (replacing `SheetContent`):
- `width: min(65vw, 320px)` on mobile, `sm:w-80` on desktop.
- Drawer height = `100dvh`, background = `bg-background`, border-right, shadow-xl.
- All existing content (search input, New Chat button, grouped conversation list) moves into this drawer unchanged.

## 4. Better error handling, especially for guests

Centralize a small helper and wire it into the gated entry points:
- **`src/utils/errorUtils.ts`** — add `requireAuth(user, action, openAuth)` that, when `user` is null, fires a single toast (`"Sign in to {action}"`) AND triggers the project's auth dialog. Returns boolean.
- **`src/pages/Index.tsx`** — replace the current `if (!user)` toast in `handleSend` with `requireAuth(user, "chat with the AI", () => setShowAuthDialog(true))`. Also gate suggestion clicks and regenerate the same way.
- **`src/pages/StudyCoach.tsx`** — find the "Generate plan" / "Ask AI" handlers and apply `requireAuth(...)` before the call (instead of silent failure / generic toast). Show the existing Auth dialog modal.
- **`src/components/study-coach/SmartAdjust.tsx`, `TaskBreakdown.tsx`, `NextTaskCard.tsx`** — if any of them call edge functions, wrap with `requireAuth`. (Read each before editing; only add the guard, no behavior change for signed-in users.)
- **`src/utils/errorUtils.ts`** — extend `ERROR_MESSAGES` with `"JWT expired"`, `"Invalid JWT"`, `"row-level security"` → friendly messages, and add a dedicated message for `"AI usage limit"` / `"quota"`.
- **`src/pages/Index.tsx`** chat stream: on 401/403 specifically, call `requireAuth(...)` instead of throwing a generic error.

## Files to touch

- `src/index.css` (1 small rule)
- `src/pages/Index.tsx` (drawer rewrite, swipe, guards)
- `src/components/ChatMessage.tsx` (overflow hardening)
- `src/utils/errorUtils.ts` (helper + new mappings)
- `src/pages/StudyCoach.tsx` and 2–3 study-coach components (guest gating only)

No backend, DB, or edge-function changes.
