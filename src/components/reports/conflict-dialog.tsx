"use client";

import { useId, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal, ModalActions } from "@/components/ui/modal";
import type { AutosaveConflict } from "@/lib/autosave/use-autosave";

/**
 * Conflict dialog — Phase 2 §18.
 *
 * The autosave `conflict` state is the one state the user has to answer, so it
 * gets a surface of its own instead of a line in a 160px slot. The dialog says
 * three things and no more:
 *
 *   1. a newer version of this section exists — who wrote it and when, when the
 *      server said so, and nothing invented when it did not;
 *   2. nothing has been discarded: the draft is still in the editor and the
 *      newer version is still on the server;
 *   3. the two answers, each carrying its own consequence in full.
 *
 * It is deliberately not a merge tool. There is no diff, no three-way apply and
 * no "smart" reconciliation — §18 asks that neither version be lost without the
 * user choosing, and a choice is the honest way to guarantee that. The dialog
 * decides nothing by itself: dismissing it leaves the conflict open, the text
 * intact and autosave still paused.
 *
 * Chrome, focus handling, Escape, the backdrop and the registration marks come
 * from `@/components/ui/modal`, the same as `new-report-modal.tsx`. Nothing
 * here introduces a second modal style.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   Geometry — the prototype's note strip (line 1751) and supplier card
   (line 3171), re-used with the warning and divider tokens.
   ═══════════════════════════════════════════════════════════════════════════ */

const WARNING_STRIP: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: "8px 10px",
  border: "1px solid var(--color-warning-border)",
  background: "var(--color-warning-bg)",
  fontSize: 12,
  color: "var(--color-warning-ink)",
};

const CHOICE: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "10px 12px",
  border: "1px solid var(--color-divider)",
};

const CHOICE_CONSEQUENCE: CSSProperties = {
  marginTop: 3,
  fontSize: 11.5,
  lineHeight: 1.45,
  color: "var(--color-neutral-600)",
};

/* ═══════════════════════════════════════════════════════════════════════════
   The other side, described only as far as the server described it
   ═══════════════════════════════════════════════════════════════════════════ */

/** 24-hour clock, as everywhere else in the editor header: `14:02`. */
function clockLabel(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * `at 14:02` today, `on Sep 10 at 14:02` before that — the same short date the
 * report list prints. `null` when there is no usable timestamp, which is a
 * sentence the caller simply leaves out.
 */
function whenLabel(updatedAt: string | undefined): string | null {
  if (updatedAt === undefined) {
    return null;
  }
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const clock = clockLabel(date);
  if (sameDay) {
    return `at ${clock}`;
  }
  const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `on ${day} at ${clock}`;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A name only if it is one. An empty string is not a name, and neither is the
 * raw `updated_by` uuid — showing either would be worse than the neutral
 * wording, because it reads as an answer to "who?" while telling the user
 * nothing (Phase 2 §18: never invent the other person).
 */
function nameLabel(updatedBy: string | null | undefined): string | null {
  if (updatedBy === null || updatedBy === undefined) {
    return null;
  }
  const trimmed = updatedBy.trim();
  if (trimmed === "" || UUID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/** The one factual sentence about the newer version, in four honest shapes. */
function describeOtherSave(conflict: AutosaveConflict | undefined): string {
  const who = nameLabel(conflict?.serverUpdatedBy);
  const when = whenLabel(conflict?.serverUpdatedAt);

  if (who !== null && when !== null) {
    return `${who} saved this section ${when}, while it was open here.`;
  }
  if (who !== null) {
    return `${who} saved this section while it was open here.`;
  }
  if (when !== null) {
    return `Another session saved this section ${when}, while it was open here.`;
  }
  return "Another session saved this section while it was open here.";
}

/* ═══════════════════════════════════════════════════════════════════════════
   ConflictDialog
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ConflictDialogProps {
  open: boolean;
  /**
   * The close cross, Escape and the backdrop all land here. It must leave the
   * conflict unresolved: no reload, no save, the draft untouched.
   */
  onDismiss: () => void;
  /**
   * "Reload latest version" — re-read the section and hand the server's value
   * to the editor, then call the hook's `resolveWithServer()`.
   */
  onReloadLatest: () => void;
  /**
   * "Keep my changes" — call the hook's `resolveWithLocal()`, which re-sends
   * the draft at the server's version and so replaces it.
   */
  onKeepMine: () => void;
  /** `state.conflict` from `useAutosave`. Absent fields are simply not stated. */
  conflict?: AutosaveConflict;
  /** What is in conflict, e.g. "§3 Overview" — shown as the dialog subtitle. */
  sectionLabel?: string;
  /** Which answer is in flight, so both controls hold still while it settles. */
  pending?: "reload" | "keep";
}

export function ConflictDialog({
  open,
  onDismiss,
  onReloadLatest,
  onKeepMine,
  conflict,
  sectionLabel,
  pending,
}: ConflictDialogProps): React.JSX.Element {
  const baseId = useId();
  const reloadId = `${baseId}-reload`;
  const keepId = `${baseId}-keep`;

  const busy = pending !== undefined;
  const version = conflict?.serverVersion;

  return (
    <Modal
      open={open}
      onClose={onDismiss}
      title="A newer version of this report exists"
      subtitle={
        sectionLabel === undefined
          ? "Nothing is being saved until you choose"
          : `${sectionLabel} · nothing is being saved until you choose`
      }
    >
      <div>
        <p className="dialog-body" style={{ margin: "0 0 10px" }}>
          {describeOtherSave(conflict)}
          {version === undefined
            ? " Your own edits were written against the version you opened, so they were not applied."
            : ` The stored section is now at version ${version}; your edits were written against the version you opened, so they were not applied.`}
        </p>

        <div style={WARNING_STRIP}>
          <Icon name="alert" size={13} style={{ flex: "none", marginTop: 1 }} />
          <span>
            Nothing has been discarded. Your text is still in the editor and the
            newer version is still on the server — autosave stays paused until
            you pick one of them.
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            margin: "12px 0 4px",
          }}
        >
          <div style={CHOICE}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                Take the newer version
              </div>
              <div id={reloadId} style={CHOICE_CONSEQUENCE}>
                The section is re-read from the server and replaces what is in the
                editor. Everything typed here since it was opened is dropped, and
                it cannot be brought back.
              </div>
            </div>
            <Button
              variant="secondary"
              icon="refresh"
              disabled={busy && pending !== "reload"}
              loading={pending === "reload"}
              aria-describedby={reloadId}
              onClick={onReloadLatest}
              className="flex-none"
            >
              Reload latest version
            </Button>
          </div>

          <div style={CHOICE}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Keep what I wrote</div>
              <div id={keepId} style={CHOICE_CONSEQUENCE}>
                Your text is saved over the newer version. What the other session
                wrote is replaced, and this app keeps no copy of it — open the
                newer version first if any of it needs to be carried across.
              </div>
            </div>
            <Button
              variant="secondary"
              icon="save"
              disabled={busy && pending !== "keep"}
              loading={pending === "keep"}
              aria-describedby={keepId}
              onClick={onKeepMine}
              className="flex-none"
            >
              Keep my changes
            </Button>
          </div>
        </div>

        <ModalActions className="flex-wrap">
          <Button
            variant="ghost"
            disabled={busy}
            title="Closes without choosing — nothing is reloaded and nothing is saved"
            onClick={onDismiss}
          >
            Decide later
          </Button>
        </ModalActions>
      </div>
    </Modal>
  );
}
