"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/swot", label: "SWOT" },
  { href: "/ethics", label: "Ethics" },
  { href: "/task-force", label: "Task Force" },
  { href: "/assistant", label: "Ask A.I." },
  { href: "/feedback", label: "Feedback" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-jm-line/70 bg-jm-black/85 backdrop-blur">
      <div className="flag-rule h-[3px] w-full" />
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
        <Link href="/" className="group flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/coat-of-arms.svg"
            alt="Coat of Arms of Jamaica"
            width={55}
            height={55}
            className="h-[55px] w-[55px] shrink-0"
          />
          <span className="leading-tight">
            <span className="block font-display text-sm font-semibold tracking-tight text-jm-text">
              National A.I. Policy Explorer
            </span>
            <span className="block text-[11px] uppercase tracking-[0.18em] text-jm-muted">
              Jamaica
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-jm-panel text-jm-gold"
                      : "text-jm-muted hover:bg-jm-panel/60 hover:text-jm-text"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <ThemeToggle />

          <button
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-jm-line p-2 text-jm-muted md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-jm-line/70 px-5 pb-4 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-jm-muted hover:bg-jm-panel hover:text-jm-text"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
