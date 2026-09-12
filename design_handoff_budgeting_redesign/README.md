# Handoff: Budgeting App Redesign ("Buku Kas" — Classical/ledger direction)

## Overview
Visual redesign of an existing personal budgeting web app (Next.js + Tailwind + shadcn/ui on Base UI, Recharts, Lucide, Supabase). The redesign replaces the previous default-shadcn "calm savings" blue theme with an editorial, ledger-book aesthetic (Cormorant Garamond + Lora, hairline rules, outlined/stroke-based color instead of filled blocks). Six screens plus empty/error states.

## About the design files
The bundled `Budgeting Redesign.dc.html` is a **design reference built in HTML** — a working, interactive prototype showing intended look, layout, and behavior. It is **not production code to copy in**. The task is to recreate these designs inside the existing codebase's real stack — Next.js App Router pages, Tailwind v4 CSS variables, shadcn/ui components (Card, Button, Input, Label, Select, Dialog), Recharts for the charts, Lucide for icons — following the codebase's existing patterns (server actions in `app/actions/*.ts`, Supabase queries, `lib/format.ts` money helpers, etc.). Open the HTML file in a browser to see it live and interact with it (add/edit/delete transactions, save budget limits, add goal contributions, click through the Import demo).

`classical-styles.css` is included only as a **token reference** (exact hex/spacing/radius/shadow values) — do not link it into the app; port the values into `app/globals.css`'s `:root` block instead.

## Fidelity
**High-fidelity.** Colors, type, spacing, and copy are final. Treat hex values, font choices, and spacing numbers below as source of truth.

