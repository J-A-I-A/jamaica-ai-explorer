import { randomUUID } from "crypto";
import { isIP } from "net";
import {
  AGE_RANGES,
  AI_FAMILIARITY_LEVELS,
  EMPLOYMENT_STATUSES,
  FEEDBACK_TOPICS,
  FEEDBACK_LIMITS as LIMITS,
  INDUSTRY_SECTORS,
  MAX_FEEDBACK_ENTRIES,
  MAX_FEEDBACK_RATINGS,
  ORGANISATION_TYPE,
  ORGANISATION_TYPES,
  RESPONDENT_TYPES,
  SUPPORT_BY_VALUE,
} from "@/data/feedback";
import { ALL_ACTIONS, getPillar } from "@/data/recommendations";
import { CURRENT_POLICY_STEP, currentPolicyStep } from "@/data/policyTimeline";
import {
  isDatabaseConfigured,
  saveFeedback,
  type FeedbackRatingRecord,
} from "@/lib/db";
import { feedbackSubmissionsOpen } from "@/lib/feedbackConfig";
import {
  checkRateLimit,
  clientKey,
  describeWait,
  numberFromEnv,
  rateLimitHeaders,
  recordHit,
} from "@/lib/rateLimit";

// Needs the Node.js runtime for `pg` and `crypto`.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recommendations keyed by id, so a posted rating can only ever refer to a
 *  recommendation that actually exists in the policy. */
const ACTIONS_BY_ID = new Map(ALL_ACTIONS.map((a) => [a.id, a]));

// --- rate limiting ----------------------------------------------------------

/** How many submissions one address can send in a rolling window.
 *  FEEDBACK_RATE_LIMIT=0 turns the limit off entirely; an unset or blank value
 *  keeps the default. The default is deliberately generous, because a whole
 *  office, campus or ISP can share one address in a public consultation — it is
 *  here to stop a script flooding the consultation, not to ration honest
 *  respondents, who are also held to the reCAPTCHA check. */
const RATE_LIMIT = numberFromEnv(process.env.FEEDBACK_RATE_LIMIT, 10);
const RATE_WINDOW_HOURS =
  numberFromEnv(process.env.FEEDBACK_RATE_WINDOW_HOURS, 1) || 1;
const RATE_WINDOW_MS = RATE_WINDOW_HOURS * 60 * 60 * 1000;
const RATE_LIMITED = RATE_LIMIT > 0;

/** "per hour" / "per 6 hours", for the limit message. */
const RATE_WINDOW_LABEL =
  RATE_WINDOW_HOURS === 1 ? "per hour" : `per ${RATE_WINDOW_HOURS} hours`;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Single-choice profile answers are only ever stored when they match one of
 *  the options the form offered; anything else (including a blank "prefer not
 *  to say") becomes NULL, so the columns stay analysable. */
function choice(v: unknown, allowed: readonly string[]): string | null {
  const value = str(v, LIMITS.choice);
  return allowed.includes(value) ? value : null;
}

/** Keep only known topics, de-duplicated and in the canonical order. */
function normaliseTopics(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : [raw];
  const picked = new Set(values.map((v) => str(v, 80)));
  const topics = FEEDBACK_TOPICS.filter((t) => picked.has(t));
  return topics.length > 0 ? topics : ["General"];
}

// --- reCAPTCHA v2 verification ---------------------------------------------

/** Outside development a missing secret is a deployment fault, not a reason to
 *  accept unverified submissions: the form would take bot traffic with nothing
 *  in the logs to say so. Development still runs without one, loudly. */
const RECAPTCHA_REQUIRED = process.env.NODE_ENV === "production";

let warnedNoSecret = false;

/** The one endpoint this route ever talks to. A fixed constant: no part of a
 *  request contributes to the URL, so a posted value can't redirect the call at
 *  an internal host. */
const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

/** Google's tokens are URL-safe base64. Kept deliberately wide — the token only
 *  ever goes into a form-encoded body, so this is a sanity check, and anything
 *  narrower risks turning a real token into a submission the user can't send. */
const RECAPTCHA_TOKEN = /^[A-Za-z0-9._~=-]{20,4000}$/;

async function verifyRecaptcha(token: string, remoteIp?: string) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    if (RECAPTCHA_REQUIRED) {
      console.error(
        "RECAPTCHA_SECRET_KEY is not set — refusing feedback submissions. " +
          "Set it in the runtime environment to accept feedback.",
      );
      return {
        ok: false as const,
        status: 503,
        error: "Feedback isn't available right now. Please try again later.",
      };
    }
    if (!warnedNoSecret) {
      warnedNoSecret = true;
      console.warn(
        "RECAPTCHA_SECRET_KEY is not set — submissions are accepted without " +
          "bot protection. This is allowed in development only.",
      );
    }
    return { ok: true as const };
  }

  if (!RECAPTCHA_TOKEN.test(token)) {
    return {
      ok: false as const,
      status: 400,
      error: "Please complete the reCAPTCHA challenge.",
    };
  }
  try {
    const params = new URLSearchParams({ secret, response: token });
    // `remoteip` is an optional hint to Google; a proxy header we don't control
    // only goes along when it is genuinely an IP.
    if (remoteIp && isIP(remoteIp)) params.set("remoteip", remoteIp);
    const res = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const data = (await res.json()) as { success?: boolean };
    if (!data.success) {
      return {
        ok: false as const,
        status: 400,
        error: "reCAPTCHA verification failed. Please try again.",
      };
    }
    return { ok: true as const };
  } catch (err) {
    console.error("reCAPTCHA verify error:", err);
    return {
      ok: false as const,
      status: 502,
      error: "Couldn't verify reCAPTCHA. Please try again.",
    };
  }
}

