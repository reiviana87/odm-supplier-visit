"use client";

import { useState } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { Report, SupplierSnapshot } from "@/types/domain";

/**
 * §2 Company Information — README §8.3, prototype lines 890..918.
 *
 * This section renders the **snapshot** frozen when the report was created,
 * never the live supplier row: "a report is a legal record of what was true at
 * the visit date — it must not mutate afterwards". Refreshing it is therefore
 * an explicit, confirmed action, not a background sync.
 */

const ROW_STYLE = {
  display: "flex",
  gap: 14,
  padding: "9px 13px",
} as const;

const ROW_RULE = "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)";

const LABEL_STYLE = {
  width: 190,
  flex: "none",
  fontSize: 11.5,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--color-neutral-600)",
} as const;

const EM_DASH = "—";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * "2026-08-12" → "Aug 12, 2026". Parsed by hand rather than through `Date` so
 * the string renders identically on the server and in the browser, whatever the
 * viewer's time zone.
 */
function formatSnapshotDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return iso;
  return `${month} ${match[3]}, ${match[1]}`;
}

function text(raw: string | null): string {
  return raw && raw.trim().length > 0 ? raw : EM_DASH;
}

/** The 13 data-sheet rows, in the order of the prototype's `companyFacts`. */
function factsOf(snapshot: SupplierSnapshot): ReadonlyArray<[string, string]> {
  return [
    ["Company name", text(snapshot.legalName)],
    ["Established year", text(snapshot.establishedYear)],
    ["Company capital", text(snapshot.companyCapital)],
    ["Number of employees", text(snapshot.employees)],
    ["Factory size", text(snapshot.factorySizeM2)],
    ["Certification", text(snapshot.certifications)],
    ["Production capacity (units/year)", text(snapshot.productionCapacity)],
    ["Company president", text(snapshot.presidentName)],
    ["Website", text(snapshot.websiteUrl)],
    [
      "Country · Region · City",
      [snapshot.country, snapshot.region, snapshot.city]
        .map((part) => (part && part.length > 0 ? part : EM_DASH))
        .join(" · "),
    ],
    ["Address", text(snapshot.address)],
    ["Tel", text(snapshot.tel)],
    [
      "Track record — EBARA group",
      snapshot.trackRecordEbara && snapshot.trackRecordEbara.length > 0
        ? snapshot.trackRecordEbara
        : "None recorded",
    ],
  ];
}

export function CompanySection({ report }: { report: Report }) {
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);

  const snapshot = report.supplierSnapshot;
  const facts = factsOf(snapshot);
  const takenAt = formatSnapshotDate(snapshot.takenAt);

  return (
    <div style={{ maxWidth: 820 }}>
      <div
        className="flex items-center"
        style={{
          gap: 10,
          marginBottom: 12,
          padding: "9px 12px",
          border: "1px solid var(--color-accent-300)",
          background: "var(--color-accent-100)",
        }}
      >
        <Icon
          name="factory"
          size={15}
          style={{ color: "var(--color-accent-800)", flex: "none" }}
        />
        <div style={{ flex: 1, fontSize: 12.5, color: "var(--color-accent-900)" }}>
          <strong style={{ fontWeight: 500 }}>Source: Supplier Database</strong> ·
          snapshot taken {takenAt}
        </div>
        <Button
          size="compact"
          style={{ background: "var(--color-bg)" }}
          onClick={() => setConfirming(true)}
        >
          Refresh from supplier record
        </Button>
      </div>

      <Blueprint style={{ padding: 0 }}>
        {facts.map(([label, fact], index) => (
          <div
            key={label}
            style={{
              ...ROW_STYLE,
              borderBottom: index === facts.length - 1 ? undefined : ROW_RULE,
            }}
          >
            <span style={LABEL_STYLE}>{label}</span>
            <span style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{fact}</span>
          </div>
        ))}
      </Blueprint>

      <div
        className="flex items-center"
        style={{
          gap: 8,
          marginTop: 10,
          fontSize: 11.5,
          color: "var(--color-neutral-600)",
        }}
      >
        <Icon name="alert" size={13} />
        This section is linked, not typed — editing the supplier record does not
        change a report that was already written.
      </div>

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          toast("Snapshot refresh and its field-by-field diff arrive in Phase 2");
        }}
        title="Refresh from the supplier record"
        body={
          <>
            §2 shows the supplier record as it was frozen on {takenAt}. Refreshing
            overwrites that frozen copy with the record as it stands today, and the
            report stops being a record of what was true at the visit date.
            <br />
            <br />
            The field-by-field diff you confirm before anything is overwritten
            arrives with supplier persistence in Phase 2 — nothing is changed yet.
          </>
        }
        confirmLabel="Refresh snapshot"
      />
    </div>
  );
}
