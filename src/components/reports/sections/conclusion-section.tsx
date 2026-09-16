"use client";

import { useId, useState } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { SECTIONS, type Report } from "@/types/domain";

/**
 * §9 Conclusion — prototype lines 1245..1275, README §13.
 *
 * The seeded report has no conclusion, so this is the section's empty state:
 * the approved "No conclusion yet" card plus a preview of the generator's
 * source checklist (README §13, point 1). The generator itself is Phase 6 —
 * the checklist is therefore disabled and says so, rather than pretending to
 * offer a run.
 *
 * `Write manually` opens the same prose frame the generated draft would land
 * in, so the section is fully usable without AI.
 */

/** README §13 point 1 — the nine sources, all on by default. */
const CONCLUSION_SOURCES = [
  "Purpose",
  "Company Overview",
  "Main Products",
  "Target Products",
  "Visit Relevant Information",
  "Certificates",
  "Partners",
  "Plaud Transcript",
  "Photo Analysis",
] as const;

const GENERATOR_PHASE = "The conclusion generator arrives in Phase 6";

function SourceChecklist({ sourcesId }: { sourcesId: string }) {
  return (
    <div
      style={{
        marginTop: 20,
        paddingTop: 16,
        borderTop: "1px solid var(--color-divider)",
        textAlign: "left",
      }}
    >
      <div className="kicker-muted" id={sourcesId} style={{ marginBottom: 8 }}>
        Sources
      </div>
      <div
        role="group"
        aria-labelledby={sourcesId}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "7px 16px",
          opacity: 0.45,
        }}
      >
        {CONCLUSION_SOURCES.map((source) => (
          <label
            key={source}
            className="flex items-center"
            style={{ gap: 7, fontSize: 12.5, cursor: "not-allowed" }}
          >
            <input type="checkbox" checked disabled readOnly />
            {source}
          </label>
        ))}
      </div>
      <p
        style={{
          fontSize: 11.5,
          color: "var(--color-neutral-600)",
          margin: "10px 0 0",
        }}
      >
        What the draft would read. The picker, the per-source progress list and the
        generated draft arrive in Phase 6 — nothing is written into the report until
        you accept it.
      </p>
    </div>
  );
}

export function ConclusionSection({ report }: { report: Report }) {
  const { toast } = useToast();
  const textId = useId();
  const sourcesId = useId();

  const [text, setText] = useState(report.sections.conclusion);
  const [writing, setWriting] = useState(report.sections.conclusion.length > 0);

  const placeholder =
    SECTIONS.find((section) => section.id === "conclusion")?.placeholder ??
    "{{CONCLUSION}}";

  return (
    <div style={{ maxWidth: 860 }}>
      {writing ? (
        <>
          <label className="sr-only" htmlFor={textId}>
            Conclusion
          </label>
          <Textarea
            prose
            id={textId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            minHeight={520}
            placeholder="Overall assessment, capability, risks, opportunities, recommendation, next steps…"
            style={{ padding: 16 }}
          />
          <div
            className="flex items-center"
            style={{
              gap: 16,
              fontSize: 11.5,
              color: "var(--color-neutral-600)",
              marginTop: 7,
            }}
          >
            <span>
              Maps to{" "}
              <span className="mono" style={{ color: "var(--color-accent-700)" }}>
                {placeholder}
              </span>{" "}
              in the Word template
            </span>
            <div style={{ flex: 1 }} />
            <Button
              variant="ghost"
              size="compact"
              style={{ fontSize: 11.5, color: "var(--color-neutral-700)" }}
              onClick={() => toast(GENERATOR_PHASE)}
            >
              Generate instead
            </Button>
          </div>
        </>
      ) : (
        <Blueprint
          style={{
            padding: "38px 30px",
            textAlign: "center",
            background: "var(--color-neutral-100)",
          }}
        >
          <Icon
            name="spark"
            size={26}
            style={{ color: "var(--color-accent-700)", margin: "0 auto 12px" }}
          />
          <h4 style={{ margin: "0 0 5px" }}>No conclusion yet</h4>
          <p
            className="text-muted"
            style={{ fontSize: 13, margin: "0 auto 18px", maxWidth: 440 }}
          >
            The conclusion can be drafted from everything already in this report —
            sections, transcript findings and photo analysis. You review it before
            anything is written.
          </p>
          <div className="flex justify-center" style={{ gap: 8 }}>
            <Button
              variant="primary"
              icon="spark"
              onClick={() => toast(GENERATOR_PHASE)}
            >
              Generate Conclusion
            </Button>
            <Button onClick={() => setWriting(true)}>Write manually</Button>
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--color-neutral-600)",
              marginTop: 16,
            }}
          >
            The report is fully usable without AI — this is optional.
          </div>

          <SourceChecklist sourcesId={sourcesId} />
        </Blueprint>
      )}
    </div>
  );
}
