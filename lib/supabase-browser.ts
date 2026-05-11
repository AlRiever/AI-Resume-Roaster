"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ============================================================
   Supabase browser client (v1.4.0 — auth integration)
   ------------------------------------------------------------
   Changes from v1.3.x:
     - persistSession is now TRUE. Login state survives refreshes.
     - autoRefreshToken is TRUE so the JWT renews silently.
     - We no longer inject an `x-session-id` header — RLS now
       uses auth.uid() server-side. Cleaner and more secure.
     - getSessionId() now returns the AUTHENTICATED user's id.
       It throws if the user isn't logged in. Callers should
       guard with requireUser() or the auth-guard hook in
       lib/auth.ts before calling it.

   Why one client instead of two: the auth-flow needs persisted
   sessions, and the upload flow needs the authenticated user's
   id as the storage path prefix. Both want the same client.
   ============================================================ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Did you create .env.local?"
  );
}

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // needed for the /auth/callback flow
      storageKey: "rr-auth",    // namespaced so it doesn't collide
    },
  });
  return _client;
}

/**
 * Returns the current logged-in user's id (which doubles as the
 * `session_id` on the roasts table and the storage folder prefix).
 *
 * Throws if not logged in. Callers in the upload flow should
 * already have routed unauthenticated users to /auth/login via
 * the auth guard, so reaching this without a session is a bug.
 */
export async function getSessionId(): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(`Could not read auth session: ${error.message}`);
  }
  if (!data.user) {
    throw new Error("Not logged in. Please sign in to continue.");
  }
  return data.user.id;
}
