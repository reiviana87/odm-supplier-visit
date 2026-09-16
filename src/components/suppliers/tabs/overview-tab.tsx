import Link from "next/link";

import { Tag } from "@/components/ui/badge";
import { Blueprint } from "@/components/ui/blueprint";
import { PHOTO_SEED, REPORTS, photoSrc } from "@/lib/mock-data";
import type { Supplier } from "@/types/domain";

/**
 * Supplier Overview tab — README §1.7, prototype lines 469..524.
 *
 * Two columns `minmax(0,1.5fr) minmax(260px,1fr)`: the 13-row Company
 * Information fact list and Internal Notes on the left, the declared product
 * categories, the declared certifications and — only when the supplier has
 * visit photographs — the 3-up photo strip on the right.
 */

const EM_DASH = "—";

/** A blank cell is an em dash, never an empty row (prototype `sup.x` → "—"). */
function value(raw: string | null): string {
  return raw && raw.trim().length > 0 ? raw : EM_DASH;
}

function companyFacts(supplier: Supplier): Array<[string, string]> {
  const place = [supplier.country, supplier.region, supplier.city]
    .filter(Boolean)
    .join(" · ");

  return [
    ["Company name", value(supplier.legalName)],
    ["Established year", value(supplier.establishedYear)],
    ["Company capital", value(supplier.companyCapital)],
    ["Number of employees", value(supplier.employees)],
    ["Factory size", value(supplier.factorySizeM2)],
    ["Certification", value(supplier.certifications)],
    ["Production capacity (units/year)", value(supplier.productionCapacity)],
    ["Company president", value(supplier.presidentName)],
    ["Website", value(supplier.websiteUrl)],
    ["Country · Region · City", value(place)],
    ["Address", value(supplier.address)],
    ["Tel", value(supplier.tel)],
    // The one field with its own fallback wording (prototype line 2749).
    ["Track record — EBARA group", supplier.trackRecordEbara ?? "None recorded"],
  ];
}

/** The list as declared on the data sheet — "RHW-2, SOOW, …" → three tags. */
function splitDeclared(list: string | null): string[] {
  if (!list) return [];
  return list
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

const PHOTO_CAPTIONS = new Map(PHOTO_SEED.map(([id, caption]) => [id, caption]));

/** "Aug 12, 2026" → "Aug 12" (prototype: "All 22 photos from Aug 12 visit"). */
function visitDayLabel(lastVisitDate: string): string {
  return lastVisitDate.split(",")[0];
}

function Heading({ children }: { children: string }) {
  return (
    <h6 style={{ margin: "0 0 8px", color: "var(--color-accent-700)" }}>
      {children}
    </h6>
  );
}

function TagRow({ names, accent }: { names: string[]; accent?: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {names.map((name) => (
        <Tag key={name} tone={accent ? "accent" : "outline"}>
          {name}
        </Tag>
      ))}
    </div>
  );
}

export function OverviewTab({ supplier }: { supplier: Supplier }) {
  const facts = companyFacts(supplier);
  const categories = splitDeclared(supplier.productCategories);
  const certifications = splitDeclared(supplier.certifications);
  const latestReport = REPORTS.find(
    (report) => report.supplierId === supplier.id,
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1.5fr) minmax(260px,1fr)",
        gap: 22,
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <Heading>Company Information</Heading>
          <Blueprint style={{ padding: 0 }}>
            {/* A <dl> of its own: the blueprint's registration marks are <i>
                elements, which a <dl> may not contain directly. */}
            <dl style={{ margin: 0 }}>
              {facts.map(([label, fact]) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    gap: 14,
                    padding: "9px 13px",
                    borderBottom:
                      "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
                  }}
                >
                  <dt
                    style={{
                      width: 190,
                      flex: "none",
                      fontSize: "11.5px",
                      letterSpacing: ".04em",
                      textTransform: "uppercase",
                      color: "var(--color-neutral-600)",
                    }}
                  >
                    {label}
                  </dt>
                  <dd style={{ margin: 0, fontSize: 13, minWidth: 0 }}>
                    {fact}
                  </dd>
                </div>
              ))}
            </dl>
          </Blueprint>
        </div>

        <div>
          <Heading>Internal Notes</Heading>
          <Blueprint style={{ padding: 13, fontSize: 13, lineHeight: 1.6 }}>
            {supplier.internalNotes ??
              "No internal notes yet — notes are added after the first visit."}
          </Blueprint>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <Heading>Product Categories</Heading>
          <TagRow names={categories} />
        </div>

        <div>
          <Heading>Certifications</Heading>
          <TagRow names={certifications} accent />
          <p
            style={{
              fontSize: "11.5px",
              color: "var(--color-neutral-600)",
              margin: "7px 0 0",
            }}
          >
            As declared in the supplier data sheet — certificate copies are
            verified during the visit.
          </p>
        </div>

        {supplier.visitPhotoIds.length > 0 ? (
          <div>
            <Heading>Visit Photos</Heading>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 6,
              }}
            >
              {supplier.visitPhotoIds.map((photoId) => (
                /* eslint-disable-next-line @next/next/no-img-element -- the
                   seed photographs are fixed-height crops of unknown intrinsic
                   size; next/image cannot express that without a ratio. */
                <img
                  key={photoId}
                  src={photoSrc(photoId)}
                  alt={PHOTO_CAPTIONS.get(photoId) ?? "Visit photo"}
                  style={{
                    width: "100%",
                    height: 64,
                    objectFit: "cover",
                    border: "1px solid var(--color-divider)",
                  }}
                />
              ))}
            </div>
            {latestReport && supplier.lastVisitDate ? (
              <Link
                href={`/reports/${latestReport.id}/appendix`}
                className="hover:underline"
                style={{
                  display: "inline-block",
                  fontSize: "11.5px",
                  marginTop: 6,
                }}
              >
                {`All ${PHOTO_SEED.length} photos from ${visitDayLabel(
                  supplier.lastVisitDate,
                )} visit`}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
