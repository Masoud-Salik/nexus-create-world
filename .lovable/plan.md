
# AI Personalization & Focus Hub Mini-Chat Upgrade

## 1. Smarter, Playful AI Personality (Edge Function)

Update `supabase/functions/chat/index.ts` system prompt:
- Make NEXUS warmer, wittier, and more playful -- inspired by conversational AI like GPT-5.5. Add humor, light banter, and celebratory reactions.
- Inject user's **likes/dislikes** from `ai_memory` and `user_insights` tables into the system prompt dynamically. The AI will reference these naturally ("I know you love lo-fi music -- try studying with some on!").
- Add a new tool `get_user_preferences` that fetches all `ai_memory` entries + `interests` + `abilities_skills` so the AI can proactively reference them.
- Add a new tool `save_user_preference` so the AI can actively save likes/dislikes it discovers mid-conversation (e.g., user says "I hate math" -> AI saves it).

## 2. Enhanced Memory Extraction (Edge Function)

Update `supabase/functions/extract-memory/index.ts`:
- Expand categories to include `"like"` and `"dislike"` explicitly.
- Extract emotional sentiment and intensity (e.g., "loves classical music" vs. "sometimes listens to jazz").
- Run extraction on **both** user and assistant messages (currently only user messages).

## 3. AI Gets Smarter Over Time (System Prompt Context)

In `src/pages/Index.tsx`, enhance `getUserContext()`:
- Fetch and inject all `ai_memory` entries (grouped by category) into the context sent to the AI.
- Include conversation count and total messages as "relationship depth" signal.
- Add a "personality adaptation" section: if user prefers short answers, the AI adapts; if they like detailed explanations, it expands.

## 4. Focus Hub Floating AI Mini-Chat Button

Create `src/components/study-coach/FloatingAIChat.tsx`:
- A small circular button (44px) with an AI/sparkle icon, positioned on the right edge of the screen.
- **3 snap positions**: bottom (above bottom nav ~100px), middle (~50% viewport), top (~15% from top). No in-between positions.
- **Drag-to-snap**: User can drag the button vertically. On release, it snaps to the nearest of the 3 positions with a spring animation (CSS `transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)`).
- **Tap to expand**: Opens a compact chat overlay (300px tall, full width minus padding) anchored to the button's position. The overlay has:
  - A small input field + send button
  - Last 3 messages displayed in a mini scroll area
  - Semi-transparent backdrop-blur background (glassmorphism)
  - Tap outside or tap button again to collapse
- **Non-disturbing**: The overlay does NOT cover the timer. It slides in/out with a scale+fade animation.
- Messages sent here go to the same conversation system (reuse existing chat logic).
- Integrate into `StudyCoach.tsx` Focus tab only (not Blueprint/Stats).

## 5. Smooth Transitions & Mobile Polish

- All animations use GPU-accelerated transforms (`translate3d`, `scale3d`).
- Button has a subtle pulse glow when idle (CSS keyframe, emerald green).
- Drag uses `touch-action: none` and `pointer-events` for smooth mobile interaction.
- Haptic feedback (10ms vibration) on snap and on send.

## Technical Details

**Files to create:**
- `src/components/study-coach/FloatingAIChat.tsx` -- floating button + mini-chat overlay

**Files to modify:**
- `supabase/functions/chat/index.ts` -- new tools, enhanced personality prompt, memory injection
- `supabase/functions/extract-memory/index.ts` -- expanded categories, like/dislike extraction
- `src/pages/Index.tsx` -- enhanced `getUserContext()` with memory injection
- `src/pages/StudyCoach.tsx` -- mount `FloatingAIChat` in Focus tab

**Database migration:**
- Add `sentiment` column (text, nullable) to `ai_memory` table for emotional intensity tracking.

**No new dependencies required.** Drag logic uses native touch events + CSS transitions.
