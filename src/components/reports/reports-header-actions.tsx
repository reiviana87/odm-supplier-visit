"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { NewReportModal } from "@/components/reports/new-report-modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Supplier } from "@/types/domain";

/**
 * The two controls in the reports page header, plus the create wizard they
 * open — README §1.3, prototype lines 271..285.
 *
 * It exists because the page itself is a Server Component now: the header
 * actions are the only interactive thing on it, so they are the only thing that
 * crosses to the client. The wizard's data (suppliers, the signed-in name, the
 * numbers already taken) is fetched on the server and handed down as props
 * rather than fetched again here.
 */
export function ReportsHeaderActions({
  suppliers,
  currentUserName,
  existingDocumentNumbers,
}: {
  suppliers: readonly Supplier[];
  currentUserName: string;
  existingDocumentNumbers: readonly string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        icon="download"
        onClick={() =>
          toast("Export list (XLSX) arrives with the export pipeline (Phase 5)")
        }
      >
        Export list (XLSX)
      </Button>
      <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
        New Visit Report
      </Button>

      <NewReportModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(reportId) => {
          setCreateOpen(false);
          router.push(`/reports/${reportId}/purpose`);
        }}
        suppliers={suppliers}
        currentUserName={currentUserName}
        existingDocumentNumbers={existingDocumentNumbers}
      />
    </>
  );
}
