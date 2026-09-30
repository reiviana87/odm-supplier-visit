/**
 * Build one report whose every field carries a unique, greppable marker.
 *
 * The point is the question "can anything a user records be lost on the way to
 * the Word file?". You cannot answer that by looking at a document and feeling
 * reassured — you answer it by putting a distinct token in every field, then
 * searching the generated .docx for each token. What is missing is missing.
 *
 * Writes go through an RLS-bound session as the real user, not the secret key,
 * so a policy that would refuse the app refuses this too.
 *
 *   node --env-file=.env.local scripts/audit-seed.mjs            create
 *   node --env-file=.env.local scripts/audit-seed.mjs --clean    remove it again
 */

import { writeFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const EMAIL = process.env.AUDIT_EMAIL ?? "alves.reinaldo@ebara.com";

/** Far out of the way of any real month, so it can never collide with real work. */
export const AUDIT_DOCUMENT_NUMBER = "GSO-2612901x00";

/**
 * One marker per field. `ZZ` prefixes make them greppable in XML, and each
 * carries the scripts the report has to survive — a Japanese supplier name and
 * a Portuguese sentence are the ordinary case here, not an edge case.
 */
export const MARKERS = {
  purpose: "ZZPURPOSE Visitar a fábrica — acentuação ãõç, 日本語, 中文",
  overview: "ZZOVERVIEW Empresa fundada em 1998 · 従業員 320 人",
  mainProducts: "ZZMAINPRODUCTS Bombas verticais e horizontais",
  partners: "ZZPARTNERS Parceiro histórico da EBARA",
  conclusion: "ZZCONCLUSION Recomendo seguir com a qualificação",
  certificateNote: "ZZCERTNOTE ISO 9001 verificada no local",
  targetNotes: "ZZTARGETNOTES Foco em alta pressão",
  qaBullets: [
    "ZZQA1 Qual o lead time padrão?",
    "ZZQA2 Quatro semanas para o modelo padrão",
    "ZZQA3 Linha de fundição roda em dois turnos",
  ],
  observations: [
    { category: "Manufacturing", priority: "High", text: "ZZOBS1 Fundição sem rastreabilidade de lote" },
    { category: "Quality", priority: "Critical", text: "ZZOBS2 Sala de metrologia sem climatização" },
    { category: "Commercial", priority: "Normal", text: "ZZOBS3 Preço FOB indicativo apenas" },
  ],
  targetProducts: [
    {
      name: "ZZTPNAME1 Bomba vertical",
      model: "ZZTPMODEL1 100-80-160",
      application: "ZZTPAPP1 Abastecimento predial",
      expectedMarket: "ZZTPMARKET1 América do Sul",
      technicalRequirements: "ZZTPREQ1 IEC 60034, IP55",
      comments: "ZZTPCOMMENT1 Amostra prometida em 30 dias",
    },
    {
      name: "ZZTPNAME2 Bomba horizontal",
      model: "ZZTPMODEL2 65-50-125",
      application: "ZZTPAPP2 Combate a incêndio",
      expectedMarket: "ZZTPMARKET2 Japão",
      technicalRequirements: "ZZTPREQ2 JIS B 8301",
      comments: "ZZTPCOMMENT2 Preço FOB pendente",
    },
  ],
  productRows: [
    {
      type: "ZZPRTYPE1 Vertical multiestágio",
      standard: "ZZPRSTD1 ISO 2858",
      voltage: "ZZPRVOLT1 380V/50Hz",
      description: "ZZPRDESC1 Corpo em ferro fundido",
    },
    {
      type: "ZZPRTYPE2 Horizontal",
      standard: "ZZPRSTD2 ISO 5199",
      voltage: "ZZPRVOLT2 440V/60Hz",
      description: "ZZPRDESC2 Selo mecânico duplo",
    },
  ],
  photos: [
    { region: "APPENDIX_IMAGES", caption: "ZZCAP1 Linha de montagem principal" },
    { region: "APPENDIX_IMAGES", caption: "ZZCAP2 Sala de testes hidráulicos" },
    { region: "MAIN_PRODUCT_IMAGES", caption: "ZZCAP3 Bomba vertical no estoque" },
    { region: "PARTNER_IMAGES", caption: "ZZCAP4 Placa dos parceiros" },
  ],
  transcript: "ZZTRANSCRIPT " + "Conversa gravada durante a visita. ".repeat(40),
  location: "ZZLOCATION Deqing, Zhejiang, China",
  project: "ZZPROJECT Qualificação 2026",
  businessUnit: "ZZBUSINESSUNIT Pumps",
  productCategory: "ZZPRODUCTCATEGORY Vertical",
  members: ["ZZMEMBER1 Reinaldo Alves", "ZZMEMBER2 Convidado"],
  certificates: [
    { name: "ZZCERTNAME1 ISO 9001", number: "ZZCERTNO1", issueDate: "2024-03", expirationDate: "2027-03" },
    { name: "ZZCERTNAME2 CE", number: "ZZCERTNO2", issueDate: "2023-01", expirationDate: "2026-01" },
  ],
};

/** Section id → the marker that must end up in its body. */
const SECTION_BODY = {
  purpose: MARKERS.purpose,
  overview: MARKERS.overview,
  products: MARKERS.mainProducts,
  partners: MARKERS.partners,
  conclusion: MARKERS.conclusion,
  certificates: MARKERS.certificateNote,
  target: MARKERS.targetNotes,
  visit: MARKERS.qaBullets.join("\n"),
};

/** A 2×3 PNG, built by hand so the script needs no fixture on disk. */
function tinyPng(r, g, b) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(body));
    return Buffer.concat([head, body, tail]);
  };
  const width = 2;
  const height = 3;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // truecolour
  const raw = Buffer.concat(
    Array.from({ length: height }, () =>
      Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat())]),
    ),
  );
  const z = deflateRawSync(raw);
  const idat = Buffer.concat([Buffer.from([0x78, 0x01]), z, Buffer.alloc(4)]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function signIn() {
  const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
  });
  if (error) throw new Error(`generateLink: ${error.message}`);

  const user = createClient(URL_, PUB, { auth: { persistSession: false } });
  const { data, error: otp } = await user.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (otp) throw new Error(`verifyOtp: ${otp.message}`);
  return { admin, user, userId: data.user.id };
}

