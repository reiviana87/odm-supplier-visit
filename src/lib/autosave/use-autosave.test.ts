/**
 * The autosave conflict contract — Phase 2 §18.
 *
 * ## What this file can and cannot reach, stated plainly
 *
 * `use-autosave.ts` exports one runtime value: the `useAutosave` hook. Its
 * decision logic — the debounce, the backoff, and the gate that refuses to
 * retry a patch that lost a race — lives in closures inside the hook, and the
 * helpers around them (`backoffDelay`, `savedAt`, `isOffline`,
 * `createMemoryQueue`) are module-private. Vitest runs `environment: "node"`
 * here, so there is no renderer to mount the hook in, and this project is not
 * taking a jsdom dependency to get one.
 *
 * So the gate itself is NOT tested below. Faking a renderer, or re-implementing
 * the reducer in the test and asserting against that, would only assert this
 * file's own fiction. What IS covered is the part of the conflict path that is
 * pure, exported and shared with the server:
 *
 *   · the shape of the contract between the transport and the hook, enforced by
 *     `tsc --noEmit` over this file — a `stale` outcome has to be able to carry
 *     the server's detail, and a `saved` one must not;
 *   · `toDataError`, which is what decides that a refused write is `forbidden`
 *     rather than `stale` once `saveSection` has re-read the row, and the
 *     sentences the user is shown for each.
 *
 * `saveSection`'s own stale-vs-forbidden branch (`report-actions.ts`, the block
 * after the update returns zero rows) is inline against a live Supabase client
 * and has no pure seam, so it cannot be reached from here either.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AutosaveConflict,
  AutosaveOutcome,
  AutosaveSaveContext,
} from "@/lib/autosave/use-autosave";
import { DEFAULT_MESSAGES, fail, toDataError, uniqueConflict } from "@/lib/data/errors";

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// The transport ⇄ hook contract
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What the conflict dialog is handed. Written against the exported types on
 * purpose: if `AutosaveOutcome`'s stale branch stops carrying the server
 * detail, this stops compiling — which is the failure worth catching, since at
 * runtime the dialog would simply describe a conflict it knows nothing about.
 */
function conflictOf(outcome: AutosaveOutcome): AutosaveConflict | null {
  if (outcome.status !== "stale") return null;

  return {
    serverVersion: outcome.serverVersion,
    serverUpdatedAt: outcome.serverUpdatedAt,
    serverUpdatedBy: outcome.serverUpdatedBy,
    serverValue: outcome.serverValue,
  };
}

describe("AutosaveOutcome", () => {
  it("carries the whole server side of a conflict through to the dialog", () => {
    const outcome: AutosaveOutcome = {
      status: "stale",
      serverVersion: 8,
      serverUpdatedAt: "2026-08-12T18:04:00Z",
      serverUpdatedBy: "Lola Lu",
      serverValue: { body: "Their paragraph." },
    };

    expect(conflictOf(outcome)).toEqual({
      serverVersion: 8,
      serverUpdatedAt: "2026-08-12T18:04:00Z",
      serverUpdatedBy: "Lola Lu",
      serverValue: { body: "Their paragraph." },
    });
  });

  it("allows a transport that only knows 'zero rows matched' to say exactly that", () => {
    // Phase 2 §18 — reporting nothing is allowed, reporting a guess is not, so
    // the dialog must be able to receive a conflict with no detail at all.
    expect(conflictOf({ status: "stale" })).toEqual({
      serverVersion: undefined,
      serverUpdatedAt: undefined,
      serverUpdatedBy: undefined,
      serverValue: undefined,
    });
    expect(conflictOf({ status: "error", message: "Network down." })).toBeNull();
    expect(conflictOf({ status: "saved", version: 9 })).toBeNull();
  });

  it("keeps conflict detail off the outcomes that are not conflicts", () => {
    // A `saved` outcome reports the version it reached and nothing about a race;
    // a `version` the caller can patch on is optional until one is known.
    const saved: AutosaveOutcome = { status: "saved", version: 9, updatedAt: "2026-08-12T18:05:00Z" };
    const context: AutosaveSaveContext = {};

    expect(saved.status).toBe("saved");
    expect(context.version).toBeUndefined();

    // @ts-expect-error — a saved outcome may not carry the other session's version.
    const wrong: AutosaveOutcome = { status: "saved", serverVersion: 8 };
    expect(wrong.status).toBe("saved");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The server half — how a refused save is classified
// ─────────────────────────────────────────────────────────────────────────────

describe("the messages a losing save produces", () => {
  it("tells the user a newer version exists, and never that their work was lost", () => {
    const stale = fail("stale");

    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.error.code).toBe("stale");
      expect(stale.error.message).toBe(DEFAULT_MESSAGES.stale);
      expect(stale.error.message).toMatch(/nothing is overwritten/i);
      expect(stale.error.message).not.toMatch(/lost/i);
    }
  });

  it("keeps 'somebody saved first' and 'you may not save this' apart", () => {
    // `saveSection` re-reads the row precisely to tell these two apart: sending
    // a read-only author round a "reload before saving" loop would never end.
    const forbidden = fail("forbidden", "This report is read-only for your role.");

    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) {
      expect(forbidden.error.code).toBe("forbidden");
      expect(forbidden.error.message).toBe("This report is read-only for your role.");
    }
  });
});

describe("toDataError", () => {
  it("maps the Postgres codes a write can come back with", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(toDataError({ code: "42501" }, "saveSection").code).toBe("forbidden");
    expect(toDataError({ code: "23505" }, "createReport").code).toBe("conflict");
    expect(toDataError({ code: "23514" }, "saveObservations").code).toBe("invalid");
    expect(toDataError({ code: "PGRST116" }, "getSectionRecord").code).toBe("not_found");
    expect(toDataError({ code: "23503" }, "archiveReport").code).toBe("conflict");

    expect(logged).toHaveBeenCalled();
  });

  it("reads a transport failure as offline and an expired session as unauthenticated", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(toDataError({ message: "fetch failed" }, "saveSection").code).toBe("offline");
    expect(toDataError({ message: "ECONNREFUSED 127.0.0.1:54321" }, "saveSection").code).toBe(
      "offline",
    );
    expect(toDataError({ message: "JWT expired" }, "saveSection").code).toBe("unauthenticated");
  });

  it("never returns the database's own words to the user", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const error = toDataError(
      { code: "XX000", message: 'relation "report_sections" does not exist' },
      "saveSection",
    );

    expect(error.code).toBe("unknown");
    expect(error.message).toBe(DEFAULT_MESSAGES.unknown);
    expect(error.message).not.toMatch(/report_sections/);
  });

  it("names the field a unique conflict came from so the form can show it in place", () => {
    expect(uniqueConflict("documentNumber", "That document number is already in use.")).toEqual({
      code: "conflict",
      message: "That document number is already in use.",
      fieldErrors: { documentNumber: "That document number is already in use." },
    });
  });
});
