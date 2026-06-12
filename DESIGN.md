# Design

## Overview

Beat the S&P 500 is a Vue 3 SPA styled with Tailwind CSS v4 and DaisyUI v5. The visual system is currently DaisyUI's stock `light` (default) and `dark` themes — no custom palette has been defined — with Inter as the only typographic override. The app boots `dark` (`<html data-theme="dark">`). This document captures the system as built; re-run `/impeccable document` after any token changes.

> Note: the palette is presently stock DaisyUI. Per PRODUCT.md ("playful + competitive", "make the benchmark visceral", avoid generic SaaS look), a custom DaisyUI theme is a strong near-term improvement — see `/impeccable colorize`.

## Theme

- **Mode:** Dark-first (`data-theme="dark"` on `<html>`); DaisyUI `light` available as default fallback.
- **Surfaces:** `base-100` (cards/elevated), `base-200` (app background), `base-300` (borders/dividers).
- **Text:** `base-content` with opacity scale for hierarchy — `/100` primary, `/60` secondary, `/50`–`/40` tertiary/muted.

## Color

Stock DaisyUI semantic tokens (not yet customized):

- **primary** — brand/active accent (active nav, selected toggle, key stats). Used as `text-primary`, `btn-primary`, `bg-primary/10`.
- **error** — alerts, loss/negative states (`alert-error`).
- **success / warning / info** — available, used for status.
- **base-100 / 200 / 300** — surface ramp.
- **base-content** — foreground, with `/opacity` for de-emphasis.

**Gain/loss & benchmark cues:** must not rely on red/green alone (WCAG AA, color-blind). Pair color with sign (+/−), arrows, or labels.

## Typography

- **Family:** `Inter` (weights 400/500/600/700/900), `system-ui` fallback. Set via `--font-sans` in `@theme`.
- **Scale (observed):** `text-xl font-bold` section titles, `text-sm` body, `text-xs`/`text-[10px]` metadata and labels.
- **Treatments:** `uppercase tracking-wider` for stat/section labels; `font-bold` for emphasis and numbers.

## Components

DaisyUI component classes throughout:

- **Buttons:** `btn`, `btn-sm`; `btn-primary` (active/selected) vs `btn-ghost` (inactive) for segmented toggles (fund/aggregate, metric switchers).
- **Cards:** `card bg-base-100 shadow-sm border border-base-300`; `card-body` (often `p-0` for custom internal layout). Left rail accent via `bg-primary/10` + `border-r`.
- **Alerts:** `alert alert-error`.
- **Loading:** `loading loading-spinner loading-lg`, `loading loading-dots loading-xs`.
- **Tables / scroll:** horizontal scroll containers (`overflow-x-auto -mx-4 px-4`, `whitespace-nowrap`) for metric/leaderboard rows on mobile.

## Layout

- **Spacing rhythm:** `p-4` page padding, `space-y-6` vertical stacks, `gap-2` inline groups.
- **App shell:** role-based layouts — `AppLayout` (student), `TeacherLayout`, `AdminLayout`, `AuthLayout`.
- **Responsive:** mobile-aware via horizontal-scroll rows and negative-margin bleed; verify breakpoints per view.

## Motion

No motion system defined yet. PRODUCT.md calls for celebratory feedback on wins/leaderboard with `prefers-reduced-motion` respected — see `/impeccable animate` / `/impeccable delight`.
