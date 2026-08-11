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

/** How many separate pieces of feedback one submission may carry. */
export const MAX_FEEDBACK_ENTRIES = 10;

export const FEEDBACK_LIMITS = {
  name: 120,
  email: 160,
  organisation: 160,
  message: 5000,
};
