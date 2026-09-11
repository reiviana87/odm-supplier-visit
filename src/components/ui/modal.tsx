"use client";

import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils/cn";
import { Button, IconButton } from "./button";

/**
 * Modal — README §20 (surfaces + widths), §4 (Modal row), §24 (accessibility).
 *
 * Ported from the approved prototype (lines 1715..1721): the backdrop is the
 * design-system `.dialog-backdrop` pinned to the top of the viewport
 * (`align-items:flex-start; overflow:auto; padding:36px 24px; z-index:100`) so a
 * tall dialog scrolls the page rather than itself, and the dialog is
 * `.dialog .blueprint .elev-lg` on `--color-bg` with 20px padding, the four
 * registration marks and a 26px ghost close button in the header row.
 *
 * All modals: backdrop click and Esc close, focus is trapped inside and restored
 * to the trigger on close, the body is scroll-locked while open,
 * `role="dialog"` + `aria-modal="true"` + labelled by the title.
 */

/** README §20 — the approved width scale. */
export type ModalSize = "sm" | "md" | "lg" | "xl";

const MODAL_WIDTH: Record<ModalSize, number> = {
  sm: 440,
  md: 560,
  lg: 720,
  xl: 900,
};

/**
 * README §18 — a modal never exceeds 92vw on a narrow viewport; `100%` keeps it
 * inside the backdrop's 24px gutters, as the prototype does.
 */
function widthRule(px: number) {
  return `min(${px}px, 92vw, 100%)`;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      element.offsetWidth > 0 ||
      element.offsetHeight > 0 ||
      element === document.activeElement,
  );
}

/**
 * The three behaviours every modal owes the user (README §24): focus moved in
 * and restored on close, the body frozen behind the dialog, and Tab / Shift+Tab
 * cycling inside it.
 */
function useModalBehaviour(
  open: boolean,
  onClose: () => void,
  dialogRef: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open, dialogRef]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      const node = dialogRef.current;
      if (!node) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusableWithin(node);
      if (items.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || active === node || !node.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (active === last || !node.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [open, onClose, dialogRef]);
}

/** The dialog lives on `document.body`, so it only exists after hydration. */
const subscribeToNothing = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

interface ShellProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  width: number;
  /** Prototype: 20px on the wide modals, `--space-4` (13.6px) on the confirm. */
  padding: string;
  className?: string;
  children: ReactNode;
}

/** The portal + backdrop + dialog frame shared by `Modal` and `ConfirmModal`. */
function ModalShell({
  open,
  onClose,
  labelledBy,
  describedBy,
  width,
  padding,
  className,
  children,
}: ShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const isClient = useIsClient();
  const active = open && isClient;

  useModalBehaviour(active, onClose, dialogRef);

  if (!active) return null;

  return createPortal(
    <div
      className="dialog-backdrop"
      style={{
        alignItems: "flex-start",
        overflow: "auto",
        padding: "36px 24px",
        zIndex: 100,
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={cn("dialog blueprint elev-lg anim-rise-fast", className)}
        style={{ width: widthRule(width), background: "var(--color-bg)", padding }}
      >
        <i className="corner tl" aria-hidden="true" />
        <i className="corner tr" aria-hidden="true" />
        <i className="corner bl" aria-hidden="true" />
        <i className="corner br" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Rendered as `.dialog-title` and used as the accessible name. */
  title: string;
  /** The 12px `--color-neutral-600` subline under the title. */
  subtitle?: ReactNode;
  /** README §20 scale — sm 440 · md 560 · lg 720 · xl 900. */
  size?: ModalSize;
  /** Exact width in px, for the prototype's own 640 / 660 / 940 dialogs. */
  width?: number;
  /** The bottom row — normally a `<ModalActions>`; rendered as given. */
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = "md",
  width,
  footer,
  className,
  children,
}: ModalProps) {
  const titleId = useId();

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      width={width ?? MODAL_WIDTH[size]}
      padding="20px"
      className={className}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div className="dialog-title" id={titleId}>
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                fontSize: 12,
                color: "var(--color-neutral-600)",
                marginTop: 2,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        <IconButton
          label="Close"
          name="x"
          variant="ghost"
          size={26}
          iconSize={15}
          onClick={onClose}
        />
      </div>
      {children}
      {footer}
    </ModalShell>
  );
}

/** The right-aligned action row at the foot of a dialog (8px gap, README §4). */
export function ModalActions({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("dialog-actions", className)}>{children}</div>;
}

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  /** Destructive actions confirm with the solid `--color-danger-ink` button. */
  destructive?: boolean;
  loading?: boolean;
}

/**
 * The 440px confirmation (README §20 "Delete Confirmation"). No close cross and
 * no subtitle — title, body and the Cancel / confirm pair, exactly as the
 * prototype's Delete and Finalize dialogs.
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Confirm",
  destructive = false,
  loading = false,
}: ConfirmModalProps) {
  const titleId = useId();
  const bodyId = useId();

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={bodyId}
      width={MODAL_WIDTH.sm}
      padding="var(--space-4)"
    >
      <div className="dialog-title" id={titleId}>
        {title}
      </div>
      <div className="dialog-body" id={bodyId}>
        {body}
      </div>
      <ModalActions>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant={destructive ? "destructive-solid" : "primary"}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </ModalActions>
    </ModalShell>
  );
}