export async function POST(req: Request) {
  // Checked before the body is read, so a flood costs this process almost
  // nothing. A slot is only spent further down, once a submission is complete
  // enough to be worth a reCAPTCHA call and a database write — a respondent
  // who trips a validation error keeps their full budget.
  const limitKey = clientKey(req, "feedback");
  if (RATE_LIMITED) {
    const state = checkRateLimit(limitKey, RATE_LIMIT, RATE_WINDOW_MS);
    if (!state.allowed) {
      return Response.json(
        {
          error: `You've reached the limit of ${RATE_LIMIT} submissions ${RATE_WINDOW_LABEL}. Please try again ${describeWait(state.retryAfterSeconds)}.`,
        },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders(state),
            "Retry-After": String(state.retryAfterSeconds),
          },
        },
      );
    }
  }

  if (!feedbackSubmissionsOpen()) {
    return Response.json(
      { error: "Feedback isn't open just yet. Please check back shortly." },
      { status: 503 },
    );
  }

  // Checked before the body is even read, so a 503 here is the truth: with no
  // database configured there is nowhere to put a submission, and nothing the
  // respondent sent is retained.
  if (!isDatabaseConfigured()) {
    console.error(
      "POSTGRES_URL is not configured — rejecting feedback submission.",
    );
    return Response.json(
      { error: "Feedback storage isn't configured. Please try again later." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  // A submission carries per-recommendation ratings from the guided review,
  // open-ended comments, or both. Older single-entry payloads (`topic` +
  // `message`) are still accepted.
  const rawEntries: unknown[] = Array.isArray(b.entries)
    ? b.entries
    : b.entries === undefined && (b.message !== undefined || b.topic !== undefined)
      ? [{ topics: b.topics ?? b.topic, message: b.message }]
      : [];

  if (rawEntries.length > MAX_FEEDBACK_ENTRIES) {
    return Response.json(
      { error: `Please send at most ${MAX_FEEDBACK_ENTRIES} comments at a time.` },
      { status: 400 },
    );
  }

  const parsed = rawEntries
    .map((raw) => {
      const e = (raw ?? {}) as Record<string, unknown>;
      return {
        topics: normaliseTopics(e.topics ?? e.topic),
        message: str(e.message, LIMITS.message),
      };
    })
    .filter((e) => e.message.length >= 2);

  const rawRatings: unknown[] = Array.isArray(b.ratings) ? b.ratings : [];
  if (rawRatings.length > MAX_FEEDBACK_RATINGS) {
    return Response.json(
      { error: "That's more ratings than there are recommendations." },
      { status: 400 },
    );
  }

  // One rating per recommendation; unknown ids and empty skips are dropped.
  const seen = new Set<string>();
  const ratings = rawRatings
    .map((raw) => {
      const r = (raw ?? {}) as Record<string, unknown>;
      const action = ACTIONS_BY_ID.get(str(r.actionId, 60));
      if (!action || seen.has(action.id)) return null;

      const level = SUPPORT_BY_VALUE.get(str(r.support, 40));
      const comment = str(r.comment, LIMITS.comment);
      const skipped = !level;
      // A skip with nothing attached still counts — it records that the
      // respondent saw the recommendation and chose not to answer.
      if (!level && !comment && r.skipped !== true) return null;

      seen.add(action.id);
      return { action, level, comment, skipped };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const hasSubstance =
    parsed.length > 0 || ratings.some((r) => r.level || r.comment);
  if (!hasSubstance) {
    return Response.json(
      { error: "Please rate a recommendation or leave a comment before submitting." },
      { status: 400 },
    );
  }

  const rawType = str(b.respondentType, 80);
  const respondentType = (RESPONDENT_TYPES as readonly string[]).includes(
    rawType,
  )
    ? rawType
    : RESPONDENT_TYPES[0];

  // An organisation must name itself; an individual may stay anonymous, and
  // the fields belonging to the other respondent type are dropped rather than
  // stored, even if a client posts them.
  const isOrg = respondentType === ORGANISATION_TYPE;
  const orgName = isOrg ? str(b.orgName, LIMITS.name) : "";
  if (isOrg && !orgName) {
    return Response.json(
      { error: "Please give the name of the organisation you're responding for." },
      { status: 400 },
    );
  }
  const personName = str(b.personName, LIMITS.name) || null;

  const ageRange = isOrg ? null : choice(b.ageRange, AGE_RANGES);
  const employmentStatus = isOrg
    ? null
    : choice(b.employmentStatus, EMPLOYMENT_STATUSES);
  const aiFamiliarity = isOrg
    ? null
    : choice(b.aiFamiliarity, AI_FAMILIARITY_LEVELS);
  const orgType = isOrg ? choice(b.orgType, ORGANISATION_TYPES) : null;
  const industry = isOrg ? choice(b.industry, INDUSTRY_SECTORS) : null;

  // The payload is well-formed and about to cost an outbound reCAPTCHA call and
  // a database write, so this is where a slot is spent — charged whether or not
  // the token turns out to be valid, so a bot posting junk tokens can't keep
  // Google's siteverify endpoint busy for free.
  const limit = RATE_LIMITED
    ? recordHit(limitKey, RATE_LIMIT, RATE_WINDOW_MS)
    : null;
  const limitHeaders = limit ? rateLimitHeaders(limit) : undefined;

  // Verify reCAPTCHA before doing anything else.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const captcha = await verifyRecaptcha(str(b.recaptchaToken, 4000), ip);
  if (!captcha.ok) {
    return Response.json(
      { error: captcha.error },
      { status: captcha.status, headers: limitHeaders },
    );
  }

  // One record per piece of feedback, tied together by a submission id so a
  // multi-part response can be reassembled, and stamped with the policy stage
  // it was given at.
  const submissionId = randomUUID();
  const createdAt = new Date().toISOString();
  const stamp = {
    submissionId,
    createdAt,
    respondentType,
    orgName: orgName || null,
    personName,
    ageRange,
    employmentStatus,
    aiFamiliarity,
    orgType,
    industry,
    policyStep: CURRENT_POLICY_STEP,
    policyStage: currentPolicyStep.title,
  };

  const entries = parsed.map((e, i) => ({
    id: randomUUID(),
    ...stamp,
    entryIndex: i + 1,
    entryCount: parsed.length,
    // `topic` stays a single string for a simple flat column alongside `topics`.
    topic: e.topics.join(", "),
    topics: e.topics,
    message: e.message,
  }));

  const ratingRecords: FeedbackRatingRecord[] = ratings.map((r) => ({
    id: randomUUID(),
    ...stamp,
    pillarId: r.action.pillarId,
    pillarTitle: getPillar(r.action.pillarId).title,
    actionId: r.action.id,
    actionHorizon: r.action.horizon,
    actionText: r.action.text,
    support: r.level?.value ?? null,
    supportScore: r.level?.score ?? null,
    skipped: r.skipped,
    comment: r.comment,
  }));

  // Postgres is the only place a submission is ever written — there is no
  // local file fallback, so nothing a respondent types is persisted in
  // plaintext on the container's filesystem. The whole submission goes in one
  // transaction; if that fails, nothing was stored, so ask the user to retry.
  try {
    await saveFeedback({ entries, ratings: ratingRecords });
  } catch (err) {
    console.error("Failed to save feedback to Postgres:", err);
    return Response.json(
      { error: "We couldn't save your feedback right now. Please try again." },
      { status: 502, headers: limitHeaders },
    );
  }

  return Response.json(
    {
      ok: true,
      entries: entries.length,
      ratings: ratingRecords.length,
      // Kept for older clients that read `count`.
      count: entries.length + ratingRecords.length,
    },
    { headers: limitHeaders },
  );
}
