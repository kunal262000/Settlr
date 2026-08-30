import clsx from 'clsx';
import type { ReconciliationStatus } from '@/lib/types';
import { STATUS_LABEL, STATUS_TONE } from '@/lib/types';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={clsx('rounded-2xl bg-surface border border-border shadow-card', className)}>
      {children}
    </div>
  );
}

export function Button({
  variant = 'primary',
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'teal' }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-navy text-white hover:bg-navy-dark',
    secondary: 'bg-white text-navy border border-border hover:bg-bg',
    ghost: 'text-navy hover:bg-bg',
    teal: 'bg-teal text-white hover:bg-teal/90',
  };
  return (
    <button className={clsx(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function StatusBadge({ status }: { status: ReconciliationStatus }) {
  const tone = STATUS_TONE[status];
  const toneClasses = {
    success: 'bg-success-bg text-success',
    warning: 'bg-warning-bg text-warning',
    error: 'bg-error-bg text-error',
  };
  return (
    <span className={clsx('inline-flex items-center rounded-full px-3 py-1 text-xs font-medium', toneClasses[tone])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning' | 'navy';
}) {
  const toneClasses = {
    default: 'text-ink',
    success: 'text-success',
    warning: 'text-warning',
    navy: 'text-navy',
  };
  return (
    <Card className="p-6">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={clsx('mt-2 text-3xl font-semibold tabular-nums', toneClasses[tone])}>{value}</p>
    </Card>
  );
}

export function formatINR(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}
