"use client";

import { useId, useState, type FormEvent } from "react";

import { Tag } from "@/components/ui/badge";
import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { REPORTS } from "@/lib/mock-data";

/**
 * AI Assistant — README §1.13, transcribed from the approved prototype
 * (design-handoff/ODM Supplier Visit.dc.html lines 1435..1483). There is no
 * screenshot for this screen; the markup is the measured truth.
 *
 * Phase 1 renders the approved surface only. README §11 is the governing rule
 * for this screen — "AI output is a proposal until a human accepts it" — and
 * since no model is wired yet, asking a question never fabricates an answer:
 * the answer area states what will appear there and the submit reports the
 * phase the generation lands in.
 */

/** The archive-wide context option — prototype line 1447, verbatim. */
const ARCHIVE_CONTEXT_ID = "all-reports";
const ARCHIVE_CONTEXT_LABEL = "All 18 reports (knowledge base)";

/** Prototype `assistantScoped`, line 3086. */
const SCOPED_ACTIONS = [
  "Analyze Plaud Transcript",
  "Generate Conclusion",
  "Review Manufacturing Capability",
  "Identify Risks",
  "Generate Photo Captions",
] as const;

/** Prototype `assistantPrompts`, line 3079. */
const SUGGESTED_PROMPTS = [
  "Compare TESK, Lingxiao and DAFU machining capabilities.",
  "Which suppliers have internal hydraulic testing laboratories?",
  "Which suppliers support 60 Hz motors?",
  "What risks were identified during supplier visits in 2026?",
  "Which suppliers have UL certification?",
] as const;

/** Prototype line 3085 — the message every cross-report prompt raises. */
const CROSS_REPORT_NOTE =
  "Cross-report search covers 18 reports · 2 not yet indexed";

export function AssistantPanel() {
  const { toast } = useToast();
  const contextId = useId();
  const promptId = useId();

  const [context, setContext] = useState<string>(REPORTS[0].documentNumber);
  const [prompt, setPrompt] = useState("");

  const scopeLabel = context === ARCHIVE_CONTEXT_ID ? "All reports" : context;

  function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    toast(
      "The assistant answers in Phase 4 — your question was not sent, and the text is still here.",
    );
  }

  return (
    <div className="anim-rise" style={{ padding: "26px 24px 40px", maxWidth: 900 }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 3 }}
      >
        <Icon name="spark" size={20} style={{ color: "var(--color-accent-700)" }} />
        <h2 style={{ margin: 0 }}>AI Assistant</h2>
      </div>
      <p className="text-muted" style={{ fontSize: 13, margin: "0 0 22px" }}>
        Scoped to one visit, or across the whole report archive.
      </p>

      {/* Context + prompt — prototype lines 1442..1454. */}
      <Blueprint
        as="form"
        onSubmit={handleAsk}
        style={{ padding: 14, marginBottom: 22 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            marginBottom: 11,
          }}
        >
          <label className="kicker-muted" htmlFor={contextId}>
            Context
          </label>
          <Select
            id={contextId}
            value={context}
            onChange={(event) => setContext(event.target.value)}
            style={{ width: "auto", fontSize: 12.5, minHeight: 30 }}
          >
            {REPORTS.map((report) => (
              <option key={report.id} value={report.documentNumber}>
                {report.documentNumber} · {report.supplierShortName}
              </option>
            ))}
            <option value={ARCHIVE_CONTEXT_ID}>{ARCHIVE_CONTEXT_LABEL}</option>
          </Select>
        </div>

        <div style={{ position: "relative" }}>
          {/* The approved layout carries no visible label here; README §24
              still requires a real one, so it is present but visually hidden. */}
          <label className="sr-only" htmlFor={promptId}>
            Your question
          </label>
          <Textarea
            id={promptId}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            minHeight={74}
            placeholder="Ask about this visit — or about every supplier you have ever visited…"
            style={{
              fontSize: 13.5,
              padding: "11px 12px",
              paddingRight: 120,
              background: "var(--color-neutral-100)",
            }}
          />
          <Button
            type="submit"
            variant="primary"
            trailingIcon="right"
            style={{
              position: "absolute",
              right: 7,
              bottom: 9,
              fontSize: 12.5,
            }}
          >
            Ask
          </Button>
        </div>
      </Blueprint>

      {/* Answer area. The prototype never renders a fabricated answer and
          neither does this — it states what will land here (README §11). */}
      <EmptyState
        className="anim-rise"
        message="No answer yet — ask a question above. Answers cite the report, section and transcript timestamp they came from."
      />

      <h6 style={{ margin: "22px 0 9px" }}>Report actions · {scopeLabel}</h6>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 7,
          marginBottom: 24,
        }}
      >
        {SCOPED_ACTIONS.map((action) => (
          <Button
            key={action}
            variant="secondary"
            onClick={() =>
              toast(`${action} runs in Phase 4 — AI generation is not wired yet.`)
            }
            style={{
              fontSize: 12.5,
              borderColor: "var(--color-accent-300)",
              color: "var(--color-accent-800)",
            }}
          >
            <Icon name="spark" size={13} />
            {action}
          </Button>
        ))}
      </div>

      <div
        style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}
      >
        <h6 style={{ margin: 0 }}>Across all reports</h6>
        <Tag tone="warning">Preview — knowledge base indexing 16 / 18</Tag>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginBottom: 22,
        }}
      >
        {SUGGESTED_PROMPTS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="border border-divider bg-transparent hover:border-accent-300 hover:bg-accent-100"
            onClick={() => {
              setPrompt(suggestion);
              toast(CROSS_REPORT_NOTE);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "9px 11px",
              cursor: "pointer",
              textAlign: "left",
              font: "13px var(--font-body)",
            }}
          >
            <Icon
              name="search"
              size={13}
              style={{ color: "var(--color-accent-700)", flex: "none" }}
            />
            <span style={{ flex: 1 }}>{suggestion}</span>
            <Icon name="right" size={12} style={{ opacity: 0.4 }} />
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 9,
          padding: "11px 13px",
          border: "1px solid var(--color-divider)",
          fontSize: 12.5,
          color: "var(--color-neutral-700)",
          lineHeight: 1.6,
        }}
      >
        <Icon name="alert" size={14} style={{ marginTop: 2, flex: "none" }} />
        <span>
          Answers cite the report, section and transcript timestamp they came
          from. Nothing the assistant produces enters a report until you accept
          it.
        </span>
      </div>
    </div>
  );
}
