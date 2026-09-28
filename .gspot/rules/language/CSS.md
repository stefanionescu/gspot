---
layer: language
configuration: css
title: CSS
---

# CSS

Validate CSS syntax and values at both levels. Formatting follows the selected
formatter. Naming, layout conventions, and selector preferences apply at `all` or
when declared by the project.

## Correctness and accessibility

- Use valid property names and values. Remove declarations that the browser cannot parse.
- Keep CSS module definitions and their source references consistent.
- Respect `prefers-reduced-motion`; remove nonessential animation when reduction is requested.
- Preserve contrast, visible keyboard focus, and readable content in every supported theme.
- Use logical properties where layout follows the writing direction.
- Verify responsive layouts with long content, enlarged text, and narrow screens.

## Structure

<!-- level: all -->

- Keep shared color, spacing, type, radius, and motion tokens in one owner.
- Keep feature styles with their component or import them through the stylesheet entry.
- Order rules from general styles to component states.

These are design conventions. The generated Stylelint configuration owns the exact
selector and value rules; raw colors and pixel values are not universally prohibited.

## Selectors and layout

<!-- level: all -->

- Prefer class selectors with low specificity.
- Name classes for the component or state; preserve names owned by a utility framework.
- Prefer grid and flexbox for layout. Keep flow content in normal document flow.
- Avoid handwritten vendor prefixes when the declared build pipeline adds them.

## Files

<!-- level: all -->

- Name stylesheets for the component or layer they own, using kebab-case.
- Keep presentation in stylesheets or framework-owned component style blocks.
- Let the framework own style scoping rather than duplicating selectors manually.
