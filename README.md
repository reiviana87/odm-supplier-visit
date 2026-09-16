# ODM Supplier Visit

A desktop web application for EBARA's **Global Sourcing Office (GSO)** that turns a
factory visit into a corporate DOCX visit report.

A visit report is a 13-section document (`GSO-YYMMNNNxNN`) built from typed content, AI
drafts derived from a Plaud voice transcript, supplier master data, certificates and up to
~50 photographs laid out in a Word appendix. A secondary **Visit Mode** runs on a phone
inside the factory to capture photos, notes and observations that sync into the report.

**Primary user:** the sourcing engineer who runs the visit and writes the report.
**Secondary:** the manager who reviews it, and colleagues who read past reports.

---

## Current phase

**Phase 1 — technical foundation and approved application shell.** See
[What is intentionally not implemented](#what-is-intentionally-not-implemented-yet).

The approved design in [`design-handoff/`](./design-handoff) is the source of truth.
`design-handoff/README.md` is the behavioural and visual specification;
`design-handoff/ODM Supplier Visit.dc.html` is the approved prototype (exact px values);
`design-handoff/screenshots/` holds the 21 approved captures used for visual validation.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19, Server Components) |
| Language | TypeScript, `strict` |
| Styling | Tailwind CSS v4 + the Industry design tokens in `src/styles/tokens.css` |
| Data / auth / storage | Supabase (PostgreSQL, Auth, Storage) |
| Forms | react-hook-form + zod |
| Hosting | Vercel |

No component library. The approved design is its own system — square corners, 1px
hairlines, blueprint registration marks, Barlow / Barlow Condensed — and is implemented
directly in `src/components/ui`.

---

## Local development

