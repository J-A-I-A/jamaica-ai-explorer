import Link from "next/link";
import { PILLARS, COUNTS, VISION, HORIZONS } from "@/data/recommendations";
import { GLOBAL_THEMES } from "@/data/context";
import { Eyebrow, PillarIcon } from "@/components/ui";

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-jm-line/70">
        <div className="grid-bg absolute inset-0 opacity-70" aria-hidden />
        <div
          className="absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, #009b3a 0%, transparent 65%)" }}
          aria-hidden
        />
        <div
          className="absolute -left-32 top-40 h-[26rem] w-[26rem] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #ffb400 0%, transparent 65%)" }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-jm-line bg-jm-panel/60 px-3 py-1 text-xs text-jm-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-jm-green-soft" />
            Presented to the Office of the Prime Minister
          </div>

          <h1 className="mt-6 max-w-4xl font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Jamaica&apos;s national
            <span className="text-jm-gold"> A.I. policy</span>, made explorable.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-jm-muted">
            The National Artificial Intelligence Task Force set out {COUNTS.pillars} policy pillars
            and {COUNTS.actions} SMART recommendations to position Jamaica at the forefront of
            global digital transformation — while responsibly managing the risks. Filter, search and
            trace every recommendation across a ten-year horizon.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/explore"
              className="rounded-md bg-jm-gold px-5 py-3 text-sm font-semibold text-jm-black transition-colors hover:bg-jm-gold-soft"
            >
              Explore the recommendations
            </Link>
            <Link
              href="/roadmap"
              className="rounded-md border border-jm-line bg-jm-panel/60 px-5 py-3 text-sm font-semibold text-jm-text transition-colors hover:border-jm-gold/50"
            >
              View the 10-year roadmap
            </Link>
          </div>

          <dl className="mt-16 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-jm-line bg-jm-line sm:grid-cols-4">
            {[
              { k: "Policy pillars", v: COUNTS.pillars },
              { k: "Recommendations", v: COUNTS.actions },
              { k: "Task force members", v: 17 },
              { k: "Year horizon", v: 10 },
            ].map((s) => (
              <div key={s.k} className="bg-jm-ink px-5 py-6">
                <dd className="font-display text-3xl font-semibold text-jm-gold">{s.v}</dd>
                <dt className="mt-1 text-xs uppercase tracking-wider text-jm-muted">{s.k}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Vision */}
      <section className="border-b border-jm-line/70 bg-jm-ink">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <Eyebrow>The guiding vision</Eyebrow>
          <blockquote className="mt-5 max-w-4xl border-l-2 border-jm-gold pl-6 font-display text-2xl leading-snug tracking-tight sm:text-3xl">
            &ldquo;{VISION}&rdquo;
          </blockquote>
        </div>
      </section>

      {/* Pillars */}
      <section className="border-b border-jm-line/70">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>Nine pillars</Eyebrow>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Where the policy applies pressure
              </h2>
            </div>
            <Link href="/explore" className="text-sm text-jm-gold hover:text-jm-gold-soft">
              Open the explorer →
            </Link>
          </div>

          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-jm-line bg-jm-line sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p) => (
              <Link
                key={p.id}
                href={`/explore/${p.slug}`}
                className="group flex flex-col gap-4 bg-jm-ink p-6 transition-colors hover:bg-jm-panel"
              >
                <div className="flex items-start justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-jm-line bg-jm-black text-jm-gold">
                    <PillarIcon path={p.icon} className="h-5 w-5" />
                  </span>
                  <span className="font-display text-xs text-jm-muted">
                    {String(p.id).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold leading-tight tracking-tight group-hover:text-jm-gold">
                  {p.title}
                </h3>
                <p className="text-sm leading-relaxed text-jm-muted">{p.objective}</p>
                <p className="mt-auto pt-2 text-xs text-jm-muted">
                  {p.actions.length} recommendations · {p.challenges.length} challenges
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Horizons */}
      <section className="border-b border-jm-line/70 bg-jm-ink">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <Eyebrow>Implementation horizons</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Sequenced across a decade
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {(["short", "medium", "long"] as const).map((h) => (
              <div key={h} className="rounded-xl border border-jm-line bg-jm-black p-6">
                <p className="font-display text-sm font-semibold uppercase tracking-wider text-jm-gold">
                  {HORIZONS[h].label}
                </p>
                <p className="mt-1 text-sm text-jm-muted">{HORIZONS[h].range}</p>
                <p className="mt-4 font-display text-4xl font-semibold">{COUNTS[h]}</p>
                <p className="mt-2 text-sm leading-relaxed text-jm-muted">{HORIZONS[h].blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Global themes */}
      <section>
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <Eyebrow>Background &amp; context</Eyebrow>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Grounded in global and regional practice
              </h2>
              <p className="mt-5 leading-relaxed text-jm-muted">
                The Task Force conducted a comparative analysis of A.I. policy frameworks from
                countries recognised as leaders in A.I. policy development, and drew on the UNESCO
                Caribbean A.I. Policy Roadmap for regional context — the socio-economic realities of
                a Small Island Developing State.
              </p>
              <Link
                href="/ethics"
                className="mt-6 inline-block text-sm text-jm-gold hover:text-jm-gold-soft"
              >
                Read the ethical foundations →
              </Link>
            </div>
            <ul className="grid gap-px self-start overflow-hidden rounded-xl border border-jm-line bg-jm-line sm:grid-cols-2">
              {GLOBAL_THEMES.map((t) => (
                <li key={t} className="bg-jm-ink px-5 py-4 text-sm text-jm-text">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
