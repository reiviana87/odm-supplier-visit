/**
 * Development seed — Phase 2 §29.
 *
 *   npm run seed -- --confirm
 *   npm run seed -- --confirm --reset
 *
 * Loads a development Supabase project with the fixtures the approved screens
 * were sized against: the 14 suppliers of `src/lib/mock-data/suppliers.ts`,
 * their contacts, HEBEI HUATONG's seven certificates, and the six reports of
 * `src/lib/mock-data/reports.ts`.
 *
 * ── One source of truth ──────────────────────────────────────────────────────
 * The records are NOT copied into this file. Node 22 strips TypeScript types at
 * load time, so the seed imports `src/lib/mock-data/*.ts` directly and reads the
 * same arrays the app reads; the only thing written here is the mapping from the
 * domain object onto its database columns. `registerHooks` below supplies the two
 * things Node's resolver does not know about a Next.js source tree — the `@/`
 * alias and extensionless relative imports — and nothing is transpiled or
 * generated, so the seed cannot drift from the fixtures.
 *
 * ── Why the service-role key ─────────────────────────────────────────────────
 * Seeding runs with no signed-in user, and every table carries the 0004 policies,
 * which decide what a *profile* may write. There is no profile here, so every
 * insert would be refused. This is the one place in the codebase where bypassing
 * RLS is the correct answer rather than a shortcut — the app itself never uses
 * this key. Rows therefore land with `created_by`/`updated_by` null, which 0003
 * already describes as the service-role import case.
 *
 * ── Safety (§36 — never drop production-like data without approval) ──────────
 * The target project is printed before anything is written; `--confirm` is
 * required; a target that already holds rows is refused unless `--reset` is also
 * passed; and `--reset` deletes ONLY the rows this script created — rows it does
 * not recognise are reported and left alone, never cleared.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", "src");

// ─────────────────────────────────────────────────────────────────────────────
// Reading the TypeScript fixtures
//
// Registered before the first `await import()` below, which is why those imports
// are dynamic: a static import would be evaluated before this runs.
// ─────────────────────────────────────────────────────────────────────────────

registerHooks({
  resolve(specifier, context, nextResolve) {
    const mapped = specifier.startsWith("@/")
      ? pathToFileURL(path.join(SRC, specifier.slice(2))).href
      : specifier;

    const relative = mapped.startsWith("./") || mapped.startsWith("../");
    const fromFile = context.parentURL?.startsWith("file:") ?? false;
    if (!mapped.startsWith("file:") && !(relative && fromFile)) {
      return nextResolve(mapped, context);
    }

    const url = new URL(mapped, context.parentURL);
    const target = fileURLToPath(url);
    if (!existsSync(target) && existsSync(`${target}.ts`)) {
      return nextResolve(pathToFileURL(`${target}.ts`).href, context);
    }
    return nextResolve(url.href, context);
  },
});

// Node re-parses each fixture as ESM because package.json declares no
// `"type": "module"`. Adding that field would change how every other plain .js
// file in the app is interpreted, to save a warning on a development script.
const inheritedWarningListeners = process.listeners("warning");
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (warning.code === "MODULE_TYPELESS_PACKAGE_JSON") return;
  for (const listener of inheritedWarningListeners) listener(warning);
});

/** Loads one module of the app's own source by its path below `src/`. */
function loadSource(relativePath) {
  return import(pathToFileURL(path.join(SRC, relativePath)).href);
}

const { getSupabaseUrl, getServiceRoleKey, isSupabaseConfigured, isMockMode } =
  await loadSource("lib/supabase/env.ts");
const { SUPPLIERS } = await loadSource("lib/mock-data/suppliers.ts");
const { CERTIFICATES_BY_SUPPLIER } = await loadSource("lib/mock-data/certificates.ts");
const { TEAM } = await loadSource("lib/mock-data/profiles.ts");
const { REPORTS, getReport } = await loadSource("lib/mock-data/reports.ts");

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic identifiers
//
// Nothing in the seed has a natural key the database enforces: `supplier_code`
// is unique but null on every fixture, and two suppliers may legitimately share
// a legal name. So the seed derives a UUID v5 from the fixture's own id, which
// makes every row addressable across runs: an upsert on the primary key cannot
// duplicate, `--reset` knows exactly which rows are its own, and a report can
// reference the supplier it belongs to without a lookup.
// ─────────────────────────────────────────────────────────────────────────────

