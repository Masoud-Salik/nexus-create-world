## AI Chat redesign + mobile fixes

### 1. Suggestion grid → 3 horizontal lines
**File:** `src/components/WelcomeScreen.tsx`
- Remove the "Next Task" suggestion.
- Replace the 2x2 grid with a vertical stack of 3 wide rows (full width, horizontal layout: icon left, title + subtitle right, subtle chevron/arrow on the right).
- Each row: rounded-2xl, border, hover lifts with primary tint, slide-up-fade stagger.
- Change greeting to `"Ask me!"` (drop the long sentence and `userName` prefix).
- Tighten greeting size to `text-3xl` centered, more compact spacing.

### 2. Mobile "zoom" on chat thread
Root cause: long markdown content (code blocks, long inline tokens, tables) overflows horizontally on narrow screens, which forces a wider layout and looks zoomed. The viewport already has `maximum-scale=1`, so the user cannot zoom out.

**File:** `src/components/ChatMessage.tsx`
- Add `min-w-0 break-words` on the prose container and `overflow-x-auto` on the code block wrapper.
- Constrain `pre/code` with `max-w-full whitespace-pre-wrap break-words` for inline code, keep `overflow-x-auto` for fenced blocks so they scroll inside the message, not the page.
- Add `overflow-wrap-anywhere` utility for long URLs/words.

**File:** `src/pages/Index.tsx`
- On the messages `<ScrollArea>` and its inner wrapper, add `w-full overflow-x-hidden` and ensure the parent flex column uses `min-w-0`.
- Reduce horizontal padding on mobile (`px-3 sm:px-4`) on `ChatMessage` so the bubble fits.

### 3. Hide bottom nav while typing on mobile
**Files:** `src/pages/Index.tsx`, `src/components/MobileBottomNav.tsx` (or via a shared signal)
- Add local `isInputFocused` state in `Index.tsx` driven by textarea `onFocus`/`onBlur`.
- Expose it through a tiny context (`ChatInputFocusContext`) or, simpler, a `body` class toggle (`document.body.classList.toggle("chat-typing", focused)`).
- `MobileBottomNav`: add `hidden` when `body.chat-typing` (Tailwind arbitrary selector: `[body.chat-typing_&]:translate-y-full opacity-0 pointer-events-none`) with a smooth `transition-transform duration-200`.
- Also shift the chat input down by removing the `pb-[56px]` offset while nav is hidden so the input sits above the keyboard.

### 4. Swipe gestures to open/close chat history
**File:** `src/pages/Index.tsx`
- Add touch handlers on the main chat container: track `touchstart` X, on `touchend` compute deltaX.
- Right-swipe (deltaX > 60px, started within left 30% of screen) → `setShowChatList(true)`.
- Left-swipe (deltaX < -60px) while drawer is open → `setShowChatList(false)`.
- Ignore swipes that begin on the textarea / scrollable code block.
- The existing `Sheet` already animates smoothly, so this just wires gesture → state.

### 5. Greeting copy change
Covered in step 1: `"What can I help you study today?"` → `"Ask me!"`.

### Out of scope
- No backend, edge function, or DB changes.
- No changes to chat streaming logic or tools.

### Files touched
- `src/components/WelcomeScreen.tsx` (redesign + copy)
- `src/components/ChatMessage.tsx` (overflow fixes)
- `src/pages/Index.tsx` (focus state, swipe handlers, scroll container fix)
- `src/components/MobileBottomNav.tsx` (hide-when-typing class)
- Possibly `src/index.css` (one helper utility for `overflow-wrap: anywhere` + the `.chat-typing` transition)
