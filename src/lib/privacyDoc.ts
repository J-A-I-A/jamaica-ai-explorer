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
 *
 * Requests are never held open for Google. The copy in memory is served
 * immediately and refreshed behind the response once it is past its cache
 * window — see `getPrivacyDoc` for the two cases that still have to wait.
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

/** How long a fetched copy is served before a refresh is triggered behind the
 *  next request. Short enough that an edit shows up while the editor is still
 *  at their desk, long enough that a burst of traffic doesn't turn into a burst
 *  of requests to Google. Nobody waits for that refresh, so this can be short
 *  without costing a visitor anything. */
const CACHE_MS =
  secondsFromEnv(process.env.PRIVACY_DOC_CACHE_SECONDS, 300) * 1000;

/** Google is a third party on the far side of the internet; a hung connection
 *  must not hold a refresh open indefinitely. */
const FETCH_TIMEOUT_MS = 10_000;

/** After a failed refresh, how long to leave Google alone before trying again.
 *  Refreshes are cheap for the visitor but not for Google, and during an outage
 *  every request would otherwise start another attempt the moment the last one
 *  gave up. */
const RETRY_MS = 30_000;

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

type DocState = {
  /** The last copy that was successfully read, if there has ever been one. */
  cached?: { markdown: string; fetchedAt: number };
  /** When a refresh last finished, successful or not — the floor for retries. */
  lastAttemptAt: number;
  /** True when the most recent refresh attempt failed. */
  failing: boolean;
  /** The refresh currently running, so concurrent requests share one fetch
   *  instead of each opening their own connection to Google. */
  inFlight: Promise<void> | null;
};

/** Held on globalThis so a dev-server hot reload doesn't re-fetch on every
 *  edit, matching how the rate limiter holds its state. The key is distinct
 *  from the one an earlier version used, because the shape changed and a hot
 *  reload would otherwise hand this code the old object. */
const globalForDoc = globalThis as unknown as { jaiaPrivacyDocState?: DocState };

function state(): DocState {
  globalForDoc.jaiaPrivacyDocState ??= {
    lastAttemptAt: 0,
    failing: false,
    inFlight: null,
  };
  return globalForDoc.jaiaPrivacyDocState;
}

/** The copy currently in memory, read through a call so that a refresh
 *  completing mid-request is visible to the caller. */
function copy(): DocState["cached"] {
  return state().cached;
}

export type PrivacyDoc =
  | {
      ok: true;
      markdown: string;
      /** True when Google couldn't be reached and this is the last good copy. */
      stale: boolean;
    }
  | { ok: false; reason: "unconfigured" | "unavailable" };

/**
 * Ask Google for the document. Throws on anything that isn't a usable policy,
 * so the caller has a single place to decide what a failure means.
 */
async function fetchMarkdown(id: string): Promise<string> {
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
  return markdown;
}

/**
 * Start a refresh, or join the one already in flight.
 *
 * This never rejects. A failure is recorded on the state and surfaced through
 * `stale`, because the common case is a caller that doesn't await it at all —
 * an unhandled rejection from a background refresh would take the server down
 * over a Google hiccup.
 */
function refresh(id: string): Promise<void> {
  const s = state();
  if (s.inFlight) return s.inFlight;

  const run = (async () => {
    try {
      const markdown = await fetchMarkdown(id);
      s.cached = { markdown, fetchedAt: Date.now() };
      s.failing = false;
    } catch (err) {
      console.error("Couldn't load the privacy policy from Google Docs:", err);
      s.failing = true;
    } finally {
      s.lastAttemptAt = Date.now();
      s.inFlight = null;
    }
  })();

  s.inFlight = run;
  return run;
}

/**
 * Return the policy, refreshing behind the response rather than in front of it.
 *
 * Once there is a copy in hand every request is served from memory and returns
 * immediately; when that copy is past the cache window the request also kicks
 * off a refresh it doesn't wait for, so the new text is there for whoever comes
 * next. Before this, one visitor every `CACHE_MS` paid for a full round trip to
 * Google — up to `FETCH_TIMEOUT_MS` of it — to read a document that changes a
 * few times a year.
 *
 * Two cases still wait: the first read after a restart, which has nothing to
 * serve, and a first read that fails, which has nothing to fall back to. On
 * every later failure the last good copy is served instead, marked stale. A
 * privacy notice is a statement a public body has made to the public: a Google
 * outage is a poor reason to withdraw it, and yesterday's wording is far better
 * than an error page.
 *
 * The background refresh assumes a server that outlives the response, which
 * `output: "standalone"` gives us. On a platform that freezes the process the
 * moment a response is sent, the refresh would simply land on the next request
 * instead — slower, but never wrong.
 */
export async function getPrivacyDoc(): Promise<PrivacyDoc> {
  const id = privacyDocId();
  if (!id) return { ok: false, reason: "unconfigured" };

  const s = state();

  // Nothing cached: this one request has to wait, and joins the refresh that
  // any concurrent request may already have started. Read back through
  // `copy()` rather than `s.cached`, so the value a completed refresh just
  // stored is actually seen — a property narrowed to undefined before the await
  // stays that way as far as the compiler is concerned.
  let held = copy();
  if (!held) {
    await refresh(id);
    held = copy();
    if (!held) return { ok: false, reason: "unavailable" };
    return { ok: true, markdown: held.markdown, stale: false };
  }

  const now = Date.now();
  const due = now - held.fetchedAt >= CACHE_MS;
  // While Google is failing, stop trying on every single request — an outage
  // shouldn't turn steady traffic into a stream of doomed round trips.
  const mayRetry = !s.failing || now - s.lastAttemptAt >= RETRY_MS;

  if (due && mayRetry) {
    // Deliberately not awaited. The visitor gets the copy already in memory;
    // the fresh one lands in time for the next reader.
    void refresh(id);
  }

  return { ok: true, markdown: held.markdown, stale: s.failing };
}
