"use client";

import { useId, useRef, useState } from "react";
import type { Pillar } from "@/data/recommendations";
import type { SupportValue } from "@/data/feedback";
import {
  FEEDBACK_LIMITS,
  SUPPORT_LEVELS,
  SUPPORT_QUESTION,
} from "@/data/feedback";
import { HorizonBadge, PillarIcon } from "@/components/ui";
import { fieldClass } from "./styles";

export type Answer = {
  support: SupportValue | null;
  comment: string;
  skipped: boolean;
};

export const emptyAnswer = (): Answer => ({
  support: null,
  comment: "",
  skipped: false,
});

export const answerHasContent = (a: Answer | undefined) =>
  Boolean(a && (a.support || a.comment.trim().length > 0));

/**
 * One recommendation, presented on its own: what it proposes, the five-point
 * scale, and an optional comment. The comment box stays collapsed until asked
 * for so rating a long list of recommendations stays a one-tap affair.
 */
export default function RecommendationCard({
  pillar,
  text,
  horizon,
  answer,
  onChange,
}: {
  pillar: Pillar;
  text: string;
  horizon: Pillar["actions"][number]["horizon"];
  answer: Answer;
  onChange: (patch: Partial<Answer>) => void;
}) {
  // The parent keys each card by recommendation id, so this remounts per
  // question: the box starts folded away unless the respondent already left a
  // comment here on an earlier pass through the flow.
  const [showComment, setShowComment] = useState(answer.comment.length > 0);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Generated rather than hardcoded so two cards on one screen can never
  // collide on the same id and break the aria-labelledby wiring.
  const questionId = useId();

  // A radiogroup is a single stop in the tab order, and arrow keys move between
  // the options — without this the group is announced as radios but behaves
  // like five unrelated buttons (WCAG 4.1.2 / ARIA authoring practices).
  const selectedIndex = SUPPORT_LEVELS.findIndex((l) => l.value === answer.support);

  function onRadioKeyDown(e: React.KeyboardEvent, i: number) {
    const last = SUPPORT_LEVELS.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = i === last ? 0 : i + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = i === 0 ? last : i - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    // Stop the page-level Left/Right shortcuts from also changing question.
    e.preventDefault();
    e.stopPropagation();
    onChange({ support: SUPPORT_LEVELS[next].value, skipped: false });
    radioRefs.current[next]?.focus();
  }

  return (
    <div className="fade-up rounded-xl border border-jm-line bg-jm-ink p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-jm-line bg-jm-black/60 px-3 py-1 text-[11px] font-medium text-jm-muted">
          <PillarIcon path={pillar.icon} className="h-3.5 w-3.5 text-jm-gold" />
          {pillar.short}
        </span>
        <HorizonBadge horizon={horizon} />
      </div>

      <p className="mt-5 font-display text-lg leading-relaxed tracking-tight text-jm-text sm:text-xl">
        {text}
      </p>

      <div className="mt-7">
        <p id={questionId} className="text-sm text-jm-text">
          {SUPPORT_QUESTION}
        </p>
        <div
          role="radiogroup"
          aria-labelledby={questionId}
          className="mt-3 grid gap-2 sm:grid-cols-5"
        >
          {SUPPORT_LEVELS.map((level, i) => {
            const on = answer.support === level.value;
            // Roving tabindex: the checked option is the group's tab stop, or
            // the first one while nothing is chosen yet.
            const isTabStop = selectedIndex === -1 ? i === 0 : on;
            return (
              <button
                key={level.value}
                ref={(el) => {
                  radioRefs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={isTabStop ? 0 : -1}
                onKeyDown={(e) => onRadioKeyDown(e, i)}
                onClick={() =>
                  onChange({
                    support: on ? null : level.value,
                    skipped: false,
                  })
                }
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors sm:flex-col sm:items-center sm:gap-2 sm:px-2 sm:py-3.5 sm:text-center ${
                  on
                    ? "border-jm-gold/60 bg-jm-gold/15 text-jm-text"
                    : "border-jm-line bg-jm-black/40 text-jm-muted hover:border-jm-gold/40 hover:text-jm-text"
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition-colors ${
                    on
                      ? "border-jm-gold bg-jm-gold text-jm-black"
                      : "border-jm-line text-jm-muted"
                  }`}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="text-xs leading-snug">{level.short}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 hidden text-[11px] text-jm-muted sm:block">
          Tip: press 1–5 to rate, S to skip, and Enter for the next one.
        </p>
      </div>

      <div className="mt-6 border-t border-jm-line pt-5">
        {showComment ? (
          <label className="block">
            <span className="text-sm text-jm-text">
              Anything you&apos;d add?
            </span>
            <span className="ml-1 text-xs text-jm-muted">(optional)</span>
            <textarea
              ref={commentRef}
              value={answer.comment}
              onChange={(e) => onChange({ comment: e.target.value })}
              rows={4}
              maxLength={FEEDBACK_LIMITS.comment}
              placeholder="What would make this recommendation work — or what worries you about it?"
              className={`mt-2 resize-y ${fieldClass}`}
            />
            <span className="mt-1 block text-right text-xs text-jm-muted">
              {answer.comment.length}/{FEEDBACK_LIMITS.comment}
              <span className="sr-only"> characters used</span>
            </span>
          </label>
        ) : (
          <button
            type="button"
            onClick={() => {
              setShowComment(true);
              requestAnimationFrame(() => commentRef.current?.focus());
            }}
            className="inline-flex items-center gap-2 rounded-md text-sm text-jm-muted transition-colors hover:text-jm-text"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Add a comment on this recommendation
          </button>
        )}
      </div>
    </div>
  );
}
