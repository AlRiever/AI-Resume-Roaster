"use client";

import { useEffect, useState } from "react";

/* ============================================================
   Tier — Free / Plus / Premium
   ------------------------------------------------------------
   BETA-MODE IMPLEMENTATION:
     Currently stores the user's tier in localStorage. Anyone can
     flip their plan via the pricing modal — no payment required.
     This is intentional for beta testing.

   PRODUCTION (later):
     Replace the storage calls in getTier/setTier with a fetch
     against the user's profile row in Supabase. Everywhere else
     that uses useTier() / getDailyLimit() will continue working
     unchanged — that's the whole point of this file.

   When payments arrive, only this file needs to change.
   ============================================================ */

export type Tier = "free" | "plus" | "premium";

const TIER_KEY = "rr-tier";

/** Daily roast limit by tier. Infinity means unlimited. */
const DAILY_LIMITS: Record<Tier, number> = {
  free:    1,
  plus:    10,
  premium: Infinity,
};

/** Get the daily roast limit for a given tier. */
export function getDailyLimit(tier: Tier): number {
  return DAILY_LIMITS[tier] ?? DAILY_LIMITS.free;
}

/** Type guard — narrow an unknown string to a valid Tier. */
function isTier(v: unknown): v is Tier {
  return v === "free" || v === "plus" || v === "premium";
}

/** Read the current tier (browser-only). Defaults to "free". */
export function getTier(): Tier {
  if (typeof window === "undefined") return "free";
  try {
    const raw = localStorage.getItem(TIER_KEY);
    return isTier(raw) ? raw : "free";
  } catch {
    return "free";
  }
}

/** Set the tier (browser-only). Fires a custom event so other
    components can react in the same tab. */
export function setTier(t: Tier): void {
  if (typeof window === "undefined") return;
  try {
    if (t === "free") localStorage.removeItem(TIER_KEY);
    else              localStorage.setItem(TIER_KEY, t);
  } catch { /* ignore */ }
  // Cross-component notification within the same tab:
  // 'storage' events only fire across tabs by default, so we
  // dispatch our own event to force same-tab listeners to update.
  window.dispatchEvent(new CustomEvent("rr-tier-changed", { detail: t }));
}

/** React hook — returns the current tier and reactively updates
    when setTier is called anywhere in the app. */
export function useTier(): [Tier, (t: Tier) => void] {
  // Default to "free" on SSR; the effect below corrects it on mount.
  const [tier, setTierState] = useState<Tier>("free");

  useEffect(() => {
    setTierState(getTier());

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<unknown>).detail;
      if (isTier(detail)) setTierState(detail);
    };
    // Same-tab updates via our custom event
    window.addEventListener("rr-tier-changed", onChange);
    // Cross-tab updates via the storage event (fired by other tabs)
    const onStorage = (e: StorageEvent) => {
      if (e.key === TIER_KEY) setTierState(getTier());
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("rr-tier-changed", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return [tier, (t: Tier) => { setTier(t); setTierState(t); }];
}
