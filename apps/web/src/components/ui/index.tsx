import React from 'react';
import { cn } from '@/lib/utils';

// ============================================================
// Button
// ============================================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98]';

  const variants = {
    primary: 'bg-brand-500 text-white hover:bg-brand-700 focus:ring-brand-500 shadow-sm',
    secondary:
      'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 focus:ring-brand-500',
    ghost: 'text-neutral-600 hover:bg-neutral-100 focus:ring-brand-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };

  const sizes = {
    sm: 'text-sm px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-6 py-3 gap-2',
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], (disabled || loading) && 'opacity-50 cursor-not-allowed', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

// ============================================================
// Card
// ============================================================

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ hover = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-neutral-200/60 shadow-sm',
        hover && 'hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================
// Input
// ============================================================

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-neutral-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-neutral-800',
          'placeholder:text-neutral-400 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
          'transition-all duration-200',
          error && 'border-red-500 focus:ring-red-500/20 focus:border-red-500',
          className,
        )}
        {...props}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// ============================================================
// Badge
// ============================================================

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'brand';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  const variants = {
    default: 'bg-neutral-100 text-neutral-600',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    brand: 'bg-brand-50 text-brand-700',
  };

  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
}

// ============================================================
// Avatar
// ============================================================

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  if (src) {
    return <img src={src} alt={name} className={cn('rounded-full object-cover', sizes[size], className)} />;
  }

  return (
    <div className={cn('rounded-full bg-brand-100 text-brand-700 font-semibold flex items-center justify-center', sizes[size], className)}>
      {initials}
    </div>
  );
}

// ============================================================
// Skeleton
// ============================================================

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, variant = 'text', width, height }: SkeletonProps) {
  const variants = {
    text: 'h-4 rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  };

  return (
    <div
      className={cn('animate-pulse bg-neutral-200', variants[variant], className)}
      style={{ width, height }}
    />
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white rounded-2xl border border-neutral-200/60 shadow-sm p-6', className)}>
      <Skeleton variant="text" className="w-1/3 h-4 mb-3" />
      <Skeleton variant="text" className="w-full h-3 mb-2" />
      <Skeleton variant="text" className="w-2/3 h-3" />
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <Skeleton variant="text" className="w-24 h-3" />
        <Skeleton variant="circular" className="w-8 h-8" />
      </div>
      <Skeleton variant="text" className="w-16 h-7 mb-1" />
      <Skeleton variant="text" className="w-12 h-3" />
    </div>
  );
}

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

export function CardHeader({ className, children }: any) { return <div className={cn('p-6 pb-0', className)}>{children}</div>; }
export function CardTitle({ className, children }: any) { return <h3 className={cn('font-semibold leading-none tracking-tight', className)}>{children}</h3>; }
export function CardContent({ className, children }: any) { return <div className={cn('p-6', className)}>{children}</div>; }
export function CardFooter({ className, children }: any) { return <div className={cn('flex items-center p-6 pt-0', className)}>{children}</div>; }
