"use client";

import type { ComponentPropsWithoutRef, CSSProperties } from "react";

import { cn } from "@/lib/utils/cn";
import { useFieldControl } from "./field";
import { Icon } from "./icon";

/**
 * README §4 — "`.input` with a 13–14px search icon absolutely positioned at
 * `left:9px; top:11px`, `padding-left:26–28px`".
 *
 * - `global` — the top bar (prototype lines 154–157): 340px, max-width 42%,
 *   14px glyph, 28px left padding. `onFocus` opens the results panel.
 * - `page`   — filter bars (prototype lines 367–371): 220px, 13px glyph,
 *   26px left padding.
 */
export type SearchFieldVariant = "page" | "global";

interface VariantSpec {
  width: number;
  maxWidth?: string;
  glyph: number;
  paddingLeft: number;
  fontSize: number;
}

const VARIANTS: Record<SearchFieldVariant, VariantSpec> = {
  page: { width: 220, glyph: 13, paddingLeft: 26, fontSize: 12.5 },
  global: {
    width: 340,
    maxWidth: "42%",
    glyph: 14,
    paddingLeft: 28,
    fontSize: 12.5,
  },
};

interface SearchFieldOwnProps {
  variant?: SearchFieldVariant;
  /** Overrides the variant width — px number or any CSS length. */
  width?: number | string;
  /** Applied to the positioning wrapper; `style` and the rest go to the input. */
  className?: string;
}

export type SearchFieldProps = SearchFieldOwnProps &
  Omit<ComponentPropsWithoutRef<"input">, keyof SearchFieldOwnProps | "type">;

export function SearchField({
  variant = "page",
  width,
  className,
  style,
  id,
  placeholder,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  ...rest
}: SearchFieldProps) {
  const spec = VARIANTS[variant];
  const { aria, inField } = useFieldControl(id, describedBy, undefined);

  const wrapperStyle: CSSProperties = {
    position: "relative",
    width: width ?? spec.width,
    maxWidth: spec.maxWidth,
  };

  return (
    <div className={cn(className)} style={wrapperStyle}>
      <Icon
        name="search"
        size={spec.glyph}
        className="pointer-events-none absolute left-[9px] top-[11px] opacity-[0.45]"
      />
      <input
        // `type="search"` gives Escape-to-clear; the webkit clear button is
        // suppressed because the approved design has no such affordance.
        type="search"
        placeholder={placeholder}
        aria-label={ariaLabel ?? (inField ? undefined : placeholder)}
        className="input [&::-webkit-search-cancel-button]:appearance-none"
        style={{
          paddingLeft: spec.paddingLeft,
          fontSize: spec.fontSize,
          ...style,
        }}
        {...aria}
        {...rest}
      />
    </div>
  );
}
