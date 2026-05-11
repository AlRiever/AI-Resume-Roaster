<<<<<<< HEAD
# 🔥 Resume Roaster AI — v1.4.0

Brutally honest AI resume feedback. Section-by-section breakdown, animated loading, scroll-snap results page. Built with **Next.js 14 · TypeScript · Tailwind · Supabase Auth · Gemma 4 26B A4B** (via OpenRouter, free).

---

## 🆕 What's new in v1.4.0 — Auth integration

The signup and login pages are now fully wired to Supabase Auth.

- **`profiles` table** added — mirrors `auth.users` 1:1, holds the username and tier. Auto-created on signup via a Postgres trigger that pulls username out of signup metadata.
- **Email confirmation required** — on signup, the user gets a "Check your email" screen. Clicking the email link lands them on `/auth/callback` which exchanges the code for a session and redirects home.
- **Login flow** — `signInWithPassword()` with generic "Wrong email or password" error (no enumeration leak). `?next=` param honored so users come back where they were.
- **Anonymous flow OFF** — the marketing site is still public, but the upload modal's submit is gated behind auth. RLS on `roasts` and storage now uses `auth.uid()` instead of the old `x-session-id` header. Existing logged-out roast access is gone.
- **`useRequireAuth()` hook** — drop-in page guard, used on `/loading/[id]` and `/results/[id]`.

### ⚠️ Migration required for v1.4.0

Run `supabase/migrate-v1.4.0-auth.sql` once in the Supabase SQL Editor. It is idempotent. The migration:

1. Creates `public.profiles` with the username + tier columns.
2. Adds the `handle_new_user()` trigger so profile rows auto-create on signup.
3. Drops the old anonymous RLS policies on `roasts` and storage, replaces them with authenticated ones using `auth.uid()`.

### Supabase dashboard setup (one-time)

Auth needs these dashboard settings before signups will work end-to-end:

1. **Authentication → Providers → Email** — enabled, with "Confirm email" turned ON.
2. **Authentication → URL Configuration** — set Site URL to your origin (`http://localhost:3000` for dev) and add `http://localhost:3000/auth/callback` to Redirect URLs.
3. **Authentication → Emails** — configure SMTP, or use Supabase's built-in sender for development (capped at 3 emails/hour, fine for testing).

---

## What's in v1.3.8

The tier column's check constraint changed from `('free', 'pro')` to `('free', 'plus', 'premium')`. **If upgrading from a pre-1.3.8 database, run `supabase/migrate-v1.3.8.sql` first.**

## 🆕 What's new in v1.3.8

- **AI provider swapped** to Google Gemma 4 26B A4B (Apr 2026 release, free on OpenRouter, 256K context, MoE architecture). One-line change in `lib/ai-provider.ts` — confirms the design goal that swapping models is trivial.
- **Tier-aware prompts** — Free/Plus/Premium now use distinctly different prompts:
  - **Free** — typo and basic-mistakes review only. Company input is locked at the UI level.
  - **Plus** — adds company-specific calibration, 3-5 critical rejection points, comparative analysis
  - **Premium** — adds 3-5 hiring intel items (insider knowledge not in the JD) + 3-5 ATS bypass tips (resume-specific)
- **Locked company input on Free** — the upload modal greys out the field with a "Plus & Premium" lock pill so users understand the upgrade path
- **Three new results-page sections** — `CriticalRejection` (Plus+), `HiringIntel` (Premium, gold-themed), `AtsBypassTips` (Premium, gold-themed)
- **Result schema** has new optional fields (`hiringIntel`, `atsBypassTips`, `criticalRejectionPoints`). Free results still validate against the original schema; Plus and Premium add their respective fields.

## 🚨 Honesty disclosure (worth reading)

The model **cannot** browse the internet at request time — no LLM can without an explicit tool/agent setup. When you see "research the company's hiring culture," what's actually happening is the model relying on training-data knowledge of well-documented companies (FAANG, big tech, large finance/consulting). For obscure companies, the prompt explicitly tells the model to acknowledge knowledge limits rather than fabricate.

If you want true real-time web research, that's a follow-up: I'd inject `web_search` results into the prompt before calling the model. The provider abstraction is set up for it — `buildPromptForTier()` is the only place that would change.

## What's in v1.3.7

