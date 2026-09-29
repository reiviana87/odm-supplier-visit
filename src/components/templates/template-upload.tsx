"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldGrid, Input, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Modal, ModalActions } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { UploadZone } from "@/components/ui/upload-zone";
import { uploadTemplate } from "@/lib/data/template-actions";
import { MAX_TEMPLATE_BYTES, TEMPLATE_MIME } from "@/lib/data/template-limits";

/**
 * Upload a new version of the corporate Word template — README §16.
 *
 * Built on `new-report-modal.tsx`: the same dialog anatomy (title + subline,
 * `FieldGrid`, `ModalActions`), the same re-arm-on-open state pattern, the same
 * "field errors in place, everything else out loud" rule. There is no second
 * modal language on this screen.
 *
 * The file itself is handed to the server action as a `File`, the way
 * `photo-upload.tsx` hands over a photograph: the object path, the bucket and
 * the row are all decided on the server, so nothing here can write outside
 * where the template belongs.
 */

/** The picker offers the extension as well, for a folder mounted over SMB. */
const ACCEPT = `.docx,${TEMPLATE_MIME}`;

/** "1.6 MB", "842 KB" — the size the user recognises from Explorer. */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

/**
 * Why the picked file cannot be the template, or `null` when it can be.
 *
 * Refused here rather than after the upload: the older `.doc` and the `.dotx`
 * template format are both ordinary things to pick out of a corporate folder,
 * and neither can be read as an Open XML package. The sentence names the fix
 * instead of the rule.
 */
function refusalFor(file: File): string | null {
  if (!/\.docx$/i.test(file.name)) {
    return `“${file.name}” is not a .docx. Word's older .doc and its .dotx template format cannot be read — open the file in Word and use Save As › Word Document (.docx).`;
  }
  if (file.size === 0) {
    return `“${file.name}” arrived empty (0 bytes). Check that it is not still open or syncing, then choose it again.`;
  }
  if (file.size > MAX_TEMPLATE_BYTES) {
    return `“${file.name}” is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_TEMPLATE_BYTES)} — a template this large is usually carrying photographs that belong in a report instead.`;
  }
  return null;
}

/** A trailing `_v1.5`, `-v2`, ` v1.5.1` — how the corporate files are named. */
const VERSION_SUFFIX = /[ _-]v(\d+(?:[._]\d+)*)$/i;

/**
 * Name and version suggested from the file name, so the user is not retyping
 * what they just picked. Both stay editable and neither is invented: an
 * unversioned file name leaves the version box empty rather than guessing "v1".
 */
function suggestFrom(fileName: string): { name: string; version: string } {
  const base = fileName.replace(/\.docx$/i, "");
  const match = VERSION_SUFFIX.exec(base);
  const version = match ? `v${match[1].replace(/_/g, ".")}` : "";
  const withoutVersion = match ? base.slice(0, match.index) : base;
  const name = withoutVersion.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return { name, version };
}

interface Draft {
  file: File | null;
  name: string;
  /** Stops a second file pick from overwriting a name that was typed. */
  nameEdited: boolean;
  version: string;
  versionEdited: boolean;
  changeNote: string;
}

const EMPTY_DRAFT: Draft = {
  file: null,
  name: "",
  nameEdited: false,
  version: "",
  versionEdited: false,
  changeNote: "",
};

interface Errors {
  file?: string;
  name?: string;
  version?: string;
}

/** The fields `uploadTemplate` keys a validation failure against. */
const FIELD_KEYS = ["name", "version"] as const;

function toErrors(fieldErrors: Record<string, string> | undefined): Errors {
  const errors: Errors = {};
  if (!fieldErrors) return errors;
  for (const key of FIELD_KEYS) {
    const message = fieldErrors[key];
    if (message !== undefined) errors[key] = message;
  }
  return errors;
}

function hasAny(errors: Errors): boolean {
  return FIELD_KEYS.some((key) => errors[key] !== undefined);
}

export interface TemplateUploadProps {
  open: boolean;
  onClose: () => void;
  /** Called once the row exists, so the caller can close and refresh. */
  onUploaded: () => void;
}

