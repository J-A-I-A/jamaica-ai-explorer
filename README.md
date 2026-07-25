# National A.I. Policy Explorer — Jamaica

An interactive Next.js site built around *National Artificial Intelligence — Policy Recommendations*,
prepared by Jamaica's National Artificial Intelligence Task Force and presented to the Office of the
Prime Minister.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

Production build:

```bash
npm run build && npm start
```

## Routes

| Route | What it does |
| --- | --- |
| `/` | Hero, vision statement, nine pillars, horizon counts, global themes |
| `/explore` | Interactive explorer — full-text search with match highlighting, multi-select horizon and pillar filters, grouped or flat views |
| `/explore/[slug]` | Detail page per pillar: policy issue, challenges, recommendations grouped by horizon, prev/next navigation |
| `/roadmap` | The recommended action plan as a pillar × horizon matrix; click a horizon to isolate it |
| `/swot` | SWOT analysis; click a quadrant to expand it full-width |
| `/ethics` | Ethical considerations, comparative global themes, references |
| `/task-force` | Chair, the sixteen members, and the mandate |

All nine pillar pages are statically generated via `generateStaticParams`.

## Content model

Everything the site renders lives in two typed data files — no CMS, no fetching:

- `src/data/recommendations.ts` — the nine pillars, each with policy issue, objective, challenges and
  recommendations tagged `short` | `medium` | `long`. Derived exports (`ALL_ACTIONS`, `COUNTS`) power
  the explorer and the stat blocks, so counts can never drift from the content.
- `src/data/context.ts` — SWOT, ethical considerations, global thematic areas, task force roster,
  references.

To amend the policy content, edit those two files; every page, filter and count updates from them.

## Design

Jamaican national palette — black ground, gold (`#ffb400`) as the primary accent, green (`#009b3a`)
as secondary — defined as CSS custom properties in `src/app/globals.css` and exposed to Tailwind v4
via `@theme inline` (`bg-jm-ink`, `text-jm-gold`, and so on). Display type is Space Grotesk, body is
Inter.

## Provenance

Content is transcribed from the source PDF (`../National-Artificial-Intelligence-Task-Force-Policy-Recommendations.pdf`).
Recommendation wording follows the Recommended Action Plan table where the document's body text and
table differ in spelling.
