import { supabase } from "@/integrations/supabase/client";

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_EXPIRY = 3600; // 1 hour
const CACHE_BUFFER = 300; // refresh 5 min before expiry

/**
 * Resolves an avatar_url value to a displayable URL.
 * - If it's already a full URL (legacy), returns as-is.
 * - If it's a storage path, creates a signed URL with caching.
 */
export async function getAvatarDisplayUrl(avatarUrl: string | null): Promise<string | null> {
  if (!avatarUrl) return null;

  // Legacy full URLs — pass through
  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
    return avatarUrl;
  }

  // Check cache
  const cached = signedUrlCache.get(avatarUrl);
  const now = Date.now() / 1000;
  if (cached && cached.expiresAt > now + CACHE_BUFFER) {
    return cached.url;
  }

  // Create signed URL
  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(avatarUrl, SIGNED_URL_EXPIRY);

  if (error || !data?.signedUrl) {
    console.error("Failed to create signed avatar URL:", error);
    return null;
  }

  signedUrlCache.set(avatarUrl, {
    url: data.signedUrl,
    expiresAt: now + SIGNED_URL_EXPIRY,
  });

  return data.signedUrl;
}
