"use client";

import {
  createContext,
  useContext,
  useId,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils/cn";

/* ═══════════════════════════════════════════════════════════════════════════
   Field wiring

   `<Field>` publishes the generated control id, the `aria-describedby` list
   and the invalid flag on a context so the control inside it needs no props:

     <Field label="Company Name" required error={errors.name}>
       <Input value={name} onChange={…} />
     </Field>

   README §24 — "every field has a visible <label>; placeholders are never the
   only label" and "invalid fields carry aria-invalid and aria-describedby
   pointing at the message".
   ═══════════════════════════════════════════════════════════════════════════ */

interface FieldContextValue {
  controlId: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

interface ControlAria {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
}

/**
 * Resolves a control's identity and ARIA state against its surrounding
 * `<Field>`. Explicit props always win over the inherited values.
 *
 * Shared by `Input` / `Textarea` / `Select` here and by `SearchField`.
 */
export function useFieldControl(
  id: string | undefined,
  describedBy: string | undefined,
  error: boolean | undefined,
): { invalid: boolean; inField: boolean; aria: ControlAria } {
  const field = useContext(FieldContext);
  const invalid = error ?? field?.invalid ?? false;

  return {
    invalid,
    inField: field !== null,
    aria: {
      id: id ?? field?.controlId,
      "aria-describedby": describedBy ?? field?.describedBy,
      "aria-invalid": invalid || undefined,
      "aria-required": field?.required || undefined,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Field
   ═══════════════════════════════════════════════════════════════════════════ */

interface FieldOwnProps {
  /** Visible label text. The required marker is appended by `required`. */
  label: ReactNode;
  /** Id of the control. Omit it and the field generates one. */
  htmlFor?: string;
  /** Appends " *" to the label and sets `aria-required` on the control. */
  required?: boolean;
  /** 11.5px muted help text, announced through `aria-describedby`. */
  hint?: ReactNode;
  /** Validation message — renders `.field-error` and flags the control. */
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

export type FieldProps = FieldOwnProps &
  Omit<ComponentPropsWithoutRef<"div">, keyof FieldOwnProps>;

export function Field({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  className,
  children,
  ...rest
}: FieldProps) {
  const uid = useId();
  const controlId = htmlFor ?? `${uid}control`;
  const hintId = `${uid}hint`;
  const errorId = `${uid}error`;

  const described: string[] = [];
  if (hint) described.push(hintId);
  if (error) described.push(errorId);
  const describedBy = described.length > 0 ? described.join(" ") : undefined;

  return (
    <FieldContext.Provider
      value={{ controlId, describedBy, invalid: Boolean(error), required }}
    >
      <div className={cn("field", className)} {...rest}>
        <label htmlFor={controlId}>
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </label>
        {children}
        {hint ? (
          <p id={hintId} className="mt-[4px] text-[11.5px] text-neutral-600">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="field-error">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Controls

   `.input`, `.input-error` and `.input-ai-pending` are unlayered rules in
   globals.css, so they beat Tailwind's `@layer utilities`. Variant geometry is
   therefore written as inline style — the same way the approved prototype
   measures these controls.
   ═══════════════════════════════════════════════════════════════════════════ */

/** README §4 — compact input: 11.5–12px, 4–5px 6–8px padding. */
const COMPACT_CONTROL: CSSProperties = {
  minHeight: 30,
  padding: "5px 8px",
  fontSize: 12,
};

/** README §4 — compact select keeps the 6px right gutter for the chevron. */
const COMPACT_SELECT: CSSProperties = {
  minHeight: 30,
  padding: "5px 6px 5px 8px",
  fontSize: 12,
};

/** Prototype line 372 — the filter-bar select. */
const FILTER_SELECT: CSSProperties = {
  width: "auto",
  minWidth: 124,
  fontSize: 12.5,
  paddingRight: 6,
};

/** README §4 — prose textarea (editor body). Prototype lines 881, 931, 949. */
const PROSE_TEXTAREA: CSSProperties = {
  minHeight: 120,
  background: "var(--color-neutral-100)",
  fontSize: 13.5,
  lineHeight: 1.7,
  padding: 14,
};

/** README §4 — compact textarea (photo captions, observation bullets). */
const COMPACT_TEXTAREA: CSSProperties = {
  minHeight: 44,
  padding: "6px 8px",
  fontSize: 12,
  lineHeight: 1.45,
};

interface ControlOwnProps {
  /** Forces the error border; inherited from `<Field error>` otherwise. */
  error?: boolean;
  /** Dense variant used inside cards, toolbars and table rows. */
  compact?: boolean;
}

export type InputProps = ControlOwnProps & {
  /** README §5 — AI-filled but unconfirmed (certificate OCR fields). */
  aiPending?: boolean;
} & Omit<ComponentPropsWithoutRef<"input">, keyof ControlOwnProps | "aiPending">;

export function Input({
  error,
  compact = false,
  aiPending = false,
  className,
  style,
  id,
  "aria-describedby": describedBy,
  type = "text",
  ...rest
}: InputProps) {
  const { invalid, aria } = useFieldControl(id, describedBy, error);

  return (
    <input
      type={type}
      className={cn(
        "input",
        invalid && "input-error",
        aiPending && "input-ai-pending",
        className,
      )}
      style={compact ? { ...COMPACT_CONTROL, ...style } : style}
      {...aria}
      {...rest}
    />
  );
}

interface TextareaOwnProps extends ControlOwnProps {
  /** Editor body style — neutral-100 ground, 13.5px / 1.7, 14px padding. */
  prose?: boolean;
  /** Overrides the variant's min-height (px number or any CSS length). */
  minHeight?: number | string;
}

export type TextareaProps = TextareaOwnProps &
  Omit<ComponentPropsWithoutRef<"textarea">, keyof TextareaOwnProps>;

export function Textarea({
  error,
  compact = false,
  prose = false,
  minHeight,
  className,
  style,
  id,
  rows,
  "aria-describedby": describedBy,
  ...rest
}: TextareaProps) {
  const { invalid, aria } = useFieldControl(id, describedBy, error);
  const variant = prose
    ? PROSE_TEXTAREA
    : compact
      ? COMPACT_TEXTAREA
      : undefined;

  // An explicit min-height wins; `rows` alone releases the 90px floor set by
  // `textarea.input` so the row count actually governs the height.
  const resolvedMinHeight =
    minHeight ?? (rows !== undefined ? 0 : variant?.minHeight);

  return (
    <textarea
      rows={rows}
      className={cn("input", invalid && "input-error", className)}
      style={{ ...variant, minHeight: resolvedMinHeight, ...style }}
      {...aria}
      {...rest}
    />
  );
}

interface SelectOwnProps extends ControlOwnProps {
  /** Filter-bar variant: `width:auto; min-width:124px; 12.5px`. */
  filter?: boolean;
}

export type SelectProps = SelectOwnProps &
  Omit<ComponentPropsWithoutRef<"select">, keyof SelectOwnProps>;

export function Select({
  error,
  compact = false,
  filter = false,
  className,
  style,
  id,
  "aria-describedby": describedBy,
  children,
  ...rest
}: SelectProps) {
  const { invalid, aria } = useFieldControl(id, describedBy, error);
  const variant = filter ? FILTER_SELECT : compact ? COMPACT_SELECT : undefined;

  return (
    <select
      className={cn("input", invalid && "input-error", className)}
      style={variant ? { ...variant, ...style } : style}
      {...aria}
      {...rest}
    >
      {children}
    </select>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FieldGrid — the repeating N-column form grid.
   Supplier form: 3 columns / 12px. New Report modal: 2 columns / 12px.
   Cells that span use `style={{ gridColumn: "span 2" }}` on the `<Field>`.
   ═══════════════════════════════════════════════════════════════════════════ */

interface FieldGridOwnProps {
  columns?: number;
  /** Gap in px. */
  gap?: number;
  className?: string;
  children: ReactNode;
}

export type FieldGridProps = FieldGridOwnProps &
  Omit<ComponentPropsWithoutRef<"div">, keyof FieldGridOwnProps>;

export function FieldGrid({
  columns = 2,
  gap = 12,
  className,
  style,
  children,
  ...rest
}: FieldGridProps) {
  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
