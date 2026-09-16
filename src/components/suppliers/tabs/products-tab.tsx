import { Tag } from "@/components/ui/badge";
import { Blueprint } from "@/components/ui/blueprint";
import { EmptyState } from "@/components/ui/states";
import type { Supplier } from "@/types/domain";

/**
 * Supplier Products tab — README §1.7, prototype lines 549..562.
 *
 * The master record holds exactly one product field: the category list the
 * supplier declared on its data sheet. The prototype's Type / application table
 * is *report* content (§4 Main Products, one row per model discussed at a
 * visit), so it is not duplicated here — this tab shows what the supplier
 * record actually holds and says where the detailed table lives.
 */

function splitDeclared(list: string | null): string[] {
  if (!list) return [];
  return list
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function ProductsTab({ supplier }: { supplier: Supplier }) {
  const categories = splitDeclared(supplier.productCategories);

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <h5 style={{ margin: 0, flex: 1 }}>Products</h5>
      </div>

      {categories.length === 0 ? (
        <EmptyState message="No product categories on the data sheet yet — they are recorded with the supplier record." />
      ) : (
        <>
          <h6 style={{ margin: "0 0 8px", color: "var(--color-accent-700)" }}>
            Product Categories
          </h6>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 14,
            }}
          >
            {categories.map((category) => (
              <Tag key={category} tone="outline">
                {category}
              </Tag>
            ))}
          </div>

          <Blueprint style={{ padding: 13, fontSize: 13, lineHeight: 1.6 }}>
            <p style={{ margin: 0 }}>
              Categories as declared by the supplier on its data sheet. Models,
              standards, voltage ratings and applications are not part of the
              master record: they are recorded per visit in section 4 — Main
              Products of the corresponding visit report, together with the
              product photographs.
            </p>
          </Blueprint>
        </>
      )}
    </div>
  );
}
