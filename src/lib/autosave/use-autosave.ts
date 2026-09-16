"use client";

/**
 * Autosave engine — README §6.3, §7, §24 and the §25 "Autosave rules".
 *
 * A reusable hook, not a per-screen behaviour: give it the value the user is
 * editing and a `save` callback, and it owns the debounce, the in-flight
 * bookkeeping, the retry backoff, the offline queue and the ⌘/Ctrl+S shortcut.
 *
 * Three invariants. The first two come straight from README §7 — "the user must
 * never be uncertain":
 *
 * 1. The hook is **optimistic and non-destructive**. The caller owns `value`;
 *    this hook only ever reads it. A failed save never clears, rewrites or
 *    rolls back what is on screen.
 * 2. Nothing is lost by navigating away. A pending debounce is flushed on
 *    unmount and when the page is hidden or unloaded (`visibilitychange`,
 *    `pagehide`), so switching sections cannot drop a keystroke (README §6.3).
 * 3. Phase 2 §18 — **a stale write is never retried.** Once the server answers
 *    that someone else wrote first, resending the same patch would overwrite
 *    their text with a body built on a version that no longer exists. The hook
 *    stops, says so, and waits for a deliberate act from the user; the draft is
 *    still dirty and still on screen, so nothing typed is discarded either way.
 *    The two deliberate acts are `resolveWithServer` and `resolveWithLocal`;
 *    neither is ever taken by the hook itself, and the state carries the
 *    `conflict` detail the dialog needs to describe both sides honestly.
 *
 * There is no persistence import here — no Supabase, no fetch. The `save`
 * callback is injected, which is what makes the hook testable and reusable.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * README §7's five indicator states, plus `conflict` (Phase 2 §18): a save that
 * lost a race is a different situation from a save that failed, because it is
 * the only one the user has to resolve by hand.
 */
export type AutosaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "failed"
  | "offline"
  | "conflict";

/**
 * The other side of a conflict, exactly as much of it as the server chose to
 * report. Every field is optional because a transport that only knows "zero
 * rows matched" can say so without inventing a name or a time — and the dialog
 * must never present an invented one (Phase 2 §18).
 *
 * `serverValue` is `unknown` rather than `T`: the value crosses the transport
 * boundary, and the hook has no way to check that what came back really is a
 * `T`. Narrowing it here would be a cast the compiler cannot verify, so it is
 * left to the caller, who wrote `save` and knows the shape it reads.
 */
export interface AutosaveConflict {
  /** Version the row is at now — what the next patch must be built on. */
  serverVersion?: number;
  /** When the other session wrote, as the stored timestamp. */
  serverUpdatedAt?: string;
  /** Who wrote it. A display name; `null` or absent when it is not known. */
  serverUpdatedBy?: string | null;
  /** The stored value, when the transport read it back with the rejection. */
  serverValue?: unknown;
}

export type AutosaveState = {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  /** Edits made since the connection dropped. 0 whenever the app is online. */
  queuedCount: number;
  /**
   * Why the last attempt did not land — the server's own words for `failed`,
   * the conflict sentence for `conflict`. Absent while things are going well.
   */
  message?: string;
  /**
   * Row version reached by the last acknowledged save, when the save reports
   * one. The caller patches against the version it holds (Phase 2 §18), so it
   * reads the new one back here instead of keeping a second copy of it.
   */
  lastSavedVersion?: number;
  /**
   * Set while — and only while — `status` is `conflict`. It is what the
   * conflict dialog reads, so the user is told who saved and when instead of
   * only that "something" happened.
   */
  conflict?: AutosaveConflict;
};

/**
 * What one `save` attempt did, as reported by the persistence layer. It mirrors
 * `DataResult` at the level the indicator cares about: landed, lost the race,
 * or broke.
 *
 * A `stale` outcome carries whatever the transport learned about the row that
 * won the race. Reporting nothing is allowed; reporting a guess is not.
 */
export type AutosaveOutcome =
  | { status: "saved"; version?: number; updatedAt?: string }
  | ({ status: "stale" } & AutosaveConflict)
  | { status: "error"; message?: string };

/**
 * Passed to `save` alongside the value so the patch can be built on the version
 * the hook believes the row is at (Phase 2 §18).
 */
export interface AutosaveSaveContext {
  /**
   * The row version to match on, once the hook knows one: the version the last
   * acknowledged save reached, or — after the user chose "keep my changes" —
   * the server version their text now deliberately overwrites. `undefined`
   * until then, so the caller falls back to the version it loaded the row at:
   * `const version = context.version ?? loadedVersion`.
   */
  version?: number;
}

