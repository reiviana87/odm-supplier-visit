# Development seed — `scripts/seed.mjs`

Loads a **development** Supabase project with the fixtures the approved screens were sized
against, so the app has something to render once `NEXT_PUBLIC_USE_MOCK_DATA` is turned off.

> ## ⚠ Never point this at production
>
> The seed writes with the **service-role key**, which bypasses row level security
> entirely. It also deletes rows when `--reset` is passed. Read the `target` line it prints
> before you type `--confirm`, every time.
>
> **This script has never been executed.** No Supabase project is connected to the repo yet
> (`.env.local` still holds the `.env.example` placeholders), so everything below describes
> what the code does, verified by reading it — not by running it.

---

## 1. Run it

```bash
npm run seed -- --confirm           # create what is missing
npm run seed -- --confirm --reset   # delete this seed's own rows first, then re-create
npm run seed -- --help              # usage
```

`npm run seed` is `node --env-file=.env.local scripts/seed.mjs`, so `.env.local` must
already hold the project URL, the anon key and the service-role key. Migrations `0001`
through `0005` must be applied first — the seed calls a function that `0005` defines.

### Flags

| Flag | Effect |
| --- | --- |
| *(none)* | Prints the target project and exits without writing. This is the default. |
| `--confirm` | Required for any write. Without it the script refuses, by design. |
| `--reset` | Deletes the rows **this seed** previously created, then re-creates them. Rows it does not recognise are counted, reported and left alone. |
| `--help`, `-h` | Usage text. |

Any other argument is rejected before a connection is opened.

### What it refuses to do

* No `--confirm` → prints the target, exits 1.
* `SUPABASE_SERVICE_ROLE_KEY` empty → exits 1 with the reason.
* Supabase not configured at all → exits 1.
* **Target already holds suppliers or reports and `--reset` was not passed → exits 1.**
  A project with rows in it may be a real one.

---

## 2. What it creates

Read from `src/lib/mock-data/*` — the same arrays the app renders. Nothing is copied into
the seed script; only the mapping from the domain object onto its database columns lives
there, so the fixtures and the seed cannot drift apart. Node 22 strips the TypeScript types
at load time and a `registerHooks` resolver supplies the `@/` alias and extensionless
relative imports that Node's own resolver does not know about.

| What | Count | Source |
| --- | --- | --- |
| `suppliers` | 14 | `mock-data/suppliers.ts` |
| `supplier_contacts` | 15 | the `contacts` array of each supplier |
| `supplier_certificates` | 7 | `mock-data/certificates.ts` — HEBEI HUATONG only |
| `reports` | 6 | `mock-data/reports.ts`, via the RPC (below) |
| `report_members`, `report_sections` | per report | created by the RPC |

Reports are created through `public.create_report_with_snapshot(...)` — never a bare insert —
because that is the function the New Report modal calls. Each seeded report therefore gets
the same frozen §8.3 supplier snapshot (`company_information` + `snapshot_taken_at`) and the
same **thirteen empty section rows** as a report created in the app, plus one
`report_members` row per attendee chip.

Two deliberate gaps:

* **No files are uploaded.** `supplier_certificates.file_name` records that a copy was
  collected during the visit and the Certificates tab renders it, but there is no object in
  the `supplier-files` bucket behind it and `storage_path` stays null.
* **No auth users or profiles are created.** A report's `employee_id` / `owner_id` are
  resolved by looking up the `TEAM` fixture's e-mail addresses in `profiles`; on a fresh
  project nobody has signed in, so both stay null and the script says how many were missing.
  The attendee names still reach the report through `p_members`, which is free text.

Display values are converted back to column types on the way in — `"Aug 12, 2026"` →
`2026-08-12`, `"18 Mar 2024"` → `2024-03-18`, zone-less fixture timestamps are stated as
UTC — and each converter throws on a value it does not recognise rather than writing null
over it.

---

## 3. Why the service-role key

Seeding runs with no signed-in user. Every table carries the `0004` policies, which decide
what a **profile** may write; there is no profile, so every insert would be refused. This is
the one place in the codebase where bypassing RLS is the right answer rather than a
shortcut — the app itself never uses this key. Rows land with `created_by` / `updated_by`
null, which `0003` already describes as the service-role import case.

One grant is likely to be missing on a new project: `0005` grants `EXECUTE` on
`create_report_with_snapshot` to `authenticated` only. The seed detects the resulting
`42501` and prints the exact `grant execute … to service_role;` statement to run.

---

## 4. How it stays idempotent

Nothing in the fixtures has a natural key the database enforces (`supplier_code` is unique
but null on every fixture, and two suppliers may legitimately share a legal name), so the
seed **derives a UUID v5** from each fixture's own id inside a namespace of its own:

```
namespace = uuidv5("https://ebara.com/odm-supplier-visit/seed", URL namespace)
id        = uuidv5("supplier:huatong", namespace)      # stable across runs and machines
```

Consequences:

* Suppliers, contacts and certificates are **upserted on the primary key** — re-running
  refreshes a row to match the fixture instead of adding a second copy of it. The `0001`
  `set_updated_at` trigger fires on the update path, so an already-present supplier comes
  back with `updated_at = now()` rather than the fixture's own value.
* A report can reference its supplier without a lookup.
* Reports are created by RPC, which generates its own id, so the **unique
  `document_number`** is what makes them idempotent: a report whose number already exists is
  skipped.
* `--reset` knows exactly which rows are its own — suppliers by derived id, reports by
  document number — and deletes only those. Deleting a report cascades to its members,
  sections, observations, target products and images; deleting a supplier cascades to its
  contacts, certificates and files. `reports.supplier_id` is `ON DELETE RESTRICT`, so if a
  seeded supplier is still referenced by a report the seed did not create, the database
  refuses and the script explains that instead of printing a raw foreign-key error.
