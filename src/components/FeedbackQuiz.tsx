"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ALL_ACTIONS,
  PILLARS,
  getPillar,
  type Action,
} from "@/data/recommendations";
import {
  FEEDBACK_LIMITS,
  FEEDBACK_SUBMISSIONS_OPEN,
  ORGANISATION_TYPE,
  RESPONDENT_TYPES,
  SUPPORT_LEVELS,
} from "@/data/feedback";
import { CURRENT_POLICY_STEP, currentPolicyStep } from "@/data/policyTimeline";
import PillarPicker from "@/components/feedback/PillarPicker";
import PillarIntro from "@/components/feedback/PillarIntro";
import RecommendationCard, {
  answerHasContent,
  emptyAnswer,
  type Answer,
} from "@/components/feedback/RecommendationCard";
import GeneralComments, {
  entryHasContent,
  newEntry,
  type Entry,
} from "@/components/feedback/GeneralComments";
import { useRecaptcha } from "@/components/feedback/useRecaptcha";
import { fieldClass } from "@/components/feedback/styles";

/** Recommendations grouped by pillar, keeping the canonical ids from the data
 *  module so a stored answer always points at the same recommendation. */
const ACTIONS_BY_PILLAR = new Map<number, Action[]>(
  PILLARS.map((p) => [p.id, ALL_ACTIONS.filter((a) => a.pillarId === p.id)]),
);

type Step =
  | { kind: "pillar"; pillarId: number }
  | { kind: "action"; pillarId: number; action: Action };

type Stage = "pick" | "review" | "general" | "done";

type Answers = Record<string, Answer>;

const DRAFT_KEY = "jaia-feedback-draft-v1";

type Draft = {
  v: 1;
  stage: Stage;
  selected: number[];
  stepIndex: number;
  answers: Answers;
  entries: { topics: string[]; message: string }[];
  respondentType: string;
  orgName: string;
  personName: string;
};

/** `siteKey` is the reCAPTCHA v2 site key, read from the environment at request
 *  time by the page (a Server Component) so the same build can be deployed with
 *  a different key. Undefined leaves the widget off. */
