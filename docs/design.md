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

## Accent Usage

Accent color is scarce. It should only appear on:

- Primary actions.
- Selected state.
- Active navigation.
- Important status.

Do not use accent colors for decoration.

Most UI should be near-black ink, cool light gray, muted gray, and low-saturation status colors. The interface should feel calm even when the data is operational.

## Brand Frame

The whole product shares one brand frame, defined in `src/lib/esBrandTokens.ts` (`ES_BRAND`) and rendered via `src/components/EsBrandLockup.tsx`.

- Every top-level header is a **pure black bar** (`ES_BRAND.headerBg` = `#000000`) with a subtle bottom hairline (`rgba(255,255,255,0.1)`).
- The header always shows the brand lockup: white logo + `ES Wake` + an area/page subtitle. The page name lives in that subtitle, not as a separate large title in the bar.
- Content sits below on the cool page background (`#f4f5f7`), grouped into white 16px-radius blocks with soft shadows.
- Public surfaces (Shop, Book, LIFF, Guide) and admin all reuse this same frame. Do not hand-roll a new header color or lockup — reuse `EsBrandLockup` + `ES_BRAND`.

The single interactive accent is the brand near-black (`primary[500]` = `#1d1d1f`), used only for primary buttons, selected states, and active nav. Everything else stays neutral.

## Typography

Typography should establish hierarchy before borders or color do.

Use:

- Strong page titles.
- Clear section titles.
- Quiet secondary text.
- Slightly tighter letter spacing for large headings when appropriate.
- Consistent font weight ranges.

Avoid:

- Making every label bold.
- Using color as the only hierarchy tool.
- Small dense text inside too many bordered containers.

## Layout And Rhythm

Spacing should do most of the grouping work.

- Prefer grouped-list rhythm over dashboard card grids.
- Use larger whitespace around page-level groups.
- Use smaller, consistent gaps inside controls.
- Let dense operational data stay scannable, but remove unnecessary frames.
- On mobile, favor iOS-style grouped sections and clear touch targets.
- On desktop, preserve scanning efficiency without reverting to spreadsheet aesthetics.

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

Both files should stay aligned. If the visual direction changes, update this guide first, then adjust tokens.
