"use client";

/**
 * Autosave indicator — README §7, §24.
 *
 * The autosave states share one fixed 160px slot in the editor header:
 * 11.5px text in `--color-neutral-600` with a 13px leading icon. It is never a
 * modal, never a blocking spinner and never a layout shift — the slot keeps its
 * width even when there is nothing to say.
 *
 * The resting copy is the one in the approved capture
 * (`design-handoff/screenshots/04-report-editor.png`): `Saved · last saved 11:42`.
 *
 * Phase 2 added a sixth state, `conflict`: another session saved this section
 * first. It is deliberately NOT the failed state — retrying a stale write is
 * the data loss §18 exists to prevent — so the engine stops resending until the
 * user acts, and the slot's action is "review": it opens the conflict dialog,
 * where both versions are named and the user picks one. It cannot reload on the
 * spot, because reloading drops the text still in the editor, and losing it
 * without being asked is the whole thing §18 forbids.
 */

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import type { AutosaveState } from "@/lib/autosave/use-autosave";

export interface AutosaveIndicatorProps {
  state: AutosaveState;
  /** README §7 — the failed state is clickable and retries the patch. */
  onRetry?: () => void;
  /**
   * Phase 2 §18 — the conflict state's action: opens the conflict dialog. It
   * resolves nothing by itself; the dialog is where the user chooses between
   * the newer version and their own text.
   */
  onReviewConflict?: () => void;
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
    case "conflict":
      return {
        icon: "alert",
        text: "Newer version — review",
        className: "text-warning-ink",
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

export function AutosaveIndicator({
  state,
  onRetry,
  onReviewConflict,
}: AutosaveIndicatorProps) {
  const view = present(state);
  const failed = state.status === "failed";
  const conflicted = state.status === "conflict";

  // Both states offer an action, but they are different actions: `failed` sends
  // the same patch again, `conflict` must not — it opens the dialog instead.
  const action = failed ? onRetry : conflicted ? onReviewConflict : undefined;
  const actionTitle = failed
    ? "Retry saving"
    : state.message ?? "Review the newer version and choose which one to keep";

  return (
    <div
      // README §24 — polite for progress, assertive for failures. A conflict is
      // not a failure but it does need saying out loud: nothing is being saved
      // until the user decides.
      aria-live={failed || conflicted ? "assertive" : "polite"}
      className="flex w-[160px] flex-none items-center overflow-hidden text-[11.5px] text-neutral-600"
    >
      {view === null ? null : action ? (
        <button
          type="button"
          onClick={action}
          title={actionTitle}
          className={cn(
            "flex min-w-0 cursor-pointer items-center gap-[6px] bg-transparent p-0 text-left text-[11.5px]",
            view.className,
          )}
        >
          <Body view={view} />
        </button>
      ) : (
        <span
          className={cn("flex min-w-0 items-center gap-[6px]", view.className)}
          title={conflicted ? actionTitle : undefined}
        >
          <Body view={view} />
        </span>
      )}
    </div>
  );
}
