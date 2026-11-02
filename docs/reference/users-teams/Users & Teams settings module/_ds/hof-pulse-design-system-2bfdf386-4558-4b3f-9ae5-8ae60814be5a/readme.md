# HOF Pulse — Design System

Pulse is a custom CRM built by HOF Global. It covers the usual CRM objects — contacts, companies, deals, tasks, segments — plus marketing email and two agent-driven surfaces (a Prospecting Agent and Workflows). It borrows familiar CRM conventions but is its own product with its own visual language: near-monochrome, very dense, hairline-bordered, with a single blue for identity and links and a small set of signal colours for record state.

This design system is derived from **one real screen**: the Contacts board view. It formalizes what is actually in that screen into tokens and reusable components, and deliberately stops there. It is meant to grow as screens get designed, not to anticipate them.

## Sources

| Source | What it gave us |
| --- | --- |
| `Inspiration.fig` (attached Figma file, mounted read-only) — page `design`, section **"claude please check this"**, frame `MacBook Pro 14" - 1` → `Frame 8` → `Frame 19` (node `1:53`) | The Contacts screen: exact auto-layout values, paddings, radii, borders, type sizes, colours, and the icon vectors. Also page `design` → `Frame 39` (node `2:8`), a small brand lockup study. |
| `uploads/Pulse.svg` | The Pulse logo master — isometric cube mark plus the blue italic "Pulse" wordmark. Copied to `assets/pulse-logo-original.svg`; a trimmed lockup and mark-only crop are derived from it. |
| Written brief | Product context (custom CRM, HubSpot-adjacent conventions but not a HubSpot clone) and the instruction to build progressively from the existing screen. |

No codebase or repository was provided. The Figma file defines **no** Figma components, variables or text styles — the values below were transcribed from the raw frame geometry.

---

## Index

- `styles.css` — the single entry point consumers link. `@import` list only.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `radius.css`, `borders.css`, `elevation.css`, `sizing.css`, `motion.css`, `semantic.css`
- `components/`
  - `core/` — **Icon**, **Button**, **IconButton**
  - `forms/` — **TextInput**, **SearchInput**, **Select**, **FilterDropdown**
  - `navigation/` — **NavItem**, **NavSection**, **Tabs**, **SegmentedControl**
  - `surfaces/` — **Card**, **ContactCard**, **BoardColumn**
  - `data-display/` — **Badge**, **DataTable**
- `ui_kits/pulse-crm/` — the Contacts screen recreated (`index.html`, `AppBar`, `Sidebar`, `ContactsView`, `PlaceholderView`) + its own README
- `guidelines/` — 16 foundation specimen cards (Brand, Colors, Type, Spacing, Icons)
- `assets/` — `pulse-logo-original.svg`, `pulse-lockup.svg`, `pulse-mark.svg`, `icons/figma-reference/` (38 source vectors)
- `SKILL.md` — Agent-Skills front matter so this folder works as a Claude Code skill
- `thumbnail.html` — the homepage tile

Every component directory carries a `<Name>.d.ts` (props contract) and `<Name>.prompt.md` (what & when + usage), plus one `@dsCard` HTML showing its states.

---

## CONTENT FUNDAMENTALS

**Register.** Flat, functional, unadorned. Labels name the thing and stop. There is no marketing voice anywhere in the product surface — no "Let's get started", no exclamation marks, no encouragement.

**Casing.** Sentence case for everything, including buttons and tabs: `Add contacts`, `All contacts`, `Unassigned contacts`, `Sort by`, `Advanced Filters`, `Edit Nav`, `Marketing Emails`. Note the inconsistency in the source itself — `Advanced Filters`, `Edit Nav`, `Marketing Emails` and `Prospecting Agent` capitalize later words while `Add contacts` and `Sort by` do not. Follow the source string when one exists; default to sentence case for new copy. Never SHOUT and never Title Case A Whole Sentence.

**Person.** Neither "I" nor "you" appears. Ownership is expressed by scope words instead: `My contacts`, `Unassigned contacts`, `Company owner`. Where a first-person possessive is needed, `My …` is the established pattern.

**Length.** Labels are one to three words. The only long strings are user-generated (saved view names, record names, emails), so every label container must tolerate overflow.

**Numbers and time.** Counts are bare integers next to their pill: `Lead 28`, `Subscriber 0` — no "28 records", no thousands separators at this scale. Elapsed time is relative and coarse: `2 months ago`, not a date. Absolute dates belong in table columns, never in a pill.

**Shortcuts in copy.** Placeholders can carry their own affordance: `Search ( / )`. Keep the spacing inside the parentheses exactly as written.

