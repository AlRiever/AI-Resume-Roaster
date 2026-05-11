"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-browser";

/* ============================================================
   /auth/reset-password
   Supabase redirects here after the user clicks the reset link
   in their email. The URL will contain a recovery token that
   Supabase handles automatically — we just need to let the user
   pick a new password.
   ============================================================ */

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPw,     setNewPw]     = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [ready,     setReady]     = useState(false);

  // Wait for Supabase to exchange the recovery token from the URL hash
  useEffect(() => {
    const supabase = getSupabase();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPw.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setError("Passwords don't match."); return; }
    setSaving(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => router.push("/"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally { setSaving(false); }
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'DM Sans',system-ui,sans-serif;background:#FAF8F4;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
        [data-theme="dark"] body{background:#0f0f10;}
        .card{
          width:100%;max-width:400px;border-radius:20px;padding:36px 32px;
          background:rgba(255,255,255,0.8);border:1px solid rgba(0,0,0,0.07);
          box-shadow:0 8px 40px rgba(0,0,0,0.1);
          backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
        }
        [data-theme="dark"] .card{background:rgba(24,24,28,0.85);border-color:rgba(255,255,255,0.08);}
        h1{font-size:22px;font-weight:700;margin-bottom:6px;}
        p{font-size:14px;color:rgba(0,0,0,0.5);margin-bottom:24px;line-height:1.5;}
        [data-theme="dark"] p{color:rgba(255,255,255,0.4);}
        label{display:block;font-size:12px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:5px;}
        [data-theme="dark"] label{color:rgba(255,255,255,0.4);}
        input{
          width:100%;padding:12px 14px;border-radius:10px;font-size:14px;
          border:1.5px solid rgba(0,0,0,0.12);background:rgba(255,255,255,0.8);
          outline:none;transition:border-color .15s;margin-bottom:14px;
        }
        input:focus{border-color:#FF4500;box-shadow:0 0 0 3px rgba(255,69,0,0.12);}
        [data-theme="dark"] input{background:rgba(255,255,255,0.07);border-color:rgba(255,255,255,0.12);color:#f0f0f0;}
        button{
          width:100%;padding:13px;border-radius:10px;font-size:15px;font-weight:700;
          background:#FF4500;color:#fff;border:none;cursor:pointer;
          transition:opacity .15s;margin-top:4px;
        }
        button:hover{opacity:.88;}
        button:disabled{opacity:.5;cursor:not-allowed;}
        .err{font-size:13px;color:#e53935;margin-bottom:12px;}
        .success{font-size:14px;color:#2e7d32;background:rgba(46,125,50,0.09);border-radius:10px;padding:14px;line-height:1.5;}
        [data-theme="dark"] .success{color:#81c784;}
        .waiting{text-align:center;color:rgba(0,0,0,0.4);font-size:14px;padding:24px 0;}
        [data-theme="dark"] .waiting{color:rgba(255,255,255,0.35);}
      `}</style>

      <div className="card">
        <h1>Set New Password</h1>

        {!ready && !success && (
          <div className="waiting">Verifying reset link…</div>
        )}

        {ready && !success && (
          <>
            <p>Choose a new password for your account. You&apos;ll be redirected to the homepage after saving.</p>
            <form onSubmit={handleSubmit}>
              <label>New Password</label>
              <input type="password" placeholder="At least 8 characters" value={newPw} onChange={e => setNewPw(e.target.value)} autoFocus autoComplete="new-password" />
              <label>Confirm New Password</label>
              <input type="password" placeholder="Repeat new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" />
              {error && <div className="err">{error}</div>}
              <button type="submit" disabled={saving}>{saving ? "Saving…" : "Set New Password"}</button>
            </form>
          </>
        )}

        {success && (
          <div className="success">
            ✓ Password updated successfully! Redirecting you to the homepage…
          </div>
        )}
      </div>
    </>
  );
}
