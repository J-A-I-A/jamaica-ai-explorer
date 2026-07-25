"use client";

import { useEffect, useRef, useState } from "react";

const TOPICS = [
  "General",
  "Innovation & Economic Growth",
  "Education & Workforce",
  "Public Awareness",
  "Infrastructure",
  "International Cooperation",
  "Legal & Regulatory",
  "Government & Industry",
  "Ethical Foundations",
  "Cohesive Framework",
  "The website itself",
];

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

const fieldClass =
  "w-full rounded-lg border border-jm-line bg-jm-black px-3.5 py-2.5 text-sm text-jm-text placeholder:text-jm-muted/60 focus:border-jm-gold/50";

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Load and render the reCAPTCHA v2 widget when a site key is configured,
  // matching the site theme and re-rendering when the theme is toggled.
  useEffect(() => {
    if (!SITE_KEY) return;
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;

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
          name,
          email,
          organisation,
          topic,
          message,
          recaptchaToken: tokenRef.current,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }
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
          Your input has been recorded and helps shape how Jamaica&apos;s A.I.
          policy is understood and improved.
        </p>
        <button
          type="button"
          onClick={() => {
            setName("");
            setEmail("");
            setOrganisation("");
            setTopic(TOPICS[0]);
            setMessage("");
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
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-jm-text">Name</span>
          <span className="ml-1 text-xs text-jm-muted">(optional)</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Your name"
            className={`mt-2 ${fieldClass}`}
          />
        </label>
        <label className="block">
          <span className="text-sm text-jm-text">Email</span>
          <span className="ml-1 text-xs text-jm-muted">(optional)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={160}
            placeholder="you@example.com"
            className={`mt-2 ${fieldClass}`}
          />
        </label>
      </div>

      <label className="mt-5 block">
        <span className="text-sm text-jm-text">Organisation / Company</span>
        <span className="ml-1 text-xs text-jm-muted">(optional)</span>
        <input
          type="text"
          value={organisation}
          onChange={(e) => setOrganisation(e.target.value)}
          maxLength={160}
          placeholder="Your organisation or company"
          className={`mt-2 ${fieldClass}`}
        />
      </label>

      <label className="mt-5 block">
        <span className="text-sm text-jm-text">Topic</span>
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className={`mt-2 ${fieldClass}`}
        >
          {TOPICS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-5 block">
        <span className="text-sm text-jm-text">Your feedback</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={6}
          maxLength={5000}
          placeholder="Share your thoughts, questions, or concerns about the A.I. policy recommendations…"
          className={`mt-2 resize-y ${fieldClass}`}
        />
        <span className="mt-1 block text-right text-xs text-jm-muted">
          {message.length}/5000
        </span>
      </label>

      {SITE_KEY && (
        <div className="mt-5">
          <span className="text-sm text-jm-text">Verification</span>
          <div ref={wrapRef} className="recaptcha-frame mt-2" />
        </div>
      )}

      {status === "error" && error && (
        <p className="mt-4 text-sm text-jm-gold-soft">{error}</p>
      )}

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-xs text-jm-muted">
          Your feedback is stored privately and used to improve the policy and
          this resource.
        </p>
        <button
          type="submit"
          disabled={status === "sending" || message.trim().length < 2}
          className="shrink-0 rounded-md bg-jm-gold px-5 py-2.5 text-sm font-semibold text-jm-black transition-colors hover:bg-jm-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "sending" ? "Sending…" : "Submit feedback"}
        </button>
      </div>
    </form>
  );
}
