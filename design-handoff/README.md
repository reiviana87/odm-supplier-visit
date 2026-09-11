# Handoff: ODM Supplier Visit — EBARA Global Sourcing Office

## Overview

A desktop web application for EBARA's Global Sourcing Office (GSO) that turns a factory
visit into a corporate DOCX visit report. A visit report is a 13-section document
(`GSO-YYMMNNNxNN`) built from typed content, AI drafts derived from a Plaud voice
transcript, supplier master data, certificates and up to ~50 photographs laid out in a
Word appendix. A secondary **Visit Mode** is used on a phone inside the factory to capture
photos, notes and observations that sync into the report.

Primary user: the sourcing engineer who runs the visit and writes the report.
Secondary: the manager who reviews it, and colleagues who read past reports.

## About the design files

The files in this bundle are **design references created in HTML** — working prototypes
that show the intended look, layout and behaviour. They are **not production code to copy**.
The task is to recreate these designs in the target codebase's own environment (React,
Next.js, Vue, etc.) with its established patterns; if no codebase exists yet, pick a
framework (React + TypeScript + a router + Supabase is the assumed stack in these notes)
and implement the designs there.

`ODM Supplier Visit.dc.html` is a single-file prototype: one component class holding all
routes, all state and all screens. **Do not mirror that structure.** Split it into routes
and components as described in §25.

## Fidelity

**High fidelity.** Colours, typography, spacing, component anatomy and interaction states
are final and approved. Recreate them faithfully. Where this document gives an exact px
value, that value is measured from the approved prototype. Anything marked **[INFERRED]**
is not defined by the design — it is a recommendation you may change.

The design consumes the **Industry** design system (steel-blue on a light technical ground,
Barlow Condensed over Barlow, square corners, hairline borders, `+` registration marks).
Its stylesheet is included in this bundle at `_ds/styles.css` and is the source of truth for
tokens. If the target codebase already has a design system, map the tokens in §3 onto it
rather than importing this CSS wholesale — but keep the *visual result* identical.

---

# 1. UI inventory

Route column = suggested URL. Prototype column = the internal route name in the HTML file,
so you can find the markup.

| # | Screen | Route | Prototype route |
|---|--------|-------|-----------------|
| 1 | Login | `/login` | `login` |
| 2 | Dashboard | `/` | `dashboard` |
| 3 | Reports list | `/reports` | `reports` |
| 4 | New report (2-step modal) | `/reports/new` | modal `newReport` |
| 5 | Report editor | `/reports/:id/:section` | `editor` |
| 6 | Supplier list | `/suppliers` | `suppliers` |
| 7 | Supplier detail | `/suppliers/:id/:tab` | `supplier` |
| 8 | Add / edit supplier | `/suppliers/new`, `/suppliers/:id/edit` | `supplierForm` |
| 9 | Main Products Images | `/reports/:id/product-images` | editor section `productImages` |
| 10 | Partners Images | `/reports/:id/partner-images` | editor section `partnerImages` |
| 11 | Appendix Pictures | `/reports/:id/appendix` | editor section `appendix` |
| 12 | Appendix Layout & Preview | `/reports/:id/appendix?view=layout` | appendix tab `layout` |
| 13 | AI Assistant | `/assistant` | `assistant` |
| 14 | Transcript Analysis | modal over editor | modal `transcript` |
| 15 | Export Word | modal over editor | modal `export` |
| 16 | Templates | `/templates` | `templates` |
| 17 | Placeholder mapping | `/templates/mapping` | `mapping` |
| 18 | Settings | `/settings/:tab` | `settings` |
| 19 | Mobile Visit Mode | `/visit` | `mobile` |

### 1. Login
- **Purpose** — authenticate; the one screen that carries the product identity.
- **Layout** — two columns, `grid-template-columns: 1.15fr 1fr`, full viewport height.
  Left panel: technical grid background (`linear-gradient` hairlines, `background-size:34px 34px`),
  EBARA logo 88px, kicker "GLOBAL SOURCING OFFICE" (11px, `letter-spacing:.18em`, uppercase,
  `--color-accent-700`), title "ODM Supplier Visit" (Barlow Condensed 42px/1.02, one line,
  `white-space:nowrap`), one paragraph 13.5px/1.6, then the GSO logo image filling the
  remaining height (`object-fit:contain`, `object-position:center 40%`, `padding:0 44px 34px`),
  and a 34px steel footer band (`--color-accent-900`) with the company line at 10.5px uppercase.
  Right panel: centred `.blueprint` card, `width:min(360px,100%)`, `padding:32px 30px`.
- **Primary action** — Sign in (`.btn-primary`, full width) → `/`.
- **Secondary** — SSO link, "Continue offline" **[INFERRED — wire to the offline queue]**.
- **States** — default, invalid credentials, disabled while submitting.
- **Responsive** — below 900px the left panel is dropped, the card centres. **[INFERRED]**

### 2. Dashboard
- **Purpose** — what needs attention today.
- **Layout** — page padding `26px 24px 40px`. Header row: kicker, `h2` page title, date +
  supplier count line, then `Add Supplier` (secondary) and `New Visit Report` (primary).
  KPI strip: `grid-template-columns: repeat(6, minmax(0,1fr))`, `gap:14px`, `margin-bottom:26px`.
  Below: recent reports table (left, flexible) and an attention/queue column.
- **KPIs (exact copy)** — Total Suppliers 14 (+2 this quarter) · Open Reports 5 (2 need
  conclusion) · In Review 2 (awaiting Manager) · Completed 11 (exported to DOCX) ·
  Visits This Month 3 (Hebei · Zhejiang) · Visits This Year 17 (6 provinces · 2026).
- **Primary actions** — New Visit Report, open a recent report.
- **States** — loading skeleton, empty (no reports yet).

### 3. Reports list
- **Purpose** — find and manage every report.
- **Layout** — filter bar in a `.blueprint` (search 220px + selects), then a table.
- **Columns** — Document № · Supplier · Visit date · Employee · Status · Completion (bar +
  %) · Last edit · Actions (open, duplicate, export, archive, delete).
- **Row actions** — duplicate creates `…x01` as Draft; delete opens the confirm modal.
- **States** — loading, empty, filtered-empty.

### 4. New report (modal, 2 steps)
See §9.

### 5. Report editor
The core screen. Full specification in §6.

### 6. Supplier list
- **Purpose** — the supplier master database, built from the supplier data sheet (Excel)
  requested from every new supplier.
- **Layout** — header (title, `{n} records · {m} data sheets received`, `Import Data Sheet`
  secondary, `Add Supplier` primary), filter bar (search + Country, Region/Province, Status,
  Certification, Data sheet), then the table inside a `.blueprint` with `overflow-x:auto`
  and `table{min-width:1180px}`.
- **Columns** — Company (30px initials square + short name 14px Barlow Condensed 600 + legal
  name 11px muted) · City · Region · Employees (right) · Factory (right) · Capacity / yr
  (right) · Certification (11.5px, `max-width:186px`) · Sales contact (name + email 11px,
  `overflow-wrap:anywhere`) · Status (status badge + data-sheet badge) · Actions (open,
  new visit report, edit — 28×28 icon buttons).