/** RFC 4122 §Appendix C — the URL namespace. */
const UUID_URL_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

function uuidV5(name, namespace) {
  const namespaceBytes = Buffer.from(namespace.replaceAll("-", ""), "hex");
  const digest = createHash("sha1")
    .update(Buffer.concat([namespaceBytes, Buffer.from(name, "utf8")]))
    .digest();

  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

const SEED_NAMESPACE = uuidV5(
  "https://ebara.com/odm-supplier-visit/seed",
  UUID_URL_NAMESPACE,
);

/** `seedId("supplier", "huatong")` — stable for the life of the fixture id. */
function seedId(kind, fixtureId) {
  return uuidV5(`${kind}:${fixtureId}`, SEED_NAMESPACE);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture strings → database columns
//
// The fixtures hold the *display* forms the approved screens render, because
// that is what Phase 1 needed. `date` columns want ISO. Both converters are the
// inverse of the ones in src/lib/data/supplier-mappers.ts, and both throw on a
// value they do not recognise rather than writing null over it.
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthNumber(name, source) {
  const index = MONTHS.indexOf(name);
  if (index < 0) throw new Error(`Unrecognised month in seed date "${source}"`);
  return String(index + 1).padStart(2, "0");
}

/** `"Aug 12, 2026"` → `"2026-08-12"` (toDisplayDate, reversed). */
function fromDisplayDate(value) {
  if (!value) return null;
  const match = /^([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})$/.exec(value.trim());
  if (!match) throw new Error(`Seed date is not "Mon D, YYYY": "${value}"`);
  return `${match[3]}-${monthNumber(match[1], value)}-${match[2].padStart(2, "0")}`;
}

/** `"18 Mar 2024"` → `"2024-03-18"` (toCertificateDate, reversed). */
function fromCertificateDate(value) {
  if (!value) return null;
  const match = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(value.trim());
  if (!match) throw new Error(`Seed certificate date is not "D Mon YYYY": "${value}"`);
  return `${match[3]}-${monthNumber(match[2], value)}-${match[1].padStart(2, "0")}`;
}

/**
 * The fixtures write wall-clock timestamps with no zone, deliberately: they are
 * story values, not instants. A `timestamptz` column has to pick one, so the
 * seed states UTC rather than inheriting whatever zone the database session
 * happens to be in — the same run must produce the same row everywhere.
 */
function toUtcInstant(value) {
  if (!value) return null;
  return /(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
}

/** The domain model stores "not provided" as ""; the column stores null. */
function nullIfEmpty(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row builders
// ─────────────────────────────────────────────────────────────────────────────

function supplierRow(supplier) {
  return {
    id: seedId("supplier", supplier.id),

    // The §8.1 data-sheet block, in the Excel's own order.
    legal_name: supplier.legalName,
    chinese_name: supplier.chineseName,
    supplier_code: supplier.supplierCode,
    established_year: supplier.establishedYear,
    company_capital: supplier.companyCapital,
    employees: supplier.employees,
    factory_size_m2: supplier.factorySizeM2,
    certifications: supplier.certifications,
    production_capacity: supplier.productionCapacity,
    president_name: supplier.presidentName,
    website_url: supplier.websiteUrl,
    country: supplier.country,
    region: supplier.region,
    city: supplier.city,
    address: supplier.address,
    tel: supplier.tel,
    contact_name: supplier.contactName,
    contact_title: supplier.contactTitle,
    contact_wechat: supplier.contactWechat,
    contact_email: supplier.contactEmail,
    track_record_ebara: supplier.trackRecordEbara,

    // The Phase 2 commercial / capability block.
    annual_revenue: supplier.annualRevenue,
    ownership_type: supplier.ownershipType,
    main_markets: supplier.mainMarkets,
    main_products: supplier.mainProducts,
    production_capabilities: supplier.productionCapabilities,

    short_name: supplier.shortName,
    status: supplier.status,
    data_sheet_state: supplier.dataSheetState,
    product_categories: supplier.productCategories,
    internal_notes: supplier.internalNotes,
    last_visit_date: fromDisplayDate(supplier.lastVisitDate),

    created_at: toUtcInstant(supplier.createdAt),
    updated_at: toUtcInstant(supplier.updatedAt),
    archived_at: toUtcInstant(supplier.archivedAt),
    // No profile exists at seed time — see the header.
    created_by: null,
    updated_by: null,
  };
}

function contactRow(supplier, contact) {
  return {
    id: seedId("supplier-contact", contact.id),
    supplier_id: seedId("supplier", supplier.id),
    name: contact.name,
    role: contact.role,
    email: contact.email,
    phone: contact.phone,
    wechat: contact.wechat,
    is_primary: contact.isPrimary,
    sort_order: contact.sortOrder,
    created_by: null,
  };
}

function certificateRow(supplierFixtureId, certificate) {
  return {
    id: seedId("supplier-certificate", certificate.id),
    supplier_id: seedId("supplier", supplierFixtureId),
    name: certificate.name,
    number: nullIfEmpty(certificate.number),
    issue_date: fromCertificateDate(certificate.issueDate),
    expiration_date: fromCertificateDate(certificate.expirationDate),
    status: certificate.status,
    file_name: certificate.fileName,
    // The seed uploads nothing: `file_name` records that a copy was collected
    // during the visit, and the Certificates tab renders it, but there is no
    // object in the `supplier-files` bucket to point at.
    storage_path: null,
    notes: certificate.notes,
    sort_order: certificate.sortOrder,
    created_by: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Command line
// ─────────────────────────────────────────────────────────────────────────────

const USAGE = `
Seed a DEVELOPMENT Supabase project with the ODM Supplier Visit fixtures.

  npm run seed -- --confirm           create what is missing
  npm run seed -- --confirm --reset   delete this seed's own rows first

  --confirm   required. Without it the script prints the target and exits.
  --reset     delete the rows this seed previously created, then re-create
              them. Rows the seed does not recognise are never deleted.
  --help      this text.

NEVER point this at production. It writes with the service-role key and
bypasses row level security.
`.trim();

const flags = new Set(process.argv.slice(2));
const unknownFlags = [...flags].filter(
  (flag) => !["--confirm", "--reset", "--help", "-h"].includes(flag),
);

if (flags.has("--help") || flags.has("-h")) {
  console.log(USAGE);
  process.exit(0);
}

if (unknownFlags.length > 0) {
  fatal(`Unknown option(s): ${unknownFlags.join(", ")}\n\n${USAGE}`);
}

const confirmed = flags.has("--confirm");
const reset = flags.has("--reset");

function fatal(message) {
  console.error(`\nseed: ${message}\n`);
  process.exit(1);
}

// Everything below runs under top-level await, so a throw arrives here as an
// unhandled rejection. An operator who pointed this at the wrong project, or
// whose migrations are not applied, should read one line — not a stack trace
// into PostgREST. Registered after the fixtures have loaded on purpose: a
// failure to parse them is a bug in this repo and deserves the full stack.
process.on("unhandledRejection", (reason) => {
  fatal(reason instanceof Error ? reason.message : String(reason));
});

/** Unwraps a PostgREST reply, failing loudly with the context of the call. */
function must(result, what) {
  if (result.error) {
    const { code, message, details, hint } = result.error;
    throw new Error(
      [`${what} failed`, code && `[${code}]`, message, details, hint]
        .filter(Boolean)
        .join(" · "),
    );
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Preflight
// ─────────────────────────────────────────────────────────────────────────────

if (!isSupabaseConfigured()) {
  fatal(
    "Supabase is not configured. NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY still hold the .env.example placeholders, so " +
      "there is no project to seed. Fill in .env.local and run this again.",
  );
}

const supabaseUrl = getSupabaseUrl();

// The banner comes before every other check, including the service-role one:
// the operator's first question is always "which project is this about to
// write to", and they must be able to answer it from any run of the script,
// including the ones that go on to refuse.
console.log("");
console.log("  ODM Supplier Visit — development seed");
console.log(`  target    ${supabaseUrl}`);
console.log(`  mode      ${reset ? "--reset (re-create this seed's rows)" : "create what is missing"}`);
if (isMockMode()) {
  console.log("  note      the app is still on mock data (NEXT_PUBLIC_USE_MOCK_DATA)");
}
console.log("");

const serviceRoleKey = getServiceRoleKey();

if (!serviceRoleKey) {
  fatal(
    "SUPABASE_SERVICE_ROLE_KEY is empty in .env.local. Seeding runs without a " +
      "signed-in user, so it needs the service-role key to get past row level " +
      "security. Copy it from Project Settings › API › service_role.",
  );
}

if (!confirmed) {
  fatal(
    "refusing to write without --confirm.\n\n" +
      "        Check the target URL above. If that is the project you mean to\n" +
      "        seed — and it is NOT production — run:\n\n" +
      "          npm run seed -- --confirm",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const supplierIds = SUPPLIERS.map((supplier) => seedId("supplier", supplier.id));
const documentNumbers = REPORTS.map((report) => report.documentNumber);

const existingSuppliers = must(
  await supabase.from("suppliers").select("id").in("id", supplierIds),
  "reading the seeded suppliers",
).data;

const existingReports = must(
  await supabase.from("reports").select("id, document_number").in("document_number", documentNumbers),
  "reading the seeded reports",
).data;

const totalSuppliers = must(
  await supabase.from("suppliers").select("*", { count: "exact", head: true }),
  "counting suppliers",
).count;

const totalReports = must(
  await supabase.from("reports").select("*", { count: "exact", head: true }),
  "counting reports",
).count;

const foreignSuppliers = totalSuppliers - existingSuppliers.length;
const foreignReports = totalReports - existingReports.length;

console.log(`  found     ${totalSuppliers} supplier(s), ${totalReports} report(s)`);
if (foreignSuppliers > 0 || foreignReports > 0) {
  console.log(
    `            of which ${foreignSuppliers} supplier(s) and ${foreignReports} report(s) ` +
      "were not created by this seed",
  );
}
console.log("");

if (totalSuppliers + totalReports > 0 && !reset) {
  fatal(
    "the target already holds data — refusing to write into it.\n\n" +
      "        This is the §36 guard: a project with rows in it may be a real one.\n" +
      "        If this is a development project and you accept that the seed's own\n" +
      "        rows will be deleted and re-created, run:\n\n" +
      "          npm run seed -- --confirm --reset\n\n" +
      "        --reset never deletes rows it did not create.",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset — this seed's own rows, and nothing else
// ─────────────────────────────────────────────────────────────────────────────

if (reset) {
  if (existingReports.length > 0) {
    // Cascades to members, sections, observations, target products and images.
    must(
      await supabase.from("reports").delete().in("document_number", documentNumbers),
      "deleting the seeded reports",
    );
  }

  if (existingSuppliers.length > 0) {
    // Cascades to contacts, certificates and supplier files. `reports.supplier_id`
    // is ON DELETE RESTRICT, so a supplier still referenced by a report this seed
    // did not create is protected by the database — report that plainly instead
    // of letting a raw foreign-key error out.
    const deletion = await supabase.from("suppliers").delete().in("id", supplierIds);
    if (deletion.error?.code === "23503") {
      fatal(
        "a seeded supplier is still referenced by a report this seed did not create.\n\n" +
          "        Deleting it would take that report's visit history with it, so the\n" +
          "        database refused. Remove or reassign that report by hand first.",
      );
    }
    must(deletion, "deleting the seeded suppliers");
  }

  console.log(
    `  reset     removed ${existingReports.length} report(s) and ${existingSuppliers.length} supplier(s)`,
  );
  if (foreignSuppliers > 0 || foreignReports > 0) {
    console.log(
      `            left ${foreignSuppliers} supplier(s) and ${foreignReports} report(s) alone — not this seed's`,
    );
  }

  existingSuppliers.length = 0;
  existingReports.length = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suppliers, contacts, certificates
//
// Upsert on the primary key: re-running refreshes a row to match the fixture
// rather than adding a second copy of it. The 0001 `set_updated_at` trigger fires
// on the update path, so a supplier that was already present comes back with
// `updated_at = now()` instead of the fixture's own value.
// ─────────────────────────────────────────────────────────────────────────────

const alreadySeeded = new Set(existingSuppliers.map((row) => row.id));

must(
  await supabase.from("suppliers").upsert(SUPPLIERS.map(supplierRow), { onConflict: "id" }),
  "writing suppliers",
);

const contactRows = SUPPLIERS.flatMap((supplier) =>
  supplier.contacts.map((contact) => contactRow(supplier, contact)),
);
if (contactRows.length > 0) {
  must(
    await supabase.from("supplier_contacts").upsert(contactRows, { onConflict: "id" }),
    "writing supplier contacts",
  );
}

const certificateRows = Object.entries(CERTIFICATES_BY_SUPPLIER).flatMap(
  ([supplierFixtureId, certificates]) =>
    certificates.map((certificate) => certificateRow(supplierFixtureId, certificate)),
);
if (certificateRows.length > 0) {
  must(
    await supabase.from("supplier_certificates").upsert(certificateRows, { onConflict: "id" }),
    "writing supplier certificates",
  );
}

const suppliersCreated = SUPPLIERS.length - alreadySeeded.size;
console.log(
  `  suppliers ${suppliersCreated} created, ${alreadySeeded.size} refreshed ` +
    `· ${contactRows.length} contact(s) · ${certificateRows.length} certificate(s)`,
);

// ─────────────────────────────────────────────────────────────────────────────
// Reports
//
// Through `create_report_with_snapshot`, never a bare insert: the RPC is what the
// New Report modal calls, so a seeded report gets the same frozen §8.3 snapshot
// and the same thirteen section rows as one created in the app. It generates its
// own id, so `document_number` — which is UNIQUE — is what makes this idempotent.
// ─────────────────────────────────────────────────────────────────────────────

const alreadyCreated = new Set(existingReports.map((row) => row.document_number));

/**
 * The profile behind a fixture's employee/owner name, when that person has
 * actually signed in. Profiles are created by `handle_new_user()` from a real
 * auth.users row, which the seed neither has nor invents — so this is null on a
 * fresh project and the attendee names still reach the report through
 * `p_members`, which is free text.
 */
const teamEmails = new Map(TEAM.map((member) => [member.fullName, member.email]));
const profiles = must(
  await supabase.from("profiles").select("id, email").in("email", [...teamEmails.values()]),
  "reading profiles",
).data;
const profileIdByEmail = new Map(profiles.map((row) => [row.email, row.id]));

function profileIdFor(fullName) {
  const email = teamEmails.get(fullName);
  return (email && profileIdByEmail.get(email)) ?? null;
}

let reportsCreated = 0;
for (const summary of REPORTS) {
  if (alreadyCreated.has(summary.documentNumber)) continue;

  const report = getReport(summary.id);
  if (!report) throw new Error(`Report fixture ${summary.id} has no detail record`);

  const created = await supabase.rpc("create_report_with_snapshot", {
    p_document_number: report.documentNumber,
    p_supplier_id: seedId("supplier", report.supplierId),
    p_status: report.status,
    p_visit_date: fromDisplayDate(report.visitDate),
    p_period: report.period,
    p_employee_id: profileIdFor(report.employee),
    p_owner_id: profileIdFor(report.reportOwner),
    p_location: report.location,
    p_start_time: report.startTime,
    p_end_time: report.endTime,
    p_project: report.project,
    p_business_unit: report.businessUnit,
    p_product_category: report.productCategory,
    p_members: report.members,
  });

  if (created.error?.code === "42501") {
    fatal(
      "the service role may not execute create_report_with_snapshot.\n\n" +
        "        0005 grants EXECUTE to `authenticated` only. Grant it to the service\n" +
        "        role as well, then re-run:\n\n" +
        "          grant execute on function public.create_report_with_snapshot(\n" +
        "            text, uuid, public.report_status, date, text, uuid, uuid, text,\n" +
        "            time, time, text, text, text, text[]\n" +
        "          ) to service_role;",
    );
  }
  must(created, `creating report ${report.documentNumber}`);
  reportsCreated += 1;
}

console.log(
  `  reports   ${reportsCreated} created, ${alreadyCreated.size} already present ` +
    "· each with its §8.3 snapshot and 13 empty sections",
);

if (profileIdByEmail.size < teamEmails.size) {
  console.log(
    `  note      ${teamEmails.size - profileIdByEmail.size} of ${teamEmails.size} team members have no ` +
      "profile yet — their reports carry no employee/owner until they sign in",
  );
}

console.log("\n  done.\n");
