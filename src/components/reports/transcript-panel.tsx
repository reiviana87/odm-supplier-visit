"use client";

/**
 * Transcript sources and their analysis — README §11, §15.
 *
 * Paste the text or choose a `.txt`/`.md`, then ask the assistant what is in
 * it. Findings come back as a list the user adds to the report one at a time:
 * "Add to Report" appends an observation to §6, "Dismiss" drops it. Nothing is
 * inserted without a click, which is the §15 requirement and also the only
 * honest way to treat a model's reading of a conversation.
 */

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { Tag } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { analyzeTranscript } from "@/lib/ai/actions";
import type { Finding } from "@/lib/ai/schemas";
import { saveObservations } from "@/lib/data/report-actions";
import { saveTranscript, type TranscriptSource } from "@/lib/data/transcript-actions";
import type { Observation } from "@/types/domain";

export interface TranscriptPanelProps {
  reportId: string;
  transcripts: readonly TranscriptSource[];
  /** §6's current list, so an added finding appends rather than replaces. */
  observations: readonly Observation[];
}

export function TranscriptPanel({
  reportId,
  transcripts,
  observations,
}: TranscriptPanelProps) {
  const { toast } = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [pasted, setPasted] = useState("");
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<ReadonlySet<number>>(new Set());
  const [added, setAdded] = useState<ReadonlySet<number>>(new Set());
  const [busy, startWork] = useTransition();

  const store = useCallback(
    (fileName: string, content: string) => {
      startWork(async () => {
        const result = await saveTranscript({ reportId, fileName, content });
        if (!result.ok) {
          toast(result.error.message, "error");
          return;
        }
        setPasted("");
        toast(`Transcript saved — ${result.data.wordCount.toLocaleString("en-US")} words.`);
        router.refresh();
      });
    },
    [reportId, router, toast],
  );

  const onFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      if (!/\.(txt|md)$/i.test(file.name)) {
        toast(
          `${file.name} is not a .txt or .md file. Open it, copy the text and paste it below — ` +
            "parsing Word and PDF reliably is not built.",
          "warning",
        );
        return;
      }

      store(file.name, await file.text());
    },
    [store, toast],
  );

  const analyse = useCallback(
    (transcript: TranscriptSource) => {
      startWork(async () => {
        const result = await analyzeTranscript({
          reportId,
          transcript: transcript.content,
        });
        if (!result.ok) {
          toast(result.error.message, "error");
          return;
        }
        setFindings(result.data.findings);
        setMissing(result.data.missingInformation);
        setDismissed(new Set());
        setAdded(new Set());
        if (result.data.findings.length === 0) {
          toast("Nothing report-worthy was found in that transcript.");
        }
      });
    },
    [reportId, toast],
  );

  /** §15 — one finding becomes one §6 observation, on an explicit click. */
  const addFinding = useCallback(
    (index: number, finding: Finding) => {
      startWork(async () => {
        const next: Observation[] = [
          ...observations,
          {
            id: "",
            category: finding.category,
            priority: "Normal",
            text: finding.text,
            sourceFindingId: null,
          },
        ];

        const result = await saveObservations(reportId, next);
        if (!result.ok) {
          toast(result.error.message, "error");
          return;
        }
        setAdded((current) => new Set(current).add(index));
        toast(`Added to §6 under ${finding.category}.`);
        router.refresh();
      });
    },
    [observations, reportId, router, toast],
  );

  const visible = (findings ?? []).map((finding, index) => ({ finding, index }))
    .filter(({ index }) => !dismissed.has(index));

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <input ref={fileRef} type="file" accept=".txt,.md,text/plain,text/markdown" hidden onChange={onFile} />

      {/* ── Existing sources ───────────────────────────────────────────── */}
      {transcripts.length === 0 ? (
        <EmptyState message="No transcript yet. Paste the Plaud text or choose a .txt file." />
      ) : (
        transcripts.map((transcript) => (
          <div
            key={transcript.id}
            style={{
              border: "1px solid var(--color-divider)",
              padding: "10px 12px",
              background: "var(--color-surface)",
            }}
          >
            <div className="flex items-center" style={{ gap: 7, marginBottom: 4 }}>
              <Icon name="file" size={13} />
              <strong style={{ fontSize: 12.5 }}>{transcript.fileName}</strong>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--color-neutral-600)", marginBottom: 8 }}>
              {transcript.wordCount.toLocaleString("en-US")} words
            </div>
            <Button size="compact" onClick={() => analyse(transcript)} disabled={busy}>
              <Icon name="spark" size={12} />
              {busy ? "Analysing…" : "Analyze Transcript"}
            </Button>
          </div>
        ))
      )}

      {/* ── Add one ────────────────────────────────────────────────────── */}
      <div className="flex flex-col" style={{ gap: 7 }}>
        <Textarea
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          minHeight={110}
          placeholder="Paste the Plaud transcript here…"
          aria-label="Paste a transcript"
        />
        <div className="flex items-center" style={{ gap: 7 }}>
          <Button
            size="compact"
            disabled={busy || pasted.trim().length < 20}
            onClick={() => store("Pasted transcript", pasted)}
          >
            Save transcript
          </Button>
          <Button size="compact" disabled={busy} onClick={() => fileRef.current?.click()}>
            Choose .txt / .md
          </Button>
        </div>
      </div>

      {/* ── Findings ───────────────────────────────────────────────────── */}
      {findings !== null ? (
        <div className="flex flex-col" style={{ gap: 8 }}>
          <h6 style={{ margin: "6px 0 0" }}>
            Findings · {visible.length} of {findings.length}
          </h6>

          {visible.map(({ finding, index }) => (
            <div
              key={index}
              style={{
                border: "1px solid var(--color-divider)",
                padding: "9px 11px",
                background: added.has(index) ? "var(--color-accent-100)" : "var(--color-surface)",
              }}
            >
              <div className="flex items-center" style={{ gap: 6, marginBottom: 5 }}>
                <Tag>{finding.category}</Tag>
                {/* §18 — an inference is labelled as one, so the reader can
                    weigh it rather than read it as something that was said. */}
                {finding.confidence === "implied" ? <Tag tone="warning">Implied</Tag> : null}
              </div>

              <p style={{ margin: "0 0 6px", fontSize: 12.5, lineHeight: 1.55 }}>{finding.text}</p>

              {finding.evidence ? (
                <p
                  style={{
                    margin: "0 0 7px",
                    fontSize: 11,
                    color: "var(--color-neutral-600)",
                    fontStyle: "italic",
                  }}
                >
                  “{finding.evidence}”
                </p>
              ) : null}

              {added.has(index) ? (
                <span style={{ fontSize: 11.5, color: "var(--color-accent-800)" }}>
                  Added to §6
                </span>
              ) : (
                <div className="flex items-center" style={{ gap: 6 }}>
                  <Button size="compact" disabled={busy} onClick={() => addFinding(index, finding)}>
                    Add to Report
                  </Button>
                  <Button
                    size="compact"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setDismissed((current) => new Set(current).add(index))}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          ))}

          {missing.length > 0 ? (
            <div
              style={{
                border: "1px solid var(--color-warning-border)",
                background: "var(--color-warning-bg)",
                padding: "9px 11px",
                fontSize: 11.5,
                color: "var(--color-warning-ink)",
              }}
            >
              <strong>Not covered by this transcript:</strong> {missing.join("; ")}.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
