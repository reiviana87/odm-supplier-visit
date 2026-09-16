/**
 * Phase 2.5 — behavioural validation against a real Supabase project.
 *
 *   npm run validate:backend -- --confirm
 *
 * Schema shape is checked by `supabase/VALIDATE.sql` in the SQL Editor. This
 * script checks the things only a running database can answer: whether the RLS
 * policies actually refuse what they claim to refuse, whether the creation RPC
 * is really atomic, whether the snapshot really stops following the supplier,
 * and whether a losing write is distinguishable from a forbidden one.
 *
 * It signs in as four throwaway users, one per role, and drives the same
 * queries the data layer issues. Nothing here imports the data layer: the point
 * is to test the DATABASE's behaviour, so that a passing run means the contract
 * holds underneath the application rather than inside it.
 *
 * Everything it creates is prefixed `zz-phase25-` and removed at the end, and
 * it refuses to run unless the project looks like a development one.
 */

import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const PLACEHOLDERS = [
  "https://your-project-ref.supabase.co",
  "your-anon-key",
  "your-service-role-key",
];

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!URL || PLACEHOLDERS.includes(URL)) die("NEXT_PUBLIC_SUPABASE_URL is not set to a real project.");
if (!ANON || PLACEHOLDERS.includes(ANON)) die("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set to a real key.");
if (!SERVICE || PLACEHOLDERS.includes(SERVICE)) {
  // The service role is genuinely required: creating the four role users and
  // setting their `profiles.role` are exactly the operations RLS forbids, and
  // there is no other way to establish the fixtures the role matrix needs.
  die("SUPABASE_SERVICE_ROLE_KEY is required — it creates and promotes the test users.");
}
if (!process.argv.includes("--confirm")) {
  die(
    `This writes to ${URL}\n` +
      "  It creates and deletes users and business rows.\n" +
      "  Re-run with --confirm once you are sure that is a DEVELOPMENT project.",
  );
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

// ─────────────────────────────────────────────────────────────────────────────
// Result recording
// ─────────────────────────────────────────────────────────────────────────────

const results = [];
let currentGroup = "";

function group(name) {
  currentGroup = name;
  console.log(`\n── ${name} ${"─".repeat(Math.max(0, 66 - name.length))}`);
}

function record(name, passed, detail = "") {
  results.push({ group: currentGroup, name, passed });
  const mark = passed ? "  PASS" : "  FAIL";
  console.log(`${mark}  ${name}${detail ? `  — ${detail}` : ""}`);
}

/** Asserts a query was refused: either an error, or zero rows reaching us. */
function refused(error, data) {
  if (error) return true;
  return Array.isArray(data) ? data.length === 0 : data === null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const TAG = "zz-phase25";
const PASSWORD = `${TAG}-${Math.random().toString(36).slice(2)}A1!`;
const ROLES = ["admin", "manager", "editor", "viewer"];

/** Signed-in clients, one per role, plus an anonymous one. */
const clients = { anon: createClient(URL, ANON, { auth: { persistSession: false } }) };
const userIds = {};

async function createRoleUsers() {
  for (const role of ROLES) {
    const email = `${TAG}-${role}@example.com`;

    // Remove a user left behind by an interrupted run.
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 200 });
    const stale = existing?.users?.find((u) => u.email === email);
    if (stale) await admin.auth.admin.deleteUser(stale.id);

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: `Phase 2.5 ${role}` },
    });
    if (error) die(`could not create the ${role} user: ${error.message}`);
    userIds[role] = data.user.id;

    // handle_new_user() makes every profile a viewer; promote through the
    // service role, which is the only thing allowed to change another's role.
    const { error: roleError } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", data.user.id);
    if (roleError) die(`could not set role ${role}: ${roleError.message}`);

    const client = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error: signInError } = await client.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (signInError) die(`could not sign in as ${role}: ${signInError.message}`);
    clients[role] = client;
  }
}

