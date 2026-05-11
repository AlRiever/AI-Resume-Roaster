"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { getSupabase } from "@/lib/supabase-browser";

/* ============================================================
   ProfileModal — floating glass window (v1.5.0)
   Sections: Avatar · Username · Password · Delete Account
   ============================================================ */

type Section = "menu" | "avatar" | "username" | "password" | "delete";

interface Props {
  userEmail: string;
  userId: string;
  onClose: () => void;
  onAvatarChange: (url: string) => void;
  currentAvatarUrl: string;
}

/* Helper — alphanumeric username validator */
const USERNAME_RE = /^[a-zA-Z0-9]{3,30}$/;

export default function ProfileModal({
  userEmail, userId, onClose, onAvatarChange, currentAvatarUrl,
}: Props) {
  const [section, setSection] = useState<Section>("menu");

  /* ── Avatar ───────────────────────────────────────────── */
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null);
  const [avatarDrag,    setAvatarDrag]    = useState(false);
  const [avatarSaving,  setAvatarSaving]  = useState(false);
  const [avatarErr,     setAvatarErr]     = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFile = (file: File) => {
    if (!file.type.startsWith("image/")) { setAvatarErr("Only image files are accepted."); return; }
    if (file.size > 5 * 1024 * 1024)    { setAvatarErr("Image must be under 5 MB."); return; }
    setAvatarErr(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const saveAvatar = async () => {
    if (!avatarFile) return;
    setAvatarSaving(true); setAvatarErr(null);
    try {
      const supabase = getSupabase();
      const ext  = avatarFile.name.split(".").pop() ?? "png";
      const path = `avatars/${userId}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      onAvatarChange(publicUrl);
      setSection("menu");
    } catch (e: unknown) {
      setAvatarErr(e instanceof Error ? e.message : "Upload failed.");
    } finally { setAvatarSaving(false); }
  };

  /* ── Username ──────────────────────────────────────────── */
  const [username,        setUsername]        = useState("");
  const [usernameErr,     setUsernameErr]     = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState(false);
  const [usernameSaving,  setUsernameSaving]  = useState(false);

  const saveUsername = async () => {
    setUsernameErr(null); setUsernameSuccess(false);
    if (!USERNAME_RE.test(username)) {
      setUsernameErr("Username must be 3–30 characters and alphanumeric only (e.g. JohnDoe7945).");
      return;
    }
    setUsernameSaving(true);
    try {
      const supabase = getSupabase();
      // Check uniqueness
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .neq("id", userId)
        .maybeSingle();
      if (existing) { setUsernameErr("That username is already taken."); return; }
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, username }, { onConflict: "id" });
      if (error) throw error;
      await supabase.auth.updateUser({ data: { username } });
      setUsernameSuccess(true);
    } catch (e: unknown) {
      setUsernameErr(e instanceof Error ? e.message : "Failed to save username.");
    } finally { setUsernameSaving(false); }
  };

  /* ── Password ──────────────────────────────────────────── */
  const [currentPw,     setCurrentPw]     = useState("");
  const [newPw,         setNewPw]         = useState("");
  const [confirmPw,     setConfirmPw]     = useState("");
  const [pwErr,         setPwErr]         = useState<string | null>(null);
  const [pwSuccess,     setPwSuccess]     = useState(false);
  const [pwSaving,      setPwSaving]      = useState(false);
  const [showForgot,    setShowForgot]    = useState(false);
  const [forgotEmail,   setForgotEmail]   = useState(userEmail);
  const [forgotSent,    setForgotSent]    = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const savePassword = async () => {
    setPwErr(null); setPwSuccess(false);
    if (!currentPw) { setPwErr("Please enter your current password."); return; }
    if (newPw.length < 8) { setPwErr("New password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setPwErr("New passwords don't match."); return; }
    setPwSaving(true);
    try {
      const supabase = getSupabase();
      // Re-authenticate with current password first
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: userEmail, password: currentPw,
      });
      if (signInErr) { setPwErr("Current password is incorrect."); return; }
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setPwSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (e: unknown) {
      setPwErr(e instanceof Error ? e.message : "Failed to update password.");
    } finally { setPwSaving(false); }
  };

  const sendForgotEmail = async () => {
    setForgotLoading(true);
    try {
      const supabase = getSupabase();
      await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      setForgotSent(true);
    } finally { setForgotLoading(false); }
  };

  /* ── Delete Account ────────────────────────────────────── */
  const [deleteConfirm,  setDeleteConfirm]  = useState(false);
  const [deleteLoading,  setDeleteLoading]  = useState(false);
  const [deleteErr,      setDeleteErr]      = useState<string | null>(null);
  const [deleteScheduled,setDeleteScheduled]= useState(false);

  const scheduleDelete = async () => {
    setDeleteLoading(true); setDeleteErr(null);
    try {
      const res = await fetch("/api/auth/schedule-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setDeleteScheduled(true);
    } catch (e: unknown) {
      setDeleteErr(e instanceof Error ? e.message : "Failed to schedule deletion.");
    } finally { setDeleteLoading(false); }
  };

  /* ── Close on Escape ───────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* ── Drop handlers ─────────────────────────────────────── */
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setAvatarDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) handleAvatarFile(file);
  }, []);

  /* ── Render ────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        .pm-backdrop{
          position:fixed;inset:0;z-index:9000;
          display:flex;align-items:center;justify-content:center;
          padding:16px;
          background:rgba(0,0,0,0.45);
          backdrop-filter:blur(8px);
          -webkit-backdrop-filter:blur(8px);
          animation:pm-fade-in 0.2s ease;
        }
        @keyframes pm-fade-in{from{opacity:0;}to{opacity:1;}}

        .pm-glass{
          position:relative;
          width:100%;max-width:420px;
          border-radius:20px;
          padding:32px 28px 28px;
          background:rgba(255,255,255,0.72);
          border:1px solid rgba(255,255,255,0.9);
          box-shadow:0 8px 48px rgba(0,0,0,0.18),0 1px 2px rgba(0,0,0,0.08);
          backdrop-filter:blur(28px) saturate(1.6);
          -webkit-backdrop-filter:blur(28px) saturate(1.6);
          animation:pm-slide-up 0.25s cubic-bezier(0.16,1,0.3,1);
          overflow:hidden;
        }
        [data-theme="dark"] .pm-glass{
          background:rgba(22,22,26,0.78);
          border-color:rgba(255,255,255,0.10);
          box-shadow:0 8px 48px rgba(0,0,0,0.5),0 1px 2px rgba(0,0,0,0.3);
        }
        @keyframes pm-slide-up{from{transform:translateY(16px);opacity:0;}to{transform:translateY(0);opacity:1;}}

        /* Glass orb — very subtle ambient */
        .pm-glass::before{
          content:"";position:absolute;inset:0;pointer-events:none;z-index:0;
          background:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(255,69,0,0.07) 0%,transparent 70%);
          animation:pm-orb 28s ease-in-out infinite;
        }
        @keyframes pm-orb{0%,100%{opacity:.5;transform:scale(1);}50%{opacity:1;transform:scale(1.06);}}

        .pm-inner{position:relative;z-index:1;}

        .pm-close{
          position:absolute;top:14px;right:14px;z-index:2;
          width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;
          background:rgba(0,0,0,0.07);color:inherit;
          display:flex;align-items:center;justify-content:center;
          transition:background .15s;
        }
        .pm-close:hover{background:rgba(0,0,0,0.13);}
        [data-theme="dark"] .pm-close{background:rgba(255,255,255,0.08);}
        [data-theme="dark"] .pm-close:hover{background:rgba(255,255,255,0.14);}

        /* ── Avatar top ── */
        .pm-avatar-wrap{
          display:flex;flex-direction:column;align-items:center;gap:0;margin-bottom:22px;
        }
        .pm-avatar-ring{
          position:relative;width:80px;height:80px;
          border-radius:50%;overflow:visible;cursor:pointer;
        }
        .pm-avatar-img{
          width:80px;height:80px;border-radius:50%;object-fit:cover;
          border:2.5px solid rgba(255,255,255,0.7);
          box-shadow:0 2px 12px rgba(0,0,0,0.15);
          display:block;
        }
        [data-theme="dark"] .pm-avatar-img{border-color:rgba(255,255,255,0.15);}
        .pm-avatar-edit{
          position:absolute;bottom:0;right:0;
          width:26px;height:26px;border-radius:50%;
          background:var(--accent,#FF4500);color:#fff;border:2px solid #fff;
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.2);
          transition:transform .15s;
        }
        .pm-avatar-edit:hover{transform:scale(1.12);}
        [data-theme="dark"] .pm-avatar-edit{border-color:rgba(22,22,26,0.9);}
        .pm-avatar-name{
          margin-top:10px;font-size:15px;font-weight:600;text-align:center;
          color:var(--ink,#1a1a1a);
        }
        [data-theme="dark"] .pm-avatar-name{color:#f0f0f0;}
        .pm-avatar-email{
          font-size:12px;color:rgba(0,0,0,0.45);text-align:center;margin-top:2px;
          max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        }
        [data-theme="dark"] .pm-avatar-email{color:rgba(255,255,255,0.38);}

        /* ── Menu items ── */
        .pm-menu{display:flex;flex-direction:column;gap:8px;}
        .pm-menu-item{
          display:flex;align-items:center;gap:12px;
          width:100%;text-align:left;border:none;cursor:pointer;
          padding:13px 14px;border-radius:12px;
          background:rgba(0,0,0,0.04);
          color:inherit;font-size:14px;font-weight:500;
          transition:background .15s,transform .1s;
        }
        .pm-menu-item:hover{background:rgba(0,0,0,0.08);transform:translateX(2px);}
        [data-theme="dark"] .pm-menu-item{background:rgba(255,255,255,0.06);}
        [data-theme="dark"] .pm-menu-item:hover{background:rgba(255,255,255,0.11);}
        .pm-menu-item.danger{color:#e53935;}
        .pm-menu-item.danger:hover{background:rgba(229,57,53,0.08);}
        .pm-menu-icon{width:18px;height:18px;opacity:0.7;flex-shrink:0;}
        .pm-menu-chevron{margin-left:auto;opacity:0.35;width:14px;height:14px;}

        /* ── Divider ── */
        .pm-divider{height:1px;background:rgba(0,0,0,0.07);margin:10px 0;}
        [data-theme="dark"] .pm-divider{background:rgba(255,255,255,0.08);}

        /* ── Section heading ── */
        .pm-back{
          display:flex;align-items:center;gap:6px;
          background:none;border:none;cursor:pointer;
          font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
          color:rgba(0,0,0,0.4);padding:0 0 14px;
          transition:color .15s;
        }
        .pm-back:hover{color:rgba(0,0,0,0.75);}
        [data-theme="dark"] .pm-back{color:rgba(255,255,255,0.35);}
        [data-theme="dark"] .pm-back:hover{color:rgba(255,255,255,0.7);}
        .pm-section-title{font-size:17px;font-weight:700;margin-bottom:18px;color:var(--ink,#1a1a1a);}
        [data-theme="dark"] .pm-section-title{color:#f0f0f0;}

        /* ── Form elements ── */
        .pm-label{font-size:12px;font-weight:600;color:rgba(0,0,0,0.5);margin-bottom:5px;display:block;}
        [data-theme="dark"] .pm-label{color:rgba(255,255,255,0.4);}
        .pm-input{
          width:100%;padding:11px 13px;border-radius:10px;font-size:14px;
          border:1.5px solid rgba(0,0,0,0.13);
          background:rgba(255,255,255,0.7);
          color:var(--ink,#1a1a1a);
          outline:none;transition:border-color .15s,box-shadow .15s;
          box-sizing:border-box;
        }
        .pm-input:focus{border-color:var(--accent,#FF4500);box-shadow:0 0 0 3px rgba(255,69,0,0.12);}
        [data-theme="dark"] .pm-input{
          background:rgba(255,255,255,0.07);border-color:rgba(255,255,255,0.12);color:#f0f0f0;
        }
        [data-theme="dark"] .pm-input:focus{border-color:var(--accent,#FF4500);}
        .pm-field{margin-bottom:14px;}

        .pm-btn{
          width:100%;padding:12px;border-radius:10px;
          font-size:14px;font-weight:700;border:none;cursor:pointer;
          background:var(--accent,#FF4500);color:#fff;
          transition:opacity .15s,transform .1s;margin-top:6px;
        }
        .pm-btn:hover{opacity:.88;}
        .pm-btn:active{transform:scale(0.98);}
        .pm-btn:disabled{opacity:.5;cursor:not-allowed;}
        .pm-btn-ghost{
          width:100%;padding:11px;border-radius:10px;
          font-size:14px;font-weight:600;cursor:pointer;
          background:rgba(0,0,0,0.05);border:none;color:inherit;
          transition:background .15s;margin-top:6px;
        }
        .pm-btn-ghost:hover{background:rgba(0,0,0,0.09);}
        [data-theme="dark"] .pm-btn-ghost{background:rgba(255,255,255,0.07);}
        [data-theme="dark"] .pm-btn-ghost:hover{background:rgba(255,255,255,0.12);}
        .pm-btn-danger{background:#e53935;color:#fff;}
        .pm-btn-danger:hover{opacity:.88;}

        /* ── Messages ── */
        .pm-err{font-size:13px;color:#e53935;margin-top:8px;line-height:1.4;}
        .pm-success{
          font-size:13px;color:#2e7d32;background:rgba(46,125,50,0.09);
          border-radius:8px;padding:10px 12px;margin-top:8px;
        }
        [data-theme="dark"] .pm-success{color:#81c784;}

        /* ── Avatar drop zone ── */
        .pm-dropzone{
          border:2px dashed rgba(0,0,0,0.18);border-radius:14px;
          padding:28px 16px;text-align:center;cursor:pointer;
          transition:border-color .15s,background .15s;margin-bottom:16px;
        }
        .pm-dropzone.drag{border-color:var(--accent,#FF4500);background:rgba(255,69,0,0.05);}
        .pm-dropzone:hover{border-color:rgba(0,0,0,0.3);}
        [data-theme="dark"] .pm-dropzone{border-color:rgba(255,255,255,0.15);}
        [data-theme="dark"] .pm-dropzone.drag{background:rgba(255,69,0,0.08);}
        .pm-dropzone-hint{font-size:13px;color:rgba(0,0,0,0.45);margin-top:6px;}
        [data-theme="dark"] .pm-dropzone-hint{color:rgba(255,255,255,0.35);}
        .pm-preview-img{
          width:90px;height:90px;border-radius:50%;object-fit:cover;
          margin:0 auto 12px;display:block;
          box-shadow:0 2px 12px rgba(0,0,0,0.15);
        }

        /* ── Delete warning ── */
        .pm-warning-box{
          background:rgba(229,57,53,0.07);border:1px solid rgba(229,57,53,0.2);
          border-radius:12px;padding:16px;margin-bottom:16px;
          font-size:13px;line-height:1.55;color:rgba(0,0,0,0.65);
        }
        [data-theme="dark"] .pm-warning-box{color:rgba(255,255,255,0.55);border-color:rgba(229,57,53,0.3);}
        .pm-warning-box strong{color:#e53935;}

        .pm-link{
          background:none;border:none;cursor:pointer;
          color:var(--accent,#FF4500);font-size:13px;font-weight:500;
          text-decoration:underline;text-underline-offset:2px;padding:0;
        }
        .pm-link:hover{opacity:.75;}

        .pm-forgot-inline{display:flex;justify-content:flex-end;margin-top:4px;}
      `}</style>

      {/* Backdrop */}
      <div className="pm-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="pm-glass" role="dialog" aria-modal="true" aria-label="Profile Settings">
          <button className="pm-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/>
            </svg>
          </button>

          <div className="pm-inner">

            {/* ══════════ MAIN MENU ══════════ */}
            {section === "menu" && (
              <>
                {/* Avatar + name */}
                <div className="pm-avatar-wrap">
                  <div className="pm-avatar-ring" onClick={() => { setSection("avatar"); setAvatarPreview(null); setAvatarFile(null); setAvatarErr(null); }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="pm-avatar-img" src={currentAvatarUrl || "/default-avatar.png"} alt="Your avatar" />
                    <div className="pm-avatar-edit" title="Change avatar">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>
                      </svg>
                    </div>
                  </div>
                  <div className="pm-avatar-name">Profile Settings</div>
                  <div className="pm-avatar-email">{userEmail}</div>
                </div>

                <div className="pm-menu">
                  <button className="pm-menu-item" onClick={() => { setUsername(""); setUsernameErr(null); setUsernameSuccess(false); setSection("username"); }}>
                    <svg className="pm-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    Change Username
                    <svg className="pm-menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>

                  <button className="pm-menu-item" onClick={() => { setCurrentPw(""); setNewPw(""); setConfirmPw(""); setPwErr(null); setPwSuccess(false); setShowForgot(false); setForgotSent(false); setSection("password"); }}>
                    <svg className="pm-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                    Change Password
                    <svg className="pm-menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>

                  <div className="pm-divider" />

                  <button className="pm-menu-item danger" onClick={() => { setDeleteConfirm(false); setDeleteScheduled(false); setDeleteErr(null); setSection("delete"); }}>
                    <svg className="pm-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                    Delete Account
                    <svg className="pm-menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </>
            )}

            {/* ══════════ AVATAR ══════════ */}
            {section === "avatar" && (
              <>
                <button className="pm-back" onClick={() => setSection("menu")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Back
                </button>
                <div className="pm-section-title">Change Avatar</div>

                {/* Drop zone */}
                <div
                  className={`pm-dropzone ${avatarDrag ? "drag" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setAvatarDrag(true); }}
                  onDragLeave={() => setAvatarDrag(false)}
                  onDrop={onDrop}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="pm-preview-img" src={avatarPreview} alt="Preview" />
                  ) : (
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.3, margin: "0 auto 8px", display: "block" }}>
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                  )}
                  <div className="pm-dropzone-hint">
                    {avatarPreview ? "Click to choose a different image" : "Drag & drop an image here, or click to browse"}
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => { if (e.target.files?.[0]) handleAvatarFile(e.target.files[0]); }}
                  />
                </div>

                {avatarErr && <div className="pm-err">{avatarErr}</div>}

                <button className="pm-btn" onClick={saveAvatar} disabled={!avatarFile || avatarSaving}>
                  {avatarSaving ? "Saving…" : "Save Avatar"}
                </button>
                <button className="pm-btn-ghost" onClick={() => setSection("menu")}>Cancel</button>
              </>
            )}

            {/* ══════════ USERNAME ══════════ */}
            {section === "username" && (
              <>
                <button className="pm-back" onClick={() => setSection("menu")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Back
                </button>
                <div className="pm-section-title">Change Username</div>

                <div className="pm-field">
                  <label className="pm-label">New Username</label>
                  <input
                    className="pm-input"
                    type="text"
                    placeholder="e.g. JohnDoe7945"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setUsernameErr(null); setUsernameSuccess(false); }}
                    maxLength={30}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <div style={{ fontSize: 11, color: "rgba(0,0,0,0.35)", marginTop: 4 }}>
                    3–30 characters, letters and numbers only. You can use this to log in instead of your email.
                  </div>
                </div>

                {usernameErr     && <div className="pm-err">{usernameErr}</div>}
                {usernameSuccess && <div className="pm-success">✓ Username updated successfully!</div>}

                <button className="pm-btn" onClick={saveUsername} disabled={usernameSaving || !username}>
                  {usernameSaving ? "Saving…" : "Save Username"}
                </button>
              </>
            )}

            {/* ══════════ PASSWORD ══════════ */}
            {section === "password" && (
              <>
                <button className="pm-back" onClick={() => setSection("menu")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Back
                </button>
                <div className="pm-section-title">Change Password</div>

                {!showForgot ? (
                  <>
                    <div className="pm-field">
                      <label className="pm-label">Current Password</label>
                      <input className="pm-input" type="password" placeholder="Enter current password" value={currentPw} onChange={e => { setCurrentPw(e.target.value); setPwErr(null); }} autoComplete="current-password" />
                      <div className="pm-forgot-inline">
                        <button className="pm-link" type="button" onClick={() => { setShowForgot(true); setForgotSent(false); }}>
                          Forgot password?
                        </button>
                      </div>
                    </div>
                    <div className="pm-field">
                      <label className="pm-label">New Password</label>
                      <input className="pm-input" type="password" placeholder="At least 8 characters" value={newPw} onChange={e => { setNewPw(e.target.value); setPwErr(null); }} autoComplete="new-password" />
                    </div>
                    <div className="pm-field">
                      <label className="pm-label">Confirm New Password</label>
                      <input className="pm-input" type="password" placeholder="Repeat new password" value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setPwErr(null); }} autoComplete="new-password" />
                    </div>

                    {pwErr     && <div className="pm-err">{pwErr}</div>}
                    {pwSuccess && <div className="pm-success">✓ Password updated successfully!</div>}

                    <button className="pm-btn" onClick={savePassword} disabled={pwSaving}>
                      {pwSaving ? "Updating…" : "Update Password"}
                    </button>
                  </>
                ) : (
                  /* ── Forgot password sub-view ── */
                  <>
                    <p style={{ fontSize: 13, lineHeight: 1.55, color: "rgba(0,0,0,0.55)", marginBottom: 16 }}>
                      Enter your registered email address. We'll send you a link to reset your password.
                    </p>
                    {!forgotSent ? (
                      <>
                        <div className="pm-field">
                          <label className="pm-label">Email or Username</label>
                          <input
                            className="pm-input"
                            type="text"
                            placeholder="you@example.com"
                            value={forgotEmail}
                            onChange={e => setForgotEmail(e.target.value)}
                          />
                        </div>
                        <button className="pm-btn" onClick={sendForgotEmail} disabled={forgotLoading || !forgotEmail}>
                          {forgotLoading ? "Sending…" : "Send Reset Link"}
                        </button>
                        <button className="pm-btn-ghost" onClick={() => setShowForgot(false)}>Back</button>
                      </>
                    ) : (
                      <>
                        <div className="pm-success">
                          ✓ Reset link sent! Check your inbox at <strong>{forgotEmail}</strong>.<br/>
                          After clicking the link, you'll be taken to a page to set your new password.
                        </div>
                        <button className="pm-btn-ghost" style={{ marginTop: 14 }} onClick={() => { setShowForgot(false); setSection("menu"); }}>
                          Back to Settings
                        </button>
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* ══════════ DELETE ACCOUNT ══════════ */}
            {section === "delete" && (
              <>
                <button className="pm-back" onClick={() => setSection("menu")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Back
                </button>
                <div className="pm-section-title" style={{ color: "#e53935" }}>Delete Account</div>

                {!deleteScheduled ? (
                  <>
                    {!deleteConfirm ? (
                      <>
                        <div className="pm-warning-box">
                          <strong>⚠ Are you sure?</strong><br/><br/>
                          Deleting your account will permanently remove all your roast history and profile data.
                          <br/><br/>
                          Every account takes at least <strong>3 days (72 hours)</strong> to be permanently deleted after the request is submitted. You can log back in and cancel the deletion within this window.
                        </div>
                        <button className="pm-btn pm-btn-danger" onClick={() => setDeleteConfirm(true)}>
                          Yes, I want to delete my account
                        </button>
                        <button className="pm-btn-ghost" onClick={() => setSection("menu")}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <div className="pm-warning-box">
                          <strong>Final confirmation</strong><br/><br/>
                          Your account will be queued for deletion and permanently removed after <strong>72 hours</strong>. This action cannot be undone after the grace period.
                        </div>
                        {deleteErr && <div className="pm-err">{deleteErr}</div>}
                        <button className="pm-btn pm-btn-danger" onClick={scheduleDelete} disabled={deleteLoading}>
                          {deleteLoading ? "Processing…" : "Confirm — Delete My Account"}
                        </button>
                        <button className="pm-btn-ghost" onClick={() => setDeleteConfirm(false)}>Go Back</button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="pm-success" style={{ background: "rgba(229,57,53,0.07)", color: "#c62828" }}>
                    ✓ Your account has been queued for deletion. It will be permanently removed within <strong>72 hours</strong>.<br/><br/>
                    You can cancel by logging in and visiting Profile Settings before the grace period ends.
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
