import type { Metadata } from "next";
import Link from "next/link";
import { ETHICS, GLOBAL_THEMES, REFERENCES } from "@/data/context";
import { Eyebrow, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Ethical Considerations | National A.I. Policy Explorer",
  description:
    "The ethical foundations underpinning Jamaica's A.I. policy recommendations — limitations, transparency, accountability, capacity building, data privacy and inclusivity.",
};

export default function EthicsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Background & context"
        title="Ethical considerations for the use of A.I."
        lede="The ethical development, deployment and use of A.I. technologies form the foundation of the policy recommendations — drawn from industry standards, A.I. legislation, and the UNESCO Recommendation on the Ethics of A.I., with particular relevance to Jamaica as a Small Island Developing State."
      />

      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-px overflow-hidden rounded-xl border border-jm-line bg-jm-line md:grid-cols-2">
          {ETHICS.map((e, i) => (
            <article key={e.title} className="bg-jm-ink p-6">
              <span className="font-display text-xs text-jm-gold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-2 font-display text-lg font-semibold tracking-tight">{e.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-jm-muted">{e.body}</p>
            </article>
          ))}
        </div>

        <section className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <Eyebrow>Comparative analysis</Eyebrow>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Thematic areas drawn from global frameworks
            </h2>
            <p className="mt-4 leading-relaxed text-jm-muted">
              The Task Force reviewed A.I. policy frameworks from a diverse set of countries
              recognised as leaders in A.I. policy development. Nine themes recurred across them,
              and each is reflected somewhere in Jamaica&apos;s nine policy pillars.
            </p>
            <Link
              href="/explore"
              className="mt-6 inline-block text-sm text-jm-gold hover:text-jm-gold-soft"
            >
              See how they map to recommendations →
            </Link>
          </div>
          <ul className="grid gap-px self-start overflow-hidden rounded-xl border border-jm-line bg-jm-line sm:grid-cols-2">
            {GLOBAL_THEMES.map((t) => (
              <li key={t} className="bg-jm-ink px-5 py-4 text-sm">
                {t}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16">
          <Eyebrow>Source material</Eyebrow>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">References</h2>
          <ul className="mt-6 space-y-px overflow-hidden rounded-xl border border-jm-line bg-jm-line">
            {REFERENCES.map((r) => (
              <li key={r.href} className="bg-jm-ink px-5 py-4">
                <a
                  href={r.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm text-jm-text hover:text-jm-gold"
                >
                  {r.text}
                  <span className="ml-2 text-jm-muted">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
