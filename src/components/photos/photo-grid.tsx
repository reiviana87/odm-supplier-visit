import type { CSSProperties, ReactNode } from "react";

/**
 * The photo card grid — README §9–11, prototype line 984.
 *
 *   grid-template-columns: repeat(auto-fill, minmax(236px, 1fr));
 *   gap: 14px
 *
 * Layout only: the cards, the drop tile and any empty state are passed in, so
 * one grid serves all three image regions.
 */
export interface PhotoGridProps {
  children: ReactNode;
  /** Minimum track width in px. 236 is the approved value. */
  minColumnWidth?: number;
  /** Track gap in px. */
  gap?: number;
  className?: string;
  style?: CSSProperties;
}

export function PhotoGrid({
  children,
  minColumnWidth = 236,
  gap = 14,
  className,
  style,
}: PhotoGridProps) {
  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${minColumnWidth}px, 1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
