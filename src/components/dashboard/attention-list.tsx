import Link from "next/link";
import type { CSSProperties } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/states";

/**
 * Dashboard — "Reports Requiring Attention" (README §1.2, prototype lines
 * 236..247).
 *
 * A blueprint frame at `padding:4px 12px` whose rows are full-width links: a
 * 5px square dot, the sentence at 12.5px, and a 13px chevron at 40% opacity.
 * Each row carries the 1px bottom divider, including the last — as measured.
 *
 * The rows are counted by the page from the reports the data layer returns, so
 * this component is only the frame: it takes finished sentences and the route
 * each one opens. A row nobody can route to would be worse than no row, so the
 * page supplies the href rather than this file mapping seeded ids to routes.
 */

export type AttentionTone = "accent" | "warning";

export interface AttentionItem {
  id: string;
  /** The finished sentence, already counted and pluralised by the page. */
  text: string;
  tone: AttentionTone;
  /** Where the row opens — the reports list, filtered down by the reader. */
  href: string;
}

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
  items: readonly AttentionItem[];
  /**
   * The sentence from a failed read (§27). It replaces the rows rather than
   * leaving the panel looking like a clean queue when nothing was counted.
   */
  error?: string;
}

export function AttentionList({ items, error }: AttentionListProps) {
  if (items.length === 0) {
    return <EmptyState message={error ?? "Nothing needs attention right now."} />;
  }

  return (
    <Blueprint style={{ padding: "4px 12px" }}>
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
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
