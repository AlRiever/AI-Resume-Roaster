"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-browser";

/* ============================================================
   Signup page — /auth/signup (v1.4.0 — auth wired)
   ------------------------------------------------------------
   Submit is gated until the user clicks "Read our Policies" and
   confirms on that page (sets a flag in sessionStorage — dies on
   tab close or page reload).

   By design: form data and policy consent do NOT survive a page
   reload. This is a deliberate safety choice — personal data only
   lives in memory while the user is actively engaged.

   Flow on submit:
     1. supabase.auth.signUp({ email, password, data: { username } })
     2. Supabase sends a confirmation email to the user
     3. We show the "check your email" success state
     4. User clicks the link → /auth/callback exchanges the code →
        homepage, logged in
   ============================================================ */

// Bump this when policies meaningfully change — invalidates prior consents
const POLICIES_VERSION = "v1";
const POLICIES_KEY = `rr-policies-acknowledged-${POLICIES_VERSION}`;

const USERNAME_RX = /^[a-zA-Z0-9]+$/;
const USERNAME_MIN = 3;
const USERNAME_MAX = 20;
const PASSWORD_MIN = 8;

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail]                 = useState("");
  const [username, setUsername]           = useState("");
  const [password, setPassword]           = useState("");
  const [confirmPassword, setConfirm]     = useState("");
  const [policiesRead, setPoliciesRead]   = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [serverError, setServerError]     = useState<string | null>(null);
  const [signupComplete, setSignupComplete] = useState(false);

  // Check if user has already read policies in THIS TAB
  // (sessionStorage clears on tab close, so a new visit starts fresh —
  // safety measure: data shouldn't survive page reloads)
  useEffect(() => {
    setPoliciesRead(sessionStorage.getItem(POLICIES_KEY) === "yes");
  }, []);

  /* ── Field-level validation messages ── */
  const errors = {
    email:
      email.length === 0
        ? null
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? null
        : "Doesn't look like a valid email.",
    username:
      username.length === 0
        ? null
        : !USERNAME_RX.test(username)
        ? "Letters and numbers only — no spaces or symbols."
        : username.length < USERNAME_MIN
        ? `At least ${USERNAME_MIN} characters.`
        : username.length > USERNAME_MAX
        ? `At most ${USERNAME_MAX} characters.`
        : null,
    password:
      password.length === 0
        ? null
        : password.length < PASSWORD_MIN
        ? `At least ${PASSWORD_MIN} characters.`
        : null,
    confirm:
      confirmPassword.length === 0
        ? null
        : confirmPassword !== password
        ? "Passwords don't match."
        : null,
  };

  const allValid =
    email.length > 0 && !errors.email &&
    username.length > 0 && !errors.username &&
    password.length > 0 && !errors.password &&
    confirmPassword.length > 0 && !errors.confirm;

  const canSubmit = allValid && policiesRead && !submitting;

  /* ── "Read our Policies" navigation ──
     We deliberately do NOT save the form state. If the user
     refreshes during the policy chain, they restart from scratch
     by design — personal data shouldn't survive page reloads. */
  function handleReadPolicies() {
    router.push("/auth/policies");
  }

  /* ── Submit — calls Supabase Auth ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError(null);

    try {
      const supabase = getSupabase();

      // emailRedirectTo is the URL Supabase puts in the confirmation
      // email link. The user clicks it → arrives at /auth/callback
      // with a code in the URL → that route exchanges it for a session.
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },        // → trigger reads this into profiles.username
          emailRedirectTo,
        },
      });

      if (error) {
        // Supabase returns "User already registered" if the email is
        // taken AND email confirmation is required. Be friendly.
        const msg = error.message.toLowerCase();
        if (msg.includes("already registered") || msg.includes("already exists")) {
          setServerError("That email is already registered. Try logging in instead.");
        } else if (msg.includes("password")) {
          setServerError(error.message); // e.g. "Password should be at least 6 characters"
        } else {
          setServerError(error.message);
        }
        setSubmitting(false);
        return;
      }

      // The handle_new_user trigger runs synchronously inside Supabase
      // when auth.users is inserted. If the username is taken, the
      // unique-constraint violation surfaces here. Supabase Auth
      // currently reports this as a generic 500 from the trigger —
      // we catch it as an error above. If the trigger fails, the
      // auth.users row is rolled back, so the user can retry.
      if (!data.user) {
        // Defensive: should never happen, but guard anyway
        setServerError("Sign-up succeeded but no user was returned. Please try logging in.");
        setSubmitting(false);
        return;
      }

      // Clear policy consent — it was for this signup attempt only
      sessionStorage.removeItem(POLICIES_KEY);

      // Switch to the "check your email" state. We do NOT redirect —
      // the user has to click the link in their email first.
      setSignupComplete(true);
      setSubmitting(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setServerError(msg);
      setSubmitting(false);
    }
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400;1,9..144,500&display=swap" rel="stylesheet" />

      <style>{STYLES}</style>

      <main className="auth-page">
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <div className="auth-card">
          <button className="auth-back" onClick={() => router.push("/")} type="button">
            ← Back home
          </button>

          {signupComplete ? (
            <>
              <h1 className="auth-title">
                Check your<br />
                <span className="serif">email.</span>
              </h1>
              <p className="auth-sub">
                We sent a confirmation link to <strong>{email}</strong>. Click it to
                activate your account, then you'll be logged in and ready to roast.
              </p>

              <div className="email-instructions">
                <div className="email-step">
                  <span className="email-step-num">1</span>
                  <span>Open your email</span>
                </div>
                <div className="email-step">
                  <span className="email-step-num">2</span>
                  <span>Click the confirmation link</span>
                </div>
                <div className="email-step">
                  <span className="email-step-num">3</span>
                  <span>You'll land back here, logged in</span>
                </div>
              </div>

              <p className="email-hint">
                Didn't get it? Check your spam folder. Confirmation links expire after
                an hour — if yours did, just sign up again.
              </p>

              <button
                type="button"
                className="submit-btn"
                onClick={() => router.push("/auth/login")}
              >
                Go to login
              </button>
            </>
          ) : (
            <>
              <h1 className="auth-title">
                Create your<br />
                <span className="serif">account.</span>
              </h1>
              <p className="auth-sub">Free to start. 1 roast a day, on us.</p>

              <form onSubmit={handleSubmit} noValidate>
            <Field
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              error={errors.email}
              autoComplete="email"
            />
            <Field
              id="username"
              label="Username"
              hint="Letters and numbers only — no spaces."
              type="text"
              value={username}
              onChange={(v) => setUsername(v.trim())}
              placeholder="janedoe42"
              error={errors.username}
              autoComplete="username"
              maxLength={USERNAME_MAX}
            />
            <Field
              id="password"
              label="Password"
              hint={`At least ${PASSWORD_MIN} characters.`}
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              error={errors.password}
              autoComplete="new-password"
            />
            <Field
              id="confirm"
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={setConfirm}
              placeholder="••••••••"
              error={errors.confirm}
              autoComplete="new-password"
            />

            {!policiesRead ? (
              <>
                <button
                  type="button"
                  className="policies-btn"
                  onClick={handleReadPolicies}
                  disabled={!allValid}
                >
                  Read our Policies
                  <span className="arrow">→</span>
                </button>

                <p className="policies-disclosure">
                  In order to successfully create your account you are asked to go
                  through our policies and agree to all our terms &amp; conditions,
                  Privacy Policy and Refund Policy.
                </p>
              </>
            ) : (
              <>
                <div className="policies-agreed-chip" role="status">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="4 12 10 18 20 6"/>
                  </svg>
                  <span>All policies agreed</span>
                </div>

                {serverError && (
                  <div className="server-error" role="alert">{serverError}</div>
                )}

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={!canSubmit}
                >
                  {submitting ? "Creating account…" : "Create Account"}
                </button>
              </>
            )}

            <p className="auth-alt">
              Already have an account?{" "}
              <button type="button" onClick={() => router.push("/auth/login")}>
                Log in
              </button>
            </p>
          </form>
            </>
          )}
        </div>
      </main>
    </>
  );
}

/* ============================================================
   Reusable form field
   ============================================================ */
