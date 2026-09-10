import "server-only";

/**
 * Loads the privacy policy from a Google Doc, exported as Markdown.
 *
 * The policy is the one piece of copy on this site that a lawyer or a
 * communications officer needs to change without a developer, a pull request or
 * a deploy. Keeping it in a Google Doc means they edit it where they already
 * work, and the site picks the change up on the next cache expiry.
 *
 * Google serves any doc that is shared "anyone with the link can view" as
 * Markdown from its export endpoint, so no API key, OAuth client or service
 * account is involved — which is the whole reason this is a plain `fetch` and
 * not the Google Docs API.
 */

/** The one endpoint this module ever talks to. Built from a fixed template with
 *  only a validated id interpolated, so a mistyped or hostile environment value
 *  can't redirect the fetch at another host — the same rule the reCAPTCHA
 *  verification in `/api/feedback` follows. */
const exportUrl = (id: string) =>
  `https://docs.google.com/document/d/${id}/export?format=md`;

/** Google document ids are URL-safe base64-ish and long. Anything that doesn't
 *  look like one is a configuration mistake worth failing loudly on rather than
 *  turning into a request. */
const DOC_ID = /^[A-Za-z0-9_-]{20,200}$/;

/** The id sits in the middle of a Docs URL. Pulling it out is what lets the
 *  environment hold the document's own URL — copied straight from the browser's
 *  address bar — rather than an id someone had to dig out of it. */
const ID_IN_URL = /\/document\/d\/([A-Za-z0-9_-]+)/;

/** The "Publish to the web" URL (`/document/d/e/2PACX-…/pub`) looks close
 *  enough to a share link to be pasted by mistake, but its id is a different
 *  thing and the export endpoint doesn't accept it. Caught by name so the log
 *  can say which link to use instead. */
const PUBLISHED_URL = /\/document\/d\/e\//;

/** Where a successful export is allowed to land. Google doesn't serve the body
 *  from docs.google.com: the export redirects to its content domain, so the
 *  final URL is a *.googleusercontent.com host. Both are Google and both are
 *  accepted — a redirect to accounts.google.com, which is what an unshared doc
 *  gives you, is not. The `(^|\.)` prefix keeps a lookalike domain such as
 *  `evilgoogleusercontent.com` from matching. */
const CONTENT_HOST = /^docs\.google\.com$|(?:^|\.)googleusercontent\.com$/;

