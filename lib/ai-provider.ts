import OpenAI from "openai";
import type { RoastResult } from "./types";

// Re-export so consumers can import from ai-provider directly
export type { HiringIntelItem, AtsBypassTip } from "./types";

/* ============================================================
   AI Provider — GPT OSS 120B (free) via OpenRouter  (v1.5.2)
   ============================================================ */

const TEXT_MODEL   = "google/gemini-2.0-flash-001"; // handles text PDFs
const VISION_MODEL = "google/gemini-2.0-flash-001"; // handles PNG + scanned PDFs
const BASE_URL     = "https://openrouter.ai/api/v1";

export type Tier = "free" | "plus" | "premium";

/**
 * ResumeContent — what we feed to the model.
 *
 *  { type: "text" }  — clean text extracted from a digital PDF
 *  { type: "image" } — base64 data URI for:
 *                        • PNG / JPEG resume images
 *                        • Scanned / image-based PDFs (pdf-parse returned < 120 chars)
 *
 * The image path uses the model's vision capability — the model
 * literally reads the document visually, exactly like a human would.
 */
export type ResumeContent =
  | { type: "text";  content: string }
  | { type: "image"; dataUri: string };

/* ── Scoring rubric — injected into every prompt ─────────────
   This is the single most important fix. Without an explicit
   rubric the model has no calibration and collapses to harsh
   perfectionist scores. These anchors mirror real recruiter
   standards, not a theoretical "perfect" resume.
   ──────────────────────────────────────────────────────────── */
const SCORING_RUBRIC = `
## SCORING RUBRIC — READ THIS BEFORE ASSIGNING ANY SCORE

Scores must reflect real-world hiring probability, not distance from a perfect resume.
A resume that got someone hired at Nvidia, Google, or Microsoft should score 78–92.
A blank resume scores 0. A median CS graduate resume scores around 50–60.

Use this scale for EVERY score (overallScore and each section score):

  90–100  │ Exceptional. Strong FAANG/top-tier offer-worthy.
           │ Quantified impact everywhere, perfect formatting, deep signals.
  75–89   │ Good. Would pass recruiter screen at most companies.
           │ Clear value, minor issues that don't kill candidacy.
  60–74   │ Average. Gets through some screens, trips over others.
           │ Decent bones but missing key signals or has noticeable gaps.
  45–59   │ Below average. Likely filtered out at competitive companies.
           │ Vague descriptions, weak structure, or significant omissions.
  25–44   │ Poor. Would be rejected at nearly all target roles.
           │ Multiple serious structural or content problems.
  0–24    │ Very poor. Barely a resume. Missing most required components.

CALIBRATION CHECKS — before submitting your response, verify:
  • If the resume has quantified impact, good project depth, and clean formatting → overallScore must be ≥ 70
  • If every section has clear content and no red flags → overallScore must be ≥ 60
  • If the resume got someone a real job in tech → overallScore must be ≥ 75
  • Median scores (55–70) are the most common outcome — not 10–30
  • A score below 40 requires at least 3 specific, severe problems you can quote from the resume
  • Section scores follow the same scale — a well-written Experience section scores 70+, not 20

STATUS THRESHOLDS (based on section score only):
  score ≥ 70  → "good"
  score 45–69 → "warning"
  score < 45  → "critical"
`;

