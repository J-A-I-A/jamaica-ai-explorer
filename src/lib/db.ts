import "server-only";
import { Pool } from "pg";

/**
 * Postgres access for the feedback intake route.
 *
 * Connection details come from three environment variables so the URL can be
 * committed to a platform's config while the credentials are held separately:
 *
 *   POSTGRES_URL       postgres://host:5432/database  (user/password optional)
 *   POSTGRES_USER      overrides any user embedded in the URL
 *   POSTGRES_PASSWORD  overrides any password embedded in the URL
 *
 * The pool is created lazily and cached on globalThis so Next.js dev-server
 * hot reloads don't leak a new pool on every recompile.
 */

/** One open-ended, topic-tagged comment. */
export type FeedbackRecord = {
  id: string;
  submissionId: string;
  entryIndex: number;
  entryCount: number;
  createdAt: string;
  respondentType: string;
  /** Optional attribution. An organisation always names itself; an individual
   *  may leave every one of these blank. */
  orgName: string | null;
  personName: string | null;
  /** Individual respondents only — null for an organisation. */
  ageRange: string | null;
  employmentStatus: string | null;
  aiFamiliarity: string | null;
  /** Organisation respondents only — null for an individual. */
  orgType: string | null;
  industry: string | null;
  topic: string;
  topics: string[];
  message: string;
  policyStep: number;
  policyStage: string;
};

/** One respondent's verdict on a single recommendation from the guided review.
 *  A skipped recommendation is stored too — knowing what people declined to
 *  answer is signal, and it separates "skipped" from "never shown". */
export type FeedbackRatingRecord = {
  id: string;
  submissionId: string;
  createdAt: string;
  respondentType: string;
  /** Optional attribution. An organisation always names itself; an individual
   *  may leave every one of these blank. */
  orgName: string | null;
  personName: string | null;
  /** Individual respondents only — null for an organisation. */
  ageRange: string | null;
  employmentStatus: string | null;
  aiFamiliarity: string | null;
  /** Organisation respondents only — null for an individual. */
  orgType: string | null;
  industry: string | null;
  pillarId: number;
  pillarTitle: string;
  actionId: string;
  actionHorizon: string;
  actionText: string;
  /** Scale key, or null when the recommendation was skipped. */
  support: string | null;
  /** 1-5 matching `support`, or null when skipped. */
  supportScore: number | null;
  skipped: boolean;
  comment: string;
  policyStep: number;
  policyStage: string;
};

/** True when a database URL is configured; the route degrades when it isn't. */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.POSTGRES_URL);
}

/**
 * Managed Postgres (Neon, Supabase, Azure, RDS) requires TLS; a local server
 * usually doesn't have it. Default by host, with POSTGRES_SSL as the override:
 * `disable` turns it off, `no-verify` keeps TLS but skips certificate
 * validation (needed for providers that serve a self-signed chain).
 */
function sslConfig(url: string) {
  const mode = process.env.POSTGRES_SSL?.trim().toLowerCase();
  if (mode === "disable" || mode === "false") return false;
  if (mode === "no-verify") return { rejectUnauthorized: false };

  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // Unparseable URL — let pg surface the error, and assume TLS.
  }
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (isLocal) return false;
  return mode === "verify-full" ? true : { rejectUnauthorized: false };
}

const globalForPg = globalThis as unknown as { jaiaPgPool?: Pool };

