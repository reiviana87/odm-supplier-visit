import Link from "next/link";

import { cn } from "@/lib/utils/cn";
import { Icon } from "./icon";

/**
 * Breadcrumb — README §2 (last row) and §4.
 *
 * "11.5px row, `gap:6px`, chevron 12px `opacity:.5`; links accent-700, hover
 * underline, current page `--color-text`."
 *
 * Transcribed from the editor header, prototype lines 767..774:
 * `Reports › GSO-2608001x00 › {section name}`. Items carrying an `href`
 * navigate; the last item is always the current page.
 */
export interface BreadcrumbItem {
  label: string;
  /** Omit on the current page (and on intermediate labels that do not link). */
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn(className)}>
      <ol
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          listStyle: "none",
          margin: 0,
          padding: 0,
          fontSize: "11.5px",
          color: "var(--color-neutral-600)",
        }}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${index}-${item.label}`}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              {index > 0 ? (
                <Icon name="right" size={12} style={{ opacity: 0.5 }} />
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:underline"
                  style={{ color: "var(--color-accent-700)" }}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  style={isLast ? { color: "var(--color-text)" } : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
