import { ALL_ACTIONS } from "@/data/recommendations";

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

/** Who is speaking. An individual is asked for nothing else; an organisation
 *  may optionally name itself and the person filling the form in. */
export const RESPONDENT_TYPES = ["Individual", "Organisation / Company"] as const;

export type RespondentType = (typeof RESPONDENT_TYPES)[number];

/** The respondent type that unlocks the optional attribution fields. Shared so
 *  the form and the API agree on which answer counts as an organisation. */
export const ORGANISATION_TYPE = RESPONDENT_TYPES[1];

/** How many separate pieces of feedback one submission may carry. */
export const MAX_FEEDBACK_ENTRIES = 10;

export const FEEDBACK_LIMITS = {
  message: 5000,
  /** Per-recommendation comment in the guided review. */
  comment: 1500,
  /** Optional organisation and contact names. */
  name: 160,
};

/**
 * The five-point scale each recommendation is rated on. `score` is what gets
 * averaged; `value` is the stable key stored in the database, so the labels
 * can be reworded later without invalidating the responses already collected.
 */
export const SUPPORT_LEVELS = [
  { value: "strongly_disagree", score: 1, label: "Strongly disagree", short: "Strongly disagree" },
  { value: "disagree", score: 2, label: "Disagree", short: "Disagree" },
  { value: "neutral", score: 3, label: "Neutral / not sure", short: "Neutral" },
  { value: "agree", score: 4, label: "Agree", short: "Agree" },
  { value: "strongly_agree", score: 5, label: "Strongly agree", short: "Strongly agree" },
] as const;

export type SupportValue = (typeof SUPPORT_LEVELS)[number]["value"];

export const SUPPORT_BY_VALUE = new Map<string, (typeof SUPPORT_LEVELS)[number]>(
  SUPPORT_LEVELS.map((l) => [l.value, l]),
);

/** The question asked above the scale on every recommendation card. */
export const SUPPORT_QUESTION =
  "Should this be part of Jamaica's national A.I. policy?";

/**
 * A submission can carry at most one rating per recommendation, so the cap is
 * simply the number of recommendations in the policy.
 */
export const MAX_FEEDBACK_RATINGS = ALL_ACTIONS.length;
