import type { Metadata } from "next";

import { Blueprint } from "@/components/ui/blueprint";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

/**
 * 404 — the approved visual language applied to an unmapped address: the
 * blueprint card with its four registration marks, the condensed square type
 * and one way back. README §22: never blame the user, always say what happened
 * to their work.
 */
export default function NotFound() {
  return (
    <div
      style={{
        // 70vh rather than 100vh: this file is also the boundary for a
        // notFound() thrown inside the app shell, where a full-viewport block
        // under the top bar would add a scrollbar.
        minHeight: "70vh",
        background: "var(--color-bg)",
        display: "grid",
        placeItems: "center",
        padding: "40px 24px",
      }}
    >
      <Blueprint
        className="anim-rise"
        style={{
          width: "min(420px, 100%)",
          padding: "32px 30px",
          background: "var(--color-surface)",
        }}
      >
        <div className="kicker" style={{ marginBottom: 8 }}>
          Error · 404
        </div>
        <h3 style={{ margin: "0 0 8px" }}>Page not found</h3>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--color-neutral-700)",
            margin: "0 0 20px",
          }}
        >
          This address does not match any screen in the application. Nothing was
          lost — every report is where you left it.
        </p>
        <ButtonLink href="/" variant="primary" icon="grid">
          Back to the dashboard
        </ButtonLink>
      </Blueprint>
    </div>
  );
}