export function TemplateUpload({
  open,
  onClose,
  onUploaded,
}: TemplateUploadProps): React.JSX.Element {
  const { toast } = useToast();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Errors>({});
  const [uploading, startUpload] = useTransition();

  // The dialog stays mounted between visits, so it is re-armed every time it
  // opens — otherwise a second upload would start from the first one's answers.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(EMPTY_DRAFT);
      setErrors({});
    }
  }

  function pick(files: File[]) {
    const file = files[0];
    if (!file) return;

    const refusal = refusalFor(file);
    if (refusal) {
      setErrors({ file: refusal });
      return;
    }

    const suggestion = suggestFrom(file.name);
    setDraft((current) => ({
      ...current,
      file,
      name: current.nameEdited ? current.name : suggestion.name,
      version: current.versionEdited ? current.version : suggestion.version,
    }));
    setErrors({});
  }

  function handleUpload() {
    const file = draft.file;
    const name = draft.name.trim();

    if (!file || !name) {
      setErrors({
        file: file ? undefined : "Choose the corporate .docx to upload.",
        name: name ? undefined : "Name this version so the history reads clearly.",
      });
      return;
    }

    startUpload(async () => {
      const result = await uploadTemplate({
        name,
        // Empty means "not given": the version and the note are optional, and
        // the server decides what an unversioned upload is called.
        version: draft.version.trim(),
        changeNote: draft.changeNote.trim(),
        file,
      });

      if (!result.ok) {
        const fieldErrors = toErrors(result.error.fieldErrors);
        if (hasAny(fieldErrors)) {
          setErrors(fieldErrors);
          return;
        }
        // Everything the server refuses about the file itself — a renamed .doc,
        // a corrupt package, a zip with no word/document.xml — comes back as
        // `invalid` with no field named, and it is about the file sitting in the
        // picker. Shown there it stays next to what it describes, instead of
        // vanishing with a toast while the file still looks accepted.
        if (result.error.code === "invalid") {
          setErrors({ file: result.error.message });
          return;
        }
        toast(result.error.message, "error");
        return;
      }

      // `uploadTemplate` never activates what it stores, so the toast says so
      // and names the version the row was given — which the user did not
      // necessarily type, since an empty version box means "the next one".
      toast(`“${file.name}” uploaded as ${result.data.version} — not active yet.`);
      onUploaded();
    });
  }

  function requestClose() {
    // An upload in flight is already writing to storage; closing the dialog
    // would leave the user with no idea whether it finished.
    if (uploading) return;
    onClose();
  }

  const file = draft.file;

  return (
    <Modal
      open={open}
      onClose={requestClose}
      size="md"
      title="Upload New Template Version"
      subtitle="The active template controls the output of every future export."
    >
      <div style={{ margin: "16px 0 14px" }}>
        <UploadZone
          variant="large"
          icon="file"
          title="Drop the Word template here"
          description="Single .docx file — the corporate report with its header, footer and styles"
          accept={ACCEPT}
          disabled={uploading}
          onFiles={pick}
        />
        {errors.file ? (
          <p className="field-error" style={{ marginTop: 6 }}>
            {errors.file}
          </p>
        ) : null}

        {file ? (
          <div
            className="flex items-center"
            style={{
              gap: 9,
              marginTop: 9,
              padding: "8px 10px",
              border: "1px solid var(--color-divider)",
              fontSize: 12.5,
            }}
          >
            <Icon
              name="file"
              size={14}
              style={{ flex: "none", color: "var(--color-accent-700)" }}
            />
            <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
              {file.name}
            </span>
            <span style={{ flex: "none", color: "var(--color-neutral-600)" }}>
              {formatBytes(file.size)}
            </span>
            <Button
              size="compact"
              disabled={uploading}
              onClick={() => setDraft((current) => ({ ...current, file: null }))}
            >
              Remove
            </Button>
          </div>
        ) : null}
      </div>

      <FieldGrid style={{ marginBottom: 14 }}>
        <Field label="Template name" required error={errors.name}>
          <Input
            value={draft.name}
            disabled={uploading}
            placeholder="EBARA ODM Visit Report"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                name: event.target.value,
                nameEdited: true,
              }))
            }
          />
        </Field>

        <Field
          label="Version"
          hint="Optional — read from the file name when it carries one."
          error={errors.version}
        >
          <Input
            value={draft.version}
            disabled={uploading}
            placeholder="v1.5"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                version: event.target.value,
                versionEdited: true,
              }))
            }
          />
        </Field>

        <Field
          label="What changed"
          hint="Optional — this is the “Change” column in the version history."
          style={{ gridColumn: "span 2" }}
        >
          <Textarea
            rows={3}
            value={draft.changeNote}
            disabled={uploading}
            placeholder="Appendix photographs fitted inside a 7 cm box; footer table updated"
            onChange={(event) =>
              setDraft((current) => ({ ...current, changeNote: event.target.value }))
            }
          />
        </Field>
      </FieldGrid>

      {uploading && file ? (
        <div style={{ marginBottom: 14 }}>
          {/* Indeterminate on purpose: the browser hands the whole file to the
              server action in one call, so there is no byte count to report.
              A bar that filled itself on a timer would be a guess. */}
          <ProgressBar indeterminate label={`Uploading ${file.name}`} />
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 11.5,
              color: "var(--color-neutral-600)",
            }}
          >
            Uploading {file.name} · {formatBytes(file.size)} — a corporate
            template is megabytes, so this can take a moment. Keep this dialog
            open.
          </p>
        </div>
      ) : null}

      <ModalActions>
        <Button variant="secondary" disabled={uploading} onClick={requestClose}>
          Cancel
        </Button>
        <Button variant="primary" loading={uploading} onClick={handleUpload}>
          Upload Version
        </Button>
      </ModalActions>
    </Modal>
  );
}
