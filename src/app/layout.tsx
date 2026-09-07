import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FeedbackCta from "@/components/FeedbackCta";

const sans = Inter({
  variable: "--font-sans-var",
  subsets: ["latin"],
});

const display = Space_Grotesk({
  variable: "--font-display-var",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "National A.I. Policy Explorer | Jamaica",
  description:
    "An interactive explorer for the Jamaica National Artificial Intelligence Task Force policy recommendations — 9 policy pillars, a SWOT analysis, and a 10-year action plan.",
  // Keep the site out of search results while it is unpublished.
  robots: { index: false, follow: false, nocache: true },
};

/** Applies the theme before first paint, so the page never flashes the wrong
 *  one: an explicit choice wins, otherwise light unless the system asks for
 *  dark. Passed as script *children*, which React renders as text content — no
 *  `innerHTML`-style injection, and unlike `next/script` it stays
 *  render-blocking in the head, which is the entire point. */
const THEME_INIT = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script>{THEME_INIT}</script>
      </head>
      <body
        className="min-h-full flex flex-col font-sans antialiased"
        suppressHydrationWarning
      >
        {/* First thing in the tab order: lets keyboard and switch users jump
            past the header nav on every page (WCAG 2.4.1). */}
        <a
          href="#main-content"
          className="sr-only-focusable absolute left-4 top-4 z-[100] rounded-md bg-jm-gold px-4 py-2 text-sm font-semibold text-jm-black"
        >
          Skip to main content
        </a>
        <SiteHeader />
        {/* tabIndex -1 so the skip link can actually move focus here, not just
            scroll to it. */}
        <main id="main-content" tabIndex={-1} className="focus-target flex-1">
          {children}
        </main>
        <FeedbackCta />
        <SiteFooter />
      </body>
    </html>
  );
}
