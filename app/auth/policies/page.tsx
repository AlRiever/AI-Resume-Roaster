"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* ============================================================
   /auth/policies — entry point
   ------------------------------------------------------------
   Redirects to the first policy page in the chain.
   Kept as a thin redirect so any existing link to /auth/policies
   continues to work.
   ============================================================ */

export default function PoliciesIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth/policies/terms");
  }, [router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg, #FAF8F4)",
        color: "var(--ink-60, rgba(0,0,0,0.6))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      Redirecting…
    </main>
  );
}