- **Data-sheet badge** — `Data sheet` (accent-100/accent-800) when the Excel was received,
  `Partial` (neutral-200/neutral-700), `Excel pending` (#f7eddb / #7a5a12).

### 7. Supplier detail
- **Purpose** — everything known about one supplier; the source of §2 Company Information.
- **Layout** — breadcrumb, 62px initials `.blueprint` square, name `h3` + status badge +
  data-sheet badge, legal name line, meta row (city/region/country, website, sales contact,
  last visit), actions (Edit Supplier, New Visit Report), then a 6-tab bar
  (`border-bottom:2px solid var(--color-accent)` on the active tab, 20px right margin).
- **Tabs** — Overview · Contacts · Products · Certificates · Files · Visit History.
- **Overview** — two columns `minmax(0,1.5fr) minmax(260px,1fr)`, `gap:22px`.
  Left: Company Information fact list (13 rows: label 190px uppercase 11.5px, value 13px)
  and Internal Notes. Right: Product Categories tags, Certifications tags + the note
  "As declared in the supplier data sheet — certificate copies are verified during the
  visit.", and Visit Photos (3-up, 64px tall) **only when the supplier has visit photos**.
- **Empty states** — Certificates for a non-visited supplier lists the *declared*
  certifications with `Declared` badges, `—` dates and "No copy collected"; Files shows
  "No documents uploaded for this supplier yet…"; Visit History shows "No visits recorded —
  this supplier is in the database from its data sheet only."

### 8. Add / edit supplier
- **Purpose** — create or correct a supplier record, normally by importing the Excel sheet.
- **Layout** — single column, `max-width:960px`, sticky footer bar (`position:sticky;bottom:0`,
  `padding:12px 24px`, border-top) with "Draft kept locally — nothing is lost if the
  connection drops.", Cancel, Save Supplier.
- **Sections** — an import drop zone, then `01 · Company Data Sheet` (3-col grid, 12px gap),
  `02 · Person in Charge (Sales)` (repeatable contact cards, 5-col grid),
  `03 · Commercial Information`, `04 · Products`, `05 · Certificates`, `06 · Internal notes`.
- Field list in §8 of this document.

### 9–11. Photo managers (Main Products Images 4.1, Partners Images 8.1, Appendix Pictures 10)
- **Purpose** — upload, caption and order the images of one report region.
- **Layout** — toolbar (Upload Images, Generate all captions, selection/arrange actions,
  right-aligned meta: `{n} images · region MAIN_PRODUCT_IMAGES · 2 columns, 7.0 cm`), then
  a card grid `repeat(auto-fill, minmax(236px,1fr))`, `gap:14px`.
- Full interaction model in §10.

### 12. Appendix Layout & Preview
Two tabs inside section 10: **Photos** (the grid above) and **Layout & Preview** — controls
on the left (columns, target height cm, rows per page, sort, filter), page geometry column
on the right (210px, border-left, 16px padding-left), and paginated page previews. See §14.

### 13. AI Assistant
- **Purpose** — ask questions across one report or all reports.
- **Layout** — context select (`GSO-2608001x00 · HEBEI HUATONG` / all reports), prompt input,
  suggested prompts, scoped actions (Analyze Transcript, Generate Conclusion, …), answer
  stream with section/timestamp citations and Insert into §n / Copy / Regenerate.
- The same assistant appears as the 320px editor rail (`rail: 'assistant'`).

### 14. Transcript Analysis (modal)
See §12.

### 15. Export Word (modal)
See §15.

### 16–17. Templates and mapping
See §16.

### 18. Settings
Tabs: Profile · AI · Templates · Defaults · Members · Roles · Storage. Two-column field
grids, `max-width:620–760px`, `.hr` separators between blocks.

### 19. Mobile Visit Mode
See §17.

---

# 2. Application shell

Exact values, measured from the approved prototype.

| Element | Value |
|---|---|
| App wrapper | `display:flex; min-width:1280px; min-height:100vh; background:var(--color-bg)` |
| Sidebar width | `218px`, `flex:none` |
| Sidebar background | `var(--color-accent-900)` #1d2d3d, text `#e6ebf0` |
| Sidebar position | `position:sticky; top:0; height:100vh; overflow:auto` |
| Sidebar brand block | `padding:18px 16px 14px`, bottom border `1px solid rgba(255,255,255,.12)`; EBARA logo 66px, inverted, `opacity:.95`; product name Barlow Condensed 600 15px `#fff` |
| Sidebar nav item | full width, `padding:8px 10px`, 14px body, icon 16px at `stroke-width:1.5`, gap 10px; active = `background:rgba(255,255,255,.10); color:#fff`; idle = `rgba(230,235,240,.72)`; hover = `rgba(255,255,255,.06)` |
| Sidebar collapse | **Not in the approved design.** Do not build one for desktop. **[INFERRED]** below 1280px, collapse to a 56px icon rail. |
| Top bar | `height:50px; position:sticky; top:0; z-index:20; padding:0 20px; gap:14px; background:var(--color-bg); border-bottom:1px solid var(--color-divider)` |
| Global search | `width:340px; max-width:42%`, icon inset 9px, results panel 440px wide, `.elev-lg`, `z-index:40` |
| Page padding | `26px 24px 40px` (dashboard, reports, suppliers); editor uses its own header + panes |
| Page max width | none on list pages (fluid); supplier form `960px`; settings blocks `620–760px`; editor writing column `532px` with the rail open, `~840px` with it closed |
| Editor header | `position:sticky; top:50px; z-index:15; padding:14px 20px 0`; total height 106px → content offset `156px` |
| Section navigator | `width:210px; flex:none; border-right:1px solid var(--color-divider); padding:16px 8px 20px; position:sticky; top:156px; max-height:calc(100vh - 156px); overflow:auto` |
| Editor rail | `width:320px; flex:none; border-left:1px solid var(--color-divider); position:sticky; top:156px; max-height:calc(100vh - 156px); overflow:auto` |
| Editor body | `display:flex; align-items:stretch; min-height:calc(100vh - 156px)` |
| Breadcrumb | 11.5px body, `gap:6px`, chevron icon 12px at `opacity:.5`, links `--color-accent-700`, current page `--color-text` |
| Header structure | breadcrumb row → title row (document number `h2`-scale + status badge + access note) → subtitle line (supplier · visit date · location) → right-aligned autosave indicator + actions |

Section spacing inside a page: `h5`/`h6` block heading `margin-bottom:8–10px`; blocks
separated by `18–26px`; grids `gap:11–14px`; card padding `11–14px`.

---

# 3. Design tokens

All values below come from `_ds/styles.css` (included). Import that file or map these onto
the codebase's own tokens.

## 3.1 Typography

| Role | Family | Size | Weight | Line height | Notes |
|---|---|---|---|---|---|
| Page title (`h2`) | Barlow Condensed | 32px | 600 | 1.12 | `letter-spacing:-0.015em` |
| Screen hero (`h1`, login only) | Barlow Condensed | 42px | 600 | 1.02 | |
| Section title (`h3`) | Barlow Condensed | 25px | 600 | 1.12 | |
| Panel title (`h5`) | Barlow Condensed | 16px | 600 | 1.12 | |
| Block label (`h6`) | Barlow Condensed | 13px | 600 | 1.12 | uppercase, `letter-spacing:.08em` |
| Kicker / eyebrow | Barlow | 10–11px | 400 | 1.2 | uppercase, `letter-spacing:.12–.18em`, `--color-accent-700` or `--color-neutral-600` |
| Body | Barlow | 15px (base), 13–13.5px in dense UI | 400 | 1.55–1.7 | editor prose 13.5px/1.7 |
| Field label | Barlow | 11–12px | 400 | 1.3 | uppercase `letter-spacing:.09em` in compact cards |
| Caption / meta | Barlow | 11–11.5px | 400 | 1.4 | `--color-neutral-600` |
| Table header | Barlow | 11px | 400 | 1.2 | uppercase, `letter-spacing:.08em`, 60% ink |
| Table cell | Barlow | 12.5px (dense) / 14px (default) | 400 | 1.45 | numeric columns right-aligned |
| Button | Barlow Condensed | 14px (12–12.5px compact) | 600 | 1.2 | |
| Monospace (doc numbers, placeholders) | `ui-monospace, Menlo, monospace` | 11–11.5px | 400 | — | |

Load Barlow + Barlow Condensed (400, 600) — the design system's stylesheet links them.

## 3.2 Colours (semantic → token → hex)

| Semantic | Token | Hex |
|---|---|---|
| Background (page) | `--color-bg` | `#f2f2f3` |
| Surface (inputs) | `--color-surface` | `#e9e9ea` |
| Elevated surface (menus, dialogs) | `--color-bg` + `--shadow-lg` | `#f2f2f3` |
| Subtle fill (photo card ground, prose textarea) | `--color-neutral-100` | `#f5f5f8` |
| Border / divider | `--color-divider` | `#1d1f20` @ 16% |
| Hairline row rule | — | `#1d1f20` @ 8% |
| Primary text | `--color-text` | `#1d1f20` |
| Secondary text | `--color-neutral-800` | `#424244` |
| Muted text | `--color-neutral-600` | `#7a7a7d` |
| Disabled text / icon | `--color-neutral-500` | `#98989b` |
| Accent | `--color-accent` | `#5980a6` |
| Accent hover | `--color-accent-600` | `#597ea3` |
| Accent pressed | `--color-accent-700` | `#416180` |
| Accent tint (selected row, AI band) | `--color-accent-100` | `#eef6ff` |
| Accent border tint | `--color-accent-300` | `#b5d9fd` |
| Accent ink on tint | `--color-accent-800` / `-900` | `#2c455d` / `#1d2d3d` |
| Dark chrome (sidebar, Visit Mode) | `--color-accent-900` | `#1d2d3d` |
| Success | `--color-accent-800` on `--color-accent-100` | `#2c455d` on `#eef6ff` |
| Warning | `#7a5a12` on `#f7eddb` | |
| Error / destructive | `#8a3232` on `#f7e3e3` | |
| Info | `--color-accent-800` on `--color-accent-100` | |

The palette is deliberately mono-steel: **no decorative colour beyond the accent**. Warning
and error are the only two added functional hues and appear *only* on status, validation and
low-confidence markers.

### Status badges (`.tag`, 11px, `padding:3px 10px`, square)

| Status | Background | Text | Contrast |
|---|---|---|---|
| Draft | `--color-neutral-200` `#e7e7ea` | `--color-neutral-800` `#424244` | 8.5:1 |
| In Review | `#f7eddb` | `#7a5a12` | 5.6:1 |
| Final | `--color-accent-100` `#eef6ff` | `--color-accent-800` `#2c455d` | 10.2:1 |
| Archived | transparent + `1px solid --color-divider` | `--color-neutral-600` `#7a7a7d` | 4.6:1 |
| Approved (supplier) | `--color-accent-100` | `--color-accent-800` | 10.2:1 |
| Under Qualification | `#f7eddb` | `#7a5a12` | 5.6:1 |
| On Hold / Prospect | `--color-neutral-200` | `--color-neutral-700` | 6.6:1 |
| Valid (certificate) | `--color-accent-100` | `--color-accent-800` | 10.2:1 |
| Not evidenced | `#f7e3e3` | `#8a3232` | 5.9:1 |
| Declared | `--color-neutral-200` | `--color-neutral-700` | 6.6:1 |

All body-size text meets ≥4.5:1 on its own ground; `--color-accent` itself is used only for
icons, chrome and headline-scale type (3:1+), never for paragraph text — use
`--color-accent-700` or darker there.

## 3.3 Spacing

The design-system scale is density-adjusted (0.85×): `--space-1: 3.4px`, `--space-2: 6.8px`,
`--space-3: 10.2px`, `--space-4: 13.6px`, `--space-6: 20.4px`, `--space-8: 27.2px`.
The application layer uses a rounded 4px scale on top of it:

| Step | Used for |
|---|---|
| 2–4px | icon/label gaps inside a control, tag gaps |
| 6px | photo grid gaps, tag rows, small button gaps |
| 8px | toolbar gaps, label → field |
| 10–12px | card padding, field grid gaps, list gaps |
| 14px | KPI grid gap, photo card grid gap, card padding (roomy) |
| 16px | pane padding, column gaps |
| 18–20px | block separation inside a page |
| 24px | page horizontal padding, section separation |
| 26px | page top padding, KPI strip bottom margin |
| 36–40px | page bottom padding, major section separation |

## 3.4 Borders

- Border width: **1px everywhere**. 2px only for the active tab underline and the focus ring.
- Radius: **0** for cards, buttons, inputs, tags, dialogs (`--radius-md: 4px` exists in the
  system but the application layer squares everything — keep it square).
- Divider: `1px solid var(--color-divider)`; table row rule `1px solid rgb(29 31 32 / 8%)`.
- Dashed `1px` borders mark *empty or pending* affordances only (drop zones, empty slots,
  excluded blocks).
- **Blueprint frames**: every card, figure, table container and the primary button carry
  `.blueprint` + four `<i class="corner tl|tr|bl|br">` registration marks. Do not drop them.

## 3.5 Shadows

Used sparingly — the system is a line drawing.

| Token | Value | Used for |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgb(43 43 45 / 14%)` | hover lift on interactive cards (rare) |
| `--shadow-md` | `0 3px 10px rgb(43 43 45 / 16%)` | popovers, dropdown menus |
| `--shadow-lg` | `0 12px 32px rgb(43 43 45 / 22%)` | dialogs, global search panel, toasts |

Nothing else casts a shadow. Tables, cards, panes and the rail are separated by hairlines.

---

# 4. Component specification

Every component is square-cornered and hairline-bordered unless stated. Sizes are the
approved ones; "compact" is the dense variant used inside cards and toolbars.

| Component | Anatomy & behaviour | Variants | Sizes | States |
|---|---|---|---|---|
| **Primary button** | Solid `--color-accent` fill, `--color-bg` text, Barlow Condensed 600 14px, `padding:6.8px 12.2px`, square, blueprint marks on the large form | — | default `min-height:36px`; compact `font-size:12px; padding:3px 9px`; block (full width) | hover `--color-accent-600`; active `--color-accent-700`; focus-visible 2px accent ring offset 2px; disabled `opacity:.45` |
| **Secondary button** | Transparent, `1px solid var(--color-divider)`, text `--color-text` | with leading icon (13–14px) | same as primary | hover: border `--color-accent-400`, background `--color-accent-100`; active: accent-100 + accent-500 border |
| **Destructive button** | Secondary shape, text `#8a3232`, border `#e3c4c4`; solid `#8a3232` on `#fff` only inside the delete confirm modal | outline (default), solid (confirm) | same | hover `#f7e3e3` fill |
| **Icon button** | Square 24/26/28px, ghost by default, icon 13–14px `stroke-width:1.5` | ghost, secondary | 23px (card row), 24px (table row), 26–28px (toolbar) | hover accent-100; disabled 45%; must carry `aria-label`/`title` |
| **Text input** | `.input` — `min-height:36px; padding:6px 10px; font-size:14px; background:var(--color-surface); border:1px solid var(--color-divider)` | compact (`font-size:11.5–12px; padding:4–5px 6–8px`) | full width of its grid cell | hover border 45% ink; focus border `--color-accent`; filled = same; error border `#8a3232` + 11.5px `#8a3232` message below; disabled 45% |
| **Text area** | `textarea.input`, `min-height:90px`, `resize:vertical` | prose (editor body: `min-height:120–220px; background:var(--color-neutral-100); font-size:13.5px; line-height:1.7; padding:14px`), compact (captions, 30–60px) | — | as input; autosave fires on change |
| **Rich text editor** | The approved design uses a plain prose textarea with AI actions above it. **[INFERRED]** if rich text is required, keep the same frame and allow bold/italic/lists only — the DOCX template owns all other formatting | — | writing column 532px (rail open) | as textarea |
| **Select** | `.input` with native `<select>`, chevron from the browser; `width:auto; min-width:124px` in filter bars | filter, field | 36px / compact 30px | as input |
| **Multi select** | **[INFERRED]** — not in the approved design. Use a chip list inside an input-shaped box; chips are `.tag` with a 12px × dismiss |
| **Date picker / Time picker** | Native `<input type="date">` / `type="time"` styled with `.input` (New Report: Visit Date, Start Time 09:30, End Time 16:30) | — | 36px | as input |
| **Search** | `.input` with a 13–14px search icon absolutely positioned at `left:9px; top:11px`, `padding-left:26–28px` | global (340px, top bar), page (220px, filter bar) | 36px | focus opens the results panel (global only) |
| **Filter** | Row of selects inside a `.blueprint` (`padding:11px 12px; gap:8px; flex-wrap:wrap`) preceded by a search | — | — | active filter shows its value as the select label |
| **Status badge** | `.tag`, 11px, `padding:3px 10px`, square, colours per §3.2 | status, outline, neutral, accent | one size | static |
| **Card** | `.blueprint` + 4 corner marks, transparent, `padding:11–14px`; optional `.card-kicker` (10px uppercase accent), `.card-title` (Barlow Condensed 600 15–16px), `.card-body` (13px/1.6), `.card-meta` | plain, elevated (`.elev-sm/md/lg`) | fluid | hover only when the whole card is a link |
| **KPI card** | `.blueprint`, `padding:14px 14px 12px`; label 10px uppercase `--color-neutral-600`; value Barlow Condensed 600 28–30px; delta 11.5px in `--color-neutral-600`, warning `#8a6a12`, accent `--color-accent-700` | — | 6-up grid | static |
| **Table** | `.table` in a `.blueprint` wrapper (`padding:2px 12px 6px`); header 11px uppercase 60% ink with a 1px bottom border; rows `padding:6.8px`, rule `8%` ink; hover `4%` ink | dense (12.5px cells), default (14px) | `min-width` when the column set is wide (suppliers 1180px) with `overflow-x:auto` on the wrapper | hover, selected (`--color-accent-100`), empty, loading skeleton |
| **Tabs** | Text buttons with a 2px bottom border; active `--color-accent` + `--color-text`, idle transparent + `--color-neutral-600`; `padding:9px 2px; margin-right:20px` | page tabs (supplier, settings), inline tabs (appendix Photos / Layout) | — | hover ink darkens; focus ring |
| **Sidebar item** | 218px wide row, icon + label, see §2 | — | — | idle / hover / active / with count badge |
| **Breadcrumb** | 11.5px row, `gap:6px`, chevron 12px `opacity:.5` | — | — | links accent-700, hover underline |
| **Modal** | `.dialog-backdrop` (`--color-neutral-900` @ 50%) + `.dialog` — square, `--color-bg`, `--shadow-lg`, blueprint marks, `padding:13.6px`; title 16px Barlow Condensed 600 + 12px muted subline; actions right-aligned with 8px gap | small 440px, medium 560px, large 720px, xl 900px (see §20) | — | open/close fade+rise `.12s ease-out`; Esc closes; focus trapped |
| **Drawer** | The editor rail is the only drawer: 320px, sticky, border-left, `slideIn .1s` | sources, assistant | 320px | open/closed (toggle in the editor header) |
| **Toast** | Bottom-centre, `--color-accent-900` ground, `#fff` 12.5px text, `padding:9px 14px`, `--shadow-lg`, auto-dismiss ~2.5s | info (default), warning, error | — | enter/exit slide+fade; never blocks input |
| **Progress bar** | 4px track `--color-neutral-300`, fill `--color-accent`; used for completion and export | determinate, indeterminate (export steps) | full width of its container | — |
| **Completion indicator** | Label "REPORT COMPLETION" 10px uppercase + right-aligned % (Barlow Condensed 600 15px) over a 4px bar; in lists it is a 60px bar + % | navigator, reports table, dashboard | — | 0–100; colour is always accent |
| **Upload zone** | Dashed 1px `--color-accent-400` on `--color-accent-100`, `padding:13–15px`, icon 17px + two-line copy + right-hand status tag; the large variant is centred with a 22px icon and `padding:26px` | inline (certificates, supplier import), large (files tab) | — | idle, drag-over (border `--color-accent`, fill accent-200), uploading (per-file progress), error |
| **File card** | Table row with a 14px file icon, name, category, size, date, download icon button | — | — | hover, downloading |
| **Photo card** | `.blueprint`, `padding:0`, `background:--color-neutral-100`; image `height:150px; object-fit:cover`; overlay top-left index tag; body `padding:8px 9px 9px` with a caption textarea (11.5px/1.4) and a 3-button action row (Accept / Rewrite / Analyze at 10.5px) | appendix, product, partner | grid `minmax(236px,1fr)` | default, AI-suggested (accent-300 border on the caption), accepted, selected (2px accent outline), uploading, failed |
| **AI suggestion card** | `.blueprint` with a spark icon, 10px uppercase "AI ACTIONS" kicker, the suggested text at 12.5px/1.55 and Accept / Edit / Discard buttons | inline (rail), banner (section top) | — | idle, running (skeleton lines), error |
| **AI comparison modal** | Two columns — *Current* vs *Suggestion* — each in a bordered pane with its own scroll; footer: Replace / Insert below / Regenerate / Cancel | — | 900px | see §11 |
| **Observation card** | `.blueprint` `padding:11px 12px`; header row = category tag (outline) + priority tag + photo/edit/delete icon buttons; body 13px/1.6 | — | — | default, editing, AI-proposed |
| **Supplier card** | Used in the New Report picker: full-width button, 8px 10px padding, name + location 12.5px; selected = `--color-accent` border + `--color-accent-100` fill | — | — | idle, hover, selected |
| **Transcript finding card** | `.blueprint`; category tag + confidence ("AI · 91% confidence" / "· review required" below 85%) + target-section line "→ §6 Visit Relevant Information"; actions Add to Report / Edit & Add / Dismiss | — | — | open, added (accent-100 ground + ✓), dismissed (45% + Undo) |
| **Appendix image cell** | Preview page cell: image at the computed height, caption row beneath at 9px/1.3; missing caption renders "Caption required" in `#8a3232` | — | 2 columns by default | ok, caption missing, oversize warning |
| **Empty state** | 1px dashed `--color-neutral-400` box, `padding:13–14px`, 12.5px `--color-neutral-700` copy, optional inline action button | inline, page | — | — |
| **Loading state** | Skeleton blocks in `--color-neutral-200` at the real element's size; spinners only inside buttons (14px) | skeleton, inline spinner | — | — |
| **Error state** | 1px `#e3c4c4` border on `#f7e3e3`, 12.5px `#8a3232` copy, a Retry button | inline, page, toast | — | — |

---

# 5. Component states

Every interactive element implements the full set:

- **default** — as specified above.
- **hover** — accent tint (`--color-accent-100`) or 4% ink for rows; border steps one stop
  darker. Never a colour change on text alone.
- **focus-visible** — `outline: 2px solid var(--color-accent); outline-offset: 2px`
  (inputs use `outline-offset: 0` and switch the border to the accent). Never remove it.
- **selected** — `--color-accent-100` fill + `--color-accent` border (rows, cards, chips);
  tabs use the 2px accent underline.
- **disabled** — `opacity:.45; cursor:not-allowed`; not focusable.
- **loading** — skeleton for content, in-button 14px spinner + the verb in progress
  ("Generating…"), the control stays disabled but keeps its width.
- **success** — a toast plus, where relevant, a persistent marker (✓ on the section, "Saved").
- **error** — inline message adjacent to the control (11.5px `#8a3232`) plus a toast when the
  failure is asynchronous.

Field-specific:

| Field state | Rendering |
|---|---|
| default | `--color-surface` fill, divider border |
| active (focused) | accent border, caret `--color-accent` |
| filled | identical to default — no special styling |
| validation error | `#8a3232` border + message below; the field keeps focus |
| disabled | 45% opacity, no hover |
| AI-filled, unconfirmed | `--color-accent-100` fill + `--color-accent-400` border until confirmed (used by certificate OCR fields) |

---

# 6. Report Editor specification

## 6.1 Structure (top to bottom, left to right)

**Editor header** — sticky at `top:50px`, `z-index:15`, `padding:14px 20px 0`, bottom border.
1. Breadcrumb: `Reports › GSO-2608001x00 › {section name}`.
2. Title row: document number (Barlow Condensed 600, 26px) · status badge (`Draft`) ·
   access note "Editor · you have write access" (12px muted) · right side: autosave
   indicator, rail toggle, `Analyze Transcript`, `Export` (primary).
3. Subtitle: `HEBEI HUATONG Factory Visit · Aug 12, 2026 · Tangshan, Hebei` (13px,
   `--color-neutral-700`).

**Left — section navigator (210px)**
- "REPORT COMPLETION" label + percentage + 4px progress bar.
- "SECTIONS" label, then the 13 rows (see 6.2).
- Sticky footer button: `Submit for Review`.

**Centre — section workspace**
- Section title row: number + name (`h4`-scale, 20px).
- AI action row: 10px uppercase "AI ACTIONS" kicker + 1–3 compact secondary buttons.
- The section's own content (prose textarea, table, card list, photo grid…).
- Writing column width 532px with the rail open, ~840px with it closed; tables and photo
  grids are allowed to use the full width.

**Right — rail (320px, collapsible)**
- Toggle between **Sources** (transcript, documents, photos, supplier record) and
  **AI Assistant** (scoped chat).

## 6.2 Section navigation

| Order | Label | Section id | Completion predicate |
|---|---|---|---|
| — | General Information | `general` | always true (created with the report) |
| 1. | Purpose | `purpose` | text length > 40 |
| 2. | Company Information | `company` | always true (from supplier record) |
| 3. | Company Overview | `overview` | text length > 40 |
| 4. | Main Products | `products` | text length > 40 (the product table is **optional**) |
| 4.1 | Main Products Images | `productImages` | ≥1 image and **every** image captioned |
| 5. | Target Products | `target` | ≥1 target product |
| 6. | Visit Relevant Information | `visit` | ≥8 observations added (Q&A bullets **optional**) |
| 7. | Certificates | `certs` | always true |
| 8. | Partners | `partners` | text length > 40 |
| 8.1 | Partners Images | `partnerImages` | ≥1 image and every image captioned |
| 9. | Conclusion | `conclusion` | text length > 40 |
| 10. | Appendix Pictures | `appendix` | ≥1 image and every image captioned |

Completion % = passing predicates ÷ 13, rounded. **Derived, never stored** — the dashboard,
the reports table and the editor all read the same computation.

Navigator row states:

| State | Rendering |
|---|---|
| default (incomplete) | open circle 12px `--color-neutral-400`, label `--color-neutral-700` |
| completed | ✓ 12px `--color-accent`, label `--color-text` |
| selected | `--color-accent-100` fill + 2px left border `--color-accent`, label `--color-text` |
| warning | small `#8a6a12` triangle after the label (e.g. captions missing before export) |
| AI suggestion available | 11px spark icon `--color-accent-700` right-aligned in the row |
| sub-section (4.1, 8.1) | indented 14px, number in `--color-neutral-600` |

## 6.3 Section save behaviour
Each section patches independently (see §7). Switching sections never loses input: the
pending debounce is flushed on navigate, and the destination renders from the same store.

## 6.4 Layout by breakpoint
- **Desktop ≥1280px** — the three panes above (approved layout).
- **Tablet 768–1279px [INFERRED]** — navigator collapses to a full-width section dropdown
  pinned under the header; the rail becomes an overlay drawer opened from the header; the
  writing column takes the remaining width (max 720px).
- **Mobile <768px [INFERRED]** — the editor is read-only: header, section list, section
  content stacked. Editing on a phone happens in Visit Mode (§17), not here.

---

# 7. Autosave UX

Location: the editor header, right of the title row, left of the action buttons. 11.5px,
`--color-neutral-600`, with a 13px leading icon. Never a modal, never a blocking spinner,
never a layout shift — the five states occupy the same 160px slot.

| State | Copy | Icon / colour | Trigger |
|---|---|---|---|
| Saving | `Saving…` | spinner, `--color-neutral-600` | any keystroke / change; 400ms debounce |
| Saved | `Saved` | ✓ `--color-accent` | patch resolves; holds 3s |
| Idle | `Last saved 11:42` | clock, `--color-neutral-600` | after the Saved hold |
| Failed | `Save failed — retry` | ⚠ `#8a3232` (clickable) | patch rejects; also raises an error toast; content stays in the editor |
| Offline pending | `6 changes queued — offline` | cloud-off, `#7a5a12` | navigator/browser offline; queue in IndexedDB, replay on reconnect, then flip to Saved |

Rules: the user must never be uncertain. Never clear the editor on failure; never
auto-navigate away from unsaved work; a failed save keeps retrying with backoff and the
indicator stays in the failed state until it succeeds. On reconnect show a toast:
`6 queued changes synced`.

---

# 8. Supplier workflow

## 8.1 Supplier data sheet (the master record)

The field set is the Excel sheet EBARA sends to every new supplier. These are the exact
columns, in order:

| Field | Type | Required | Example |
|---|---|---|---|
| Company name | text | ✓ | Shimge Pump Industry (Zhejiang) Co., Ltd |
| Established year | year | | 1984 |
| Company capital | text | | CNY 3,800,000,000 |
| Number of employees | integer | | 3,500 |
| Factory size (m²) | text | | 283,000 m² |
| Certification (ISO etc.) | text list | | ISO9001, ISO14001, CE, CSA, RoHS, UL |
| Production capacity (units/year) | text | | 15,000,000 |
| Company president name | text | | Xu Longbo |
| Company website URL | url | | www.shimgepump.com |
| Country | enum | ✓ | China |
| Region / Province / State | text | | Zhejiang |
| City | text | | Taizhou |
| Address (street / plot) | text | | No.3 Bihai Street, Eastern New District… |
| Tel (start with +) | phone | | +86-576-86339960 |
| Person in charge (Sales) | text | | Lola Lu |
| Title (job position) | text | | Sales manager |
| WeChat | text | | Dolores-Lola |
| Email | email | | lolalu@shimge.com |
| Track record EBARA group | text | | (empty for a new supplier) |

Derived/app fields: `id`, short display name, status (`Prospect` / `Under Qualification` /
`Approved` / `On Hold`), data-sheet state (`received` / `partial` / `pending`), last visit,
report count, internal notes, product categories, visit photos.

The prototype ships with 14 seeded records (12 from the customer's Excel + HEBEI HUATONG and
TESK, which have open reports). Seed the same data — it is real and is what the screens were
sized against.

## 8.2 Screens
- **List** — §1.6. Sorting by any column; filters Country, Region, Status, Certification,
  Data sheet.
- **Detail** — §1.7. Six tabs, all record-scoped; empty states where the supplier has no
  visits/files/certificate copies.
- **Add / Edit** — §1.8. Excel import at the top (`Import Data Sheet`) prefills every field;
  manual entry is always possible. Save → back to the list with a toast.
- **Supplier selector (New Report)** — searchable list of supplier cards; selecting one binds
  the report to the supplier **and copies a snapshot** (below).

## 8.3 Live master data vs report snapshot — important

| | Live master data | Report snapshot |
|---|---|---|
| Lives in | `suppliers` (+ contacts, certificates, files) | `reports.company_information` JSON |
| Changes when | someone edits the supplier record | only when the report author explicitly refreshes it |
| Used by | supplier screens, selectors, dashboards | §2 Company Information, the DOCX export |
| Why | one truth per supplier, always current | a report is a legal record of **what was true at the visit date** — it must not mutate afterwards |

§2 Company Information therefore renders the snapshot, with a header line
`Source: Supplier Database · snapshot taken {date}` and a `Refresh from supplier record`
action that diffs and asks for confirmation before overwriting.

---

# 9. New Report workflow

Two-step modal (560px) opened from the dashboard, the reports list or a supplier.

**Step 1 — Supplier**: search field + supplier card list; selecting one advances the
step indicator. `Next` is disabled until a supplier is chosen.

**Step 2 — Report details** (2-column field grid):

| Field | Required | Default / validation |
|---|---|---|
| Document Number | ✓ | auto `GSO-YYMMNNNx00`, editable, unique — validate on blur |
| Employee | ✓ | current user |
| Period | ✓ | derived from the visit date (e.g. "August 2026") |
| Supplier | ✓ | from step 1, shown read-only with a Change link |
| Members | optional | multi-entry chips (e.g. Reinaldo Alves, Corrado Braconi, Xu Jianping) |
| Visit Date | ✓ | today; date picker |
| Location | ✓ | prefilled `City, Region` from the supplier record |
| Start Time | optional | 09:30 |
| End Time | optional | 16:30, must be after Start Time |
| Project | optional | free text |
| Business Unit | optional | select, default "Building Service & Industrial" |
| Product Category | optional | select |

**Create Report** → creates the Draft, copies the supplier snapshot, and navigates straight
to `/reports/:id/purpose` with the toast `Report GSO-2609004x00 created — draft saved`.
**Cancel** → closes with no record; if fields were filled, confirm the discard.

---

# 10. Photo management UX

One model shared by all three regions: **Main Products Images** (`MAIN_PRODUCT_IMAGES`),
**Partners Images** (`PARTNER_IMAGES`), **Appendix Pictures** (`APPENDIX_IMAGES`).

- **Upload** — multi-file picker and drag-and-drop onto the grid or the drop zone. Per-file
  progress on the card; failures leave the card with a Retry.
- **Card** — see §4. Index tag, 150px cover image, caption textarea, action row.
- **Caption** — typed at any time; AI drafts are shown as *suggestions* (accent-bordered)
  that must be Accepted, Rewritten or Analyzed. A confidence below 85% renders
  "AI · 78% · review required" in `#8a6a12`.
- **Bulk** — `Select all` / rubber-band selection; bulk actions: Generate all captions,
  Move to section, Delete, Arrange (by category then capture time).
- **Order** — drag to reorder within a region; order is the appendix print order.
- **Move between sections** — the card's section select, or bulk Move; the target region's
  count and geometry line update immediately.
- **Delete / replace** — per card; delete asks for confirmation only in bulk.
- **Performance** — thumbnails at ≤400px wide, lazy-loaded, virtualised beyond ~60 cards;
  the original is kept for export at the chosen image quality.

Every photo carries: `id`, `src`, `caption`, `caption_source` (`user` | `ai`), `confidence`,
`section`, `order`, `captured_at`, `upload_state`.

---

# 11. AI interaction patterns

**One rule, no exceptions: AI output is a proposal until a human accepts it.** AI never
writes into a field, a caption or a section silently.

| Interaction | Trigger | Loading | Output surface | Accept | Edit | Regenerate | Discard | Error |
|---|---|---|---|---|---|---|---|---|
| Improve Text (§1, 3, 4, 5, 8) | compact button in the AI actions row | button shows "Improving…", section stays editable | **AI comparison modal**, 900px: Current \| Suggestion side by side | `Replace` or `Insert below` | edit inside the suggestion pane before accepting | `Regenerate` | `Cancel` — nothing changes | inline error in the modal + Retry |
| Generate from Transcript (§3, 4, 8) | "Extract … from Transcript" | same | same comparison modal | same | same | same | same | same |
| Generate Conclusion (§9) | `Generate Conclusion` | source checklist → progress list | full-width draft panel with the 9 headings | `Use Conclusion` | edit in place after inserting | `Regenerate` | `Discard` | error card + Retry |
| Photo Caption | per card `Rewrite`, or `Generate all captions` | caption area skeleton | suggested caption on the card (accent border) + optional analysis modal | `Accept` | type over it (marks `user`) | `Rewrite` | clear the suggestion | caption stays empty, card flagged |
| Analyze Transcript | header button or rail | modal with a progress list per category | findings grouped by category | `Add to Report` | `Edit & Add` | re-run analysis | `Dismiss` (with Undo) | error state inside the modal |
| Assistant answer | prompt in the rail or `/assistant` | streamed text | answer with section + timestamp citations | `Insert into §n` | edit after insert | `Regenerate` | ignore | inline retry |

Shared vocabulary: spark icon (`stroke-width:1.5`), 10px uppercase "AI ACTIONS" kicker,
accent-100 bands for anything AI-proposed, confidence always shown as a percentage.

---

# 12. Transcript Analysis

- **Input** — the Plaud transcript attached to the report (`HUATONG_Visit_2026-08-12.txt ·
  14,206 words`). Shown in the Sources rail with its size and upload date.
- **Run** — `Analyze Transcript` opens the modal (720px) and streams a per-category progress
  list.
- **Categories** — Company Overview · Main Products · Manufacturing · Quality · Testing ·
  Certificates · Commercial · Risks · Opportunities · Actions. Each shows its finding count
  ("12 findings").
- **Finding card** — category tag, the finding sentence (13px/1.6), confidence
  ("AI · 91% confidence", `< 85%` → "· review required" in `#8a6a12`), and the destination:
  `→ §6 Visit Relevant Information`.
- **Actions** — `Add to Report` (inserts as an observation and marks the card added, with
  the toast `Added to §6 Visit Relevant Information`), `Edit & Add` (opens the text for
  editing first), `Dismiss` (45% + Undo).
- **Counters** — the §6 banner shows `9 AI findings from the transcript are waiting for
  review · 4 already added` with a `Review findings` button.

---

# 13. Conclusion Generator

Modal/panel over the editor (900px).

1. **Source picker** — checkboxes, all on by default: Purpose · Company Overview · Main
   Products · Target Products · Visit Relevant Information · Certificates · Partners ·
   Plaud Transcript · Photo Analysis.
2. **Generating** — the source list becomes a progress list, each line ticking to ✓.
3. **Draft** — headed sections, in this order: Overall Assessment · Technical Capability ·
   Manufacturing Capability · Quality Capability · Commercial Potential · Risks ·
   Opportunities · Recommendation · Next Steps. Risks are numbered.
4. **Review** — the user must read it; actions are `Use Conclusion`, `Regenerate`,
   `Discard`. `Use Conclusion` writes into §9 (where it remains fully editable) and flips
   the section to complete.

The conclusion is never written automatically at export time.

---

# 14. Appendix UX

**Requirement (unchanged):** two columns, images targeted at **6.5 cm** height, a caption row
under each image row, and the corporate DOCX template has final say on pagination.

- **Photos tab** — the photo grid of §10 for `APPENDIX_IMAGES`.
- **Layout & Preview tab** — left: controls (Columns 1–3, Target height cm, Rows per page,
  Sort: manual / capture time / category, Filter). Right: a 210px "Page geometry" column
  (border-left, `padding-left:16px`) showing the arithmetic — usable page height, image
  height, caption row height, and the **computed maximum rows that physically fit**. Below:
  paginated page previews with 2-up cells and caption rows; a missing caption renders
  "Caption required" in `#8a3232`.
- **Validation warning, never silent resizing** — when the requested rows × (6.5 cm + caption)
  exceeds the usable page height, show a warning card: what was asked, what fits, and two
  explicit choices (reduce rows per page, or reduce the target height to the computed
  maximum). The user decides; the app never shrinks images on its own.
- **Other actions** — drag reorder, edit caption inline, bulk caption generation, remove from
  appendix (returns the photo to the library, does not delete it).

---

# 15. Word Export UX

Modal, 720px, opened from the editor header.

**Form** — Template (`EBARA ODM Visit Report Template · v1.3`), Image quality
(`Original (largest file, best print)` / `Optimised (long edge 2400 px)`), File name
(`GSO-2608001x00_HEBEI-HUATONG_Visit_Report.docx`), and a "Sections included" checklist with
a warning marker on any incomplete section (e.g. Conclusion empty).

**Validation before running** — list blocking issues (missing captions, empty Conclusion,
appendix overflow). The user can export anyway; the warnings are restated in the result.

**Processing states** (a stepped list, current step with a spinner, done steps with ✓):
1. Preparing report
2. Processing images
3. Building appendix
4. Applying Word template
5. Generating DOCX
6. **Report ready**

**Success** — accent-100 panel: `Report Ready` + `GSO-2608001x00_HEBEI-HUATONG_Visit_Report.docx
· 4.8 MB · 14 pages + 4 appendix pages`, with Download and Open in Word actions, and the
export recorded in the report's history.

**Error** — the failing step turns `#8a3232` with the reason and a Retry; earlier steps stay
ticked; nothing is lost.

---

# 16. Template management

- **Template list** — table: name, version, uploaded by, date, status (`Active` / `Archived`),
  actions (Download, Set active, Map placeholders, Archive).
- **Active template** — exactly one; changing it warns that new exports will use it.
- **Upload new template** — modal with a `.docx` drop zone; on upload, the app parses the
  placeholders and shows a mapping diff (found / missing / unknown).
- **Mapping screen** (`/templates/mapping`) — table of placeholder → source → sample value →
  status:

| Placeholder | Source |
|---|---|
| `{{DOCUMENT_NUMBER}}` | Report › document number |
| `{{EMPLOYEE}}` | Report › employee |
| `{{PERIOD}}` | Report › period |
| `{{SUPPLIER_NAME}}` | Supplier snapshot › legal name |
| `{{MEMBERS}}` | Report › members |
| `{{PURPOSE}}` | §1 rich text |
| `{{COMPANY_INFORMATION}}` | Supplier snapshot › key/value block |
| `{{COMPANY_OVERVIEW}}` | §3 rich text |
| `{{MAIN_PRODUCTS}}` | §4 rich text + optional product table |
| `{{TARGET_PRODUCTS}}` | §5 products + notes + images |
| `{{VISIT_INFORMATION}}` | §6 observations + optional Q&A bullets |
| `{{CERTIFICATES}}` | §7 certificate table |
| `{{PARTNERS}}` | §8 rich text |
| `{{CONCLUSION}}` | §9 rich text |

- **Special regions** (image loops, not text placeholders): `MAIN_PRODUCT_IMAGES` (2 columns,
  7.0 cm), `PARTNER_IMAGES` (2 columns, 7.0 cm), `APPENDIX_IMAGES` (2 columns, 6.5 cm target,
  caption row per image row).
- A placeholder present in the template but unmapped, or mapped but missing from the
  template, is flagged `#8a6a12` in the status column.

---

# 17. Mobile Visit Mode

Route `/visit`. A deliberately small surface for use inside a factory — **not** the desktop
editor. Dark chrome (`--color-accent-900`) framing a light app surface.

- **Header** — supplier name (Barlow Condensed 600 19px), `Factory Visit · Aug 12 · 10:32`,
  status badge, and a connection banner when weak: `Weak factory signal · 6 items queued`
  (`#f7eddb` / `#7a5a12`).
- **Home** — 2-up action tiles (min-height 84px, 44px+ touch targets): Take Photo · Add Note ·
  Add Observation · Upload File · Voice / Transcript · View Report. Then three counters
  (Photos / Notes / Obs.) and a "Last photos" 3-up grid.
- **Camera** — viewfinder with the section chip (`APPENDIX · AUTO`), today's count, and a
  section select at the bottom (Appendix Pictures / Main Products Images / Partners Images).
  Controls: Photo Library · 64px round shutter · Done.
- **After the shutter — caption sheet** (approved this round): 46px thumbnail,
  `Photo {n} captured`, `Appendix Pictures · caption optional`, a `Retake` link, a caption
  textarea (placeholder "Type a caption now — or leave empty and let the AI write it"),
  five one-tap starters (Production line, Testing laboratory, Warehouse, Certificate board,
  Meeting room), then two 44px buttons: **AI caption later** (secondary) and **Save caption**
  (primary; reads "Save without caption" while the field is empty). Saving returns to the
  viewfinder for the next shot.
- **Quick observation** — category chips, text area, optional photo attachment, Save → §6.
- **Offline** — everything queues locally and survives app restarts; the queue count is
  always visible; sync happens automatically on reconnect.
- **Bottom navigation** — not used; the home grid is the navigation. Keep it that way.

---

# 18. Responsive breakpoints

The approved design is desktop-first with a hard `min-width:1280px` on the app shell and a
separate mobile route. Everything below the desktop row is **[INFERRED]**.

| | Desktop ≥1280px (approved) | Tablet 768–1279px | Mobile <768px |
|---|---|---|---|
| Sidebar | 218px, always visible | 56px icon rail, labels on hover | hidden; hamburger sheet |
| Top bar | 50px, search 340px | 50px, search collapses to an icon | 50px, search icon only |
| Tables | full column set, `overflow-x:auto` when wide | horizontal scroll with the first column sticky | card list, one card per row |
| Editor | navigator 210 + content + rail 320 | navigator → dropdown; rail → overlay drawer | read-only stacked view |
| Photo grid | `minmax(236px,1fr)` | `minmax(200px,1fr)` | 2-up, then 1-up below 480px |
| Modals | fixed widths (§20) | `min(width, 92vw)` | full-screen sheets |
| Navigation | sidebar | sidebar rail | Visit Mode is the mobile product |

---

# 19. Tables

Shared behaviour: wrapper is a `.blueprint` with `padding:2px 12px 6px`; header 11px uppercase
60% ink; row rule 8% ink; hover 4% ink; row height ≈38px dense / 44px default; numeric columns
right-aligned; the last column is a right-aligned action group of 28px icon buttons.

| Table | Columns | Sort | Filter | Notes |
|---|---|---|---|---|
| **Reports** | Document № · Supplier · Visit date · Employee · Status · Completion · Last edit · Actions | any column, default last edit desc | status, employee, supplier, period, completion | completion = 60px bar + % |
| **Suppliers** | Company · City · Region · Employees · Factory · Capacity/yr · Certification · Sales contact · Status · Actions | any column, default company asc | country, region, status, certification, data sheet | `min-width:1180px`, wrapper scrolls |
| **Certificates** | Certificate · Number · Issue · Expiration · Status · File | name asc | status | in the report editor this table is replaced by photo cards (§ below) |
| **Templates** | Template · Version · Uploaded by · Date · Status · Actions | date desc | status | one Active row highlighted `--color-accent-100` |

Pagination: 25 rows per page with a right-aligned pager; **[INFERRED]** — the prototype's data
fits on one page. Selection: checkbox column only where bulk actions exist (photos, findings).
Responsive fallback: card list (§18).

**Certificates in the report editor** are photo-first, not a table: a drop zone
("Drop certificate photos or scans here · JPG, PNG or PDF page · one certificate per image ·
fields are read automatically") over a card grid `minmax(404px,1fr)`. Each card = an 86×112px
image slot + the extracted fields (Certificate no., Issue, Expiry) as compact inputs +
a read line and a `Confirm data` button. Unconfirmed OCR fields use the accent-100 /
accent-400 treatment and the line "Read from photo · 86% — check the dates". Editing a field
manually marks it "entered manually".

---

# 20. Modals and drawers

| Surface | Type | Width | When |
|---|---|---|---|
| Create Report | modal, 2 steps | 560px | from dashboard / reports / supplier |
| AI Suggestion Review (comparison) | modal | 900px | any Improve / Generate on a text section |
| Generate Conclusion | modal | 900px | §9 |
| Photo AI Caption / Analysis | modal | 720px | `Analyze` on a photo card |
| Transcript Analysis | modal | 720px | `Analyze Transcript` |
| Export Word | modal | 720px | editor header `Export` |
| Upload Template | modal | 560px | templates page |
| Document Preview | modal | 900px | preview a source document |
| Delete Confirmation | modal | 440px | destructive actions |
| Editor rail (Sources / Assistant) | drawer | 320px | persistent, toggled in the editor header |

Rule: **modal** for a decision that must finish before work continues; **drawer** for
reference material used *while* working. All modals: backdrop `--color-neutral-900` @ 50%,
square dialog on `--color-bg` with `--shadow-lg` and corner marks, Esc to close, focus
trapped, focus returned to the trigger on close, body scroll locked.

---

# 21. Empty states

Copy is exact — short, factual, with the next action.

| Where | Copy | Action |
|---|---|---|
| No suppliers | "No suppliers yet — import a data sheet or add the first supplier." | Import Data Sheet · Add Supplier |
| No reports | "No visit reports yet. A report starts from a supplier and a visit date." | New Visit Report |
| No images (region) | "No images in this section yet — drop photos here or upload from Visit Mode." | Upload Images |
| No transcript | "No transcript attached. Upload a Plaud recording to enable AI extraction." | Upload transcript |
| No certificates | "Declared in the supplier data sheet — no certificate copies collected yet; they are photographed and read during the first visit." | Add Certificate |
| No AI findings | "No findings yet — run Analyze Transcript to extract observations." | Analyze Transcript |
| No template | "No Word template uploaded. Export needs the corporate template." | Upload template |
| No files (supplier) | "No documents uploaded for this supplier yet — presentations, catalogues and licences are collected before the first visit." | Upload |
| No visits (supplier) | "No visits recorded — this supplier is in the database from its data sheet only." | New Visit Report |

---

# 22. Error states

| Failure | Surface | Message |
|---|---|---|
| Save failed | autosave indicator + toast | "Save failed — retrying. Your text is still here." |
| Image upload failed | on the card + toast | "Upload failed — tap to retry. The photo is still on this device." |
| AI generation failed | in the modal | "The AI could not complete this draft. Nothing was changed. Try again?" |
| Transcript processing failed | in the modal | "Transcript analysis failed at 62%. Partial findings were kept — retry to finish." |
| DOCX generation failed | export step turns red | "Export failed while applying the Word template. Nothing was lost — retry." |
| Network unavailable | header banner + autosave state | "Offline — {n} changes queued. They will sync automatically." |
| Backend (Supabase) unavailable | page-level banner | "The server is not responding. Work continues locally and will sync when it returns." |
| Session expired | modal, 440px | "Your session expired. Sign in again — your unsaved work is kept on this device." |

Never blame the user, always state what happened to their data, always offer the retry.

---

# 23. Loading states

| Target | Pattern |
|---|---|
| Page | skeleton of the real layout (header bar, 6 KPI boxes, table rows) — no spinner |
| Table | 6–8 skeleton rows at the real row height |
| Supplier search | inline 14px spinner inside the field, results list dimmed at 45% |
| Report load | editor chrome renders immediately; navigator and content show skeletons |
| Image upload | per-card progress bar over the thumbnail |
| AI | skeleton lines in the output pane + the verb in the button ("Generating…") |
| Transcript analysis | per-category progress list with ticks |
| Word export | the 6-step list of §15 |

Prefer skeletons; reserve spinners for in-button and in-field feedback.

---

# 24. Accessibility

- Focus: `outline: 2px solid var(--color-accent); outline-offset: 2px` on every interactive
  element (`outline-offset: 0` for inputs). Never remove focus styling.
- Keyboard: full tab order; Enter/Space activate; Esc closes modals and the rail; arrow keys
  move between navigator sections and photo grid cells; `⌘/Ctrl+S` forces a save.
- Modals: focus trapped, focus restored on close, `role="dialog"` + `aria-modal="true"` +
  labelled by the title.
- Contrast: body text ≥4.5:1, large text and chrome ≥3:1 (§3.2). Never use `--color-accent`
  for paragraph text on the light ground.
- Labels: every field has a visible `<label>`; placeholders are never the only label.
- Errors: `aria-live="polite"` for autosave and toasts, `aria-live="assertive"` for failures;
  invalid fields carry `aria-invalid` and `aria-describedby` pointing at the message.
- Icon buttons: `aria-label` + `title` (Delete photo, Attach photo, Open supplier…).
- Images: photographs carry their caption as `alt`; decorative marks are `aria-hidden`.
- Touch targets in Visit Mode: ≥44px.

---

# 25. Claude Code Handoff

## Routes
```
/login
/                         dashboard
/reports                  list  (+ /reports/new modal)
/reports/:id/:section     editor — section ∈ general|purpose|company|overview|products|
                          product-images|target|visit|certificates|partners|
                          partner-images|conclusion|appendix
/suppliers
/suppliers/:id/:tab       tab ∈ overview|contacts|products|certificates|files|history
/suppliers/new · /suppliers/:id/edit
/assistant
/templates · /templates/mapping
/settings/:tab            tab ∈ profile|ai|templates|defaults|members|roles|storage
/visit                    mobile Visit Mode (home|camera|note|observation|report)
```

## Component hierarchy
```
<AppShell>                       sidebar 218 + <TopBar 50> + <Outlet>
  <DashboardPage>                <KpiCard>×6, <ReportsTable>, <AttentionList>
  <ReportsPage>                  <FilterBar>, <ReportsTable>, <NewReportModal>
  <EditorLayout>                 <EditorHeader> (breadcrumb, title, <AutosaveIndicator>, actions)
    <SectionNavigator 210>       <CompletionBar>, <SectionRow>×13
    <SectionOutlet>              one component per section id
    <EditorRail 320>             <SourcesPanel> | <AssistantPanel>
    modals: <AiCompareModal> <ConclusionModal> <TranscriptModal> <PhotoAnalysisModal> <ExportModal>
  <SuppliersPage> <SupplierDetail> <SupplierForm>
  <TemplatesPage> <MappingPage> <SettingsPage>
<VisitMode>                      <VisitHeader>, <QuickActionGrid>, <CameraScreen>+<CaptionSheet>,
                                 <ObservationForm>, <NoteForm>, <OfflineQueue>
```

## Reusable components
`Button` (primary/secondary/destructive/ghost/icon) · `Input` · `Textarea` · `Select` ·
`SearchField` · `FilterBar` · `StatusBadge` · `Card` (blueprint frame + corners) · `KpiCard` ·
`DataTable` · `Tabs` · `SidebarItem` · `Breadcrumb` · `Modal` · `Drawer` · `Toast` ·
`ProgressBar` · `CompletionIndicator` · `UploadZone` · `FileRow` · `PhotoCard` ·
`AiSuggestionCard` · `AiCompareModal` · `ObservationCard` · `SupplierPickCard` ·
`FindingCard` · `AppendixCell` · `EmptyState` · `Skeleton` · `ErrorState`.
Build `Card`/`Blueprint` once — the 4 corner marks are a wrapper concern, not per-screen markup.

## Design tokens
Import `_ds/styles.css` or map its `:root` block (§3). Key values: bg `#f2f2f3`, surface
`#e9e9ea`, ink `#1d1f20`, accent `#5980a6`, accent-900 `#1d2d3d`, divider ink@16%,
Barlow / Barlow Condensed, radius 0, borders 1px, shadows only on overlays.

## Breakpoint rules
Desktop ≥1280 is the approved design and the only one specified. Tablet and mobile rules in
§18 are recommendations — confirm before building them.

## Priority screens (build order)
1. App shell + Reports list + Report editor skeleton with autosave
2. Section editors 1–3 and 6 (text + observations) — proves the AI contract
3. Suppliers (list, detail, form, Excel import) — feeds §2
4. Photo managers + Appendix layout/preview
5. Export Word + Templates/mapping
6. Transcript analysis + Conclusion generator
7. Visit Mode

## Interaction rules
- Nothing destructive without a confirm; nothing lost on failure.
- Every list has an empty state and a loading skeleton; never an empty white pane.
- Optional is stated in the UI, not implied: the §4 product table and the §6 Q&A block both
  carry an `Optional` tag and an explicit exclude control.
- Hover and focus are always visible; focus ring is never removed.

## AI behaviour rules
- AI output is a proposal until accepted (§11). No silent writes, ever.
- Always show the confidence and the destination section.
- Every AI surface offers Accept / Edit / Regenerate / Discard and survives a failure without
  touching existing content.

## Autosave rules
- 400ms debounce, one section patched at a time, optimistic UI, version row per save.
- Five indicator states (§7) in a fixed 160px slot in the editor header.
- Offline: queue in IndexedDB, replay on reconnect, keep the count visible.

## Image rules
- Three regions with fixed export geometry (§16); order is print order.
- Captions are required for export completeness; AI captions must be accepted.
- Never silently resize to fit the appendix — warn with the computed maximum (§14).

---

# 26. Constraint

The approved design in this bundle is the source of truth. Do not redesign, do not introduce
a new visual direction, do not add functionality that is not described here. Where something
is visually ambiguous, copy the prototype. Where behaviour is undefined, the items marked
**[INFERRED]** are the recommended answers — raise them rather than inventing alternatives.

---

# Visual Reference

Screenshots of the approved final state of each screen, in `screenshots/`. Captured from
`ODM Supplier Visit.dc.html` at desktop scale (the shell's 1280px layout scaled to fit the
frame) — use them to resolve any ambiguity in the written spec. Nothing was redesigned to
produce them.

| Screenshot | Screen | Route |
|---|---|---|
| `01-dashboard.png` | Dashboard — 6 KPI cards, recent reports, attention column | `/` |
| `02-reports-list.png` | Reports list — filter bar, completion column, row actions | `/reports` |
| `03-new-report.png` | New report, step 1 — supplier picker + document fields | `/reports/new` |
| `04-report-editor.png` | Report editor — navigator 210 + §1 Purpose + Sources rail 320 | `/reports/:id/purpose` |
| `05-editor-visit-relevant-information.png` | §6 — observations, AI findings banner, Q&A bullets (optional) | `/reports/:id/visit` |
| `06-main-products-images.png` | §4.1 photo management — card grid, captions, AI confidence markers | `/reports/:id/product-images` |
| `07-transcript-analysis.png` | Transcript analysis — category groups, findings, Add / Edit & Add / Dismiss | modal over editor |
| `08-ai-suggestion-review.png` | AI text suggestion review — Current vs Suggestion, Discard / Copy / Insert Below / Replace | modal over editor |
| `09-conclusion-generator.png` | Conclusion generator — source picker, structure, tone | modal over §9 |
| `09b-conclusion-generated.png` | Conclusion generator — generated draft awaiting review | modal over §9 |
| `10-appendix-pictures.png` | §10 Appendix Pictures — photo grid with captions and states | `/reports/:id/appendix` |
| `11-appendix-layout-preview.png` | Appendix Layout & Preview — geometry, page previews, 6.5 cm fit warning | appendix layout view |
| `12-export-word.png` | Export Word — template, image quality, file name, included sections | modal over editor |
| `12b-export-processing.png` | Export Word — stepped processing state | modal over editor |
| `13-suppliers-list.png` | Suppliers list — data-sheet columns, status + data-sheet badges | `/suppliers` |
| `14-supplier-detail.png` | Supplier detail — Overview tab, Company Information facts | `/suppliers/:id/overview` |
| `15-add-edit-supplier.png` | Add / edit supplier — Excel import + data-sheet field grid | `/suppliers/:id/edit` |
| `16-mobile-visit-mode.png` | Visit Mode home — action tiles, counters, last photos | `/visit` |
| `17-mobile-photo-capture.png` | Visit Mode camera — section chip, shutter, section select | `/visit` (camera) |
| `17b-mobile-photo-caption.png` | Visit Mode caption sheet — optional caption, starters, AI caption later | `/visit` (after capture) |
| `18-mobile-quick-observation.png` | Visit Mode quick observation — category chips, text, photo attach | `/visit` (observation) |

Login is documented in §1.1; it is the only screen with no screenshot in this set.

---

## Assets

| Asset | Path | Note |
|---|---|---|
| EBARA logo | `assets/ebara-logo.png` | sidebar (inverted), login, DOCX preview header |
| GSO logo | `assets/gso-logo.png` | login left panel (customer-supplied) |
| Pump range cutout | `assets/pumps-cover.png`, `assets/pumps-band.png` | earlier cover art, no longer on the login screen |
| Visit photographs | `assets/photos/f01–f22.jpg` | real HUATONG visit photos used as seed content; not design assets — replace with the customer's library |

## Files in this bundle

| File | What it is |
|---|---|
| `ODM Supplier Visit.dc.html` | The approved prototype — every screen, state and interaction |
| `Design Spec - Handoff.dc.html` | The visual spec sheet (tokens, component contract, AI contract, completion predicates, appendix arithmetic) |
| `_ds/styles.css` | The Industry design-system stylesheet — token source of truth |
| `_ds/_ds_bundle.js` | The design-system component bundle used by the prototypes |
| `support.js` | Runtime required to open the two `.dc.html` files in a browser |
| `README.md` | This document |
| `screenshots/` | 21 reference captures of the approved screens (see Visual Reference) |

To view the prototype: keep the folder structure, serve the folder over HTTP
(`npx serve .`) and open `ODM Supplier Visit.dc.html`. Photographs referenced by
`assets/photos/…` are not bundled — copy them from the design project if you need the
screens fully populated.
