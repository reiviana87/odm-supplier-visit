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
| `NEXT_PUBLIC_SUPABASE_URL` | for Supabase mode | Project URL from Supabase › Project Settings › API keys |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | for Supabase mode | Publishable key; safe in the browser — RLS is what protects the data |
| `SUPABASE_SECRET_KEY` | server only | **Bypasses RLS.** Never prefix with `NEXT_PUBLIC_`, never import into a client component |
| `NEXT_PUBLIC_SITE_URL` | yes | Absolute origin; used to build auth redirect URLs |
| `NEXT_PUBLIC_USE_MOCK_DATA` | no | `true` (default) renders the seeded data and never calls Supabase |

---

## Supabase setup

1. Create a project at <https://supabase.com/dashboard>.
2. Run the migrations **in order**, pasting each into the dashboard SQL editor (or
   `supabase db push` if you have the CLI). They are cumulative and must not be skipped:

   | # | File | What it adds |
   |---|---|---|
   | 0001 | `0001_initial_schema.sql` | 17 tables, 7 enums, triggers, the three private storage buckets |
   | 0002 | `0002_row_level_security.sql` | the uniform RLS baseline |
   | 0003 | `0003_phase2_schema.sql` | Phase 2 columns, indexes, the `report_sections.version` trigger |
   | 0004 | `0004_role_based_rls.sql` | replaces 0002 with the admin/manager/editor/viewer model |
   | 0005 | `0005_report_creation_rpc.sql` | `create_report_with_snapshot`, `refresh_report_snapshot` |
   | 0006 | `0006_photo_dimensions_and_transcripts.sql` | image dimensions, transcript text, storage object policies |

3. **Verify the result** — paste [`supabase/VALIDATE.sql`](./supabase/VALIDATE.sql) into
   the SQL editor. It is read-only and asserts every table, enum, function, trigger,
   column, unique index and bucket the application depends on. A clean CLI run is not
   evidence that the schema is right; this is.
4. Put the URL and keys into `.env.local` and set `NEXT_PUBLIC_USE_MOCK_DATA=false`.
5. Enable email sign-in under Authentication › Providers.
6. **Create the first administrator.** Every profile is born a `viewer` and only an admin
   may promote anyone, so a fresh project has nobody who can:

   ```bash
   npm run create-admin -- --email you@ebara.com
   ```

   It never sets a password — Supabase invites the user and they choose their own.
7. Seed the development data, after reading the target line it prints:

   ```bash
   npm run seed -- --confirm
   ```

8. Exercise the backend end to end:

   ```bash
   npm run validate:backend -- --confirm
   ```

   This signs in as one throwaway user per role and checks the RLS matrix, that report
   creation is atomic, that the supplier snapshot stops following the supplier, that the
   version trigger fires, and that a stale write is distinguishable from a forbidden one.
   It removes everything it creates.

9. Regenerate the database types when the schema changes:

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
2. Add the environment variables below to the Vercel project (Production and Preview).
   `SUPABASE_SECRET_KEY` and `ANTHROPIC_API_KEY` are server-only — never give either the
   `NEXT_PUBLIC_` prefix, which is what tells the bundler to inline a value into the
   browser bundle.

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | the project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key |
   | `SUPABASE_SECRET_KEY` | the secret key |
   | `NEXT_PUBLIC_USE_MOCK_DATA` | `false` |
   | `NEXT_PUBLIC_SITE_URL` | the production origin |
   | `ANTHROPIC_API_KEY` | the Anthropic key (optional — the app works without AI) |
   | `ANTHROPIC_MODEL` | optional; defaults to a current Sonnet-class model |

3. Set `NEXT_PUBLIC_SITE_URL` to the deployment origin and redeploy — environment
   changes do not apply to an existing build.
4. In Supabase › Authentication › URL Configuration set the Site URL to the exact
   production origin and add `<origin>/auth/callback` as a redirect URL, plus
   `http://localhost:3000/auth/callback` for local development.

Build command `npm run build`, output directory `.next` — both are the defaults.

### Verifying a deployment

Vercel reporting "Ready" is not the same as the application working. Sign in on the
deployed origin, create a supplier, create a report, edit a section and reload it,
upload a photograph, and export the Word file.

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

- **A corporate Word template.** The export generates its own professional A4 document
  (`src/lib/export/docx.ts`). The template tables and the placeholder vocabulary exist,
  but no `.dotx` has been supplied, so nothing claims to reproduce one. When a template
  arrives, the placement swaps at the call site and this generator stays as the fallback.
- **Plaud API integration and in-app audio transcription.** A transcript enters as text —
  pasted, or a `.txt`/`.md`. `.docx` and `.pdf` are refused by the picker rather than
  accepted and stored as something unreadable.
- **PDF export**, the advanced template designer, and a permissions administration UI.
- **Offline-first synchronisation.** Autosave holds a pending patch in memory and flushes
  it; there is no IndexedDB queue, and Visit Mode uploads need a connection.
- **HEIC/HEIF photographs.** Refused at the picker with the iPhone setting that fixes it,
  because Word cannot place them and a silently missing photograph is worse than a
  refused upload.
- **An in-app document preview.** Export the file to see it.
- n8n, SharePoint, Teams and email workflows; knowledge-base search; supplier scorecards.

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

**Phase 2 — supplier and report persistence — is implemented.** The data layer in
`src/lib/data` is the only module that queries Supabase; every screen reads through it.
Section patches run behind the existing autosave engine and match on the row version, so
a losing write surfaces as a conflict the user resolves rather than a silent overwrite.
The supplier snapshot is frozen server-side by `create_report_with_snapshot`.

**It has never run against a database.** No Supabase project is connected, so migrations
`0003`–`0005`, the role-based RLS in `0004`, the creation transaction, the `updated_at`
triggers and the whole write path are validated by reading only. `npm run seed` is
likewise unexecuted. Connect a project and work through
[`supabase/SEED.md`](supabase/SEED.md) before trusting any of it.

While no project is connected the app runs on the seeded data in `src/lib/mock-data`:
reads fall back inside the data layer, writes refuse with a visible message, and a banner
says so. Nothing outside `src/lib/data`, `src/lib/auth` and that banner knows mock mode
exists.

**Next.** The build order the handoff recommends (§25 "Priority screens") continues from
here: photo managers → appendix layout → export → transcript analysis and conclusion →
Visit Mode capture.