function secondsFromEnv(raw: string | undefined, fallback: number): number {
  const value = Number(raw?.trim());
  return raw?.trim() && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** How long a fetched copy is served before Google is asked again. Short enough
 *  that an edit shows up while the editor is still at their desk, long enough
 *  that a burst of traffic doesn't turn into a burst of requests to Google. */
const CACHE_MS =
  secondsFromEnv(process.env.PRIVACY_DOC_CACHE_SECONDS, 300) * 1000;

/** Google is a third party on the far side of the internet; a hung connection
 *  must not hold a page render open indefinitely. */
const FETCH_TIMEOUT_MS = 10_000;

let warnedUnconfigured = false;

/**
 * Resolve the document id from `PRIVACY_DOC_URL`.
 *
 * The environment holds the document's URL, exactly as it appears in the
 * browser's address bar; the id is extracted from it here. A bare id is
 * accepted too, for anyone who already has one to hand.
 *
 * Only the id travels onward, and only after it matches `DOC_ID` — the URL that
 * actually gets fetched is always built from this module's own template. An
 * environment value therefore chooses *which document* is read, never *which
 * host* is contacted.
 *
 * Anything unusable returns null after saying why, so a misconfiguration shows
 * up in the logs instead of as a silent empty page.
 */
export function privacyDocId(): string | null {
  const raw = process.env.PRIVACY_DOC_URL?.trim();
  if (!raw) {
    if (!warnedUnconfigured) {
      warnedUnconfigured = true;
      console.warn(
        "PRIVACY_DOC_URL is not set — /privacy will explain that the policy " +
          "isn't published yet. Set it to the Google Doc's share URL.",
      );
    }
    return null;
  }

  if (PUBLISHED_URL.test(raw)) {
    console.error(
      "PRIVACY_DOC_URL looks like a 'Publish to the web' URL, which the export " +
        "endpoint can't read. Use the ordinary share link " +
        "(https://docs.google.com/document/d/<id>/edit) instead.",
    );
    return null;
  }

  const id = raw.match(ID_IN_URL)?.[1] ?? raw;
  if (!DOC_ID.test(id)) {
    console.error(
      `PRIVACY_DOC_URL doesn't contain a usable Google document id — refusing ` +
        `to fetch it. Expected a link like ` +
        `https://docs.google.com/document/d/<id>/edit`,
    );
    return null;
  }
  return id;
}

/**
 * Google's Markdown export is clean, but it is a file: it can carry a byte-order
 * mark and CRLF line endings, neither of which a Markdown parser should have to
 * think about.
 *
 * It also escapes. If someone pastes Markdown *source* into the document as
 * plain text — which is exactly what happens when you hand a colleague a `.md`
 * template and say "paste this in" — Docs treats the `#` and `*` as ordinary
 * characters and faithfully backslash-escapes every one of them on the way out.
 * The export then reads `\#\# Who we are`, and the page renders a wall of
 * literal hashes instead of headings. Undoing the escaping costs nothing on a
 * properly formatted document, where there is none to undo, and rescues the
 * pasted-source case entirely.
 *
 * The leading `# Heading` is dropped because the page already renders the title
 * in its header — without this, a doc that sensibly starts with its own title
 * would show that title twice. It runs after unescaping, so that it still finds
 * the title in a pasted document.
 */
function normalise(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\\([\\`*_{}[\]()#+\-.!>|~])/g, "$1")
    .replace(/^\s*#\s+.*\n+/, "")
    .trim();
}

type Cached = { markdown: string; fetchedAt: number };

/** Cached on globalThis so a dev-server hot reload doesn't re-fetch on every
 *  edit, matching how the rate limiter holds its state. */
const globalForDoc = globalThis as unknown as { jaiaPrivacyDoc?: Cached };

export type PrivacyDoc =
  | {
      ok: true;
      markdown: string;
      /** True when Google couldn't be reached and this is the last good copy. */
      stale: boolean;
    }
  | { ok: false; reason: "unconfigured" | "unavailable" };

/**
 * Fetch the policy, serving a cached copy inside the cache window.
 *
 * On a failed fetch the last good copy is served instead, marked stale. A
 * privacy notice is a statement a public body has made to the public: a Google
 * outage is a poor reason to withdraw it, and yesterday's wording is far better
 * than an error page.
 */
export async function getPrivacyDoc(): Promise<PrivacyDoc> {
  const id = privacyDocId();
  if (!id) return { ok: false, reason: "unconfigured" };

  const cached = globalForDoc.jaiaPrivacyDoc;
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
    return { ok: true, markdown: cached.markdown, stale: false };
  }

  try {
    const res = await fetch(exportUrl(id), {
      // Caching is handled above, on our terms, so that a failure can fall back
      // to the previous copy — something an opaque fetch cache can't do.
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Google Docs returned HTTP ${res.status}`);

    // A doc that isn't shared publicly doesn't fail — it redirects to a Google
    // sign-in page, which arrives as a perfectly healthy 200 full of HTML.
    // Rendering that as the privacy policy would be worse than showing nothing,
    // so both the final host and the content type have to check out.
    // `res.url` is the final URL after any redirects. It is empty only when the
    // response carries no URL at all, which means there was no redirect to
    // inspect — falling back to the requested URL keeps this from throwing an
    // unhelpful "Invalid URL" over what is actually the happy path.
    const host = new URL(res.url || exportUrl(id)).hostname;
    const type = res.headers.get("content-type") ?? "";
    if (!CONTENT_HOST.test(host) || type.includes("text/html")) {
      throw new Error(
        "got a sign-in page instead of the document — check that it is shared " +
          "with 'Anyone with the link' as Viewer",
      );
    }

    const markdown = normalise(await res.text());
    if (!markdown) throw new Error("the document is empty");

    globalForDoc.jaiaPrivacyDoc = { markdown, fetchedAt: Date.now() };
    return { ok: true, markdown, stale: false };
  } catch (err) {
    console.error("Couldn't load the privacy policy from Google Docs:", err);
    if (cached) return { ok: true, markdown: cached.markdown, stale: true };
    return { ok: false, reason: "unavailable" };
  }
}
