"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { isMockMode } from "@/lib/supabase/env";

/**
 * Phase 2 §28 — while the app is reading the seeded demo data, say so.
 *
 * Nothing else on screen distinguishes mock mode from a live project: the
 * screens render the same, saves refuse with an ordinary message, and the one
 * thing that would give it away is the absence of change after a reload. The
 * strip is the honest signal, in the approved warning language (README §4:
 * warning ground, 1px warning border, warning ink, 11.5px, alert icon).
 *
 * A Client Component on purpose, for two reasons. Dismissal is state, and
 * `AppShell` — the obvious mount point — is itself `"use client"`, so a Server
 * Component could not be imported there. `isMockMode()` is safe here: it reads
 * only `NEXT_PUBLIC_*` literals, which the bundler inlines, so the client sees
 * exactly the value the server rendered and nothing mismatches on hydration.
 *
 * Dismissal is deliberately not persisted. Mock mode is a property of the
 * deployment rather than a preference, so it earns the right to say so again on
 * the next load.
 */
export function MockModeBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !isMockMode()) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex items-center"
      style={{
        gap: 7,
        padding: "5px 14px",
        fontSize: 11.5,
        color: "var(--color-warning-ink)",
        background: "var(--color-warning-bg)",
        border: "1px solid var(--color-warning-border)",
      }}
    >
      <Icon name="alert" size={13} style={{ flex: "none" }} />
      <span>
        Demo data — no Supabase project is connected. Nothing you change here is
        saved.
      </span>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss the demo data notice"
        title="Dismiss the demo data notice"
        className="cursor-pointer border-0 bg-transparent p-0 opacity-60 hover:opacity-100"
        style={{ color: "inherit", flex: "none" }}
      >
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}
