/**
 * Generates the stand-in imagery for the 22 seeded HUATONG visit photographs.
 *
 * The approved handoff references `assets/photos/f01–f22.jpg`, but the README
 * states those photographs are deliberately NOT bundled ("real HUATONG visit
 * photos used as seed content; not design assets — replace with the customer's
 * library"). Rather than ship unrelated stock imagery — which would read as
 * real evidence in a report that is a legal record of a visit — every seed
 * photo renders as an honest blueprint placeholder carrying its own id,
 * category and caption.
 *
 * Drop the real JPEGs into `public/photos/` as `f01.jpg` … `f22.jpg` and the
 * mock data picks them up: `photoSrc()` in src/lib/mock-data/photos.ts prefers
 * a .jpg when present.
 *
 *   npm run gen:placeholders
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "..", "public", "photos");

/** [id, caption, category] — the PHOTO_SEED table from the approved prototype. */
const PHOTO_SEED = [
  ["f01", "Factory entrance and administration building", "Site"],
  ["f02", "Rubber cable production line — general workshop view", "Manufacturing"],
  ["f03", "Copper conductor bobbins staged at line entry", "Raw Materials"],
  ["f04", "Cable extrusion line with overhead cooling trough", "Manufacturing"],
  ["f05", "Insulated cores at the laying-up station", "Manufacturing"],
  ["f06", "Process quality control board at the workshop entrance", "Quality"],
  ["f07", "Product show room — certified cable range", "Products"],
  ["f08", "Show room — export market constructions display", "Products"],
  ["f09", "Raw material warehouse — armouring wire stock", "Raw Materials"],
  ["f10", "High / low temperature conditioning chamber", "Testing"],
  ["f11", "Cold bend test rig (large cross-section)", "Testing"],
  ["f12", "Heat aging oven used for insulation ageing tests", "Testing"],
  ["f13", "Vertical flame test chamber (UL single-cable method)", "Testing"],
  ["f14", "CNAS-accredited laboratory — electrical test benches", "Testing"],
  ["f15", "Vulcanising line — continuous curing section", "Manufacturing"],
  ["f16", "Tensile strength and elongation test machine", "Testing"],
  ["f17", "First sample cut — conductor and jacket inspection", "Quality"],
  ["f18", "Finished drum staged for pre-shipment inspection", "Logistics"],
  ["f19", "Production report and traceability record sheet", "Quality"],
  ["f20", "Routine inspection record at the machining station", "Quality"],
  ["f21", "Finished goods warehouse — export drums", "Logistics"],
  ["f22", "Jacket surface and print marking detail", "Products"],
];

const W = 640;
const H = 420;

const escapeXml = (s) =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c],
  );

/** Wrap a caption onto at most three lines of `max` characters. */
function wrap(text, max = 34) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > max) {
      lines.push(line.trim());
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
    if (lines.length === 2 && line.length > max) break;
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, 3);
}

function svg(id, caption, category) {
  const lines = wrap(caption);
  const captionTspans = lines
    .map(
      (line, i) =>
        `<tspan x="30" dy="${i === 0 ? 0 : 19}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${escapeXml(caption)}">
  <defs>
    <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse">
      <path d="M34 0H0v34" fill="none" stroke="#d6ebff" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="#e9e9ea"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <g fill="none" stroke="#94bce3" stroke-width="1.5">
    <path d="M92 300h456M120 300V170l84 56v-56l84 56v-56l84 56v-56l84 56V128h48v172"/>
  </g>
  <g font-family="Barlow Condensed, system-ui, sans-serif" fill="#2c455d">
    <text x="30" y="48" font-size="15" font-weight="600" letter-spacing="1.4">${escapeXml(id.toUpperCase())} · ${escapeXml(category.toUpperCase())}</text>
  </g>
  <g font-family="Barlow, system-ui, sans-serif" fill="#416180" font-size="15">
    <text x="30" y="348">${captionTspans}</text>
  </g>
  <text x="30" y="${H - 24}" font-family="Barlow, system-ui, sans-serif" font-size="11.5" letter-spacing="1.2" fill="#7a7a7d">PLACEHOLDER — REPLACE WITH THE VISIT PHOTOGRAPH</text>
  <g stroke="#1d1f20" stroke-opacity="0.55" stroke-width="1">
    <path d="M12 6v12M6 12h12M${W - 12} 6v12M${W - 18} 12h12M12 ${H - 18}v12M6 ${H - 12}h12M${W - 12} ${H - 18}v12M${W - 18} ${H - 12}h12"/>
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="#1d1f20" stroke-opacity="0.16"/>
</svg>
`;
}

await mkdir(OUT_DIR, { recursive: true });
for (const [id, caption, category] of PHOTO_SEED) {
  await writeFile(resolve(OUT_DIR, `${id}.svg`), svg(id, caption, category), "utf8");
}
console.log(`Wrote ${PHOTO_SEED.length} photo placeholders to public/photos/`);
