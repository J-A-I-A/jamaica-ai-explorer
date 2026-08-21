"use client";

import type { Pillar } from "@/data/recommendations";
import { PILLARS } from "@/data/recommendations";
import { PillarIcon } from "@/components/ui";

/**
 * Section divider between pillars — orients the respondent in what they're
 * about to be asked about before the individual recommendations start.
 */
export default function PillarIntro({ pillar }: { pillar: Pillar }) {
  return (
    <div className="fade-up rounded-xl border border-jm-line bg-jm-ink p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-jm-gold/40 bg-jm-gold/10">
          <PillarIcon path={pillar.icon} className="h-5 w-5 text-jm-gold" />
        </span>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-jm-gold">
            Pillar {pillar.id} of {PILLARS.length}
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold tracking-tight sm:text-2xl">
            {pillar.title}
          </h2>
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-jm-muted">
        <span className="text-jm-text">Objective — </span>
        {pillar.objective}
      </p>

      <div className="mt-5 rounded-lg border border-jm-line bg-jm-black/40 p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-jm-muted">
          Challenges this pillar responds to
        </p>
        <ul className="mt-3 space-y-2">
          {pillar.challenges.map((c) => (
            <li key={c} className="flex gap-2.5 text-sm leading-relaxed text-jm-muted">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-jm-gold" aria-hidden />
              {c}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-5 text-sm text-jm-muted">
        <span className="text-jm-text">
          {pillar.actions.length} recommendation
          {pillar.actions.length === 1 ? "" : "s"}
        </span>{" "}
        follow. Rate each one, add a comment if you have one, or skip it.
      </p>
    </div>
  );
}
