
# StudyTime Production Upgrade Plan

## Goal
Transform StudyTime from a solid prototype into a portfolio-quality product that demonstrates CS competence to a scholarship committee. Focus on what impresses reviewers: professional polish, intelligent features, and technical depth.

---

## 1. Remove the About Hero Card (Quick Fix)

Remove the small "StudyTime / Your AI-powered companion..." card from `AboutSection.tsx` (lines 38-46) as requested. Keep the team photo, mission, values, and footer.

---

## 2. Add a Public Landing Page (High Impact)

Create a new `/landing` route that unauthenticated users see first (redirect `/` for guests). This is critical for scholarship reviewers who will visit the URL cold.

**Content:**
- Hero section: App name, tagline ("AI-Powered Study Companion"), animated mockup/screenshot, and "Get Started" CTA
- Feature highlights: Focus Timer, AI Tutor, Smart Planner, Leaderboard -- each with icon, title, one-liner
- Social proof section: "Built with React, TypeScript, Supabase, and AI" tech stack badges
- Footer with links

**Design:** Full-width sections, smooth scroll animations via framer-motion, emerald gradient accents, dark/light support.

---

## 3. Study Analytics Dashboard (Technical Depth)

Add a "My Stats" tab or section in Focus Hub showing:

- **Weekly heatmap**: 7-day grid showing study intensity per day (color-coded)
- **Subject breakdown**: Donut/bar chart of time per subject using recharts
- **Streak calendar**: Visual streak tracker (GitHub-contribution-style)
- **Personal bests**: Longest streak, most productive day, total hours

This demonstrates data visualization and analytical thinking -- key for CS.

---

## 4. AI Chat Polish (Intelligence)

- **Conversation search**: Add a search input in the chat sidebar to filter conversations by title
- **Markdown rendering**: Ensure code blocks, tables, and lists render properly with syntax highlighting (add `react-markdown` + `rehype-highlight`)
- **Empty state improvement**: Add subtle typing animation to the greeting
- **Error recovery**: If streaming fails mid-message, show a "Retry" button instead of losing the partial response

---

## 5. Onboarding Flow Polish

- Add step indicators (1/3, 2/3, 3/3) with a progress bar
- Add subtle slide transitions between steps
- Pre-fill "Student" as default occupation
- Add a "Skip for now" option that still creates the profile with defaults

---

## 6. Accessibility and Performance

- Add `aria-label` attributes to icon-only buttons (timer controls, nav items)
- Ensure all interactive elements have visible focus rings
- Add `<noscript>` fallback message in `index.html` body
- Lazy-load the Leaderboard and Analytics components
- Add `loading="lazy"` to non-critical images

---

## 7. Global UX Micro-Fixes

- Fix the Blueprint mode covering the entire screen on mobile with no way back except the close button -- add a swipe-down gesture or make the bottom nav visible
- Add a toast confirmation when copying study plan data
- Add keyboard shortcut hints on desktop (Space to pause/resume timer)
- Ensure the timer keeps running when navigating between pages (already via GlobalTimerContext -- verify)

---

## 8. Professional README and Meta

- Update `index.html` structured data to include "creator" with your name
- Add a proper `README.md` with: project overview, screenshots placeholder, tech stack, architecture summary, and "Built by [Your Name]" attribution
- Update the About section to mention your name and the scholarship context if desired

---

## Files to Create
| File | Purpose |
|------|---------|
| `src/pages/Landing.tsx` | Public landing page |
| `src/components/landing/*` | Landing page sections (Hero, Features, TechStack, Footer) |
| `src/components/study-coach/StudyAnalytics.tsx` | Analytics dashboard component |

## Files to Modify
| File | Change |
|------|--------|
| `src/components/settings/AboutSection.tsx` | Remove hero card |
| `src/App.tsx` | Add landing route, guest redirect logic |
| `src/pages/Index.tsx` | Add markdown rendering, search, retry |
| `src/pages/StudyCoach.tsx` | Add analytics tab/section |
| `src/components/Onboarding.tsx` | Add progress bar, skip option |
| `src/components/MobileBottomNav.tsx` | Keep visible in Blueprint mode |
| `index.html` | Add noscript, update structured data |

## Dependencies to Add
- `react-markdown` -- markdown rendering in chat
- `recharts` (already present via shadcn charts) -- analytics charts
- `framer-motion` -- landing page animations

## No Database Changes Required
All new features use existing tables (study_sessions, study_tasks, habits, profiles).

## Priority Order
| Priority | Item | Why |
|----------|------|-----|
| Critical | 1 | User-requested fix |
| High | 2 | First impression for reviewers |
| High | 3 | Demonstrates CS/data skills |
| High | 4 | Shows AI integration depth |
| Medium | 5, 6 | Professional polish |
| Medium | 7, 8 | Production readiness signals |
