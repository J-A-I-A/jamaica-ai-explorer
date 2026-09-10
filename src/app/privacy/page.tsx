import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import Markdown from "@/components/Markdown";
import { getPrivacyDoc } from "@/lib/privacyDoc";

export const metadata: Metadata = {
  title: "Privacy Policy | National A.I. Policy Explorer",
  description:
    "How the National A.I. Policy Explorer handles the information you share — feedback submissions, Smart Search questions, and your rights under Jamaica's Data Protection Act.",
};

// The policy lives in a Google Doc and is fetched at request time, with its own
// cache inside `getPrivacyDoc`. Prerendering would freeze whatever the document
// said on the day the image was built, which defeats the point of keeping it
// outside the codebase.
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const doc = await getPrivacyDoc();

  return (
    <>
      <PageHeader
        eyebrow="How we handle your information"
        title="Privacy Policy"
        lede="What this site collects when you send feedback or ask the assistant a question, who processes it, how long it is kept, and the rights you have over it."
      />
      <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-14">
        {doc.ok ? <Markdown>{doc.markdown}</Markdown> : <Unavailable reason={doc.reason} />}
      </div>
    </>
  );
}

/**
 * Shown when the document can't be read. It never pretends the policy is empty:
 * a visitor who came here to find out what happens to their data is told
 * plainly that the text is missing and how else to ask, because the honest
 * failure is the only acceptable one on this particular page.
 */
function Unavailable({ reason }: { reason: "unconfigured" | "unavailable" }) {
  return (
    <div
      role="status"
      className="rounded-xl border border-jm-line bg-jm-ink px-6 py-8 text-center"
    >
      <h2 className="font-display text-lg font-semibold tracking-tight">
        {reason === "unconfigured"
          ? "This policy hasn't been published yet"
          : "This policy can't be loaded right now"}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-jm-muted">
        {reason === "unconfigured"
          ? "The privacy policy for this site is still being prepared. In the meantime, nothing you send through this site is shared beyond what the pages themselves describe."
          : "We couldn't reach the document that holds this policy. Please try again shortly — the policy itself hasn't changed."}
      </p>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-jm-muted">
        The{" "}
        <Link className="text-jm-gold hover:text-jm-gold-soft" href="/feedback">
          feedback form
        </Link>{" "}
        and the{" "}
        <Link className="text-jm-gold hover:text-jm-gold-soft" href="/assistant">
          Smart Search assistant
        </Link>{" "}
        each explain what they do with what you enter, on the page itself.
      </p>
    </div>
  );
}
