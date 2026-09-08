"use client";

import {
  AGE_RANGES,
  AI_FAMILIARITY_LEVELS,
  EMPLOYMENT_STATUSES,
  FEEDBACK_LIMITS,
  INDUSTRY_SECTORS,
  ORGANISATION_TYPE,
  ORGANISATION_TYPES,
  RESPONDENT_TYPES,
  UNSPECIFIED,
} from "@/data/feedback";
import { fieldClass } from "@/components/feedback/styles";

/**
 * Everything the form asks about the respondent themselves. Which questions
 * appear depends on the answer to the first one: an individual is asked about
 * themselves, an organisation about the body it speaks for.
 *
 * Every field here is optional except the organisation's name — an
 * organisation's submission carries weight only if we know whose it is,
 * whereas an individual may stay entirely anonymous.
 */
export type Profile = {
  respondentType: string;
  /** Organisation respondents only. */
  orgName: string;
  personName: string;
  /** Individual respondents only. */
  ageRange: string;
  employmentStatus: string;
  aiFamiliarity: string;
  /** Organisation respondents only. */
  orgType: string;
  industry: string;
};

export function emptyProfile(): Profile {
  return {
    respondentType: RESPONDENT_TYPES[0],
    orgName: "",
    personName: "",
    ageRange: UNSPECIFIED,
    employmentStatus: UNSPECIFIED,
    aiFamiliarity: UNSPECIFIED,
    orgType: UNSPECIFIED,
    industry: UNSPECIFIED,
  };
}

export function isOrganisation(profile: Profile): boolean {
  return profile.respondentType === ORGANISATION_TYPE;
}

/** So the form can move focus to the field it is complaining about. */
export const ORG_NAME_FIELD_ID = "feedback-org-name";

/** The one hard requirement in this section. */
export function profileIsComplete(profile: Profile): boolean {
  return !isOrganisation(profile) || profile.orgName.trim().length > 0;
}

/** A select whose blank first option is a real answer: "I'd rather not say". */
function ChoiceField({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm text-jm-text">{label}</span>
      {hint && (
        <span className="mt-0.5 block text-xs leading-relaxed text-jm-muted">
          {hint}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-2 ${fieldClass}`}
      >
        <option value={UNSPECIFIED}>Prefer not to say</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function RespondentDetails({
  profile,
  onChange,
  showErrors,
}: {
  profile: Profile;
  onChange: (patch: Partial<Profile>) => void;
  /** Set once the respondent has tried to submit, so the missing organisation
   *  name is called out then rather than while they are still typing. */
  showErrors: boolean;
}) {
  const org = isOrganisation(profile);
  const orgNameMissing = org && profile.orgName.trim().length === 0;

  return (
    <div>
      <label className="block sm:max-w-sm">
        <span className="text-sm text-jm-text">
          I&apos;m sharing this feedback as
        </span>
        <select
          value={profile.respondentType}
          onChange={(e) => onChange({ respondentType: e.target.value })}
          className={`mt-2 ${fieldClass}`}
        >
          {RESPONDENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      {org ? (
        <div className="fade-up mt-4 rounded-xl border border-jm-line bg-jm-black/40 p-5">
          <p className="text-sm text-jm-text">About your organisation</p>
          <p className="mt-1 text-xs leading-relaxed text-jm-muted">
            The organisation&apos;s name is required so its position can be
            attributed. Everything else is optional.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-jm-text">
                Organisation name{" "}
                <span className="text-jm-gold-soft" aria-hidden>
                  *
                </span>
                <span className="sr-only">(required)</span>
              </span>
              <input
                id={ORG_NAME_FIELD_ID}
                type="text"
                value={profile.orgName}
                onChange={(e) => onChange({ orgName: e.target.value })}
                maxLength={FEEDBACK_LIMITS.name}
                autoComplete="organization"
                // Deliberately not `required`: the browser's own bubble would
                // pre-empt the form's error handling and its own message.
                aria-required="true"
                aria-invalid={showErrors && orgNameMissing ? true : undefined}
                aria-describedby={
                  showErrors && orgNameMissing ? "org-name-error" : undefined
                }
                placeholder="e.g. Jamaica Chamber of Commerce"
                className={`mt-2 ${fieldClass}`}
              />
              {showErrors && orgNameMissing && (
                <span
                  id="org-name-error"
                  className="mt-2 block text-xs text-jm-gold-soft"
                >
                  Please give the name of the organisation you&apos;re
                  responding for.
                </span>
              )}
            </label>

            <label className="block">
              <span className="text-sm text-jm-text">Your name</span>
              <input
                type="text"
                value={profile.personName}
                onChange={(e) => onChange({ personName: e.target.value })}
                maxLength={FEEDBACK_LIMITS.name}
                autoComplete="name"
                placeholder="Who is filling this in (optional)"
                className={`mt-2 ${fieldClass}`}
              />
            </label>

            <ChoiceField
              label="Type of organisation"
              value={profile.orgType}
              options={ORGANISATION_TYPES}
              onChange={(orgType) => onChange({ orgType })}
            />

            <ChoiceField
              label="Industry / sector"
              value={profile.industry}
              options={INDUSTRY_SECTORS}
              onChange={(industry) => onChange({ industry })}
            />
          </div>
        </div>
      ) : (
        <div className="fade-up mt-4 rounded-xl border border-jm-line bg-jm-black/40 p-5">
          <p className="text-sm text-jm-text">About you</p>
          <p className="mt-1 text-xs leading-relaxed text-jm-muted">
            All optional — leave any of it blank and your submission stays
            anonymous. It helps us see whose voices the consultation is
            reaching.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-jm-text">Your name</span>
              <input
                type="text"
                value={profile.personName}
                onChange={(e) => onChange({ personName: e.target.value })}
                maxLength={FEEDBACK_LIMITS.name}
                autoComplete="name"
                placeholder="Optional"
                className={`mt-2 ${fieldClass}`}
              />
            </label>

            <ChoiceField
              label="Age range"
              value={profile.ageRange}
              options={AGE_RANGES}
              onChange={(ageRange) => onChange({ ageRange })}
            />

            <ChoiceField
              label="Employment status"
              value={profile.employmentStatus}
              options={EMPLOYMENT_STATUSES}
              onChange={(employmentStatus) => onChange({ employmentStatus })}
            />

            <ChoiceField
              label="How familiar are you with A.I.?"
              value={profile.aiFamiliarity}
              options={AI_FAMILIARITY_LEVELS}
              onChange={(aiFamiliarity) => onChange({ aiFamiliarity })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
