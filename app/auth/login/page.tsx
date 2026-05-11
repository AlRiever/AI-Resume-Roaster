"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase-browser";

/* ============================================================
   Login page — /auth/login (v1.4.0 — auth wired)
   ------------------------------------------------------------
   On submit: supabase.auth.signInWithPassword(). On success,
   redirect to ?next= (set by the auth guard) or to / by default.

   Error UX is intentionally vague — we don't reveal whether the
   email or the password was wrong (basic enumeration defense).
   ============================================================ */

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const nextPath = searchParams.get("next") || "/";
  const justConfirmed = searchParams.get("confirmed") === "1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInErr) {
        const msg = signInErr.message.toLowerCase();
        // "Email not confirmed" is its own clear message — show it as-is
        if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
          setError(
            "Please confirm your email first. Check your inbox for the link we sent."
          );
        } else {
          // Everything else collapses to a generic message —
          // don't reveal whether email or password was the issue.
          setError("Wrong email or password.");
        }
        setSubmitting(false);
        return;
      }

      if (!data.session) {
        setError("Login succeeded but no session was created. Please try again.");
        setSubmitting(false);
        return;
      }

      // Off we go. router.push so the back button still works.
      router.push(nextPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
      setSubmitting(false);
    }
  }

  async function sendForgotEmail(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const supabase = getSupabase();
      await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      setForgotSent(true);
    } finally { setForgotLoading(false); }
  }

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
          <button className="auth-back" onClick={() => router.push("/")} type="button">
            ← Back home
          </button>

          <h1 className="auth-title">
            Welcome<br />
            <span className="serif">back.</span>
          </h1>
          <p className="auth-sub">Log in to roast another resume.</p>

          {justConfirmed && (
            <div className="confirmed-banner" role="status">
              ✓ Email confirmed. Log in to continue.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 5 }}>
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotEmail(email); setForgotSent(false); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--accent, #FF4500)", textDecoration: "underline", textUnderlineOffset: 2, padding: 0 }}
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {/* ── Forgot password inline panel ── */}
            {showForgot && (
              <div style={{ background: "rgba(255,69,0,0.04)", border: "1px solid rgba(255,69,0,0.15)", borderRadius: 12, padding: "16px", marginBottom: 8 }}>
                {!forgotSent ? (
                  <form onSubmit={sendForgotEmail}>
                    <p style={{ fontSize: 13, color: "rgba(0,0,0,0.55)", marginBottom: 10, lineHeight: 1.5 }}>
                      Enter your email and we&apos;ll send you a reset link. After clicking it, you&apos;ll be brought back to the homepage logged in with a prompt to set your new password.
                    </p>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid rgba(0,0,0,0.12)", fontSize: 14, marginBottom: 8, boxSizing: "border-box" as const }}
                      required
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="submit" disabled={forgotLoading} style={{ flex: 1, padding: "10px", background: "var(--accent,#FF4500)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: forgotLoading ? 0.6 : 1 }}>
                        {forgotLoading ? "Sending…" : "Send Reset Link"}
                      </button>
                      <button type="button" onClick={() => setShowForgot(false)} style={{ padding: "10px 14px", background: "rgba(0,0,0,0.06)", border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <p style={{ fontSize: 13, color: "#2e7d32", lineHeight: 1.55 }}>
                    ✓ Reset link sent to <strong>{forgotEmail}</strong>. Check your inbox — after clicking the link you&apos;ll be logged in and prompted to set your new password.
                  </p>
                )}
              </div>
            )}

            {error && <div className="server-error" role="alert">{error}</div>}

            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? "Logging in…" : "Log in"}
            </button>

            <p className="auth-alt">
              No account yet?{" "}
              <button type="button" onClick={() => router.push("/auth/signup")}>
                Create one
              </button>
            </p>
          </form>
        </div>
      </main>
    </>
  );
}

// Reuse the same styles as signup — same visual language
const STYLES = `
  .auth-page{min-height:100vh;background:var(--bg, #FAF8F4);color:var(--ink, #0A0A0A);font-family:'DM Sans',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:48px 20px;position:relative;overflow:hidden;-webkit-font-smoothing:antialiased;}
  .auth-page .orb{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none;z-index:0;}
  .auth-page .orb-1{width:520px;height:520px;background:radial-gradient(circle,rgba(255,69,0,0.32) 0%,rgba(255,69,0,0) 70%);top:-160px;right:-140px;animation:auth-drift 22s ease-in-out infinite;}
  .auth-page .orb-2{width:380px;height:380px;background:radial-gradient(circle,rgba(255,69,0,0.18) 0%,rgba(255,69,0,0) 70%);bottom:-120px;left:-120px;animation:auth-drift 28s ease-in-out infinite reverse;}
  [data-theme="dark"] .auth-page .orb-1{background:radial-gradient(circle,rgba(124,92,255,0.4) 0%,rgba(124,92,255,0) 70%);}
  [data-theme="dark"] .auth-page .orb-2{background:radial-gradient(circle,rgba(124,92,255,0.25) 0%,rgba(124,92,255,0) 70%);}
  @keyframes auth-drift{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(40px,-30px) scale(1.08);}}
  .auth-card{position:relative;z-index:1;width:100%;max-width:420px;background:var(--bg, #FAF8F4);border:1px solid var(--line, rgba(0,0,0,0.07));border-radius:24px;padding:40px 36px;box-shadow:0 1px 0 rgba(255,255,255,0.5) inset, 0 24px 48px -16px rgba(0,0,0,0.08);animation:auth-rise 0.7s cubic-bezier(0.16,1,0.3,1) both;}
  @keyframes auth-rise{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
  .auth-back{background:transparent;border:none;color:var(--ink-60, rgba(0,0,0,0.6));font-family:inherit;font-size:13px;font-weight:500;cursor:pointer;padding:0;margin-bottom:24px;transition:color 0.2s;}
  .auth-back:hover{color:var(--ink, #0A0A0A);}
  .auth-title{font-size:clamp(36px,5vw,48px);font-weight:500;letter-spacing:-0.03em;line-height:1;margin-bottom:12px;}
  .auth-title .serif{font-family:'Fraunces',serif;font-style:italic;font-weight:400;}
  .auth-sub{color:var(--ink-60, rgba(0,0,0,0.6));font-size:15px;margin-bottom:32px;}
  .field{margin-bottom:18px;}
  .field label{display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:var(--ink, #0A0A0A);}
  .field input{width:100%;padding:12px 14px;border:1px solid var(--ink-15, rgba(0,0,0,0.15));border-radius:10px;font-family:inherit;font-size:15px;background:var(--bg, #FAF8F4);color:var(--ink, #0A0A0A);transition:border-color 0.2s,box-shadow 0.2s;}
  .field input:focus{outline:none;border-color:var(--ink, #0A0A0A);box-shadow:0 0 0 4px var(--ink-08, rgba(0,0,0,0.05));}
  .field input::placeholder{color:var(--ink-40, rgba(0,0,0,0.4));}
  .submit-btn{width:100%;padding:14px;background:var(--ink, #0A0A0A);color:var(--bg, #FAF8F4);border:none;border-radius:10px;font-family:inherit;font-size:15px;font-weight:500;cursor:pointer;transition:all 0.2s ease;margin-top:8px;}
  .submit-btn:hover:not(:disabled){background:var(--accent, #FF4500);transform:translateY(-1px);box-shadow:0 12px 28px rgba(255,69,0,0.25);}
  .submit-btn:disabled{opacity:0.5;cursor:not-allowed;}
  .confirmed-banner{display:flex;align-items:center;gap:8px;margin-bottom:24px;padding:11px 16px;background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.25);border-radius:10px;color:#16A34A;font-size:13px;font-weight:500;}
  .server-error{margin-bottom:16px;padding:12px 14px;background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.2);border-radius:10px;color:#DC2626;font-size:13px;line-height:1.5;}
  .auth-alt{text-align:center;margin-top:24px;font-size:13px;color:var(--ink-60, rgba(0,0,0,0.6));}
  .auth-alt button{background:none;border:none;color:var(--accent, #FF4500);font:inherit;font-weight:500;cursor:pointer;padding:0;}
  .auth-alt button:hover{text-decoration:underline;}
  @media(max-width:520px){.auth-card{padding:32px 24px;border-radius:20px;}}
`;
