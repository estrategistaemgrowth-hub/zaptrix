# Design

Captured from the existing codebase (`app/globals.css`, `components/`, `app/(dashboard)/**`). Zaptrix uses Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase.

## Color

- Brand gradient (signature, 1-2 deliberate accents per screen, never a background wash):
  `linear-gradient(to bottom right, #22d3ee, #3b82f6, #1d4ed8)` — exposed as `.gradient-brand` and baked into `.btn-gradient`.
- Core tokens (`:root` in `app/globals.css`): `--primary: #2563eb`, `--secondary: #1d4ed8`, `--tertiary: #7dd3fc`, `--accent: #2563eb`, `--ring: #2563eb`.
- Surfaces: light background `--background: #f0f4fa`, `--card: #ffffff`, `--border: #e2e8f0`, `--muted: #f1f5f9`. Dark-mode variant exists (`prefers-color-scheme` + `[data-theme]`) but the dashboard's default working mode is light — dark cards are the deliberate exception (banner/highlight card), not the norm.
- Semantic: `--success: #0c7a3a`, `--warning: #9b5a00`, `--destructive: #d01d1c`, `--info: #2563eb`.
- Chart palette: `--chart-1..5` (`#2563eb`, `#22d3ee`, `#7dd3fc`, `#9b5a00`, `#9b5a00`).
- Anti-reference: no lime/neon-green, no purple as brand color, no pure-black shadows (use brand-blue at low opacity instead).

## Typography

- `--font-sans` / `--font-mono`: Arial fallback stack (project doesn't load a custom webfont yet).

## Radii & Motion

- Radius scale: `--radius-sm: 12px`, `--radius-md: 24px`, `--radius-lg: 32px`, `--radius-xl: 48px`. Pills (`rounded-full`) reserved for CTAs/badges.
- Duration scale: `--duration-faster: 150ms`, `--duration-gentle: 350ms`, `--duration-slow: 650ms`.
- Existing keyframes: `fadeIn` (opacity + translateY, used as `.animate-fade-in` on section wrappers — **contains a transform, so any `position: fixed` descendant gets trapped in its containing block; portal fixed overlays to `document.body`**), `modalIn` (scale + translateY, `.animate-modal-in`), `backdropIn` (`.animate-backdrop-in`), `spinSlow` (`.animate-spin-slow`), `qrScan` (`.animate-qr-scan`). All guarded with `@media (prefers-reduced-motion: reduce)` — keep that pattern for every new animation.

## Components

- **Primary CTA** — `.btn-gradient`: pill-shaped, brand gradient fill, `box-shadow` glow that intensifies on hover, `filter: brightness(1.05)` on hover, `scale(0.98)` on active, disabled state at `opacity: 0.6`. This is the system's signature action button.
- **Modals with `position: fixed`** — always rendered via `createPortal(..., document.body)` (see `components/whatsapp-qr-modal.tsx`, `components/product-detail-modal.tsx`, and the inline member-edit modal in `app/(dashboard)/configuracoes/page.tsx`). Never rely on plain `position: fixed` inside page JSX.
- **Sidebar** (`components/sidebar.tsx`), **skeleton loaders** (`components/skeleton.tsx`), **sparkline** (`components/sparkline.tsx`) already ship a first polish pass (gradient icon mark, loading skeletons).
- Badges for status (e.g. "IA ativa", "Conectado") exist in `ia/page.tsx` and `produtos/page.tsx` with partial gradient treatment — candidate for standardization sitewide.

## Layout

- Dashboard shell: `app/(dashboard)/layout.tsx` + `components/sidebar.tsx`, section pages under `app/(dashboard)/{dashboard,produtos,contatos,atendimento,conhecimento,ia,configuracoes}/page.tsx`.
- Cards are the dominant surface pattern (product cards, contact cards, conversation cards, settings cards) on a light `--background`.

## Known rough edges (feeding the current polish pass)

- Some primary buttons may still use the pre-`.btn-gradient` pattern (`bg-primary text-white rounded-lg`/`rounded-xl` + `hover:opacity-90`) instead of the pill gradient.
- Quota/limit values (base de conhecimento entry limit, WhatsApp `min_delay_seconds`/`max_delay_seconds`/`daily_message_limit`) render as plain text, no visual progress affordance.
- No reusable dark gradient "banner/highlight" card component yet.
- Card hover states are mostly flat/neutral — no brand-colored glow or scale.
- Status badges are inconsistent across sections (some gradient, some flat pill).
