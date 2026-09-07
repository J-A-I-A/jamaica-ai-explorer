import Link from "next/link";
import { REFERENCES } from "@/data/context";

export default function SiteFooter() {
  return (
    <footer className="border-t border-jm-line/70 bg-jm-ink">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-3">
        <div>
          <p className="font-display text-lg font-semibold">National A.I. Policy Explorer</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-jm-muted">
            An interactive presentation of the policy recommendations prepared by Jamaica&apos;s
            National Artificial Intelligence Task Force and presented to the Office of the Prime
            Minister.
          </p>
        </div>

        <nav aria-labelledby="footer-sections">
          <p id="footer-sections" className="text-[11px] uppercase tracking-[0.18em] text-jm-gold">
            Sections
          </p>
          <ul className="mt-4 space-y-2 text-sm text-jm-muted">
            <li><Link className="hover:text-jm-text" href="/explore">Explore recommendations</Link></li>
            <li><Link className="hover:text-jm-text" href="/roadmap">Action plan roadmap</Link></li>
            <li><Link className="hover:text-jm-text" href="/swot">SWOT analysis</Link></li>
            <li><Link className="hover:text-jm-text" href="/ethics">Ethical considerations</Link></li>
            <li><Link className="hover:text-jm-text" href="/task-force">The Task Force</Link></li>
            <li><Link className="hover:text-jm-text" href="/assistant">Smart Search</Link></li>
            <li>
              <Link className="font-medium text-jm-gold hover:text-jm-gold-soft" href="/feedback">
                Share your feedback <span aria-hidden>→</span>
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-references">
          <p id="footer-references" className="text-[11px] uppercase tracking-[0.18em] text-jm-gold">
            References
          </p>
          <ul className="mt-4 space-y-2 text-sm text-jm-muted">
            {REFERENCES.map((r) => (
              <li key={r.href}>
                <a
                  className="hover:text-jm-text"
                  href={r.href}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {r.text}
                  {/* Warn before the context change (WCAG 3.2.5). */}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-jm-line/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs text-jm-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>
            Made and donated to the GOJ by the{" "}
            <a
              className="hover:text-jm-text"
              href="https://jaia.org.jm/"
              target="_blank"
              rel="noreferrer noopener"
            >
              Jamaica Artificial Intelligence Association
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </span>
          <span>Aligned with Vision 2030 Jamaica.</span>
        </div>
      </div>
    </footer>
  );
}
