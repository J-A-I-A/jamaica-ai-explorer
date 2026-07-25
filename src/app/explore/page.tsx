import type { Metadata } from "next";
import Explorer from "@/components/Explorer";
import { PageHeader } from "@/components/ui";
import { COUNTS } from "@/data/recommendations";

export const metadata: Metadata = {
  title: "Explore Recommendations | National A.I. Policy Explorer",
  description:
    "Filter and search all recommendations of Jamaica's National A.I. Task Force by pillar and implementation horizon.",
};

export default function ExplorePage() {
  return (
    <>
      <PageHeader
        eyebrow="Recommendations"
        title="Explore every recommendation"
        lede={`All ${COUNTS.actions} recommendations across ${COUNTS.pillars} policy pillars. Filter by implementation horizon, narrow to a pillar, or search the full text.`}
      />
      <Explorer />
    </>
  );
}
