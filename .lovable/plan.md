

# Full Upgrade: ChatGPT-Inspired AI Chat + Professional Focus Hub

## Part 1: AI Chat — ChatGPT-Inspired Redesign

### 1A. Welcome Screen (`src/components/WelcomeScreen.tsx`)
- Remove feature cards grid and "Start Chatting" CTA button
- Large centered greeting: "What can I help you study today?"
- 2x2 suggestion card grid with icons:
  - "📋 Next Task" / "📊 My Progress" / "🧠 Quiz Me" / "💡 Study Tips"
- Each card is a `<button>` with icon, title, subtitle — triggers `onSuggestion(prompt)`
- Input always visible at bottom (no blocking CTA)

### 1B. Chat Header + Sidebar (`src/pages/Index.tsx`)
- **Header**: Replace "AI Life Coach" with conversation title (editable), clean layout: `[≡] [title] [+ new chat]`
- **Conversation list grouping**: Group by "Today", "Yesterday", "Previous 7 Days" using date headers
- **Input upgrade**: Replace `<Input>` with auto-growing `<textarea>` (1-5 rows), send button inside, "Enter to send, Shift+Enter new line"
- Remove `QuickActionChips` component usage — suggestions now in WelcomeScreen
- Remove guest banner "Sign in to chat" block — just show sign-in prompt inline

### 1C. Message Bubbles (`src/components/ChatMessage.tsx`)
- Remove colored background alternation — clean transparent style
- Smaller round avatars (32px circles)
- Add thumbs up/down feedback buttons on assistant messages
- Always show Copy for assistant, hover-reveal for Edit/Regenerate
- Slide-up-fade entry animation
- Label "StudyTime AI" instead of "AI Coach"

### 1D. CSS Additions (`src/index.css`)
```css
@keyframes slide-up-fade {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-slide-up-fade { animation: slide-up-fade 0.3s ease-out both; }
```

---

## Part 2: Focus Hub — Professional Study App

### 2A. Focus Timer Upgrade (`src/components/study-coach/PomodoroTimer.tsx`)
- Thicker ring stroke (14px) with gradient-colored stroke
- Redesign presets as pill cards with emoji icons: "☕ 25m", "📖 50m", "🔥 90m"
- Add session history strip: horizontal dots showing completed vs remaining sessions today
- Motivational micro-quote below timer during active session
- Subtle green glow effect on the ring when progress > 70%

### 2B. Mode Toggle (`src/pages/StudyCoach.tsx`)
- iOS-style segmented control with animated sliding green pill indicator
- Icons: ⏱ Focus / 📋 Blueprint
- Haptic feedback on switch

### 2C. Header Redesign (`src/pages/StudyCoach.tsx`)
- Remove "Welcome back 👋" — show "Study Hub" title + today's date
- Inline streak badge (flame + count)
- Compact icon row: Music, Leaderboard, Subjects (Blueprint only)

### 2D. Blueprint Task Cards (`src/pages/StudyCoach.tsx`)
- Progress bar at top showing completion %
- Task cards with left color stripe, subject icon, topic title, duration pill, difficulty badge, play button
- "Up Next" hero card + "Remaining" compact list

### 2E. Background Music Mini-Player (`src/components/study-coach/BackgroundMusicPlayer.tsx`)
- Add a `floating` variant: slim bar at bottom of Blueprint showing track name + play/pause + waveform indicator

---

## Part 3: Cross-Cutting Polish

### 3A. Bottom Nav (`src/components/MobileBottomNav.tsx`)
- Spring-scale animation on active tab switch

### 3B. Remove unused components
- Delete `src/components/QuickActionChips.tsx` (replaced by WelcomeScreen suggestions)

---

## Files to Modify
| File | Changes |
|------|---------|
| `src/components/WelcomeScreen.tsx` | Complete rewrite — suggestion grid |
| `src/components/ChatMessage.tsx` | Clean styling, thumbs feedback, slide animation |
| `src/pages/Index.tsx` | Header, textarea input, sidebar grouping, remove QuickActionChips |
| `src/pages/StudyCoach.tsx` | Header, segmented toggle, Blueprint layout |
| `src/components/study-coach/PomodoroTimer.tsx` | Thicker ring, preset pills, session dots |
| `src/components/study-coach/BackgroundMusicPlayer.tsx` | Add floating mini-player variant |
| `src/components/MobileBottomNav.tsx` | Spring animation |
| `src/index.css` | New keyframes |

## Files to Delete
| File | Reason |
|------|--------|
| `src/components/QuickActionChips.tsx` | Replaced by WelcomeScreen suggestions |

## No Database Changes Required

## Priority Order
| Priority | Items | Impact |
|----------|-------|--------|
| High | 1A, 1B, 1C | ChatGPT-style chat (biggest visual change) |
| High | 2A, 2B | Focus timer premium feel |
| Medium | 1D, 2C, 2D | Polish and layout improvements |
| Low | 2E, 3A, 3B | Mini-player and nav micro-interactions |