export default function FeedbackQuiz({ siteKey }: { siteKey?: string }) {
  const [stage, setStage] = useState<Stage>("pick");
  const [selected, setSelected] = useState<number[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [entries, setEntries] = useState<Entry[]>(() => [newEntry()]);
  const [respondentType, setRespondentType] = useState<string>(
    RESPONDENT_TYPES[0],
  );
  const [orgName, setOrgName] = useState("");
  const [personName, setPersonName] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [summary, setSummary] = useState({ ratings: 0, comments: 0 });

  const hydrated = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);
  const {
    wrapRef: captchaRef,
    active: captchaActive,
    token: captchaToken,
    reset: resetCaptcha,
  } = useRecaptcha(siteKey, stage === "general");

  const steps = useMemo<Step[]>(() => {
    const out: Step[] = [];
    for (const id of selected) {
      out.push({ kind: "pillar", pillarId: id });
      for (const action of ACTIONS_BY_PILLAR.get(id) ?? []) {
        out.push({ kind: "action", pillarId: id, action });
      }
    }
    return out;
  }, [selected]);

  const actionSteps = useMemo(
    () => steps.filter((s): s is Extract<Step, { kind: "action" }> => s.kind === "action"),
    [steps],
  );

  // --- draft persistence ---------------------------------------------------
  // A full review is a long sit, so the in-progress answers survive a reload.
  // The server can't see localStorage, so restoring a draft has to happen
  // after mount; React batches these into one render, which is what the
  // set-state-in-effect rule is guarding against.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        if (d?.v === 1 && d.stage !== "done") {
          // A draft is only as trustworthy as the storage it came from, so the
          // pillar ids and position are re-checked against the current policy.
          const ids = (Array.isArray(d.selected) ? d.selected : []).filter(
            (id) => PILLARS.some((p) => p.id === id),
          );
          const stepCount = ids.reduce(
            (n, id) => n + 1 + (ACTIONS_BY_PILLAR.get(id)?.length ?? 0),
            0,
          );
          const at = typeof d.stepIndex === "number" ? d.stepIndex : 0;
          setStage(d.stage === "review" && stepCount === 0 ? "pick" : d.stage);
          setSelected(ids);
          setStepIndex(Math.min(Math.max(at, 0), Math.max(stepCount - 1, 0)));
          setAnswers(d.answers ?? {});
          setRespondentType(d.respondentType ?? RESPONDENT_TYPES[0]);
          setOrgName(d.orgName ?? "");
          setPersonName(d.personName ?? "");
          // Re-key the entries so ids stay unique against this session's counter.
          const list = (d.entries ?? []).map((e) => ({
            ...newEntry(),
            topics: e.topics ?? [],
            message: e.message ?? "",
          }));
          setEntries(list.length > 0 ? list : [newEntry()]);
          if (d.stage !== "pick") setRestored(true);
        }
      }
    } catch {
      // A corrupt or unavailable draft is not worth surfacing — start fresh.
    }
    hydrated.current = true;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated.current) return;
    if (stage === "done") {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      return;
    }
    const draft: Draft = {
      v: 1,
      stage,
      selected,
      stepIndex,
      answers,
      entries: entries.map((e) => ({ topics: e.topics, message: e.message })),
      respondentType,
      orgName,
      personName,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [stage, selected, stepIndex, answers, entries, respondentType, orgName, personName]);

  function startOver() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setStage("pick");
    setSelected([]);
    setStepIndex(0);
    setAnswers({});
    setEntries([newEntry()]);
    setRespondentType(RESPONDENT_TYPES[0]);
    setOrgName("");
    setPersonName("");
    setRestored(false);
    setStatus("idle");
    setError(null);
    resetCaptcha();
  }

  // --- navigation ----------------------------------------------------------
  const scrollToTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const goTo = useCallback(
    (i: number) => {
      if (i >= steps.length) {
        setStage("general");
      } else if (i < 0) {
        setStage("pick");
      } else {
        setStepIndex(i);
      }
      scrollToTop();
    },
    [steps.length, scrollToTop],
  );

  const step = steps[stepIndex];

  const patchAnswer = useCallback((id: string, patch: Partial<Answer>) => {
    setAnswers((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyAnswer()), ...patch },
    }));
  }, []);

  const skipCurrent = useCallback(() => {
    if (step?.kind === "action") {
      patchAnswer(step.action.id, { support: null, skipped: true });
    }
    goTo(stepIndex + 1);
  }, [step, stepIndex, patchAnswer, goTo]);

  // Keyboard shortcuts make a 43-card review far less of a chore. They stay
  // out of the way while the respondent is typing a comment.
  useEffect(() => {
    if (stage !== "review" || step?.kind !== "action") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const typing =
        tag === "TEXTAREA" ||
        tag === "INPUT" ||
        tag === "SELECT" ||
        el?.isContentEditable;

      if (e.key === "Enter" && !typing) {
        e.preventDefault();
        goTo(stepIndex + 1);
        return;
      }
      if (typing) return;

      const numbered = SUPPORT_LEVELS[Number(e.key) - 1];
      if (e.key >= "1" && e.key <= "5" && numbered) {
        e.preventDefault();
        patchAnswer(step.action.id, { support: numbered.value, skipped: false });
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        skipCurrent();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goTo(stepIndex + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(stepIndex - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, step, stepIndex, goTo, patchAnswer, skipCurrent]);

  // --- what's actually being submitted -------------------------------------
  const ratingsPayload = useMemo(
    () =>
      actionSteps
        .map((s) => ({ id: s.action.id, a: answers[s.action.id] }))
        .filter(({ a }) => a && (answerHasContent(a) || a.skipped))
        .map(({ id, a }) => ({
          actionId: id,
          support: a!.support,
          comment: a!.comment.trim(),
          skipped: a!.skipped && !a!.support,
        })),
    [actionSteps, answers],
  );

  const rated = ratingsPayload.filter((r) => r.support).length;
  const ratingComments = ratingsPayload.filter((r) => r.comment).length;
  const answeredSoFar = actionSteps.filter(
    (s) => answerHasContent(answers[s.action.id]) || answers[s.action.id]?.skipped,
  ).length;

  const isOrganisation = respondentType === ORGANISATION_TYPE;

  const contentEntries = entries.filter(entryHasContent);
  const entriesValid = contentEntries.every((e) => e.topics.length > 0);
  const hasSubstance =
    ratingsPayload.some((r) => r.support || r.comment) || contentEntries.length > 0;

  const canSubmit =
    FEEDBACK_SUBMISSIONS_OPEN && entriesValid && hasSubstance && status !== "sending";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    if (captchaActive && !captchaToken()) {
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
          respondentType,
          orgName: isOrganisation ? orgName : "",
          personName: isOrganisation ? personName : "",
          ratings: ratingsPayload,
          entries: contentEntries.map((en) => ({
            topics: en.topics,
            message: en.message,
          })),
          recaptchaToken: captchaToken(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }
      setSummary({
        ratings: rated,
        comments: ratingComments + contentEntries.length,
      });
      setStatus("idle");
      setStage("done");
      scrollToTop();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
      resetCaptcha();
    }
  }

  // --- render --------------------------------------------------------------
  if (stage === "done") {
    return (
      <div ref={topRef} className="scroll-mt-24 rounded-xl border border-jm-green-soft/40 bg-jm-green/10 p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-jm-green text-jm-black">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold tracking-tight">
          Thank you for your feedback
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-jm-muted">
          {summary.ratings > 0 && (
            <>
              You rated {summary.ratings} recommendation
              {summary.ratings === 1 ? "" : "s"}
              {summary.comments > 0 ? " and left " : ". "}
            </>
          )}
          {summary.comments > 0 && (
            <>
              {summary.ratings > 0 ? "" : "You left "}
              {summary.comments} comment{summary.comments === 1 ? "" : "s"}.{" "}
            </>
          )}
          It&apos;s all recorded against Step {CURRENT_POLICY_STEP} —{" "}
          {currentPolicyStep.title}. Public input shapes how Jamaica&apos;s A.I.
          policy is understood and improved.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={startOver}
            className="rounded-md border border-jm-line px-4 py-2 text-sm text-jm-muted transition-colors hover:border-jm-gold/40 hover:text-jm-text"
          >
            Review another area
          </button>
          <Link
            href="/explore"
            className="rounded-md border border-jm-line px-4 py-2 text-sm text-jm-muted transition-colors hover:border-jm-gold/40 hover:text-jm-text"
          >
            Back to the policy
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
      {restored && stage !== "pick" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-jm-line bg-jm-black/40 px-4 py-3 text-xs text-jm-muted">
          <span>We picked up where you left off — your answers were saved on this device.</span>
          <button
            type="button"
            onClick={startOver}
            className="rounded-md underline decoration-jm-line underline-offset-4 transition-colors hover:text-jm-text"
          >
            Start over
          </button>
        </div>
      )}

      {(stage === "pick" || (stage === "review" && !step)) && (
        <PillarPicker
          selected={selected}
          onChange={setSelected}
          onStart={(ids) => {
            setSelected(ids);
            setStepIndex(0);
            setStage("review");
            scrollToTop();
          }}
          onSkip={() => {
            setSelected([]);
            setStage("general");
            scrollToTop();
          }}
        />
      )}

      {stage === "review" && step && (
        <div>
          <ReviewProgress
            answered={answeredSoFar}
            total={actionSteps.length}
            position={
              step.kind === "action"
                ? actionSteps.findIndex((s) => s.action.id === step.action.id) + 1
                : 0
            }
            pillarTitle={getPillar(step.pillarId).short}
            onFinishEarly={() => {
              setStage("general");
              scrollToTop();
            }}
          />

          {step.kind === "pillar" ? (
            <PillarIntro pillar={getPillar(step.pillarId)} />
          ) : (
            <RecommendationCard
              key={step.action.id}
              pillar={getPillar(step.pillarId)}
              text={step.action.text}
              horizon={step.action.horizon}
              answer={answers[step.action.id] ?? emptyAnswer()}
              onChange={(patch) => patchAnswer(step.action.id, patch)}
            />
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => goTo(stepIndex - 1)}
              className="inline-flex items-center gap-2 rounded-md border border-jm-line px-4 py-2.5 text-sm text-jm-muted transition-colors hover:border-jm-gold/40 hover:text-jm-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M19 12H5M11 18l-6-6 6-6" />
              </svg>
              Back
            </button>

            <div className="flex items-center gap-3">
              {step.kind === "action" && (
                <button
                  type="button"
                  onClick={skipCurrent}
                  className="rounded-md px-3 py-2.5 text-sm text-jm-muted transition-colors hover:text-jm-text"
                >
                  Skip
                </button>
              )}
              <button
                type="button"
                onClick={() => goTo(stepIndex + 1)}
                className="inline-flex items-center gap-2 rounded-md bg-jm-gold px-5 py-2.5 text-sm font-semibold text-jm-black transition-colors hover:bg-jm-gold-soft"
              >
                {step.kind === "pillar"
                  ? "Start this pillar"
                  : stepIndex === steps.length - 1
                    ? "Finish"
                    : "Next"}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === "general" && (
        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-jm-line bg-jm-ink p-6 sm:p-8"
        >
          <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
            Anything else you want to say?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-jm-muted">
            This is the open part — raise anything the recommendations
            didn&apos;t cover, in your own words. Leave it blank if
            you&apos;ve said your piece.
          </p>

          {selected.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setStage("pick");
                scrollToTop();
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-md text-sm text-jm-muted underline decoration-jm-line underline-offset-4 transition-colors hover:text-jm-text"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M19 12H5M11 18l-6-6 6-6" />
              </svg>
              Rate the recommendations one by one instead
            </button>
          )}

          {ratingsPayload.length > 0 && (
            <div className="mt-6 rounded-lg border border-jm-line bg-jm-black/40 px-4 py-3.5 text-sm text-jm-muted">
              <p>
                <span className="text-jm-text">Your review so far:</span> {rated}{" "}
                recommendation{rated === 1 ? "" : "s"} rated
                {ratingComments > 0 &&
                  `, ${ratingComments} with a comment`}
                {ratingsPayload.length - rated > 0 &&
                  `, ${ratingsPayload.length - rated} skipped`}
                .
              </p>
              <button
                type="button"
                onClick={() => {
                  setStage("review");
                  scrollToTop();
                }}
                className="mt-1 rounded-md text-xs underline decoration-jm-line underline-offset-4 transition-colors hover:text-jm-text"
              >
                Back to the review
              </button>
            </div>
          )}

          <div className="mt-6">
            <label className="block sm:max-w-sm">
              <span className="text-sm text-jm-text">
                I&apos;m sharing this feedback as
              </span>
              <select
                value={respondentType}
                onChange={(e) => setRespondentType(e.target.value)}
                className={`mt-2 ${fieldClass}`}
              >
                {RESPONDENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            {isOrganisation ? (
              <div className="fade-up mt-4 rounded-xl border border-jm-line bg-jm-black/40 p-5">
                <p className="text-sm text-jm-text">
                  Who should this be attributed to?
                </p>
                <p className="mt-1 text-xs leading-relaxed text-jm-muted">
                  Both fields are optional — leave them blank and your
                  submission stays anonymous.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm text-jm-text">
                      Organisation name
                    </span>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      maxLength={FEEDBACK_LIMITS.name}
                      autoComplete="organization"
                      placeholder="e.g. Jamaica Chamber of Commerce"
                      className={`mt-2 ${fieldClass}`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-jm-text">Your name</span>
                    <input
                      type="text"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      maxLength={FEEDBACK_LIMITS.name}
                      autoComplete="name"
                      placeholder="Who is filling this in"
                      className={`mt-2 ${fieldClass}`}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-jm-muted sm:max-w-sm">
                No personal details are collected — your feedback is submitted
                anonymously.
              </p>
            )}
          </div>

          <div className="mt-8 border-t border-jm-line pt-6">
            <p className="text-sm text-jm-text">General comments</p>
            <p className="mt-1 text-xs leading-relaxed text-jm-muted">
              Add as many separate comments as you like — each one can cover
              several topic areas. All of them are recorded against Step{" "}
              {CURRENT_POLICY_STEP} ({currentPolicyStep.title}) of the policy
              timeline.
            </p>
          </div>

          <div className="mt-5">
            <GeneralComments entries={entries} onChange={setEntries} />
          </div>

          {captchaActive && (
            <div className="mt-6">
              <span className="text-sm text-jm-text">Verification</span>
              <div ref={captchaRef} className="recaptcha-frame mt-2" />
            </div>
          )}

          {status === "error" && error && (
            <p className="mt-4 text-sm text-jm-gold-soft">{error}</p>
          )}

          {!hasSubstance && (
            <p className="mt-4 text-sm text-jm-muted">
              Rate at least one recommendation or leave a comment before
              submitting.
            </p>
          )}

          {!FEEDBACK_SUBMISSIONS_OPEN && (
            <p className="mt-6 rounded-lg border border-jm-line bg-jm-black/40 px-4 py-3 text-sm text-jm-muted">
              Submissions aren&apos;t open just yet — this form is here so you
              can see what will be asked. Please check back shortly.
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-sm text-xs text-jm-muted">
              Your feedback is stored privately and used to improve the policy
              and this resource.
            </p>
            <button
              type="submit"
              disabled={!canSubmit}
              className="shrink-0 rounded-md bg-jm-gold px-5 py-2.5 text-sm font-semibold text-jm-black transition-colors hover:bg-jm-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              {!FEEDBACK_SUBMISSIONS_OPEN
                ? "Feedback opens soon"
                : status === "sending"
                  ? "Sending…"
                  : "Submit feedback"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Sticky-feeling progress strip shown above every card in the review. */
function ReviewProgress({
  answered,
  total,
  position,
  pillarTitle,
  onFinishEarly,
}: {
  answered: number;
  total: number;
  position: number;
  pillarTitle: string;
  onFinishEarly: () => void;
}) {
  const pct = total === 0 ? 0 : Math.round((answered / total) * 100);
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs text-jm-muted">
        <span>
          {position > 0 ? (
            <>
              <span className="text-jm-text">
                Recommendation {position} of {total}
              </span>{" "}
              · {pillarTitle}
            </>
          ) : (
            <span className="text-jm-text">{pillarTitle}</span>
          )}
        </span>
        <button
          type="button"
          onClick={onFinishEarly}
          className="rounded-md underline decoration-jm-line underline-offset-4 transition-colors hover:text-jm-text"
        >
          Finish early &amp; submit
        </button>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-jm-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
        aria-label="Review progress"
      >
        <div
          className="h-full rounded-full bg-jm-gold transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
