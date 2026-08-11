/** Topic areas a piece of feedback can be filed under. Shared by the form
 *  and the API route so the two can never drift apart. */
export const FEEDBACK_TOPICS = [
  "General",
  "Innovation & Economic Growth",
  "Education & Workforce",
  "Public Awareness",
  "Infrastructure",
  "International Cooperation",
  "Legal & Regulatory",
  "Government & Industry",
  "Ethical Foundations",
  "Cohesive Framework",
  "The website itself",
] as const;

export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number];

/**
 * Master switch for accepting submissions. While this is `false` the form
 * still renders (so people can read it) but the submit button is disabled and
 * the API rejects posts. Flip to `true` to open feedback.
 */
export const FEEDBACK_SUBMISSIONS_OPEN: boolean = false;

/** Who is speaking. The form collects nothing else about the respondent. */
export const RESPONDENT_TYPES = ["Individual", "Organisation / Company"] as const;

export type RespondentType = (typeof RESPONDENT_TYPES)[number];

/** How many separate pieces of feedback one submission may carry. */
export const MAX_FEEDBACK_ENTRIES = 10;

export const FEEDBACK_LIMITS = {
  message: 5000,
};
