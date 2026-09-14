# StudyTime Frontend Renewal Plan

## Objective
Turn StudyTime into one coherent, reliable learning workspace that makes the next useful study action obvious. The work is limited to frontend experience, frontend integration fixes, and safe code cleanup; it does not begin E5–E9 or change the Knowledge Engine contract.

## Locked design direction
- **Palette:** Emerald + Signal — `#F7F9F7`, `#119B61`, `#E2A11A`, `#168CA6`, with accessible neutral ink and surfaces.
- **Typography:** Sora for headings and Manrope for body/UI text.
- **Layout:** Focused Workspace — one decisive primary action on mobile; purposeful main workspace plus contextual rail on wide screens.
- **Character:** calm, scientific, optimistic, and tactile. Use Lucide icons for persistent UI; reserve emoji for brief celebratory moments.
- **Constraints:** minimum 44px targets, structural text at least 12px, restrained 6–10px radii, no vanity metrics, nested card stacks, gradient clutter, or continuous decorative motion.

## Audit summary
### Critical reliability findings
- The main chat client calls the edge-function URL directly. Current browser traces show the request failing at CORS/preflight, leaving the first chat experience broken.
- Settings renders a switch button inside a row button, producing invalid interactive nesting and unreliable keyboard behavior.
- Library upload must be verified end-to-end against authenticated policies, including preflight, document creation, Storage upload, page metadata, retry, and cleanup.
- First-run auth, onboarding, empty, loading, offline, permission-denied, and recovery states are implemented inconsistently rather than through a shared state model.

### Experience findings
- The strongest current design is the restrained Focus Cockpit; older dashboard-era patterns and emoji navigation make the product feel like two apps.
- Focus Hub spends too much mobile space on header controls, while desktop leaves useful space empty.
- Mobile navigation hides Library inside Settings despite Library being part of the core source-to-study loop.
- AI Chat contains general-purpose history management that competes with the simpler study-coach purpose.
- Settings is visually flat, overuses identical rows, and mixes static information with actions.
- Many structural labels are 9–11px, below a comfortable study interface baseline.

### Code-health findings
- `Index.tsx` and `StudyCoach.tsx` are 3,800+ and 1,900+ line monoliths.
- Network calls bypass the declared `core/api` boundary in multiple frontend consumers.
- An unreachable Future feature, abandoned stores/domain service, and unused coach components remain in the repository.
- Terms of Service is a visible “Coming soon” stub.

## Implementation plan

### Phase 0 — Establish a verified baseline
1. Capture guest and authenticated journeys at phone, tablet, and wide desktop sizes.
2. Add focused regression coverage for startup, auth completion, chat send/retry, Focus start/end, Library upload/retry/delete, Settings toggles, and mobile navigation.
3. Record console, network, accessibility, overflow, keyboard, safe-area, and reduced-motion failures before visual changes.

**Exit:** reproducible baseline with no ambiguous failures and a short critical-journey checklist.

### Phase 1 — Repair openings and critical journeys
1. Move Chat and other frontend AI requests behind the existing API client/boundary; centralize auth headers, trace IDs, timeouts, cancellation, normalized errors, retry, and guest messaging.
2. Fix Settings row semantics: static rows become non-interactive; action rows and switches are never nested controls; keyboard focus and labels are explicit.
3. Make auth success deterministic: close the Settings auth modal, restore the intended destination, and show a clear signed-in state without reload.
4. Harden first-run states:
   - useful guest landing with one obvious next action;
   - onboarding that can resume or skip safely;
   - meaningful Focus, Chat, Blueprint, Stats, and Library empty states;
   - skeletons for real waits, inline retry for recoverable failures, and offline/session-expired states.
5. Verify Library upload end-to-end and map permission, size/page limit, extraction, network, and processing failures to actionable messages. Never report success before the server/storage contract completes.
6. Ensure notification permission is requested only after a user action and explain denied/unsupported states.

**Exit:** no blank startup, uncaught console error, invalid DOM warning, broken chat send, stuck auth dialog, or unexplained Library permission failure in the tested journeys.

### Phase 2 — Unify the design system
1. Replace current font imports and component overrides with Sora/Manrope tokens; apply the locked palette through semantic variables for light and dark modes.
2. Define shared spacing, radius, elevation, icon, motion, focus-ring, status, and responsive-container rules.
3. Raise essential labels to 12px+, preserve 44px touch targets, increase contrast, and add non-color status signals.
4. Replace persistent emoji navigation/status symbols with Lucide icons.
5. Create shared primitives for page headers, segmented mode controls, list rows, empty/error/loading states, primary actions, and contextual rails.

