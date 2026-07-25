import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import Assistant from "@/components/Assistant";

export const metadata: Metadata = {
  title: "Ask the A.I. Assistant | National A.I. Policy Explorer",
  description:
    "Chat with an A.I. assistant about Jamaica's National Artificial Intelligence Task Force Policy Recommendations — the nine pillars, the action plan, the SWOT analysis and ethical foundations.",
};

export default function AssistantPage() {
  return (
    <>
      <PageHeader
        eyebrow="Talk to the document"
        title="Ask the A.I. assistant"
        lede="Have a conversation about the National A.I. Task Force Policy Recommendations. The assistant answers using the contents of the report — ask about any of the nine pillars, the 10-year action plan, the SWOT analysis, or the ethical foundations."
      />
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-14">
        <Assistant />
      </div>
    </>
  );
}