/**
 * Phase 2 §18 — stated as a fact, and never as "your changes were lost": they
 * were not, they are still in the editor. It points at the choice rather than
 * at a reload, because reloading is only one of the two answers and it is the
 * one that drops the draft.
 */
const CONFLICT_MESSAGE =
  "This section was changed in another session. Review the newer version before saving — your text is still here.";

// ─────────────────────────────────────────────────────────────────────────────
// Timing
// ─────────────────────────────────────────────────────────────────────────────

/** README §7 — "Saved" holds 3s, then the indicator falls back to "Last saved …". */
const SAVED_HOLD_MS = 3000;

/** README §7 — "a failed save keeps retrying with backoff". 1s, 2s, 4s … 30s. */
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30000;

function backoffDelay(attempt: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1), RETRY_MAX_MS);
}

type TimerRef = { current: ReturnType<typeof setTimeout> | null };

function clearTimer(ref: TimerRef): void {
  if (ref.current !== null) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * When the row says when it was written, the indicator shows that; the local
 * clock is only a fallback, since it can disagree with the stored timestamp.
 */
function savedAt(updatedAt: string | undefined): Date {
  if (updatedAt !== undefined) {
    const parsed = new Date(updatedAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

// ─────────────────────────────────────────────────────────────────────────────
// Offline queue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The seam for README §25 — "Offline: queue in IndexedDB, replay on reconnect,
 * keep the count visible."
 *
 * It implements the *count* and the *replay*, in memory: the caller owns the
 * draft, so a queued change is "the latest value has not reached the server
 * yet" plus how many edits were made while the connection was down. That
 * survives a reconnect, which is what the indicator and the sync toast need,
 * but it does not survive a reload.
 *
 * Phase 2 §19 keeps it that way on purpose: the desktop editor is used on a
 * connection, and a durable store would have to answer replay ordering, version
 * skew and eviction to be worth having. The seam stays because it is cheap —
 * the queue is only ever reached through these three methods, so an
 * IndexedDB-backed implementation of the same interface is a drop-in the day
 * offline editing is actually on the roadmap. What we do not do is pretend:
 * there is no localStorage stand-in and no silent durability promise.
 */
interface AutosaveQueue {
  /** Records one unsaved edit; returns the new depth. */
  enqueue(): number;
  /** Drops everything after a successful replay. */
  clear(): void;
  /** Current depth, shown by the indicator. */
  size(): number;
}

function createMemoryQueue(): AutosaveQueue {
  let depth = 0;
  return {
    enqueue: () => {
      depth += 1;
      return depth;
    },
    clear: () => {
      depth = 0;
    },
    size: () => depth,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export interface UseAutosaveOptions<T> {
  /**
   * The current draft. Every change schedules a save; the hook never writes to
   * it. Keep it referentially stable between renders that changed nothing —
   * a new object literal on every keystroke is fine, a new one on every render
   * is not.
   */
  value: T;
  /**
   * Persists one snapshot and reports what happened (Phase 2 §18). A rejected
   * promise is read as `{ status: 'error' }`, so a `save` that throws still
   * behaves the way README §7 describes — but a save that can tell the
   * difference between "broke" and "someone else wrote first" should say so,
   * because only one of the two may be retried.
   *
   * `context.version` is the version the hook holds for the row; a transport
   * that does optimistic concurrency must patch on it, otherwise "keep my
   * changes" would resend the losing version and conflict forever.
   */
  save: (value: T, context: AutosaveSaveContext) => Promise<AutosaveOutcome>;
  /**
   * Phase 2 §17 — 900ms. README §7 specifies 400ms, which was written before
   * there was a network round trip behind the keystroke; Phase 2 widened the
   * window to 700–1500ms so a sentence is one patch instead of four. Still
   * overridable per caller.
   */
  debounceMs?: number;
  /** Default `true`. `false` for a read-only report: nothing is scheduled. */
  enabled?: boolean;
  /**
   * When the record was last persisted, from the stored row. Seeds the resting
   * indicator so a freshly-opened report reads "Last saved 11:42" instead of an
   * empty slot — the approved resting state in README §7 and
   * screenshots/04-report-editor.png. Omit it and the slot stays empty until
   * this session saves something, which is the honest state for a new record.
   */
  lastSavedAt?: Date | null;
}

export interface UseAutosaveResult {
  state: AutosaveState;
  /**
   * Forces a save now — the header Save button and ⌘/Ctrl+S (README §24).
   * Deliberate, so it also clears the conflict gate: asking for the save again
   * is the user's answer to it (Phase 2 §18). It does *not* adopt the server
   * version, so a patch that lost the race is offered to the server again
   * unchanged and is told `stale` again — which is the honest outcome, and why
   * overwriting on purpose is `resolveWithLocal` instead.
   */
  saveNow: () => void;
  /** Retries immediately and resets the backoff — the indicator's "retry". */
  retry: () => void;
  /**
   * "Reload latest version" — the user chose the other session's text.
   *
   * Drops the pending patch, adopts the server version and returns to idle
   * **without saving anything**; the caller re-reads the row and re-renders
   * from it. This is the only path on which a local value is discarded, and it
   * exists only because the user asked for it.
   */
  resolveWithServer: () => void;
  /**
   * "Keep my changes" — the user chose their own text, knowing it replaces the
   * newer version.
   *
   * Keeps the draft, moves the hook onto the server's version so the retry can
   * actually land, lifts the gate and sends the patch at once. Pass `atVersion`
   * when the transport could not report `serverVersion`; without either, the
   * patch goes out on the version it already has and will be refused again.
   */
  resolveWithLocal: (atVersion?: number) => void;
}

export function useAutosave<T>({
  value,
  save,
  debounceMs = 900,
  enabled = true,
  lastSavedAt = null,
}: UseAutosaveOptions<T>): UseAutosaveResult {
  const [state, setState] = useState<AutosaveState>({
    status: "idle",
    lastSavedAt,
    queuedCount: 0,
  });

  // Everything the timers and listeners read lives in a ref, so the callbacks
  // stay stable and a re-render never re-arms a timer.
  const valueRef = useRef(value);
  const saveRef = useRef(save);
  const debounceMsRef = useRef(debounceMs);
  const enabledRef = useRef(enabled);

  const dirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  const attemptRef = useRef(0);
  /**
   * Set by a `stale` outcome and cleared only by `saveNow`/`retry` — the gate
   * that keeps the hook from resending a patch that already lost a race
   * (Phase 2 §18). While it is set, edits still mark the draft dirty; they just
   * do not travel.
   */
  const conflictRef = useRef(false);
  /** What the server told us about the row that won, for the dialog to read. */
  const conflictDetailRef = useRef<AutosaveConflict | null>(null);
  /**
   * The version the next patch is built on. It only ever moves on an
   * acknowledgement or on a deliberate resolution — never on a `stale`, since
   * adopting the winner's version by itself would silently arm the overwrite.
   */
  const versionRef = useRef<number | undefined>(undefined);
  /**
   * Set by `resolveWithServer` to the value it handed back. When that exact
   * value arrives as the new draft it is the reload, not an edit, so it must
   * not be sent back to the server. Wrapped in an object so "nothing expected"
   * is distinguishable from "expecting `undefined`".
   */
  const adoptedRef = useRef<{ value: unknown } | null>(null);
  const queueRef = useRef<AutosaveQueue>(createMemoryQueue());

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mountedRef = useRef(true);
  /** Breaks the commit → retry → commit cycle without re-creating callbacks. */
  const commitRef = useRef<() => void>(() => {});

  const patchState = useCallback((patch: Partial<AutosaveState>) => {
    if (!mountedRef.current) {
      return;
    }
    setState((previous) => ({ ...previous, ...patch }));
  }, []);

  /** README §7 — "Saved" is held for 3s, then becomes "Last saved 11:42". */
  const holdSaved = useCallback(() => {
    clearTimer(holdTimer);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      if (!mountedRef.current) {
        return;
      }
      setState((previous) =>
        previous.status === "saved" ? { ...previous, status: "idle" } : previous,
      );
    }, SAVED_HOLD_MS);
  }, []);

  /**
   * Queue depth to show while offline. A change that is pending when the
   * connection drops counts as queued even though it was made online, so the
   * indicator never reads "0 changes queued".
   */
  const offlineDepth = useCallback(() => {
    const depth = queueRef.current.size();
    return depth > 0 ? depth : queueRef.current.enqueue();
  }, []);

  const scheduleDebounce = useCallback(() => {
    clearTimer(debounceTimer);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      commitRef.current();
    }, debounceMsRef.current);
  }, []);

  /**
   * The failure path, shared by a rejected promise and an `error` outcome.
   * README §7 — the content stays in the editor, the change stays pending, and
   * the hook keeps retrying with backoff.
   */
  const handleFailure = useCallback(
    (message: string | undefined) => {
      dirtyRef.current = true;
      attemptRef.current += 1;
      patchState(
        isOffline()
          ? { status: "offline", queuedCount: offlineDepth(), message }
          : { status: "failed", message },
      );
      clearTimer(retryTimer);
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null;
        commitRef.current();
      }, backoffDelay(attemptRef.current));
    },
    [offlineDepth, patchState],
  );

  /**
   * Sends the current value. One patch is in flight at a time: edits made
   * during a flight re-arm the debounce when it resolves.
   */
  const commit = useCallback(() => {
    clearTimer(debounceTimer);
    clearTimer(retryTimer);

    if (!dirtyRef.current || inFlightRef.current || conflictRef.current) {
      return;
    }

    if (isOffline()) {
      // Held, not lost — the `online` listener replays it.
      patchState({ status: "offline", queuedCount: offlineDepth() });
      return;
    }

    const snapshot = valueRef.current;
    inFlightRef.current = true;
    dirtyRef.current = false;
    clearTimer(holdTimer);
    // A patch is on its way, so the previous conflict is no longer the state of
    // play: `conflict` is only ever set while the status says `conflict`.
    conflictDetailRef.current = null;
    patchState({ status: "saving", message: undefined, conflict: undefined });

    void saveRef.current(snapshot, { version: versionRef.current }).then(
      (outcome) => {
        inFlightRef.current = false;

        if (outcome.status === "stale") {
          // Phase 2 §18 — the row moved under us. The draft goes back to dirty
          // so the value is still held, but `conflictRef` stops the retry loop:
          // re-sending it is precisely the overwrite §18 exists to prevent.
          dirtyRef.current = true;
          conflictRef.current = true;
          attemptRef.current = 0;
          const conflict: AutosaveConflict = {
            serverVersion: outcome.serverVersion,
            serverUpdatedAt: outcome.serverUpdatedAt,
            serverUpdatedBy: outcome.serverUpdatedBy,
            serverValue: outcome.serverValue,
          };
          conflictDetailRef.current = conflict;
          patchState({ status: "conflict", message: CONFLICT_MESSAGE, conflict });
          return;
        }

        if (outcome.status === "error") {
          handleFailure(outcome.message);
          return;
        }

        attemptRef.current = 0;
        queueRef.current.clear();
        versionRef.current = outcome.version ?? versionRef.current;
        patchState({
          status: "saved",
          lastSavedAt: savedAt(outcome.updatedAt),
          queuedCount: 0,
          message: undefined,
          lastSavedVersion: outcome.version,
        });
        holdSaved();
        if (dirtyRef.current) {
          scheduleDebounce();
        }
      },
      (error: unknown) => {
        // A `save` that throws instead of reporting cannot tell us whether it
        // lost a race, so it gets the retrying treatment — the safe reading.
        inFlightRef.current = false;
        handleFailure(error instanceof Error ? error.message : undefined);
      },
    );
  }, [handleFailure, holdSaved, offlineDepth, patchState, scheduleDebounce]);

  // ── Latest props, kept off the callback identities ────────────────────────
  // Declared first so the effects below always read this render's values.
  useEffect(() => {
    saveRef.current = save;
    debounceMsRef.current = debounceMs;
    enabledRef.current = enabled;
    commitRef.current = commit;
  });

  // ── Change detection ──────────────────────────────────────────────────────
  useEffect(() => {
    // A re-render that did not change the draft is not an edit — and neither is
    // mounting, since `valueRef` starts out holding the first value.
    if (Object.is(valueRef.current, value)) {
      return;
    }
    valueRef.current = value;

    // The draft the user adopted from the server is not an edit of theirs, so
    // it is taken in and not sent back. Any other value is a real edit, and the
    // expectation is spent either way — a keystroke can never be swallowed.
    const adopted = adoptedRef.current;
    adoptedRef.current = null;
    if (adopted !== null && Object.is(adopted.value, value)) {
      return;
    }

    if (!enabledRef.current) {
      return;
    }

    dirtyRef.current = true;
    if (conflictRef.current) {
      // Phase 2 §18 — keep typing, keep the text, send nothing. The indicator
      // stays on `conflict` until the user resolves it.
      return;
    }
    if (isOffline()) {
      patchState({
        status: "offline",
        queuedCount: queueRef.current.enqueue(),
      });
      return;
    }
    scheduleDebounce();
  }, [value, patchState, scheduleDebounce]);

  // ── Flush on unmount, tab hide and unload (README §6.3) ───────────────────
  useEffect(() => {
    mountedRef.current = true;

    const flush = () => {
      clearTimer(debounceTimer);
      commitRef.current();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
      // Stop touching React state, then fire the pending patch: the request
      // itself is allowed to finish after the component is gone.
      mountedRef.current = false;
      flush();
      clearTimer(debounceTimer);
      clearTimer(retryTimer);
      clearTimer(holdTimer);
    };
  }, []);

  // ── Connection (README §7 "Offline pending") ──────────────────────────────
  useEffect(() => {
    const onOffline = () => {
      // Only speak up when a save is actually waiting — the indicator reports
      // saves, not connectivity (the shell carries the connection pill). An
      // unresolved conflict outranks it: dropping the connection does not make
      // the stale patch sendable, and "queued" would promise that it is.
      if (dirtyRef.current && !conflictRef.current) {
        patchState({ status: "offline", queuedCount: offlineDepth() });
      }
    };
    const onOnline = () => {
      if (dirtyRef.current) {
        // Replay straight away; success clears the queue and flips to "Saved".
        attemptRef.current = 0;
        commitRef.current();
        return;
      }
      queueRef.current.clear();
      if (!mountedRef.current) {
        return;
      }
      setState((previous) =>
        previous.status === "offline"
          ? { ...previous, status: "idle", queuedCount: 0 }
          : previous,
      );
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [offlineDepth, patchState]);

  // ── Public actions ────────────────────────────────────────────────────────
  const saveNow = useCallback(() => {
    if (!enabledRef.current) {
      return;
    }
    dirtyRef.current = true;
    attemptRef.current = 0;
    // Only a deliberate act lifts the §18 gate. The server decides again from
    // there: if the row is still ahead, the next outcome is `stale` once more,
    // which is honest — the hook never resolves the conflict on its own.
    conflictRef.current = false;
    conflictDetailRef.current = null;
    commitRef.current();
  }, []);

  const retry = useCallback(() => {
    dirtyRef.current = true;
    attemptRef.current = 0;
    conflictRef.current = false;
    conflictDetailRef.current = null;
    clearTimer(retryTimer);
    commitRef.current();
  }, []);

  const resolveWithServer = useCallback(() => {
    if (!conflictRef.current) {
      return;
    }
    const conflict = conflictDetailRef.current;

    clearTimer(debounceTimer);
    clearTimer(retryTimer);
    // The pending patch is dropped here, and only here: the user answered the
    // dialog with "reload", so their text is being given up on purpose.
    dirtyRef.current = false;
    conflictRef.current = false;
    conflictDetailRef.current = null;
    attemptRef.current = 0;
    queueRef.current.clear();
    // Only when the server actually sent its value: with nothing to recognise,
    // the reloaded draft is indistinguishable from an edit, and it is written
    // back once — the same text at the adopted version, so nothing is lost.
    adoptedRef.current =
      conflict?.serverValue === undefined ? null : { value: conflict.serverValue };
    if (conflict?.serverVersion !== undefined) {
      versionRef.current = conflict.serverVersion;
    }

    const patch: Partial<AutosaveState> = {
      status: "idle",
      message: undefined,
      conflict: undefined,
      queuedCount: 0,
    };
    // The row's own facts, or nothing. The resting indicator would otherwise
    // read "last saved" off this session's clock for a save it never made.
    if (conflict?.serverUpdatedAt !== undefined) {
      patch.lastSavedAt = savedAt(conflict.serverUpdatedAt);
    }
    if (conflict?.serverVersion !== undefined) {
      patch.lastSavedVersion = conflict.serverVersion;
    }
    patchState(patch);
  }, [patchState]);

  const resolveWithLocal = useCallback(
    (atVersion?: number) => {
      if (!conflictRef.current || !enabledRef.current) {
        return;
      }
      const nextVersion = atVersion ?? conflictDetailRef.current?.serverVersion;
      if (nextVersion !== undefined) {
        // Moving onto the winner's version is what makes the resend land —
        // and it is exactly the overwrite the dialog just warned about, which
        // is why nothing but this call may do it.
        versionRef.current = nextVersion;
      }

      dirtyRef.current = true;
      attemptRef.current = 0;
      adoptedRef.current = null;
      conflictRef.current = false;
      conflictDetailRef.current = null;
      patchState({ message: undefined, conflict: undefined });
      commitRef.current();
    },
    [patchState],
  );

  // ── ⌘/Ctrl+S forces a save (README §24) ───────────────────────────────────
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }
      if (event.key.toLowerCase() !== "s" || !enabledRef.current) {
        return;
      }
      event.preventDefault();
      saveNow();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveNow]);

  return { state, saveNow, retry, resolveWithServer, resolveWithLocal };
}