function getPool(): Pool {
  if (globalForPg.jaiaPgPool) return globalForPg.jaiaPgPool;

  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL is not configured.");
  }

  const pool = new Pool({
    connectionString,
    // Explicit credentials win over anything embedded in the URL.
    user: process.env.POSTGRES_USER || undefined,
    password: process.env.POSTGRES_PASSWORD || undefined,
    ssl: sslConfig(connectionString),
    // Serverless functions are short-lived and may run many in parallel, so
    // keep each instance's footprint small and don't hang on a dead host.
    max: Number(process.env.POSTGRES_POOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on("error", (err) => {
    console.error("Postgres idle client error:", err);
  });

  globalForPg.jaiaPgPool = pool;
  return pool;
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS feedback_entries (
    id              uuid PRIMARY KEY,
    submission_id   uuid        NOT NULL,
    entry_index     integer     NOT NULL,
    entry_count     integer     NOT NULL,
    created_at      timestamptz NOT NULL,
    respondent_type text        NOT NULL,
    org_name        text,
    person_name     text,
    age_range           text,
    employment_status   text,
    ai_familiarity      text,
    org_type            text,
    industry            text,
    topic           text        NOT NULL,
    topics          text[]      NOT NULL,
    message         text        NOT NULL,
    policy_step     integer     NOT NULL,
    policy_stage    text        NOT NULL,
    inserted_at     timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS feedback_entries_submission_id_idx
    ON feedback_entries (submission_id);
  CREATE INDEX IF NOT EXISTS feedback_entries_created_at_idx
    ON feedback_entries (created_at DESC);

  CREATE TABLE IF NOT EXISTS feedback_ratings (
    id              uuid PRIMARY KEY,
    submission_id   uuid        NOT NULL,
    created_at      timestamptz NOT NULL,
    respondent_type text        NOT NULL,
    org_name        text,
    person_name     text,
    age_range           text,
    employment_status   text,
    ai_familiarity      text,
    org_type            text,
    industry            text,
    pillar_id       integer     NOT NULL,
    pillar_title    text        NOT NULL,
    action_id       text        NOT NULL,
    action_horizon  text        NOT NULL,
    action_text     text        NOT NULL,
    support         text,
    support_score   integer,
    skipped         boolean     NOT NULL,
    comment         text        NOT NULL,
    policy_step     integer     NOT NULL,
    policy_stage    text        NOT NULL,
    inserted_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (submission_id, action_id)
  );
  CREATE INDEX IF NOT EXISTS feedback_ratings_submission_id_idx
    ON feedback_ratings (submission_id);
  CREATE INDEX IF NOT EXISTS feedback_ratings_action_id_idx
    ON feedback_ratings (action_id);
  CREATE INDEX IF NOT EXISTS feedback_ratings_created_at_idx
    ON feedback_ratings (created_at DESC);

  -- Respondent details, added after the first release: bring tables created by
  -- an earlier deploy up to the current shape.
  ALTER TABLE feedback_entries ADD COLUMN IF NOT EXISTS org_name          text;
  ALTER TABLE feedback_entries ADD COLUMN IF NOT EXISTS person_name       text;
  ALTER TABLE feedback_entries ADD COLUMN IF NOT EXISTS age_range         text;
  ALTER TABLE feedback_entries ADD COLUMN IF NOT EXISTS employment_status text;
  ALTER TABLE feedback_entries ADD COLUMN IF NOT EXISTS ai_familiarity    text;
  ALTER TABLE feedback_entries ADD COLUMN IF NOT EXISTS org_type          text;
  ALTER TABLE feedback_entries ADD COLUMN IF NOT EXISTS industry          text;
  ALTER TABLE feedback_ratings ADD COLUMN IF NOT EXISTS org_name          text;
  ALTER TABLE feedback_ratings ADD COLUMN IF NOT EXISTS person_name       text;
  ALTER TABLE feedback_ratings ADD COLUMN IF NOT EXISTS age_range         text;
  ALTER TABLE feedback_ratings ADD COLUMN IF NOT EXISTS employment_status text;
  ALTER TABLE feedback_ratings ADD COLUMN IF NOT EXISTS ai_familiarity    text;
  ALTER TABLE feedback_ratings ADD COLUMN IF NOT EXISTS org_type          text;
  ALTER TABLE feedback_ratings ADD COLUMN IF NOT EXISTS industry          text;
`;

let schemaReady: Promise<void> | null = null;

/** Create the table on first use. Runs once per process; retried on failure. */
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(CREATE_TABLE_SQL)
      .then(() => undefined)
      .catch((err) => {
        schemaReady = null; // don't cache a failure
        throw err;
      });
  }
  return schemaReady;
}

/**
 * Insert one whole submission — its recommendation ratings and its open-ended
 * comments — in a single transaction, so a multi-part response is stored whole
 * or not at all. Re-posting the same ids is a no-op, which makes a client
 * retry safe.
 */
export async function saveFeedback({
  entries = [],
  ratings = [],
}: {
  entries?: FeedbackRecord[];
  ratings?: FeedbackRatingRecord[];
}): Promise<void> {
  if (entries.length === 0 && ratings.length === 0) return;

  await ensureSchema();

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    for (const e of entries) {
      await client.query(
        `INSERT INTO feedback_entries (
           id, submission_id, entry_index, entry_count, created_at,
           respondent_type, org_name, person_name,
           age_range, employment_status, ai_familiarity, org_type, industry,
           topic, topics, message, policy_step, policy_stage
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                   $14, $15, $16, $17, $18)
         ON CONFLICT (id) DO NOTHING`,
        [
          e.id,
          e.submissionId,
          e.entryIndex,
          e.entryCount,
          e.createdAt,
          e.respondentType,
          e.orgName,
          e.personName,
          e.ageRange,
          e.employmentStatus,
          e.aiFamiliarity,
          e.orgType,
          e.industry,
          e.topic,
          e.topics,
          e.message,
          e.policyStep,
          e.policyStage,
        ],
      );
    }
    for (const r of ratings) {
      await client.query(
        `INSERT INTO feedback_ratings (
           id, submission_id, created_at, respondent_type, org_name, person_name,
           age_range, employment_status, ai_familiarity, org_type, industry,
           pillar_id, pillar_title, action_id, action_horizon, action_text,
           support, support_score, skipped, comment, policy_step, policy_stage
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                   $15, $16, $17, $18, $19, $20, $21, $22)
         ON CONFLICT (submission_id, action_id) DO NOTHING`,
        [
          r.id,
          r.submissionId,
          r.createdAt,
          r.respondentType,
          r.orgName,
          r.personName,
          r.ageRange,
          r.employmentStatus,
          r.aiFamiliarity,
          r.orgType,
          r.industry,
          r.pillarId,
          r.pillarTitle,
          r.actionId,
          r.actionHorizon,
          r.actionText,
          r.support,
          r.supportScore,
          r.skipped,
          r.comment,
          r.policyStep,
          r.policyStage,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
