"use client";

import { Tag } from "@/components/ui/badge";
import { Blueprint } from "@/components/ui/blueprint";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { Supplier, SupplierContact } from "@/types/domain";

/**
 * Supplier Contacts tab — README §1.7, prototype lines 525..548.
 *
 * One card per registered contact; the first one carries the "Main contact"
 * tag, which is how the data sheet is structured (the sales contact is field
 * "Person in charge (Sales)", everyone else was added afterwards).
 */

const EM_DASH = "—";

function ContactCard({
  contact,
  primary,
}: {
  contact: SupplierContact;
  primary: boolean;
}) {
  return (
    <Blueprint className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="card-title">{contact.name}</div>
        {primary ? <Tag tone="accent">Main contact</Tag> : null}
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
  const { toast } = useToast();

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <h5 style={{ margin: 0, flex: 1 }}>Contacts</h5>
        <Button
          variant="secondary"
          icon="plus"
          style={{ fontSize: "12.5px" }}
          onClick={() =>
            toast("Adding contacts arrives with supplier persistence (Phase 2)")
          }
        >
          Add Contact
        </Button>
      </div>

      {supplier.contacts.length === 0 ? (
        <EmptyState
          message="No contacts registered — the sales contact is captured on the supplier data sheet."
          action={
            <ButtonLink
              variant="secondary"
              size="compact"
              icon="pencil"
              href={`/suppliers/${supplier.id}/edit`}
            >
              Edit Supplier
            </ButtonLink>
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
          {supplier.contacts.map((contact, index) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              primary={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
