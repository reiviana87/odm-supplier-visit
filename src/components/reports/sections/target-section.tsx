"use client";

import { useId, useState } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Button, IconButton } from "@/components/ui/button";
import { Field, FieldGrid, Input, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { photoSrc } from "@/lib/mock-data";
import { SECTION_PREDICATE_DESCRIPTION } from "@/lib/reports/completion";
import type { Report, TargetProduct } from "@/types/domain";

import { AiActionsRow, aiActionMessage } from "./prose-section";

/**
 * §5 Target Products — prototype lines 1020..1069.
 *
 * One card per target product: the six labelled fields on the left, the 196px
 * image slot on the right, then the shared General Notes box.
 *
 * `TargetProduct` carries each of those six values as its own field, so the card
 * binds to them directly. Edits stay in component state — §5 persistence is the
 * report data layer's job, not this file's.
 */

const TARGET_AI_ACTIONS = [
  "Extract Target Products from Transcript",
  "Improve Technical Description",
] as const;

const KICKER = {
  font: "10px var(--font-body)",
  letterSpacing: ".12em",
  textTransform: "uppercase",
} as const;

/** The six labelled values of the approved card, in card order. */
type TargetFields = Pick<
  TargetProduct,
  | "name"
  | "model"
  | "application"
  | "expectedMarket"
  | "technicalRequirements"
  | "comments"
>;

function readFields(product: TargetProduct): TargetFields {
  return {
    name: product.name,
    model: product.model,
    application: product.application,
    expectedMarket: product.expectedMarket,
    technicalRequirements: product.technicalRequirements,
    comments: product.comments,
  };
}

function TargetCard({
  product,
  index,
  onUnavailable,
}: {
  product: TargetProduct;
  index: number;
  onUnavailable: (message: string) => void;
}) {
  const [fields, setFields] = useState<TargetFields>(() => readFields(product));
  const [caption, setCaption] = useState("");

  const src = product.photoId ? photoSrc(product.photoId) : null;
  const patch = (key: keyof TargetFields, next: string) =>
    setFields((current) => ({ ...current, [key]: next }));

  return (
    <Blueprint style={{ padding: 13 }}>
      <div className="flex items-center" style={{ gap: 8, marginBottom: 11 }}>
        <span style={{ ...KICKER, color: "var(--color-accent-700)" }}>
          Target Product {index + 1}
        </span>
        <div style={{ flex: 1 }} />
        <IconButton
          label={`Reorder target product ${index + 1}`}
          name="grip"
          size={24}
          className="text-neutral-500"
          onClick={() => onUnavailable("Drag to reorder arrives in Phase 2")}
        />
        <IconButton
          label={`Delete target product ${index + 1}`}
          name="trash"
          size={24}
          className="text-neutral-500"
          onClick={() =>
            onUnavailable("Adding and deleting target products arrives in Phase 2")
          }
        />
      </div>

      <div className="flex items-start" style={{ gap: 14 }}>
        <FieldGrid columns={2} gap={11} style={{ flex: 1, minWidth: 0 }}>
          <Field label="Target Product">
            <Input
              value={fields.name}
              onChange={(event) => patch("name", event.target.value)}
            />
          </Field>
          <Field label="Model / Product Family">
            <Input
              value={fields.model}
              onChange={(event) => patch("model", event.target.value)}
            />
          </Field>
          <Field label="Application">
            <Input
              value={fields.application}
              onChange={(event) => patch("application", event.target.value)}
            />
          </Field>
          <Field label="Expected Market">
            <Input
              value={fields.expectedMarket}
              onChange={(event) => patch("expectedMarket", event.target.value)}
            />
          </Field>
          <Field label="Technical Requirements" style={{ gridColumn: "span 2" }}>
            <Input
              value={fields.technicalRequirements}
              onChange={(event) =>
                patch("technicalRequirements", event.target.value)
              }
            />
          </Field>
          <Field label="Comments" style={{ gridColumn: "span 2" }}>
            <Textarea
              value={fields.comments}
              onChange={(event) => patch("comments", event.target.value)}
              minHeight={54}
              style={{ fontSize: 13 }}
            />
          </Field>
        </FieldGrid>

        <div style={{ width: 196, flex: "none" }}>
          <span
            style={{
              display: "block",
              ...KICKER,
              color: "var(--color-neutral-600)",
              marginBottom: 6,
            }}
          >
            Product image
          </span>
          <div
            className="flex flex-col items-center justify-center"
            style={{
              width: "100%",
              height: 142,
              gap: 6,
              border: src
                ? "1px solid var(--color-divider)"
                : "1px dashed var(--color-neutral-400)",
              color: src ? undefined : "var(--color-neutral-500)",
              background: src
                ? `var(--color-neutral-200) url(${src}) center/cover no-repeat`
                : undefined,
            }}
          >
            {src ? null : (
              <>
                <Icon name="image" size={17} />
                <span style={{ fontSize: 10.5, letterSpacing: ".05em" }}>
                  Add image
                </span>
              </>
            )}
          </div>
          <Input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Caption — printed under the image"
            aria-label={`Caption for target product ${index + 1}`}
            style={{ fontSize: 11, padding: "5px 7px", marginTop: 7 }}
          />
          <div className="flex" style={{ gap: 5, marginTop: 6 }}>
            <Button
              size="compact"
              style={{ fontSize: 11, padding: "2px 8px", flex: 1 }}
              onClick={() =>
                onUnavailable("Photo upload and selection arrive in Phase 4")
              }
            >
              {src ? "Replace" : "Upload image"}
            </Button>
            {src ? (
              <IconButton
                label={`Remove the image of target product ${index + 1}`}
                name="trash"
                size={24}
                iconSize={12}
                className="text-neutral-500"
                onClick={() =>
                  onUnavailable("Photo upload and selection arrive in Phase 4")
                }
              />
            ) : null}
          </div>
        </div>
      </div>
    </Blueprint>
  );
}

export function TargetSection({ report }: { report: Report }) {
  const { toast } = useToast();
  const notesId = useId();
  const [notes, setNotes] = useState(report.sections.targetNotes);

  const products = report.sections.targetProducts;
  const addProduct = () =>
    toast("Adding and deleting target products arrives in Phase 2");

  return (
    <div style={{ maxWidth: 900 }}>
      <AiActionsRow
        actions={TARGET_AI_ACTIONS}
        onAction={(action) => toast(aiActionMessage(action))}
      />

      {products.length === 0 ? (
        <EmptyState
          message={SECTION_PREDICATE_DESCRIPTION.target}
          action={
            <Button size="compact" icon="plus" onClick={addProduct}>
              Add Target Product
            </Button>
          }
          className="mb-[12px]"
        />
      ) : (
        <div className="flex flex-col" style={{ gap: 12, marginBottom: 12 }}>
          {products.map((product, index) => (
            <TargetCard
              key={product.id}
              product={product}
              index={index}
              onUnavailable={toast}
            />
          ))}
        </div>
      )}

      <Button
        icon="plus"
        onClick={addProduct}
        style={{ fontSize: 12.5, marginBottom: 22 }}
      >
        Add Target Product
      </Button>

      <h6 style={{ margin: "0 0 8px" }}>General Notes</h6>
      <label className="sr-only" htmlFor={notesId}>
        General notes on the target products
      </label>
      <Textarea
        prose
        id={notesId}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        minHeight={120}
        placeholder="Datasheets shared, deviations to confirm, sample plan…"
      />
    </div>
  );
}