export async function getRoast(
  resumeContent: ResumeContent,
  company: string | null,
  tier: Tier = "free"
): Promise<RoastResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY missing. Get one free at https://openrouter.ai → Keys."
    );
  }

  const client = new OpenAI({
    apiKey,
    baseURL: BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://resume-roaster.local",
      "X-Title": "Resume Roaster AI",
    },
  });

  const effectiveCompany = tier === "free" ? null : (company?.trim() || null);
  const promptText = buildPromptForTier(tier, resumeContent, effectiveCompany);

  // ── Build the user message ────────────────────────────────
  // Text resumes: simple string message (fast, cheap)
  // Image resumes: vision message with base64 image + text instructions
  type UserContent =
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail: "high" } }
      >;

  let userContent: UserContent;

  if (resumeContent.type === "image") {
    // Vision message — model reads the document visually.
    // "detail: high" gives the model a higher-resolution view of the image,
    // which is important for dense resume text.
    userContent = [
      {
        type:      "image_url",
        image_url: { url: resumeContent.dataUri, detail: "high" },
      },
      {
        type: "text",
        text: promptText,
      },
    ];
  } else {
    userContent = promptText;
  }

  // Pick the right model — vision inputs need a vision-capable model.
  // GPT OSS 120B is text-only and returns 404 on image_url content blocks.
  const model = resumeContent.type === "image" ? VISION_MODEL : TEXT_MODEL;

  let response;
  try {
    response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are a senior tech recruiter who has reviewed tens of thousands of resumes.
You give honest, calibrated feedback. You do NOT score everything as terrible.
You recognise that most professional resumes have real strengths worth acknowledging.
Your scores must follow the rubric exactly — do not default to low scores out of caution.
${resumeContent.type === "image"
  ? "The resume has been provided as an image. Read ALL text visible in the image carefully before evaluating — do not treat any part of it as blank or empty."
  : ""}
Output only valid JSON. No markdown fences, no prose outside the JSON.`,
        },
        {
          role:    "user",
          content: userContent,
        },
      ],
      temperature:     0.4,
      max_tokens:      tier === "premium" ? 6000 : 4000,
      response_format: { type: "json_object" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OpenRouter call failed.";
    throw new Error(`AI request failed: ${msg}`);
  }

  const text = response.choices[0]?.message?.content;
  if (!text || typeof text !== "string") {
    throw new Error("AI returned no text content.");
  }

  const parsed = safeJsonParse(text);
  validateShape(parsed, tier);
  return parsed as RoastResult;
}

/* ============================================================
   Prompt builders
   ============================================================ */

function buildPromptForTier(tier: Tier, resume: ResumeContent, company: string | null): string {
  // For vision mode, the resume is in the image — we tell the model to read it visually.
  // For text mode, we embed the text directly in the prompt.
  const resumeBlock = resume.type === "text"
    ? `## Resume\n\n"""\n${resume.content}\n"""`
    : `## Resume\n\nThe resume has been provided as the image above. Read every section of it carefully before evaluating. Do not treat any part as empty — every section visible in the image must be scored.`;

  switch (tier) {
    case "free":    return buildFreePrompt(resumeBlock);
    case "plus":    return buildPlusPrompt(resumeBlock, company);
    case "premium": return buildPremiumPrompt(resumeBlock, company);
  }
}

/* ─────────────────────────── FREE ─────────────────────────── */
function buildFreePrompt(resumeBlock: string): string {
  return `${SCORING_RUBRIC}

## Your task (Free tier — no target company)

Read the resume below carefully. Identify every section it actually contains (e.g. Contact, Summary, Skills, Experience, Projects, Education, Certifications, Hobbies, etc.).

For EACH section:
  - Assign a score using the rubric above
  - Write a 2–3 sentence verdict that quotes or references specific content from the resume
  - Provide ONE concrete, actionable improvement (not generic — quote the resume)
  - Set status: "good" if score ≥ 70, "warning" if 45–69, "critical" if < 45

Then compute an overallScore as a holistic weighted judgment:
  - Experience and Projects carry the most weight
  - Education and Skills are moderately weighted
  - Certifications and Hobbies carry the least weight

Write a punchy headline (2–3 sentences) summarising the resume's overall quality.
Write a finalRoast — one savage but professional one-liner that captures the resume in a sentence.

## Output — STRICT JSON, no markdown, no prose outside the object

{
  "overallScore": <integer 0–100, calibrated to rubric>,
  "headline": "<2–3 sentences — honest, specific, witty>",
  "sections": [
    {
      "name": "<section name as it appears in the resume>",
      "score": <integer 0–100>,
      "verdict": "<2–3 sentences referencing actual resume content>",
      "tip": "<ONE specific, actionable improvement>",
      "status": "good" | "warning" | "critical"
    }
  ],
  "finalRoast": "<one savage one-liner, max 25 words>"
}

Rules:
  - 4–8 sections only — only sections that exist in this resume
  - No companyContext, criticalRejectionPoints, hiringIntel, or atsBypassTips fields
  - A low score (< 45) requires a specific quote from the resume justifying it

${resumeBlock}`;
}

