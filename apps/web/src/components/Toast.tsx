import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toast: (opts: Omit<Toast, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
};

const ICON_STYLES = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-blue-500',
  warning: 'text-amber-500',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = ICONS[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm max-w-sm w-full animate-in slide-in-from-right',
        STYLES[toast.type],
      )}
    >
      <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', ICON_STYLES[toast.type])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.message && <p className="text-xs opacity-80 mt-0.5">{toast.message}</p>}
      </div>
      <button onClick={() => onDismiss(toast.id)} className="p-0.5 rounded hover:bg-black/5 shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

let idCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = `toast-${++idCounter}`;
    setToasts((prev) => [...prev.slice(-4), { ...opts, id }]); // max 5 toasts
  }, []);

  const value: ToastContextType = {
    toast: addToast,
    success: (title, message) => addToast({ type: 'success', title, message }),
    error: (title, message) => addToast({ type: 'error', title, message }),
    info: (title, message) => addToast({ type: 'info', title, message }),
    warning: (title, message) => addToast({ type: 'warning', title, message }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
