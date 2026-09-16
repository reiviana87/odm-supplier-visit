"use client";

import { PageShell } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/states";

/**
 * Route error boundary for every authenticated screen.
 *
 * README §22, backend row: the page-level banner reads "The server is not
 * responding. Work continues locally and will sync when it returns." — state
 * what happened to the user's work, never blame them, always offer the retry.
 * `reset()` re-renders the segment that threw.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageShell>
      <ErrorState
        variant="page"
        message="The server is not responding. Work continues locally and will sync when it returns."
        onRetry={reset}
      />
      {error.digest ? (
        <p
          style={{
            margin: "10px 0 0",
            textAlign: "center",
            fontSize: 11.5,
            color: "var(--color-neutral-600)",
          }}
        >
          Reference {error.digest}
        </p>
      ) : null}
    </PageShell>
  );
}
