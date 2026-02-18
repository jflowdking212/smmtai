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
