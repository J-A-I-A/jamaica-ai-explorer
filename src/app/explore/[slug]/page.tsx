import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PILLARS, HORIZONS, type Horizon } from "@/data/recommendations";
import { Eyebrow, HorizonBadge, PillarIcon } from "@/components/ui";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PILLARS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const pillar = PILLARS.find((p) => p.slug === slug);
  if (!pillar) return { title: "Not found" };
  return {
    title: `${pillar.title} | National A.I. Policy Explorer`,
    description: pillar.objective,
  };
}

const ORDER: Horizon[] = ["short", "medium", "long"];

export default async function PillarPage({ params }: Props) {
  const { slug } = await params;
  const pillar = PILLARS.find((p) => p.slug === slug);
  if (!pillar) notFound();

  const index = PILLARS.findIndex((p) => p.id === pillar.id);
  const prev = PILLARS[index - 1];
  const next = PILLARS[index + 1];

  return (
    <>
      <div className="border-b border-jm-line/70 bg-jm-ink">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
          <Link href="/explore" className="text-sm text-jm-muted hover:text-jm-gold">
            ← All recommendations
          </Link>
          <div className="mt-8 flex items-start gap-5">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-jm-line bg-jm-black text-jm-gold">
              <PillarIcon path={pillar.icon} className="h-7 w-7" />
            </span>
            <div>
              <Eyebrow>Pillar {String(pillar.id).padStart(2, "0")}</Eyebrow>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
                {pillar.title}
              </h1>
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-jm-gold/30 bg-jm-gold/5 p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-jm-gold">Policy objective</p>
            <p className="mt-2 font-display text-lg leading-snug sm:text-xl">{pillar.objective}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
        <section>
          <h2 className="font-display text-2xl font-semibold tracking-tight">The policy issue</h2>
          <p className="mt-4 leading-relaxed text-jm-muted">{pillar.policyIssue}</p>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Challenges</h2>
          <ul className="mt-5 grid gap-px overflow-hidden rounded-xl border border-jm-line bg-jm-line sm:grid-cols-2">
            {pillar.challenges.map((c) => (
              <li key={c} className="flex gap-3 bg-jm-ink px-5 py-4 text-sm leading-relaxed">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-jm-gold" />
                <span className="text-jm-muted">{c}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Recommendations</h2>
          <div className="mt-6 space-y-8">
            {ORDER.map((h) => {
              const items = pillar.actions.filter((a) => a.horizon === h);
              if (!items.length) return null;
              return (
                <div key={h}>
                  <div className="flex items-baseline gap-3">
                    <HorizonBadge horizon={h} />
                    <span className="text-xs text-jm-muted">{HORIZONS[h].blurb}</span>
                  </div>
                  <ol className="mt-3 space-y-px overflow-hidden rounded-xl border border-jm-line bg-jm-line">
                    {items.map((a, i) => (
                      <li key={a.text} className="flex gap-4 bg-jm-ink px-5 py-4">
                        <span className="font-display text-sm text-jm-muted">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <p className="text-sm leading-relaxed">{a.text}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </section>

        <nav className="mt-16 grid gap-px overflow-hidden rounded-xl border border-jm-line bg-jm-line sm:grid-cols-2">
          {prev ? (
            <Link href={`/explore/${prev.slug}`} className="group bg-jm-ink p-5 hover:bg-jm-panel">
              <p className="text-xs text-jm-muted">← Previous pillar</p>
              <p className="mt-1 font-display font-semibold group-hover:text-jm-gold">
                {prev.title}
              </p>
            </Link>
          ) : (
            <span className="bg-jm-ink p-5" />
          )}
          {next ? (
            <Link
              href={`/explore/${next.slug}`}
              className="group bg-jm-ink p-5 text-right hover:bg-jm-panel"
            >
              <p className="text-xs text-jm-muted">Next pillar →</p>
              <p className="mt-1 font-display font-semibold group-hover:text-jm-gold">
                {next.title}
              </p>
            </Link>
          ) : (
            <span className="bg-jm-ink p-5" />
          )}
        </nav>
      </div>
    </>
  );
}
