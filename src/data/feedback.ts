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

// The master switch for accepting submissions used to live here as a constant.
// It is now read from the environment by `feedbackSubmissionsOpen()` in
// `src/lib/feedbackConfig.ts`, so opening or closing the consultation is a
// restart rather than a rebuild — and it reaches the form as a prop, because
// this module is imported by client components.

/** Who is speaking. An individual is asked for nothing else; an organisation
 *  may optionally name itself and the person filling the form in. */
export const RESPONDENT_TYPES = ["Individual", "Organisation / Company"] as const;

export type RespondentType = (typeof RESPONDENT_TYPES)[number];

/** The respondent type that unlocks the organisation fields. Shared so the
 *  form and the API agree on which answer counts as an organisation. */
export const ORGANISATION_TYPE = RESPONDENT_TYPES[1];

/**
 * The "no answer" value for every optional profile dropdown below. Stored as
 * an empty string rather than a label so a respondent who declines is
 * indistinguishable from one who never saw the question — both land as NULL
 * in the database.
 */
export const UNSPECIFIED = "";

/** Rough age band. Bands, not birth years: enough to see who is being heard
 *  from without collecting a date of birth. */
export const AGE_RANGES = [
  "Under 18",
  "18–24",
  "25–34",
  "35–44",
  "45–54",
  "55–64",
  "65 or over",
] as const;

/** What the respondent does. Broad enough that most people find themselves in
 *  one entry without a free-text box to moderate. */
export const EMPLOYMENT_STATUSES = [
  "Student",
  "Employed — private sector",
  "Employed — public sector",
  "Self-employed / business owner",
  "Unemployed / seeking work",
  "Retired",
  "Not currently working",
] as const;

/** How close the respondent is to A.I. in practice — the answer that tells us
 *  how to read the rest of their submission. */
export const AI_FAMILIARITY_LEVELS = [
  "I have never used A.I. tools",
  "I have heard of A.I. but rarely use it",
  "I use A.I. tools occasionally",
  "I use A.I. tools regularly",
  "I work in or study A.I. or technology",
] as const;

/** What kind of body is answering. */
export const ORGANISATION_TYPES = [
  "Private company",
  "Non-profit / NGO",
  "Government agency or ministry",
  "Statutory body / public agency",
  "Academic or research institution",
  "Industry association or trade body",
  "International or multilateral body",
  "Faith-based organisation",
  "Community group",
  "Other",
] as const;

/** Sector the organisation works in. */
export const INDUSTRY_SECTORS = [
  "Agriculture & Fisheries",
  "Banking, Finance & Insurance",
  "Construction & Real Estate",
  "Creative Industries & Entertainment",
  "Education & Training",
  "Energy & Utilities",
  "Health & Life Sciences",
  "Hospitality & Tourism",
  "Information Technology & Telecommunications",
  "Legal & Professional Services",
  "Manufacturing",
  "Media & Communications",
  "Mining & Extractives",
  "Public Sector & Government",
  "Retail & Distribution",
  "Security & Defence",
  "Transport & Logistics",
  "Other",
] as const;

export type AgeRange = (typeof AGE_RANGES)[number];
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];
export type AiFamiliarity = (typeof AI_FAMILIARITY_LEVELS)[number];
export type OrganisationCategory = (typeof ORGANISATION_TYPES)[number];
export type IndustrySector = (typeof INDUSTRY_SECTORS)[number];

/** How many separate pieces of feedback one submission may carry. */
export const MAX_FEEDBACK_ENTRIES = 10;

export const FEEDBACK_LIMITS = {
  message: 5000,
  /** Per-recommendation comment in the guided review. */
  comment: 1500,
  /** Organisation and contact names. */
  name: 160,
  /** Any single-choice profile answer (age band, sector, and the rest). */
  choice: 120,
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
