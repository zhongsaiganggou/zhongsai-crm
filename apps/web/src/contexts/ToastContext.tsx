import { CheckCircle2, CircleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ToastKind = 'success' | 'error';
interface Toast { id: number; message: string; kind: ToastKind }

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now();
    setToasts((items) => [...items, { id, message, kind }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3200);
  }, []);
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed inset-x-4 top-4 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:w-96" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="flex w-full items-center gap-3 rounded-lg border border-line bg-white px-4 py-3 shadow-card">
            {toast.kind === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <CircleAlert className="h-5 w-5 text-red-600" />}
            <span className="flex-1 text-sm font-medium text-ink">{toast.message}</span>
            <button aria-label="关闭提示" className="min-h-0 p-1 text-muted" onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