async function clean(admin) {
  const { data } = await admin
    .from("reports")
    .select("id")
    .eq("document_number", AUDIT_DOCUMENT_NUMBER);
  for (const row of data ?? []) {
    const { data: images } = await admin
      .from("report_images")
      .select("storage_path")
      .eq("report_id", row.id);
    const paths = (images ?? []).map((i) => i.storage_path).filter(Boolean);
    if (paths.length) await admin.storage.from("report-images").remove(paths);
    await admin.from("reports").delete().eq("id", row.id);
  }
  console.log(`cleaned: ${AUDIT_DOCUMENT_NUMBER}`);
}

async function main() {
  const { admin, user, userId } = await signIn();

  if (process.argv.includes("--clean")) {
    await clean(admin);
    return;
  }

  await clean(admin);

  const { data: supplier } = await user
    .from("suppliers")
    .select("id, short_name")
    .limit(1)
    .single();

  const { data: reportId, error } = await user.rpc("create_report_with_snapshot", {
    p_document_number: AUDIT_DOCUMENT_NUMBER,
    p_supplier_id: supplier.id,
    p_status: "draft",
    p_visit_date: "2026-12-15",
    p_period: "December 2026",
    p_employee_id: userId,
    p_owner_id: userId,
    p_location: MARKERS.location,
    p_start_time: "09:30:00",
    p_end_time: "16:45:00",
    p_project: MARKERS.project,
    p_business_unit: MARKERS.businessUnit,
    p_product_category: MARKERS.productCategory,
    p_members: MARKERS.members,
  });
  if (error) throw new Error(`create_report_with_snapshot: ${error.message}`);
  console.log("report:", AUDIT_DOCUMENT_NUMBER, reportId, "supplier:", supplier.short_name);

  for (const [sectionId, body] of Object.entries(SECTION_BODY)) {
    const { error: e } = await user
      .from("report_sections")
      .update({ body, updated_by: userId })
      .eq("report_id", reportId)
      .eq("section_id", sectionId);
    if (e) console.error(`  section ${sectionId}: ${e.message}`);
  }
  console.log("sections filled:", Object.keys(SECTION_BODY).length);

  const { error: obsError } = await user.from("report_observations").insert(
    MARKERS.observations.map((o, index) => ({
      report_id: reportId,
      category: o.category,
      priority: o.priority,
      text: o.text,
      sort_order: index,
      created_by: userId,
    })),
  );
  if (obsError) console.error("  observations:", obsError.message);

  const { error: tpError } = await user.from("report_target_products").insert(
    MARKERS.targetProducts.map((t, index) => ({
      report_id: reportId,
      name: t.name,
      model: t.model,
      application: t.application,
      expected_market: t.expectedMarket,
      technical_requirements: t.technicalRequirements,
      comments: t.comments,
      sort_order: index,
      created_by: userId,
    })),
  );
  if (tpError) console.error("  target products:", tpError.message);

  const { error: prError } = await user.from("report_product_rows").insert(
    MARKERS.productRows.map((r, index) => ({
      report_id: reportId,
      type: r.type,
      standard: r.standard,
      voltage: r.voltage,
      description: r.description,
      sort_order: index,
      created_by: userId,
    })),
  );
  if (prError) console.error("  product rows:", prError.message);

  for (const [index, photo] of MARKERS.photos.entries()) {
    const path = `${reportId}/audit-${index + 1}.png`;
    const bytes = tinyPng(20 + index * 40, 90, 160);
    const up = await user.storage
      .from("report-images")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (up.error) {
      console.error(`  photo ${index + 1} upload:`, up.error.message);
      continue;
    }
    const { error: rowError } = await user.from("report_images").insert({
      report_id: reportId,
      region: photo.region,
      file_name: `audit-${index + 1}.png`,
      storage_path: path,
      mime_type: "image/png",
      size_bytes: bytes.length,
      width: 2,
      height: 3,
      caption: photo.caption,
      caption_source: "user",
      caption_state: "accepted",
      sort_order: index,
      created_by: userId,
    });
    if (rowError) console.error(`  photo ${index + 1} row:`, rowError.message);
  }
  console.log("photos:", MARKERS.photos.length);

  const { error: fileError } = await user.from("report_files").insert({
    report_id: reportId,
    kind: "transcript",
    file_name: "ZZTRANSCRIPTFILE audit.txt",
    content: MARKERS.transcript,
    created_by: userId,
  });
  if (fileError) console.error("  transcript:", fileError.message);

  for (const [index, certificate] of MARKERS.certificates.entries()) {
    const { error: e } = await user.from("supplier_certificates").insert({
      supplier_id: supplier.id,
      name: certificate.name,
      number: certificate.number,
      issue_date: `${certificate.issueDate}-01`,
      expiration_date: `${certificate.expirationDate}-01`,
      sort_order: 900 + index,
      created_by: userId,
    });
    if (e) console.error(`  certificate ${index + 1}:`, e.message);
  }

  writeFileSync(
    ".audit-report.json",
    JSON.stringify({ reportId, documentNumber: AUDIT_DOCUMENT_NUMBER, supplierId: supplier.id }, null, 2),
  );
  console.log("\nwrote .audit-report.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
