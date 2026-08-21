import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  FEEDBACK_TOPICS,
  FEEDBACK_LIMITS as LIMITS,
  FEEDBACK_SUBMISSIONS_OPEN,
  MAX_FEEDBACK_ENTRIES,
  MAX_FEEDBACK_RATINGS,
  ORGANISATION_TYPE,
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

// Needs the Node.js runtime to write to the filesystem.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recommendations keyed by id, so a posted rating can only ever refer to a
 *  recommendation that actually exists in the policy. */
const ACTIONS_BY_ID = new Map(ALL_ACTIONS.map((a) => [a.id, a]));

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Keep only known topics, de-duplicated and in the canonical order. */
function normaliseTopics(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : [raw];
  const picked = new Set(values.map((v) => str(v, 80)));
  const topics = FEEDBACK_TOPICS.filter((t) => picked.has(t));
  return topics.length > 0 ? topics : ["General"];
}

// --- reCAPTCHA v2 verification (enforced only when a secret is configured) ---
async function verifyRecaptcha(token: string, remoteIp?: string) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return { ok: true as const }; // not configured — skip

  if (!token) {
    return { ok: false as const, error: "Please complete the reCAPTCHA challenge." };
  }
  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp) params.set("remoteip", remoteIp);
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const data = (await res.json()) as { success?: boolean };
    if (!data.success) {
      return { ok: false as const, error: "reCAPTCHA verification failed. Please try again." };
    }
    return { ok: true as const };
  } catch (err) {
    console.error("reCAPTCHA verify error:", err);
    return { ok: false as const, error: "Couldn't verify reCAPTCHA. Please try again." };
  }
}

export async function POST(req: Request) {
  if (!FEEDBACK_SUBMISSIONS_OPEN) {
    return Response.json(
      { error: "Feedback isn't open just yet. Please check back shortly." },
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

  // Attribution is optional and only meaningful for an organisation, so an
  // individual's submission can never carry a name even if one is posted.
  const isOrg = respondentType === ORGANISATION_TYPE;
  const orgName = isOrg ? str(b.orgName, LIMITS.name) || null : null;
  const personName = isOrg ? str(b.personName, LIMITS.name) || null : null;

  // Verify reCAPTCHA before doing anything else.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const captcha = await verifyRecaptcha(str(b.recaptchaToken, 4000), ip);
  if (!captcha.ok) {
    return Response.json({ error: captcha.error }, { status: 400 });
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
    orgName,
    personName,
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

  // Local backup log (best-effort — never blocks the submission).
  try {
    const dir = path.join(process.cwd(), ".data");
    await fs.mkdir(dir, { recursive: true });
    const lines = [
      ...entries.map((e) => JSON.stringify({ kind: "entry", ...e })),
      ...ratingRecords.map((r) => JSON.stringify({ kind: "rating", ...r })),
    ];
    await fs.appendFile(
      path.join(dir, "feedback.jsonl"),
      lines.join("\n") + "\n",
      "utf8",
    );
  } catch (err) {
    console.error("Failed to write local feedback backup:", err);
  }

  // Postgres is the system of record. The whole submission goes in one
  // transaction; if that fails, nothing was stored, so ask the user to retry.
  if (!isDatabaseConfigured()) {
    return Response.json(
      { error: "Feedback storage isn't configured. Please try again later." },
      { status: 503 },
    );
  }
  try {
    await saveFeedback({ entries, ratings: ratingRecords });
  } catch (err) {
    console.error("Failed to save feedback to Postgres:", err);
    return Response.json(
      { error: "We couldn't save your feedback right now. Please try again." },
      { status: 502 },
    );
  }

  return Response.json({
    ok: true,
    entries: entries.length,
    ratings: ratingRecords.length,
    // Kept for older clients that read `count`.
    count: entries.length + ratingRecords.length,
  });
}
