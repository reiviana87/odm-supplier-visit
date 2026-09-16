"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Tag } from "@/components/ui/badge";
import { Blueprint } from "@/components/ui/blueprint";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Field, FieldGrid, Input } from "@/components/ui/field";
import { ConfirmModal, Modal, ModalActions } from "@/components/ui/modal";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  createContact,
  deleteContact,
  updateContact,
} from "@/lib/data/supplier-actions";
import { EMPTY_CONTACT, type SupplierContactValues } from "@/lib/suppliers/supplier-schema";
import type { Supplier, SupplierContact } from "@/types/domain";

/**
 * Supplier Contacts tab — README §1.7, prototype lines 525..548.
 *
 * One card per registered contact; the card flagged `isPrimary` carries the
 * "Main contact" tag, which is how the data sheet is structured (the sales
 * contact is field "Person in charge (Sales)", everyone else was added
 * afterwards).
 *
 * The three actions write through `supplier-actions`, which mirrors the primary
 * card back onto `suppliers.contact_*` and promotes the next card when the
 * primary one is removed (§6). Nothing is mutated here: a successful write
 * refreshes the route and the server sends the new cards down.
 */

const EM_DASH = "—";

/** Which dialog the tab has open, and on which card. */
type Dialog =
  | { kind: "closed" }
  | { kind: "edit"; contact: SupplierContact | null }
  | { kind: "remove"; contact: SupplierContact };

function toValues(contact: SupplierContact): SupplierContactValues {
  return {
    name: contact.name,
    role: contact.role,
    email: contact.email,
    phone: contact.phone,
    wechat: contact.wechat,
  };
}

function ContactCard({
  contact,
  primary,
  onEdit,
  onRemove,
}: {
  contact: SupplierContact;
  primary: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <Blueprint className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="card-title">{contact.name}</div>
        {primary ? <Tag tone="accent">Main contact</Tag> : null}
        <div style={{ flex: 1 }} />
        <IconButton
          label={`Edit ${contact.name}`}
          name="pencil"
          size={23}
          onClick={onEdit}
        />
        <IconButton
          label={`Remove ${contact.name}`}
          name="trash"
          size={23}
          onClick={onRemove}
        />
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--color-neutral-700)",
          marginTop: -4,
        }}
      >
        {contact.role || EM_DASH}
      </div>
      <div style={{ fontSize: "12.5px", marginTop: 6, lineHeight: 1.7 }}>
        <div>
          {contact.email ? (
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
          ) : (
            EM_DASH
          )}
        </div>
        <div>{contact.phone || EM_DASH}</div>
        <div>WeChat · {contact.wechat || EM_DASH}</div>
      </div>
    </Blueprint>
  );
}

