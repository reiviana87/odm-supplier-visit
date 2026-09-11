"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils/cn";
import { Icon } from "./icon";

/**
 * Chip input (multi select) — README §4 marks this **[INFERRED]**: "not in the
 * approved design. Use a chip list inside an input-shaped box; chips are a tag
 * with a 12px × dismiss".
 *
 * The chip itself IS approved — the New Report modal members row, prototype
 * lines 1775..1783: `border:1px solid var(--color-divider); padding:3px 8px;
 * font-size:12.5px; gap:6px` with an 11px × at `opacity:.5`. That is copied
 * verbatim. The surrounding `.input`-shaped box is the inferred part.
 *
 * Enter or comma commits the draft, Backspace on an empty draft removes the
 * last chip, and every chip carries a labelled dismiss button.
 */
export interface ChipInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** Visible field label — README §24: placeholders are never the only label. */
  label?: string;
  className?: string;
}

export function ChipInput({
  values,
  onChange,
  placeholder,
  label,
  className,
}: ChipInputProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const next = raw.trim();
    setDraft("");
    if (!next || values.includes(next)) return;
    onChange([...values, next]);
  }

  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === "Backspace" && draft === "" && values.length > 0) {
      event.preventDefault();
      removeAt(values.length - 1);
    }
  }

  const box = (
    <div
      className="input focus-within:outline-2 focus-within:outline-[color:var(--color-accent)]"
      onClick={() => inputRef.current?.focus()}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "6px",
        padding: "5px 6px",
        cursor: "text",
      }}
    >
      {values.map((value, index) => (
        <span
          key={`${index}-${value}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            border: "1px solid var(--color-divider)",
            padding: "3px 8px",
            fontSize: "12.5px",
            lineHeight: 1.4,
          }}
        >
          {value}
          <button
            type="button"
            aria-label={`Remove ${value}`}
            title={`Remove ${value}`}
            onClick={(event) => {
              event.stopPropagation();
              removeAt(index);
            }}
            style={{
              display: "flex",
              background: "transparent",
              border: 0,
              padding: 0,
              cursor: "pointer",
              color: "inherit",
            }}
          >
            <Icon name="x" size={11} style={{ opacity: 0.5 }} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        className="placeholder:text-[color:var(--color-neutral-500)]"
        style={{
          flex: "1 1 120px",
          minWidth: "120px",
          minHeight: "22px",
          border: 0,
          background: "transparent",
          padding: 0,
          fontSize: "12.5px",
          color: "inherit",
          outline: "none",
        }}
      />
    </div>
  );

  if (!label) {
    return <div className={cn(className)}>{box}</div>;
  }

  return (
    <div className={cn("field", className)}>
      <label htmlFor={inputId}>{label}</label>
      {box}
    </div>
  );
}
