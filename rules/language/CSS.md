---
layer: language
preset: css
title: CSS
---

# CSS

## Structure

- One stylesheet entry per site or application; feature styles are imported from it or scoped
  to their component through CSS modules or the framework's scoping. `enforced-by: css/stylelint`
- Design tokens (color, spacing, type scale, radius, motion) are custom properties declared once
  on `:root` and overridden per theme. A raw color or pixel value outside the token file is a
  finding. `enforced-by: css/stylelint`
- Order rules from general to specific: reset, tokens, base elements, layout, components, states,
  utilities. `enforced-by: css/stylelint`

## Selectors

- Select by class. No ID selectors, no element-qualified classes (`div.card`), no `!important`. `enforced-by: css/stylelint`
- Specificity stays flat: at most one class plus a state pseudo-class per rule. Nest only for
  states and pseudo-elements. `enforced-by: css/stylelint`
- Class names are kebab-case and describe the component or state they style (`order-card`,
  `is-active`), never the visual (`red-text`, `mt-4`) unless the utility system owns that name. `enforced-by: css/stylelint`
- Every class defined is used, and every class used is defined. The gate checks both directions. `enforced-by: integrity/css-usage`

## Layout and values

- Use logical properties (`margin-inline`, `padding-block`, `inset-inline-start`) so
  right-to-left layouts work without overrides. `enforced-by: css/stylelint`
- Size with `rem` for type and spacing, `%` or `fr` for layout, `px` only for borders and
  hairlines. `enforced-by: css/stylelint`
- Layout with grid and flexbox. No floats or tables for layout, no absolute positioning for flow
  content. `enforced-by: css/stylelint`
- Respect `prefers-reduced-motion` and `prefers-color-scheme` through the token layer. `enforced-by: css/stylelint`
- No vendor prefixes by hand; the build adds them. `enforced-by: css/stylelint`

## Files

- Stylesheet files are kebab-case and named for the component or layer they hold. `enforced-by: css/stylelint`
- No inline `style` attributes and no `<style>` blocks in templates outside a documented critical-
  CSS step. `enforced-by: css/stylelint`
