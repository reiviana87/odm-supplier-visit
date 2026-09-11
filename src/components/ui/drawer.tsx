"use client";

import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { IconButton } from "./button";

/**
 * Drawer — the editor rail (README §2 "Editor rail", §4 Drawer row, §20).
 *
 * The only drawer in the approved design: 320px, `flex:none`, a hairline on the
 * inner edge, sticky under the 156px editor offset and scrolling on its own.
 * It is **not** a portal and **not** modal — it is an in-flow column that sits
 * beside the writing column, holding reference material used *while* working,
 * so it neither traps focus nor locks the body (README §20 rule).
 *
 * Esc closes it (README §24), unless focus is inside a modal stacked above it.
 *
 * The header is a title row plus a 24px ghost close button, with an optional
 * `tabs` strip beneath it — the editor supplies its own Sources / AI Assistant
 * switch there.
 */
export interface DrawerProps {
  open: boolean;
  /** Prototype: 320px. */
  width?: number;
  /** Which edge carries the divider. The editor rail sits on the right. */
  side?: "left" | "right";
  /** The `h5` title row — a node so a rail can prefix its own icon. */
  title: ReactNode;
  /** Optional tab strip rendered directly under the title row. */
  tabs?: ReactNode;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}

/** README §2 — editor header total height; the rail sticks below it. */
const EDITOR_OFFSET = 156;

export function Drawer({
  open,
  width = 320,
  side = "right",
  title,
  tabs,
  onClose,
  className,
  children,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // A modal above the rail owns Esc first: focus is trapped inside it.
      if (event.target instanceof Element && event.target.closest('[role="dialog"]')) {
        return;
      }
      onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const divider = "1px solid var(--color-divider)";

  return (
    <aside
      aria-label={typeof title === "string" ? title : undefined}
      className={cn("anim-slide", className)}
      style={{
        width,
        flex: "none",
        borderLeft: side === "right" ? divider : undefined,
        borderRight: side === "left" ? divider : undefined,
        position: "sticky",
        top: EDITOR_OFFSET,
        alignSelf: "flex-start",
        maxHeight: `calc(100vh - ${EDITOR_OFFSET}px)`,
        overflow: "auto",
      }}
    >
      <div style={{ padding: "16px 14px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <h5 style={{ margin: 0, flex: 1, display: "flex", alignItems: "center", gap: 7 }}>
            {title}
          </h5>
          <IconButton
            label="Close panel"
            name="x"
            variant="ghost"
            size={24}
            iconSize={14}
            onClick={onClose}
          />
        </div>
        {tabs ? <div style={{ marginBottom: 12 }}>{tabs}</div> : null}
        {children}
      </div>
    </aside>
  );
}
