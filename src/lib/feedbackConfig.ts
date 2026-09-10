import "server-only";

/**
 * The master switch for accepting feedback.
 *
 * This is the one setting most likely to be flipped by someone who is not a
 * developer, at a moment that isn't convenient — a consultation opens when a
 * minister says it opens, and closes when the window ends. Reading it from the
 * environment means that is a restart, not a rebuild and a redeploy.
 *
 * Server-only on purpose. The flag reaches the form as a prop from the feedback
 * page, exactly as the reCAPTCHA site key does: a `NEXT_PUBLIC_*` read would be
 * inlined into the client bundle at build time and pin the setting to the image.
 */

/** Closed unless the environment says otherwise. A deployment that has never
 *  heard of this variable — a fresh environment, a forgotten value in a
 *  migration — must not accidentally open a public consultation. */
const DEFAULT_OPEN = false;

const TRUE = new Set(["true", "1", "yes", "on", "open"]);
const FALSE = new Set(["false", "0", "no", "off", "closed"]);

let warnedUnparseable = false;

/**
 * Whether the form accepts submissions right now.
 *
 * While this is false the form still renders — so people can read what will be
 * asked — but the submit button is disabled, the reCAPTCHA widget never mounts,
 * and `/api/feedback` rejects posts with a 503. The API check is the one that
 * matters: the disabled button is a courtesy, not a control.
 */
export function feedbackSubmissionsOpen(): boolean {
  const raw = process.env.FEEDBACK_SUBMISSIONS_OPEN?.trim().toLowerCase();
  if (!raw) return DEFAULT_OPEN;
  if (TRUE.has(raw)) return true;
  if (FALSE.has(raw)) return false;

  // A typo here would otherwise silently decide whether a national consultation
  // is open, so say so — once — and fall back to the safe answer.
  if (!warnedUnparseable) {
    warnedUnparseable = true;
    console.warn(
      `FEEDBACK_SUBMISSIONS_OPEN is set to "${raw}", which isn't a yes or a no ` +
        `— treating feedback as ${DEFAULT_OPEN ? "open" : "closed"}. ` +
        `Use true or false.`,
    );
  }
  return DEFAULT_OPEN;
}
