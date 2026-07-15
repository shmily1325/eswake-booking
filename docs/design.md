# ES Wake Visual Design Guide

This guide defines how UI work should be approached in ES Wake. It is written for product and interface decisions, while `src/styles/designSystem.ts` is the implementation layer for tokens and reusable styles.

The target feeling is:

- Premium
- Calm
- Minimal
- Spacious
- Human

The product should feel closer to Apple, Airbnb, iOS, Linear, and Notion than a typical internal admin dashboard.

## Non-Negotiable Scope

Most UI work in this product is visual refinement. Do not change business behavior unless explicitly requested.

- Do not change data flow, Supabase queries, hooks, routing, validation, or business logic for a visual redesign.
- Do not add or remove features while restyling a page.
- Preserve existing user flows, button behavior, form behavior, and conditional rendering.
- Prefer styling existing structure before reworking the component tree.
- If a visual improvement requires changing behavior, stop and discuss it first.

## Design Thinking Workflow

Before implementing any page, write down the design thinking first.

1. Explain the three biggest reasons the current UI feels like an admin dashboard.
2. Explain how the redesign improves information hierarchy.
3. Describe the primary user task for this page.
4. Only then implement the UI.

After implementation:

- Briefly critique the result.
- Mention what could still be improved.

This sequence matters. Start from user experience, then information hierarchy, then visual design, and only then code.

## Primary Design Principles

Prioritize hierarchy, rhythm, and whitespace over decoration.

- Use spacing before borders.
- Use typography before color.
- Use hierarchy before icons.
- Prefer removing visual elements over adding them.
- Use cards only when they improve comprehension.
- Avoid wrapping every section in its own card.
- Every section should have a clear visual purpose.
- Nothing should exist only because "admin systems usually have it."

## Information Hierarchy

Every page should have a clear answer to:

- What is the primary task?
- What should the user notice first?
- What is secondary context?
- What is rarely needed and should be quiet?

Not everything deserves equal emphasis.

Use:

- Larger headings for page or section purpose.
- Quiet secondary text for explanation.
- Minimal bold text.
- One clear primary action.

Avoid:

- Multiple equally loud buttons.
- Overusing badges.
- Highlighting helper text as if it were urgent.
- Tables or grids when a grouped list would be easier to scan.

## Noise Reduction

Reduce visual noise whenever possible.

Remove or quiet:

- Decorative icons that do not improve recognition.
- Emoji used as UI decoration.
- Repeated borders.
- Heavy shadows.
- Blue or purple gradients.
- Glassmorphism.
- Large colored warning blocks.
- Dashboard-style statistic cards unless they support a real decision.

Keep icons functional. If the label is already clear, the icon is usually unnecessary.

### Do not quiet interactive controls into invisibility

Calm does **not** mean “selected looks like a button, unselected looks like plain text.”

Binary / multi-choice controls (例如記帳的 **增加／減少**、表單 choice chips) must keep a **visible frame on every option**, even when not selected:

- Unselected: solid white (or light) fill + readable border — never transparent-on-gray `outline` that disappears into the page background.
- Selected: clear fill + stronger border (reuse `getBookingChoiceStyle` / booking choice tokens when appropriate).

If a quiet pass makes operators ask “按鈕不見了？”, the quieting went too far. Prefer slightly more chrome on controls over decorative noise elsewhere.

**Incident note (2026-07):** Transaction dialog `outline` unselected + white `secondary` selected on a light gray form made **增加** look missing while **減少** still looked like a pill. Fixed by using choice-chip chrome for both states.

## Accent Usage

Accent color is scarce on most surfaces. It should only appear on:

- Primary actions.
- Selected state.
- Active navigation.
- Important status.

Do not use accent colors for decoration.

Most UI should be near-black ink, cool light gray, muted gray, and low-saturation status colors. The interface should feel calm even when the data is operational.

