"use client";

import { useRouter } from "next/navigation";
import PolicyPage from "../_PolicyPage";

/* ============================================================
   /auth/policies/privacy — Step 2 of 3
   ============================================================ */

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <PolicyPage
      step={2}
      title="Privacy"
      titleAccent="Policy."
      lede="What we collect, how we use it, and what control you have over your data."
      agreeLabel="I agree to all the Privacy Policies listed above"
      onAgree={() => router.push("/auth/policies/refund")}
    >
      <h2>1. Information We Collect</h2>
      <p>We collect:</p>
      <ul>
        <li>Account data (email, login info)</li>
        <li>Uploaded resumes/files</li>
        <li>Usage data (interactions, analytics)</li>
      </ul>

      <h2>2. How We Use Data</h2>
      <p>We use your data to:</p>
      <ul>
        <li>Provide resume analysis</li>
        <li>Improve the Service</li>
        <li>Process payments</li>
        <li>Prevent abuse</li>
      </ul>

      <h2>3. File Handling</h2>
      <ul>
        <li>Uploaded resumes may be temporarily stored and processed</li>
        <li>We do not sell your personal data</li>
      </ul>

      <h2>4. Third-Party Services</h2>
      <p>We use trusted providers for:</p>
      <ul>
        <li>Authentication</li>
        <li>Payments</li>
        <li>AI processing</li>
      </ul>
      <p>These providers may process data on our behalf.</p>

      <h2>5. Data Retention</h2>
      <p>
        We retain data as long as needed to provide the Service or comply with
        legal obligations.
      </p>

      <h2>6. Security</h2>
      <p>
        We implement reasonable safeguards, but no system is 100% secure.
      </p>

      <h2>7. Your Rights</h2>
      <p>Depending on your location, you may request:</p>
      <ul>
        <li>Access to your data</li>
        <li>Deletion of your data</li>
        <li>Correction of inaccuracies</li>
      </ul>

      <h2>8. Changes</h2>
      <p>We may update this policy. Continued use means acceptance.</p>
    </PolicyPage>
  );
}
