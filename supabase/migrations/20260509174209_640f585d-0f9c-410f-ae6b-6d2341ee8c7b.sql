-- Create user_ai_providers table to store user's external AI provider credentials (encrypted)
CREATE TABLE public.user_ai_providers (
  user_id UUID NOT NULL PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'openai',
  encrypted_api_key TEXT NOT NULL,
  key_last4 TEXT NOT NULL,
  selected_model TEXT NOT NULL DEFAULT 'gpt-5-mini',
  is_default BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_ai_providers ENABLE ROW LEVEL SECURITY;

-- Users can see only metadata (key_last4, selected_model, is_default, verified_at)
-- but the encrypted_api_key column is also gated by RLS.
-- We rely on edge functions (service role) to read/write encrypted_api_key; we still allow user SELECT
-- so the client can read its own metadata. The client should NEVER select encrypted_api_key.
CREATE POLICY "Users can view own ai provider"
  ON public.user_ai_providers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai provider"
  ON public.user_ai_providers FOR DELETE
  USING (auth.uid() = user_id);

-- INSERT/UPDATE only via edge functions (service role bypasses RLS), but we add a policy so authenticated
-- updates of preferences (model/default) work via the edge function with the user's JWT too.
CREATE POLICY "Users can update own ai provider"
  ON public.user_ai_providers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai provider"
  ON public.user_ai_providers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_ai_providers_updated_at
  BEFORE UPDATE ON public.user_ai_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();