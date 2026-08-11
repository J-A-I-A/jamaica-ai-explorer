"use client";

import { useEffect, useRef, useState } from "react";
import {
  FEEDBACK_TOPICS,
  FEEDBACK_LIMITS,
  FEEDBACK_SUBMISSIONS_OPEN,
  MAX_FEEDBACK_ENTRIES,
  RESPONDENT_TYPES,
} from "@/data/feedback";
import { CURRENT_POLICY_STEP, currentPolicyStep } from "@/data/policyTimeline";

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

const fieldClass =
  "w-full rounded-lg border border-jm-line bg-jm-black px-3.5 py-2.5 text-sm text-jm-text placeholder:text-jm-muted/60 focus:border-jm-gold/50";

type Entry = { id: number; topics: string[]; message: string };

let idSeq = 0;
const newEntry = (): Entry => ({ id: ++idSeq, topics: [], message: "" });

const entryIsValid = (e: Entry) =>
  e.message.trim().length >= 2 && e.topics.length > 0;

declare global {
  interface Window {
    grecaptcha?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => number;
      reset: (id?: number) => void;
    };
    __onRecaptchaLoad?: () => void;
  }
}

export default function FeedbackForm() {
  const [respondentType, setRespondentType] = useState<string>(
    RESPONDENT_TYPES[0],
  );
  const [entries, setEntries] = useState<Entry[]>(() => [newEntry()]);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Load and render the reCAPTCHA v2 widget when a site key is configured,
  // matching the site theme and re-rendering when the theme is toggled.
  useEffect(() => {
    if (!SITE_KEY || !FEEDBACK_SUBMISSIONS_OPEN) return;
    let poll: ReturnType<typeof setInterval> | undefined;

    const themeNow = () =>
      document.documentElement.getAttribute("data-theme") === "light"
        ? "light"
        : "dark";

    // Render into a freshly created child so re-rendering (on theme change)
    // never hits "reCAPTCHA has already been rendered in this element".
    const mount = () => {
      if (!window.grecaptcha?.render || !wrapRef.current) return;
      if (widgetId.current !== null) return;
      const host = document.createElement("div");
      wrapRef.current.appendChild(host);
      widgetId.current = window.grecaptcha.render(host, {
        sitekey: SITE_KEY,
        theme: themeNow(),
        size: "normal",
        callback: (t: string) => {
          tokenRef.current = t;
        },
        "expired-callback": () => {
          tokenRef.current = null;
        },
        "error-callback": () => {
          tokenRef.current = null;
        },
      });
    };

    if (window.grecaptcha?.render) {
      mount();
    } else {
      window.__onRecaptchaLoad = mount;
      if (!document.getElementById("recaptcha-script")) {
        const s = document.createElement("script");
        s.id = "recaptcha-script";
        s.src =
          "https://www.google.com/recaptcha/api.js?render=explicit&onload=__onRecaptchaLoad";
        s.async = true;
        s.defer = true;
        document.head.appendChild(s);
      } else {
        poll = setInterval(() => {
          if (window.grecaptcha?.render) {
            clearInterval(poll);
            mount();
          }
        }, 200);
      }
    }

    // Re-render with a matching theme when the user toggles light/dark.
    const observer = new MutationObserver(() => {
      if (widgetId.current === null || !wrapRef.current) return;
      wrapRef.current.innerHTML = "";
      widgetId.current = null;
      tokenRef.current = null;
      mount();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      if (poll) clearInterval(poll);
      observer.disconnect();
    };
  }, []);

  function resetCaptcha() {
    if (window.grecaptcha && widgetId.current !== null) {
      window.grecaptcha.reset(widgetId.current);
    }
    tokenRef.current = null;
  }

  function updateEntry(id: number, patch: Partial<Entry>) {
    setEntries((list) =>
      list.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  }

  function toggleTopic(id: number, topic: string) {
    setEntries((list) =>
      list.map((e) =>
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

  function addEntry() {
    setEntries((list) =>
      list.length >= MAX_FEEDBACK_ENTRIES ? list : [...list, newEntry()],
    );
  }

  function removeEntry(id: number) {
    setEntries((list) =>
      list.length === 1 ? list : list.filter((e) => e.id !== id),
    );
  }

  const canSubmit =
    FEEDBACK_SUBMISSIONS_OPEN &&
    entries.length > 0 &&
    entries.every(entryIsValid);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending" || !canSubmit) return;

    if (SITE_KEY && !tokenRef.current) {
      setStatus("error");
      setError("Please confirm you're not a robot before submitting.");
      return;
    }

    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          respondentType,
          entries: entries.map((en) => ({
            topics: en.topics,
            message: en.message,
          })),
          recaptchaToken: tokenRef.current,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }
      setSent(entries.length);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
      resetCaptcha();
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-xl border border-jm-green-soft/40 bg-jm-green/10 p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-jm-green text-jm-black">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold tracking-tight">
          Thank you for your feedback
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-jm-muted">
          {sent === 1
            ? "Your response has been recorded"
            : `All ${sent} of your responses have been recorded`}{" "}
          against Step {CURRENT_POLICY_STEP} — {currentPolicyStep.title}. Public
          input shapes how Jamaica&apos;s A.I. policy is understood and improved.
        </p>
        <button
          type="button"
          onClick={() => {
            setRespondentType(RESPONDENT_TYPES[0]);
            setEntries([newEntry()]);
            setStatus("idle");
            resetCaptcha();
          }}
          className="mt-6 rounded-md border border-jm-line px-4 py-2 text-sm text-jm-muted transition-colors hover:border-jm-gold/40 hover:text-jm-text"
        >
          Submit another response
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-jm-line bg-jm-ink p-6 sm:p-8"
    >
      <label className="block sm:max-w-sm">
        <span className="text-sm text-jm-text">
          I&apos;m sharing this feedback as
        </span>
        <select
          value={respondentType}
          onChange={(e) => setRespondentType(e.target.value)}
          className={`mt-2 ${fieldClass}`}
        >
          {RESPONDENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="mt-2 block text-xs text-jm-muted">
          No personal details are collected — your feedback is submitted
          anonymously.
        </span>
      </label>

      <div className="mt-8 border-t border-jm-line pt-6">
        <p className="text-sm text-jm-text">Your feedback</p>
        <p className="mt-1 text-xs leading-relaxed text-jm-muted">
          Add as many separate pieces of feedback as you like — each one can
          cover several topic areas. All of them are recorded against Step{" "}
          {CURRENT_POLICY_STEP} ({currentPolicyStep.title}) of the policy
          timeline.
        </p>
      </div>

      <div className="mt-5 space-y-5">
        {entries.map((entry, i) => (
          <fieldset
            key={entry.id}
            className="rounded-xl border border-jm-line bg-jm-black/40 p-5"
          >
            <legend className="sr-only">Feedback {i + 1}</legend>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] uppercase tracking-[0.18em] text-jm-gold">
                Feedback {i + 1}
              </span>
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  className="rounded-md px-2 py-1 text-xs text-jm-muted transition-colors hover:bg-jm-panel hover:text-jm-text"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="mt-4">
              <span className="text-sm text-jm-text">Topic areas</span>
              <span className="ml-1 text-xs text-jm-muted">
                (select one or more)
              </span>
              <div className="mt-2.5 flex flex-wrap gap-2">
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
              <span className="sr-only">Feedback {i + 1} message</span>
              <textarea
                value={entry.message}
                onChange={(e) =>
                  updateEntry(entry.id, { message: e.target.value })
                }
                required
                rows={5}
                maxLength={FEEDBACK_LIMITS.message}
                placeholder="Share your thoughts, questions, or concerns about the A.I. policy recommendations…"
                className={`resize-y ${fieldClass}`}
              />
              <span className="mt-1 block text-right text-xs text-jm-muted">
                {entry.message.length}/{FEEDBACK_LIMITS.message}
              </span>
            </label>

            {entry.message.trim().length >= 2 && entry.topics.length === 0 && (
              <p className="mt-1 text-xs text-jm-gold-soft">
                Pick at least one topic area for this feedback.
              </p>
            )}
          </fieldset>
        ))}
      </div>

      {entries.length < MAX_FEEDBACK_ENTRIES ? (
        <button
          type="button"
          onClick={addEntry}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-dashed border-jm-line px-4 py-2.5 text-sm text-jm-muted transition-colors hover:border-jm-gold/50 hover:text-jm-text"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add another piece of feedback
        </button>
      ) : (
        <p className="mt-4 text-xs text-jm-muted">
          That&apos;s the maximum of {MAX_FEEDBACK_ENTRIES} per submission — send
          these first, then add more.
        </p>
      )}

      {SITE_KEY && FEEDBACK_SUBMISSIONS_OPEN && (
        <div className="mt-6">
          <span className="text-sm text-jm-text">Verification</span>
          <div ref={wrapRef} className="recaptcha-frame mt-2" />
        </div>
      )}

      {status === "error" && error && (
        <p className="mt-4 text-sm text-jm-gold-soft">{error}</p>
      )}

      {!FEEDBACK_SUBMISSIONS_OPEN && (
        <p className="mt-6 rounded-lg border border-jm-line bg-jm-black/40 px-4 py-3 text-sm text-jm-muted">
          Submissions aren&apos;t open just yet — this form is here so you can
          see what will be asked. Please check back shortly.
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-xs text-jm-muted">
          Your feedback is stored privately and used to improve the policy and
          this resource.
        </p>
        <button
          type="submit"
          disabled={status === "sending" || !canSubmit}
          className="shrink-0 rounded-md bg-jm-gold px-5 py-2.5 text-sm font-semibold text-jm-black transition-colors hover:bg-jm-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {!FEEDBACK_SUBMISSIONS_OPEN
            ? "Feedback opens soon"
            : status === "sending"
              ? "Sending…"
              : entries.length > 1
                ? `Submit ${entries.length} responses`
                : "Submit feedback"}
        </button>
      </div>
    </form>
  );
}
