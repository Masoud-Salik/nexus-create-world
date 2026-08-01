/**
 * E3 / M3.2 — entitlements stub.
 *
 * There is no subscription system yet. This exists so call sites already ask
 * the question, and so adding tiers later is a one-file change.
 */
export interface Entitlement {
  allowed: boolean;
  tier: "free";
}

export function getEntitlement(_ownerId: string): Entitlement {
  return { allowed: true, tier: "free" };
}