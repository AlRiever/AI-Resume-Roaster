"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "./supabase-browser";

/* ============================================================
   Auth helpers (v1.4.0)
   ------------------------------------------------------------
   - useUser(): subscribes to auth-state changes and returns the
     current user + a "loading" flag. Use this anywhere you want
     to react to login state.

   - useRequireAuth(): same as useUser, but redirects to /auth/login
     if there's no session. Drop this into any page that needs to
     be logged-in only.

   - signOut(): convenience.

   The actual signUp / signInWithPassword calls live in the page
   components — they have form state and field-level errors that
   would just be passed through here uselessly.
   ============================================================ */

interface AuthState {
  user: User | null;
  session: Session | null;
  /** True while the initial getSession() round-trip is in flight.
      Lets pages avoid flashing "logged out" UI for a frame. */
  loading: boolean;
}

/**
 * Subscribe to the current auth state. Reactively updates on
 * sign-in, sign-out, token refresh, or any other auth event.
 */
export function useUser(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    const supabase = getSupabase();
    let mounted = true;

    // Initial fetch — auth state may already be in localStorage
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState({
        user: data.session?.user ?? null,
        session: data.session,
        loading: false,
      });
    });

    // Subscribe to ongoing changes (login, logout, refresh, etc.)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
      });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

/**
 * Page-level auth guard. Returns the same shape as useUser, but
 * if loading completes and there's no user, redirects to /auth/login
 * with a `?next=` param so we can come back here after login.
 */
export function useRequireAuth(): AuthState {
  const router = useRouter();
  const auth = useUser();

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      const next =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/";
      router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
    }
  }, [auth.loading, auth.user, router]);

  return auth;
}

/** Sign out the current user. Triggers onAuthStateChange listeners. */
export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  await supabase.auth.signOut();
}