/* ─────────────────────────── PLUS ─────────────────────────── */
function buildPlusPrompt(resumeBlock: string, company: string | null): string {
  const companyBlock = company
    ? `## Target company: ${company}

Calibrate your analysis against what is publicly known about how ${company} evaluates candidates:
  - Their published values, leadership principles, or engineering culture docs
  - Signals from engineering blog posts, hiring manager talks, public job descriptions
  - Common patterns reported by candidates who received offers

Important limitations to respect:
  - You have NO access to private databases of accepted resumes
  - For small, regional, or recently-founded companies where your knowledge is genuinely thin,
    acknowledge that in companyContext rather than making things up
  - Your company-specific calibration shifts the score up or down relative to the general rubric —
    if the resume strongly aligns with ${company}'s stated values, score higher;
    if it ignores them entirely, score lower, but explain specifically why`
    : `## Target company: not specified

Calibrate against the general bar for entry-level / SWE roles at well-regarded tech companies.`;

  return `${SCORING_RUBRIC}

${companyBlock}

## Your task (Plus tier)

Read the resume below carefully. For EACH section it actually contains, score it using the rubric,
write a specific 2–3 sentence verdict (quote the resume), give ONE actionable tip, and set status.

Then:
  1. Compute overallScore (holistic, weighted, per rubric)
  2. Write a 2–3 sentence headline
  3. Write criticalRejectionPoints — things in THIS resume that would cause auto-rejection.
     Be specific: quote or reference actual content. "Vague descriptions" is not a rejection point.
     "Three internship bullets with zero metrics — a recruiter has no signal of impact" is a rejection point.
  4. Write companyContext — 3–4 sentences on what ${company || "top tech companies"} actually values
     at entry level, and how THIS specific resume measures up against that bar.
  5. Write a finalRoast one-liner.

## Output — STRICT JSON, no markdown, no prose outside the object

{
  "overallScore": <integer 0–100>,
  "headline": "<2–3 sentences>",
  "sections": [
    {
      "name": "<section name>",
      "score": <integer 0–100>,
      "verdict": "<2–3 sentences, specific>",
      "tip": "<ONE concrete improvement>",
      "status": "good" | "warning" | "critical"
    }
  ],
  "finalRoast": "<one-liner, max 25 words>",
  "companyContext": "<3–4 sentences on ${company || "top tech"} bar vs this resume>",
  "criticalRejectionPoints": [
    "<specific, quoted concern>",
    "<specific, quoted concern>",
    "<3–5 total>"
  ]
}

Rules:
  - 4–8 sections, only those present in the resume
  - 3–5 criticalRejectionPoints, each specific to this resume
  - No hiringIntel or atsBypassTips fields (Premium only)
  - A score below 45 on any section requires a specific problem quoted from the resume

${resumeBlock}`;
}

/* ─────────────────────────── PREMIUM ─────────────────────────── */
function buildPremiumPrompt(resumeBlock: string, company: string | null): string {
  const companyBlock = company
    ? `## Target company: ${company}

This user is paying for the deepest analysis available. Calibrate rigorously against:
  - ${company}'s published engineering values, leadership principles, and leveling guides
  - Signals from engineering blogs, hiring manager talks, and public job descriptions
  - What top performers at ${company} demonstrate that average candidates do not

Acknowledge any gaps in your knowledge about ${company} rather than fabricating intel.`
    : `## Target company: not specified (Premium tier)

Calibrate against the bar at top-tier tech companies. Provide hiring intel for that category.`;

  return `${SCORING_RUBRIC}

${companyBlock}

## Your task (Premium tier — maximum depth)

Produce everything in Plus, PLUS two Premium-exclusive features:

### HIRING INTEL (3–5 items)
Inside-knowledge about how ${company || "top tech companies"} actually evaluate candidates —
beyond what the job description says. Examples of the RIGHT level of specificity:
  - "Stripe weights written communication heavily — engineers write design docs from week one.
     A resume with no evidence of documentation or async writing will hurt in the loop."
  - "Amazon's Bar Raiser probes one Leadership Principle deeply. Resumes that show user outcomes
     rather than just technical tasks score better."
  - "Google rewards depth over breadth at L3. Listing 12 languages signals shallow exposure."

Do NOT fabricate intel for companies you know little about. Return fewer, accurate items.
If knowledge is genuinely thin, say so in the first intel item.

### ATS BYPASS TIPS (3–5 items)
Look at THIS resume specifically and identify what would hurt ATS parsing. Each tip must
reference something observable in the resume. Generic tips don't count. Examples:
  - "The skills section appears to use a table layout — most ATS parsers scramble table cells.
     Switch to a single-column bullet list."
  - "Job title 'Software Dev Intern' doesn't match ${company || "the target"}'s typical posting
     title 'Software Engineer Intern'. Exact title matching boosts keyword score."

## Output — STRICT JSON, no markdown, no prose outside the object

{
  "overallScore": <integer 0–100>,
  "headline": "<2–3 sentences>",
  "sections": [
    {
      "name": "<section name>",
      "score": <integer 0–100>,
      "verdict": "<2–3 sentences, specific>",
      "tip": "<ONE concrete improvement>",
      "status": "good" | "warning" | "critical"
    }
  ],
  "finalRoast": "<one-liner, max 25 words>",
  "companyContext": "<3–4 sentences>",
  "criticalRejectionPoints": ["<specific>", "...", "3–5 total"],
  "hiringIntel": [
    { "heading": "<short specific title>", "body": "<1–2 sentences>" }
  ],
  "atsBypassTips": [
    { "heading": "<short actionable title>", "body": "<1–2 sentences>" }
  ]
}

Rules:
  - 4–8 sections
  - 3–5 criticalRejectionPoints
  - 3–5 hiringIntel items (fewer if knowledge is limited — never fabricate)
  - 3–5 atsBypassTips referencing THIS resume specifically
  - A score below 45 requires specific quoted evidence

${resumeBlock}`;
}

