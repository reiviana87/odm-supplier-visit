"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "./icon";

/** README §4 — the approved button variants. */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "destructive-solid"
  | "ghost";

/**
 * `default` is the 36px form; `compact` (12px / 3px 9px) is the dense variant
 * used inside cards and toolbars. `toolbar` is the 12.5px editor-header size
 * measured from the prototype.
 */
export type ButtonSize = "default" | "compact" | "toolbar";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  destructive: "btn-destructive",
  "destructive-solid": "btn-destructive-solid",
  ghost: "btn-ghost",
};

/**
 * Sizes are real CSS classes, not Tailwind utilities: `.btn` is declared
 * unlayered in globals.css, so it outranks anything in `@layer utilities` and
 * a `text-[12.5px]` class would silently lose to its 14px.
 */
const SIZE_CLASS: Record<ButtonSize, string> = {
  default: "btn-default",
  compact: "btn-compact",
  toolbar: "btn-toolbar",
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon, drawn at 14px (13px when compact). */
  icon?: IconName;
  /** Trailing icon — chevrons on "Continue", "View all". */
  trailingIcon?: IconName;
  /** Full width of the container. */
  block?: boolean;
  /**
   * README §5 — the control keeps its width, shows a 14px spinner and the verb
   * in progress, and stays disabled until the action settles.
   */
  loading?: boolean;
  className?: string;
  children?: ReactNode;
}

export type ButtonProps = CommonProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof CommonProps>;

function iconSize(size: ButtonSize) {
  return size === "compact" ? 13 : 14;
}

function Content({
  icon,
  trailingIcon,
  loading,
  size,
  children,
}: Pick<CommonProps, "icon" | "trailingIcon" | "loading" | "children"> & {
  size: ButtonSize;
}) {
  return (
    <>
      {loading ? (
        <Icon name="refresh" size={14} className="anim-spin" />
      ) : icon ? (
        <Icon name={icon} size={iconSize(size)} />
      ) : null}
      {children}
      {trailingIcon && !loading ? (
        <Icon name={trailingIcon} size={iconSize(size)} />
      ) : null}
    </>
  );
}

export function Button({
  variant = "secondary",
  size = "default",
  icon,
  trailingIcon,
  block = false,
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "btn",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        block && "btn-block",
        className,
      )}
      {...rest}
    >
      <Content icon={icon} trailingIcon={trailingIcon} loading={loading} size={size}>
        {children}
      </Content>
    </button>
  );
}

export type ButtonLinkProps = CommonProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof CommonProps>;

/** A `Button` that navigates. Same anatomy, rendered as an anchor. */
export function ButtonLink({
  variant = "secondary",
  size = "default",
  icon,
  trailingIcon,
  block = false,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        "btn",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        block && "btn-block",
        className,
      )}
      {...rest}
    >
      <Content icon={icon} trailingIcon={trailingIcon} size={size}>
        {children}
      </Content>
    </Link>
  );
}

interface IconButtonOwnProps {
  /** Required — icon-only controls must be labelled (README §24). */
  label: string;
  name: IconName;
  variant?: Extract<ButtonVariant, "secondary" | "ghost" | "destructive">;
  /** Square edge in px: 23 card row · 24 table row · 26–28 toolbar. */
  size?: number;
  iconSize?: number;
  className?: string;
}

export type IconButtonProps = IconButtonOwnProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof IconButtonOwnProps>;

export function IconButton({
  label,
  name,
  variant = "ghost",
  size = 28,
  iconSize: glyph,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn("btn", VARIANT_CLASS[variant], className)}
      // `padding` is set here, not with a `p-0` utility: globals.css declares
      // `.btn` unlayered, so its padding outranks anything in @layer utilities
      // and would crush the glyph to a sliver inside a 28px square.
      style={{ width: size, height: size, minHeight: size, padding: 0, flex: "none" }}
      {...rest}
    >
      <Icon
        name={name}
        size={glyph ?? (size <= 24 ? 13 : 14)}
        style={{ flex: "none" }}
      />
    </button>
  );
}

export type IconButtonLinkProps = IconButtonOwnProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof IconButtonOwnProps>;

/** An `IconButton` that navigates. Same square, same labelling requirement. */
export function IconButtonLink({
  label,
  name,
  variant = "ghost",
  size = 28,
  iconSize: glyph,
  className,
  ...rest
}: IconButtonLinkProps) {
  return (
    <Link
      aria-label={label}
      title={label}
      className={cn("btn", VARIANT_CLASS[variant], className)}
      style={{ width: size, height: size, minHeight: size, padding: 0, flex: "none" }}
      {...rest}
    >
      <Icon
        name={name}
        size={glyph ?? (size <= 24 ? 13 : 14)}
        style={{ flex: "none" }}
      />
    </Link>
  );
}
