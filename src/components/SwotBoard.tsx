"use client";

import { useState } from "react";
import { SWOT, type SwotKey } from "@/data/context";

const KEYS: SwotKey[] = ["strengths", "weaknesses", "opportunities", "threats"];

const accent: Record<SwotKey, { dot: string; ring: string; chip: string }> = {
  strengths: {
    dot: "bg-jm-green-soft",
    ring: "border-jm-green-soft/40",
    chip: "border-jm-green-soft/40 bg-jm-green/15 text-jm-green-soft",
  },
  weaknesses: {
    dot: "bg-jm-gold",
    ring: "border-jm-gold/40",
    chip: "border-jm-gold/40 bg-jm-gold/10 text-jm-gold-soft",
  },
  opportunities: {
    dot: "bg-jm-green",
    ring: "border-jm-green/50",
    chip: "border-jm-green/50 bg-jm-green/15 text-jm-green-soft",
  },
  threats: {
    dot: "bg-jm-text",
    ring: "border-jm-text/30",
    chip: "border-jm-text/25 bg-jm-text/10 text-jm-text",
  },
};

export default function SwotBoard() {
  const [active, setActive] = useState<SwotKey | null>(null);
  const shown = active ? [active] : KEYS;

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <div className="flex flex-wrap gap-2">
        {KEYS.map((k) => {
          const on = active === k;
          return (
            <button
              key={k}
              onClick={() => setActive(on ? null : k)}
              aria-pressed={on}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                on ? accent[k].chip : "border-jm-line text-jm-muted hover:text-jm-text"
              }`}
            >
              {SWOT[k].label}
              <span className="ml-2 text-xs opacity-60">{SWOT[k].items.length}</span>
            </button>
          );
        })}
        {active && (
          <button
            onClick={() => setActive(null)}
            className="rounded-full px-3 py-1.5 text-sm text-jm-muted hover:text-jm-text"
          >
            Show all
          </button>
        )}
      </div>

      <div
        className={`mt-8 grid gap-6 ${active ? "md:grid-cols-1" : "md:grid-cols-2"}`}
      >
        {shown.map((k) => (
          <section
            key={k}
            className={`fade-up rounded-xl border bg-jm-ink p-6 ${accent[k].ring}`}
          >
            <div className="flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full ${accent[k].dot}`} />
              <h2 className="font-display text-xl font-semibold tracking-tight">
                {SWOT[k].label}
              </h2>
              <span className="ml-auto font-display text-sm text-jm-muted">
                {SWOT[k].items.length}
              </span>
            </div>
            <ul className={`mt-5 space-y-5 ${active ? "sm:columns-2 sm:gap-8 sm:space-y-0" : ""}`}>
              {SWOT[k].items.map((item) => (
                <li key={item.title} className={active ? "mb-5 break-inside-avoid" : ""}>
                  <p className="font-display text-sm font-semibold text-jm-text">{item.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-jm-muted">{item.body}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
