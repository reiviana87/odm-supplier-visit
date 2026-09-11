"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils/cn";
import { Icon } from "./icon";

/**
 * Toast — README §4.
 *
 * Bottom-centre, accent-900 ground, #fff 12.5px text, padding 9px 14px,
 * shadow-lg, auto-dismiss ~2.5s. Never blocks input. Failures are announced
 * assertively, everything else politely (README §24).
 */
export type ToastKind = "info" | "warning" | "error";

export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

interface ToastContextValue {
  toast: (text: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 2500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (text: string, kind: ToastKind = "info") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, text, kind }]);
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  // Clear any pending timers if the provider unmounts mid-flight.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return context;
}

const KIND_STYLE: Record<ToastKind, { background: string; color: string }> = {
  info: { background: "var(--color-accent-900)", color: "#fff" },
  warning: { background: "var(--color-warning-bg)", color: "var(--color-warning-ink)" },
  error: { background: "var(--color-danger-ink)", color: "#fff" },
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[200] flex flex-col items-center gap-2"
      aria-live="polite"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role={item.kind === "error" ? "alert" : "status"}
          aria-live={item.kind === "error" ? "assertive" : "polite"}
          className={cn(
            "elev-lg pointer-events-auto flex items-center gap-2.5 px-3.5 py-[9px] text-[12.5px] anim-rise-fast",
          )}
          style={KIND_STYLE[item.kind]}
        >
          {item.kind !== "info" ? <Icon name="alert" size={13} /> : null}
          <span>{item.text}</span>
          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            aria-label="Dismiss notification"
            title="Dismiss notification"
            className="ml-1 cursor-pointer border-0 bg-transparent p-0 opacity-60 hover:opacity-100"
            style={{ color: "inherit" }}
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
