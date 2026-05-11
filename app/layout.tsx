import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Roaster — Brutally honest AI feedback for your resume.",
  description:
    "Get your resume roasted by AI. Brutally honest, structured feedback for IT freshers targeting top tech companies.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/*
          Theme detection script runs BEFORE paint so there's no
          flash of wrong theme on page load. Must be in <head>.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('rr-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',s||(d?'dark':'light'));}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
