"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CURRENT_POLICY_STEP,
  POLICY_TIMELINE,
  currentPolicyStep,
} from "@/data/policyTimeline";

/**
 * Site-wide invitation to comment, rendered above the footer on every page
 * except the feedback page itself (where it would only be in the way).
 */
export default function FeedbackCta() {
  const pathname = usePathname();
  if (pathname === "/feedback") return null;

  return (
    <section className="border-t border-jm-line/70 bg-jm-ink">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="flex flex-col gap-7 rounded-2xl border border-jm-gold/30 bg-jm-gold/5 p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-jm-gold/40 bg-jm-black/40 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-jm-gold">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-jm-gold opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-jm-gold" />
              </span>
              Open for feedback
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              This policy isn&apos;t finished — tell the Task Force what you
              think
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-jm-muted sm:text-base">
              The National A.I. Policy is at Step {CURRENT_POLICY_STEP} of{" "}
              {POLICY_TIMELINE.length} — {currentPolicyStep.title} — so your
              comments can still shape it before the Green Paper consultation.
              Send as many points as you like, on any topic.
            </p>
          </div>
          <Link
            href="/feedback"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-md bg-jm-gold px-6 py-3.5 text-sm font-semibold text-jm-black transition-colors hover:bg-jm-gold-soft lg:self-auto"
          >
            Share your feedback
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
