"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-browser";
import { useRequireAuth } from "@/lib/auth";
import {
  type RoastResult,
  type ResumeSection,
  type HiringIntelItem,
  type AtsBypassTip,
  getScoreBand,
  SCORE_BAND_META,
} from "@/lib/types";

/* ============================================================
   Results page — /results/[id]
   ------------------------------------------------------------
   Scroll-snap layout: each section is one full screen.
     1. Welcome           "Your results are ready."
     2..N. Section breakdowns (one per screen)
     N+1. Final overall score reveal
     N+2. Final roast + restart
   ============================================================ */

interface PageProps {
  params: { id: string };
}

export default function ResultsPage({ params }: PageProps) {
  const router = useRouter();
  const { loading: authLoading, user } = useRequireAuth();
  const [result, setResult] = useState<RoastResult | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to load. If there's no user, useRequireAuth has
    // already redirected — bail out.
    if (authLoading || !user) return;

    const supabase = getSupabase();

    async function load() {
      const { data, error: err } = await supabase
        .from("roasts")
        .select("status, result, target_company, error_message")
        .eq("id", params.id)
        .single();

      if (err) {
        setError(`Could not load roast: ${err.message}`);
        return;
      }
      if (data.status !== "completed" || !data.result) {
        // Not done yet — bounce back to loading page
        router.replace(`/loading/${params.id}`);
        return;
      }

      setResult(data.result as RoastResult);
      setCompany(data.target_company);
    }

    load();
  }, [params.id, router, authLoading, user]);

  if (error) {
    return (
      <main className="rr-error">
        <h1>Something went wrong.</h1>
        <p>{error}</p>
        <button onClick={() => router.push("/")}>Start over</button>
        <style jsx>{`
          .rr-error {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            padding: 24px;
            font-family: 'DM Sans', 'Inter', system-ui, sans-serif;
            background: var(--bg);
            color: var(--ink);
            text-align: center;
          }
          .rr-error h1 {
            font-size: 48px;
            font-weight: 500;
            letter-spacing: -0.03em;
          }
          .rr-error p {
            color: var(--ink-60);
            max-width: 480px;
          }
          .rr-error button {
            margin-top: 16px;
            padding: 14px 28px;
            background: var(--ink);
            color: var(--bg);
            border: none;
            border-radius: 100px;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
          }
        `}</style>
      </main>
    );
  }

  if (!result) {
    // Brief blank state while loading — loading page handles longer waits
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg)" }} />
    );
  }

  const band = getScoreBand(result.overallScore);
  const bandMeta = SCORE_BAND_META[band];

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,wght@0,400;0,500;1,400;1,500&display=swap"
      />

      <main className="rr-results">
        {/* === Section 1: Welcome === */}
        <Welcome company={company} />

        {/* === Section 2: Headline verdict === */}
        <Headline headline={result.headline} />

        {/* === Section 3..N: Per-section breakdowns === */}
        {result.sections.map((section, i) => (
          <SectionScreen key={i} section={section} index={i} />
        ))}

        {/* === PLUS+: critical rejection points === */}
        {result.criticalRejectionPoints && result.criticalRejectionPoints.length > 0 && (
          <CriticalRejection points={result.criticalRejectionPoints} />
        )}

        {/* === PLUS+: company context === */}
        {result.companyContext && (
          <CompanyContext text={result.companyContext} company={company} />
        )}

        {/* === PREMIUM: hiring intel === */}
        {result.hiringIntel && result.hiringIntel.length > 0 && (
          <HiringIntel items={result.hiringIntel} company={company} />
        )}

        {/* === PREMIUM: ATS bypass tips === */}
        {result.atsBypassTips && result.atsBypassTips.length > 0 && (
          <AtsBypassTips items={result.atsBypassTips} company={company} />
        )}

        {/* === Overall score reveal === */}
        <ScoreReveal score={result.overallScore} bandMeta={bandMeta} />

        {/* === Final roast + restart === */}
        <FinalRoast text={result.finalRoast} onRestart={() => router.push("/")} />

        <ResultsStyles bandColor={bandMeta.color} />
      </main>
    </>
  );
}