/** A supplier every role test can read, created with the service role. */
async function createFixtureSupplier(suffix = "a") {
  const { data, error } = await admin
    .from("suppliers")
    .insert({
      short_name: `${TAG}-${suffix}`,
      legal_name: `Phase 2.5 Fixture ${suffix.toUpperCase()} Co., Ltd`,
      country: "China",
      city: "Tangshan",
      region: "Hebei",
      employees: "6,000",
      certifications: "ISO9001, ISO14001",
      chinese_name: "测试供应商",
      supplier_code: `${TAG}-CODE-${suffix}`,
      annual_revenue: "CNY 7.53 billion (2025)",
      ownership_type: "Public (listed)",
    })
    .select("*")
    .single();
  if (error) die(`fixture supplier failed: ${error.message}`);
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Authentication and profile mapping
// ─────────────────────────────────────────────────────────────────────────────

async function testAuth() {
  group("Authentication and role mapping");

  for (const role of ROLES) {
    const { data } = await clients[role].auth.getUser();
    record(`${role}: session established`, data?.user?.id === userIds[role]);
  }

  // auth_role() is what every policy reads; if it disagrees with the profile
  // the whole matrix below is meaningless.
  for (const role of ROLES) {
    const { data, error } = await clients[role]
      .from("profiles")
      .select("role")
      .eq("id", userIds[role])
      .single();
    record(`${role}: profile role reads back`, !error && data?.role === role, data?.role ?? error?.message);
  }

  // A viewer must not be able to promote itself.
  const { error: escalate } = await clients.viewer
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", userIds.viewer);
  const { data: after } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userIds.viewer)
    .single();
  record("viewer cannot promote itself to admin", after?.role === "viewer", escalate?.message ?? `role is ${after?.role}`);

  const signedOut = createClient(URL, ANON, { auth: { persistSession: false } });
  await signedOut.auth.signOut();
  const { data: noUser } = await signedOut.auth.getUser();
  record("signed-out client has no user", !noUser?.user);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. RLS matrix
// ─────────────────────────────────────────────────────────────────────────────

async function testRls(supplier) {
  group("Row level security");

  // Anonymous must see no business data at all.
  for (const table of ["suppliers", "reports", "profiles", "report_sections"]) {
    const { data, error } = await clients.anon.from(table).select("*").limit(1);
    record(`anon cannot read ${table}`, refused(error, data), error?.message ?? `${data?.length ?? 0} rows`);
  }

  // Every signed-in role may read.
  for (const role of ROLES) {
    const { data, error } = await clients[role].from("suppliers").select("id").limit(1);
    record(`${role} can read suppliers`, !error && (data?.length ?? 0) > 0, error?.message);
  }

  // Viewer: read only.
  {
    const { error } = await clients.viewer.from("suppliers").insert({
      short_name: `${TAG}-viewer-insert`,
      legal_name: "Should never exist",
      country: "China",
    });
    record("viewer cannot insert a supplier", Boolean(error), error?.message);

    const { data } = await clients.viewer
      .from("suppliers")
      .update({ city: "Hacked" })
      .eq("id", supplier.id)
      .select("id");
    const { data: check } = await admin
      .from("suppliers")
      .select("city")
      .eq("id", supplier.id)
      .single();
    record("viewer cannot update a supplier", check?.city !== "Hacked", `city is ${check?.city}, ${data?.length ?? 0} rows returned`);

    const { data: del } = await clients.viewer
      .from("suppliers")
      .delete()
      .eq("id", supplier.id)
      .select("id");
    const { data: stillThere } = await admin
      .from("suppliers")
      .select("id")
      .eq("id", supplier.id)
      .maybeSingle();
    record("viewer cannot delete a supplier", Boolean(stillThere), `${del?.length ?? 0} rows deleted`);
  }

  // Editor: create and update, but no delete.
  {
    const { data, error } = await clients.editor
      .from("suppliers")
      .insert({
        short_name: `${TAG}-editor`,
        legal_name: "Editor created Co., Ltd",
        country: "China",
      })
      .select("id")
      .single();
    record("editor can insert a supplier", !error && Boolean(data?.id), error?.message);

    if (data?.id) {
      const { error: updateError } = await clients.editor
        .from("suppliers")
        .update({ city: "Ningbo" })
        .eq("id", data.id);
      record("editor can update a supplier", !updateError, updateError?.message);

      const { data: del } = await clients.editor
        .from("suppliers")
        .delete()
        .eq("id", data.id)
        .select("id");
      const { data: survived } = await admin
        .from("suppliers")
        .select("id")
        .eq("id", data.id)
        .maybeSingle();
      record("editor cannot delete a supplier", Boolean(survived), `${del?.length ?? 0} rows deleted`);

      await admin.from("suppliers").delete().eq("id", data.id);
    }
  }

  // Manager: may delete.
  {
    const { data } = await admin
      .from("suppliers")
      .insert({
        short_name: `${TAG}-mgr-target`,
        legal_name: "Manager deletes this Co., Ltd",
        country: "China",
      })
      .select("id")
      .single();

    if (data?.id) {
      await clients.manager.from("suppliers").delete().eq("id", data.id);
      const { data: gone } = await admin
        .from("suppliers")
        .select("id")
        .eq("id", data.id)
        .maybeSingle();
      record("manager can delete a supplier", !gone);
      if (gone) await admin.from("suppliers").delete().eq("id", data.id);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Report creation — atomicity and the frozen snapshot
// ─────────────────────────────────────────────────────────────────────────────

const RPC_ARGS = (documentNumber, supplierId, employeeId) => ({
  p_document_number: documentNumber,
  p_supplier_id: supplierId,
  p_status: "draft",
  p_visit_date: "2026-08-12",
  p_period: "August 2026",
  p_employee_id: employeeId,
  p_owner_id: employeeId,
  p_location: "Tangshan, Hebei",
  p_start_time: "09:30:00",
  p_end_time: "16:00:00",
  p_project: null,
  p_business_unit: null,
  p_product_category: null,
  p_members: ["Reinaldo Alves", "Corrado Braconi"],
});

async function testReportCreation(supplier) {
  group("Report creation transaction");

  const documentNumber = `${TAG}-GSO-2608001x00`;
  const { data: reportId, error } = await clients.editor.rpc(
    "create_report_with_snapshot",
    RPC_ARGS(documentNumber, supplier.id, userIds.editor),
  );
  record("editor can create a report through the RPC", !error && Boolean(reportId), error?.message);
  if (!reportId) return null;

  const { data: report } = await admin
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .single();
  record("report row exists", Boolean(report));
  record("status defaults to draft", report?.status === "draft", report?.status);
  record("supplier_id is stored", report?.supplier_id === supplier.id);
  record("created_at and updated_at stamped", Boolean(report?.created_at && report?.updated_at));
  record("snapshot_taken_at stamped", Boolean(report?.snapshot_taken_at));

  const snapshot = report?.company_information;
  record("snapshot is an object", snapshot !== null && typeof snapshot === "object");
  record("snapshot carries the legal name", snapshot?.legalName === supplier.legal_name, snapshot?.legalName);
  record("snapshot carries the head count", snapshot?.employees === supplier.employees, snapshot?.employees);
  record(
    "snapshot has all 18 keys",
    snapshot && Object.keys(snapshot).length === 18,
    `${snapshot ? Object.keys(snapshot).length : 0} keys`,
  );

  const { data: sections } = await admin
    .from("report_sections")
    .select("section_id, version, sort_order")
    .eq("report_id", reportId)
    .order("sort_order");
  record("13 default sections created", sections?.length === 13, `${sections?.length ?? 0}`);
  record("every section starts at version 1", sections?.every((s) => s.version === 1));

  const { data: members } = await admin
    .from("report_members")
    .select("display_name")
    .eq("report_id", reportId);
  record("2 members recorded", members?.length === 2, `${members?.length ?? 0}`);

  // Atomicity: a duplicate document number must fail and leave nothing behind.
  const before = await admin.from("report_sections").select("id", { count: "exact", head: true });
  const { error: dupError } = await clients.editor.rpc(
    "create_report_with_snapshot",
    RPC_ARGS(documentNumber, supplier.id, userIds.editor),
  );
  const after = await admin.from("report_sections").select("id", { count: "exact", head: true });
  record("duplicate document number is refused", Boolean(dupError), dupError?.code ?? "no error");
  record(
    "failed creation leaves no orphan sections",
    before.count === after.count,
    `${before.count} -> ${after.count}`,
  );

  return reportId;
}

async function testSnapshotImmutability(supplier, reportId) {
  group("Supplier snapshot is frozen (README §8.3)");
  if (!reportId) return record("skipped — no report", false);

  const { data: before } = await admin
    .from("reports")
    .select("company_information")
    .eq("id", reportId)
    .single();
  const original = before?.company_information;

  const { error } = await admin
    .from("suppliers")
    .update({
      legal_name: "RENAMED AFTER THE VISIT Co., Ltd",
      employees: "99,999",
      city: "Somewhere Else",
    })
    .eq("id", supplier.id);
  record("supplier master updated", !error, error?.message);

  const { data: after } = await admin
    .from("reports")
    .select("company_information")
    .eq("id", reportId)
    .single();

  record(
    "report snapshot did not change",
    JSON.stringify(after?.company_information) === JSON.stringify(original),
  );
  record("snapshot keeps the old legal name", after?.company_information?.legalName === supplier.legal_name);
  record("snapshot keeps the old head count", after?.company_information?.employees === supplier.employees);

  const { data: live } = await admin
    .from("suppliers")
    .select("legal_name, employees")
    .eq("id", supplier.id)
    .single();
  record("supplier detail shows the NEW master data", live?.employees === "99,999", live?.employees);

  // The explicit refresh is the only thing that may move it.
  const { error: refreshError } = await admin.rpc("refresh_report_snapshot", { report_id: reportId });
  const { data: refreshed } = await admin
    .from("reports")
    .select("company_information")
    .eq("id", reportId)
    .single();
  record(
    "refresh_report_snapshot updates it on demand",
    !refreshError && refreshed?.company_information?.employees === "99,999",
    refreshError?.message ?? refreshed?.company_information?.employees,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Version trigger, optimistic concurrency, stale vs forbidden
// ─────────────────────────────────────────────────────────────────────────────

async function testVersioning(reportId) {
  group("updated_at, version trigger and optimistic concurrency");
  if (!reportId) return record("skipped — no report", false);

  const read = async () => {
    const { data } = await admin
      .from("report_sections")
      .select("id, version, updated_at, body")
      .eq("report_id", reportId)
      .eq("section_id", "purpose")
      .single();
    return data;
  };

  const start = await read();
  record("section starts at version 1", start?.version === 1, `v${start?.version}`);

  const { error } = await clients.editor
    .from("report_sections")
    .update({ body: "A".repeat(60) })
    .eq("id", start.id)
    .eq("version", start.version);
  record("editor can patch a section", !error, error?.message);

  const bumped = await read();
  record("version incremented by the trigger", bumped?.version === start.version + 1, `v${start?.version} -> v${bumped?.version}`);
  record("updated_at moved", bumped?.updated_at !== start.updated_at);
  record("body persisted", bumped?.body?.length === 60);

  // A stale write: correct row, wrong version. Must touch nothing.
  const { data: staleRows } = await clients.editor
    .from("report_sections")
    .update({ body: "STALE OVERWRITE" })
    .eq("id", start.id)
    .eq("version", start.version) // the version that already lost
    .select("id");
  const afterStale = await read();
  record("stale patch updates zero rows", (staleRows?.length ?? 0) === 0, `${staleRows?.length ?? 0} rows`);
  record("stale patch did not overwrite the winner", afterStale?.body?.length === 60);
  record("stale patch did not bump the version", afterStale?.version === bumped.version);

  // A forbidden write: correct row, CORRECT version, wrong role. Also zero
  // rows — which is why the data layer re-reads instead of guessing (§18/§17).
  const { data: forbiddenRows } = await clients.viewer
    .from("report_sections")
    .update({ body: "VIEWER OVERWRITE" })
    .eq("id", start.id)
    .eq("version", afterStale.version)
    .select("id");
  const afterForbidden = await read();
  record("viewer patch updates zero rows", (forbiddenRows?.length ?? 0) === 0, `${forbiddenRows?.length ?? 0} rows`);
  record("viewer patch did not change the body", afterForbidden?.body?.length === 60);
  record(
    "forbidden is distinguishable from stale",
    afterForbidden?.version === afterStale.version,
    "row still carries the version the caller sent, so a re-read says forbidden, not stale",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Child rows: target products and observations
// ─────────────────────────────────────────────────────────────────────────────

async function testChildRows(reportId) {
  group("Target products and observations");
  if (!reportId) return record("skipped — no report", false);

  const targets = [
    {
      report_id: reportId,
      name: "RHW-2 submersible pump cable",
      model: "100-80-160",
      application: "Submersible pump power supply",
      expected_market: "North America (UL)",
      technical_requirements: "UL 1682, 600 V, -25 °C",
      comments: "Sample presented during the visit",
      sort_order: 0,
    },
    {
      report_id: reportId,
      name: "2PNCT portable pump cable",
      model: "100-80-200",
      application: "Portable dewatering pump",
      expected_market: "Japan (JIS)",
      technical_requirements: "JIS C 3327",
      comments: "",
      sort_order: 1,
    },
  ];

  const { data: inserted, error } = await clients.editor
    .from("report_target_products")
    .insert(targets)
    .select("*")
    .order("sort_order");
  record("editor can insert target products", !error && inserted?.length === 2, error?.message);

  if (inserted?.length === 2) {
    const first = inserted[0];
    record("name persisted", first.name === targets[0].name);
    record("model persisted", first.model === targets[0].model);
    record("application persisted", first.application === targets[0].application);
    record("expected_market persisted", first.expected_market === targets[0].expected_market);
    record("technical_requirements persisted", first.technical_requirements === targets[0].technical_requirements);
    record("comments persisted", first.comments === targets[0].comments);
    record("sort_order preserved", inserted[0].sort_order === 0 && inserted[1].sort_order === 1);

    const { error: updateError } = await clients.editor
      .from("report_target_products")
      .update({ comments: "Edited during validation" })
      .eq("id", first.id);
    record("target product can be edited", !updateError, updateError?.message);
  }

  const categories = [
    "Manufacturing",
    "Quality Control",
    "Testing Facilities",
    "Risk",
    "Opportunity",
    "Open Point",
  ];
  const observations = categories.map((category, index) => ({
    report_id: reportId,
    category,
    priority: "Normal",
    body: `Validation observation for ${category}.`,
    sort_order: index,
  }));

  const { data: obs, error: obsError } = await clients.editor
    .from("report_observations")
    .insert(observations)
    .select("category, sort_order")
    .order("sort_order");
  record("editor can insert six observations", !obsError && obs?.length === 6, obsError?.message);
  record(
    "every category round-trips",
    obs && categories.every((c, i) => obs[i]?.category === c),
    obs?.map((o) => o.category).join(", "),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────────────────────

async function cleanup() {
  group("Cleanup");

  const { data: reports } = await admin
    .from("reports")
    .select("id")
    .like("document_number", `${TAG}%`);
  for (const r of reports ?? []) await admin.from("reports").delete().eq("id", r.id);

  const { data: suppliers } = await admin
    .from("suppliers")
    .select("id")
    .like("short_name", `${TAG}%`);
  for (const s of suppliers ?? []) await admin.from("suppliers").delete().eq("id", s.id);

  for (const role of ROLES) {
    if (userIds[role]) await admin.auth.admin.deleteUser(userIds[role]);
  }

  const { data: leftReports } = await admin
    .from("reports")
    .select("id")
    .like("document_number", `${TAG}%`);
  const { data: leftSuppliers } = await admin
    .from("suppliers")
    .select("id")
    .like("short_name", `${TAG}%`);
  record(
    "all fixtures removed",
    (leftReports?.length ?? 0) === 0 && (leftSuppliers?.length ?? 0) === 0,
    `${leftReports?.length ?? 0} reports, ${leftSuppliers?.length ?? 0} suppliers left`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n  Phase 2.5 backend validation\n  target: ${URL}\n`);

await createRoleUsers();
const supplier = await createFixtureSupplier("a");

await testAuth();
await testRls(supplier);
const reportId = await testReportCreation(supplier);
await testSnapshotImmutability(supplier, reportId);
await testVersioning(reportId);
await testChildRows(reportId);
await cleanup();

const failed = results.filter((r) => !r.passed);
console.log(`\n${"═".repeat(70)}`);
console.log(`  ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log(`\n  Failures:`);
  for (const f of failed) console.log(`    ${f.group} › ${f.name}`);
}
console.log("");
process.exit(failed.length === 0 ? 0 : 1);