**Exit:** all core pages use one visual grammar, pass keyboard/focus checks, and remain readable at 200% zoom and reduced motion.

### Phase 3 — Recompose the core workspace
#### Focus Hub
- Put Focus/Blueprint/Stats first as a full-height, icon-led segmented control.
- Compress date and streak context into one secondary line; move music and subject management into contextual controls or disclosure.
- Make intent, energy, duration, and “Begin Focus” one uninterrupted setup path.
- On desktop, use a balanced main session workspace plus a compact evidence/context rail instead of a narrow centered mobile column.
- Remove the floating AI affordance during an active timer; before/after a session, expose one recessive contextual “Ask StudyTime” action.

#### Blueprint and Stats
- Preserve only actionable next-task, plan, due-review, and evidence information.
- Use progressive disclosure for explanations and plan adjustment.
- Remove duplicate status cards, decorative counters, and text that does not alter a decision.

#### AI Chat
- Keep “Ask me!” and longer study suggestions, but emphasize the composer and current study context.
- Simplify history controls on mobile; keep rename/pin/delete behind contextual menus rather than persistent chrome.
- Preserve immediate swipe open/close behavior and the 65% history panel while adding keyboard and screen-reader equivalents.
- Use consistent streaming, stop, retry, copy, feedback, guest-limit, and provider-error states.

#### Navigation and Library
- Add Library as a first-class mobile destination or a clearly labeled top-level “More” destination; do not bury a core input under account settings.
- Keep nav behavior consistent across phone and desktop, including admin-only AI Training visibility.
- Redesign Library around upload, processing status, retry, source details, and “study from this” actions, not file-management clutter.

#### Settings and About
- Tier Settings into Identity, Study Routine, AI & Data, Appearance, Help & Legal, and a visually isolated Danger Zone.
- Collapse low-frequency legal/about rows; keep contact details in About.
- Replace the Terms placeholder with a real route/content or remove the row until content exists.

**Exit:** each core screen has one obvious primary action, no duplicated navigation, no hidden core feature, and credible layouts from 320px through wide desktop.

### Phase 4 — Complete and simplify the frontend architecture
1. Delete only after a final reference/build check:
   - unreachable `TheFuture` page and its orphaned component tree;
   - unused alternate auth/study stores;
   - unused placeholder `StudyService`;
   - confirmed unused legacy Focus/Blueprint components.
2. Decide the unrelated `mobile/` Expo project explicitly: move it to its own repository or formalize it as an owned workspace; do not silently delete it.
3. Introduce an enforced API boundary rule, then migrate frontend raw `fetch` and `functions.invoke` calls incrementally.
4. Extract Chat transport/history/gesture/composer logic from `Index.tsx` and session/plan/view orchestration from `StudyCoach.tsx` into tested hooks and focused components without changing business behavior.
5. Remove placeholder copy, obsolete styles/imports/assets, duplicate utilities, and newly unreachable branches after each extraction.

**Exit:** no verified dead frontend modules, no placeholder user action, no direct network calls outside approved adapters, and materially smaller page orchestrators.

### Phase 5 — Final production verification
- Run unit/integration tests and production build.
- Re-run critical journeys on mobile and desktop with guest and authenticated accounts.
- Check console/network cleanliness, slow/offline behavior, auth expiry, upload limits, keyboard-only use, screen reader names, zoom, contrast, safe areas, and reduced motion.
- Compare visual snapshots to prevent density and overflow regressions.
- Ship in small reversible slices: reliability, foundations, Focus/Blueprint, Chat/Library, Settings, cleanup.

## Success measures
- Critical journey completion rate and first successful study session increase.
- Time from opening Focus Hub to starting a session decreases.
- First Chat response and first Library upload success rates improve.
- Fewer support-visible permission/auth/network errors.
- Zero known startup crashes, invalid DOM warnings, horizontal overflow, inaccessible essential controls, or dead user-facing actions.
- Retention reporting remains tied to active review and learning evidence, not vanity engagement.

## Technical boundaries and safety
- No Knowledge Engine schema or E5–E9 behavior changes.
- No removal of legacy learning tables reserved for later E12/E14 migrations.
- No broadening database or Storage permissions as a UI workaround.
- Preserve client-side PDF extraction, 1536-dimensional embeddings, deterministic FSRS, the AI services boundary, and existing admin authorization.
- Every deletion requires zero-reference confirmation, successful tests/build, and a reversible commit-sized change.
