"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  PILLARS,
  ALL_ACTIONS,
  HORIZONS,
  getPillar,
  type Horizon,
} from "@/data/recommendations";
import { HorizonBadge, PillarIcon, horizonStyles } from "@/components/ui";

type View = "byPillar" | "list";

const HORIZON_KEYS: Horizon[] = ["short", "medium", "long"];

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const safe = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${safe})`, "ig"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.trim().toLowerCase() ? (
      <mark key={i} className="rounded bg-jm-gold/30 text-jm-gold-soft">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function Explorer() {
  const [query, setQuery] = useState("");
  const [horizons, setHorizons] = useState<Horizon[]>([]);
  const [pillars, setPillars] = useState<number[]>([]);
  const [view, setView] = useState<View>("byPillar");

  const toggleHorizon = (h: Horizon) =>
    setHorizons((cur) => (cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h]));

  const togglePillar = (id: number) =>
    setPillars((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const reset = () => {
    setQuery("");
    setHorizons([]);
    setPillars([]);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_ACTIONS.filter((a) => {
      if (horizons.length && !horizons.includes(a.horizon)) return false;
      if (pillars.length && !pillars.includes(a.pillarId)) return false;
      if (!q) return true;
      const pillar = getPillar(a.pillarId);
      return (
        a.text.toLowerCase().includes(q) ||
        pillar.title.toLowerCase().includes(q) ||
        pillar.objective.toLowerCase().includes(q)
      );
    });
  }, [query, horizons, pillars]);

  const grouped = useMemo(() => {
    return PILLARS.map((p) => ({
      pillar: p,
      actions: filtered.filter((a) => a.pillarId === p.id),
    })).filter((g) => g.actions.length > 0);
  }, [filtered]);

  const isFiltered = Boolean(query.trim() || horizons.length || pillars.length);

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
        {/* Filters */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-jm-line bg-jm-ink p-5">
            <label htmlFor="q" className="text-[11px] uppercase tracking-[0.18em] text-jm-gold">
              Search
            </label>
            <div className="relative mt-2">
              <input
                id="q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. curriculum, data centre…"
                className="w-full rounded-md border border-jm-line bg-jm-black px-3 py-2 pr-8 text-sm text-jm-text placeholder:text-jm-muted/60"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-jm-muted hover:text-jm-text"
                >
                  ×
                </button>
              )}
            </div>

            <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-jm-gold">Horizon</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {HORIZON_KEYS.map((h) => {
                const on = horizons.includes(h);
                return (
                  <button
                    key={h}
                    onClick={() => toggleHorizon(h)}
                    aria-pressed={on}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      on ? horizonStyles[h] : "border-jm-line text-jm-muted hover:text-jm-text"
                    }`}
                  >
                    <span>{HORIZONS[h].label}</span>
                    <span className="text-xs opacity-70">{HORIZONS[h].range}</span>
                  </button>
                );
              })}
            </div>

            <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-jm-gold">Pillar</p>
            <div className="mt-2 flex flex-col gap-1">
              {PILLARS.map((p) => {
                const on = pillars.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePillar(p.id)}
                    aria-pressed={on}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                      on
                        ? "bg-jm-gold/10 text-jm-gold-soft"
                        : "text-jm-muted hover:bg-jm-panel hover:text-jm-text"
                    }`}
                  >
                    <PillarIcon path={p.icon} className="h-4 w-4 shrink-0" />
                    <span className="leading-tight">{p.short}</span>
                  </button>
                );
              })}
            </div>

            {isFiltered && (
              <button
                onClick={reset}
                className="mt-6 w-full rounded-md border border-jm-line px-3 py-2 text-sm text-jm-muted hover:border-jm-gold/50 hover:text-jm-text"
              >
                Reset filters
              </button>
            )}
          </div>
        </aside>

        {/* Results */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-jm-line pb-4">
            <p className="text-sm text-jm-muted">
              <span className="font-display text-2xl font-semibold text-jm-text">
                {filtered.length}
              </span>{" "}
              recommendation{filtered.length === 1 ? "" : "s"}
              {isFiltered && ` of ${ALL_ACTIONS.length}`}
            </p>
            <div className="flex rounded-md border border-jm-line p-0.5">
              {(
                [
                  ["byPillar", "By pillar"],
                  ["list", "Flat list"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded px-3 py-1.5 text-xs transition-colors ${
                    view === v ? "bg-jm-gold text-jm-black" : "text-jm-muted hover:text-jm-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="mt-16 text-center">
              <p className="font-display text-xl">No recommendations match those filters.</p>
              <button onClick={reset} className="mt-4 text-sm text-jm-gold hover:text-jm-gold-soft">
                Reset and start over
              </button>
            </div>
          )}

          {view === "byPillar" && (
            <div className="mt-8 space-y-10">
              {grouped.map(({ pillar, actions }) => (
                <section key={pillar.id} className="fade-up">
                  <div className="flex items-start gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-jm-line bg-jm-ink text-jm-gold">
                      <PillarIcon path={pillar.icon} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/explore/${pillar.slug}`}
                        className="font-display text-xl font-semibold tracking-tight hover:text-jm-gold"
                      >
                        {String(pillar.id).padStart(2, "0")} — {pillar.title}
                      </Link>
                      <p className="mt-1 text-sm leading-relaxed text-jm-muted">
                        {highlight(pillar.objective, query)}
                      </p>
                    </div>
                  </div>

                  <ul className="mt-5 space-y-px overflow-hidden rounded-xl border border-jm-line bg-jm-line">
                    {actions.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-col gap-2 bg-jm-ink px-5 py-4 sm:flex-row sm:items-start sm:gap-5"
                      >
                        <div className="sm:order-2">
                          <HorizonBadge horizon={a.horizon} />
                        </div>
                        <p className="text-sm leading-relaxed sm:order-1 sm:flex-1">
                          {highlight(a.text, query)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {view === "list" && filtered.length > 0 && (
            <ul className="fade-up mt-8 space-y-px overflow-hidden rounded-xl border border-jm-line bg-jm-line">
              {filtered.map((a) => {
                const p = getPillar(a.pillarId);
                return (
                  <li key={a.id} className="bg-jm-ink px-5 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <HorizonBadge horizon={a.horizon} />
                      <Link
                        href={`/explore/${p.slug}`}
                        className="text-xs text-jm-muted hover:text-jm-gold"
                      >
                        {p.short}
                      </Link>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed">{highlight(a.text, query)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