Node **20.9+** is required (this repo was built against Node 22.20.0).

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app runs at <http://localhost:3000>. With `NEXT_PUBLIC_USE_MOCK_DATA=true` (the
default in `.env.example`) every screen renders from the seeded data in
`src/lib/mock-data` — **no Supabase project is needed to run or build Phase 1.**

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (`eslint-config-next`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify` | typecheck → lint → build, in that order |
| `npm run gen:placeholders` | Regenerate the visit-photo placeholders in `public/photos` |

---

## Environment variables

Copy `.env.example` to `.env.local`. Never commit `.env.local`.

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | for Supabase mode | Project URL from Supabase › Settings › API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for Supabase mode | Publishable key; safe in the browser — RLS is what protects the data |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | **Bypasses RLS.** Never prefix with `NEXT_PUBLIC_`, never import into a client component |
| `NEXT_PUBLIC_SITE_URL` | yes | Absolute origin; used to build auth redirect URLs |
| `NEXT_PUBLIC_USE_MOCK_DATA` | no | `true` (default) renders the seeded data and never calls Supabase |

---

## Supabase setup

1. Create a project at <https://supabase.com/dashboard>.
2. Run the migrations in order — see [`supabase/README.md`](./supabase/README.md):
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_row_level_security.sql`

   Either paste them into the dashboard SQL editor, or use the CLI:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
3. Put the URL and keys into `.env.local` and set `NEXT_PUBLIC_USE_MOCK_DATA=false`.
4. Regenerate the database types when the schema changes:

   ```bash
   supabase gen types typescript --project-id <your-project-ref> > src/types/database.ts
   ```

   `src/types/database.ts` is currently hand-written to match the Phase 1 migrations.

### Schema shape

`profiles` · `suppliers` · `supplier_contacts` · `supplier_certificates` ·
`supplier_files` · `reports` · `report_members` · `report_sections` ·
`report_observations` · `report_target_products` · `report_product_rows` ·
`report_images` · `report_files` · `report_ai_generations` · `report_exports` ·
`report_templates` · `template_placeholders`.

Two decisions worth knowing:

- **`reports.company_information` is a frozen supplier snapshot.** Handoff §8.3: a report
  is a record of what was true at the visit date, so §2 Company Information and the DOCX
  export read the snapshot, never the live supplier row. Refreshing it is an explicit,
  confirmed user action.
- **Report completion is never stored.** Handoff §6.2 defines it as
  `passing section predicates ÷ 13`, derived on read so the dashboard, the reports table
  and the editor can never disagree. The single implementation is
  `src/lib/reports/completion.ts`.

---

## Deployment

The app is Vercel-ready with no extra configuration.

1. Import the repository at <https://vercel.com/new>.
2. Add the environment variables above to the Vercel project (Production and Preview).
3. Set `NEXT_PUBLIC_SITE_URL` to the deployment origin.
4. Add `<origin>/auth/callback` to Supabase › Authentication › URL Configuration.

Build command `npm run build`, output directory `.next` — both are the defaults.

---

## Folder structure

```
design-handoff/          the approved design bundle — source of truth, read-only
  README.md              behavioural + visual specification
  ODM Supplier Visit.dc.html   the approved prototype (exact px values)
  screenshots/           21 approved captures
  _ds/styles.css         the Industry design-system stylesheet

scripts/                 build-time utilities (photo placeholder generation)
supabase/migrations/     SQL schema, applied in filename order

src/
  app/
    (app)/               everything inside the approved desktop shell
    login/               §1.1 — the one screen carrying the product identity
    visit/               §17 — mobile Visit Mode, outside the desktop shell
    globals.css          Tailwind bridge + the ported design-system classes
    layout.tsx           fonts, metadata, ToastProvider
  components/
    ui/                  generic, reusable, domain-free
    layout/              sidebar, top bar, app shell
    reports/             report editor chrome and report-domain components
    suppliers/           supplier-domain components
    photos/              photo management components (Phase 3)
    ai/                  AI surfaces (Phase 4)
    mobile/              Visit Mode
    auth/                login form
  lib/
    supabase/            browser + server clients, env handling
    auth/                session, server actions, role architecture
    reports/             completion predicates, document numbering
    autosave/            the reusable autosave engine
    mock-data/           the seeded records the screens were sized against
    utils/
  styles/tokens.css      every design token, verbatim from the handoff
  types/                 domain model + generated-shape database types
```

---

## What is intentionally not implemented yet

Phase 1 deliberately stops at the foundation. The following are specified in the handoff
and have extension points in the code, but no behaviour:

- Anthropic API calls and every AI surface — transcript analysis, text rewriting, photo
  caption generation, conclusion generation (handoff §11–§13)
- Full photo management: upload pipeline, bulk captioning, drag reordering, the appendix
  layout calculator (handoff §10, §14)
- DOCX generation, Word template parsing and placeholder replacement (handoff §15, §16)
- Persisted autosave to Supabase and the IndexedDB offline queue (handoff §7) — the state
  machine and all five indicator states exist; only the transport is missing
- Camera capture and offline sync in Visit Mode (handoff §17)
- n8n, SharePoint, Teams and email workflows
- Advanced per-report permissions, knowledge-base search, supplier comparison, scorecards

### Where the spec and the approved capture disagree

Four places where README.md and the screenshots point different ways. Each was
resolved deliberately; raise any of them if the design intent was the other one.

| Point | Handoff §  | Approved capture | Implemented | Why |
|---|---|---|---|---|
| Supplier list default order | §19 "default company asc" | seed order (HUATONG first) | company asc | §19 states the behaviour explicitly; the capture shows a prototype with no sorting implemented |
| §1 word count | — | "2 paragraphs · 118 words" | computed live (87) | 118 is a static label in the prototype; 87 is the real count of the text it displays |
| Report completion | §6.2 "derived, never stored" | 68% on the list, 69% in the editor | 69% everywhere | one computation, as §6.2 requires — the two captured figures cannot both be right |
| Visit Mode supplier name | §17 "19px" | 22px | 22px | the prototype is the measured source; §17's figure does not match it |

Two more worth knowing:

- **Filter bar wrapping.** The reports filter bar carries the prototype's exact
  `min-width: 112px` and `flex-wrap: wrap`. At exactly 1280px — the shell's
  minimum — "Product Category" wraps to a second line; at the width the
  screenshots were captured it does not. That is the approved CSS behaving as
  written, not a layout defect.
- **Touch targets in Visit Mode.** Every button is ≥44px per §24, but the
  caption starters (30px) and observation category chips (~31px) are the
  approved sizes from screenshots 17b and 18. The approved geometry was kept
  rather than silently enlarged; §24 and those captures genuinely conflict.

### The visit photographs

The handoff references `assets/photos/f01–f22.jpg` but states they are **not bundled**
("real HUATONG visit photos used as seed content; not design assets"). Rather than
substitute unrelated stock imagery into a document that is a legal record of a visit,
`public/photos/` holds honest blueprint placeholders carrying each photo's id, category
and caption. Drop the real `f01.jpg … f22.jpg` into `public/photos/` and change the single
`photoSrc()` function in `src/lib/mock-data/photos.ts` to prefer `.jpg`.

---

## Next phase

**Phase 2 — report persistence.** Wire the report editor to Supabase: section patches
behind the existing autosave engine, the supplier snapshot copy on report creation, and
the reports/suppliers lists reading real rows instead of `src/lib/mock-data`. The build
order the handoff recommends (§25 "Priority screens") continues from there: photo
managers → appendix layout → export → transcript analysis and conclusion → Visit Mode
capture.
