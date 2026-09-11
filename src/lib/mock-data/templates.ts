/**
 * Corporate DOCX templates and their placeholder bindings — README §16.
 *
 * The version list is the `tplVersions` table of the approved prototype
 * (`design-handoff/ODM Supplier Visit.dc.html`, line 3093); the bindings are
 * its `MAPPING` array (line 2500), whose trailing 1/0 flag is `isMapped`.
 * Sample values are taken from report GSO-2608001x00.
 */

import type { PlaceholderMapping, ReportTemplate } from "@/types/domain";

export const TEMPLATES: ReportTemplate[] = [
  {
    id: "tpl-v1-3",
    name: "EBARA ODM Visit Report Template",
    version: "v1.3",
    uploadedBy: "Reinaldo Alves",
    uploadedAt: "Sep 02, 2026",
    isActive: true,
    isArchived: false,
  },
  {
    id: "tpl-v1-2",
    name: "EBARA ODM Visit Report Template",
    version: "v1.2",
    uploadedBy: "Corrado Braconi",
    uploadedAt: "Apr 18, 2026",
    isActive: false,
    isArchived: true,
  },
  {
    id: "tpl-v1-1",
    name: "EBARA ODM Visit Report Template",
    version: "v1.1",
    uploadedBy: "Admin",
    uploadedAt: "Nov 07, 2025",
    isActive: false,
    isArchived: true,
  },
];

/**
 * The two display facts the version-history table shows that are not part of
 * `ReportTemplate`: the stored `.docx` file name and the "Change" column.
 */
export interface TemplateVersionDetail {
  fileName: string;
  changeNote: string;
}

export const TEMPLATE_DETAILS: Record<string, TemplateVersionDetail> = {
  "tpl-v1-3": {
    fileName: "EBARA_ODM_Visit_Report_v1.3.docx",
    changeNote:
      "Appendix region reworked to alternating photo/caption rows; footer updated",
  },
  "tpl-v1-2": {
    fileName: "EBARA_ODM_Visit_Report_v1.2.docx",
    changeNote: "Certificates table widened",
  },
  "tpl-v1-1": {
    fileName: "EBARA_ODM_Visit_Report_v1.1.docx",
    changeNote: "First GSO-numbered layout",
  },
};

/**
 * Placeholder → source → sample value, in template order. The last three rows
 * are image regions rather than text placeholders (README §16, "Special
 * regions"); everything else is a `{{TOKEN}}` in the Word file.
 */
export const PLACEHOLDER_MAPPINGS: PlaceholderMapping[] = [
  {
    placeholder: "{{DOCUMENT_NUMBER}}",
    source: "Report › Document Number",
    sampleValue: "GSO-2608001x00",
    isMapped: true,
  },
  {
    placeholder: "{{EMPLOYEE}}",
    source: "Report › Employee",
    sampleValue: "Reinaldo Alves",
    isMapped: true,
  },
  {
    placeholder: "{{PERIOD}}",
    source: "Report › Period",
    sampleValue: "August 2026",
    isMapped: true,
  },
  {
    placeholder: "{{SUPPLIER_NAME}}",
    source: "Supplier › Name (legal)",
    sampleValue: "HEBEI HUATONG WIRES & CABLES GROUP CO., LTD.",
    isMapped: true,
  },
  {
    placeholder: "{{MEMBERS}}",
    source: "Report › Members (joined)",
    sampleValue: "EC (Reinaldo-san and Xu-san)",
    isMapped: true,
  },
  {
    placeholder: "{{PURPOSE}}",
    source: "Report › §1 Purpose",
    sampleValue: "rich text · 2 paragraphs",
    isMapped: true,
  },
  {
    placeholder: "{{COMPANY_INFORMATION}}",
    source: "Supplier snapshot › key/value block",
    sampleValue: "10 fields",
    isMapped: true,
  },
  {
    placeholder: "{{COMPANY_OVERVIEW}}",
    source: "Report › §3 Company Overview",
    sampleValue: "rich text · 2 paragraphs",
    isMapped: true,
  },
  {
    placeholder: "{{MAIN_PRODUCTS}}",
    source: "Report › §4 Main Products + optional table",
    sampleValue: "rich text + 7 rows (table optional)",
    isMapped: true,
  },
  {
    placeholder: "{{TARGET_PRODUCTS}}",
    source: "Report › §5 Target Products",
    sampleValue: "2 products + notes",
    isMapped: true,
  },
  {
    placeholder: "{{VISIT_INFORMATION}}",
    source: "Report › §6 Observations + optional Q&A bullets",
    sampleValue: "13 items + 6 bullets",
    isMapped: true,
  },
  {
    placeholder: "{{CERTIFICATES}}",
    source: "Supplier › Certificates (table)",
    sampleValue: "7 rows",
    isMapped: true,
  },
  {
    placeholder: "{{PARTNERS}}",
    source: "Report › §8 Partners",
    sampleValue: "rich text",
    isMapped: true,
  },
  {
    placeholder: "{{CONCLUSION}}",
    source: "Report › §9 Conclusion",
    sampleValue: "not yet written",
    isMapped: false,
  },
  {
    placeholder: "MAIN_PRODUCT_IMAGES",
    source: "Region · 2-col grid, 7.0 cm",
    sampleValue: "4 images",
    isMapped: true,
  },
  {
    placeholder: "PARTNER_IMAGES",
    source: "Region · 2-col grid, 7.0 cm",
    sampleValue: "2 images",
    isMapped: true,
  },
  {
    placeholder: "APPENDIX_IMAGES",
    source: "Region · alternating photo/caption rows",
    sampleValue: "22 images",
    isMapped: true,
  },
];
