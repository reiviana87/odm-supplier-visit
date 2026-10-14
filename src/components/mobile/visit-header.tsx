"use client";

import { useSyncExternalStore } from "react";

import { useRouter } from "next/navigation";

import type { VisitChoice } from "@/app/visit/page";
import { ReportStatusBadge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import type { ReportStatus } from "@/types/domain";

/**
 * Visit Mode header — README §17, prototype lines 2187..2198.
 *
 *   padding 14px 16px 12px · border-bottom 1px solid var(--color-divider)
 *   supplier name  Barlow Condensed 600 22px / 1.1
 *   visit line     12.5px var(--color-neutral-700)
 *   status badge   the report's own status tag
 *   banner         margin-top 9 · 11.5px · padding 5px 8px ·
 *                  var(--color-warning-bg) on a 1px var(--color-warning-border)
 *                  border · var(--color-warning-ink) ink · 13px wifi-off icon
 *
 * Two measurements differ from README §17, which gives the supplier name as
 * 19px and describes the banner icon without a size. The prototype is the
 * measured truth on both counts: the name is 22px and the icon is 13px.
 *
 *
 * The weak-signal banner used to be painted on every render, over a seeded
 * queue depth, so the phone permanently announced a bad connection nobody had
 * measured and six items waiting that did not exist. It appears when the
 * browser says the device is offline, and says what that means for the work in
 * hand. There is still no queue — which is exactly why the sentence promises
 * none.
 */

/** Subscribe to the browser's own online/offline events. */
function subscribeToConnection(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function useIsOffline(): boolean {
  return useSyncExternalStore(
    subscribeToConnection,
    () => !navigator.onLine,
    // The server cannot know, and guessing "offline" would flash a warning on
    // every first paint.
    () => false,
  );
}
export interface VisitHeaderProps {
  supplierName: string;
  /** e.g. "Factory Visit · Aug 12 · 10:32". */
  visitLine: string;
  status: ReportStatus;
  /** The visit this phone is standing in. */
  reportId: string;
  /** Every open report, so it can stand in a different one. */
  openReports: readonly VisitChoice[];
}

export function VisitHeader({
  supplierName,
  visitLine,
  status,
  reportId,
  openReports,
}: VisitHeaderProps) {
  const router = useRouter();
  const offline = useIsOffline();
  return (
    <header
      style={{
        padding: "14px 16px 12px",
        borderBottom: "1px solid var(--color-divider)",
        flex: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: 22,
              lineHeight: 1.1,
              letterSpacing: "normal",
              margin: 0,
            }}
          >
            {supplierName}
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--color-neutral-700)", margin: 0 }}>
            {visitLine}
          </p>
        </div>
        <ReportStatusBadge status={status} />
      </div>

      {/* Which visit this is. There was no way to say: the phone always opened
          whichever report had been edited last, so arriving at a supplier after
          a morning of desk work put you in the wrong one with no way out. */}
      {openReports.length > 1 ? (
        <Select
          aria-label="Which visit this phone is standing in"
          value={reportId}
          onChange={(event) => router.push(`/visit?report=${event.target.value}`)}
          // The 44px touch target README §24 asks for: a native select renders
          // no ::after, so the box itself has to grow.
          style={{ marginTop: 9, fontSize: 12.5, minHeight: 44 }}
        >
          {openReports.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.supplierShortName} · {choice.visitDate} · {choice.documentNumber}
            </option>
          ))}
        </Select>
      ) : null}

      {offline ? (
        <p
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            margin: "9px 0 0",
            fontSize: 11.5,
            color: "var(--color-warning-ink)",
            background: "var(--color-warning-bg)",
            border: "1px solid var(--color-warning-border)",
            padding: "5px 8px",
          }}
        >
          <Icon name="wifi-off" size={13} style={{ flex: "none" }} />
          No signal — nothing can be saved until it returns. Keep the photograph
          on the phone and file it once the bars come back.
        </p>
      ) : null}
    </header>
  );
}