## Design direction summary
- **Typography**: Cormorant Garamond (headings/display figures, weight 600, never bold) over Lora (body/prose/table data). No third/mono face — tabular alignment comes from `font-variant-numeric: tabular-nums` on both faces.
- **Color philosophy**: one accent (`#b68235`, warm gold) used only as stroke/outline — never a filled background on cards or buttons. Neutral ink ramp for everything else. Two semantic hues are reserved exclusively for money polarity and never reused decoratively: income `#1baf7a` (text-safe deepened variant `#0d7a56`, 5.3:1 contrast on white) and expense `#2a78d6` (used as-is everywhere, 4.4:1). This pair is colorblind-safe and must not be swapped for green/red.
- **Cards**: bordered (1px `--color-divider`), near-white surface fill `#eae9e9` on a `#f3f2f2` page (barely 2% apart — enough to separate without a "block" look), 4px radius, whisper-soft shadows only on the two dashboard chart cards.
- **Buttons**: outlined, never filled — primary is a gold 1px border + gold text, secondary is a neutral border.
- **Distinctive layout choices** (this is the part most likely to get "simplified back to default" — preserve intentionally):
  - Dashboard KPI numbers are a bare 3-column **stat row** separated by vertical hairlines, not boxed/rounded tiles with icon chips.
  - "Spending by category" is a **numbered ledger list** with dotted leaders between name and amount (like a book's table of contents), each row still carrying a thin 2px intensity bar underneath scaled to the category's share.
  - "Income vs expense" keeps a real grouped bar chart (per explicit product spec) but thin, square-cornered bars — not the rounded-pill default a chart library gives you.
  - Transaction rows are a proper multi-column **register table** (date / description / category tag / amount / actions), not card rows with colored dots.
  - Category chips are **outlined tags** (border + text in the category's color) — never filled dots or filled badges.

## Money formatting — unchanged, do not alter
- IDR only, no decimals ever. Full format `Rp 1.250.000` (id-ID locale, dot thousands separator). Compact chart-axis format stays `250 rb` / `1,5 jt` / `2,4 M` per the existing `lib/format.ts` — the redesign doesn't touch this logic, only the visual container around it.
- Amounts are right-aligned, tabular-nums, and the layout has been stress-tested against `Rp 125.000.000` (9 digits) without breaking — keep that stress test in mind when porting fixed-width columns.

## Screens / views

### 1. Style sheet (documentation only, not a shipped screen)
A living style guide inside the same HTML file (collapsible, default collapsed) documenting type scale, color ramps, spacing, elevation, and the 4 core component treatments (button, field, ledger row, progress states). Reference it for exact values; it is not itself a page to build.

### 2. Dashboard (`/`)
- Layout: page header is a small uppercase kicker ("Dashboard") + large Cormorant h1 showing the month ("September 2026") — the month IS the headline, not a subtitle.
- Stat row: 3 equal columns, dividers as vertical 1px hairlines between them (not around each). Each column: small dot (7px, income/expense/net color) + uppercase kicker label, then a 34px Cormorant Garamond semibold tabular numeral with leading `+`/`−`, colored in the semantic ink.
  - Net uses income-ink teal (`#0d7a56`) when ≥0, brick `#a83e2a` when negative — this is a directional cue distinct from the income/expense pair, not a reuse of green/red.
- Below a hairline: 2-column section (roughly 1.1fr / 1fr):
  - Left: "Income vs expense — six months" grouped bar chart. Two 15px-wide square-cornered bars per month (income aqua, expense blue), baseline hairline, month labels below, small swatch legend.
  - Right: "Spending by category" — numbered list (01, 02…), category name, dotted leader (`border-bottom: 1px dotted`), right-aligned tabular amount, thin 2px colored intensity bar beneath each row scaled to its share of the top category.
- Empty state: centered, 52px outlined circle with a book-open icon, one line of copy, primary "Add your first transaction" button.

### 3. Transactions (`/transactions`) — most-used screen
- Two columns: 340px "New entry" form card (left) + register card (right, flexible width).
- Form: segmented Expense/Income control (native radios styled as a pill toggle), Amount field with **quick-amount chips** below it (Rp 15.000 / 50.000 / 100.000 / 250.000 — tap to fill), Category **dropdown** (filtered to the selected kind's categories), Date, Note. Amount field autofocuses on load; Enter key in Amount or Note submits the form; after adding, focus returns to Amount so several entries can be logged back-to-back without touching the mouse.
- Register: header row (Date/Description/Category/Amount, uppercase tracked 10.5px) then rows in a `92px / 1fr / 150px / 130px / 66px` grid — Date, Description (ellipsizes if needed), Category as an outlined tag colored per category, Amount (tabular, colored ink, sign), Edit (pencil) + Delete (trash) icon buttons. List scrolls internally past ~9 rows with a "Load more" control revealing more (footer count reads "showing X of Y").
- Edit action opens a real modal dialog (shadcn Dialog) with Description/Amount/Category(dropdown)/Date fields, Cancel/Save. Delete removes the row immediately with an undo-less confirmation toast (consider whether production wants a confirm step — the mock does not add one).
- Every add/edit/delete surfaces a bottom-right toast (aria-live polite region), auto-dismissing after ~2.8s.

### 4. Budgets (`/budgets`)
- Page title + "Monthly spending limits for September 2026" subtitle.
- One card: an "Overall" line (kicker + "Rp spent of Rp budgeted", colored to worst status) with a thin 4px overall progress hairline, plus a one-line summary ("N categories over budget" / "All categories within budget").
- Rows in a `130px / 1fr / 220px / 210px` grid: category name, thin 4px progress bar, a **text status label** (Under/Near/Over/No limit, not just color) + spent/limit tabular amount, and an inline limit input + Save button.
- Status thresholds: <80% = Under (income-ink teal), 80–99% = Near (accent gold), ≥100% = Over (brick `#a83e2a`). Categories with no limit set still list with spent-only text and an empty, fillable limit field.

### 5. Goals (`/goals`)
- Two columns: 320px "New savings goal" form (Name, Target amount, optional Target date, Create) + a 2-per-row grid of goal cards.
- Goal card: name + delete (×) top row; saved amount (large, Cormorant, tabular) and "of {target}" on one line (both spans `white-space:nowrap`, the row itself `flex-wrap:wrap` so it drops to two lines as a whole rather than breaking a number mid-digit — important for large targets like `Rp 20.000.000`); thin 3px progress bar (gold while in progress, income-ink teal once reached); status line ("Rp X to go" / "Goal reached."); a contribution input + Add button that increments saved (clamped at target) and re-renders the bar live.

### 6. Recurring (`/recurring`)
- Two columns: 340px "New recurring item" form (Expense/Income segmented, Description, Amount, Category, Cadence, Starts-on date, Create) + a list ordered by next run date.
- List rows in a `1fr / 130px / 130px / 110px / 130px / 60px` grid: Description, Category (outlined tag), Amount (tabular, signed, colored), Cadence, Next run date (tabular), Stop (octagon-x icon button) — stopping removes the item with a toast.

### 7. Import (`/import`)
- Single card area, four states as a real state machine (not just static mocks): **Idle** (dashed-border dropzone, upload-cloud icon, "Browse files" + a "Simulate a parse error" link for demoing the error path) → **Extracting** (spinning loader, "Reading statement.pdf… this can take up to a minute") → **Review** (editable table: Date / Description / Amount / Kind tag / Category dropdown / Remove-row button; one row is flagged "Low confidence — check this one" to demonstrate the AI-suggestion-confidence pattern) → back to **Idle** on Import or Start Over, or **Error** (outlined alert-triangle, message, "Try another file" returns to Idle).

### Cross-cutting: Error card
Centered card: 52px outlined circle with alert-triangle (brick ink), "Something went wrong" title, "We can't reach your data right now…" body (no internals exposed), primary "Try again" button that runs a ~1.2s retry cycle (disables to "Retrying…") and toasts "Connection restored" on completion. Use this pattern for any Supabase/database-unreachable state across the app.

## Interactions & behavior (already prototyped — recreate the logic, not just the look)
- **Toasts**: bottom-right stack, outlined card with a 3px colored left border (teal for success, brick for destructive), auto-dismiss ~2.8s, `role="status" aria-live="polite"` container.
- **Dialog**: opens on Edit, closes on Cancel/Save/Escape key/click on backdrop (not on click inside the dialog — stop propagation), labelled via `aria-labelledby`.
- **Focus**: Amount field autofocuses on the Transactions page and after every successful add; all interactive elements are native `<button>`/`<input>`/`<select>` so keyboard tab order and `:focus-visible` (2px accent outline per the design system) work without extra ARIA.
- **Responsive collapse** (mobile is "good enough to open," not a separate design):
  - All two-column form+list/grid screens (Transactions, Goals, Recurring) stack to one column under ~760px.
  - The 3-column stat row stacks to one column under ~760px; vertical dividers become horizontal top-borders.
  - The dashboard's chart+category 2-column section stacks under ~760px.
  - Fixed-column grids (register, budgets rows, recurring rows, import review) get `overflow-x:auto` on their own container with a `min-width` floor, so they scroll internally rather than breaking page layout on very narrow viewports.
  - Nav bar wraps (`flex-wrap`) rather than overflowing.

## State management (as prototyped, per screen)
- Transactions: full list in state (mutable — add prepends, edit updates by index, delete filters by index); a separate `visibleCount` drives "Load more" pagination over the full list.
- Budgets: array of `{name, spent, limit, draft}` — `draft` is the uncommitted input value, committed to `limit` on Save.
- Goals: array of `{name, target, saved, draft}` — `draft` is the uncommitted contribution amount, added to `saved` (clamped at `target`) on Add.
- Recurring: array of items, `Stop` filters the item out.
- Import: a single state machine value (`idle | extracting | review | error`), plus the review rows array (category is editable per row).
- Global: `toasts` array (each `{id, type, msg}`, self-removing via timeout), `dialogTx` (the transaction currently being edited, or null).

## Design tokens
| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#f3f2f2` | page background |
| `--color-surface` | `#eae9e9` | card fill |
| `--color-text` | `#201f1d` | ink |
| `--color-divider` | `color-mix(in srgb, #201f1d 16%, transparent)` | hairlines, borders |
| `--color-accent` | `#b68235` | stroke-only accent (buttons, icons, kickers) |
| `--color-accent-700` | `#7d5411` | accent used AS text (kickers, "01" numerals) — passes contrast where the base accent doesn't |
| income | `#1baf7a` (marks) / `#0d7a56` (text) | income dot/bar/line + deepened text variant |
| expense | `#2a78d6` | expense everywhere, incl. text |
| negative ink | `#a83e2a` | over-budget, errors, delete affordances |
| Category marks (expense) | Food & Drink `#a1584a`, Shopping `#8a7a3d`, Bills `#55716f`, Transport `#6b7a8f`, Entertainment `#6c5b7d`, Other `#7d7979`, Health `#96586a` | outlined category tags |
| Category marks (income) | reuse `#0d7a56` for Salary/Bonus/Other Income | keeps income legible everywhere |
| `--radius-md` | 4px | all corners |
| `--shadow-sm/md/lg` | see `classical-styles.css` `:root` | dashboard chart cards + dialog only — most surfaces are flat |
| Font — heading | Cormorant Garamond, weight 600 max | h1–h6, big tabular figures |
| Font — body | Lora | prose, table cells, labels |
| Spacing | ~4.6/9.2/13.8/18.4/27.6/36.8px (see style sheet) | outer/section spacing; table/list rows are intentionally tighter than this scale |

Full ramps (neutral 100–900, accent 100–900) are in `classical-styles.css` and in the in-file style sheet section.

## Assets
- Icons: Lucide (loaded via CDN UMD build in the prototype — in the app, use the existing `lucide-react` package already in `package.json`). Icons used: `trending-up`, `trending-down`, `wallet`, `book-open`, `pencil`, `trash-2`, `plus`, `upload-cloud`, `loader-2`, `alert-triangle`, `x`, `octagon-x`.
- Fonts: Cormorant Garamond (400/600) and Lora (400/600, italic 400) via Google Fonts — already specified in `classical-styles.css`'s `@import`.
- No photography/illustration in this redesign.

## Files
- `Budgeting Redesign.dc.html` — the full interactive design reference (style sheet + all 6 screens + empty/error states). Open directly in a browser.
- `classical-styles.css` — token reference only (colors/type/spacing/radius/shadow source values + the `.card`/`.btn`/`.field`/`.tag`/`.nav`/`.table`/`.dialog` reference classes the prototype's markup is patterned after). Do not link this file into the app — port the values into the existing Tailwind/shadcn theme setup (`app/globals.css` CSS variables).

## Source codebase reference (for context, not to be copied verbatim)
This redesign targets `SatriaMs15/Project_Budgeting` (Next.js App Router + Tailwind v4 + shadcn/ui on Base UI + Recharts + Lucide + Supabase). Existing files whose visual treatment this redesign replaces: `app/globals.css` (theme tokens), `app/page.tsx` (Dashboard), `app/transactions/page.tsx` + `components/transaction-form.tsx` + `components/transaction-list.tsx` + `components/edit-transaction-dialog.tsx`, `app/budgets/page.tsx` + `components/budget-row.tsx`, `app/goals/page.tsx` + `components/goal-card.tsx` + `components/add-goal-form.tsx`, `app/recurring/page.tsx` + `components/recurring-list.tsx` + `components/add-recurring-form.tsx`, `app/import/page.tsx` + `components/import-form.tsx` + `components/import-review.tsx`, `components/nav-links.tsx`, `lib/format.ts` (formatting logic — unchanged), `lib/chart-colors.ts` (income/expense hex — unchanged), `lib/categories.ts` (category list — color values are the one thing this redesign changes, see table above).
