"use client";

import { PILLARS, COUNTS } from "@/data/recommendations";
import { PillarIcon } from "@/components/ui";

/**
 * Opening step of the guided review: choose which of the nine pillars to
 * weigh in on. Reviewing all 43 recommendations is a long sit, so the default
 * posture is "pick what you care about" with an explicit opt-in to the lot.
 */
export default function PillarPicker({
  selected,
  onChange,
  onStart,
  onSkip,
}: {
  selected: number[];
  onChange: (next: number[]) => void;
  onStart: (pillarIds: number[]) => void;
  onSkip: () => void;
}) {
  const allIds = PILLARS.map((p) => p.id);
  const total = PILLARS.filter((p) => selected.includes(p.id)).reduce(
    (n, p) => n + p.actions.length,
    0,
  );

  function toggle(id: number) {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id].sort((a, b) => a - b),
    );
  }

  return (
    <div className="rounded-xl border border-jm-line bg-jm-ink p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
        Which parts of the policy do you want to weigh in on?
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-jm-muted">
        The policy has {COUNTS.pillars} pillars and {COUNTS.actions} recommended
        actions. Pick the areas you know or care about and we&apos;ll walk you
        through them one at a time — rate each recommendation, add a comment if
        you have one, and skip anything you&apos;d rather not answer.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {PILLARS.map((p) => {
          const on = selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(p.id)}
              className={`flex items-start gap-3.5 rounded-xl border p-4 text-left transition-colors ${
                on
                  ? "border-jm-gold/50 bg-jm-gold/10"
                  : "border-jm-line bg-jm-black/40 hover:border-jm-gold/40"
              }`}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors ${
                  on
                    ? "border-jm-gold bg-jm-gold text-jm-black"
                    : "border-jm-line text-transparent"
                }`}
                aria-hidden
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <PillarIcon
                    path={p.icon}
                    className={`h-4 w-4 shrink-0 ${on ? "text-jm-gold" : "text-jm-muted"}`}
                  />
                  <span className="text-sm font-medium text-jm-text">
                    {p.short}
                  </span>
                </span>
                <span className="mt-1.5 block text-xs leading-relaxed text-jm-muted">
                  {p.objective}
                </span>
                <span className="mt-2 block text-[11px] uppercase tracking-[0.16em] text-jm-muted/80">
                  {p.actions.length} recommendation
                  {p.actions.length === 1 ? "" : "s"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-7 flex flex-col gap-3 border-t border-jm-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-jm-muted">
          <button
            type="button"
            onClick={() => onChange(selected.length === allIds.length ? [] : allIds)}
            className="rounded-md text-jm-muted underline decoration-jm-line underline-offset-4 transition-colors hover:text-jm-text"
          >
            {selected.length === allIds.length ? "Clear all" : "Select all pillars"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-md text-jm-muted underline decoration-jm-line underline-offset-4 transition-colors hover:text-jm-text"
          >
            Skip the review, just leave a comment
          </button>
        </div>

        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => onStart(selected)}
          className="shrink-0 rounded-md bg-jm-gold px-5 py-2.5 text-sm font-semibold text-jm-black transition-colors hover:bg-jm-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {selected.length === 0
            ? "Select at least one pillar"
            : `Start — ${total} recommendation${total === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
