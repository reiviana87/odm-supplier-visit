"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Tabs — README §4.
 *
 * "Text buttons with a 2px bottom border; active `--color-accent` +
 * `--color-text`, idle transparent + `--color-neutral-600`;
 * `padding:9px 2px; margin-right:20px`."
 *
 * The exact declaration is built in the prototype logic at line 2731
 * (`supTabs`); the strip itself is the flex row at line 463, which carries the
 * 1px divider the active mark sits on.
 *
 * Two modes, per README §4 "page tabs (supplier, settings), inline tabs
 * (appendix Photos / Layout)":
 *  - every item has an `href`  → anchors, no tablist semantics;
 *  - otherwise                → buttons with `role="tablist"` / `role="tab"`,
 *    activated through `onChange`.
 */
export interface TabItem {
  id: string;
  label: string;
  /** Present on page tabs (supplier, settings); absent on inline tabs. */
  href?: string;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  /** Required for the button form; ignored when every item carries an `href`. */
  onChange?: (id: string) => void;
  /** Labels the strip for assistive tech in the button form. */
  label?: string;
  className?: string;
}

function tabStyle(active: boolean): CSSProperties {
  return {
    padding: "9px 2px",
    marginRight: "20px",
    background: "transparent",
    borderWidth: 0,
    borderBottomWidth: "2px",
    borderBottomStyle: "solid",
    borderBottomColor: active ? "var(--color-accent)" : "transparent",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
    fontSize: "13px",
    color: active ? "var(--color-text)" : "var(--color-neutral-600)",
  };
}

export function Tabs({ items, activeId, onChange, label, className }: TabsProps) {
  const linkMode = items.every((item) => typeof item.href === "string");

  return (
    <div
      role={linkMode ? undefined : "tablist"}
      aria-label={linkMode ? undefined : label}
      className={cn(className)}
      style={{
        display: "flex",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      {items.map((item) => {
        const active = item.id === activeId;

        if (linkMode && item.href) {
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              style={tabStyle(active)}
            >
              {item.label}
            </Link>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(item.id)}
            style={tabStyle(active)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
