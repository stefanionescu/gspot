# CSS

Read this rule when you change a stylesheet.

## Correctness and accessibility

- Use logical properties where layout follows the writing direction.
- Use relative units and wrapping so long text and large fonts fit.

## Structure

<!-- level: all -->

- Keep shared color, spacing, type, radius, and motion tokens in one file.
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

## Naming

### Selector and file names

<!-- level: all -->

- Name classes for the component or state, such as `order-card`, `order-card-title`, `is-active`, or `has-error`.
- A state class starts with `is-` or `has-`. A script toggles it. Never style it alone.
- Custom properties name the role of the value, not its appearance:
  `--color-surface`, `--space-2`, `--font-size-body`, never `--blue` or `--big-margin`.
- Theme overrides reuse the same property names under a theme selector; they never introduce
  theme-specific property names.
- Keyframe names describe the motion, such as `fade-in` or `slide-from-start`.
- Name stylesheet files for what they hold such as `order-card.css`,
  `tokens.css`, `layout.css`.
- When the project uses a utility system, keep that system's class names. Do not write your own utility classes
  beside it.
