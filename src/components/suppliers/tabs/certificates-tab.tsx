"use client";

import { CertificateStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EMPTY_STATE_COPY, EmptyState } from "@/components/ui/states";
import {
  Table,
  TableFrame,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { CERTIFICATES_BY_SUPPLIER, declaredCertificates } from "@/lib/mock-data";
import type { Supplier, SupplierCertificate } from "@/types/domain";

/**
 * Supplier Certificates tab — README §1.7 / §19, prototype lines 563..590.
 *
 * A supplier whose copies were collected during a visit lists the real
 * certificates; every other supplier lists the certifications it *declared* on
 * the data sheet — `Declared` badge, em-dash number and dates, "No copy
 * collected" in the file column — under the approved §21 note.
 */

const EM_DASH = "—";

function cell(raw: string): string {
  return raw.trim().length > 0 ? raw : EM_DASH;
}

export function CertificatesTab({ supplier }: { supplier: Supplier }) {
  const { toast } = useToast();

  const collected: SupplierCertificate[] | undefined =
    CERTIFICATES_BY_SUPPLIER[supplier.id];
  const certificates = collected ?? declaredCertificates(supplier);

  const note =
    collected && supplier.lastVisitDate
      ? `Copies collected during the ${supplier.lastVisitDate} visit.`
      : EMPTY_STATE_COPY.noCertificates;

  const addCertificate = (
    <Button
      variant="secondary"
      icon="plus"
      style={{ fontSize: "12.5px" }}
      onClick={() =>
        toast("Adding certificate copies arrives with supplier persistence (Phase 2)")
      }
    >
      Add Certificate
    </Button>
  );

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <h5 style={{ margin: 0, flex: 1 }}>Certificates</h5>
        {addCertificate}
      </div>

      {certificates.length === 0 ? (
        <EmptyState message={EMPTY_STATE_COPY.noCertificates} />
      ) : (
        <>
          <p
            style={{
              fontSize: "11.5px",
              color: "var(--color-neutral-600)",
              margin: "0 0 9px",
            }}
          >
            {note}
          </p>

          <TableFrame>
            <Table>
              <Thead>
                <Tr>
                  <Th>Certificate</Th>
                  <Th>Certificate Number</Th>
                  <Th>Issue Date</Th>
                  <Th>Expiration</Th>
                  <Th>Status</Th>
                  <Th>File</Th>
                </Tr>
              </Thead>
              <Tbody>
                {certificates.map((certificate) => (
                  <Tr key={certificate.id}>
                    <Td
                      style={{
                        fontSize: 13,
                        fontFamily: "var(--font-heading)",
                        fontWeight: 600,
                      }}
                    >
                      {certificate.name}
                    </Td>
                    <Td style={{ fontSize: "12.5px", color: "var(--color-neutral-700)" }}>
                      {cell(certificate.number)}
                    </Td>
                    <Td
                      nowrap
                      style={{ fontSize: "12.5px", color: "var(--color-neutral-700)" }}
                    >
                      {cell(certificate.issueDate)}
                    </Td>
                    <Td
                      nowrap
                      style={{ fontSize: "12.5px", color: "var(--color-neutral-700)" }}
                    >
                      {cell(certificate.expirationDate)}
                    </Td>
                    <Td>
                      <CertificateStatusBadge status={certificate.status} />
                    </Td>
                    <Td
                      style={{
                        fontSize: 12,
                        color: certificate.fileName
                          ? "var(--color-accent-700)"
                          : "var(--color-neutral-500)",
                      }}
                    >
                      {certificate.fileName ?? "No copy collected"}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableFrame>
        </>
      )}
    </div>
  );
}