**Two placeholder voices, on purpose.** The global bar says `Find or Ask` (it is also the AI entry point). The in-view field says `Search ( / )`. Don't merge them.

**Emoji.** None. Not in labels, not in empty states, not in notifications. State is carried by a coloured pill or an icon.

**Empty states.** The source shows four empty stage columns and adds nothing at all — no illustration, no "Nothing here yet". Keep that restraint: an empty column is just an empty column with a `0`.

**Vibe.** A tool that respects an operator's screen real estate. Nothing explains itself; nothing celebrates.

---

## VISUAL FOUNDATIONS

### Colour
Effectively a greyscale product with three coloured signals.

- **Neutrals do the structure.** Pure black `#000000` for primary actions and the active nav row; `#141414` for the "Add contacts" fill and pill text; `#959595` is the workhorse — every icon, every placeholder, every secondary label; `#EFEFEF` is every border and rule; `#CCCCCC` is the one heavier rule (between filter groups). Surfaces stack in four off-whites: `#FFFFFF` (cards, app bar, sidebar), `#FDFDFD` (control and app-bar input fills), `#FBFBFB` (board columns), `#F8F8F8` (hover).
- **One brand hue.** Pulse blue `#016DE5` — the wordmark, record names, email addresses, links, focus. It is never a button fill. `#E8F3FF` is its pill wash.
- **Signals.** Orange `#DF6800` on `#FFFCF5` is *record age* (the "2 months ago" pill) and the Lead / Marketing Qualified stages. Magenta `#D20688` is Sales Qualified Lead. Red `#FF1140` is only ever an unread count.
- **Stage colour is data.** A stage keeps its tone in every view. Don't recolour for balance.

### Type
DM Sans for all UI; AllureMajestic for the wordmark.

- **DM Sans** carries the entire UI, at **four sizes only**: 13px (record names at 600, page title at 400/29), 12px (everything else), 10px (nav section eyebrows), 9px (notification count). Weights range 300–700 but each has one job: 300 only for the global-search placeholder, 400 default, 500 for filter triggers and pills, 600 for record names, 700 for board counts.
- **AllureMajestic** (`--font-script`) is the "Pulse" wordmark face — supplied as binaries and hosted in `assets/fonts/` (weights 400–800, roman + italic). The app bar still places `assets/pulse-lockup.svg`; use the font when the wordmark must be live type.
- Line heights are literal, not ratios: `100%` for most 12px UI text, `14px` for button labels, `18px` for pills and record names, `24px` for eyebrows and tab labels, `29px` for the page title.

### Spacing and density
The scale is tight and deliberately off-grid: 1, 1.75, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20. Odd values are real — the view toggle is built on 0.875px borders and 1.75px gaps. **Do not round to a 4/8 grid**; the product's density depends on these numbers.

Fixed heights: app bar 45, tab strip 38, board column header 36, filter row 32, **every** control 28, nav row 28, stage pill 20. Fixed widths: sidebar 200, board column 280 (never resizes), in-view search 215, global search 258. Gutters: 20px between board columns, 16px between nav sections, 12/16px page padding.

### Borders, radii, shadow
Borders define surfaces — three widths (0.875px on the right-hand toolbar cluster and view toggle, 1px everywhere else, 1.167px on the edit-filters button), almost always `#EFEFEF`. Radii: **8px is the house radius** (buttons, inputs, icon buttons, cards, board columns), 4px for tabs and filter triggers, 9.33px on one icon button, fully round for stage and activity pills, 14px for the notification count.

**There is exactly one shadow in the source:** `0px 0.875px 7px 0px rgba(20,20,20,0.08)`, on the selected segment of the view toggle. This system reuses it — and only it — for card hover and dropdown menus. There is no second elevation tier. Nothing glows, nothing lifts more than that.

### Backgrounds and imagery
No background images, no gradients, no textures, no patterns, no illustration. Surfaces are flat fills separated by hairlines. The only artwork in the product is the cube mark. If a future screen needs imagery, it should be real customer/product photography at small scale, not decoration — and it has no precedent here, so ask.

### Transparency and blur
None in the source. Two transparent-border tricks appear (`rgba(20,20,20,0)` on ghost triggers, transparent hairlines on the unselected toggle segment) purely to reserve layout space. No frosted panels, no scrims, no blur. Overlays, when they arrive, should be white with a 1px border and the one shadow.

### Interactive states
The source is a static frame, so states are this system's house rules, chosen to match its character:

