import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { Blueprint } from "./blueprint";

/**
 * Filter bar — README §4 "Filter": a row of selects inside a `.blueprint`
 * (`padding:11px 12px; gap:8px; flex-wrap:wrap`) preceded by a search.
 * Prototype line 366 (suppliers) and line 286 (reports) are identical.
 */
export interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <Blueprint
      className={cn(className)}
      style={{
        padding: "11px 12px",
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        alignItems: "center",
        marginBottom: "16px",
      }}
    >
      {children}
    </Blueprint>
  );
}
