"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Tag } from "@/components/ui/badge";

/**
 * Global top bar — README §2.
 *
 *   height 50px · position sticky, top 0, z-index 20 · padding 0 20px · gap 14px
 *   background var(--color-bg) · border-bottom 1px solid var(--color-divider)
 *   global search 340px / max-width 42%, results panel 440px, .elev-lg, z-index 40
 *
 * Prototype: design-handoff/ODM Supplier Visit.dc.html lines 151..180.
 */

interface SearchResult {
  kind: string;
  title: string;
  subtitle: string;
  href: string;
}

/**
 * The four results the approved prototype shows for the "hydraulic test" query.
 * Phase 1 renders them as the shape of the feature; real cross-entity search
 * lands with the Supabase queries.
 */
const DEMO_RESULTS: readonly SearchResult[] = [
  {
    kind: "REPORT",
    title: "GSO-2608001x00 — HEBEI HUATONG",
    subtitle:
      "§6 Visit Relevant Information · “…hydraulic test bench not applicable; electrical test lab CNAS…”",
    href: "/reports/gso-2608001x00/visit",
  },
  {
    kind: "REPORT",
    title: "GSO-2607004x00 — DAFU",
    subtitle:
      "§6 Visit Relevant Information · “…two hydraulic test benches, 0–120 m head range…”",
    href: "/reports/gso-2607004x00/visit",
  },
  {
    kind: "PHOTO",
    title: "Appendix photo 14 — CNAS laboratory",
    subtitle: "Caption contains “test benches” · GSO-2608001x00",
    href: "/reports/gso-2608001x00/appendix",
  },
  {
    kind: "SUPPLIER",
    title: "SHIMGE — 新界泵业",
    subtitle: "Products: booster sets · internal hydraulic performance laboratory",
    href: "/suppliers/shimge/overview",
  },
];

export function TopBar({
  offline = false,
  queuedCount = 0,
  onNewReport,
}: {
  offline?: boolean;
  queuedCount?: number;
  onNewReport?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = query.trim()
    ? DEMO_RESULTS.filter((r) =>
        `${r.title} ${r.subtitle}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : DEMO_RESULTS;

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
    }
  }

  return (
    <header
      className="sticky top-0 z-20 flex flex-none items-center"
      style={{
        height: "var(--topbar-height)",
        gap: 14,
        padding: "0 20px",
        background: "var(--color-bg)",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <div
        ref={containerRef}
        onBlur={handleBlur}
        className="relative"
        style={{ width: "var(--global-search-width)", maxWidth: "42%" }}
      >
        <Icon
          name="search"
          size={14}
          style={{ position: "absolute", left: 9, top: 11, opacity: 0.45 }}
        />
        <input
          className="input"
          type="search"
          aria-label="Search suppliers, reports and document numbers"
          placeholder="Search suppliers, reports, document numbers…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          style={{ paddingLeft: 28, fontSize: 12.5 }}
        />

        {open ? (
          <Blueprint
            className="elev-lg anim-rise-fast absolute"
            style={{
              top: 40,
              left: 0,
              width: 440,
              background: "var(--color-bg)",
              zIndex: 40,
              padding: 6,
            }}
          >
            <div
              className="kicker-muted"
              style={{ padding: "6px 8px" }}
              aria-live="polite"
            >
              {query.trim()
                ? `Results for “${query.trim()}” · ${results.length} ${results.length === 1 ? "match" : "matches"}`
                : "Recent across reports, photos and suppliers"}
            </div>
            {results.map((result) => (
              <Link
                key={result.href + result.title}
                href={result.href}
                onClick={() => setOpen(false)}
                className="flex w-full items-start text-left"
                style={{
                  gap: 10,
                  padding: 8,
                  borderTop: "1px solid var(--color-divider)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {/* 9.5px is the prototype's result-chip size. */}
                <Tag
                  tone="neutral"
                  className="flex-none"
                  style={{ fontSize: 9.5, marginTop: 2 }}
                >
                  {result.kind}
                </Tag>
                <span className="min-w-0 flex-1">
                  <span
                    className="block"
                    style={{ fontSize: 12.5, color: "var(--color-text)" }}
                  >
                    {result.title}
                  </span>
                  <span
                    className="block"
                    style={{ fontSize: 11.5, color: "var(--color-neutral-600)" }}
                  >
                    {result.subtitle}
                  </span>
                </span>
              </Link>
            ))}
            {results.length === 0 ? (
              <div
                style={{
                  padding: 8,
                  borderTop: "1px solid var(--color-divider)",
                  fontSize: 12.5,
                  color: "var(--color-neutral-700)",
                }}
              >
                Nothing matched that. Search covers document numbers, supplier names,
                section text and photo captions.
              </div>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              block
              className="mt-0.5 justify-start"
              style={{ fontSize: 11.5 }}
            >
              Close
            </Button>
          </Blueprint>
        ) : null}
      </div>

      <div className="flex-1" />

      {/* Connection state — README §22 "Network unavailable". */}
      <div
        className="flex items-center"
        style={{ gap: 6, fontSize: 11.5, color: "var(--color-neutral-600)" }}
        aria-live="polite"
      >
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            display: "inline-block",
            background: offline ? "var(--color-warning-strong)" : "var(--color-accent)",
          }}
        />
        {offline ? `Offline — ${queuedCount} changes queued` : "Synced"}
      </div>

      <Button
        variant="secondary"
        icon="plus"
        onClick={onNewReport}
        style={{ fontSize: 12.5 }}
      >
        New Visit Report
      </Button>
    </header>
  );
}