- **Hover** — primary buttons darken the fill (`#000` → `#1C1C1C`); secondary/ghost controls tint their surface to `#F8F8F8`; nav rows tint the same way; table rows tint; clickable cards raise the one shadow. No colour shifts, no scaling.
- **Press** — one step further on the same axis (`#303030` primary, `#EEEEEE` secondary). Never a transform.
- **Focus** — border goes Pulse blue with a soft `0 0 0 2px rgba(1,109,225,0.28)` ring. Geometry never changes.
- **Selected** — signalled twice where it matters: the active nav row fills black *and* flips its label and glyph to white; a selected tab darkens its label *and* gains a 1px black underline; the selected toggle segment gets a hairline *and* the shadow.
- **Disabled** — 40% opacity, default cursor. No greyed palette variants.

### Motion
The source specifies none, so the system stays quiet: 100–140ms on colour and border properties only, `cubic-bezier(0.2,0,0.2,1)`. No bounce, no spring, no entrance animation, no skeleton shimmer. Layout does not animate. If a panel needs to appear, it appears.

### Layout rules
The app bar is fixed at the top full-bleed; the sidebar is fixed 200px on the left and scrolls independently; the content column is the only thing that scrolls vertically, and a board scrolls horizontally inside it. The title row, tab strip, toolbar and filter row are stacked and stationary — the collapse-header button exists to trade them away for board height. The design canvas is 1512×982 (MacBook Pro 14").

---

## ICONOGRAPHY

**One icon per view type.** A view type owns a single glyph across the whole product: `board` (Kanban) and `table` are the same icon in the view switcher, in the view tab strip, and anywhere else a view is referenced. Never introduce a second glyph for a view type that already has one.

**Style.** A single outline family: thin, even stroke (roughly 1.2–1.5px at a 16px box), rounded joins, no fills, no duotone, no colour. Every glyph is monochrome and takes its colour from context — `#959595` at rest, white on the active nav row, Pulse blue in a contact card's email row, orange inside an activity pill. Nothing in the product uses a coloured or illustrated icon.

**Sizes are strict and small:** 16px in the sidebar, 14px in buttons / inputs / app bar, 12px in the dense filter row, 10.5px in the view toggle, 10px for the app-bar search and section chevrons, 6px for the org-switcher chevron. Icon boxes are the size — glyphs are not padded inside a larger square.

**No icon font, no sprite.** In Figma the glyphs are flattened vector paths, several stored as multiple path fragments (a gear is an outer ring plus a centre dot; the address-book icon is two paths). All 38 source vectors are copied verbatim into `assets/icons/figma-reference/` as ground truth — a few render partially on their own because they are fragments of a composed glyph.

**Substitution — please read.** Because the source glyphs are un-composable fragments with no names, runtime rendering uses **[lucide-static](https://lucide.dev) 0.454.0** from unpkg, masked to `currentColor`, as the closest available CDN match to the source's stroke weight and outline style. `components/core/Icon.jsx` maps semantic Pulse names (`contacts`, `deals`, `board`, `activity`…) onto Lucide slugs, so swapping in a real Pulse icon set later means editing one map. **This is a substitution, not the brand's set** — if HOF has the original icon library (or an export from the design file), replacing it is the single highest-value fix to this system.

**Emoji and Unicode as icons:** never. The one non-glyph symbol in the product is the `/` inside the search placeholder, which is literal text.

**Brand mark.** `assets/pulse-mark.svg` (cube only) and `assets/pulse-lockup.svg` (cube + wordmark) are mechanical crops of the supplied `uploads/Pulse.svg` — no redrawing. The app bar renders the lockup at 15px tall. There is no supplied reversed/white master; on black, invert the mark and note it.

---

## Intentional additions

Only two things here have no direct counterpart in the source screen:

- **`Icon`** — a wrapper so glyph names and sizes are a single decision point, and so the substituted set can be swapped out in one place.
- **`DataTable`** and **`Select`** — the source shows the table-view toggle and a `Company owner` dropdown trigger, but not the table body or an open menu. Both are conventional B2B interpretations built strictly from this system's tokens. Treat them as provisional until a real table screen is designed.

Everything else — Button, IconButton, TextInput, SearchInput, FilterDropdown, NavItem, NavSection, Tabs, SegmentedControl, Card, ContactCard, BoardColumn, Badge — is lifted directly from the Contacts screen.

## Known gaps

- The contact cards inside the Lead column exist in the Figma frame but their content is instance-override data that did not survive extraction. Their geometry is read from the rendered frame, so padding/gap values there are the least certain numbers in this system.
- DM Sans loads from Google Fonts; AllureMajestic is self-hosted from `assets/fonts/`.
- No dark theme, no responsive/mobile rules, and no components for modals, timelines, kanban drag, date pickers or activity feeds — none are designed yet. Extend when a screen needs them.
