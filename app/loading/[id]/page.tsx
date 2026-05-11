"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-browser";
import { useRequireAuth } from "@/lib/auth";

/* ============================================================
   Loading page — /loading/[id]
   ------------------------------------------------------------
   Polls the roasts row every 2 seconds. When status flips to
   'completed', auto-navigates to /results/[id]. On 'failed',
   shows the error message with a "try again" button.

   Uses polling (not Realtime) for simplicity — no extra setup,
   works reliably under any RLS config.
   ============================================================ */

const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 90 * 1000; // 90s safety cap

const STAGE_MESSAGES = [
  "Reading your resume…",
  "Pulling out the receipts…",
  "Calibrating to your target company…",
  "Drafting the roast…",
  "Adding the savagery…",
  "Just a few more seconds…",
];

interface PageProps {
  params: { id: string };
}

export default function LoadingPage({ params }: PageProps) {
  const router = useRouter();
  const { loading: authLoading, user } = useRequireAuth();
  const [error, setError] = useState<string | null>(null);
  const [stageIdx, setStageIdx] = useState(0);

  // Cycle through stage messages every ~3s for atmosphere
  useEffect(() => {
    const i = setInterval(() => {
      setStageIdx((idx) => (idx + 1) % STAGE_MESSAGES.length);
    }, 3200);
    return () => clearInterval(i);
  }, []);

  // Poll the roast row — only after auth is resolved
  useEffect(() => {
    // Wait for auth to load. If there's no user, useRequireAuth has
    // already redirected — bail out.
    if (authLoading || !user) return;

    const supabase = getSupabase();
    const startedAt = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (cancelled) return;

      const { data, error: err } = await supabase
        .from("roasts")
        .select("status, error_message")
        .eq("id", params.id)
        .single();

      if (cancelled) return;

      if (err) {
        setError(`Could not check status: ${err.message}`);
        return;
      }

      if (data.status === "completed") {
        router.push(`/results/${params.id}`);
        return;
      }

      if (data.status === "failed") {
        setError(data.error_message ?? "Roast failed for an unknown reason.");
        return;
      }

      // Safety timeout — something's wrong if it's been 90s+
      if (Date.now() - startedAt > MAX_WAIT_MS) {
        setError(
          "This is taking longer than expected. " +
            "The roast might still complete in the background — check your history later."
        );
        return;
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [params.id, router, authLoading, user]);

  return (
    <main className="loading-screen">
      {/* Animated gradient orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div className="loading-content">
        {error ? (
          <ErrorState message={error} />
        ) : (
          <>
            <div className="loading-tag">
              <span className="dot" />
              <span>Roasting in progress</span>
            </div>

            <h1 className="loading-title">
              Hang tight.
              <br />
              <span className="serif">We're cooking.</span>
            </h1>

            <p className="loading-stage" key={stageIdx}>
              {STAGE_MESSAGES[stageIdx]}
            </p>

            <div className="loading-bar">
              <div className="loading-bar-fill" />
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .loading-screen {
          min-height: 100vh;
          background: var(--bg);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          overflow: hidden;
          font-family: 'DM Sans', 'Inter', system-ui, sans-serif;
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
          will-change: transform;
        }
        .orb-1 {
          width: 640px; height: 640px;
          background: radial-gradient(circle, rgba(var(--accent-rgb), 0.55) 0%, rgba(var(--accent-rgb), 0) 70%);
          top: -180px; right: -160px;
          animation: drift-1 38s ease-in-out infinite;
        }
        .orb-2 {
          width: 480px; height: 480px;
          background: radial-gradient(circle, rgba(var(--accent-rgb), 0.35) 0%, rgba(var(--accent-rgb), 0) 70%);
          bottom: -120px; left: -120px;
          animation: drift-2 45s ease-in-out infinite;
        }
        .orb-3 {
          width: 360px; height: 360px;
          background: radial-gradient(circle, rgba(var(--accent-rgb), 0.25) 0%, rgba(var(--accent-rgb), 0) 70%);
          top: 40%; left: 50%;
          transform: translateX(-50%);
          animation: drift-3 32s ease-in-out infinite;
        }
        @keyframes drift-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(-40px, 20px) scale(1.04); }
          66%      { transform: translate(20px, 40px) scale(0.98); }
        }
        @keyframes drift-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(40px, -30px) scale(1.06); }
        }
        @keyframes drift-3 {
          0%, 100% { transform: translate(-50%, 0) scale(1); opacity: 0.75; }
          50%      { transform: translate(-50%, -20px) scale(1.04); opacity: 0.95; }
        }

        .loading-content {
          position: relative;
          z-index: 2;
          text-align: center;
          max-width: 560px;
        }

        .loading-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border: 1px solid var(--ink-15);
          border-radius: 100px;
          font-size: 12px;
          font-weight: 500;
          color: var(--ink-60);
          margin-bottom: 32px;
          background: var(--bg-trans-60);
          backdrop-filter: blur(8px);
        }
        .loading-tag .dot {
          width: 6px; height: 6px;
          background: var(--accent);
          border-radius: 50%;
          animation: pulse 1.6s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(0.7); }
        }

        .loading-title {
          font-size: clamp(48px, 8vw, 96px);
          line-height: 0.95;
          letter-spacing: -0.04em;
          font-weight: 500;
          color: var(--ink);
          margin-bottom: 32px;
        }
        .loading-title .serif {
          font-family: 'Fraunces', Georgia, serif;
          font-style: italic;
          font-weight: 400;
        }

        .loading-stage {
          font-family: 'Fraunces', Georgia, serif;
          font-style: italic;
          font-size: 20px;
          color: var(--ink-60);
          margin-bottom: 40px;
          min-height: 28px;
          animation: fade-in 0.4s ease;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .loading-bar {
          width: 280px;
          height: 4px;
          background: var(--ink-08);
          border-radius: 100px;
          overflow: hidden;
          margin: 0 auto;
        }
        .loading-bar-fill {
          height: 100%;
          width: 40%;
          background: linear-gradient(90deg, transparent, var(--accent), transparent);
          animation: bar-slide 1.6s ease-in-out infinite;
          border-radius: 100px;
        }
        @keyframes bar-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>

      {/* Inter + Fraunces — load via head, but inline as a fallback */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,wght@0,400;1,400;1,500&display=swap"
      />
    </main>
  );
}

/* ============================================================ */

function ErrorState({ message }: { message: string }) {
  const router = useRouter();
  return (
    <div style={{ textAlign: "center", maxWidth: 480 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#DC2626",
          marginBottom: 16,
        }}
      >
        Something went wrong
      </div>
      <h1
        style={{
          fontSize: "clamp(36px, 6vw, 56px)",
          lineHeight: 1,
          letterSpacing: "-0.03em",
          fontWeight: 500,
          marginBottom: 24,
          color: "var(--ink)",
        }}
      >
        The roast didn't make it.
      </h1>
      <p
        style={{
          fontSize: 16,
          lineHeight: 1.5,
          color: "var(--ink-60)",
          marginBottom: 32,
        }}
      >
        {message}
      </p>
      <button
        onClick={() => router.push("/")}
        style={{
          padding: "14px 28px",
          background: "var(--ink)",
          color: "var(--bg)",
          border: "none",
          borderRadius: 100,
          fontSize: 15,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Try again ←
      </button>
    </div>
  );
}
