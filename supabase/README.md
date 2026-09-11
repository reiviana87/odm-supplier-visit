# Supabase — ODM Supplier Visit

Database schema for the EBARA Global Sourcing Office visit-report app.

```
supabase/
  migrations/
    0001_initial_schema.sql       enums, 17 tables, indexes, triggers, storage buckets
    0002_row_level_security.sql   RLS baseline for Phase 1
```

Phase 1 ships with `NEXT_PUBLIC_USE_MOCK_DATA=true`, so the app renders the approved
screens from `src/lib/mock-data` and never calls Supabase. Everything below is needed only
when you switch that flag off.

---

## 1. Create the project

1. <https://supabase.com/dashboard> → **New project**.
2. Region: pick the one closest to the office (`eu-central-1` for Brescia).
3. Save the database password — it is shown once.
4. Wait for provisioning to finish before running anything.

The schema targets PostgreSQL 15+. It uses `gen_random_uuid()`, which is part of core
PostgreSQL from 13 onwards, so no extension has to be enabled by hand.

---

## 2. Run the migrations

Order matters: `0001` creates the tables, `0002` makes them reachable. Between the two, RLS
is not yet enabled and the tables are open to any key that can reach them — do not stop
after `0001`.

### Option A — dashboard SQL editor

1. **SQL Editor** → **New query**.
2. Paste the whole of `migrations/0001_initial_schema.sql`, **Run**.
3. New query, paste `migrations/0002_row_level_security.sql`, **Run**.

Both files are idempotent enough to re-run on a fresh project only. `0001` will fail on a
second run (the types and tables already exist); `0002` can be re-run at any time.

### Option B — Supabase CLI

```bash
npm install -g supabase          # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

`supabase db push` applies every file in `migrations/` in filename order. To reset a local
or throwaway database and replay both files from scratch:

```bash
supabase db reset
```

### Verify

```sql
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;          -- expect 17 rows

select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;             -- rowsecurity must be true everywhere

select id from storage.buckets order by id;                 -- report-images, report-files, supplier-files
```

---

## 3. Environment variables

Copy `.env.example` to `.env.local` in the project root (it is gitignored) and fill in the
values from **Project Settings › API**:

| Variable | Where it comes from | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | safe in the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / publishable key | safe in the browser — RLS is what protects the data |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key | **server only**, bypasses RLS, never prefix it with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | this deployment's origin | used to build auth redirect URLs |
| `NEXT_PUBLIC_USE_MOCK_DATA` | `true` in Phase 1 | set to `false` to read from Supabase |

Add the same variables to the hosting provider's environment (Vercel → Project Settings →
Environment Variables) before deploying with `NEXT_PUBLIC_USE_MOCK_DATA=false`.

Under **Authentication › URL Configuration**, set the Site URL and add
`<origin>/auth/callback` to the redirect allow-list.

---

## 4. Regenerate `src/types/database.ts`

The typed schema is generated from the live database, never written by hand. After any
migration:

```bash
npx supabase gen types typescript --project-id <your-project-ref> \
  > src/types/database.ts
```

Or, against a local stack:

```bash
npx supabase gen types typescript --local > src/types/database.ts
```

Then run `npm run typecheck`. The generated file must stay consistent with
`src/types/domain.ts`, which is the hand-written application model — if a column is renamed
in a migration, both the generated file and the domain type have to move together.

---

## 5. What the schema encodes

Three decisions in the schema are behavioural, not structural, and are commented in the SQL:

- **`reports.company_information`** is a frozen JSON snapshot of the supplier record taken
  when the report was created (README §8.3). §2 Company Information and the DOCX export read
  it, never the live `suppliers` row: a report is a record of what was true at the visit
  date. It is rewritten only when the author explicitly runs *Refresh from supplier record*.
- **Completion percentage is not stored** (README §6.2). It is computed from the 13 section
  predicates every time it is displayed, so the dashboard, the reports table and the editor
  cannot disagree.
- **`report_images` has no unique constraint on `(report_id, region, sort_order)`**, only an
  index. Drag-to-reorder rewrites several rows in one transaction and necessarily passes
  through a state where two cards share a position.

## 6. Row level security in Phase 1

`0002` applies one uniform rule set to all 17 tables and to the three storage buckets:

- any authenticated user may **select**, **insert** and **update**;
- **delete** is restricted to the row's `created_by`, or to a profile whose role is `admin`
  or `manager`;
- anonymous users get nothing.

The four roles from README §13/§18 exist in the schema and in Settings, but nothing beyond
the delete guard enforces them yet. Per-report membership rules — only the members of a
report may read or edit it, viewers read-only, `in_review`/`final`/`archived` locked against
editing — replace these policies in a later phase.

New users are created as `viewer` by the `handle_new_user()` trigger on `auth.users`. An
admin promotes them in **Settings › Members**; signing up grants no write access on its own.
