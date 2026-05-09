## Connect ChatGPT (OpenAI API key) to StudyTime

Let users bring their own OpenAI API key so NEXUS can route chat through their ChatGPT/OpenAI account. Default AI stays as-is; user's ChatGPT becomes an opt-in option.

### 1. Storage (Lovable Cloud)

New table `user_ai_providers`:
- `user_id` (PK, FK auth.users)
- `provider` ('openai')
- `encrypted_api_key` (text — encrypted via edge function using `SUPABASE_SECRET_KEYS`)
- `key_last4` (text — for UI display, e.g. "sk-…a4F2")
- `selected_model` ('gpt-5' | 'gpt-5-mini' | 'gpt-5-nano')
- `is_default` (bool — when true, user's ChatGPT replaces NEXUS default)
- `verified_at` (timestamp)
- `created_at`, `updated_at`

RLS: user can only read/write their own row. API key never returned to client — only `key_last4`, `selected_model`, `is_default`, `verified_at` exposed via a view or column-restricted policy.

### 2. Edge functions

**`connect-openai`** (verify_jwt = true)
- Input: `{ apiKey: string }` (validated: starts with `sk-`, length 20–200)
- Calls `https://api.openai.com/v1/models` with the key to verify
- On success: encrypts and upserts into `user_ai_providers`, returns `{ ok, last4, models: [...] }`
- On failure: returns clear error ("Invalid key", "No access to gpt-5", rate-limited)

**`disconnect-openai`** — deletes the row.

**`update-ai-preferences`** — updates `selected_model` and `is_default`.

**`chat`** (existing) — enhanced:
- Reads user's `user_ai_providers` row at the start of each request
- If `is_default = true` AND user did not override per-request → decrypt key and call OpenAI directly (`https://api.openai.com/v1/chat/completions`) with `selected_model`
- Else → keep current Lovable AI Gateway path (NEXUS default)
- Same SSE streaming shape, so frontend doesn't change
- On 401 from OpenAI → mark provider unverified, surface friendly toast, fall back to default NEXUS for that request

### 3. Settings UI — new "AI Providers" section

Location: `src/pages/Settings.tsx`, new card grouped under existing AI section.

States:
- **Not connected**: card with OpenAI logo, "Connect your ChatGPT account" subtitle, "Connect" button → opens dialog
- **Connect dialog**: input for API key (password type, paste-friendly), inline link "Get your key at platform.openai.com/api-keys", "Verify & Connect" button → calls `connect-openai`, shows spinner, success confetti
- **Connected**: shows `sk-…a4F2 ✓ Verified`, model dropdown (gpt-5 / gpt-5-mini / gpt-5-nano — fetched list filtered to chat-capable), toggle "Use as my default AI", "Disconnect" link

Validation with zod. 10ms haptic on actions.

### 4. Chat menu native banner

In `src/components/ChatTopBar.tsx` (or chat header), add a small dismissible glass card shown only when:
- User is on the chat page
- `user_ai_providers` row exists for the user
- Banner not dismissed (localStorage flag `ai_provider_banner_dismissed_v1`)

Two variants:
- **Connected & default = NEXUS**: "✨ Your ChatGPT is connected. Make it default? [Switch] [Dismiss]"
- **Connected & default = ChatGPT**: tiny pill below title "Powered by your ChatGPT (gpt-5) · [Manage]"

Style: backdrop-blur, emerald accent border, slide-up-fade in, ≤56px tall, doesn't push other content (absolute or sticky-tucked).

If not connected, no banner at all (keeps it non-disruptive).

### 5. Security

- API key stored encrypted at rest using a server-side AES key derived from `SUPABASE_SECRET_KEYS`
- Key never sent to client after initial submit; only `key_last4` returned
- Rate-limit `connect-openai` (5 attempts / hour / user) to block brute-force
- All inputs zod-validated client + server
- RLS strict — no shared reads

### 6. Files to add / change

```text
supabase/migrations/<ts>_user_ai_providers.sql       (new)
supabase/functions/connect-openai/index.ts           (new)
supabase/functions/disconnect-openai/index.ts        (new)
supabase/functions/update-ai-preferences/index.ts    (new)
supabase/functions/chat/index.ts                     (edit — provider routing)
supabase/config.toml                                 (register 3 new functions)
src/pages/Settings.tsx                               (edit — add AI Providers section)
src/components/settings/AIProvidersSection.tsx       (new)
src/components/settings/ConnectOpenAIDialog.tsx      (new)
src/components/chat/AIProviderBanner.tsx             (new)
src/pages/Index.tsx                                  (edit — mount banner in chat)
```

### 7. UX flow summary

1. User taps Settings → AI Providers → Connect
2. Pastes `sk-…` key → Verify & Connect (~1s)
3. Picks model from dropdown → optional "Use as default" toggle
4. Returns to chat — small banner confirms status, can switch default in one tap
5. NEXUS default stays unless user explicitly flips the toggle
