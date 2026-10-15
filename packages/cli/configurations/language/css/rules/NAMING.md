# CSS Naming

## Selector and file names

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
- Utility classes, when the project uses a utility system, keep that system's names; do not add hand-written
  utilities beside it.
