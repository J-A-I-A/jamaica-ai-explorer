import type { Metadata } from "next";
import Roadmap from "@/components/Roadmap";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Action Plan Roadmap | National A.I. Policy Explorer",
  description:
    "The recommended action plan for Jamaica's national A.I. policy, organised across short, medium and long term implementation horizons.",
};

export default function RoadmapPage() {
  return (
    <>
      <PageHeader
        eyebrow="Recommended action plan"
        title="A decade of implementation"
        lede="To ensure successful implementation of the National A.I. Policy, recommendations are organised by timeline: short term (1–3 years), medium term (4–6 years) and long term (7–10 years)."
      />
      <Roadmap />
    </>
  );
}
