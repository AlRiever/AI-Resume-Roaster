"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/* ============================================================
   PolicyPage — shared layout for all three policy routes
   ------------------------------------------------------------
   Each policy route (terms, privacy, refund) renders this with:
     - title & subtitle
     - the policy body (rendered as children)
     - the agreement button label
     - what happens on agree (delay + navigate)

   The agreement button sits at the very bottom of the content,
   forcing the user to scroll past everything before they can
   click it. That's the contract — a checkbox at the top would
   defeat the purpose of separate policy pages.
   ============================================================ */

interface PolicyPageProps {
  /** Tracks the user's progress: which step (1, 2, or 3) of 3 */
  step: 1 | 2 | 3;
  /** Page title — large heading at top */
  title: string;
  /** Italic accent word in the title (rendered in serif) */
  titleAccent: string;
  /** Lead paragraph below the title */
  lede: string;
  /** The policy content itself */
  children: ReactNode;
  /** Wording on the final agreement button */
  agreeLabel: string;
  /** Called after the agreement animation completes — should navigate */
  onAgree: () => void;
}

export default function PolicyPage({
  step,
  title,
  titleAccent,
  lede,
  children,
  agreeLabel,
  onAgree,
}: PolicyPageProps) {
  const router = useRouter();
  const [agreeing, setAgreeing] = useState(false);

  function handleAgree() {
    if (agreeing) return;
    setAgreeing(true);
    // Short delay so the click feels deliberate, then route forward
    setTimeout(onAgree, 650);
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400;1,9..144,500&display=swap"
        rel="stylesheet"
      />

      <style>{STYLES}</style>

      <main className="policies-page">
        <div className="policies-container">
          <button
            className="back-btn"
            onClick={() => router.push("/auth/signup")}
            type="button"
          >
            ← Back to signup
          </button>

          {/* Progress indicator: 1 of 3, 2 of 3, 3 of 3 */}
          <div className="progress-row">
            <span className="progress-label">
              Step {step} of 3
            </span>
            <div className="progress-bar">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={`progress-segment ${n <= step ? "active" : ""}`}
                />
              ))}
            </div>
          </div>

          <header className="policies-header">
            <h1>
              {title}{" "}
              <span className="serif">{titleAccent}</span>
            </h1>
            <p className="lede">{lede}</p>
          </header>

          <article className="policies-doc">{children}</article>

          <div className="agree-section">
            <button
              className="agree-btn"
              onClick={handleAgree}
              type="button"
              disabled={agreeing}
            >
              {agreeing ? (
                <>
                  <span className="spinner" />
                  Continuing…
                </>
              ) : (
                <>
                  {agreeLabel}
                  <span className="arrow">→</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

const STYLES = `
  .policies-page {
    min-height: 100vh;
    background: var(--bg, #FAF8F4);
    color: var(--ink, #0A0A0A);
    font-family: 'DM Sans', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    padding: 60px 24px;
  }
  .policies-container {
    max-width: 760px;
    margin: 0 auto;
    animation: rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .back-btn {
    background: transparent;
    border: none;
    color: var(--ink-60, rgba(0,0,0,0.6));
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    padding: 0;
    margin-bottom: 24px;
    transition: color 0.2s;
  }
  .back-btn:hover { color: var(--ink, #0A0A0A); }

  .progress-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 40px;
  }
  .progress-label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ink-60, rgba(0,0,0,0.6));
    flex-shrink: 0;
  }
  .progress-bar {
    display: flex;
    gap: 6px;
    flex: 1;
  }
  .progress-segment {
    flex: 1;
    height: 3px;
    background: var(--ink-08, rgba(0,0,0,0.08));
    border-radius: 100px;
    transition: background 0.4s ease;
  }
  .progress-segment.active {
    background: var(--accent, #FF4500);
  }

  .policies-header { margin-bottom: 56px; }
  .policies-header h1 {
    font-size: clamp(40px, 6vw, 64px);
    font-weight: 500;
    letter-spacing: -0.03em;
    line-height: 1;
    margin-bottom: 20px;
  }
  .policies-header h1 .serif {
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-weight: 400;
  }
  .policies-header .lede {
    font-size: 17px;
    line-height: 1.55;
    color: var(--ink-60, rgba(0,0,0,0.6));
    max-width: 560px;
  }

  .policies-doc { margin-bottom: 48px; }
  .policies-doc h2 {
    font-size: 22px;
    font-weight: 500;
    letter-spacing: -0.02em;
    line-height: 1.25;
    margin: 40px 0 16px;
    padding-top: 32px;
    border-top: 1px solid var(--line, rgba(0,0,0,0.07));
  }
  .policies-doc h2:first-child {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }
  .policies-doc p {
    font-size: 15px;
    line-height: 1.65;
    color: var(--ink, #0A0A0A);
    margin-bottom: 14px;
  }
  .policies-doc p strong {
    font-weight: 600;
  }
  .policies-doc ul {
    list-style: none;
    padding: 0;
    margin: 0 0 16px 0;
  }
  .policies-doc ul li {
    font-size: 15px;
    line-height: 1.65;
    color: var(--ink, #0A0A0A);
    padding: 4px 0 4px 24px;
    position: relative;
  }
  .policies-doc ul li::before {
    content: "—";
    position: absolute;
    left: 0;
    color: var(--accent, #FF4500);
    font-weight: 600;
  }

  .agree-section {
    margin-top: 56px;
    padding-top: 32px;
    border-top: 1px solid var(--line, rgba(0,0,0,0.07));
    display: flex;
    justify-content: flex-start;
  }
  .agree-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 14px 28px;
    background: var(--ink, #0A0A0A);
    color: var(--bg, #FAF8F4);
    border: none;
    border-radius: 100px;
    font-family: inherit;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.25s ease;
  }
  .agree-btn:hover:not(:disabled) {
    background: var(--accent, #FF4500);
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(255, 69, 0, 0.3);
  }
  .agree-btn:disabled {
    opacity: 0.7;
    cursor: wait;
  }
  .agree-btn .arrow { transition: transform 0.25s ease; }
  .agree-btn:hover:not(:disabled) .arrow { transform: translateX(3px); }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