function Field({
  id, label, type, value, onChange, placeholder, error, hint,
  autoComplete, maxLength,
}: {
  id: string;
  label: string;
  type: "text" | "email" | "password";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error: string | null;
  hint?: string;
  autoComplete?: string;
  maxLength?: number;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        className={error ? "has-error" : ""}
      />
      {error
        ? <p className="field-error">{error}</p>
        : hint
        ? <p className="field-hint">{hint}</p>
        : null}
    </div>
  );
}

/* ============================================================
   Styles — keep consistent with homepage palette
   ============================================================ */
const STYLES = `
  .auth-page{
    min-height:100vh;
    background:var(--bg, #FAF8F4);
    color:var(--ink, #0A0A0A);
    font-family:'DM Sans',system-ui,sans-serif;
    display:flex;align-items:center;justify-content:center;
    padding:48px 20px;
    position:relative;overflow:hidden;
    -webkit-font-smoothing:antialiased;
  }
  /* Background orbs (subtle, matching homepage) */
  .auth-page .orb{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none;z-index:0;}
  .auth-page .orb-1{width:520px;height:520px;background:radial-gradient(circle,rgba(255,69,0,0.32) 0%,rgba(255,69,0,0) 70%);top:-160px;right:-140px;animation:auth-drift 22s ease-in-out infinite;}
  .auth-page .orb-2{width:380px;height:380px;background:radial-gradient(circle,rgba(255,69,0,0.18) 0%,rgba(255,69,0,0) 70%);bottom:-120px;left:-120px;animation:auth-drift 28s ease-in-out infinite reverse;}
  [data-theme="dark"] .auth-page .orb-1{background:radial-gradient(circle,rgba(124,92,255,0.4) 0%,rgba(124,92,255,0) 70%);}
  [data-theme="dark"] .auth-page .orb-2{background:radial-gradient(circle,rgba(124,92,255,0.25) 0%,rgba(124,92,255,0) 70%);}
  @keyframes auth-drift{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(40px,-30px) scale(1.08);}}

  .auth-card{
    position:relative;z-index:1;
    width:100%;max-width:480px;
    background:var(--bg, #FAF8F4);
    border:1px solid var(--line, rgba(0,0,0,0.07));
    border-radius:24px;
    padding:40px 36px;
    box-shadow:0 1px 0 rgba(255,255,255,0.5) inset, 0 24px 48px -16px rgba(0,0,0,0.08);
    animation:auth-rise 0.7s cubic-bezier(0.16,1,0.3,1) both;
  }
  @keyframes auth-rise{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}

  .auth-back{
    background:transparent;border:none;
    color:var(--ink-60, rgba(0,0,0,0.6));
    font-family:inherit;font-size:13px;font-weight:500;
    cursor:pointer;padding:0;margin-bottom:24px;
    transition:color 0.2s;
  }
  .auth-back:hover{color:var(--ink, #0A0A0A);}

  .auth-title{
    font-size:clamp(36px,5vw,48px);
    font-weight:500;
    letter-spacing:-0.03em;
    line-height:1;
    margin-bottom:12px;
  }
  .auth-title .serif{
    font-family:'Fraunces',serif;font-style:italic;font-weight:400;
  }
  .auth-sub{
    color:var(--ink-60, rgba(0,0,0,0.6));
    font-size:15px;
    margin-bottom:32px;
  }

  .field{margin-bottom:18px;}
  .field label{
    display:block;
    font-size:13px;font-weight:500;
    margin-bottom:6px;
    color:var(--ink, #0A0A0A);
  }
  .field input{
    width:100%;padding:12px 14px;
    border:1px solid var(--ink-15, rgba(0,0,0,0.15));
    border-radius:10px;
    font-family:inherit;font-size:15px;
    background:var(--bg, #FAF8F4);
    color:var(--ink, #0A0A0A);
    transition:border-color 0.2s,box-shadow 0.2s;
  }
  .field input:focus{
    outline:none;
    border-color:var(--ink, #0A0A0A);
    box-shadow:0 0 0 4px var(--ink-08, rgba(0,0,0,0.05));
  }
  .field input.has-error{
    border-color:#DC2626;
  }
  .field input.has-error:focus{
    box-shadow:0 0 0 4px rgba(220,38,38,0.1);
  }
  .field input::placeholder{color:var(--ink-40, rgba(0,0,0,0.4));}
  .field-hint{
    margin-top:6px;font-size:12px;
    color:var(--ink-40, rgba(0,0,0,0.4));
  }
  .field-error{
    margin-top:6px;font-size:12px;font-weight:500;
    color:#DC2626;
  }

  .policies-btn{
    width:100%;
    margin:8px 0 12px;
    padding:13px 16px;
    background:transparent;
    color:var(--ink, #0A0A0A);
    border:1px solid var(--ink-15, rgba(0,0,0,0.15));
    border-radius:10px;
    font-family:inherit;font-size:14px;font-weight:500;
    cursor:pointer;
    display:inline-flex;align-items:center;justify-content:center;gap:8px;
    transition:all 0.2s ease;
  }
  .policies-btn:hover:not(:disabled){
    border-color:var(--ink, #0A0A0A);
    background:var(--ink-08, rgba(0,0,0,0.05));
  }
  .policies-btn:disabled{opacity:0.4;cursor:not-allowed;}
  .policies-btn .arrow{transition:transform 0.2s ease;}
  .policies-btn:hover:not(:disabled) .arrow{transform:translateX(3px);}

  .policies-agreed-chip{
    display:flex;align-items:center;gap:8px;
    margin:8px 0 20px;
    padding:11px 16px;
    background:rgba(22,163,74,0.08);
    border:1px solid rgba(22,163,74,0.25);
    border-radius:10px;
    color:#16A34A;
    font-size:13px;font-weight:500;
    animation:agreed-in 0.5s cubic-bezier(0.16,1,0.3,1) both;
  }
  .policies-agreed-chip svg{width:16px;height:16px;flex-shrink:0;}
  @keyframes agreed-in{
    from{opacity:0;transform:translateY(-6px);}
    to{opacity:1;transform:translateY(0);}
  }

  .policies-disclosure{
    font-size:12px;line-height:1.55;
    color:var(--ink-60, rgba(0,0,0,0.6));
    margin-bottom:24px;
    padding:0 4px;
  }

  .submit-btn{
    width:100%;
    padding:14px;
    background:var(--ink, #0A0A0A);
    color:var(--bg, #FAF8F4);
    border:none;border-radius:10px;
    font-family:inherit;font-size:15px;font-weight:500;
    cursor:pointer;
    transition:all 0.2s ease;
    animation:submit-in 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both;
  }
  @keyframes submit-in{
    from{opacity:0;transform:translateY(8px);}
    to{opacity:1;transform:translateY(0);}
  }
  .submit-btn:hover:not(:disabled){
    background:var(--accent, #FF4500);
    transform:translateY(-1px);
    box-shadow:0 12px 28px rgba(255,69,0,0.25);
  }
  .submit-btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;box-shadow:none;}

  .server-error{
    margin-bottom:16px;padding:12px 14px;
    background:rgba(220,38,38,0.08);
    border:1px solid rgba(220,38,38,0.2);
    border-radius:10px;
    color:#DC2626;font-size:13px;line-height:1.5;
  }

  .auth-alt{
    text-align:center;
    margin-top:24px;
    font-size:13px;
    color:var(--ink-60, rgba(0,0,0,0.6));
  }
  .auth-alt button{
    background:none;border:none;
    color:var(--accent, #FF4500);
    font:inherit;font-weight:500;
    cursor:pointer;padding:0;
  }
  .auth-alt button:hover{text-decoration:underline;}

  /* "Check your email" success state */
  .email-instructions{
    margin:24px 0 20px;
    padding:20px;
    background:var(--ink-04, rgba(0,0,0,0.03));
    border:1px solid var(--line, rgba(0,0,0,0.07));
    border-radius:12px;
    display:flex;flex-direction:column;gap:14px;
  }
  .email-step{
    display:flex;align-items:center;gap:12px;
    font-size:14px;color:var(--ink, #0A0A0A);
  }
  .email-step-num{
    width:24px;height:24px;flex-shrink:0;
    border-radius:50%;
    background:var(--accent, #FF4500);
    color:#fff;
    display:inline-flex;align-items:center;justify-content:center;
    font-size:12px;font-weight:600;
    font-family:'DM Sans',system-ui,sans-serif;
  }
  .email-hint{
    font-size:12px;line-height:1.55;
    color:var(--ink-60, rgba(0,0,0,0.6));
    margin-bottom:20px;
    padding:0 4px;
  }

  @media(max-width:520px){
    .auth-card{padding:32px 24px;border-radius:20px;}
  }
`;
