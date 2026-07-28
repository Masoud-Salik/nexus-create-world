/**
 * E1 / M1.3 — guest session on the client.
 *
 * Blueprint v2's 90-second proof runs before an account exists. The guest token is
 * held in localStorage, sent as `x-anon-session`, and claimed once the user signs up.
 */

const KEY = "studytime.anon_session";

interface StoredSession {
  token: string;
  expiresAt: string;
}

export function readAnonSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || new Date(parsed.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeAnonSession(token: string, expiresAt: string): void {
  localStorage.setItem(KEY, JSON.stringify({ token, expiresAt } satisfies StoredSession));
}

export function clearAnonSession(): void {
  localStorage.removeItem(KEY);
}