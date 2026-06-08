import os

filepath = r"apps\web\src\components\ui\index.tsx"

ui_additions = """
// ============================================================
// Textarea
// ============================================================
export function Textarea({ className, ...props }: any) {
  return <textarea className={cn('w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-brand-500', className)} {...props} />;
}

// ============================================================
// Checkbox
// ============================================================
export function Checkbox({ className, ...props }: any) {
  return <input type="checkbox" className={cn('rounded border-neutral-300 text-brand-600 focus:ring-brand-500', className)} {...props} />;
}

// ============================================================
// Dialog
// ============================================================
export function Dialog({ open, onOpenChange, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden relative">
        <button onClick={() => onOpenChange(false)} className="absolute top-4 right-4 text-gray-500 hover:text-black">X</button>
        {children}
      </div>
    </div>
  );
}
export function DialogContent({ children, className }: any) {
  return <div className={cn('p-6', className)}>{children}</div>;
}
export function DialogHeader({ children }: any) {
  return <div className="mb-4">{children}</div>;
}
export function DialogTitle({ children }: any) {
  return <h2 className="text-xl font-bold">{children}</h2>;
}
export function DialogFooter({ children }: any) {
  return <div className="mt-6 flex justify-end gap-2">{children}</div>;
}

// ============================================================
// Tabs
// ============================================================
import { createContext, useContext, useState as useReactState } from 'react';
const TabsContext = createContext<any>(null);

export function Tabs({ defaultValue, value, onValueChange, children, className }: any) {
  const [active, setActive] = useReactState(value || defaultValue);
  const currentValue = value || active;
  const setValue = onValueChange || setActive;
  return <TabsContext.Provider value={{ active: currentValue, setActive: setValue }}><div className={className}>{children}</div></TabsContext.Provider>;
}
export function TabsList({ children, className }: any) {
  return <div className={cn('flex space-x-2 border-b border-gray-200 mb-4', className)}>{children}</div>;
}
export function TabsTrigger({ value, children, className }: any) {
  const { active, setActive } = useContext(TabsContext);
  const isActive = active === value;
  return (
    <button onClick={() => setActive(value)} className={cn('px-4 py-2 font-medium border-b-2 transition-colors', isActive ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700', className)}>
      {children}
    </button>
  );
}
export function TabsContent({ value, children, className }: any) {
  const { active } = useContext(TabsContext);
  if (active !== value) return null;
  return <div className={className}>{children}</div>;
}

// ============================================================
// Select
// ============================================================
export function Select({ value, onValueChange, children }: any) {
  return <div className="relative" data-value={value} onChange={(e: any) => onValueChange(e.target.value)}>{children}</div>;
}
export function SelectTrigger({ children, className }: any) {
  return <select className={cn('w-full px-4 py-2.5 rounded-xl border border-neutral-200', className)}>{children}</select>;
}
export function SelectValue({ placeholder }: any) {
  return <option value="" disabled>{placeholder}</option>;
}
export function SelectContent({ children }: any) {
  return <>{children}</>;
}
export function SelectItem({ value, children }: any) {
  return <option value={value}>{children}</option>;
}
"""

with open(filepath, 'a', encoding='utf-8') as f:
    f.write(ui_additions)
