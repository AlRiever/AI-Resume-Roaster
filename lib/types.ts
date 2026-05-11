/**
 * Resume Roaster — Shared Types (v1.3.8)
 *
 * The RoastResult is section-by-section. Some fields are tier-gated:
 *   Free:    overallScore, headline, sections, finalRoast
 *   Plus:    + companyContext, criticalRejectionPoints (+ richer per-section)
 *   Premium: + hiringIntel, atsBypassTips
 *
 * The frontend conditionally renders sections based on what's present.
 */

/**
 * One section of the resume (e.g., "Skills", "Projects", "Education").
 * Each section gets its own ATS score, verdict, and improvement tip.
 */
export interface ResumeSection {
  /** Display name — e.g., "Header & Contact", "Projects" */
  name: string;
  /** Per-section ATS-style score, 0-100 */
  score: number;
  /** 2-3 sentence verdict on this section as it currently stands */
  verdict: string;
  /** ONE specific, actionable tip — what to add/cut/rewrite */
  tip: string;
  /** "good" | "warning" | "critical" — drives the section accent color */
  status: "good" | "warning" | "critical";
}

/**
 * Hiring intel item — Premium only. Each is a single fact-or-insight
 * about how the target company evaluates candidates that *isn't* in
 * the public job description.
 */
export interface HiringIntelItem {
  /** Short heading — e.g., "Writing samples are tested early" */
  heading: string;
  /** 1-2 sentence body explaining the insight and how to act on it */
  body: string;
}

/**
 * ATS bypass tip — Premium only. Specific to the user's resume and
 * the target company's ATS likely setup.
 */
export interface AtsBypassTip {
  /** Short heading — e.g., "Match the job title verbatim" */
  heading: string;
  /** 1-2 sentence explanation of what to change and why it helps */
  body: string;
}

/**
 * Full roast output. Persisted as JSONB in the `result` column.
 * Tier determines which optional fields are populated.
 */
export interface RoastResult {
  /** Final ATS score 0-100, computed by the AI as a holistic judgment */
  overallScore: number;
  /** 2-3 sentence top-line verdict shown on the welcome screen */
  headline: string;
  /** Section-by-section breakdown — typically 5-7 sections */
  sections: ResumeSection[];
  /** Single savage one-liner shown after the score reveal */
  finalRoast: string;

  /** PLUS+: comparison context — what the company actually looks for */
  companyContext?: string;
  /** PLUS+: things that would get this resume auto-rejected */
  criticalRejectionPoints?: string[];

  /** PREMIUM: insider hiring signals not in the public job description */
  hiringIntel?: HiringIntelItem[];
  /** PREMIUM: actionable advice for getting through the company's ATS */
  atsBypassTips?: AtsBypassTip[];
}

/**
 * Mirrors public.roasts. Keep in sync with supabase/schema.sql.
 */
export interface RoastRow {
  id: string;
  session_id: string;
  file_path: string;
  file_name: string;
  file_type: "application/pdf" | "image/png";
  target_company: string | null;
  tier: "free" | "plus" | "premium";
  status: "pending" | "processing" | "completed" | "failed";
  result: RoastResult | null;
  error_message: string | null;
  parsed_text: string | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * Score band — drives the color logic on the results page.
 */
export type ScoreBand = "critical" | "poor" | "okay" | "good" | "perfect";

export function getScoreBand(score: number): ScoreBand {
  if (score <= 35) return "critical";
  if (score <= 50) return "poor";
  if (score <= 70) return "okay";
  if (score <= 89) return "good";
  return "perfect";
}

export const SCORE_BAND_META: Record<
  ScoreBand,
  { color: string; label: string; tagline: string }
> = {
  critical: {
    color: "#DC2626",
    label: "Very Poor",
    tagline: "This needs a full rewrite, not a polish.",
  },
  poor: {
    color: "#EA580C",
    label: "Decent",
    tagline: "There's a foundation here, but the gaps are loud.",
  },
  okay: {
    color: "#CA8A04",
    label: "Okay-Okay",
    tagline: "You're in the game — losing on the finishing touches.",
  },
  good: {
    color: "#16A34A",
    label: "Amazing",
    tagline: "Strong resume. Something small still feels off.",
  },
  perfect: {
    color: "#0EA5E9",
    label: "Perfectly Done",
    tagline: "You nailed the entire CV. This is the bar.",
  },
};
