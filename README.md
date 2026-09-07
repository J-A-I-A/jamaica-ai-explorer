# National A.I. Policy Explorer — Jamaica

An interactive Next.js site built around *National Artificial Intelligence — Policy Recommendations*,
prepared by Jamaica's National Artificial Intelligence Task Force and presented to the Office of the
Prime Minister.

## Run it

```bash
yarn install
yarn run dev      # http://localhost:3000
```

Production build:

```bash
yarn run build && yarn start
```

## Configuration

Every setting is read from the environment **at runtime**. Nothing is inlined at
build time, so a single Docker image can be built once and promoted across
environments by changing environment variables alone — no rebuild, no republish.
Copy `.env.example` to `.env.local` for local development.

| Variable | Used by | Notes |
| --- | --- | --- |
| `MODEL_API_KEY` / `OPENAI_BASE_URL` / `MODEL` | `/api/chat` | Any OpenAI-compatible endpoint. Absent, the assistant returns 503. |
| `RECAPTCHA_SITE_KEY` | `/feedback` | Public reCAPTCHA v2 site key. Read server-side and passed to the form as a prop. Absent, the checkbox is not rendered. |
| `RECAPTCHA_SECRET_KEY` | `/api/feedback` | Server-side verification secret. **Absent in production, the API logs an error and refuses submissions**; in development it warns and accepts them. |
| `POSTGRES_URL` (+ `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_SSL`) | `/api/feedback` | The only place feedback is ever stored. Absent, the API refuses submissions up front — nothing is written anywhere. |

Set `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` together. With only the
secret set the form has no checkbox to complete and every submission is
rejected; with only the site key set, production refuses submissions anyway.

### Why `RECAPTCHA_SITE_KEY` has no `NEXT_PUBLIC_` prefix

Next.js substitutes `NEXT_PUBLIC_*` variables into the client bundle when the
app is compiled, which would pin the reCAPTCHA key to the image and force a
rebuild to rotate it. Instead `src/app/feedback/page.tsx` is a Server Component
that reads `process.env.RECAPTCHA_SITE_KEY` per request and hands it to
`<FeedbackQuiz siteKey={...} />`. The page is marked `force-dynamic` so it is
never prerendered with a build-time value.

The site key is public by design — it is visible in the rendered page, as it has
to be. Only `RECAPTCHA_SECRET_KEY` is a secret.

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
