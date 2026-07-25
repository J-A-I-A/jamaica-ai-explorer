"use client";

import Link from "next/link";
import { useState } from "react";
import { PILLARS, HORIZONS, COUNTS, type Horizon } from "@/data/recommendations";
import { PillarIcon, horizonStyles } from "@/components/ui";

const ORDER: Horizon[] = ["short", "medium", "long"];

export default function Roadmap() {
  const [focus, setFocus] = useState<Horizon | null>(null);

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      {/* Horizon controls */}
      <div className="grid gap-4 sm:grid-cols-3">
        {ORDER.map((h) => {
          const on = focus === h;
          return (
            <button
              key={h}
              onClick={() => setFocus(on ? null : h)}
              aria-pressed={on}
              className={`rounded-xl border p-5 text-left transition-colors ${
                on ? horizonStyles[h] : "border-jm-line bg-jm-ink hover:border-jm-gold/40"
              }`}
            >
              <p className="font-display text-sm font-semibold uppercase tracking-wider">
                {HORIZONS[h].label}
              </p>
              <p className="mt-1 text-xs opacity-70">{HORIZONS[h].range}</p>
              <p className="mt-3 font-display text-3xl font-semibold">{COUNTS[h]}</p>
              <p className="mt-1 text-xs opacity-80">recommendations</p>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-jm-muted">
        {focus
          ? `Showing ${HORIZONS[focus].label.toLowerCase()} items only — click again to show all.`
          : "Click a horizon to isolate it."}
      </p>

      {/* Matrix */}
      <div className="mt-8 overflow-x-auto">
        <div className="min-w-[860px]">
          <div
            className="grid gap-px overflow-hidden rounded-t-xl border border-jm-line bg-jm-line"
            style={{ gridTemplateColumns: `220px repeat(${focus ? 1 : 3}, minmax(0, 1fr))` }}
          >
            <div className="bg-jm-panel px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-jm-muted">
              Pillar
            </div>
            {ORDER.filter((h) => !focus || focus === h).map((h) => (
              <div key={h} className="bg-jm-panel px-5 py-3">
                <span className="text-[11px] uppercase tracking-[0.18em] text-jm-gold">
                  {HORIZONS[h].label}
                </span>
                <span className="ml-2 text-[11px] text-jm-muted">{HORIZONS[h].range}</span>
              </div>
            ))}
          </div>

          <div
            className="grid gap-px overflow-hidden rounded-b-xl border border-t-0 border-jm-line bg-jm-line"
            style={{ gridTemplateColumns: `220px repeat(${focus ? 1 : 3}, minmax(0, 1fr))` }}
          >
            {PILLARS.map((p) => (
              <div key={p.id} className="contents">
                <div className="bg-jm-ink px-5 py-5">
                  <Link href={`/explore/${p.slug}`} className="group flex items-start gap-3">
                    <PillarIcon path={p.icon} className="mt-0.5 h-4 w-4 shrink-0 text-jm-gold" />
                    <span className="font-display text-sm font-semibold leading-tight group-hover:text-jm-gold">
                      {p.title}
                    </span>
                  </Link>
                </div>
                {ORDER.filter((h) => !focus || focus === h).map((h) => {
                  const items = p.actions.filter((a) => a.horizon === h);
                  return (
                    <div key={h} className="bg-jm-ink px-5 py-5">
                      {items.length === 0 ? (
                        <span className="text-xs text-jm-muted/50">—</span>
                      ) : (
                        <ul className="space-y-3">
                          {items.map((a) => (
                            <li key={a.text} className="flex gap-2.5 text-[13px] leading-relaxed">
                              <span
                                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                                  h === "short"
                                    ? "bg-jm-gold"
                                    : h === "medium"
                                      ? "bg-jm-green-soft"
                                      : "bg-jm-text"
                                }`}
                              />
                              <span className="text-jm-muted">{a.text}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