/* ============================================================
   JSON parsing + validation
   ============================================================ */
function safeJsonParse(raw: string): unknown {
  let text = raw.trim();
  // Strip markdown fences just in case
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
  text = text.replace(/```$/, "").trim();
  // Find first '{' in case there's stray preamble
  const start = text.indexOf("{");
  if (start > 0) text = text.slice(start);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`AI returned malformed JSON. Preview: ${text.slice(0, 300)}…`);
  }
}

function validateShape(obj: unknown, tier: Tier): asserts obj is RoastResult {
  if (!obj || typeof obj !== "object") throw new Error("Roast result is not an object.");
  const r = obj as Record<string, unknown>;

  if (typeof r.overallScore !== "number") throw new Error("Missing overallScore.");
  if (typeof r.headline     !== "string") throw new Error("Missing headline.");
  if (typeof r.finalRoast   !== "string") throw new Error("Missing finalRoast.");
  if (!Array.isArray(r.sections))         throw new Error("Missing sections array.");
  if (r.sections.length === 0)            throw new Error("Sections array is empty.");

  for (let i = 0; i < r.sections.length; i++) {
    const s = r.sections[i] as Record<string, unknown>;
    const w = `sections[${i}]`;
    if (typeof s.name    !== "string") throw new Error(`${w}.name missing`);
    if (typeof s.score   !== "number") throw new Error(`${w}.score missing`);
    if (typeof s.verdict !== "string") throw new Error(`${w}.verdict missing`);
    if (typeof s.tip     !== "string") throw new Error(`${w}.tip missing`);
    if (!["good","warning","critical"].includes(s.status as string))
      throw new Error(`${w}.status must be good/warning/critical`);
  }

  if (tier === "plus" || tier === "premium") {
    if (typeof r.companyContext !== "string")
      throw new Error("Missing companyContext (Plus/Premium).");
    if (!Array.isArray(r.criticalRejectionPoints))
      throw new Error("Missing criticalRejectionPoints (Plus/Premium).");
    for (let i = 0; i < (r.criticalRejectionPoints as unknown[]).length; i++) {
      if (typeof (r.criticalRejectionPoints as unknown[])[i] !== "string")
        throw new Error(`criticalRejectionPoints[${i}] must be a string.`);
    }
  }

  if (tier === "premium") {
    if (!Array.isArray(r.hiringIntel))
      throw new Error("Missing hiringIntel (Premium).");
    for (let i = 0; i < (r.hiringIntel as unknown[]).length; i++) {
      const h = (r.hiringIntel as Record<string, unknown>[])[i];
      if (typeof h.heading !== "string") throw new Error(`hiringIntel[${i}].heading missing`);
      if (typeof h.body    !== "string") throw new Error(`hiringIntel[${i}].body missing`);
    }
    if (!Array.isArray(r.atsBypassTips))
      throw new Error("Missing atsBypassTips (Premium).");
    for (let i = 0; i < (r.atsBypassTips as unknown[]).length; i++) {
      const t = (r.atsBypassTips as Record<string, unknown>[])[i];
      if (typeof t.heading !== "string") throw new Error(`atsBypassTips[${i}].heading missing`);
      if (typeof t.body    !== "string") throw new Error(`atsBypassTips[${i}].body missing`);
    }
  }
}