**Exception — booking forms** (新增／修改／重複預約): keep **semantic multi-color** so operators retain muscle memory. Do not flatten form selection to near-black. Soften with design-system tonal scales instead of bright stock blues/oranges (`#3b82f6`, `#007bff`, `#ff9800`, `#1976d2`). See [Booking Forms](#booking-forms).

## Brand Frame

The whole product shares one brand frame, defined in `src/lib/esBrandTokens.ts` (`ES_BRAND`) and rendered via `src/components/EsBrandLockup.tsx`.

- Every top-level header is a **pure black bar** (`ES_BRAND.headerBg` = `#000000`) with a subtle bottom hairline (`rgba(255,255,255,0.1)`).
- The header always shows the brand lockup: white logo + `ES Wake` + an area/page subtitle. The page name lives in that subtitle, not as a separate large title in the bar.
- Page subtitles in `PageHeader` are plain text without decorative emoji.
- Header navigation remains responsive: desktop buttons use text labels, while space-constrained mobile buttons may use recognizable emoji as functional link icons. Keep their accessible text labels (`aria-label` and `title`) intact.
- Content sits below on the cool page background (`#f4f5f7`), grouped into white 16px-radius blocks with soft shadows.
- Public surfaces (Shop, Book, LIFF, Guide) and admin all reuse this same frame. Do not hand-roll a new header color or lockup — reuse `EsBrandLockup` + `ES_BRAND`.

The single interactive accent for **chrome and primary CTAs** is the brand near-black (`primary[500]` = `#1d1d1f`): primary buttons, active nav, and most non-form selected states. Booking form selection uses the muted `info` / `warning` / `success` scales instead (see below).

## Booking Forms

Applies to shared selectors used by **New / Edit / Repeat** booking dialogs (`BoatSelector`, `CoachSelector`, `MemberSelector`, `TimeSelector`, `DateMultiPicker`, `BookingDetails`).

### Intent

- Keep the familiar multi-color language (selected ≈ cool blue-gray, practice ≈ warm, success cues for members).
- Align structure: same spacing, radius, border weight, and label rhythm as the rest of the product.
- Soften harsh default UI colors by mapping onto `designSystem` status scales.
- Do not change conflict checks, validation, or submit/delete flows for a visual pass.

### Color roles

| Role | Token scale | Where |
|------|-------------|--------|
| Selection / choice chips | `info` (`50` fill, `500` border, `700` text) | Boat, coach, duration, activity type, calendar selected day |
| Flag: 教練練習 | `warning` | Boxed checkbox block |
| Flag: 需要駕駛 | `info` | Boxed checkbox block (same box chrome as 教練練習) |
| Member selected chips | `info` | Solid border chips |
| Non-member selected chips | `warning` | Dashed border chips (`50` fill, `500` dashed border, `700` text) |
| Member “has selection” | `success` | Count hint, search border when members selected |
| Manual non-member add | `warning` | Input border + add button (same family as non-member chips) |
| Weekend hints in calendar | `danger[700]` Sunday, `info[700]` Saturday | Labels / unselected day text only |

Implement via helpers in `designSystem.ts`:

- `getBookingChoiceStyle(selected)` — choice / chip selected state
- `getBookingFlagBoxStyle(active, 'info' \| 'warning')` — boxed flags

Do not reintroduce one-off hex blues/oranges in these components.

### Boxed flags (keep the frame)

Operators prefer **教練練習** and **需要駕駛** to stay in a visible box. Keep the box; make both boxes identical in structure:

- Same padding (`spacing.md`), radius (`borderRadius.lg`), idle vs active border weight (`1px` idle / `1.5px` active)
- Idle: `background.main` + `border.light`
- Active: tone `50` fill + tone `500` border
- Title + short helper text inside; checkbox `accentColor` matches the tone

Do not strip these back to borderless plain rows unless product explicitly asks.

### Dialog chrome vs form body

- **Form body:** multi-color semantic selection (above).
- **Footer actions:** calm product chrome — `getButtonStyle`; Edit uses equal-width **刪除｜取消｜確認更新** on one row (mobile and desktop).
- **Safari:** footer `paddingBottom` must include safe area, e.g. `max(40px, calc(env(safe-area-inset-bottom, 0px) + 24px))`, with touch targets ≥ 48px on mobile.
- Conflict validation UI stays; do not weaken or remove it for styling.

### Shared components first

Visual changes to booking forms should land in the shared `src/components/booking/*` pieces so New / Edit / Repeat stay consistent. Avoid styling the same control three different ways inside each dialog. Prefer composing `MemberSelector`, `BoatSelector`, `CoachSelector`, `TimeSelector`, and `BookingDetails` rather than inlining duplicate markup.

## Typography

Typography should establish hierarchy before borders or color do.

Use:

- Strong page titles.
- Clear section titles.
- Quiet secondary text.
- Slightly tighter letter spacing for large headings when appropriate.
- Consistent font weight ranges.
- **`designSystem.fontSize` / `getFontSize(variant, isMobile)` as the only size source** — do not invent one-off `12px` / `14px` / `16px` in page styles.

### Type scale

Implemented in `src/styles/designSystem.ts`. Mobile / desktop:

| Token | Mobile | Desktop | Role |
|-------|--------|---------|------|
| `display` | 34 | 48 | Hero / large metrics |
| `h1` | 24 | 32 | Page-level title (rare; header uses brand lockup) |
| `h2` | 19 | 24 | Major section / dialog title |
| `h3` | 16 | 18 | Section heading / menu card title |
| `bodyLarge` | 16 | 17 | Emphasized body / key numbers in lists |
| `body` | 14 | 15 | Default reading text |
| `bodySmall` | 12 | 13 | Secondary / meta / nav chrome |
| `caption` | 11 | 12 | Hints, badges, timestamps |
| `button` | 13 | 14 | Button labels |

Exceptions that may stay fixed:

- Form `input` / `textarea` / `select` at **16px** on mobile (iOS zoom prevention).
- Monospace for code / raw audit payloads.
- Print / label export fonts (`LABEL_FONT`) when canvas measurement requires a system stack.

Avoid:

- Making every label bold.
- Using color as the only hierarchy tool.
- Small dense text inside too many bordered containers.
- Hardcoding font sizes that duplicate the table above.

## Layout And Rhythm

Spacing should do most of the grouping work.

- Prefer grouped-list rhythm over dashboard card grids.
- Use larger whitespace around page-level groups.
- Use smaller, consistent gaps inside controls.
- Let dense operational data stay scannable, but remove unnecessary frames.
- On mobile, favor iOS-style grouped sections and clear touch targets.
- On desktop, preserve scanning efficiency without reverting to spreadsheet aesthetics.

### Choose page width by task

Page widths are not meant to be globally identical. Pick the narrowest width that supports the page's primary task:

- `hub`: launchers such as Home and BAO.
- `focused`: search, reading, editing, and single-column card workflows.
- `content`: standard management lists, product/member workflows, and medium-density tables.
- `dashboard`: pages that need simultaneous comparison across several summary columns.
- `wide`: schedules, assignments, and dense operational matrices.

Related pages in the same workflow should not visibly jump in width without a functional reason. Do not widen a page simply because more screen space is available, and do not narrow schedules or matrices that genuinely benefit from horizontal space. Use `PageShell` and `PAGE_MAX_WIDTHS` rather than one-off `maxWidth` values.

## Component Consistency

Reuse existing visual patterns.

- Prefer `designSystem.ts` tokens and shared primitives.
- Avoid one-off colors, shadows, radii, and button styles.
- If a pattern appears twice, consider whether it belongs in a shared component or helper.
- Every page should feel like it belongs to the same product.

If a screenshot is taken without context, it should resemble a thoughtfully designed product, not an AI-generated CRUD dashboard.

## Common Dashboard Smells

When reviewing a page, look for these first:

1. Too many framed containers competing for attention.
2. Too many bright status colors, icons, badges, or helper boxes.
3. A layout organized around database objects instead of the user's task.

Fix these by clarifying the primary task, reducing decoration, and letting spacing and typography create structure.

## Page Review Template

Use this before changing a page:

```md
### Current Dashboard Feel
- Reason 1:
- Reason 2:
- Reason 3:

### Information Hierarchy
- Primary thing the user should see:
- Secondary context:
- Quiet/rare actions:

### Primary User Task
The user comes here to:

### Visual Direction
- What to remove:
- What to quiet:
- What to emphasize:
```

Use this after changing a page:

```md
### Self-Critique
- What improved:
- What still feels too noisy:
- What could be refined next:
```

## Relationship To `designSystem.ts`

Use this guide to decide what the UI should feel like. Use `src/styles/designSystem.ts` to implement that direction consistently.

`design.md` answers:

- Why should this page look this way?
- What should be emphasized?
- What should be removed?
- What should feel quieter?

`designSystem.ts` answers:

- Which colors should be used?
- Which radius, shadow, and spacing values are available?
- How do shared buttons, cards, badges, inputs, and page surfaces render?
- Booking form helpers: `getBookingChoiceStyle`, `getBookingFlagBoxStyle`
- Typography sizes: `getFontSize` / `getFontSizePx` / `designSystem.fontSize`

Both files should stay aligned. If the visual direction changes, update this guide first, then adjust tokens.
