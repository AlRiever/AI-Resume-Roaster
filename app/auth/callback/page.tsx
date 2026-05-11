"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-browser";

/* ============================================================
   Auth callback — /auth/callback
   ------------------------------------------------------------
   Supabase's confirmation email link points here. Two flows
   land on this route:

   1. PKCE flow (modern default): URL has ?code=... and we call
      exchangeCodeForSession() to mint a session.
   2. Implicit flow (legacy): the supabase client config option
      detectSessionInUrl auto-handles a URL hash like
      #access_token=... — we don't have to do anything in code,
      just wait for the session to appear via onAuthStateChange.

   We check for a code first; if there isn't one, we fall back
   to a short poll (give detectSessionInUrl up to ~3 seconds to
   see the hash and write a session). Either way, success →
   homepage, failure → login page with an error.
   ============================================================ */

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = getSupabase();
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const errParam = url.searchParams.get("error_description") || url.searchParams.get("error");

      // The link itself may have arrived with an error — e.g. expired
      if (errParam) {
        if (!cancelled) setError(decodeURIComponent(errParam.replace(/\+/g, " ")));
        return;
      }

      // PKCE path
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeErr) {
          setError(exchangeErr.message);
          return;
        }
        // Strip the code from the URL so a refresh doesn't try to
        // re-exchange (which would fail — codes are single-use).
        window.history.replaceState({}, "", "/auth/callback");
        // Short delay so the success message is briefly visible
        setTimeout(() => {
          if (!cancelled) router.replace("/");
        }, 600);
        return;
      }

      // Implicit / hash-token path — give detectSessionInUrl a moment
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          setTimeout(() => {
            if (!cancelled) router.replace("/");
          }, 400);
          return;
        }
        await new Promise(r => setTimeout(r, 200));
      }

      if (!cancelled) {
        setError("Could not complete sign-in. The link may have expired.");
      }
    }

    run();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Fraunces:ital,opsz,wght@0,9..144,400;1,9..144,400&display=swap" rel="stylesheet" />

      <style>{STYLES}</style>

      <main className="auth-page">
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <div className="auth-card">
          {error ? (
            <>
              <h1 className="auth-title">
                Something<br />
                <span className="serif">went wrong.</span>
              </h1>
              <p className="auth-sub">{error}</p>
              <button
                type="button"
                className="submit-btn"
                onClick={() => router.push("/auth/login")}
              >
                Back to login
              </button>
            </>
          ) : (
            <>
              <h1 className="auth-title">
                Logging<br />
                <span className="serif">you in…</span>
              </h1>
              <p className="auth-sub">Just a moment while we finish setting up your account.</p>
              <div className="spinner" aria-label="Loading" />
            </>
          )}
        </div>
      </main>
    </>
  );
}

const STYLES = `
  .auth-page{min-height:100vh;background:var(--bg, #FAF8F4);color:var(--ink, #0A0A0A);font-family:'DM Sans',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:48px 20px;position:relative;overflow:hidden;-webkit-font-smoothing:antialiased;}
  .auth-page .orb{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none;z-index:0;}
  .auth-page .orb-1{width:520px;height:520px;background:radial-gradient(circle,rgba(255,69,0,0.32) 0%,rgba(255,69,0,0) 70%);top:-160px;right:-140px;animation:auth-drift 22s ease-in-out infinite;}
  .auth-page .orb-2{width:380px;height:380px;background:radial-gradient(circle,rgba(255,69,0,0.18) 0%,rgba(255,69,0,0) 70%);bottom:-120px;left:-120px;animation:auth-drift 28s ease-in-out infinite reverse;}
  [data-theme="dark"] .auth-page .orb-1{background:radial-gradient(circle,rgba(124,92,255,0.4) 0%,rgba(124,92,255,0) 70%);}
  [data-theme="dark"] .auth-page .orb-2{background:radial-gradient(circle,rgba(124,92,255,0.25) 0%,rgba(124,92,255,0) 70%);}
  @keyframes auth-drift{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(40px,-30px) scale(1.08);}}

  .auth-card{position:relative;z-index:1;width:100%;max-width:420px;background:var(--bg, #FAF8F4);border:1px solid var(--line, rgba(0,0,0,0.07));border-radius:24px;padding:40px 36px;text-align:center;box-shadow:0 1px 0 rgba(255,255,255,0.5) inset, 0 24px 48px -16px rgba(0,0,0,0.08);animation:auth-rise 0.7s cubic-bezier(0.16,1,0.3,1) both;}
  @keyframes auth-rise{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}

  .auth-title{font-size:clamp(36px,5vw,48px);font-weight:500;letter-spacing:-0.03em;line-height:1;margin-bottom:12px;}
  .auth-title .serif{font-family:'Fraunces',serif;font-style:italic;font-weight:400;}
  .auth-sub{color:var(--ink-60, rgba(0,0,0,0.6));font-size:15px;margin-bottom:32px;}

  .spinner{width:32px;height:32px;margin:0 auto;border-radius:50%;border:3px solid var(--ink-15, rgba(0,0,0,0.15));border-top-color:var(--accent, #FF4500);animation:spin 0.8s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}

  .submit-btn{width:100%;padding:14px;background:var(--ink, #0A0A0A);color:var(--bg, #FAF8F4);border:none;border-radius:10px;font-family:inherit;font-size:15px;font-weight:500;cursor:pointer;transition:all 0.2s ease;margin-top:16px;}
  .submit-btn:hover{background:var(--accent, #FF4500);transform:translateY(-1px);box-shadow:0 12px 28px rgba(255,69,0,0.25);}

  @media(max-width:520px){.auth-card{padding:32px 24px;border-radius:20px;}}
`;
