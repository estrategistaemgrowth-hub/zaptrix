import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface BannerCardProps {
  /** Small pill top-left, e.g. a date or period ("09 Set 2026"). */
  badge?: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  icon?: LucideIcon;
  className?: string;
}

/**
 * Dark gradient highlight/banner card — the deliberate exception to the
 * light dashboard background. Structurally modeled on the clickmax
 * reference (title + subtitle + CTA + date badge), always rendered in the
 * Zaptrix deep-blue-to-cyan gradient — never the reference's neon lime.
 * Use sparingly (one per screen) as a top-of-page highlight, never as the
 * default card style.
 */
export function BannerCard({ badge, title, subtitle, ctaLabel, ctaHref, icon: Icon, className = '' }: BannerCardProps) {
  return (
    <div className={`banner-card-surface relative overflow-hidden rounded-2xl p-8 text-white shadow-lg ${className}`}>
      <div className="relative z-10 max-w-xl">
        {badge && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-white/80 mb-4">
            {badge}
          </span>
        )}
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2.5">
          {Icon && <Icon className="w-6 h-6 text-cyan-300 flex-shrink-0" />}
          {title}
        </h2>
        <p className="text-white/70 mb-6 leading-relaxed">{subtitle}</p>
        <Link
          href={ctaHref}
          className="banner-cta inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white text-[#0f2a5c] text-sm font-semibold"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
