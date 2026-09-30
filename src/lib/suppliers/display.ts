/**
 * Pure rendering helpers shared by the supplier screens.
 *
 * Both functions were read from `@/lib/mock-data` in Phase 1. They are not
 * data: they derive what the screen draws from a record the data layer already
 * returned, so the seed stays out of the production path (Phase 2 §24).
 *
 * They live in `lib` rather than beside the supplier components because the
 * report sections derive the same rows: §7 of a report lists the supplier's
 * certifications exactly as the Certificates tab does, and two copies of that
 * rule would eventually disagree about what a declared certificate is.
 */

import type { Supplier, SupplierCertificate } from "@/types/domain";

/**
 * Everything this derivation needs. A live `Supplier` satisfies it, and so does
 * a report's frozen `SupplierSnapshot` — which is the shape §7 of a report has
 * to read from, since the report states what was declared at the visit, not
 * what the supplier claims today (README §8.3).
 */
export interface DeclaredCertificateSource {
  id?: string;
  supplierId?: string;
  certifications: string | null;
}

/** The 30px / 62px initials square — "HEBEI HUATONG" → "HE". */
export function supplierInitials(supplier: Supplier): string {
  return supplier.shortName.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
}

/**
 * The certifications the supplier *declared* on its data sheet, shaped like the
 * collected copies so one table renders both (README §1.7 / §21).
 *
 * These rows exist only on screen: there is no `supplier_certificates` row
 * behind them, which is why their ids are synthetic and why the Certificates
 * tab offers no row actions while it is showing them.
 */
export function declaredCertificates(
  supplier: DeclaredCertificateSource,
): SupplierCertificate[] {
  if (!supplier.certifications) return [];

  return supplier.certifications
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .map((name, index) => ({
      id: `${supplier.id ?? supplier.supplierId ?? "supplier"}-declared-${index + 1}`,
      name,
      number: "",
      issueDate: "",
      expirationDate: "",
      status: "declared" as const,
      fileName: null,
      storagePath: null,
      notes: null,
      sortOrder: index,
    }));
}
