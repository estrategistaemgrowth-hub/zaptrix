# Product

## Register

product

## Users

Small/medium business owners and their sales teams who use WhatsApp as their main sales channel. They live in this dashboard all day: watching live conversations (Atendimento), managing a product catalog, training an AI sales agent (Conhecimento, IA), and connecting/monitoring their WhatsApp number (Evolution API). Context is fast-paced, often multitasking between chat and admin screens — clarity and low friction matter more than decoration.

## Product Purpose

Zaptrix is a SaaS that automates WhatsApp sales with an AI agent: it ingests a product catalog and knowledge base, talks to leads on WhatsApp, and hands off to a human when needed. Success looks like an operator trusting the dashboard enough to leave the AI running unattended, and being able to glance at any screen and immediately know what needs attention (unread messages, out-of-stock products, disconnected WhatsApp).

## Brand Personality

Confident, modern, technical-but-approachable. Three words: **precise, trustworthy, energetic**. The brand mark is a stylized lightning-bolt "Z" in a cyan-to-royal-blue gradient (`#22D3EE` → `#3B82F6` → `#1D4ED8`) — this gradient is the one deliberate moment of visual energy the product allows itself; everywhere else stays calm and solid so the gradient keeps its meaning as "this matters."

## Anti-references

No purple, green, or off-brand hues introduced anywhere. No generic gray icon badges (the four-metric-card SaaS cliché is allowed only if the icon badges are tinted, not gray). No side-stripe borders as a rule — the one deliberate exception already agreed with the product owner is a left accent bar on out-of-stock / attention-needed rows, modeled after premium fintech/HR table patterns (e.g. "Rejected"/"Overdue" rows), used sparingly and only for that one alert meaning. No emoji as UI elements. No bouncy/elastic easing.

## Design Principles

1. **Identity preservation over reinvention** — existing tokens (`--primary #2563eb`, `--background #f0f4fa`, card/border system) are load-bearing brand decisions already made; extend them, never replace them.
2. **The gradient is a spotlight, not wallpaper** — the brand's cyan-to-blue gradient appears once or twice per screen, on the single most important element (a header accent, an "AI active" badge, the primary CTA), never as a background wash.
3. **Status is legible at a glance** — unread counts, online/offline dots, low-stock/attention rows must be readable without reading text, using color + shape (not gray-on-gray).
4. **Motion explains state change, not decoration** — fades and hovers confirm something happened (loaded, hovered, opened); nothing animates just to animate, and everything respects `prefers-reduced-motion`.
5. **Never a dead end** — every empty/loading state gives the user an icon, a two-layer message (what + why), and, when there's an action, a button to take it.

## Accessibility & Inclusion

No explicit WCAG target given; default to WCAG 2.1 AA as a baseline (4.5:1 body text contrast, visible focus states, `prefers-reduced-motion` alternatives for all new animation, no color-only status signaling — pair color dots/badges with an icon or text where feasible).
