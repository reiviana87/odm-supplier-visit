"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  archiveSupplier,
  deleteSupplier,
  restoreSupplier,
} from "@/lib/data/supplier-actions";

/**
 * Delete / archive / restore for one supplier — Phase 2 §33.
 *
 * A supplier that has been visited is never hard-deleted: the reports written
 * about it are the record of a visit that happened. `deleteSupplier()` enforces
 * that, and this control shows the refusal it sends back and turns it into the
 * offer the user can actually accept — archiving, which takes the record out of
 * the lists and the pickers and leaves every report readable.
 *
 * The record typed by mistake this morning still deletes, which is why the
 * delete is attempted rather than pre-judged from the report count.
 */

/** Which dialog is open. The archive one is normally reached through the delete. */
type Stage = "idle" | "delete" | "archive";

export interface SupplierLifecycleActionsProps {
  supplierId: string;
  supplierName: string;
  /** An archived supplier offers the way back instead. */
  archived: boolean;
}

export function SupplierLifecycleActions({
  supplierId,
  supplierName,
  archived,
}: SupplierLifecycleActionsProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("idle");
  const [busy, setBusy] = useState(false);
  /** The sentence the data layer sent back, shown inside the open dialog. */
  const [message, setMessage] = useState<string | null>(null);

  function open(next: Stage) {
    setMessage(null);
    setStage(next);
  }

  function close() {
    if (busy) return;
    setStage("idle");
    setMessage(null);
  }

  async function handleDelete() {
    setBusy(true);
    const result = await deleteSupplier(supplierId);
    setBusy(false);

    if (result.ok) {
      setStage("idle");
      toast(`${supplierName} deleted.`);
      router.push("/suppliers");
      router.refresh();
      return;
    }

    // §33 — the refusal for a visited supplier names archiving; carry that
    // sentence straight into the dialog that offers it.
    setMessage(result.error.message);
    if (result.error.code === "conflict") setStage("archive");
  }

  async function handleArchive() {
    setBusy(true);
    const result = await archiveSupplier(supplierId);
    setBusy(false);

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setStage("idle");
    setMessage(null);
    toast(`${supplierName} archived — its visit reports stay readable.`);
    router.refresh();
  }

  async function handleRestore() {
    setBusy(true);
    const result = await restoreSupplier(supplierId);
    setBusy(false);

    if (!result.ok) {
      setMessage(result.error.message);
      setStage("archive");
      return;
    }

    toast(`${supplierName} is back in the supplier lists.`);
    router.refresh();
  }

  if (archived) {
    return (
      <>
        <Button icon="refresh" loading={busy} onClick={handleRestore}>
          Restore Supplier
        </Button>

        <ConfirmModal
          open={stage === "archive"}
          onClose={close}
          onConfirm={handleRestore}
          title="Restore supplier"
          body={
            <>
              <p style={{ margin: 0 }}>
                {`${supplierName} is archived: it stays out of the supplier lists and the report pickers until it is restored.`}
              </p>
              {message ? <ErrorState className="mt-[10px]" message={message} /> : null}
            </>
          }
          confirmLabel="Try again"
          loading={busy}
        />
      </>
    );
  }

  return (
    <>
      <IconButton
        label="Delete supplier"
        name="trash"
        variant="secondary"
        size={36}
        onClick={() => open("delete")}
      />

      <ConfirmModal
        open={stage === "delete"}
        onClose={close}
        onConfirm={handleDelete}
        title="Delete supplier"
        body={
          <>
            <p style={{ margin: 0 }}>
              {`${supplierName} will be removed from the supplier database. This cannot be undone.`}
            </p>
            {message ? <ErrorState className="mt-[10px]" message={message} /> : null}
          </>
        }
        confirmLabel="Delete Supplier"
        destructive
        loading={busy}
      />

      <ConfirmModal
        open={stage === "archive"}
        onClose={close}
        onConfirm={handleArchive}
        title="Archive supplier instead"
        body={
          <>
            <p style={{ margin: 0 }}>
              {`${supplierName} leaves the supplier lists and the report pickers. Its visit reports stay readable, and it can be restored at any time.`}
            </p>
            {message ? <ErrorState className="mt-[10px]" message={message} /> : null}
          </>
        }
        confirmLabel="Archive Supplier"
        loading={busy}
      />
    </>
  );
}
