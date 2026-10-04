---
title: CSS Naming
---

# CSS Naming

## Selector and file names

<!-- level: all -->

- Name classes for the component or state (`order-card`, `order-card-title`, `is-active`, `has-error`).
- A state class starts with `is-` or `has-`. It is toggled by script and never styled alone.
- Custom properties name the role of the value, not its appearance:
  `--color-surface`, `--space-2`, `--font-size-body`, never `--blue` or `--big-margin`.
- Theme overrides reuse the same property names under a theme selector; they never introduce
  theme-specific property names.
- Keyframe names describe the motion (`fade-in`, `slide-from-start`).
- Name stylesheet files for what they hold (`order-card.css`,
  `tokens.css`, `layout.css`).
- Utility classes, when the project uses a utility system, keep that system's names; hand-written
  utilities are not added beside it.
