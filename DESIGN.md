# Design

## Theme

Light-first product surface. Background is a cool near-white (`--background: #f0f4fa`), cards are pure white (`--card: #ffffff`) with a 1px `--border` (`#e2e8f0`) and `shadow-sm` — never both a heavy border and a heavy shadow. Dark mode exists via `prefers-color-scheme`/`[data-theme]` but is not the design target of this pass.

## Color

- `--primary #2563eb` / `--secondary #1d4ed8` — solid, used for primary buttons, active nav state, focus rings.
- `--tertiary #7dd3fc` — light accent, sparingly.
- Brand gradient (new, from the logo): cyan `#22D3EE` → blue `#3B82F6` → royal `#1D4ED8`, `to bottom right`. Reserved for 1-2 deliberate accents per screen (see `.gradient-brand` utility).
- `--destructive #d01d1c` — errors, out-of-stock, attention rows.
- `--success #0c7a3a`, `--warning #9b5a00`, `--info #2563eb` — semantic text/icon tints only, never raw Tailwind `green-500` etc.
- Metric-card icon badges use tinted pastels (`bg-blue-100`/`text-blue-600`, `bg-emerald-100`/`text-emerald-600`, `bg-amber-100`/`text-amber-600`) — keep this pattern, it's already correct (not the gray-badge cliché).

## Typography

`--font-sans: Arial, sans-serif` system-wide (no font pairing in this app; do not introduce a second family). Hierarchy is carried by size/weight: `text-3xl font-bold` page titles, `text-lg font-semibold` section headers, `text-sm` body/labels, `text-xs text-muted-foreground` hints.

## Components

- **Cards**: `bg-card border border-border rounded-2xl shadow-sm`, padding `p-6`/`p-8`.
- **Buttons (primary)**: `bg-primary text-white rounded-lg` or `rounded-xl`, hover darkens toward `--secondary`.
- **Sidebar**: floating panel, `rounded-2xl shadow-sm`, collapsible, persisted via localStorage.
- **Icon badges**: `w-9 h-9 rounded-xl` tinted background + tinted icon, per metric card.
- **Skeletons** (new): `bg-muted animate-pulse rounded-xl` block, replacing bare "Carregando..." text.
- **Status dots** (new): small `absolute` circle, `bg-emerald-500` (online/read) or `bg-red-500` with count (unread), `ring-2 ring-card` so it reads over an avatar.

## Motion

- `transition-all duration-200` for hover states on clickable cards/rows (shadow + subtle `scale-[1.02]`).
- `.animate-fade-in` keyframe utility (new, in `globals.css`) for content mount-in; guarded by `prefers-reduced-motion`.
- Typing indicator: 3-dot pulse, staggered `animation-delay`.
- Modal entrance: fade + scale (`.animate-modal-in`), no slide, no bounce.

## Layout

Dashboard content area is `p-2` wrapped page content; grids use `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` for metric rows. Tables/lists prefer full-width rows over nested cards.
