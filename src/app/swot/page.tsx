import type { Metadata } from "next";
import SwotBoard from "@/components/SwotBoard";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "SWOT Analysis | National A.I. Policy Explorer",
  description:
    "Strengths, weaknesses, opportunities and threats facing A.I. adoption in Jamaica, as assessed by the National A.I. Task Force.",
};

export default function SwotPage() {
  return (
    <>
      <PageHeader
        eyebrow="SWOT analysis"
        title="A.I. use in Jamaica"
        lede="An assessment of the national position — from Vision 2030 alignment and a disproportionate global cultural footprint, to the rural digital divide and the risk of economic displacement."
      />
      <SwotBoard />
    </>
  );
}
