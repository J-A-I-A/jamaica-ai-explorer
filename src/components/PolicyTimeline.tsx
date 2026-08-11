import {
  POLICY_TIMELINE,
  CURRENT_POLICY_STEP,
  currentPolicyStep,
} from "@/data/policyTimeline";
import { Eyebrow } from "@/components/ui";

const circleStyles = {
  done: "border-jm-green-soft/50 bg-jm-green/20 text-jm-green-soft",
  current: "border-jm-gold bg-jm-gold text-jm-black ring-4 ring-jm-gold/20",
  upcoming: "border-jm-line bg-jm-black text-jm-muted",
} as const;

export default function PolicyTimeline() {
  return (
    <section className="rounded-xl border border-jm-line bg-jm-ink p-6 sm:p-8">
      <Eyebrow>Policy timeline</Eyebrow>
      <h2 className="mt-3 font-display text-xl font-semibold tracking-tight sm:text-2xl">
        Where the policy stands today
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-jm-muted">
        The National A.I. Policy is at{" "}
        <strong className="font-semibold text-jm-gold">
          Step {CURRENT_POLICY_STEP} — {currentPolicyStep.title}
        </strong>
        . Feedback shared here is gathered at this stage, ahead of the Green
        Paper consultation.
      </p>

      <ol className="mt-8 grid gap-7 md:grid-cols-5 md:gap-0">
        {POLICY_TIMELINE.map((s, i) => {
          const state =
            s.step < CURRENT_POLICY_STEP
              ? "done"
              : s.step === CURRENT_POLICY_STEP
                ? "current"
                : "upcoming";
          const last = i === POLICY_TIMELINE.length - 1;

          return (
            <li
              key={s.step}
              aria-current={state === "current" ? "step" : undefined}
              className="relative flex gap-4 md:block md:pr-6"
            >
              {!last && (
                <>
                  {/* Vertical rail on small screens, horizontal on md+. */}
                  <span
                    aria-hidden
                    className="absolute left-[15px] top-9 -bottom-7 w-px bg-jm-line md:hidden"
                  />
                  <span
                    aria-hidden
                    className="absolute left-9 top-4 hidden h-px w-[calc(100%-2.25rem)] bg-jm-line md:block"
                  />
                </>
              )}

              <span
                className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border font-display text-xs font-semibold ${circleStyles[state]}`}
              >
                {state === "done" ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  s.step
                )}
                <span className="sr-only">
                  {state === "done"
                    ? " (completed)"
                    : state === "current"
                      ? " (current stage)"
                      : " (upcoming)"}
                </span>
              </span>

              <div className="md:mt-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-jm-muted">
                  Step {s.step}
                </p>
                <p
                  className={`mt-1 font-display text-sm font-semibold leading-tight ${
                    state === "upcoming" ? "text-jm-muted" : "text-jm-text"
                  }`}
                >
                  {s.title}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-jm-muted">
                  {s.blurb}
                </p>
                {state === "current" && (
                  <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-jm-gold/40 bg-jm-gold/10 px-2.5 py-0.5 text-[11px] font-medium text-jm-gold-soft">
                    <span className="h-1.5 w-1.5 rounded-full bg-jm-gold" />
                    We are here
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