/* ============================================================
   Sub-components
   ============================================================ */

function Welcome({ company }: { company: string | null }) {
  return (
    <section className="snap-section section-welcome">
      <div className="orb orb-welcome" />
      <div className="content fade-in">
        <div className="tag">
          <span className="dot" />
          <span>Roast complete</span>
        </div>
        <h1 className="display">
          Your results are
          <br />
          <span className="serif">ready.</span>
        </h1>
        <p className="lede">
          {company ? (
            <>
              We compared your resume against what{" "}
              <strong>{company}</strong> publicly looks for.
            </>
          ) : (
            <>We compared your resume against the bar at top tech companies.</>
          )}
        </p>
        <p className="hint">↓ Scroll to begin</p>
      </div>
    </section>
  );
}

function Headline({ headline }: { headline: string }) {
  return (
    <section className="snap-section section-headline">
      <div className="ambient-orb ambient-headline" aria-hidden="true" />
      <div className="content">
        <div className="tag-mini">The verdict</div>
        <p className="headline-text serif">"{headline}"</p>
      </div>
    </section>
  );
}

function SectionScreen({
  section,
  index,
}: {
  section: ResumeSection;
  index: number;
}) {
  const statusColor =
    section.status === "good"
      ? "#16A34A"
      : section.status === "warning"
      ? "#CA8A04"
      : "#DC2626";

  return (
    <section className="snap-section section-detail">
      {/*
        Per-section ambient orb — color matches the status (green/yellow/red),
        so the section subtly "feels" how it's doing before the user reads it.
        Position alternates with index so consecutive sections don't animate
        identically — keeps the eye from registering a repeating pattern.
      */}
      <div
        className="ambient-orb ambient-section"
        aria-hidden="true"
        style={{
          background: `radial-gradient(circle, ${statusColor}22 0%, ${statusColor}00 70%)`,
          // Position offset based on index — top-right, bottom-left, top-left, bottom-right repeating
          ...(index % 4 === 0 && { top: "-20%", right: "-15%" }),
          ...(index % 4 === 1 && { bottom: "-20%", left: "-15%" }),
          ...(index % 4 === 2 && { top: "-15%", left: "-20%" }),
          ...(index % 4 === 3 && { bottom: "-15%", right: "-20%" }),
        }}
      />
      <div className="content">
        <div className="section-meta">
          <span className="section-num">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="section-divider" />
          <span className="section-name">{section.name}</span>
        </div>

        <div className="section-score-row">
          <div className="section-score" style={{ color: statusColor }}>
            {section.score}
            <span className="of">/100</span>
          </div>
          <div className="section-bar">
            <div
              className="section-bar-fill"
              style={{
                width: `${section.score}%`,
                background: statusColor,
              }}
            />
          </div>
        </div>

        <p className="section-verdict">{section.verdict}</p>

        <div className="section-tip" style={{ borderColor: statusColor }}>
          <div className="section-tip-label">Tip</div>
          <p>{section.tip}</p>
        </div>
      </div>
    </section>
  );
}

function CompanyContext({
  text,
  company,
}: {
  text: string;
  company: string | null;
}) {
  return (
    <section className="snap-section section-context">
      <div className="ambient-orb ambient-context" aria-hidden="true" />
      <div className="content">
        <div className="tag-mini">
          {company ? `What ${company} looks for` : "What top companies look for"}
        </div>
        <p className="context-text serif">{text}</p>
      </div>
    </section>
  );
}

/* ============================================================
   PLUS+: Critical rejection points
   ============================================================ */
