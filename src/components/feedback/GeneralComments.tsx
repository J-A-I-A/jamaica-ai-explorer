"use client";

import {
  FEEDBACK_TOPICS,
  FEEDBACK_LIMITS,
  MAX_FEEDBACK_ENTRIES,
} from "@/data/feedback";
import { fieldClass } from "./styles";

export type Entry = { id: number; topics: string[]; message: string };

let idSeq = 0;
export const newEntry = (): Entry => ({ id: ++idSeq, topics: [], message: "" });

/** An entry counts once it says something; a blank one is simply ignored. */
export const entryHasContent = (e: Entry) => e.message.trim().length >= 2;
export const entryIsValid = (e: Entry) =>
  entryHasContent(e) && e.topics.length > 0;

/**
 * The open-ended half of the feedback flow: as many topic-tagged comments as
 * the respondent wants to leave, on anything the guided review didn't cover.
 * Fully controlled so the parent can submit ratings and comments together.
 */
export default function GeneralComments({
  entries,
  onChange,
}: {
  entries: Entry[];
  onChange: (next: Entry[]) => void;
}) {
  function updateEntry(id: number, patch: Partial<Entry>) {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function toggleTopic(id: number, topic: string) {
    onChange(
      entries.map((e) =>
        e.id === id
          ? {
              ...e,
              topics: e.topics.includes(topic)
                ? e.topics.filter((t) => t !== topic)
                : [...e.topics, topic],
            }
          : e,
      ),
    );
  }

  return (
    <div>
      <div className="space-y-5">
        {entries.map((entry, i) => (
          <fieldset
            key={entry.id}
            className="rounded-xl border border-jm-line bg-jm-black/40 p-5"
          >
            <legend className="sr-only">Comment {i + 1}</legend>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] uppercase tracking-[0.18em] text-jm-gold">
                Comment {i + 1}
              </span>
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(entries.filter((e) => e.id !== entry.id))}
                  className="rounded-md px-2 py-1 text-xs text-jm-muted transition-colors hover:bg-jm-panel hover:text-jm-text"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="mt-4">
              <span id={`topics-label-${entry.id}`} className="text-sm text-jm-text">
                Topic areas
              </span>
              <span className="ml-1 text-xs text-jm-muted">
                (select one or more)
              </span>
              <div
                role="group"
                aria-labelledby={`topics-label-${entry.id}`}
                aria-describedby={
                  entryHasContent(entry) && entry.topics.length === 0
                    ? `topics-error-${entry.id}`
                    : undefined
                }
                className="mt-2.5 flex flex-wrap gap-2"
              >
                {FEEDBACK_TOPICS.map((t) => {
                  const on = entry.topics.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleTopic(entry.id, t)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        on
                          ? "border-jm-gold/50 bg-jm-gold/15 text-jm-gold-soft"
                          : "border-jm-line bg-jm-black text-jm-muted hover:border-jm-gold/40 hover:text-jm-text"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="mt-4 block">
              <span className="sr-only">Comment {i + 1} message</span>
              <textarea
                value={entry.message}
                onChange={(e) =>
                  updateEntry(entry.id, { message: e.target.value })
                }
                rows={5}
                maxLength={FEEDBACK_LIMITS.message}
                placeholder="Share your thoughts, questions, or concerns about the A.I. policy recommendations…"
                className={`resize-y ${fieldClass}`}
              />
              <span className="mt-1 block text-right text-xs text-jm-muted">
                {entry.message.length}/{FEEDBACK_LIMITS.message}
                <span className="sr-only"> characters used</span>
              </span>
            </label>

            <div role="alert">
              {entryHasContent(entry) && entry.topics.length === 0 && (
                <p id={`topics-error-${entry.id}`} className="mt-1 text-xs text-jm-gold-soft">
                  Pick at least one topic area for this comment.
                </p>
              )}
            </div>
          </fieldset>
        ))}
      </div>

      {entries.length < MAX_FEEDBACK_ENTRIES ? (
        <button
          type="button"
          onClick={() => onChange([...entries, newEntry()])}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-dashed border-jm-line px-4 py-2.5 text-sm text-jm-muted transition-colors hover:border-jm-gold/50 hover:text-jm-text"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add another comment
        </button>
      ) : (
        <p className="mt-4 text-xs text-jm-muted">
          That&apos;s the maximum of {MAX_FEEDBACK_ENTRIES} per submission — send
          these first, then add more.
        </p>
      )}
    </div>
  );
}
