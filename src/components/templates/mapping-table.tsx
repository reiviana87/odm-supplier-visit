import { Blueprint } from "@/components/ui/blueprint";
import {
  Table,
  TableFrame,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui/table";
import { SECTIONS, type SectionId } from "@/types/domain";

/**
 * How the export fills the corporate template — the screen README §16 calls the
 * placeholder mapping, kept at its approved route and in its approved frame.
 *
 * There is no mapping to show. The corporate file (`EBARA_ODM_Visit_Report`) is
 * a finished example report, not a form: it contains no `{{TOKEN}}` and no Word
 * merge field anywhere, so nothing can be substituted by name. The export
 * clones the document's shell and writes each section into it in order, which is
 * what this screen now says instead of a table of bindings that never existed.
 *
 * Nothing here is interactive, so it renders on the server.
 */

const EM_DASH = "—";

/**
 * Where each section's content comes from, in the order the document is built.
 * The section list itself is `SECTIONS` — the same definition the editor
 * navigator and the completion maths use, so this screen cannot drift from the
 * report it describes.
 */
const FILLED_FROM: Record<SectionId, string> = {
  general:
    "The report header — document number, employee, period, supplier and visit date",
  purpose: "§1 Purpose, as written in the editor",
  company: "The supplier snapshot frozen when the report was created",
  overview: "§3 Company Overview, as written in the editor",
  products: "§4 Main Products — the prose, plus the product table when there is one",
  "product-images": "§4.1 photographs, each with its caption",
  target: "§5 Target Products — the target product rows",
  visit: "§6 observations, plus the Q&A block when there is one",
  certificates: "The supplier's certificate records",
  partners: "§8 Partners, as written in the editor",
  "partner-images": "§8.1 photographs, each with its caption",
  conclusion: "§9 Conclusion, as written in the editor",
  appendix: "Appendix photographs and their captions — two to a row",
};

/** What the template contributes that no report section fills. */
const SHELL_FURNITURE = [
  "A4 page size and the template's own margins",
  "The header, with the EBARA logo and the four department lines",
  "The footer table — department, prepared by, date and page number",
  "The Word styles and the heading formatting the headings are written in",
  "The signature block that closes the report, before the appendix",
] as const;

/**
 * The explanation that replaced the seeded mapping table. It states how the
 * export works — including the part users ask about most, what happens to a
 * section nobody wrote.
 */
export function ExportShellNote() {
  return (
    <Blueprint style={{ padding: 16, marginBottom: 20 }}>
      <h4 style={{ margin: 0 }}>There are no placeholders to map</h4>
      <div
        style={{
          fontSize: 12.5,
          lineHeight: 1.65,
          color: "var(--color-neutral-800)",
          marginTop: 8,
        }}
      >
        <p style={{ margin: 0 }}>
          The corporate template is a finished example report, not a form: it
          contains no <span className="mono">{"{{TOKEN}}"}</span> and no Word
          merge field. So the export does not substitute values by name. It
          builds each document from the template&apos;s shell and writes the
          report into it, section by section, in the order below.
        </p>
        <p style={{ margin: "9px 0 0" }}>
          A section nobody wrote comes out as its heading with no text under it.
          That is what the completion ticks in the editor are for — the export
          panel lists the empty sections before it generates anything.
        </p>
      </div>

      <div className="kicker-muted" style={{ margin: "14px 0 6px" }}>
        Taken from the template itself
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          fontSize: 12.5,
          lineHeight: 1.7,
          color: "var(--color-neutral-800)",
        }}
      >
        {SHELL_FURNITURE.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Blueprint>
  );
}

/** The sections the export writes, in document order. */
export function ExportSectionsTable() {
  return (
    <TableFrame>
      <Table>
        <Thead>
          <Tr>
            <Th width={60}>§</Th>
            <Th width={260}>Section in the document</Th>
            <Th>Filled from</Th>
          </Tr>
        </Thead>
        <Tbody>
          {SECTIONS.map((section) => (
            <Tr key={section.id}>
              <Td
                nowrap
                className="mono"
                style={{ color: "var(--color-accent-800)", fontSize: 12 }}
              >
                {section.number || EM_DASH}
              </Td>
              <Td
                style={{
                  fontSize: 12.5,
                  paddingLeft: section.isSubSection ? 28 : undefined,
                }}
              >
                {section.label}
              </Td>
              <Td style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                {FILLED_FROM[section.id]}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableFrame>
  );
}
