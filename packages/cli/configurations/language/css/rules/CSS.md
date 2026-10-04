---
title: CSS
---

# CSS

## Correctness and accessibility

- Use logical properties where layout follows the writing direction.
- Use relative units and wrapping so long text and large fonts fit.

## Structure

<!-- level: all -->

- Keep shared color, spacing, type, radius, and motion tokens in one owner.
- Keep feature styles with their component or import them through the stylesheet entry.
- Order rules from general styles to component states.

## Selectors and layout

<!-- level: all -->

- Prefer class selectors with low specificity.
- Prefer grid and flexbox for layout. Keep flow content in normal document flow.

## Files

<!-- level: all -->

- Keep presentation in stylesheets or framework-owned component style blocks.
- Let the framework own style scoping rather than duplicating selectors manually.
