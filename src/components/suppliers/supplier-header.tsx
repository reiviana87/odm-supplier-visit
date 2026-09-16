import type { ReactNode } from "react";

import { DataSheetBadge, SupplierStatusBadge, Tag } from "@/components/ui/badge";
import { Blueprint } from "@/components/ui/blueprint";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Tabs } from "@/components/ui/tabs";
import type { Supplier } from "@/types/domain";

import { supplierInitials } from "@/lib/suppliers/display";
import { SupplierLifecycleActions } from "./supplier-lifecycle-actions";

/**
 * Supplier detail header — README §1.7, prototype lines 426..468.
 *
 * Breadcrumb, the 62px initials square, the identity column (name + status,
 * legal name + data-sheet state, the four-item meta row), the actions and
 * the six-tab strip. The §33 lifecycle control beside Edit Supplier is the one
 * client island here; everything else renders on the server. The tab strip is rendered in `href` mode: every tab is a
 * real route (`/suppliers/:id/:tab`), so the tabs are links, not state.
 */

export const SUPPLIER_TAB_IDS = [
  "overview",
  "contacts",
  "products",
  "certificates",
  "files",
  "history",
] as const;

export type SupplierTabId = (typeof SUPPLIER_TAB_IDS)[number];

const TAB_LABELS: Record<SupplierTabId, string> = {
  overview: "Overview",
  contacts: "Contacts",
  products: "Products",
  certificates: "Certificates",
  files: "Files",
  history: "Visit History",
};

export function isSupplierTab(value: string): value is SupplierTabId {
  return (SUPPLIER_TAB_IDS as readonly string[]).includes(value);
}

/** "Tangshan, Hebei · China" — parts the data sheet left blank are dropped. */
function locationLine(supplier: Supplier): string {
  const place = [supplier.city, supplier.region].filter(Boolean).join(", ");
  return place ? `${place} · ${supplier.country}` : supplier.country;
}

/** The data sheet stores bare hosts ("htcablewire.com"); links need a scheme. */
function websiteHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function MetaItem({
  icon,
  title,
  children,
}: {
  icon: IconName;
  /** Accessible name — the meta icons are the only label their value carries. */
  title?: string;
  children: ReactNode;
}) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Icon name={icon} size={13} title={title} style={{ flex: "none" }} />
      {children}
    </span>
  );
}

export function SupplierHeader({
  supplier,
  activeTab,
}: {
  supplier: Supplier;
  activeTab: SupplierTabId;
}) {
  const contactLine = supplier.contactName
    ? [supplier.contactName, supplier.contactTitle].filter(Boolean).join(" · ")
    : "Contact not registered";

  return (
    <div style={{ padding: "20px 24px 0" }}>
      <div style={{ marginBottom: 14 }}>
        <Breadcrumb
          items={[
            { label: "Suppliers", href: "/suppliers" },
            { label: supplier.shortName },
          ]}
        />
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <Blueprint
          aria-hidden="true"
          style={{
            width: 62,
            height: 62,
            flex: "none",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 20,
            color: "var(--color-accent-700)",
          }}
        >
          {supplierInitials(supplier)}
        </Blueprint>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3 style={{ margin: 0 }}>{supplier.shortName}</h3>
            <SupplierStatusBadge status={supplier.status} />
            {/* §33 — an archived record is still readable, and must say so:
                it is out of every list and picker the user might look in. */}
            {supplier.archivedAt !== null ? <Tag tone="outline">Archived</Tag> : null}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--color-neutral-700)",
              marginTop: 1,
            }}
          >
            <span>{supplier.legalName}</span>
            <DataSheetBadge state={supplier.dataSheetState} />
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
              marginTop: 9,
              fontSize: 12,
              color: "var(--color-neutral-700)",
            }}
          >
            <MetaItem icon="factory" title="Location">
              {locationLine(supplier)}
            </MetaItem>
            <MetaItem icon="link" title="Website">
              {supplier.websiteUrl ? (
                <a
                  href={websiteHref(supplier.websiteUrl)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {supplier.websiteUrl}
                </a>
              ) : (
                "—"
              )}
            </MetaItem>
            <MetaItem icon="users" title="Sales contact">
              {contactLine}
            </MetaItem>
            <MetaItem icon="clock">
              {supplier.lastVisitDate
                ? `Last visit ${supplier.lastVisitDate}`
                : "No visits recorded"}
            </MetaItem>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flex: "none" }}>
          <SupplierLifecycleActions
            supplierId={supplier.id}
            supplierName={supplier.shortName}
            archived={supplier.archivedAt !== null}
          />
          <ButtonLink
            variant="secondary"
            icon="pencil"
            href={`/suppliers/${supplier.id}/edit`}
          >
            Edit Supplier
          </ButtonLink>
          <ButtonLink
            variant="primary"
            icon="plus"
            href="/reports/new"
          >
            New Visit Report
          </ButtonLink>
        </div>
      </div>

      <Tabs
        className="mt-[16px]"
        activeId={activeTab}
        items={SUPPLIER_TAB_IDS.map((id) => ({
          id,
          label: TAB_LABELS[id],
          href: `/suppliers/${supplier.id}/${id}`,
        }))}
      />
    </div>
  );
}
