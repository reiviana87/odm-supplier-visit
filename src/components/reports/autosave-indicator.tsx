"use client";

/**
 * Autosave indicator — README §7, §24.
 *
 * The five autosave states share one fixed 160px slot in the editor header:
 * 11.5px text in `--color-neutral-600` with a 13px leading icon. It is never a
 * modal, never a blocking spinner and never a layout shift — the slot keeps its
 * width even when there is nothing to say.
 *
 * The resting copy is the one in the approved capture
 * (`design-handoff/screenshots/04-report-editor.png`): `Saved · last saved 11:42`.
 */

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import type { AutosaveState } from "@/lib/autosave/use-autosave";

export interface AutosaveIndicatorProps {
  state: AutosaveState;
  /** README §7 — the failed state is clickable and retries the patch. */
  onRetry?: () => void;
}

interface Presentation {
  icon: IconName;
  text: string;
  /** Ink for both the icon and the label. */
  className: string;
  spin?: boolean;
}

/** 24-hour clock, as printed in the header: `11:42`. */
function clockLabel(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** `null` before the first save of the session — the slot stays empty. */
function present(state: AutosaveState): Presentation | null {
  switch (state.status) {
    case "saving":
      return {
        icon: "refresh",
        text: "Saving…",
        className: "text-neutral-600",
        spin: true,
      };
    case "saved":
      return {
        icon: "check",
        text:
          state.lastSavedAt === null
            ? "Saved"
            : `Saved · last saved ${clockLabel(state.lastSavedAt)}`,
        className: "text-accent",
      };
    case "idle":
      return state.lastSavedAt === null
        ? null
        : {
            icon: "clock",
            text: `Last saved ${clockLabel(state.lastSavedAt)}`,
            className: "text-neutral-600",
          };
    case "failed":
      return {
        icon: "alert",
        text: "Save failed — retry",
        className: "text-danger-ink",
      };
    case "offline":
      return {
        icon: "wifi-off",
        text: `${state.queuedCount} ${
          state.queuedCount === 1 ? "change" : "changes"
        } queued — offline`,
        className: "text-warning-ink",
      };
  }
}

function Body({ view }: { view: Presentation }) {
  return (
    <>
      <Icon
        name={view.icon}
        size={13}
        className={cn("flex-none", view.spin && "anim-spin")}
      />
      <span className="truncate">{view.text}</span>
    </>
  );
}

export function AutosaveIndicator({ state, onRetry }: AutosaveIndicatorProps) {
  const view = present(state);
  const failed = state.status === "failed";

  return (
    <div
      // README §24 — polite for progress, assertive for failures.
      aria-live={failed ? "assertive" : "polite"}
      className="flex w-[160px] flex-none items-center overflow-hidden text-[11.5px] text-neutral-600"
    >
      {view === null ? null : failed && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          title="Retry saving"
          className={cn(
            "flex min-w-0 cursor-pointer items-center gap-[6px] bg-transparent p-0 text-left text-[11.5px]",
            view.className,
          )}
        >
          <Body view={view} />
        </button>
      ) : (
        <span className={cn("flex min-w-0 items-center gap-[6px]", view.className)}>
          <Body view={view} />
        </span>
      )}
    </div>
  );
}
