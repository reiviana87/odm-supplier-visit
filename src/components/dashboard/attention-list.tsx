import Link from "next/link";
import type { CSSProperties } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Icon } from "@/components/ui/icon";
import {
  HUATONG_REPORT,
  type AttentionTone,
  type DashboardAttentionItem,
} from "@/lib/mock-data";

/**
 * Dashboard — "Reports Requiring Attention" (README §1.2, prototype lines
 * 236..247).
 *
 * A blueprint frame at `padding:4px 12px` whose rows are full-width links: a
 * 5px square dot, the sentence at 12.5px, and a 13px chevron at 40% opacity.
 * Each row carries the 1px bottom divider, including the last — as measured.
 *
 * The prototype's handlers open the live report on the section that has the
 * problem; those targets are reproduced here as routes. **[INFERRED]** — the
 * seed rows carry no href, and "1 transcript uploaded but not analysed" has no
 * route of its own (Transcript Analysis is a modal over the editor, README
 * §12), so it points at §6 Visit Relevant Information, where the findings
 * banner lives.
 */

const HREF_BY_ID: Record<string, string> = {
  "missing-conclusion": `/reports/${HUATONG_REPORT.id}/conclusion`,
  "missing-captions": `/reports/${HUATONG_REPORT.id}/appendix`,
  "ready-for-review": "/reports",
  "transcript-pending": `/reports/${HUATONG_REPORT.id}/visit`,
};

const DOT_COLOR: Record<AttentionTone, string> = {
  warning: "var(--color-warning-strong)",
  accent: "var(--color-accent)",
};

const ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  padding: "10px 0",
  borderBottom: "1px solid var(--color-divider)",
  fontSize: "12.5px",
  color: "var(--color-text)",
  textDecoration: "none",
  textAlign: "left",
};

export interface AttentionListProps {
  items: readonly DashboardAttentionItem[];
}

export function AttentionList({ items }: AttentionListProps) {
  return (
    <Blueprint style={{ padding: "4px 12px" }}>
      {items.map((item) => (
        <Link
          key={item.id}
          href={HREF_BY_ID[item.id] ?? "/reports"}
          className="hover:bg-[var(--rule-hover)]"
          style={ROW}
        >
          <span
            aria-hidden="true"
            style={{
              width: "5px",
              height: "5px",
              flex: "none",
              background: DOT_COLOR[item.tone],
            }}
          />
          <span style={{ flex: 1 }}>{item.text}</span>
          <Icon
            name="right"
            size={13}
            style={{ flex: "none", opacity: 0.4 }}
          />
        </Link>
      ))}
    </Blueprint>
  );
}
