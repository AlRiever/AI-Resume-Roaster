"use client";

import { useRouter } from "next/navigation";

/* ============================================================
   /how-it-works
   ------------------------------------------------------------
   Clear, honest, step-by-step breakdown of what happens
   to the user's resume when they click "Roast my resume."
   Designed to build trust, not hype.
   ============================================================ */

const STEPS = [
  {
    num: "01",
    title: "You upload your resume",
    body: "Drop a PDF or PNG. We read the text directly — nothing is stored on our servers after the analysis is done. The file is processed in memory and discarded.",
    detail: null,
    tag: "Upload",
  },
  {
    num: "02",
    title: "You name a target company",
    body: "Optional, but it sharpens the feedback significantly. When you name a company, the AI calibrates against what that company has publicly documented about how they evaluate candidates.",
    detail: "This includes their published leveling guides, leadership principles, engineering hiring blogs, public job descriptions, and what senior engineers from those companies have shared publicly about the bar. Not magic — just the same research a good recruiter does.",
    tag: "Context",
  },
  {
    num: "03",
    title: "The AI reads every section",
    body: "The model identifies which sections your resume actually has — header, skills, projects, experience, education, achievements, and so on. It doesn't assume anything. If your resume has unusual sections, it reads those too.",
    detail: "Each section is evaluated independently. Skills are judged on evidence and depth, not just presence. Projects are judged on specificity and measurable outcomes. Experience is judged on clarity of ownership and impact.",
    tag: "Analysis",
  },
  {
    num: "04",
    title: "Each section gets a score and a tip",
    body: "Every section receives an ATS score from 0 to 100, a specific verdict on what's working and what isn't, and one concrete tip — not generic advice, but something directly actionable from what's on your resume.",
    detail: "On Plus and Premium, section-level scores show you exactly where you're losing ground. On Free, you get the overall picture. Either way, nothing is vague.",
    tag: "Scoring",
  },
  {
    num: "05",
    title: "You get an overall verdict",
    body: "All sections are weighted — projects and experience count far more than hobbies or certifications — to produce one overall ATS score. You also get a headline verdict and a final one-liner. That one-liner is what sticks.",
    detail: null,
    tag: "Verdict",
  },
  {
    num: "06",
    title: "You fix. You roast again.",
    body: "The feedback is specific enough that you can action it immediately. Fix the weakest section, come back, submit again. Repeat until your score stops embarrassing you.",
    detail: "Plus gives you 10 roasts a day. Premium gives you unlimited. The whole point is iteration — one roast isn't a fix, it's a diagnosis.",
    tag: "Iterate",
  },
];

const HONESTY_NOTES = [
  {
    icon: "✗",
    heading: "We don't have access to private hiring data.",
    body: "No AI does. There is no secret database of \"accepted resumes at Google.\" That data lives inside private ATS systems that no one has access to. Anyone claiming otherwise is lying to you.",
  },
  {
    icon: "✓",
    heading: "We calibrate against what's publicly known.",
    body: "Published leveling rubrics, leadership principles, documented hiring bars, public job descriptions, and what senior engineers from those companies have said publicly about what they look for. That's real signal — it's just not magic.",
  },
  {
    icon: "✓",
    heading: "The feedback is specific, not generic.",
    body: "\"Add more impact\" is not feedback. Every tip references what's actually on your resume and tells you the exact change that would move the needle.",
  },
];

