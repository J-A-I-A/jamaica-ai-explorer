"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

// The theme isn't React state — it lives on <html data-theme>, put there before
// first paint by the bootstrap script in the root layout. Subscribing to that
// attribute keeps the button in step with anything else that changes the theme,
// and avoids mirroring the same value into a second source of truth.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

const readTheme = (): Theme =>
  document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";

// The server can't know the theme, so it assumes the default — which is also
// what the client renders on its first, pre-hydration pass, so the two agree.
const readServerTheme = (): Theme => "light";

export default function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(
    subscribe,
    readTheme,
    readServerTheme,
  );

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    // No setState: the observer above turns this into a re-render.
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
  }

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      title={isLight ? "Switch to dark theme" : "Switch to light theme"}
      className="grid h-9 w-9 place-items-center rounded-md border border-jm-line text-jm-muted transition-colors hover:border-jm-gold/50 hover:text-jm-gold"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {isLight ? (
          // Moon — click to go dark
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        ) : (
          // Sun — click to go light
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </>
        )}
      </svg>
    </button>
  );
}
