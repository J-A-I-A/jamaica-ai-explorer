import type { Horizon } from "@/data/recommendations";
import { HORIZONS } from "@/data/recommendations";

export const horizonStyles: Record<Horizon, string> = {
  short: "border-jm-gold/40 bg-jm-gold/10 text-jm-gold-soft",
  medium: "border-jm-green-soft/40 bg-jm-green/15 text-jm-green-soft",
  long: "border-jm-text/25 bg-jm-text/10 text-jm-text",
};

export function HorizonBadge({ horizon }: { horizon: Horizon }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${horizonStyles[horizon]}`}
    >
      {HORIZONS[horizon].label}
      <span className="opacity-60">{HORIZONS[horizon].range}</span>
    </span>
  );
}

export function PillarIcon({ path, className = "" }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-jm-gold">{children}</p>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="border-b border-jm-line/70 bg-jm-ink">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        {lede && (
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-jm-muted sm:text-lg">{lede}</p>
        )}
      </div>
    </div>
  );
}
