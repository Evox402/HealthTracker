import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ToastOptions {
  message: string;
  action?: { label: string; onClick: () => void };
  durationMs?: number;
}

const ToastContext = createContext<(t: ToastOptions) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((t: ToastOptions) => setToast({ ...t, id: Date.now() }), []);

  useEffect(() => {
    if (!toast) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), toast.durationMs ?? 5000);
    return () => clearTimeout(timer.current);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
        {toast && (
          <div
            role="status"
            className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] px-4 py-3 text-[15px] font-semibold shadow-2xl"
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="min-h-10 cursor-pointer px-2 font-extrabold text-[var(--accent-text)]"
                onClick={() => {
                  toast.action!.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