- **Accounts button label is conditional** — shows "Accounts" text only on Free plan. Plus/Premium users see avatar + tier pill only (no label, no chevron).
- **"See how it works" button** added to the hero — secondary ghost button next to "Roast my resume"
- **`/how-it-works` page** — 6-step explainer of the full AI pipeline, plus an honest "what we can't do" section. Dark-mode-aware, same typography as the rest of the site.

## What's in v1.3.6

- **Three plans instead of two** — Free ($0), Plus ($6.99/mo, "Best Valued"), Premium ($15.99/mo)
- Daily roast limits scale by tier: 1 / 10 / unlimited
- New **Premium card** with gold visual treatment — gold gradient silks, gold border accent, gold CTA button. Stays gold in both light and dark mode.
- **Plus card** keeps the orange-on-dark treatment (formerly "Pro")
- **Tier pills in the Accounts button** updated: orange "Plus+" or gold "Premium" depending on plan
- All tier logic still flows through `lib/tier.ts` — single point of swap when payments are wired up

## What's in v1.3.5

- **Beta-mode Pro toggle** — clicking "Upgrade to Pro" in the pricing modal now flips you to Pro instantly (no payment). Stored in `localStorage`. Free card on Pro shows "Switch to Free." Pro card on Pro shows "✓ You're on Pro."
- **Pro badge in the Accounts button** — small orange "PRO" pill next to the avatar so testers know they're on Pro at a glance
- **Pro tier bypasses the daily roast limit** — `getTier() !== "pro"` is the only quota gate now
- **Tier abstraction in `lib/tier.ts`** — single file to swap when real payments arrive; everywhere else uses `useTier()` / `getTier()` and won't change
- **No more form-data persistence** during signup. Email, username, and policy consent all live in memory or `sessionStorage` only — page reload = full restart. Deliberate safety choice.

## What's in v1.3.4

- **Dark mode now propagates everywhere** — promoted theme variables to `globals.css` so every page (loading, results, signup, login, policies) inherits them automatically. Toggling dark mode on the homepage now affects every subsequent page consistently.
- Reverted v1.3.3's silk-fabric experiment — back to the original gradient blob silks per your call.

## What's in v1.3.2

- **Subtle ambient motion** across the four key pages — homepage hero, pricing modal silks, loading page, results page sections
- All idle drift cycles slowed to **35–45 seconds** with **≤50px movement** and **≤1.05× scale variance** — calibrated to register peripherally, not consciously
- **Per-section status orbs** on the results page — each scroll section gets a faint orb tinted by its status color (red/yellow/green) so the eye absorbs how the section is doing before reading
- **Removed the "See a sample" button** from the homepage hero (cleaner CTA hierarchy)

## What's in v1.3.1

- **Three-step policy chain** — Terms → Privacy → Refund, each on its own page
- **"Create Account" button is now hidden entirely** until all three policies are agreed (was: disabled). Cleaner mental model: there's only ever one action to take next.
- **Real policy content** filled in — Terms of Service, Privacy Policy, Refund Policy
- **Progress indicator** at the top of each policy page (1 of 3, 2 of 3, 3 of 3)
- **Short delay between policy pages** (650ms) with "Continuing…" loading state, so the click feels deliberate

## What's in v1.3.0

- **Accounts button** in nav with glass UI + dropdown
- Signup, login, policies pages scaffolded

