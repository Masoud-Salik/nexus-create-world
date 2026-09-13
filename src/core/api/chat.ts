import { apiRequest } from "./client";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatRequestPayload = {
  messages: ChatMessage[];
  userContext?: Record<string, unknown>;
  userLocalTime?: string;
  userTimeOfDay?: string;
};

export async function chatRequest(payload: ChatRequestPayload, signal?: AbortSignal) {
  return apiRequest<{ ok?: boolean; message?: string }>("/chat", {
    method: "POST",
    body: payload,
    signal,
  });
}

export async function chatStreamRequest(payload: ChatRequestPayload, signal?: AbortSignal) {
  const { data } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Trace-Id": crypto.randomUUID(),
  };

  if (data.session?.access_token) {
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  return fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal,
  });
}
