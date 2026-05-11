"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, getSessionId } from "@/lib/supabase-browser";
import { useTier, getTier, getDailyLimit } from "@/lib/tier";
import { useUser, signOut as authSignOut } from "@/lib/auth";
import ProfileModal from "@/app/components/ProfileModal";

/* ============================================================
   Resume Roaster — Homepage (v1.4.0 — auth integrated)
   The marketing site is still public, but the upload modal's
   submit is gated behind auth. Logged-out users clicking
   "Roast my resume" get redirected to /auth/login first.
   ============================================================ */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function HomePage() {
  const router = useRouter();
  const [submitStage, setSubmitStage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tier, setTier] = useTier();

  /* ── Auth state ── */
  const { user } = useUser();
  const isLoggedIn = !!user;
  const [accountsOpen,  setAccountsOpen]  = useState(false);
  const [profileOpen,   setProfileOpen]   = useState(false);
  const [avatarUrl,     setAvatarUrl]     = useState<string>("/default-avatar.png");
  const accountsRef = useRef<HTMLDivElement>(null);

  // Sync avatar from user metadata when user loads
  useEffect(() => {
    if (user?.user_metadata?.avatar_url) setAvatarUrl(user.user_metadata.avatar_url);
  }, [user]);

  // Close dropdown on outside click + Escape
  useEffect(() => {
    if (!accountsOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (accountsRef.current && !accountsRef.current.contains(e.target as Node)) {
        setAccountsOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountsOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [accountsOpen]);

  /* ── Theme toggle ── */
  useEffect(() => {
    const toggle = document.getElementById("themeToggle");
    const root = document.documentElement;
    if (!toggle) return;

    const handleToggle = () => {
      const current = root.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      root.classList.add("theme-transitioning");
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("rr-theme", next); } catch {}
      toggle.classList.remove("flash");
      void (toggle as HTMLElement).offsetWidth;
      toggle.classList.add("flash");
      setTimeout(() => {
        root.classList.remove("theme-transitioning");
        toggle.classList.remove("flash");
      }, 600);
    };

    toggle.addEventListener("click", handleToggle);
    return () => toggle.removeEventListener("click", handleToggle);
  }, []);

  /* ── Nav border on scroll ── */
  useEffect(() => {
    const nav = document.getElementById("nav");
    if (!nav) return;
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          nav.classList.toggle("scrolled", window.scrollY > 8);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Reveal on scroll ── */
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      }),
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    document.querySelectorAll(".reveal, .reveal-stagger").forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* ── Modal management ── */
  useEffect(() => {
    const openModal = (id: string) => {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.classList.add("open");
      document.body.classList.add("modal-open");
      setTimeout(() => (modal.querySelector(".modal-close") as HTMLElement)?.focus(), 100);
    };
    const closeModal = (el: Element) => {
      el.classList.remove("open");
      document.body.classList.remove("modal-open");
    };

    const triggers = document.querySelectorAll("[data-open-modal]");
    const triggerHandlers: Array<[Element, EventListener]> = [];
    triggers.forEach(btn => {
      const handler = (e: Event) => {
        e.preventDefault();
        openModal((btn as HTMLElement).dataset.openModal!);
      };
      btn.addEventListener("click", handler);
      triggerHandlers.push([btn, handler]);
    });

    const backdrops = document.querySelectorAll(".modal-backdrop");
    const backdropHandlers: Array<[Element, EventListener]> = [];
    backdrops.forEach(bd => {
      const handler = (e: Event) => { if (e.target === bd) closeModal(bd); };
      bd.addEventListener("click", handler);
      backdropHandlers.push([bd, handler]);
    });

    const closeButtons = document.querySelectorAll(".modal-close");
    const closeHandlers: Array<[Element, EventListener]> = [];
    closeButtons.forEach(btn => {
      const handler = () => closeModal(btn.closest(".modal-backdrop")!);
      btn.addEventListener("click", handler);
      closeHandlers.push([btn, handler]);
    });

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") document.querySelectorAll(".modal-backdrop.open").forEach(closeModal);
    };
    document.addEventListener("keydown", escHandler);

    return () => {
      triggerHandlers.forEach(([el, h]) => el.removeEventListener("click", h));
      backdropHandlers.forEach(([el, h]) => el.removeEventListener("click", h));
      closeHandlers.forEach(([el, h]) => el.removeEventListener("click", h));
      document.removeEventListener("keydown", escHandler);
    };
  }, []);

  /* ── File handling ── */
  const selectedFileRef = useRef<File | null>(null);

  useEffect(() => {
    const dropZone    = document.getElementById("dropZone");
    const fileInput   = document.getElementById("fileInput") as HTMLInputElement;
    const fileSelected = document.getElementById("fileSelected");
    const fileNameEl  = document.getElementById("fileName");
    const fileSizeEl  = document.getElementById("fileSize");
    const fileIconEl  = document.getElementById("fileIcon");
    const fileRemove  = document.getElementById("fileRemove");
    const submitBtn   = document.getElementById("roastSubmit") as HTMLButtonElement;
    if (!dropZone || !fileInput || !fileSelected || !fileNameEl || !fileSizeEl || !fileIconEl || !fileRemove || !submitBtn) return;

    const formatSize = (b: number) => {
      if (b < 1024) return b + " B";
      if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
      return (b / 1024 / 1024).toFixed(1) + " MB";
    };

    const showError = (msg: string) => {
      dropZone.style.borderColor = "var(--accent)";
      const dt = dropZone.querySelector(".drop-text");
      if (dt) dt.textContent = msg;
      setTimeout(() => {
        dropZone.style.borderColor = "";
        if (dt) dt.innerHTML = 'Drag &amp; drop or <span class="accent">click to browse</span>';
      }, 2400);
    };

    const handleFile = (file: File | null) => {
      if (!file) return;
      if (!["application/pdf", "image/png"].includes(file.type)) {
        showError("Only PDF or PNG, please."); return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showError("Too big. 10MB max."); return;
      }
      selectedFileRef.current = file;
      fileNameEl.textContent = file.name;
      fileSizeEl.textContent = formatSize(file.size);
      fileIconEl.textContent = file.type === "application/pdf" ? "PDF" : "PNG";
      fileSelected.classList.add("shown");
      dropZone.style.display = "none";
      submitBtn.disabled = false;
    };

    const clickHandler  = () => fileInput.click();
    const keyHandler    = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === "Enter" || ke.key === " ") { e.preventDefault(); fileInput.click(); }
    };
    const changeHandler = (e: Event) => handleFile((e.target as HTMLInputElement).files?.[0] ?? null);
    const dragOverH     = (e: Event) => { e.preventDefault(); dropZone.classList.add("dragging"); };
    const dragLeaveH    = (e: Event) => {
      if (!dropZone.contains((e as DragEvent).relatedTarget as Node)) dropZone.classList.remove("dragging");
    };
    const dropH         = (e: Event) => {
      e.preventDefault();
      dropZone.classList.remove("dragging");
      handleFile((e as DragEvent).dataTransfer?.files[0] ?? null);
    };
    const removeHandler = () => {
      selectedFileRef.current = null;
      fileInput.value = "";
      fileSelected.classList.remove("shown");
      dropZone.style.display = "block";
      submitBtn.disabled = true;
    };

    dropZone.addEventListener("click", clickHandler);
    dropZone.addEventListener("keydown", keyHandler);
    fileInput.addEventListener("change", changeHandler);
    dropZone.addEventListener("dragover", dragOverH);
    dropZone.addEventListener("dragleave", dragLeaveH);
    dropZone.addEventListener("drop", dropH);
    fileRemove.addEventListener("click", removeHandler);

    return () => {
      dropZone.removeEventListener("click", clickHandler);
      dropZone.removeEventListener("keydown", keyHandler);
      fileInput.removeEventListener("change", changeHandler);
      dropZone.removeEventListener("dragover", dragOverH);
      dropZone.removeEventListener("dragleave", dragLeaveH);
      dropZone.removeEventListener("drop", dropH);
      fileRemove.removeEventListener("click", removeHandler);
    };
  }, []);

  /* ── Form submit — real Supabase pipeline ── */
  useEffect(() => {
    const form = document.getElementById("roastForm");
    if (!form) return;

    const submitBtn  = document.getElementById("roastSubmit") as HTMLButtonElement;
    const submitText = submitBtn?.querySelector(".submit-text");

    const handleSubmit = async (e: Event) => {
      e.preventDefault();
      const file = selectedFileRef.current;
      if (!file) return;

      const company = (document.getElementById("companyInput") as HTMLInputElement)?.value ?? "";

      // Update button state
      submitBtn.classList.add("submit-loading");
      if (submitText) submitText.textContent = "Checking quota…";
      submitBtn.disabled = true;
      setSubmitError(null);

      try {
        const supabase  = getSupabase();

        // ── 0. Auth guard ──
        // The upload flow now requires login. If the user clicked
        // "Roast my resume" while logged out, redirect them to login
        // and remember to come back here. (We could hide the upload
        // modal entirely for logged-out users, but keeping the modal
        // visible + redirect-on-submit works better with the existing
        // marketing-site CTAs that link to it.)
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          submitBtn.classList.remove("submit-loading");
          submitBtn.disabled = false;
          if (submitText) submitText.textContent = "Roast it.";
          router.push("/auth/login?next=" + encodeURIComponent("/"));
          return;
        }

        const sessionId = await getSessionId();

        // 1. Quota check — limit depends on tier.
        // We call getTier() here (rather than reading closed-over state)
        // so the latest plan flip is always respected, even if the user
        // upgraded in another tab in this session.
        const currentTier = getTier();
        const limit = getDailyLimit(currentTier);
        if (Number.isFinite(limit)) {
          const since = new Date(Date.now() - ONE_DAY_MS).toISOString();
          const { count, error: countErr } = await supabase
            .from("roasts")
            .select("*", { count: "exact", head: true })
            .gte("created_at", since)
            .eq("status", "completed");

          if (countErr) throw new Error(`Quota check failed: ${countErr.message}`);
          if ((count ?? 0) >= limit) {
            const tierName = currentTier === "free" ? "free" : "Plus";
            const upgradeHint = currentTier === "free"
              ? "Come back tomorrow or upgrade to Plus / Premium."
              : "Come back tomorrow or upgrade to Premium for unlimited roasts.";
            throw new Error(`You've used your ${limit} ${tierName}-tier roast${limit === 1 ? "" : "s"} for today. ${upgradeHint}`);
          }
        }

        // 2. Upload
        if (submitText) submitText.textContent = "Uploading…";
        const safeName = file.name.replace(/[^\w.\-]/g, "_");
        const filePath = `${sessionId}/${Date.now()}-${safeName}`;
        const { error: uploadErr } = await supabase.storage
          .from("resumes")
          .upload(filePath, file, { contentType: file.type, upsert: false });
        if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

        // 3. Insert row
        if (submitText) submitText.textContent = "Queueing…";
        // Tier is read fresh via getTier() — same pattern as the quota check above,
        // so a tier change in another tab is always respected.
        const submitTier = getTier();
        // Spec: Free plan ignores the company field entirely. We zero it
        // server-side too via the prompt, but trim it here so the DB row
        // accurately reflects what the AI will use.
        const targetCompany = submitTier === "free" ? null : (company.trim() || null);
        const { data: row, error: insertErr } = await supabase
          .from("roasts")
          .insert({
            session_id: sessionId,
            file_path: filePath,
            file_name: file.name,
            file_type: file.type,
            target_company: targetCompany,
            tier: submitTier,
            status: "pending",
          })
          .select("id")
          .single();
        if (insertErr || !row) throw new Error(`Could not create roast: ${insertErr?.message ?? "unknown"}`);

        // 4. Kick off API
        if (submitText) submitText.textContent = "Starting roast…";
        const res = await fetch("/api/roast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roast_id: row.id }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to start roast.");
        }

        // 5. Navigate to loading page
        if (submitText) submitText.textContent = "✓ Off we go!";
        submitBtn.style.background = "var(--accent)";
        setTimeout(() => router.push(`/loading/${row.id}`), 600);

      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong.";
        setSubmitError(msg);
        submitBtn.classList.remove("submit-loading");
        if (submitText) submitText.textContent = "Roast my resume";
        submitBtn.style.background = "";
        submitBtn.disabled = false;
      }
    };

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [router]);

  return (
    <>
      {/* ── Profile Settings Modal (glass floating window) ── */}
      {profileOpen && user && (
        <ProfileModal
          userEmail={user.email ?? ""}
          userId={user.id}
          currentAvatarUrl={avatarUrl}
          onClose={() => setProfileOpen(false)}
          onAvatarChange={(url) => setAvatarUrl(url)}
        />
      )}

      {/* ── Fonts + theme detection ── */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500;1,9..144,600&display=swap" rel="stylesheet" />

      {/* All styles from the original HTML — verbatim */}
      <style>{STYLES}</style>

      {/* ── NAV ── */}
      <nav id="nav">
        <div className="logo">
          <span className="logo-dot" />
          Resume Roaster
        </div>
        <div className="nav-actions">
          <button className="theme-toggle" id="themeToggle" aria-label="Toggle dark mode" type="button">
            <svg className="icon-sun" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
            </svg>
            <svg className="icon-moon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>
          <button className="nav-cta" data-open-modal="pricingModal">See Pricing</button>

          {/* Accounts button — glass UI, dropdown when not logged in */}
          <div className="accounts-wrap" ref={accountsRef}>
            <button
              className="accounts-btn"
              type="button"
              onClick={() => setAccountsOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={accountsOpen}
            >
              <span className="accounts-avatar" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarUrl} alt="" />
              </span>
              {tier === "plus"    && <span className="accounts-tier-pill pill-plus" aria-label="Plus plan active">Plus+</span>}
              {tier === "premium" && <span className="accounts-tier-pill pill-premium" aria-label="Premium plan active">Premium</span>}
              {/* Label + chevron only shown on Free — paid tiers show avatar + pill only */}
              {tier === "free" && <span className="accounts-label">Accounts</span>}
              {tier === "free" && (
                <svg className={`accounts-chevron ${accountsOpen ? "open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              )}
            </button>

            {accountsOpen && !isLoggedIn && (
              <div className="accounts-menu" role="menu">
                <button
                  className="accounts-menu-item primary"
                  role="menuitem"
                  onClick={() => { setAccountsOpen(false); router.push("/auth/signup"); }}
                >
                  Create Account
                </button>
                <button
                  className="accounts-menu-item"
                  role="menuitem"
                  onClick={() => { setAccountsOpen(false); router.push("/auth/login"); }}
                >
                  Log in
                </button>
              </div>
            )}

            {accountsOpen && isLoggedIn && (
              <div className="accounts-menu" role="menu">
                <div className="accounts-menu-email" title={user?.email ?? ""}>
                  {user?.email}
                </div>
                <button
                  className="accounts-menu-item"
                  role="menuitem"
                  onClick={() => { setAccountsOpen(false); setProfileOpen(true); }}
                >
                  Profile Settings
                </button>
                <button
                  className="accounts-menu-item"
                  role="menuitem"
                  onClick={async () => {
                    setAccountsOpen(false);
                    await authSignOut();
                    router.refresh();
                  }}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header className="hero">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="hero-tag">
          <span className="dot" />
          <span>Powered by GPT-OSS · v1.2.1</span>
        </div>
        <h1>
          Get your resume<br />
          <span className="serif">roasted.</span>
        </h1>
        <p className="hero-sub">
          Brutally honest, AI-powered feedback for IT freshers targeting top tech companies. No fluff. No "good job." Just what you actually need to fix.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" data-open-modal="uploadModal">
            Roast my resume <span className="arrow">→</span>
          </button>
          <button
            className="btn btn-how"
            type="button"
            onClick={() => router.push("/how-it-works")}
          >
            See how it works
          </button>
        </div>
        <div className="hero-meta">
          <span><span className="check">✓</span> No sign-up</span>
          <span><span className="check">✓</span> No data stored</span>
          <span><span className="check">✓</span> ~10 seconds</span>
        </div>
      </header>

      {/* ── PROCESS ── */}
      <section id="process">
        <div className="section-head reveal">
          <div className="label">01 — How it works</div>
          <h2 className="section-title">Three steps.<br /><span className="serif">No mercy.</span></h2>
        </div>
        <div className="process reveal-stagger">
          <div className="step">
            <div className="step-num">i.</div>
            <div>
              <h3 className="step-title">Drop your resume</h3>
              <p className="step-desc">PDF or PNG. Drag it in or click to browse. Parsed in memory, never stored.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-num">ii.</div>
            <div>
              <h3 className="step-title">Pick a target</h3>
              <p className="step-desc">Google, Microsoft, Amazon — or any company you're aiming at. The roast adjusts to their bar.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-num">iii.</div>
            <div>
              <h3 className="step-title">Get the feedback</h3>
              <p className="step-desc">Section-by-section roast: per-section ATS scores, what's good, what's costing you the job.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SAMPLE ── */}
      <section id="sample" className="sample-section">
        <div className="inner">
          <div className="reveal">
            <div className="label" style={{ marginBottom: 16 }}>02 — Sample output</div>
            <h2 className="section-title">What you'll<br /><span className="serif">actually</span> get.</h2>
            <p className="section-desc">Specific, structured, and direct. Real critique, the kind your seniors are too polite to give you.</p>
          </div>
          <div className="preview-card reveal">
            <div className="card-tag"><span className="dot" />Roast result</div>
            <div className="preview-row">
              <div className="row-label">Verdict</div>
              <div className="row-content">"Reads like a checklist of things you were told to put on a resume. Google sees three million of these a year."</div>
            </div>
            <div className="preview-row">
              <div className="row-label">ATS Score</div>
              <div className="ats-display">
                <div className="ats-num">38<span className="of"> / 100</span></div>
                <div className="ats-bar"><div className="ats-fill" /></div>
              </div>
            </div>
            <div className="preview-row">
              <div className="row-label">Critical issues</div>
              <ul className="issue-list">
                <li>"Worked on web development" — what stack, what impact, what scale?</li>
                <li>Ten skills listed, zero evidence of any of them in your projects</li>
                <li>Not a single measurable outcome anywhere on this resume</li>
              </ul>
            </div>
            <div className="preview-row">
              <div className="row-label">Final roast</div>
              <div className="final-line">Your resume is a <span className="accent">pre-filled template</span> wearing your name on a sticker.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BUILT FOR ── */}
      <section className="built-for">
        <div className="label reveal">Built for</div>
        <p className="built-for-list reveal">
          <span className="accent">IT freshers</span> who'd rather hear it now than from a recruiter who'll never write back. Calibrated against the actual hiring bar at <span className="accent">Google</span>, <span className="accent">Microsoft</span>, <span className="accent">Amazon</span>, <span className="accent">Meta</span>, <span className="accent">Apple</span> — or any company you type in.
        </p>
      </section>

      {/* ── FINAL CTA ── */}
      <section id="cta" className="final">
        <div className="orb-final" />
        <div className="final-pre serif reveal">So,</div>
        <h2 className="reveal">Ready to get<br /><span className="serif">roasted?</span></h2>
        <button className="btn btn-primary reveal" data-open-modal="uploadModal">
          Roast my resume <span className="arrow">→</span>
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <div className="footer-inner">
          <div>© 2026 Resume Roaster · Built with open AI models</div>
          <div className="links">
            <a href="#">GitHub</a>
            <a href="#">Twitter</a>
            <a href="#">Privacy</a>
          </div>
        </div>
      </footer>

      {/* ══════════════════ UPLOAD MODAL ══════════════════ */}
      <div className="modal-backdrop" id="uploadModal" role="dialog" aria-modal="true" aria-labelledby="uploadTitle">
        <div className="modal modal-upload">
          <button className="modal-close" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
          </button>
          <div className="modal-content">
            <h2 className="modal-title" id="uploadTitle">Drop the<br /><span className="serif">resume.</span></h2>
            <p className="modal-desc">PDF or PNG, max 10MB. Parsed in memory, never stored.</p>
            <form id="roastForm">
              <div className="drop-zone" id="dropZone" tabIndex={0}>
                <div className="drop-icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <div className="drop-text">Drag &amp; drop or <span className="accent">click to browse</span></div>
                <div className="drop-hint">PDF or PNG · Max 10MB</div>
                <input type="file" id="fileInput" accept=".pdf,.png,application/pdf,image/png" style={{ display: "none" }} />
              </div>
              <div className="file-selected" id="fileSelected">
                <div className="file-icon" id="fileIcon">PDF</div>
                <div className="file-info">
                  <div className="file-name" id="fileName">resume.pdf</div>
                  <div className="file-size" id="fileSize">128 KB</div>
                </div>
                <button type="button" className="file-remove" id="fileRemove" aria-label="Remove file">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
                </button>
              </div>
              <div className="form-field">
                {tier === "free" ? (
                  <>
                    <label htmlFor="companyInput" className="company-label-free">
                      Target company
                      <span className="company-locked-pill">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="5" y="11" width="14" height="9" rx="2"/>
                          <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                        </svg>
                        Plus &amp; Premium
                      </span>
                    </label>
                    <input
                      type="text"
                      id="companyInput"
                      className="form-input form-input-locked"
                      placeholder="Upgrade to target a specific company"
                      autoComplete="off"
                      disabled
                      aria-disabled="true"
                    />
                  </>
                ) : (
                  <>
                    <label htmlFor="companyInput">
                      Target company
                      <span className="optional">— optional</span>
                    </label>
                    <input
                      type="text"
                      id="companyInput"
                      className="form-input"
                      placeholder="e.g., Google, Microsoft, Amazon"
                      autoComplete="off"
                    />
                  </>
                )}
              </div>
              {submitError && (
                <div style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 10, fontSize: 13, color: "#DC2626" }}>
                  {submitError}
                </div>
              )}
              <button type="submit" className="btn btn-primary modal-submit" id="roastSubmit" disabled>
                <span className="submit-text">Roast my resume</span>
                <span className="arrow">→</span>
              </button>
              <p className="modal-fineprint">
                <span className="check">✓</span>No sign-up required · <span className="check">✓</span>Free tier: 1 roast / day
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* ══════════════════ PRICING MODAL ══════════════════ */}
      <div className="modal-backdrop" id="pricingModal" role="dialog" aria-modal="true" aria-labelledby="pricingTitle">
        <div className="modal modal-pricing">
          <button className="modal-close" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
          </button>
          <div className="modal-content">
            <div className="pricing-head">
              <h2 className="modal-title" id="pricingTitle">Pick your <span className="serif">poison.</span></h2>
              <p className="modal-desc">Start free. Upgrade when the roast hits a little too close to home.</p>
            </div>
            <div className="pricing-grid">

              {/* === Free === */}
              <div className="plan-card plan-card-free">
                <div className="plan-visual plan-visual-free">
                  <span className="silk silk-1" /><span className="silk silk-2" />
                </div>
                <div className="plan-name">Free</div>
                <p className="plan-desc">A taste of the roast. Just enough honesty to ruin your week.</p>
                <div className="plan-price"><span className="currency">$</span>0<span className="period">/ forever</span></div>

                {tier === "free" ? (
                  <button className="plan-cta plan-cta-current" disabled aria-label="You're currently on the Free plan">
                    ✓ Current plan
                  </button>
                ) : (
                  <button className="plan-cta" onClick={() => setTier("free")} title="Switch back to the Free plan">
                    Switch to Free
                  </button>
                )}

                <div className="plan-section-label">What you get</div>
                <ul className="plan-features">
                  {["1 roast a day", "Overall verdict", "Overall ATS score"].map(f => (
                    <li key={f}>
                      <svg className="icon icon-check" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"><polyline points="4 12 10 18 20 6"/></svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="plan-section-label">What you're missing</div>
                <ul className="plan-features">
                  {["Company-specific verdict", "Actionable tips per section", "ATS score for each section", "Critical rejection points"].map(f => (
                    <li key={f}>
                      <svg className="icon icon-x" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" stroke="currentColor"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* === Plus (orange, "Best Valued") === */}
              <div className="plan-card plan-card-plus">
                <span className="plan-badge">Best valued</span>
                <div className="plan-visual plan-visual-plus">
                  <span className="silk silk-1" /><span className="silk silk-2" />
                </div>
                <div className="plan-name">Plus</div>
                <p className="plan-desc">Where the real critique kicks in. Tailored to where you're applying.</p>
                <div className="plan-price"><span className="currency">$</span>6.99<span className="period">/ month</span></div>

                {tier === "plus" ? (
                  <button className="plan-cta plan-cta-current" disabled aria-label="You're currently on the Plus plan">
                    ✓ You're on Plus
                  </button>
                ) : (
                  <button className="plan-cta" onClick={() => setTier("plus")}>
                    Upgrade to Plus
                  </button>
                )}

                <div className="plan-section-label">What you get</div>
                <ul className="plan-features">
                  {["10 roasts a day", "Company-specific verdict", "Actionable tips per section", "ATS score for each section", "Critical rejection points"].map(f => (
                    <li key={f}>
                      <svg className="icon icon-check" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"><polyline points="4 12 10 18 20 6"/></svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="plan-section-label">What you're missing</div>
                <ul className="plan-features">
                  {["Unlimited roasts", "Hiring intel", "Bypass applicant tracking systems"].map(f => (
                    <li key={f}>
                      <svg className="icon icon-x" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" stroke="currentColor"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* === Premium (gold, top tier) === */}
              <div className="plan-card plan-card-premium">
                <div className="plan-visual plan-visual-premium">
                  <span className="silk silk-1" /><span className="silk silk-2" />
                </div>
                <div className="plan-name">Premium</div>
                <p className="plan-desc">For aggressive job seekers, career coaches, and placement officers.</p>
                <div className="plan-price"><span className="currency">$</span>15.99<span className="period">/ month</span></div>

                {tier === "premium" ? (
                  <button className="plan-cta plan-cta-current" disabled aria-label="You're currently on the Premium plan">
                    ✓ You're on Premium
                  </button>
                ) : (
                  <button className="plan-cta" onClick={() => setTier("premium")}>
                    Upgrade to Premium
                  </button>
                )}

                <div className="plan-section-label">What you get</div>
                <ul className="plan-features">
                  {["Unlimited roasts", "Hiring intel", "Enhanced tips on bypassing ATS"].map(f => (
                    <li key={f}>
                      <svg className="icon icon-check" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"><polyline points="4 12 10 18 20 6"/></svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   All CSS from the original HTML file — verbatim.
   Kept as a template literal to avoid Tailwind conflicts.
   ============================================================ */
const STYLES = `
  :root {
    --bg: #FAF8F4; --bg-alt: #F2EFE8;
    --bg-trans-70: rgba(250,248,244,0.7); --bg-trans-60: rgba(250,248,244,0.6);
    --ink: #0A0A0A; --ink-60: #0A0A0A99; --ink-40: #0A0A0A66;
    --ink-15: #0A0A0A26; --ink-08: #0A0A0A14; --line: #0A0A0A12;
    --accent: #FF4500; --accent-rgb: 255,69,0;
    --card-pro: #0A0A0A; --card-pro-text: #FAF8F4;
    --visual-pro-1: #050505; --visual-pro-2: #1C1C1C;
    --visual-free-1: #EDE7D8; --visual-free-2: #D4CFC3;
    --silk-secondary: rgba(0,0,0,0.16);
    --card-elevation: 0 1px 0 rgba(255,255,255,0.5) inset, 0 24px 48px -16px rgba(0,0,0,0.08);
  }
  :root[data-theme="dark"] {
    --bg: #1A1E24; --bg-alt: #232830;
    --bg-trans-70: rgba(26,30,36,0.75); --bg-trans-60: rgba(26,30,36,0.6);
    --ink: #F0F1F3; --ink-60: #F0F1F399; --ink-40: #F0F1F366;
    --ink-15: #F0F1F326; --ink-08: #F0F1F314; --line: #F0F1F312;
    --accent: #7C5CFF; --accent-rgb: 124,92,255;
    --card-pro: #0E1117; --card-pro-text: #F0F1F3;
    --visual-pro-1: #0E1117; --visual-pro-2: #1A1F26;
    --visual-free-1: #2A303A; --visual-free-2: #232830;
    --silk-secondary: rgba(255,255,255,0.10);
    --card-elevation: 0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -16px rgba(0,0,0,0.5);
  }
  .theme-transitioning,.theme-transitioning *,.theme-transitioning *::before,.theme-transitioning *::after {
    transition: background-color 0.45s ease, background 0.45s ease, color 0.45s ease,
                border-color 0.45s ease, box-shadow 0.45s ease, fill 0.45s ease, stroke 0.45s ease !important;
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
  body{background:var(--bg);color:var(--ink);font-family:'DM Sans',sans-serif;font-size:16px;line-height:1.5;letter-spacing:-0.005em;overflow-x:hidden;}
  body.modal-open{overflow:hidden;}
  ::selection{background:var(--accent);color:var(--bg);}
  a{color:inherit;text-decoration:none;} button{font-family:inherit;}
  body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;background-image:radial-gradient(var(--ink-08) 1px,transparent 1px);background-size:32px 32px;mask-image:linear-gradient(to bottom,black 0%,transparent 80%);-webkit-mask-image:linear-gradient(to bottom,black 0%,transparent 80%);opacity:0.5;}
  .serif{font-family:'Fraunces',serif;font-style:italic;font-weight:400;letter-spacing:-0.02em;}
  .label{font-size:11px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:var(--ink-60);}
  nav{position:fixed;top:0;left:0;right:0;z-index:50;padding:22px 32px;display:flex;justify-content:space-between;align-items:center;background:var(--bg-trans-70);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);transition:border-color 0.3s;}
  nav.scrolled{border-bottom:1px solid var(--line);}
  .logo{display:flex;align-items:center;gap:10px;font-weight:600;font-size:15px;letter-spacing:-0.01em;}
  .logo-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);animation:pulse 2.4s ease-in-out infinite;}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.5;transform:scale(0.7);}}
  .nav-cta{font-size:14px;font-weight:500;padding:10px 18px;background:var(--ink);color:var(--bg);border-radius:100px;border:none;cursor:pointer;transition:transform 0.25s ease,background 0.25s ease;}
  .nav-cta:hover{background:var(--accent);transform:translateY(-1px);}
  @media(max-width:600px){nav{padding:16px 20px;}}
  .hero{position:relative;min-height:100vh;padding:140px 32px 80px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;overflow:hidden;}
  .orb{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none;z-index:0;will-change:transform;}
  .orb-1{width:640px;height:640px;background:radial-gradient(circle,rgba(var(--accent-rgb),0.55) 0%,rgba(var(--accent-rgb),0) 70%);top:-180px;right:-160px;animation:drift-1 38s ease-in-out infinite;}
  .orb-2{width:480px;height:480px;background:radial-gradient(circle,rgba(var(--accent-rgb),0.35) 0%,rgba(var(--accent-rgb),0) 70%);bottom:-120px;left:-120px;animation:drift-2 45s ease-in-out infinite;}
  .orb-3{width:360px;height:360px;background:radial-gradient(circle,rgba(var(--accent-rgb),0.25) 0%,rgba(var(--accent-rgb),0) 70%);top:40%;left:50%;transform:translateX(-50%);animation:drift-3 32s ease-in-out infinite;}
  @keyframes drift-1{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(-40px,20px) scale(1.04);}66%{transform:translate(20px,40px) scale(0.98);}}
  @keyframes drift-2{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(40px,-30px) scale(1.06);}}
  @keyframes drift-3{0%,100%{transform:translate(-50%,0) scale(1);opacity:0.75;}50%{transform:translate(-50%,-20px) scale(1.04);opacity:0.95;}}
  .hero>*:not(.orb){position:relative;z-index:1;}
  .hero-tag{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border:1px solid var(--ink-15);border-radius:100px;font-size:12px;font-weight:500;color:var(--ink-60);margin-bottom:32px;background:var(--bg-trans-60);backdrop-filter:blur(8px);animation:fade-up 0.8s ease 0.1s both;}
  .hero-tag .dot{width:6px;height:6px;background:var(--accent);border-radius:50%;animation:pulse 2s ease-in-out infinite;}
  .hero h1{font-size:clamp(56px,10vw,132px);line-height:0.95;letter-spacing:-0.04em;font-weight:500;max-width:1100px;margin-bottom:28px;animation:fade-up 0.9s ease 0.25s both;}
  .hero h1 .serif{font-weight:400;letter-spacing:-0.04em;}
  .hero-sub{font-size:clamp(17px,1.6vw,21px);line-height:1.5;color:var(--ink-60);max-width:540px;margin-bottom:44px;animation:fade-up 0.9s ease 0.4s both;}
  .hero-actions{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;animation:fade-up 0.9s ease 0.55s both;}
  @keyframes fade-up{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
  .btn{display:inline-flex;align-items:center;gap:8px;padding:14px 24px;border-radius:100px;font-family:inherit;font-size:15px;font-weight:500;letter-spacing:-0.01em;cursor:pointer;transition:all 0.25s ease;border:1px solid transparent;}
  .btn-primary{background:var(--ink);color:var(--bg);}
  .btn-primary:hover{background:var(--accent);transform:translateY(-2px);box-shadow:0 12px 32px rgba(var(--accent-rgb),0.3);}
  .btn-primary:disabled{opacity:0.4;cursor:not-allowed;transform:none;box-shadow:none;pointer-events:none;}
  .btn-primary .arrow{transition:transform 0.25s ease;}
  .btn-primary:hover .arrow{transform:translateX(3px);}
  /* Secondary "See how it works" button — ghost treatment, never competes with primary */
  .btn-how{
    background:transparent;
    color:var(--ink);
    border-color:var(--ink-15);
    border:1px solid var(--ink-15);
  }
  .btn-how:hover{
    border-color:var(--ink);
    background:var(--ink-08);
  }
  .hero-meta{margin-top:48px;display:flex;gap:24px;font-size:13px;color:var(--ink-40);flex-wrap:wrap;justify-content:center;animation:fade-up 0.9s ease 0.7s both;}
  .hero-meta span{display:flex;align-items:center;gap:6px;}
  .hero-meta .check{color:var(--accent);}
  section{position:relative;padding:120px 32px;max-width:1200px;margin:0 auto;}
  .section-head{margin-bottom:80px;max-width:720px;}
  .section-head .label{margin-bottom:16px;display:inline-flex;align-items:center;gap:10px;}
  .section-head .label::before{content:"";width:24px;height:1px;background:var(--accent);}
  .section-title{font-size:clamp(36px,5.5vw,64px);line-height:1;letter-spacing:-0.03em;font-weight:500;}
  .section-desc{margin-top:20px;font-size:18px;line-height:1.55;color:var(--ink-60);max-width:520px;}
  .process{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:16px;overflow:hidden;}
  .step{background:var(--bg);padding:40px 36px;min-height:280px;display:flex;flex-direction:column;justify-content:space-between;transition:background 0.3s ease;}
  .step:hover{background:var(--bg-alt);}
  .step-num{font-family:'Fraunces',serif;font-style:italic;font-weight:400;font-size:14px;color:var(--accent);letter-spacing:0.05em;}
  .step-title{font-size:24px;font-weight:500;letter-spacing:-0.02em;margin:80px 0 12px;}
  .step-desc{font-size:15px;color:var(--ink-60);line-height:1.5;}
  @media(max-width:800px){.process{grid-template-columns:1fr;}.step-title{margin-top:48px;}}
  .sample-section{max-width:none;background:var(--bg-alt);padding:120px 32px;}
  .sample-section .inner{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1.3fr;gap:80px;align-items:center;}
  @media(max-width:900px){.sample-section .inner{grid-template-columns:1fr;gap:48px;}}
  .preview-card{background:var(--bg);border:1px solid var(--line);border-radius:16px;padding:32px;box-shadow:var(--card-elevation);position:relative;}
  .preview-card .card-tag{position:absolute;top:16px;right:16px;font-size:11px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent);display:flex;align-items:center;gap:6px;}
  .preview-card .card-tag .dot{width:6px;height:6px;background:var(--accent);border-radius:50%;animation:pulse 2s ease-in-out infinite;}
  .preview-row{padding:16px 0;border-bottom:1px solid var(--line);}
  .preview-row:last-of-type{border-bottom:none;}
  .preview-row .row-label{font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-40);margin-bottom:8px;}
  .preview-row .row-content{font-family:'Fraunces',serif;font-style:italic;font-weight:400;font-size:18px;line-height:1.4;color:var(--ink);}
  .ats-display{display:flex;align-items:center;gap:16px;}
  .ats-num{font-family:'Fraunces',serif;font-weight:500;font-size:40px;letter-spacing:-0.02em;line-height:1;}
  .ats-num .of{color:var(--ink-40);font-size:18px;}
  .ats-bar{flex:1;height:4px;background:var(--ink-08);border-radius:100px;overflow:hidden;}
  .ats-fill{height:100%;width:38%;background:var(--accent);border-radius:100px;animation:fill 1.4s cubic-bezier(0.4,0,0.2,1) 0.4s both;}
  @keyframes fill{from{width:0;}to{width:38%;}}
  .issue-list{list-style:none;font-size:14px;line-height:1.5;}
  .issue-list li{padding:6px 0 6px 18px;position:relative;color:var(--ink-60);}
  .issue-list li::before{content:"—";position:absolute;left:0;color:var(--accent);font-weight:600;}
  .final-line{margin-top:8px;padding:16px 18px;background:var(--ink);color:var(--bg);border-radius:10px;font-family:'Fraunces',serif;font-style:italic;font-weight:500;font-size:17px;line-height:1.35;}
  .final-line .accent{color:var(--accent);}
  .built-for{text-align:center;padding:100px 32px;}
  .built-for .label{margin-bottom:24px;}
  .built-for-list{font-size:clamp(18px,2vw,22px);color:var(--ink-60);letter-spacing:-0.01em;line-height:1.5;max-width:700px;margin:0 auto;}
  .built-for-list .accent{color:var(--ink);font-weight:500;}
  .final{position:relative;text-align:center;padding:160px 32px;overflow:hidden;max-width:none;}
  .orb-final{position:absolute;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(var(--accent-rgb),0.4) 0%,rgba(var(--accent-rgb),0) 70%);filter:blur(100px);top:50%;left:50%;transform:translate(-50%,-50%);animation:drift-3 40s ease-in-out infinite;pointer-events:none;}
  .final-pre{font-family:'Fraunces',serif;font-style:italic;font-size:20px;color:var(--ink-60);margin-bottom:16px;position:relative;}
  .final h2{font-size:clamp(56px,9vw,112px);line-height:1;letter-spacing:-0.04em;font-weight:500;margin-bottom:40px;position:relative;}
  .final h2 .serif{font-weight:400;}
  footer{border-top:1px solid var(--line);padding:32px;}
  .footer-inner{max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap;font-size:13px;color:var(--ink-40);}
  .footer-inner .links{display:flex;gap:24px;}
  .footer-inner a{transition:color 0.2s;}
  .footer-inner a:hover{color:var(--accent);}
  .reveal{opacity:0;transform:translateY(24px);transition:opacity 0.9s cubic-bezier(0.16,1,0.3,1),transform 0.9s cubic-bezier(0.16,1,0.3,1);}
  .reveal.in{opacity:1;transform:translateY(0);}
  .reveal-stagger>*{opacity:0;transform:translateY(20px);transition:opacity 0.8s cubic-bezier(0.16,1,0.3,1),transform 0.8s cubic-bezier(0.16,1,0.3,1);}
  .reveal-stagger.in>*:nth-child(1){transition-delay:0s;}
  .reveal-stagger.in>*:nth-child(2){transition-delay:0.12s;}
  .reveal-stagger.in>*:nth-child(3){transition-delay:0.24s;}
  .reveal-stagger.in>*{opacity:1;transform:translateY(0);}
  .nav-actions{display:flex;align-items:center;gap:10px;}
  .theme-toggle{position:relative;width:38px;height:38px;border-radius:50%;border:1px solid var(--ink-15);background:transparent;color:var(--ink);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;transition:border-color 0.25s ease,background 0.25s ease,transform 0.25s ease;}
  .theme-toggle:hover{border-color:var(--ink);background:var(--ink-08);transform:translateY(-1px);}
  .theme-toggle:active{transform:scale(0.94);}
  .theme-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
  .theme-toggle svg{position:absolute;width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transition:transform 0.55s cubic-bezier(0.16,1,0.3,1),opacity 0.3s ease;}
  .theme-toggle .icon-sun{opacity:1;transform:rotate(0deg) scale(1);}
  .theme-toggle .icon-moon{opacity:0;transform:rotate(-90deg) scale(0.5);}
  [data-theme="dark"] .theme-toggle .icon-sun{opacity:0;transform:rotate(90deg) scale(0.5);}
  [data-theme="dark"] .theme-toggle .icon-moon{opacity:1;transform:rotate(0deg) scale(1);}
  .theme-toggle.flash::before{content:"";position:absolute;inset:-2px;border-radius:50%;background:radial-gradient(circle,rgba(var(--accent-rgb),0.6) 0%,rgba(var(--accent-rgb),0) 70%);animation:toggle-flash 0.6s ease-out forwards;pointer-events:none;}
  @keyframes toggle-flash{0%{opacity:0;transform:scale(0.6);}40%{opacity:1;}100%{opacity:0;transform:scale(1.6);}}

  /* === Accounts button (glass UI) + dropdown === */
  .accounts-wrap{position:relative;display:inline-block;}
  .accounts-btn{
    display:inline-flex;align-items:center;gap:8px;
    padding:6px 12px 6px 6px;
    background:rgba(var(--accent-rgb),0.06);
    backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
    border:1px solid var(--ink-15);
    border-radius:100px;
    cursor:pointer;
    color:var(--ink);
    font-size:14px;font-weight:500;font-family:inherit;letter-spacing:-0.01em;
    transition:background 0.25s ease,border-color 0.25s ease,transform 0.25s ease,box-shadow 0.25s ease;
    box-shadow:0 1px 0 rgba(255,255,255,0.4) inset, 0 4px 12px -4px rgba(0,0,0,0.06);
  }
  .accounts-btn:hover{
    background:rgba(var(--accent-rgb),0.12);
    border-color:var(--ink);
    transform:translateY(-1px);
  }
  .accounts-btn:active{transform:scale(0.98);}
  [data-theme="dark"] .accounts-btn{
    background:rgba(255,255,255,0.06);
    box-shadow:0 1px 0 rgba(255,255,255,0.05) inset, 0 4px 12px -4px rgba(0,0,0,0.4);
  }
  [data-theme="dark"] .accounts-btn:hover{background:rgba(var(--accent-rgb),0.18);}
  .accounts-avatar{
    width:26px;height:26px;border-radius:50%;
    overflow:hidden;flex-shrink:0;
    background:var(--ink-08);
    display:inline-flex;align-items:center;justify-content:center;
  }
  .accounts-avatar img{width:100%;height:100%;object-fit:cover;display:block;}

  /* Tier indicator pills — appear in nav next to the avatar when the
     user is on a paid plan. Plus = accent-orange, Premium = gold. */
  .accounts-tier-pill{
    display:inline-block;
    padding:2px 7px;
    font-size:9px;font-weight:700;letter-spacing:0.06em;
    border-radius:4px;
    line-height:1.25;
    flex-shrink:0;
    text-transform:none;
  }
  .pill-plus{
    background:var(--accent);
    color:#fff;
    box-shadow:0 1px 2px rgba(var(--accent-rgb),0.3);
  }
  /* Premium = real warm gold, intentionally NOT theme-flipped.
     #D4AF37 reads as metallic gold against both cream and dark-navy.
     Subtle inner-light gradient + warm glow sells the metallic feel. */
  .pill-premium{
    background:linear-gradient(135deg, #F4D87A 0%, #D4AF37 50%, #B8860B 100%);
    color:#3D2E0A;
    text-shadow:0 1px 0 rgba(255,255,255,0.25);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.4) inset,
      0 -1px 0 rgba(120,80,0,0.2) inset,
      0 1px 3px rgba(184,134,11,0.4);
  }
  [data-theme="dark"] .pill-premium{
    /* Slightly brighter on dark bg so it pops without losing warmth */
    background:linear-gradient(135deg, #F7E08A 0%, #DEB948 50%, #C29216 100%);
    color:#2D2105;
    box-shadow:
      0 1px 0 rgba(255,255,255,0.5) inset,
      0 -1px 0 rgba(120,80,0,0.3) inset,
      0 1px 4px rgba(212,175,55,0.5);
  }
  .accounts-label{display:inline-block;}
  .accounts-chevron{width:14px;height:14px;opacity:0.6;transition:transform 0.25s ease;}
  .accounts-chevron.open{transform:rotate(180deg);}
  /* Paid tiers: no label/chevron, so shrink the padding to fit just avatar + pill */
  .accounts-btn:has(.accounts-tier-pill){padding:5px 8px 5px 5px;}
  .accounts-menu{
    position:absolute;top:calc(100% + 8px);right:0;
    min-width:200px;
    background:var(--bg);
    border:1px solid var(--line);
    border-radius:14px;
    box-shadow:0 24px 48px -16px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.4) inset;
    padding:6px;
    z-index:60;
    animation:accounts-menu-in 0.2s cubic-bezier(0.16,1,0.3,1);
    overflow:hidden;
  }
  @keyframes accounts-menu-in{
    from{opacity:0;transform:translateY(-6px) scale(0.98);}
    to{opacity:1;transform:translateY(0) scale(1);}
  }
  .accounts-menu-item{
    display:block;width:100%;text-align:left;
    padding:10px 14px;
    background:transparent;border:none;
    font-family:inherit;font-size:14px;font-weight:500;
    color:var(--ink);cursor:pointer;
    border-radius:8px;
    transition:background 0.15s ease;
  }
  .accounts-menu-item:hover{background:var(--ink-08);}
  .accounts-menu-item.primary{
    color:var(--accent);
  }
  .accounts-menu-item.primary:hover{background:rgba(var(--accent-rgb),0.08);}
  .accounts-menu-email{
    padding:10px 14px 8px;
    font-size:12px;
    color:var(--ink-60, rgba(0,0,0,0.6));
    border-bottom:1px solid var(--line, rgba(0,0,0,0.07));
    margin-bottom:4px;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  }
  @media(max-width:600px){
    .accounts-label{display:none;}
    .accounts-btn{padding:5px;}
    .accounts-chevron{display:none;}
  }
  .modal-backdrop{position:fixed;inset:0;z-index:200;background:rgba(10,10,10,0.4);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;visibility:hidden;transition:opacity 0.3s ease,visibility 0s linear 0.3s;}
  .modal-backdrop.open{opacity:1;visibility:visible;transition:opacity 0.3s ease,visibility 0s linear 0s;}
  .modal{background:var(--bg);border-radius:24px;width:100%;max-height:92vh;overflow-y:auto;position:relative;transform:scale(0.96) translateY(8px);opacity:0;transition:transform 0.4s cubic-bezier(0.16,1,0.3,1),opacity 0.3s ease;box-shadow:0 32px 64px -16px rgba(0,0,0,0.18),0 1px 0 rgba(255,255,255,0.5) inset;}
  .modal-upload{max-width:480px;}.modal-pricing{max-width:1080px;}
  .modal-backdrop.open .modal{transform:scale(1) translateY(0);opacity:1;}
  .modal::-webkit-scrollbar{width:6px;}.modal::-webkit-scrollbar-track{background:transparent;}.modal::-webkit-scrollbar-thumb{background:var(--ink-15);border-radius:100px;}
  .modal-close{position:absolute;top:16px;right:16px;width:34px;height:34px;border-radius:50%;background:var(--ink-08);border:none;cursor:pointer;color:var(--ink);font-size:14px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;z-index:2;}
  .modal-close:hover{background:var(--ink);color:var(--bg);transform:rotate(90deg);}
  .modal-close svg{width:14px;height:14px;}
  .modal-content{padding:48px 40px 40px;}
  .modal-title{font-size:30px;font-weight:500;letter-spacing:-0.03em;line-height:1.05;margin-bottom:8px;}
  .modal-title .serif{font-weight:400;}
  .modal-desc{color:var(--ink-60);margin-bottom:32px;font-size:15px;line-height:1.5;}
  .drop-zone{border:1.5px dashed var(--ink-15);border-radius:14px;padding:36px 24px;text-align:center;cursor:pointer;transition:all 0.25s ease;margin-bottom:20px;background:var(--bg-alt);}
  .drop-zone:hover{border-color:var(--accent);background:rgba(var(--accent-rgb),0.05);}
  .drop-zone.dragging{border-color:var(--accent);background:rgba(var(--accent-rgb),0.10);transform:scale(1.01);}
  .drop-icon{width:44px;height:44px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:var(--bg);border:1px solid var(--line);transition:all 0.2s;}
  .drop-zone.dragging .drop-icon{background:var(--accent);border-color:var(--accent);animation:bob 0.6s ease-in-out infinite;}
  .drop-zone.dragging .drop-icon svg{stroke:white;}
  @keyframes bob{0%,100%{transform:translateY(0);}50%{transform:translateY(-4px);}}
  .drop-icon svg{width:20px;height:20px;stroke:var(--ink-60);transition:stroke 0.2s;}
  .drop-text{font-weight:500;font-size:15px;margin-bottom:4px;}
  .drop-text .accent{color:var(--accent);}
  .drop-hint{font-size:12px;color:var(--ink-40);}
  .file-selected{display:none;align-items:center;gap:12px;padding:14px;background:var(--bg-alt);border-radius:12px;margin-bottom:20px;animation:fade-up 0.3s ease;}
  .file-selected.shown{display:flex;}
  .file-icon{width:38px;height:38px;background:var(--accent);color:white;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:10px;letter-spacing:0.05em;flex-shrink:0;}
  .file-info{flex:1;min-width:0;}
  .file-name{font-weight:500;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .file-size{font-size:12px;color:var(--ink-40);margin-top:2px;}
  .file-remove{width:28px;height:28px;border-radius:50%;background:var(--ink-08);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;}
  .file-remove:hover{background:var(--ink);color:var(--bg);}
  .file-remove svg{width:12px;height:12px;}
  .form-field{margin-bottom:20px;}
  .form-field label{display:block;font-size:13px;font-weight:500;margin-bottom:8px;color:var(--ink);}
  .form-field label .optional{color:var(--ink-40);font-weight:400;margin-left:4px;}
  .form-input{width:100%;padding:12px 16px;border:1px solid var(--ink-15);border-radius:10px;font-family:inherit;font-size:15px;background:var(--bg);color:var(--ink);transition:border-color 0.2s,box-shadow 0.2s;}
  .form-input:focus{outline:none;border-color:var(--ink);box-shadow:0 0 0 4px var(--ink-08);}
  .form-input::placeholder{color:var(--ink-40);}
  /* Free-tier locked company input */
  .company-label-free{display:flex;align-items:center;gap:8px;}
  .company-locked-pill{
    display:inline-flex;align-items:center;gap:5px;
    padding:3px 8px;
    background:rgba(var(--accent-rgb),0.1);
    color:var(--accent);
    font-size:10px;font-weight:600;letter-spacing:0.06em;
    border-radius:100px;
    line-height:1.3;
  }
  .company-locked-pill svg{width:11px;height:11px;}
  .form-input-locked{
    background:var(--ink-08) !important;
    color:var(--ink-40) !important;
    cursor:not-allowed;
    opacity:0.7;
  }
  .modal-submit{width:100%;justify-content:center;margin-top:4px;}
  .submit-loading .arrow{display:none;}
  .modal-fineprint{text-align:center;font-size:12px;color:var(--ink-40);margin-top:16px;}
  .modal-fineprint .check{color:var(--accent);margin-right:4px;}
  .pricing-head{text-align:center;margin-bottom:32px;}
  .pricing-head .modal-title{margin-bottom:12px;}
  .pricing-head .modal-desc{margin-bottom:0;}
  .pricing-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;}
  /* Below 900px the three columns get cramped; collapse straight to single column */
  @media(max-width:900px){.pricing-grid{grid-template-columns:1fr;}}
  .plan-card{border-radius:18px;padding:20px;display:flex;flex-direction:column;position:relative;overflow:hidden;}

  /* === Free === */
  .plan-card-free{background:var(--bg-alt);border:1px solid var(--line);color:var(--ink);}

  /* === Plus (orange-on-dark, "Best Valued") === */
  .plan-card-plus{
    background:var(--card-pro);
    color:var(--card-pro-text);
    box-shadow:0 16px 40px -12px rgba(var(--accent-rgb),0.3);
  }

  /* === Premium (gold-on-dark, top tier) === */
  /* Subtle warm gradient overlay + gold border to sell the metallic feel.
     Stays consistent in both themes — gold should always read as gold. */
  .plan-card-premium{
    background:linear-gradient(160deg, #1a1208 0%, #0E1117 60%, #0E1117 100%);
    color:#F5E8C8;
    border:1px solid rgba(212,175,55,0.35);
    box-shadow:
      0 1px 0 rgba(212,175,55,0.18) inset,
      0 16px 44px -12px rgba(212,175,55,0.28);
  }

  .plan-badge{position:absolute;top:14px;right:14px;background:var(--accent);color:white;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;padding:5px 10px;border-radius:100px;z-index:2;}

  .plan-visual{position:relative;height:180px;margin:-20px -20px 22px -20px;overflow:hidden;}
  .plan-visual-free   {background:linear-gradient(135deg,var(--visual-free-1) 0%,var(--visual-free-2) 100%);}
  .plan-visual-plus   {background:linear-gradient(135deg,var(--visual-pro-1) 0%,var(--visual-pro-2) 100%);}
  /* Premium: dark-warm gradient that grounds the gold accents */
  .plan-visual-premium{background:linear-gradient(135deg,#1F1A0F 0%,#100C06 100%);}

  .silk{position:absolute;border-radius:50%;filter:blur(55px);pointer-events:none;will-change:transform;}
  /* Free silks — soft accent-orange against cream */
  .plan-visual-free .silk-1{width:340px;height:340px;background:rgba(var(--accent-rgb),0.42);top:-110px;left:-70px;animation:card-orb-1 22s ease-in-out infinite;}
  .plan-visual-free .silk-2{width:240px;height:240px;background:var(--silk-secondary);bottom:-90px;right:-60px;animation:card-orb-2 28s ease-in-out infinite;}
  /* Plus silks — saturated orange against near-black */
  .plan-visual-plus .silk-1{width:360px;height:360px;background:rgba(var(--accent-rgb),0.78);top:-120px;left:-80px;animation:card-orb-1 25s ease-in-out infinite;}
  .plan-visual-plus .silk-2{width:260px;height:260px;background:rgba(var(--accent-rgb),0.48);bottom:-100px;right:-70px;animation:card-orb-2 30s ease-in-out infinite;}
  /* Premium silks — warm gold against deep black */
  .plan-visual-premium .silk-1{width:380px;height:380px;background:rgba(212,175,55,0.55);top:-130px;left:-90px;animation:card-orb-1 26s ease-in-out infinite;}
  .plan-visual-premium .silk-2{width:280px;height:280px;background:rgba(244,216,122,0.32);bottom:-110px;right:-80px;animation:card-orb-2 32s ease-in-out infinite;}

  .plan-visual::after{content:"";position:absolute;inset:0;pointer-events:none;}
  .plan-card-free    .plan-visual::after{background:linear-gradient(to bottom,transparent 0%,transparent 40%,var(--bg-alt) 100%);}
  .plan-card-plus    .plan-visual::after{background:linear-gradient(to bottom,transparent 0%,transparent 40%,var(--card-pro) 100%);}
  .plan-card-premium .plan-visual::after{background:linear-gradient(to bottom,transparent 0%,transparent 40%,#0E1117 100%);}

  @keyframes card-orb-1{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(20px,12px) scale(1.06);}}
  @keyframes card-orb-2{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(-15px,-10px) scale(1.04);}}

  .plan-name{font-size:20px;font-weight:500;letter-spacing:-0.02em;}
  /* Premium gets a gold-tinted name to anchor the metallic theme */
  .plan-card-premium .plan-name{color:#F4D87A;}

  .plan-desc{font-size:13px;margin-top:6px;margin-bottom:18px;opacity:0.65;line-height:1.45;}
  .plan-price{font-family:'Fraunces',serif;font-size:36px;font-weight:500;letter-spacing:-0.03em;line-height:1;}
  .plan-price .currency{font-size:0.6em;vertical-align:top;margin-right:2px;opacity:0.6;}
  .plan-price .period{font-family:'DM Sans',sans-serif;font-size:13px;opacity:0.5;font-weight:400;margin-left:6px;}

  .plan-cta{margin-top:16px;margin-bottom:22px;padding:12px;border-radius:10px;text-align:center;font-weight:500;font-size:14px;cursor:pointer;transition:all 0.2s;border:1px solid;font-family:inherit;width:100%;}
  .plan-card-free    .plan-cta{background:transparent;color:var(--ink);border-color:var(--ink-15);}
  .plan-card-free    .plan-cta:hover{background:var(--ink);color:var(--bg);border-color:var(--ink);}
  .plan-card-plus    .plan-cta{background:var(--accent);color:white;border-color:var(--accent);}
  .plan-card-plus    .plan-cta:hover{background:var(--card-pro-text);color:var(--card-pro);border-color:var(--card-pro-text);}
  /* Premium CTA: gold gradient button — feels expensive */
  .plan-card-premium .plan-cta{
    background:linear-gradient(135deg, #F4D87A 0%, #D4AF37 100%);
    color:#3D2E0A;
    border-color:#D4AF37;
    font-weight:600;
    box-shadow:0 1px 0 rgba(255,255,255,0.3) inset;
  }
  .plan-card-premium .plan-cta:hover{
    background:linear-gradient(135deg, #FFE89A 0%, #E8C347 100%);
    border-color:#E8C347;
    transform:translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.4) inset,
      0 8px 20px -4px rgba(212,175,55,0.45);
  }

  /* "Current plan" state — green confirmation across all three cards */
  .plan-cta-current{cursor:default;opacity:0.85;}
  .plan-cta-current:hover{transform:none !important;}
  .plan-card-free    .plan-cta-current,
  .plan-card-free    .plan-cta-current:hover{background:rgba(22,163,74,0.08);border-color:rgba(22,163,74,0.35);color:#16A34A;}
  .plan-card-plus    .plan-cta-current,
  .plan-card-plus    .plan-cta-current:hover{background:rgba(34,197,94,0.18);border-color:rgba(74,222,128,0.45);color:#86EFAC;box-shadow:none;}
  .plan-card-premium .plan-cta-current,
  .plan-card-premium .plan-cta-current:hover{background:rgba(34,197,94,0.18);border-color:rgba(74,222,128,0.45);color:#86EFAC;box-shadow:none;}

  .plan-section-label{font-size:10px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;opacity:0.5;margin-bottom:10px;margin-top:8px;}
  .plan-section-label:not(:first-of-type){margin-top:18px;}
  .plan-features{list-style:none;font-size:13px;line-height:1.4;}
  .plan-features li{padding:5px 0;display:flex;align-items:flex-start;gap:10px;}
  .plan-features li .icon{flex-shrink:0;margin-top:1px;width:14px;height:14px;}
  .plan-features li .icon-check{stroke:var(--accent);}
  /* Premium check icons in gold instead of accent-orange */
  .plan-card-premium .plan-features li .icon-check{stroke:#D4AF37;}
  .plan-card-free    .plan-features li .icon-x{stroke:rgba(0,0,0,0.3);}
  .plan-card-plus    .plan-features li .icon-x{stroke:rgba(255,255,255,0.3);}
  .plan-card-premium .plan-features li .icon-x{stroke:rgba(212,175,55,0.4);}

  @media(max-width:600px){.modal-content{padding:40px 24px 28px;}.modal-title{font-size:26px;}}
`;
