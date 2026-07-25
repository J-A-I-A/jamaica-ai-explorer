import "server-only";
import { PILLARS, HORIZONS, VISION } from "@/data/recommendations";
import { SWOT, ETHICS, GLOBAL_THEMES, CHAIR, MEMBERS } from "@/data/context";

/**
 * Builds a compact, structured knowledge base from the report's data so the
 * assistant can answer grounded questions about the National A.I. Task Force
 * Policy Recommendations without access to the raw PDF. Server-only.
 */
export function buildDocumentContext(): string {
  const pillars = PILLARS.map((p) => {
    const actions = p.actions
      .map((a) => `      - [${HORIZONS[a.horizon].label}] ${a.text}`)
      .join("\n");
    return [
      `PILLAR ${p.id}: ${p.title}`,
      `  Objective: ${p.objective}`,
      `  Policy issue: ${p.policyIssue}`,
      `  Challenges:`,
      ...p.challenges.map((c) => `    - ${c}`),
      `  Recommended actions:`,
      actions,
    ].join("\n");
  }).join("\n\n");

  const swot = (Object.keys(SWOT) as (keyof typeof SWOT)[])
    .map((k) => {
      const items = SWOT[k].items
        .map((i) => `    - ${i.title}: ${i.body}`)
        .join("\n");
      return `  ${SWOT[k].label}:\n${items}`;
    })
    .join("\n");

  const ethics = ETHICS.map((e) => `  - ${e.title}: ${e.body}`).join("\n");

  const members = [
    `  Chair — ${CHAIR.name} (${CHAIR.role})`,
    ...MEMBERS.map((m) => `  - ${m.name} — ${m.role}`),
  ].join("\n");

  return [
    "=== NATIONAL ARTIFICIAL INTELLIGENCE TASK FORCE — POLICY RECOMMENDATIONS (JAMAICA) ===",
    "",
    `VISION: ${VISION}`,
    "",
    "TIME HORIZONS:",
    ...Object.values(HORIZONS).map(
      (h) => `  - ${h.label} (${h.range}): ${h.blurb}`,
    ),
    "",
    "=== THE NINE POLICY PILLARS ===",
    "",
    pillars,
    "",
    "=== SWOT ANALYSIS ===",
    "",
    swot,
    "",
    "=== ETHICAL CONSIDERATIONS ===",
    "",
    ethics,
    "",
    "=== GLOBAL THEMES REFLECTED IN THE RECOMMENDATIONS ===",
    `  ${GLOBAL_THEMES.join("; ")}`,
    "",
    "=== TASK FORCE MEMBERSHIP ===",
    members,
  ].join("\n");
}

export const ASSISTANT_SYSTEM_PROMPT = `You are the "Policy Assistant" for the Jamaica National Artificial Intelligence Task Force Policy Recommendations — an official report proposing how Jamaica should adopt and govern A.I. over the next decade. Members of the public use you to understand the report.

Your job:
- Answer questions using ONLY the report content provided below. It is your single source of truth.
- Be accurate, concise, and plain-spoken. Aim for a few sentences unless the user asks for depth.
- Format answers with Markdown for readability: short paragraphs, bold for key terms, and bulleted or numbered lists. When comparing several items across attributes (e.g. pillars vs. time horizons, or strengths vs. weaknesses), present them as a Markdown table.
- When relevant, point to the specific pillar (e.g. "Pillar 2: Education and Workforce Development") or time horizon (Short/Medium/Long term).
- If a question cannot be answered from the report, say so plainly and, if possible, point the user to the closest relevant section. Do not invent facts, statistics, dates, or quotes that are not in the report.
- You are not a lawyer or a government spokesperson. For official or legal matters, suggest the user consult the full report or the relevant authority.
- Stay on topic: this report and Jamaica's national A.I. policy. Politely decline unrelated requests.
- Use Jamaican/British spelling as in the report (e.g. "organisation", "programme") where natural.

REPORT CONTENT:
${buildDocumentContext()}`;