export function ContactsTab({ supplier }: { supplier: Supplier }) {
  const router = useRouter();
  const { toast } = useToast();

  const [dialog, setDialog] = useState<Dialog>({ kind: "closed" });
  const [values, setValues] = useState<SupplierContactValues>({ ...EMPTY_CONTACT });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  /** The sentence the action sent back, shown inside the dialog that caused it. */
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The data layer sorts the cards primary-first, but a record whose sheet
  // arrived without the sales block has no flagged card at all: then the first
  // one is the contact the header and the list already show.
  const primaryId =
    supplier.contacts.find((contact) => contact.isPrimary)?.id ??
    supplier.contacts[0]?.id;

  function openEditor(contact: SupplierContact | null) {
    setValues(contact ? toValues(contact) : { ...EMPTY_CONTACT });
    setFieldErrors({});
    setMessage(null);
    setDialog({ kind: "edit", contact });
  }

  function close() {
    if (busy) return;
    setDialog({ kind: "closed" });
    setFieldErrors({});
    setMessage(null);
  }

  function set(field: keyof SupplierContactValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function save(contact: SupplierContact | null) {
    setBusy(true);
    setFieldErrors({});
    setMessage(null);

    const result = contact
      ? // The card keeps the role it had: editing a phone number must not move
        // the "Person in charge (Sales)" flag to somebody else.
        await updateContact(contact.id, { ...values, isPrimary: contact.isPrimary })
      : await createContact(supplier.id, values);

    setBusy(false);

    if (!result.ok) {
      setFieldErrors(result.error.fieldErrors ?? {});
      setMessage(result.error.message);
      return;
    }

    setDialog({ kind: "closed" });
    toast(contact ? `${values.name} updated.` : `${values.name} added to ${supplier.shortName}.`);
    router.refresh();
  }

  async function remove(contact: SupplierContact) {
    setBusy(true);
    setMessage(null);

    const result = await deleteContact(contact.id);
    setBusy(false);

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setDialog({ kind: "closed" });
    toast(`${contact.name} removed from ${supplier.shortName}.`);
    router.refresh();
  }

  const editing = dialog.kind === "edit" ? dialog.contact : null;

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <h5 style={{ margin: 0, flex: 1 }}>Contacts</h5>
        <Button
          variant="secondary"
          icon="plus"
          style={{ fontSize: "12.5px" }}
          onClick={() => openEditor(null)}
        >
          Add Contact
        </Button>
      </div>

      {supplier.contacts.length === 0 ? (
        <EmptyState
          message="No contacts registered — the sales contact is captured on the supplier data sheet."
          action={
            <>
              <Button
                variant="secondary"
                size="compact"
                icon="plus"
                onClick={() => openEditor(null)}
              >
                Add Contact
              </Button>
              <ButtonLink
                variant="secondary"
                size="compact"
                icon="pencil"
                href={`/suppliers/${supplier.id}/edit`}
              >
                Edit Supplier
              </ButtonLink>
            </>
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
            gap: 12,
          }}
        >
          {supplier.contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              primary={contact.id === primaryId}
              onEdit={() => openEditor(contact)}
              onRemove={() => {
                setMessage(null);
                setDialog({ kind: "remove", contact });
              }}
            />
          ))}
        </div>
      )}

      <Modal
        open={dialog.kind === "edit"}
        onClose={close}
        title={editing ? "Edit Contact" : "Add Contact"}
        subtitle={supplier.shortName}
        size="md"
        footer={
          <ModalActions>
            <Button onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={() => save(editing)}>
              Save Contact
            </Button>
          </ModalActions>
        }
      >
        <FieldGrid columns={2} gap={12} style={{ margin: "14px 0 4px" }}>
          <Field
            label="Contact Person"
            required
            error={fieldErrors.name}
            style={{ gridColumn: "span 2" }}
          >
            <Input
              placeholder="Name"
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
            />
          </Field>
          <Field label="Position" error={fieldErrors.role}>
            <Input
              placeholder="Position"
              value={values.role}
              onChange={(event) => set("role", event.target.value)}
            />
          </Field>
          <Field label="Email" error={fieldErrors.email}>
            <Input
              type="email"
              placeholder="name@company.com"
              value={values.email}
              onChange={(event) => set("email", event.target.value)}
            />
          </Field>
          <Field label="Phone" error={fieldErrors.phone}>
            <Input
              placeholder="+86"
              value={values.phone}
              onChange={(event) => set("phone", event.target.value)}
            />
          </Field>
          <Field label="WeChat" error={fieldErrors.wechat}>
            <Input
              placeholder="ID"
              value={values.wechat}
              onChange={(event) => set("wechat", event.target.value)}
            />
          </Field>
        </FieldGrid>

        {/* A field error is already on its field; this is what happened to the
            card as a whole — a refused write, a lost session. */}
        {message && Object.keys(fieldErrors).length === 0 ? (
          <ErrorState className="mt-[4px]" message={message} />
        ) : null}
      </Modal>

      <ConfirmModal
        open={dialog.kind === "remove"}
        onClose={close}
        onConfirm={() => {
          if (dialog.kind === "remove") void remove(dialog.contact);
        }}
        title="Remove contact"
        body={
          <>
            <p style={{ margin: 0 }}>
              {dialog.kind === "remove"
                ? `${dialog.contact.name} will be removed from ${supplier.shortName}. The visit reports that already name this contact keep it.`
                : ""}
            </p>
            {message ? <ErrorState className="mt-[10px]" message={message} /> : null}
          </>
        }
        confirmLabel="Remove Contact"
        destructive
        loading={busy}
      />
    </div>
  );
}
