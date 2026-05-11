"use client";

import { useRouter } from "next/navigation";
import PolicyPage from "../_PolicyPage";

/* ============================================================
   /auth/policies/terms — Step 1 of 3
   ============================================================ */

export default function TermsPage() {
  const router = useRouter();

  return (
    <PolicyPage
      step={1}
      title="Terms of"
      titleAccent="Service."
      lede="Read carefully. By agreeing at the bottom, you confirm you've understood and accept all terms below."
      agreeLabel="I agree to all the Terms & Conditions listed above"
      onAgree={() => router.push("/auth/policies/privacy")}
    >
      <h2>1. Overview</h2>
      <p>
        These Terms govern your use of Resume Roaster AI as a Service, operated
        by us. By using this Service, you agree to these Terms.
      </p>

      <h2>2. Service Description</h2>
      <p>
        We provide an AI-powered resume analysis tool that offers feedback and
        suggestions. Results are informational only and do not guarantee job
        outcomes.
      </p>

      <h2>3. User Accounts</h2>
      <p>You agree to:</p>
      <ul>
        <li>Provide accurate information</li>
        <li>Maintain account security</li>
        <li>Be responsible for all activity under your account</li>
      </ul>
      <p>We may suspend or terminate accounts that violate these Terms.</p>

      <h2>4. Acceptable Use</h2>
      <p>You may not:</p>
      <ul>
        <li>Upload illegal, harmful, or copyrighted material without permission</li>
        <li>Attempt to reverse-engineer or exploit the Service</li>
        <li>Abuse or overload the system</li>
      </ul>

      <h2>5. AI Disclaimer</h2>
      <p>The Service uses AI models to generate responses. You acknowledge:</p>
      <ul>
        <li>Output may be inaccurate or incomplete</li>
        <li>You are responsible for reviewing and using the output</li>
      </ul>
      <p>We are not liable for decisions made based on AI-generated content.</p>

      <h2>6. Payments &amp; Subscriptions</h2>
      <ul>
        <li>Paid features are billed as described at checkout</li>
        <li>Subscriptions renew automatically unless canceled</li>
        <li>Prices may change with notice</li>
      </ul>

      <h2>7. Intellectual Property</h2>
      <ul>
        <li>You retain ownership of your uploaded content</li>
        <li>You grant us a limited license to process it to provide the Service</li>
        <li>We own all rights to the platform and its technology</li>
      </ul>

      <h2>8. Limitation of Liability</h2>
      <p>To the maximum extent permitted by law:</p>
      <ul>
        <li>We are not liable for indirect or consequential damages</li>
        <li>Our total liability is limited to the amount paid by you in the last 30 days</li>
      </ul>

      <h2>9. Termination</h2>
      <p>
        We may suspend or terminate your access at any time for violations or
        misuse.
      </p>

      <h2>10. Changes to Terms</h2>
      <p>
        We may update these Terms. Continued use means you accept the updated
        version.
      </p>
    </PolicyPage>
  );
}
