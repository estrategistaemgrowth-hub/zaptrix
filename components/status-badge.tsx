import type { LucideIcon } from 'lucide-react';

interface StatusBadgeProps {
  label: string;
  icon?: LucideIcon;
  /** true = brand gradient pill (the positive/active state). false = flat pill in `tone`. */
  active?: boolean;
  /** Color of the flat (non-active) pill. Ignored when `active` is true. */
  tone?: 'neutral' | 'warning' | 'destructive';
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<StatusBadgeProps['tone']>, string> = {
  neutral: 'bg-muted text-muted-foreground',
  warning: 'bg-amber-100 text-amber-700',
  destructive: 'bg-destructive/10 text-destructive',
};

/**
 * Standardized status pill for positive/active states (e.g. "IA ativa",
 * "Conectado"): brand gradient + white text when `active`, a flat tone pill
 * otherwise. Reuses `.gradient-brand` from globals.css — no parallel color
 * system.
 */
export function StatusBadge({ label, icon: Icon, active = true, tone = 'neutral', className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
        active ? 'gradient-brand text-white shadow-sm' : TONE_CLASSES[tone]
      } ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </span>
  );
}
