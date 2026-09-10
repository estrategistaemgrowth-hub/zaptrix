interface QuotaBarProps {
  /** e.g. "Mensagens hoje", "Entradas na base de conhecimento" */
  label: string;
  current: number;
  /** Configured cap. 0 / null / undefined renders an "unlimited" state instead of a bar. */
  max?: number | null;
  hint?: string;
  className?: string;
}

/**
 * Gradient usage/quota bar — rounded gray track, brand-gradient fill,
 * "current de max" label on the right. Mirrors the "Cotas de uso" pattern
 * referenced from the clickmax design system (structure only; the fill is
 * always the Zaptrix blue gradient, never the reference's neon lime).
 */
export function QuotaBar({ label, current, max, hint, className = '' }: QuotaBarProps) {
  const hasLimit = typeof max === 'number' && max > 0;
  const pct = hasLimit ? Math.min(1, Math.max(0, current / max)) : 0;
  const isOverLimit = hasLimit && current > (max as number);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 mb-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">
          {hasLimit ? (
            <span className="whitespace-nowrap">
              {current.toLocaleString('pt-BR')}{' '}
              <span className="text-muted-foreground font-normal">de</span>{' '}
              {(max as number).toLocaleString('pt-BR')}
            </span>
          ) : (
            <span className="text-muted-foreground font-normal">sem limite configurado</span>
          )}
        </p>
      </div>
      {hasLimit && (
        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`quota-fill h-full w-full rounded-full origin-left ${
              isOverLimit ? 'bg-destructive' : 'gradient-brand'
            }`}
            style={{ transform: `scaleX(${isOverLimit ? 1 : pct})` }}
          />
        </div>
      )}
      {hint && <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>}
    </div>
  );
}
