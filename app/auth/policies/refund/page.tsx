"use client";

import { useRouter } from "next/navigation";
import PolicyPage from "../_PolicyPage";

/* ============================================================
   /auth/policies/refund — Step 3 of 3 (final)
   ------------------------------------------------------------
   This is the last policy page. After agreement we set the
   sessionStorage flag and route the user back to /auth/signup,
   where the "Create Account" button becomes visible.

   Using sessionStorage (not localStorage) is intentional —
   policy consent dies on tab close and on page reload, so
   the user must affirmatively re-read the policies on every
   fresh signup attempt. This is a deliberate safety choice.

   Bump the version constant in BOTH this file and signup/page.tsx
   when policies change meaningfully — that invalidates everyone's
   prior consent and forces them to re-read.
   ============================================================ */

const POLICIES_VERSION = "v1";
const POLICIES_KEY = `rr-policies-acknowledged-${POLICIES_VERSION}`;

export default function RefundPage() {
  const router = useRouter();

  function handleFinalAgree() {
    try {
      // sessionStorage (not localStorage) — consent dies on tab close
      // and on page reload. By design: the user must affirmatively
      // restart the policy chain on every fresh visit.
      sessionStorage.setItem(POLICIES_KEY, "yes");
    } catch {
      // sessionStorage might be disabled in some private modes —
      // user will just see the policy chain again, no harm done.
    }
    router.push("/auth/signup");
  }

  return (
    <PolicyPage
      step={3}
      title="Refund"
      titleAccent="Policy."
      lede="When refunds are possible, when they aren't, and how to request one."
      agreeLabel="I agree to all the Refund Policies listed above"
      onAgree={handleFinalAgree}
    >
      <h2>1. General Policy</h2>
      <p>
        All payments are generally non-refundable due to the digital nature of
        the Service.
      </p>

      <h2>2. Exceptions</h2>
      <p>Refunds may be granted if:</p>
      <ul>
        <li>There was a billing error</li>
        <li>The Service failed to function as intended</li>
      </ul>
      <p>Requests must be made within 7 days of purchase.</p>

      <h2>3. Subscriptions</h2>
      <ul>
        <li>You may cancel at any time</li>
        <li>No refunds for partial billing periods</li>
      </ul>

      <h2>4. Abuse</h2>
      <p>
        We reserve the right to deny refunds in cases of abuse or misuse.
      </p>
    </PolicyPage>
  );
}