function CriticalRejection({ points }: { points: string[] }) {
  return (
    <section className="snap-section section-rejection">
      <div className="ambient-orb ambient-rejection" aria-hidden="true" />
      <div className="content">
        <div className="tag-mini tag-mini-warn">Critical issues</div>
        <h2 className="rejection-title">
          Things that will get this resume<br />
          <span className="serif">straight rejected.</span>
        </h2>
        <ul className="rejection-list">
          {points.map((p, i) => (
            <li key={i}>
              <span className="rejection-bullet" aria-hidden="true">!</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ============================================================
   PREMIUM: Hiring intel — inside knowledge about the company
   ============================================================ */
function HiringIntel({
  items,
  company,
}: {
  items: HiringIntelItem[];
  company: string | null;
}) {
  return (
    <section className="snap-section section-intel">
      <div className="ambient-orb ambient-intel" aria-hidden="true" />
      <div className="content">
        <div className="tag-mini tag-mini-premium">Hiring intel · Premium</div>
        <h2 className="intel-title">
          What {company || "they"} actually<br />
          <span className="serif">look for.</span>
        </h2>
        <p className="intel-lede">
          Insider signals that aren't in the public job description. Use these
          to tailor sections of your resume that the average applicant won't.
        </p>
        <div className="intel-list">
          {items.map((item, i) => (
            <div key={i} className="intel-card">
              <div className="intel-card-num serif">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="intel-card-body">
                <div className="intel-card-heading">{item.heading}</div>
                <p>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   PREMIUM: ATS bypass tips — concrete advice for the parser
   ============================================================ */
function AtsBypassTips({
  items,
  company,
}: {
  items: AtsBypassTip[];
  company: string | null;
}) {
  return (
    <section className="snap-section section-ats">
      <div className="ambient-orb ambient-ats" aria-hidden="true" />
      <div className="content">
        <div className="tag-mini tag-mini-premium">ATS bypass · Premium</div>
        <h2 className="ats-title">
          Get past {company ? `${company}'s ATS` : "their ATS"}<br />
          <span className="serif">cleanly.</span>
        </h2>
        <p className="ats-lede">
          Specific tweaks to this exact resume so it parses correctly through
          the Applicant Tracking System and lands on a human's screen.
        </p>
        <div className="ats-list">
          {items.map((tip, i) => (
            <div key={i} className="ats-card">
              <div className="ats-card-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 12 10 18 20 6"/>
                </svg>
              </div>
              <div className="ats-card-body">
                <div className="ats-card-heading">{tip.heading}</div>
                <p>{tip.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScoreReveal({
  score,
  bandMeta,
}: {
  score: number;
  bandMeta: typeof SCORE_BAND_META[keyof typeof SCORE_BAND_META];
}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Delay reveal so user has time to land on the section
          setTimeout(() => setRevealed(true), 300);
        }
      },
      { threshold: 0.5 }
    );
    const el = document.getElementById("score-reveal");
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="score-reveal"
      className="snap-section section-score-reveal"
      style={{ background: revealed ? bandMeta.color : "#0A0A0A" }}
    >
      {/* Soft contrasting orb behind the number */}
      <div className="orb-reveal" />

      <div className="content">
        <div className="score-pre">Overall ATS Score</div>

        <div className={`score-number ${revealed ? "revealed" : ""}`}>
          {score}
        </div>

        <div className={`score-meta ${revealed ? "revealed" : ""}`}>
          <div className="score-label">{bandMeta.label}</div>
          <p className="score-tagline serif">{bandMeta.tagline}</p>
        </div>
      </div>
    </section>
  );
}

function FinalRoast({
  text,
  onRestart,
}: {
  text: string;
  onRestart: () => void;
}) {
  return (
    <section className="snap-section section-final">
      <div className="ambient-orb ambient-final" aria-hidden="true" />
      <div className="content">
        <div className="tag-mini">One more thing</div>
        <p className="final-text serif">"{text}"</p>
        <button onClick={onRestart} className="restart-btn">
          Roast another resume <span className="arrow">→</span>
        </button>
      </div>
    </section>
  );
}

/* ============================================================
   Styles — kept inline so the page is self-contained
   ============================================================ */
function ResultsStyles({ bandColor }: { bandColor: string }) {
  return (
    <style jsx global>{`
      html, body {
        margin: 0;
        padding: 0;
        background: var(--bg);
      }
      .rr-results {
        font-family: 'DM Sans', 'Inter', system-ui, sans-serif;
        color: var(--ink);
        scroll-snap-type: y mandatory;
        height: 100vh;
        overflow-y: scroll;
        scroll-behavior: smooth;
        -webkit-font-smoothing: antialiased;
      }
      .rr-results::-webkit-scrollbar {
        width: 6px;
      }
      .rr-results::-webkit-scrollbar-track {
        background: transparent;
      }
      .rr-results::-webkit-scrollbar-thumb {
        background: var(--ink-15);
        border-radius: 100px;
      }

      .snap-section {
        height: 100vh;
        scroll-snap-align: start;
        scroll-snap-stop: always;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
        position: relative;
        overflow: hidden;
      }
      .snap-section .content {
        max-width: 720px;
        width: 100%;
        position: relative;
        z-index: 2;
      }

      .tag, .tag-mini {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border: 1px solid var(--ink-15);
        border-radius: 100px;
        font-size: 12px;
        font-weight: 500;
        color: var(--ink-60);
        background: var(--bg-trans-60);
        backdrop-filter: blur(8px);
      }
      .tag-mini {
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin-bottom: 32px;
        background: transparent;
        border: none;
        padding: 0;
        color: var(--ink-40);
        position: relative;
        padding-left: 36px;
      }
      .tag-mini::before {
        content: "";
        position: absolute;
        left: 0;
        top: 50%;
        width: 24px;
        height: 1px;
        background: var(--accent);
      }
      .tag .dot {
        width: 6px; height: 6px;
        background: var(--accent);
        border-radius: 50%;
        animation: pulse 1.6s ease-in-out infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%      { opacity: 0.5; transform: scale(0.7); }
      }

      .display {
        font-size: clamp(56px, 10vw, 132px);
        line-height: 0.95;
        letter-spacing: -0.04em;
        font-weight: 500;
        margin: 24px 0 28px;
      }
      .serif {
        font-family: 'Fraunces', Georgia, serif;
        font-style: italic;
        font-weight: 400;
      }

      /* === Section 1: Welcome === */
      .section-welcome {
        text-align: center;
      }
      .section-welcome .content {
        animation: rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      @keyframes rise {
        from { opacity: 0; transform: translateY(28px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .lede {
        font-size: clamp(17px, 1.8vw, 21px);
        color: var(--ink-60);
        max-width: 520px;
        margin: 0 auto 64px;
        line-height: 1.5;
      }
      .lede strong {
        color: var(--ink);
        font-weight: 500;
      }
      .hint {
        font-size: 12px;
        letter-spacing: 0.3em;
        color: var(--ink-40);
        animation: float 2.4s ease-in-out infinite;
      }
      @keyframes float {
        0%, 100% { transform: translateY(0); }
        50%      { transform: translateY(8px); }
      }

      .orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(90px);
        pointer-events: none;
        z-index: 0;
        will-change: transform;
      }
      .orb-welcome {
        width: 600px; height: 600px;
        background: radial-gradient(circle, rgba(var(--accent-rgb), 0.4) 0%, rgba(var(--accent-rgb), 0) 70%);
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        animation: drift 38s ease-in-out infinite;
      }
      @keyframes drift {
        0%, 100% { transform: translate(-50%, -50%) scale(1); }
        50%      { transform: translate(-50%, -52%) scale(1.04); }
      }

      /* ============================================================
         Ambient orbs — ultra-subtle drifting backgrounds
         Each section type gets a different cycle time + path so
         consecutive sections never animate identically. All are
         slow enough (35-45s) and small enough (≤50px drift, ≤1.05x
         scale) to register subconsciously, not consciously.
         ============================================================ */
      .ambient-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
        pointer-events: none;
        z-index: 0;
        will-change: transform;
        opacity: 0.85;
      }

      /* Headline — orb drifts diagonally, very slowly */
      .ambient-headline {
        width: 480px; height: 480px;
        background: radial-gradient(circle, rgba(var(--accent-rgb), 0.18) 0%, rgba(var(--accent-rgb), 0) 70%);
        top: -10%; right: -10%;
        animation: ambient-drift-a 42s ease-in-out infinite;
      }
      @keyframes ambient-drift-a {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50%      { transform: translate(-30px, 25px) scale(1.04); }
      }

      /* Per-section detail — orb position varies per section via inline style */
      .ambient-section {
        width: 520px; height: 520px;
        animation: ambient-drift-b 38s ease-in-out infinite;
      }
      @keyframes ambient-drift-b {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50%      { transform: translate(35px, -20px) scale(1.05); }
      }

      /* Company context — gentle horizontal drift */
      .ambient-context {
        width: 540px; height: 540px;
        background: radial-gradient(circle, rgba(var(--accent-rgb), 0.15) 0%, rgba(var(--accent-rgb), 0) 70%);
        bottom: -15%; left: -10%;
        animation: ambient-drift-c 45s ease-in-out infinite;
      }
      @keyframes ambient-drift-c {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50%      { transform: translate(40px, -15px) scale(1.03); }
      }

      /* Final roast — orb breathing in/out from behind the text */
      .ambient-final {
        width: 580px; height: 580px;
        background: radial-gradient(circle, rgba(var(--accent-rgb), 0.22) 0%, rgba(var(--accent-rgb), 0) 70%);
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        animation: ambient-drift-d 40s ease-in-out infinite;
      }
      @keyframes ambient-drift-d {
        0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
        50%      { transform: translate(-50%, -50%) scale(1.05); opacity: 0.95; }
      }

      /* === Section 2: Headline === */
      .section-headline {
        text-align: center;
      }
      .headline-text {
        font-size: clamp(28px, 4vw, 48px);
        line-height: 1.25;
        color: var(--ink);
      }

      /* === Per-section detail screens === */
      .section-detail .content {
        max-width: 760px;
      }
      .section-meta {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 32px;
      }
      .section-num {
        font-family: 'Fraunces', Georgia, serif;
        font-style: italic;
        font-size: 18px;
        color: var(--ink-40);
        font-weight: 400;
      }
      .section-divider {
        width: 32px;
        height: 1px;
        background: var(--ink-15);
      }
      .section-name {
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--ink-60);
      }
      .section-score-row {
        display: flex;
        align-items: center;
        gap: 24px;
        margin-bottom: 32px;
      }
      .section-score {
        font-family: 'Fraunces', Georgia, serif;
        font-weight: 500;
        font-size: clamp(72px, 10vw, 120px);
        letter-spacing: -0.03em;
        line-height: 1;
      }
      .section-score .of {
        font-family: 'DM Sans', 'Inter', sans-serif;
        font-size: 0.3em;
        color: var(--ink-40);
        font-weight: 400;
        margin-left: 4px;
      }
      .section-bar {
        flex: 1;
        height: 4px;
        background: var(--ink-08);
        border-radius: 100px;
        overflow: hidden;
      }
      .section-bar-fill {
        height: 100%;
        border-radius: 100px;
        transition: width 1s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .section-verdict {
        font-size: 18px;
        line-height: 1.55;
        color: var(--ink);
        margin-bottom: 32px;
      }
      .section-tip {
        border-left: 3px solid;
        padding: 16px 20px;
        background: var(--ink-08);
        border-radius: 0 12px 12px 0;
      }
      .section-tip-label {
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--ink-40);
        margin-bottom: 6px;
      }
      .section-tip p {
        font-size: 15px;
        line-height: 1.5;
        color: var(--ink);
      }

      /* === Company context === */
      .section-context {
        background: var(--bg-alt);
      }
      .context-text {
        font-size: clamp(22px, 2.8vw, 32px);
        line-height: 1.4;
        color: var(--ink);
      }

      /* ============================================================
         PLUS: Critical rejection points
         ============================================================ */
      .tag-mini-warn {
        color: #DC2626 !important;
      }
      .tag-mini-warn::before {
        background: #DC2626 !important;
      }
      .rejection-title {
        font-size: clamp(32px, 4.5vw, 52px);
        font-weight: 500;
        letter-spacing: -0.03em;
        line-height: 1.05;
        margin-bottom: 36px;
      }
      .rejection-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .rejection-list li {
        display: flex;
        gap: 16px;
        align-items: flex-start;
        padding: 18px 22px;
        background: rgba(220, 38, 38, 0.05);
        border: 1px solid rgba(220, 38, 38, 0.18);
        border-radius: 12px;
        font-size: 15px;
        line-height: 1.55;
        color: var(--ink);
      }
      .rejection-bullet {
        flex-shrink: 0;
        width: 26px;
        height: 26px;
        background: rgba(220, 38, 38, 0.15);
        color: #DC2626;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 14px;
        margin-top: -2px;
      }

      /* ============================================================
         PREMIUM: Hiring Intel — gold-accented, inside-knowledge feel
         ============================================================ */
      .tag-mini-premium {
        color: #B8860B !important;
      }
      .tag-mini-premium::before {
        background: linear-gradient(to right, #F4D87A, #D4AF37) !important;
      }
      [data-theme="dark"] .tag-mini-premium {
        color: #F4D87A !important;
      }
      .intel-title, .ats-title {
        font-size: clamp(32px, 4.5vw, 52px);
        font-weight: 500;
        letter-spacing: -0.03em;
        line-height: 1.05;
        margin-bottom: 16px;
      }
      .intel-lede, .ats-lede {
        font-size: 16px;
        line-height: 1.55;
        color: var(--ink-60);
        max-width: 560px;
        margin-bottom: 32px;
      }
      .intel-list, .ats-list {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .intel-card {
        display: grid;
        grid-template-columns: 56px 1fr;
        gap: 18px;
        padding: 20px 22px;
        background: linear-gradient(135deg, rgba(244, 216, 122, 0.06) 0%, rgba(212, 175, 55, 0.04) 100%);
        border: 1px solid rgba(212, 175, 55, 0.25);
        border-radius: 14px;
        align-items: flex-start;
      }
      [data-theme="dark"] .intel-card {
        background: linear-gradient(135deg, rgba(244, 216, 122, 0.08) 0%, rgba(212, 175, 55, 0.05) 100%);
        border-color: rgba(244, 216, 122, 0.2);
      }
      .intel-card-num {
        font-size: 30px;
        color: #B8860B;
        line-height: 1;
        font-weight: 500;
      }
      [data-theme="dark"] .intel-card-num {
        color: #F4D87A;
      }
      .intel-card-heading {
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.3;
        margin-bottom: 6px;
        color: var(--ink);
      }
      .intel-card-body p {
        font-size: 14px;
        line-height: 1.6;
        color: var(--ink-60);
      }

      /* ============================================================
         PREMIUM: ATS Bypass — same Premium gold language but with
         a "validation checkmark" feel since these are concrete actions
         ============================================================ */
      .ats-card {
        display: grid;
        grid-template-columns: 40px 1fr;
        gap: 16px;
        padding: 18px 22px;
        background: var(--bg-alt);
        border: 1px solid var(--line);
        border-radius: 14px;
        align-items: flex-start;
      }
      .ats-card-icon {
        width: 32px;
        height: 32px;
        background: rgba(212, 175, 55, 0.15);
        color: #B8860B;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      [data-theme="dark"] .ats-card-icon {
        color: #F4D87A;
      }
      .ats-card-icon svg {
        width: 16px;
        height: 16px;
      }
      .ats-card-heading {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
        margin-bottom: 6px;
        color: var(--ink);
      }
      .ats-card-body p {
        font-size: 14px;
        line-height: 1.6;
        color: var(--ink-60);
      }

      /* Ambient orbs for the new sections */
      .ambient-rejection {
        width: 540px; height: 540px;
        background: radial-gradient(circle, rgba(220, 38, 38, 0.10) 0%, rgba(220, 38, 38, 0) 70%);
        top: -10%; right: -15%;
        animation: ambient-drift-a 42s ease-in-out infinite;
      }
      .ambient-intel {
        width: 540px; height: 540px;
        background: radial-gradient(circle, rgba(212, 175, 55, 0.16) 0%, rgba(212, 175, 55, 0) 70%);
        bottom: -15%; left: -10%;
        animation: ambient-drift-c 45s ease-in-out infinite;
      }
      .ambient-ats {
        width: 520px; height: 520px;
        background: radial-gradient(circle, rgba(212, 175, 55, 0.12) 0%, rgba(212, 175, 55, 0) 70%);
        top: -10%; right: -10%;
        animation: ambient-drift-b 38s ease-in-out infinite;
      }

      /* === Score reveal === */
      .section-score-reveal {
        background: var(--ink);
        color: var(--bg);
        text-align: center;
        transition: background 1.1s cubic-bezier(0.16, 1, 0.3, 1);
        position: relative;
      }
      .orb-reveal {
        position: absolute;
        width: 700px; height: 700px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 70%);
        filter: blur(60px);
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        z-index: 1;
      }
      .score-pre {
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        opacity: 0.7;
        margin-bottom: 32px;
      }
      .score-number {
        font-family: 'Fraunces', Georgia, serif;
        font-weight: 500;
        font-size: clamp(180px, 28vw, 360px);
        line-height: 1;
        letter-spacing: -0.05em;
        opacity: 0;
        transform: scale(0.85);
        transition: opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1),
                    transform 1.1s cubic-bezier(0.34, 1.56, 0.64, 1);
        margin-bottom: 24px;
      }
      .score-number.revealed {
        opacity: 1;
        transform: scale(1);
      }
      .score-meta {
        opacity: 0;
        transform: translateY(16px);
        transition: opacity 0.8s ease 0.5s, transform 0.8s ease 0.5s;
      }
      .score-meta.revealed {
        opacity: 1;
        transform: translateY(0);
      }
      .score-label {
        font-size: clamp(20px, 2.4vw, 32px);
        font-weight: 600;
        letter-spacing: -0.01em;
        margin-bottom: 12px;
      }
      .score-tagline {
        font-size: clamp(16px, 1.8vw, 22px);
        opacity: 0.85;
        max-width: 520px;
        margin: 0 auto;
      }

      /* === Final roast === */
      .section-final {
        text-align: center;
      }
      .final-text {
        font-size: clamp(26px, 4vw, 44px);
        line-height: 1.3;
        margin-bottom: 48px;
        max-width: 640px;
        margin-left: auto;
        margin-right: auto;
      }
      .restart-btn {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 16px 28px;
        background: var(--ink);
        color: var(--bg);
        border: none;
        border-radius: 100px;
        font-family: inherit;
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.25s ease;
      }
      .restart-btn:hover {
        background: var(--accent);
        transform: translateY(-2px);
        box-shadow: 0 12px 32px rgba(var(--accent-rgb), 0.3);
      }
      .restart-btn .arrow {
        transition: transform 0.25s ease;
      }
      .restart-btn:hover .arrow {
        transform: translateX(3px);
      }

      .fade-in {
        animation: rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      @media (max-width: 600px) {
        .section-meta { gap: 10px; }
        .section-divider { width: 16px; }
        .section-score-row { flex-direction: column; align-items: flex-start; gap: 16px; }
        .section-bar { width: 100%; }
      }
    `}</style>
  );
}
