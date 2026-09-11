import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The blueprint frame — README §3.4.
 *
 * "Every card, figure, table container and the primary button carry
 * `.blueprint` + four `<i class="corner">` registration marks. Do not drop
 * them." Built once here so the marks never appear in screen markup.
 *
 * Polymorphic: `as` changes the rendered element and the accepted props follow
 * it, so `<Blueprint as="form" action={…}>` and `<Blueprint as="figure">` both
 * typecheck.
 */
interface BlueprintOwnProps {
  children?: ReactNode;
  className?: string;
  /** Omit the four registration marks (rare: nested frames that would collide). */
  marks?: boolean;
  /** Dashed hairline — empty or pending affordances only (README §3.4). */
  dashed?: boolean;
}

export type BlueprintProps<T extends ElementType = "div"> = BlueprintOwnProps & {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, keyof BlueprintOwnProps | "as">;

export function Blueprint<T extends ElementType = "div">({
  as,
  children,
  className,
  marks = true,
  dashed = false,
  ...rest
}: BlueprintProps<T>) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag className={cn("blueprint", dashed && "dashed", className)} {...rest}>
      {marks ? <CornerMarks /> : null}
      {children}
    </Tag>
  );
}

/** The four registration marks. Decorative — hidden from assistive tech. */
export function CornerMarks() {
  return (
    <>
      <i className="corner tl" aria-hidden="true" />
      <i className="corner tr" aria-hidden="true" />
      <i className="corner bl" aria-hidden="true" />
      <i className="corner br" aria-hidden="true" />
    </>
  );
}
