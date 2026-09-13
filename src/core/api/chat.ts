import { apiRequest, apiStreamRequest } from "./client";

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
  return apiStreamRequest("/chat", {
    method: "POST",
    body: payload,
    signal,
  });
}
