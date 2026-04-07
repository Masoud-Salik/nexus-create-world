
# Full Upgrade: AI Chat (ChatGPT-inspired) + Focus Hub (Professional Study App)

---

## Part 1: AI Chat — ChatGPT-Inspired Redesign

### 1A. Conversation Sidebar Overhaul
**File: `src/pages/Index.tsx`**

Replace the current `Sheet`-based chat list with a ChatGPT-style sidebar:
- **Desktop**: Persistent left sidebar (280px) with conversation list, collapsible via hamburger
- **Mobile**: Keep Sheet/drawer behavior but style it like ChatGPT's slide-out panel
- Group conversations by "Today", "Yesterday", "Previous 7 Days", "Older" using date headers
- Each conversation row: title text, hover reveals 3-dot menu (rename, pin, delete)
- "New Chat" button at top with `+` icon, prominent green styling
- Search bar at top of sidebar to filter conversations

### 1B. Chat Header Simplification
**File: `src/pages/Index.tsx`, `src/components/ChatTopBar.tsx`**

- Replace "AI Life Coach" branding with current conversation title (editable on click)
- Show model indicator badge (small, subtle, like ChatGPT's "GPT-4o" pill)
- Remove the separate `ChatTopBar` dropdown — merge actions into sidebar's per-conversation menu
- Clean header: `[≡ sidebar toggle] [conversation title] [new chat +]`

### 1C. Welcome Screen Redesign
**File: `src/components/WelcomeScreen.tsx`**

ChatGPT-inspired minimal welcome:
- Large centered greeting: "What can I help you study today?"
- 2x2 grid of suggestion cards (not chips), each with icon + title + subtitle:
  - "📋 Next Task" → fetches next study task
  - "📊 My Progress" → shows weekly stats
  - "🧠 Quiz Me" → generates quiz from recent topics
  - "💡 Study Tips" → personalized advice
- Remove the feature cards grid and "Start Chatting" button
- Input box is always visible at bottom (no need for CTA button)

### 1D. Input Area Upgrade
**File: `src/pages/Index.tsx`**

- Replace `<Input>` with auto-growing `<textarea>` (1-5 rows)
- Rounded container with subtle border, send button inside (right side)
- Attach button placeholder (left side, for future file upload)
- Character count indicator for long messages
- Keyboard shortcut hint: "Enter to send, Shift+Enter for new line"

### 1E. Message Bubbles Polish
**File: `src/components/ChatMessage.tsx`**

- Remove the colored background alternation — use clean white/transparent like ChatGPT
- Smaller, rounder avatars (32px circles instead of 36px rounded-xl)
- Action buttons: always show Copy for assistant, show on hover for Edit/Regenerate
- Add thumbs up/down feedback buttons on assistant messages
- Smoother message entry animation (slide-up + fade)

---

## Part 2: Focus Hub — Professional Study App Redesign

### 2A. Focus Tab (Pomodoro Timer) Upgrade
**File: `src/components/study-coach/PomodoroTimer.tsx`**

Inspired by Forest/Tide/Focus Timer apps:
- **Ambient background**: Subtle animated gradient that shifts color based on session progress (green → deeper green → gold at completion)
- **Enhanced ring**: Thicker stroke (14px), gradient stroke color, subtle particle effect around the ring while active
- **Session info card**: Below timer, show a compact card with: session type label, target end time, and a motivational micro-quote that changes each session
- **Quick-start presets**: Redesign as elegant pill cards (not just text buttons) with icons: "☕ 25m", "📖 50m", "🔥 90m"
- **Session history strip**: Horizontal row of small dots/circles below timer showing today's completed sessions (filled = done, empty = remaining goal)

### 2B. Blueprint Tab Redesign
**File: `src/pages/StudyCoach.tsx`**

Inspired by Todoist/Notion task views:
- **Progress header**: Horizontal progress bar at top showing daily completion % with task count
- **Task cards redesign**: Each task as a full card with:
  - Left color stripe (subject color)
  - Subject icon + name
  - Topic title (bold)
  - Duration pill + difficulty badge
  - Play button (right side, large tap target)
  - Swipe-to-complete on mobile (optional enhancement)
- **Sections**: Split into "Up Next" (1 hero card) and "Remaining" (compact list)
- **Empty state**: More engaging illustration with animated sparkle icon
- **Background music player**: Move from header to a floating mini-player bar at bottom of Blueprint (above bottom nav), showing track name + play/pause + progress

### 2C. Mode Toggle Redesign
**File: `src/pages/StudyCoach.tsx`**

- Replace text buttons with a sleek segmented control (iOS-style)
- Animated sliding indicator (green pill that slides between Focus/Blueprint)
- Icons: `⏱` for Focus, `📋` for Blueprint
- Subtle haptic feedback on switch

### 2D. Header Cleanup
**File: `src/pages/StudyCoach.tsx`**

- Remove "Welcome back 👋" generic greeting
- Show: `[Study Hub]` title + date on left, action icons on right
- Consolidate action buttons: Music, Leaderboard, and (in Blueprint mode) Subjects/Adjust into a compact icon row
- Add daily streak badge inline with header (flame icon + count)

---

## Part 3: Cross-Cutting Polish

### 3A. Bottom Navigation Enhancement
**File: `src/components/MobileBottomNav.tsx`**

- Add notification dot on AI Chat icon when there are unread suggestions
- Animate the active pill with a spring effect (scale bounce on switch)

### 3B. Micro-interactions
**Files: `src/index.css`**

- Add CSS keyframes: `slide-up-fade`, `scale-spring`, `shimmer` for cards
- Add `backdrop-blur` transition classes for glassmorphism consistency

---

## Files to Create
- None (all changes within existing files)

## Files to Modify
- `src/pages/Index.tsx` — ChatGPT-style sidebar, textarea input, header
- `src/components/WelcomeScreen.tsx` — Suggestion cards grid
- `src/components/ChatTopBar.tsx` — Simplified or merged into Index
- `src/components/ChatMessage.tsx` — Cleaner bubbles, feedback buttons
- `src/pages/StudyCoach.tsx` — Header, mode toggle, Blueprint layout
- `src/components/study-coach/PomodoroTimer.tsx` — Enhanced timer UI
- `src/components/study-coach/BackgroundMusicPlayer.tsx` — Floating mini-player variant
- `src/components/MobileBottomNav.tsx` — Spring animation, notification dot
- `src/index.css` — New keyframes and utility classes

## No Database Changes Required

## Priority Order
| Priority | Section | Impact |
|----------|---------|--------|
| High | 1A, 1C, 1D | ChatGPT-style chat UX (biggest visual change) |
| High | 2A, 2C | Focus timer premium feel |
| Medium | 1B, 1E | Chat polish details |
| Medium | 2B, 2D | Blueprint task view redesign |
| Low | 3A, 3B | Micro-interactions and nav polish |
