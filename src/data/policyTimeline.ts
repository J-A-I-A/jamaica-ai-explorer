/**
 * The stages a national policy moves through, from concept to Parliament.
 * `CURRENT_POLICY_STEP` marks where the National A.I. Policy stands today —
 * it drives the timeline UI and is stamped onto every feedback submission so
 * responses can later be read in the context of the stage they were given at.
 */

export type PolicyStep = {
  step: number;
  title: string;
  blurb: string;
};

export const POLICY_TIMELINE: PolicyStep[] = [
  {
    step: 1,
    title: "Initial Concept Paper",
    blurb:
      "The case for a national A.I. policy is set out and approval is given to develop it.",
  },
  {
    step: 2,
    title: "Policy Preparation and Analysis",
    blurb:
      "Evidence is gathered and the draft recommendations are developed and analysed.",
  },
  {
    step: 3,
    title: "Public Consultation (Green Paper)",
    blurb:
      "The draft policy is published as a Green Paper and opened for formal public comment.",
  },
  {
    step: 4,
    title: "Point of Readiness (White Paper)",
    blurb:
      "Consultation is reflected in a White Paper, signalling the policy is ready to proceed.",
  },
  {
    step: 5,
    title: "Tabling in Parliament",
    blurb: "The finalised policy is laid before Parliament for consideration.",
  },
];

/** Where the National A.I. Policy currently sits on the timeline. */
export const CURRENT_POLICY_STEP = 2;

export const currentPolicyStep =
  POLICY_TIMELINE.find((s) => s.step === CURRENT_POLICY_STEP) ??
  POLICY_TIMELINE[0];
