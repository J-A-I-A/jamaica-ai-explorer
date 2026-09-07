import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import FeedbackQuiz from "@/components/FeedbackQuiz";
import PolicyTimeline from "@/components/PolicyTimeline";

export const metadata: Metadata = {
  title: "Share Your Feedback | National A.I. Policy Explorer",
  description:
    "Tell the National A.I. Task Force what you think about Jamaica's A.I. policy recommendations. Public feedback helps shape how A.I. is adopted and governed in Jamaica.",
};

// The reCAPTCHA site key is read from the environment on every request, so one
// built image can be deployed anywhere with a different key. Prerendering this
// page would freeze the key into the build output, which is exactly what the
// `NEXT_PUBLIC_` variable it replaces used to do.
export const dynamic = "force-dynamic";

export default function FeedbackPage() {
  const siteKey = process.env.RECAPTCHA_SITE_KEY || undefined;

  return (
    <>
      <PageHeader
        eyebrow="Have your say"
        title="Share your feedback"
        lede="Jamaica's A.I. policy is for everyone. Go through the recommendations one at a time and tell us what you make of each — then add anything else on your mind. Public input helps ensure the policy reflects the needs of all Jamaicans."
      />
      <div className="mx-auto max-w-3xl space-y-10 px-5 py-12 sm:px-8 sm:py-14">
        <PolicyTimeline />
        <FeedbackQuiz siteKey={siteKey} />
      </div>
    </>
  );
}