export default function HowItWorksPage() {
  const router = useRouter();

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400;1,9..144,500&display=swap"
        rel="stylesheet"
      />
      <style>{STYLES}</style>

      <main className="hiw-page">
        {/* Background orbs — same as other pages */}
        <div className="hiw-orb hiw-orb-1" />
        <div className="hiw-orb hiw-orb-2" />

        <div className="hiw-container">

          {/* ── Back nav ── */}
          <button className="hiw-back" onClick={() => router.push("/")} type="button">
            ← Back home
          </button>

          {/* ── Header ── */}
          <header className="hiw-header">
            <div className="hiw-kicker">How it works</div>
            <h1>
              What actually happens<br />
              <span className="serif">to your resume.</span>
            </h1>
            <p className="hiw-lede">
              Six steps. No black box. We'll tell you exactly what the AI does,
              what it can't do, and why the feedback is specific enough to be useful.
            </p>
          </header>

          {/* ── Steps ── */}
          <section className="hiw-steps">
            {STEPS.map((step, i) => (
              <div key={i} className="hiw-step">
                <div className="hiw-step-left">
                  <div className="hiw-step-num serif">{step.num}</div>
                  <div className="hiw-step-tag">{step.tag}</div>
                </div>
                <div className="hiw-step-right">
                  <h2 className="hiw-step-title">{step.title}</h2>
                  <p className="hiw-step-body">{step.body}</p>
                  {step.detail && (
                    <p className="hiw-step-detail">{step.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </section>

          {/* ── Divider ── */}
          <div className="hiw-divider" />

          {/* ── Honesty section ── */}
          <section className="hiw-honesty">
            <h2 className="hiw-honesty-title">
              A few things we want to<br />
              <span className="serif">be clear about.</span>
            </h2>
            <p className="hiw-honesty-sub">
              There's a lot of AI resume tooling that over-promises. Here's what's
              actually true about how this works.
            </p>

            <div className="hiw-notes">
              {HONESTY_NOTES.map((note, i) => (
                <div key={i} className={`hiw-note ${note.icon === "✗" ? "note-no" : "note-yes"}`}>
                  <div className="hiw-note-icon">{note.icon}</div>
                  <div>
                    <div className="hiw-note-heading">{note.heading}</div>
                    <p className="hiw-note-body">{note.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── CTA ── */}
          <section className="hiw-cta">
            <p className="hiw-cta-pre serif">Seen enough?</p>
            <button
              className="hiw-cta-btn"
              type="button"
              onClick={() => router.push("/")}
            >
              Roast my resume <span className="arrow">→</span>
            </button>
          </section>

        </div>
      </main>
    </>
  );
}

/* ============================================================
   Styles
   ============================================================ */
const STYLES = `
  .hiw-page {
    min-height: 100vh;
    background: var(--bg);
    color: var(--ink);
    font-family: 'DM Sans', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    padding: 64px 24px 96px;
    position: relative;
    overflow: hidden;
  }

  /* Background orbs — same subtlety as the homepage */
  .hiw-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(90px);
    pointer-events: none;
    z-index: 0;
    will-change: transform;
  }
  .hiw-orb-1 {
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(var(--accent-rgb), 0.32) 0%, rgba(var(--accent-rgb), 0) 70%);
    top: -200px; right: -160px;
    animation: hiw-drift-a 38s ease-in-out infinite;
  }
  .hiw-orb-2 {
    width: 440px; height: 440px;
    background: radial-gradient(circle, rgba(var(--accent-rgb), 0.18) 0%, rgba(var(--accent-rgb), 0) 70%);
    bottom: 120px; left: -120px;
    animation: hiw-drift-b 45s ease-in-out infinite;
  }
  @keyframes hiw-drift-a {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%      { transform: translate(-30px, 25px) scale(1.04); }
  }
  @keyframes hiw-drift-b {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%      { transform: translate(35px, -20px) scale(1.05); }
  }

  .hiw-container {
    max-width: 860px;
    margin: 0 auto;
    position: relative;
    z-index: 1;
    animation: hiw-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes hiw-rise {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .hiw-back {
    background: transparent;
    border: none;
    color: var(--ink-60);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    padding: 0;
    margin-bottom: 48px;
    transition: color 0.2s;
    display: block;
  }
  .hiw-back:hover { color: var(--ink); }

  /* === Header === */
  .hiw-header { margin-bottom: 72px; }

  .hiw-kicker {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 20px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .hiw-kicker::before {
    content: "";
    width: 24px;
    height: 2px;
    background: var(--accent);
    border-radius: 2px;
  }

  .hiw-header h1 {
    font-size: clamp(40px, 6vw, 72px);
    font-weight: 500;
    letter-spacing: -0.035em;
    line-height: 1;
    margin-bottom: 24px;
  }
  .hiw-header h1 .serif {
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-weight: 400;
  }
  .hiw-lede {
    font-size: clamp(16px, 1.6vw, 19px);
    line-height: 1.6;
    color: var(--ink-60);
    max-width: 600px;
  }

  /* === Steps === */
  .hiw-steps {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-bottom: 80px;
  }

  .hiw-step {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 32px;
    padding: 40px 0;
    border-top: 1px solid var(--line);
    position: relative;
    transition: background 0.2s;
  }
  .hiw-step:last-child { border-bottom: 1px solid var(--line); }

  .hiw-step-left {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 4px;
  }

  .hiw-step-num {
    font-size: 48px;
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-weight: 400;
    color: var(--accent);
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .hiw-step-tag {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ink-40);
    padding: 4px 8px;
    background: var(--ink-08);
    border-radius: 4px;
    display: inline-block;
    width: fit-content;
  }

  .hiw-step-right { padding-top: 6px; }

  .hiw-step-title {
    font-size: clamp(20px, 2.4vw, 26px);
    font-weight: 500;
    letter-spacing: -0.02em;
    line-height: 1.2;
    margin-bottom: 14px;
    color: var(--ink);
  }

  .hiw-step-body {
    font-size: 16px;
    line-height: 1.65;
    color: var(--ink-60);
    margin-bottom: 0;
  }

  .hiw-step-detail {
    font-size: 14px;
    line-height: 1.65;
    color: var(--ink-40);
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    font-style: italic;
  }

  /* === Divider === */
  .hiw-divider {
    height: 1px;
    background: linear-gradient(to right, transparent, var(--accent), transparent);
    opacity: 0.4;
    margin: 0 0 72px;
  }

  /* === Honesty section === */
  .hiw-honesty { margin-bottom: 80px; }

  .hiw-honesty-title {
    font-size: clamp(32px, 4.5vw, 52px);
    font-weight: 500;
    letter-spacing: -0.03em;
    line-height: 1.05;
    margin-bottom: 16px;
  }
  .hiw-honesty-title .serif {
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-weight: 400;
  }

  .hiw-honesty-sub {
    font-size: 16px;
    line-height: 1.6;
    color: var(--ink-60);
    max-width: 560px;
    margin-bottom: 40px;
  }

  .hiw-notes {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .hiw-note {
    display: flex;
    gap: 20px;
    align-items: flex-start;
    padding: 24px;
    border-radius: 16px;
    border: 1px solid var(--line);
  }
  .note-no {
    background: rgba(220, 38, 38, 0.05);
    border-color: rgba(220, 38, 38, 0.15);
  }
  .note-yes {
    background: rgba(22, 163, 74, 0.04);
    border-color: rgba(22, 163, 74, 0.15);
  }

  .hiw-note-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .note-no  .hiw-note-icon { background: rgba(220,38,38,0.12); color: #DC2626; }
  .note-yes .hiw-note-icon { background: rgba(22,163,74,0.12); color: #16A34A; }

  .hiw-note-heading {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin-bottom: 6px;
    color: var(--ink);
  }

  .hiw-note-body {
    font-size: 14px;
    line-height: 1.6;
    color: var(--ink-60);
  }

  /* === Bottom CTA === */
  .hiw-cta {
    text-align: center;
    padding-top: 16px;
  }

  .hiw-cta-pre {
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-size: 20px;
    color: var(--ink-60);
    margin-bottom: 20px;
    display: block;
  }

  .hiw-cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 16px 32px;
    background: var(--ink);
    color: var(--bg);
    border: none;
    border-radius: 100px;
    font-family: inherit;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.25s ease;
  }
  .hiw-cta-btn:hover {
    background: var(--accent);
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(var(--accent-rgb), 0.3);
  }
  .hiw-cta-btn .arrow { transition: transform 0.25s ease; }
  .hiw-cta-btn:hover .arrow { transform: translateX(3px); }

  /* === Mobile === */
  @media (max-width: 600px) {
    .hiw-page { padding: 48px 20px 72px; }

    .hiw-step {
      grid-template-columns: 1fr;
      gap: 16px;
      padding: 32px 0;
    }
    .hiw-step-left {
      flex-direction: row;
      align-items: center;
      gap: 14px;
    }
    .hiw-step-num { font-size: 36px; }
    .hiw-header h1 { letter-spacing: -0.03em; }
  }
`;
