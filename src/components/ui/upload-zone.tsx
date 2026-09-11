"use client";

import { useId, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "./icon";

/**
 * Upload zone — README §4.
 *
 * Dashed 1px `--color-accent-400` on `--color-accent-100`; `inline` is the
 * 13–15px two-line row used by the supplier Excel import and the certificate
 * drop zone (prototype lines 658..667), `large` is the centred 26px form with a
 * 22px icon. Drag-over switches the border to `--color-accent` and the fill to
 * `--color-accent-200`.
 *
 * It is a real `<input type="file">` behind a `<label>`, so it is keyboard
 * reachable and announced; the drop handlers are an addition, not the only way
 * in.
 */

export type UploadZoneVariant = "inline" | "large";

export interface UploadZoneProps {
  variant?: UploadZoneVariant;
  /** First line — what to drop. */
  title: string;
  /** Second line — accepted formats and limits. */
  description: string;
  /** Right-hand status tag (inline) or trailing control (large). */
  status?: ReactNode;
  /** 17px inline, 22px large. */
  icon?: IconName;
  accept?: string;
  multiple?: boolean;
  /** Receives everything the user chose or dropped; the caller validates. */
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
}

function isFocusVisible(element: HTMLElement): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

export function UploadZone({
  variant = "inline",
  title,
  description,
  status,
  icon = "upload",
  accept,
  multiple = false,
  onFiles,
  disabled = false,
  className,
}: UploadZoneProps) {
  const inputId = useId();
  const descriptionId = `${inputId}-description`;
  const dragDepth = useRef(0);
  const [dragOver, setDragOver] = useState(false);
  const [focused, setFocused] = useState(false);

  const large = variant === "large";

  function emit(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    onFiles(multiple ? files : files.slice(0, 1));
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    emit(event.target.files);
    // Allow the same file to be chosen twice in a row.
    event.target.value = "";
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    if (disabled) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (disabled) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (disabled) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (disabled) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    emit(event.dataTransfer.files);
  }

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: `1px dashed ${
          dragOver ? "var(--color-accent)" : "var(--color-accent-400)"
        }`,
        background: dragOver
          ? "var(--color-accent-200)"
          : "var(--color-accent-100)",
        padding: large ? 26 : "13px 14px",
        display: large ? "block" : "flex",
        alignItems: large ? undefined : "center",
        gap: large ? undefined : 12,
        textAlign: large ? "center" : undefined,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : undefined,
        outline: focused ? "2px solid var(--color-accent)" : undefined,
        outlineOffset: focused ? 2 : undefined,
      }}
    >
      <input
        id={inputId}
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-describedby={descriptionId}
        onChange={handleChange}
        onFocus={(event) => setFocused(isFocusVisible(event.currentTarget))}
        onBlur={() => setFocused(false)}
      />

      <label
        htmlFor={inputId}
        className={cn(!large && "flex items-center")}
        style={{
          flex: large ? undefined : 1,
          gap: large ? undefined : 12,
          minWidth: 0,
          cursor: disabled ? "not-allowed" : "pointer",
          display: large ? "block" : undefined,
        }}
      >
        <Icon
          name={icon}
          size={large ? 22 : 17}
          style={{
            color: "var(--color-accent-700)",
            flex: "none",
            display: large ? "block" : undefined,
            margin: large ? "0 auto 8px" : undefined,
          }}
        />
        <span style={{ flex: large ? undefined : 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 13,
              color: "var(--color-accent-900)",
            }}
          >
            {title}
          </span>
          <span
            id={descriptionId}
            style={{
              display: "block",
              fontSize: 11.5,
              color: "var(--color-neutral-600)",
              marginTop: large ? 3 : 2,
            }}
          >
            {description}
          </span>
        </span>
      </label>

      {status ? (
        <div
          className="flex items-center"
          style={{
            flex: "none",
            gap: 8,
            marginTop: large ? 10 : undefined,
            justifyContent: large ? "center" : undefined,
          }}
        >
          {status}
        </div>
      ) : null}
    </div>
  );
}
