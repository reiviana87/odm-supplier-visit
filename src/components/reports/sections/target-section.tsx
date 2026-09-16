"use client";

import { useCallback, useId, useRef, useState, useTransition } from "react";

import { useSectionDraft } from "@/components/reports/section-draft";
import { Blueprint } from "@/components/ui/blueprint";
import { Button, IconButton } from "@/components/ui/button";
import { Field, FieldGrid, Input, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { saveTargetProducts } from "@/lib/data/report-actions";
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
 * The cards are the list as the author now wants it, and that is how they are
 * stored: `saveTargetProducts` replaces the set, numbering the rows by the
 * order they are on screen. It is called when a card is finished with — on
 * blur, on delete — rather than on every keystroke, because the whole list
 * travels each time. The General Notes box is the section body and rides the
 * editor's own autosave.
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

/**
 * A card the author opened and never typed into is not a target product — the
 * rule `saveTargetProducts` applies before it writes anything, restated here so
 * the screen can tell which of its cards the database is answering about.
 */
function isBlank(product: TargetProduct): boolean {
  return (
    [
      product.name,
      product.model,
      product.application,
      product.expectedMarket,
      product.technicalRequirements,
      product.comments,
    ].every((field) => field.trim() === "") && product.photoId === null
  );
}

/**
 * The stored rows, back under the cards they belong to.
 *
 * The write drops the blank cards, so the answer is shorter than the list on
 * screen; the rows that did travel come back in the same order they went, which
 * is what lines them up again. An empty card the author is still looking at is
 * theirs and stays exactly where it is — only the saved ones take on what the
 * database gave them, above all their id.
 */
function adoptStored(
  local: readonly TargetProduct[],
  stored: readonly TargetProduct[],
): TargetProduct[] {
  let next = 0;
  return local.map((product) =>
    isBlank(product) ? product : (stored[next++] ?? product),
  );
}

function TargetCard({
  product,
  index,
  onChange,
  onCommit,
  onDelete,
  onUnavailable,
}: {
  product: TargetProduct;
  index: number;
  onChange: (patch: Partial<TargetFields>) => void;
  onCommit: () => void;
  onDelete: () => void;
  onUnavailable: (message: string) => void;
}) {
  const [caption, setCaption] = useState("");

  const src = product.photoId ? photoSrc(product.photoId) : null;

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
          onClick={() =>
            onUnavailable(
              "Dragging to reorder is not built — the cards are numbered in the order they were added.",
            )
          }
        />
        <IconButton
          label={`Delete target product ${index + 1}`}
          name="trash"
          size={24}
          className="text-neutral-500"
          onClick={onDelete}
        />
      </div>

      <div className="flex items-start" style={{ gap: 14 }}>
        <FieldGrid columns={2} gap={11} style={{ flex: 1, minWidth: 0 }}>
          <Field label="Target Product">
            <Input
              value={product.name}
              onChange={(event) => onChange({ name: event.target.value })}
              onBlur={onCommit}
            />
          </Field>
          <Field label="Model / Product Family">
            <Input
              value={product.model}
              onChange={(event) => onChange({ model: event.target.value })}
              onBlur={onCommit}
            />
          </Field>
          <Field label="Application">
            <Input
              value={product.application}
              onChange={(event) => onChange({ application: event.target.value })}
              onBlur={onCommit}
            />
          </Field>
          <Field label="Expected Market">
            <Input
              value={product.expectedMarket}
              onChange={(event) =>
                onChange({ expectedMarket: event.target.value })
              }
              onBlur={onCommit}
            />
          </Field>
          <Field label="Technical Requirements" style={{ gridColumn: "span 2" }}>
            <Input
              value={product.technicalRequirements}
              onChange={(event) =>
                onChange({ technicalRequirements: event.target.value })
              }
              onBlur={onCommit}
            />
          </Field>
          <Field label="Comments" style={{ gridColumn: "span 2" }}>
            <Textarea
              value={product.comments}
              onChange={(event) => onChange({ comments: event.target.value })}
              onBlur={onCommit}
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

  // The General Notes box is the `target` section body (README §6.2), so it is
  // held and autosaved by the editor shell like every other prose field.
  const { draft, setBody } = useSectionDraft("target");

  const [products, setProducts] = useState<readonly TargetProduct[]>(
    () => report.sections.targetProducts,
  );
  const [, startSave] = useTransition();

  /**
   * Bumped by every edit, read by the save that follows it. The stored rows are
   * only taken back in when nothing has been typed since the request left —
   * otherwise the answer would describe a list the author has already moved on
   * from, and adopting it would undo the keystrokes in between.
   */
  const revision = useRef(0);
  /** Ids for cards that exist only on screen; the database assigns the real ones. */
  const drafted = useRef(0);

  const edit = useCallback((next: readonly TargetProduct[]) => {
    revision.current += 1;
    setProducts(next);
  }, []);

  const persist = useCallback(
    (next: readonly TargetProduct[]) => {
      const at = revision.current;
      const rows = next.map((product, index) => ({ ...product, sortOrder: index }));

      startSave(async () => {
        const result = await saveTargetProducts(report.id, rows);
        if (!result.ok) {
          toast(result.error.message, "error");
          return;
        }
        if (revision.current === at) {
          setProducts((current) => adoptStored(current, result.data));
        }
      });
    },
    [report.id, toast],
  );

  const patchProduct = useCallback(
    (id: string, patch: Partial<TargetFields>) => {
      edit(
        products.map((product) =>
          product.id === id ? { ...product, ...patch } : product,
        ),
      );
    },
    [edit, products],
  );

  const deleteProduct = useCallback(
    (id: string) => {
      const next = products.filter((product) => product.id !== id);
      edit(next);
      persist(next);
    },
    [edit, persist, products],
  );

  /**
   * A new card is added to the screen and nowhere else: the write drops a card
   * with nothing on it, so persisting here would be a request that changes
   * nothing and an answer that does not mention the card the author is looking
   * at. It is stored the moment something is typed into it.
   */
  const addProduct = useCallback(() => {
    drafted.current += 1;
    edit([
      ...products,
      {
        id: `draft-${drafted.current}`,
        name: "",
        model: "",
        application: "",
        expectedMarket: "",
        technicalRequirements: "",
        comments: "",
        photoId: null,
        sortOrder: products.length,
      },
    ]);
  }, [edit, products]);

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
              onChange={(patch) => patchProduct(product.id, patch)}
              onCommit={() => persist(products)}
              onDelete={() => deleteProduct(product.id)}
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
        value={draft.body}
        onChange={(event) => setBody(event.target.value)}
        minHeight={120}
        placeholder="Datasheets shared, deviations to confirm, sample plan…"
      />
    </div>
  );
}
