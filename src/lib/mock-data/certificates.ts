/**
 * Seeded supplier certificates — README §1.7 / §19.
 *
 * Transcribed from the approved prototype's `CERTS` array. Only HEBEI HUATONG has
 * collected certificate copies; every other supplier shows its *declared*
 * certifications, which `declaredCertificates()` in `@/lib/suppliers/display`
 * derives from the data-sheet field.
 *
 * `SupplierCertificate.number`, `.issueDate` and `.expirationDate` are non-optional
 * strings in the domain model, so a value the supplier did not provide is stored as
 * an empty string and the UI renders the em dash. `fileName` is `null` when no copy
 * was collected — the table then shows "No copy collected".
 *
 * `notes` is `null` throughout: the prototype's `CERTS` rows carry six columns and
 * none of them is a remark. The field exists for what a reviewer writes against a
 * certificate once the table is editable, not for a caption invented here.
 */

import type { SupplierCertificate } from "@/types/domain";

const HUATONG_CERTIFICATES: SupplierCertificate[] = [
  {
    id: "huatong-cert-1",
    name: "ISO 9001:2015",
    number: "CN-QMS-114872",
    issueDate: "18 Mar 2024",
    expirationDate: "17 Mar 2027",
    status: "valid",
    fileName: "ISO9001_Huatong.pdf",
    notes: null,
    sortOrder: 0,
  },
  {
    id: "huatong-cert-2",
    name: "ISO 14001:2015",
    number: "CN-EMS-330941",
    issueDate: "16 Jun 2025",
    expirationDate: "15 Jun 2028",
    status: "valid",
    fileName: "ISO14001_Huatong.pdf",
    notes: null,
    sortOrder: 1,
  },
  {
    id: "huatong-cert-3",
    name: "ISO 45001:2018",
    number: "CN-OHS-330942",
    issueDate: "16 Jun 2025",
    expirationDate: "15 Jun 2028",
    status: "valid",
    fileName: "ISO45001_Huatong.pdf",
    notes: null,
    sortOrder: 2,
  },
  {
    id: "huatong-cert-4",
    name: "UL 44 / UL 62",
    number: "E-508812",
    issueDate: "02 Feb 2022",
    expirationDate: "",
    status: "valid",
    fileName: "UL_Listing_E508812.pdf",
    notes: null,
    sortOrder: 3,
  },
  {
    id: "huatong-cert-5",
    name: "CSA C22.2",
    number: "LL-229410",
    issueDate: "11 Sep 2023",
    expirationDate: "",
    status: "valid",
    fileName: "CSA_LL229410.pdf",
    notes: null,
    sortOrder: 4,
  },
  {
    id: "huatong-cert-6",
    name: "CNAS Laboratory",
    number: "L-14092",
    issueDate: "05 Apr 2024",
    expirationDate: "04 Apr 2029",
    status: "valid",
    fileName: "CNAS_L14092.pdf",
    notes: null,
    sortOrder: 5,
  },
  {
    id: "huatong-cert-7",
    name: "CE (LVD)",
    number: "",
    issueDate: "",
    expirationDate: "",
    status: "not_evidenced",
    fileName: null,
    notes: null,
    sortOrder: 6,
  },
];

/** Collected certificate copies, keyed by supplier id. */
export const CERTIFICATES_BY_SUPPLIER: Record<string, SupplierCertificate[]> = {
  huatong: HUATONG_CERTIFICATES,
};

