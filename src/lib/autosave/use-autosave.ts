"use client";

/**
 * Autosave engine — README §6.3, §7, §24 and the §25 "Autosave rules".
 *
 * A reusable hook, not a per-screen behaviour: give it the value the user is
 * editing and a `save` callback, and it owns the debounce, the in-flight
 * bookkeeping, the retry backoff, the offline queue and the ⌘/Ctrl+S shortcut.
 *
 * Two invariants come straight from README §7 — "the user must never be
 * uncertain":
 *
 * 1. The hook is **optimistic and non-destructive**. The caller owns `value`;
 *    this hook only ever reads it. A failed save never clears, rewrites or
 *    rolls back what is on screen.
 * 2. Nothing is lost by navigating away. A pending debounce is flushed on
 *    unmount and when the page is hidden or unloaded (`visibilitychange`,
 *    `pagehide`), so switching sections cannot drop a keystroke (README §6.3).
 *
 * There is no persistence import here — no Supabase, no fetch. The `save`
 * callback is injected, which is what makes the hook testable and reusable.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

/** README §7 — the five indicator states. */
export type AutosaveStatus = "idle" | "saving" | "saved" | "failed" | "offline";

export type AutosaveState = {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  /** Edits made since the connection dropped. 0 whenever the app is online. */
  queuedCount: number;
};

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

// ─────────────────────────────────────────────────────────────────────────────
// Offline queue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The seam for README §25 — "Offline: queue in IndexedDB, replay on reconnect,
 * keep the count visible."
 *
 * Phase 1 implements the *count* and the *replay*, in memory: the caller owns
 * the draft, so a queued change is "the latest value has not reached the server
 * yet" plus how many edits were made while the connection was down. That
 * survives a reconnect, which is what the indicator and the sync toast need,
 * but it does not survive a reload.
 *
 * PHASE 2: replace `createMemoryQueue()` with an IndexedDB-backed implementation
 * of this same interface (durable across reloads, replayed on the next visit).
 * Nothing else in the hook has to change — the queue is only ever reached
 * through these three methods. Phase 1 deliberately does not pretend to be
 * durable: there is no localStorage stand-in and no silent data promise.
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
   * Persists one snapshot. Resolving marks the report saved; rejecting puts the
   * indicator in `failed` and the hook keeps retrying with backoff.
   */
  save: (value: T) => Promise<void>;
  /** README §7 — 400ms. */
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
  /** Forces a save now — the header Save button and ⌘/Ctrl+S (README §24). */
  saveNow: () => void;
  /** Retries immediately and resets the backoff — the indicator's "retry". */
  retry: () => void;
}

export function useAutosave<T>({
  value,
  save,
  debounceMs = 400,
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
   * Sends the current value. One patch is in flight at a time: edits made
   * during a flight re-arm the debounce when it resolves.
   */
  const commit = useCallback(() => {
    clearTimer(debounceTimer);
    clearTimer(retryTimer);

    if (!dirtyRef.current || inFlightRef.current) {
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
    patchState({ status: "saving" });

    void saveRef.current(snapshot).then(
      () => {
        inFlightRef.current = false;
        attemptRef.current = 0;
        queueRef.current.clear();
        patchState({ status: "saved", lastSavedAt: new Date(), queuedCount: 0 });
        holdSaved();
        if (dirtyRef.current) {
          scheduleDebounce();
        }
      },
      () => {
        // README §7 — content stays in the editor; the change is still pending.
        inFlightRef.current = false;
        dirtyRef.current = true;
        attemptRef.current += 1;
        patchState(
          isOffline()
            ? { status: "offline", queuedCount: offlineDepth() }
            : { status: "failed" },
        );
        clearTimer(retryTimer);
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null;
          commitRef.current();
        }, backoffDelay(attemptRef.current));
      },
    );
  }, [holdSaved, offlineDepth, patchState, scheduleDebounce]);

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

    if (!enabledRef.current) {
      return;
    }

    dirtyRef.current = true;
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
      // saves, not connectivity (the shell carries the connection pill).
      if (dirtyRef.current) {
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
    commitRef.current();
  }, []);

  const retry = useCallback(() => {
    dirtyRef.current = true;
    attemptRef.current = 0;
    clearTimer(retryTimer);
    commitRef.current();
  }, []);

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

  return { state, saveNow, retry };
}
