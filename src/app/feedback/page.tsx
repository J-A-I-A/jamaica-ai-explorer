import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import FeedbackForm from "@/components/FeedbackForm";

export const metadata: Metadata = {
  title: "Share Your Feedback | National A.I. Policy Explorer",
  description:
    "Tell the National A.I. Task Force what you think about Jamaica's A.I. policy recommendations. Public feedback helps shape how A.I. is adopted and governed in Jamaica.",
};

export default function FeedbackPage() {
  return (
    <>
      <PageHeader
        eyebrow="Have your say"
        title="Share your feedback"
        lede="Jamaica's A.I. policy is for everyone. Share your thoughts, questions, or concerns about the recommendations — public input helps ensure the policy reflects the needs of all Jamaicans."
      />
      <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-14">
        <FeedbackForm />
      </div>
    </>
  );
}
