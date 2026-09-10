import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import Assistant from "@/components/Assistant";

export const metadata: Metadata = {
  title: "Smart Search | National A.I. Policy Explorer",
  description:
    "Chat with an A.I. assistant about Jamaica's National Artificial Intelligence Task Force Policy Recommendations — the nine pillars, the action plan, the SWOT analysis and ethical foundations.",
};

// The privacy notice is read from the environment on every request, like the
// reCAPTCHA site key on /feedback, so one built image can carry different
// wording — or name a different processor — in each environment. Prerendering
// would freeze whichever value the build machine happened to have.
export const dynamic = "force-dynamic";

/** Who actually receives the questions visitors type. The chat route talks to
 *  any OpenAI-compatible endpoint, so the processor named here has to be able to
 *  change with `MODEL_API_KEY` / `OPENAI_BASE_URL` rather than being fixed in
 *  the markup. */
const DEFAULT_PROCESSOR = "Microsoft";

/** The whole line can be replaced when a deployment needs its own wording; the
 *  default is assembled around the processor name so the common case is a
 *  one-word change. */
function privacyNotice(): string {
  const custom = process.env.ASSISTANT_PRIVACY_NOTICE?.trim();
  if (custom) return custom;

  const processor =
    process.env.ASSISTANT_DATA_PROCESSOR?.trim() || DEFAULT_PROCESSOR;
  // Both claims are true of this deployment: the route forwards the messages to
  // the model provider and writes nothing to the database, and the page keeps
  // the conversation in component state only, so a refresh discards it.
  return `Questions you ask are processed by ${processor} to generate a response. Conversations are not stored by this site. Please do not enter personal or sensitive information.`;
}

export default function AssistantPage() {
  return (
    <>
      <PageHeader
        eyebrow="Talk to the document"
        title="Smart Search"
        lede="Have a conversation about the National A.I. Task Force Policy Recommendations. The assistant answers using the contents of the report — ask about any of the nine pillars, the 10-year action plan, the SWOT analysis, or the ethical foundations."
      />
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-14">
        <Assistant privacyNotice={privacyNotice()} />
      </div>
    </>
  );
}
