"use client";

import { useEffect, useRef } from "react";
import { FEEDBACK_SUBMISSIONS_OPEN } from "@/data/feedback";

export const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

declare global {
  interface Window {
    grecaptcha?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => number;
      reset: (id?: number) => void;
    };
    __onRecaptchaLoad?: () => void;
  }
}

/**
 * Loads and renders the reCAPTCHA v2 checkbox into `wrapRef`, matching the
 * site theme and re-rendering when the user toggles light/dark.
 *
 * The widget only mounts once a site key is configured and submissions are
 * open; `token()` returns null until the visitor has passed the challenge.
 */
export function useRecaptcha(enabled = true) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const tokenRef = useRef<string | null>(null);

  const active = Boolean(RECAPTCHA_SITE_KEY) && FEEDBACK_SUBMISSIONS_OPEN && enabled;

  useEffect(() => {
    if (!active) return;
    let poll: ReturnType<typeof setInterval> | undefined;

    const themeNow = () =>
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light";

    // Render into a freshly created child so re-rendering (on theme change)
    // never hits "reCAPTCHA has already been rendered in this element".
    const mount = () => {
      if (!window.grecaptcha?.render || !wrapRef.current) return;
      if (widgetId.current !== null) return;
      const host = document.createElement("div");
      wrapRef.current.appendChild(host);
      widgetId.current = window.grecaptcha.render(host, {
        sitekey: RECAPTCHA_SITE_KEY,
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
      // React owns the host element, so leaving this step takes the widget's
      // iframe with it. Forget the id or a later return to the step would see
      // a widget that no longer exists and skip rendering a new one.
      widgetId.current = null;
      tokenRef.current = null;
    };
  }, [active]);

  function reset() {
    try {
      if (window.grecaptcha && widgetId.current !== null) {
        window.grecaptcha.reset(widgetId.current);
      }
    } catch {
      // A widget torn down with its host can't be reset — nothing to undo.
    }
    tokenRef.current = null;
  }

  return {
    /** Attach to the element the checkbox should render inside. */
    wrapRef,
    /** True when the widget is actually being shown. */
    active,
    token: () => tokenRef.current,
    reset,
  };
}