- **Accounts button** in nav (right of "See Pricing") with glass UI
- **Avatar** in the button — defaults to placeholder, will swap to user's pic when logged in
- **Dropdown menu** opens on click — "Create Account" + "Log in" when logged out
- **Signup page** at `/auth/signup` — email, username, password, confirm password
- **Username validation** — letters and numbers only, no spaces, 3–20 chars
- **Policies-gated submit** — user must visit `/auth/policies` and agree before account creation is enabled. Acknowledgment persists in localStorage.
- **Login page stub** at `/auth/login`
- **Policies page** at `/auth/policies` with placeholder content (replace with real terms/privacy/refund text)
- **Localized pricing reverted** — pricing is back to USD-only (display in user's currency turned out to be premature)

The auth backend (Supabase Auth) is **not** wired yet. The signup form is fully validated client-side but the submit currently just shows a "backend not wired" message. Wiring is the next step.

## What's in v1.2.1

- **GPT-OSS-120B via OpenRouter** — free, no credit card, 50 requests/day on free tier
- **OpenAI SDK** under the hood (OpenRouter is OpenAI-compatible) → swapping to any other model is a 1-line change
- **Honest prompt** — no claims of accessing private hiring data; calibrates against publicly documented hiring signals (leveling guides, leadership principles, blog posts, etc.)

---

## 🚀 Quick Start

```bash
npm install
cp .env.example .env.local
# Edit .env.local — fill in 4 keys
npm run dev
```

Open <http://localhost:3000>.

---

## 🔑 Get your free OpenRouter key

1. Go to <https://openrouter.ai/>
2. Sign up with Google / GitHub
3. Top-right → **Keys** → **Create Key** → name it `resume-roaster`
4. Copy the `sk-or-v1-...` value into `.env.local` as `OPENROUTER_API_KEY`

That's it. No credit card. No payment.

---

## 📊 Rate limits (free tier)

OpenRouter free tier currently allows:
- **~20 requests per minute**
- **~50 requests per day**

With our 1-roast-per-day quota per user, this supports plenty of users in development. If you hit a 429 in production, options are:
1. Add credits to your OpenRouter account (pennies per roast at this size)
2. Switch to a different free OpenRouter model in `lib/ai-provider.ts` (change the `MODEL` constant)
3. Switch providers entirely (Groq has its own free tier with `gpt-oss-120b`)

---

## 🔄 Swap to a different model

Edit `lib/ai-provider.ts`:

```typescript
const MODEL = "openai/gpt-oss-120b:free";  // ← change this
```

Examples:
- `"openai/gpt-oss-120b"` — paid tier, no rate limits, ~$0.04/M input + $0.18/M output (cheap)
- `"anthropic/claude-3-5-sonnet"` — needs OpenRouter credits
- `"google/gemini-2.0-flash-exp:free"` — alternative free model
- `"meta-llama/llama-3.3-70b-instruct:free"` — another free option

The OpenRouter base URL stays the same. Everything else just works.

---

## 📁 Project structure

```
resume-roaster/
├── app/
│   ├── api/roast/route.ts          # Async pipeline
│   ├── components/UploadBox.tsx
│   ├── loading/[id]/page.tsx       # Animated polling page
│   ├── results/[id]/page.tsx       # Scroll-snap results page
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                    # Marketing-site homepage
├── lib/
│   ├── ai-provider.ts              # ⭐ Single AI swap point
│   ├── supabase-browser.ts
│   ├── supabase-server.ts
│   └── types.ts
├── supabase/
│   └── schema.sql
├── results-page-preview.html
├── .env.example
└── package.json
```

---

## 🧪 Testing

After `npm run dev`:

1. Open `localhost:3000`
2. Click "Roast my resume" → drag-and-drop a PDF resume
3. (Optional) type a target company
4. Submit → loading page → results page

In Supabase Table Editor → `roasts`:
- Row inserts as `pending`
- Flips to `processing`
- `parsed_text` populates a few seconds in
- `result` populates with the structured JSON
- `status` flips to `completed`

If anything fails, the row gets `status='failed'` with `error_message` set. Common failures:
- `OPENROUTER_API_KEY missing` → check `.env.local`
- `AI request failed: 429` → hit OpenRouter free-tier rate limit, wait a minute
- `AI returned malformed JSON` → model hiccup, just retry the roast
- `Could not extract enough text` → uploaded PDF is image-based / scanned

---

## 🛠️ What the AI is honestly doing

The prompt explicitly tells the model: **you do not have access to private databases of accepted resumes**. No model does. What it *can* credibly do is reference what's publicly known about how each company hires:

- Published leveling guides (Google L3-L4, Meta E3-E4)
- Leadership principles (Amazon's 16, Meta's "move fast")
- Engineering blog posts about hiring
- Hiring manager talks and podcasts
- Public job descriptions and what they imply about the bar
- Reported red/green flags from successful candidates

This is what serious resume reviewers actually do. It's better than fake "we compared you against 10,000 accepted resumes" claims.

---

## 📜 License

MIT.
=======
# AI-Resume-Roaster
>>>>>>> 2e23b67a495920c3833f75d905c45b3a44c7e1da
