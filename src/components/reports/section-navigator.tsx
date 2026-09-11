"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CompletionIndicator } from "@/components/ui/progress";
import { Icon } from "@/components/ui/icon";
import { SECTIONS, type SectionId } from "@/types/domain";

/**
 * Editor section navigator — README §6.1 / §6.2.
 *
 *   width 210px · flex none · border-right 1px solid var(--color-divider)
 *   padding 16px 8px 20px · position sticky, top 156px
 *   max-height calc(100vh - 156px) · overflow auto
 *
 * Row states (README §6.2):
 *   incomplete  open circle 12px var(--color-neutral-400), label neutral-700
 *   completed   check 12px var(--color-accent), label var(--color-text)
 *   selected    var(--color-accent-100) fill + 2px left border var(--color-accent)
 *   warning     a small warning triangle after the label
 *   sub-section 4.1 / 8.1 indented 14px, number in var(--color-neutral-600)
 *
 * Prototype: design-handoff/ODM Supplier Visit.dc.html lines 796..818.
 */
export function SectionNavigator({
  reportId,
  activeSection,
  completion,
  completionPercent,
  warnings = {},
  aiAvailable = {},
  onSubmitForReview,
}: {
  reportId: string;
  activeSection: SectionId;
  completion: Record<SectionId, boolean>;
  completionPercent: number;
  /** Sections carrying a blocking issue, e.g. captions missing before export. */
  warnings?: Partial<Record<SectionId, string>>;
  /** Sections with an unreviewed AI suggestion — an 11px spark, right-aligned. */
  aiAvailable?: Partial<Record<SectionId, boolean>>;
  onSubmitForReview?: () => void;
}) {
  return (
    <div
      className="flex-none self-start overflow-auto"
      style={{
        width: "var(--editor-nav-width)",
        borderRight: "1px solid var(--color-divider)",
        padding: "16px 8px 20px",
        position: "sticky",
        top: "var(--editor-header-offset)",
        maxHeight: "calc(100vh - var(--editor-header-offset))",
      }}
    >
      <div style={{ padding: "0 8px 12px" }}>
        <CompletionIndicator value={completionPercent} variant="navigator" />
      </div>

      <div className="kicker-muted" style={{ padding: "0 8px 6px" }}>
        Sections
      </div>

      <nav aria-label="Report sections" className="flex flex-col" style={{ gap: 1 }}>
        {SECTIONS.map((section) => {
          const done = completion[section.id];
          const selected = section.id === activeSection;
          const warning = warnings[section.id];

          return (
            <Link
              key={section.id}
              href={`/reports/${reportId}/${section.id}`}
              aria-current={selected ? "page" : undefined}
              className="section-nav-row flex items-center"
              style={{
                gap: 7,
                padding: "6px 8px",
                paddingLeft: section.isSubSection ? 22 : 8,
                fontSize: 12.5,
                lineHeight: 1.3,
                textDecoration: "none",
                background: selected ? "var(--color-accent-100)" : "transparent",
                boxShadow: selected ? "inset 2px 0 0 var(--color-accent)" : undefined,
                color: done || selected ? "var(--color-text)" : "var(--color-neutral-700)",
              }}
            >
              <Icon
                name={done ? "check" : "circle"}
                size={13}
                strokeWidth={1.8}
                style={{
                  flex: "none",
                  color: done ? "var(--color-accent)" : "var(--color-neutral-400)",
                }}
              />
              <span
                aria-hidden={section.number === "" || undefined}
                style={{
                  width: 22,
                  flex: "none",
                  fontSize: 11,
                  color: "var(--color-neutral-600)",
                }}
              >
                {section.number}
              </span>
              <span className="flex-1">{section.label}</span>
              {warning ? (
                <Icon
                  name="alert"
                  size={11}
                  title={warning}
                  style={{ flex: "none", color: "var(--color-warning-strong)" }}
                />
              ) : null}
              {aiAvailable[section.id] ? (
                <Icon
                  name="spark"
                  size={11}
                  style={{ flex: "none", color: "var(--color-accent-700)" }}
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="hr" style={{ margin: "14px 8px" }} />

      <Button
        variant="secondary"
        onClick={onSubmitForReview}
        style={{ fontSize: 12, margin: "0 8px", width: "calc(100% - 16px)" }}
      >
        Submit for Review
      </Button>
    </div>
  );
}
