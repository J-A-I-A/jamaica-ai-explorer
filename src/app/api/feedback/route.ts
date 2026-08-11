import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  FEEDBACK_TOPICS,
  FEEDBACK_LIMITS as LIMITS,
  MAX_FEEDBACK_ENTRIES,
} from "@/data/feedback";
import { CURRENT_POLICY_STEP, currentPolicyStep } from "@/data/policyTimeline";

// Needs the Node.js runtime to write to the filesystem.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

// --- Google Sheets delivery via an Apps Script Web App webhook ------------
async function sendToGoogleSheets(entry: Record<string, unknown>) {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!url) return { ok: true as const }; // not configured — skip

  try {
    const payload: Record<string, unknown> = { ...entry };
    if (process.env.GOOGLE_SHEETS_WEBHOOK_TOKEN) {
      payload.secret = process.env.GOOGLE_SHEETS_WEBHOOK_TOKEN;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });
    if (!res.ok) {
      console.error("Google Sheets webhook returned", res.status);
      return { ok: false as const };
    }
    return { ok: true as const };
  } catch (err) {
    console.error("Google Sheets webhook error:", err);
    return { ok: false as const };
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  // A submission carries one or more pieces of feedback. Older single-entry
  // payloads (`topic` + `message`) are still accepted.
  const rawEntries: unknown[] = Array.isArray(b.entries)
    ? b.entries
    : [{ topics: b.topics ?? b.topic, message: b.message }];

  if (rawEntries.length > MAX_FEEDBACK_ENTRIES) {
    return Response.json(
      { error: `Please send at most ${MAX_FEEDBACK_ENTRIES} pieces of feedback at a time.` },
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

  if (parsed.length === 0) {
    return Response.json(
      { error: "Please enter a message before submitting." },
      { status: 400 },
    );
  }

  const name = str(b.name, LIMITS.name);
  const organisation = str(b.organisation, LIMITS.organisation);
  const email = str(b.email, LIMITS.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      { error: "That email address doesn't look valid." },
      { status: 400 },
    );
  }

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
  const entries = parsed.map((e, i) => ({
    id: randomUUID(),
    submissionId,
    entryIndex: i + 1,
    entryCount: parsed.length,
    createdAt,
    name: name || null,
    organisation: organisation || null,
    email: email || null,
    // `topic` stays a single string so existing spreadsheet columns keep working.
    topic: e.topics.join(", "),
    topics: e.topics,
    message: e.message,
    policyStep: CURRENT_POLICY_STEP,
    policyStage: currentPolicyStep.title,
  }));

  // Local backup log (best-effort — never blocks the submission).
  try {
    const dir = path.join(process.cwd(), ".data");
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(
      path.join(dir, "feedback.jsonl"),
      entries.map((e) => JSON.stringify(e)).join("\n") + "\n",
      "utf8",
    );
  } catch (err) {
    console.error("Failed to write local feedback backup:", err);
  }

  // Deliver to Google Sheets, one row per entry. If configured but it fails,
  // tell the user to retry (the local backup above still captured everything).
  for (const entry of entries) {
    const sheet = await sendToGoogleSheets(entry);
    if (!sheet.ok) {
      return Response.json(
        { error: "We couldn't save your feedback right now. Please try again." },
        { status: 502 },
      );
    }
  }

  return Response.json({ ok: true, count: entries.length });
}
