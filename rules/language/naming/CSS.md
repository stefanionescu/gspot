---
layer: language
preset: css
title: CSS Naming
---

# CSS Naming

- Class names are kebab-case and name the component or state (`order-card`,
  `order-card__title` when the project uses BEM, `is-active`, `has-error`). `enforced-by: naming/identifiers`
- A state class starts with `is-` or `has-`. It is toggled by script and never styled alone. `unenforced`
- Custom properties are kebab-case and name the role of the value, not its appearance:
  `--color-surface`, `--space-2`, `--font-size-body`, never `--blue` or `--big-margin`. `enforced-by: naming/identifiers`
- Theme overrides reuse the same property names under a theme selector; they never introduce
  theme-specific property names. `unenforced`
- Keyframe names are kebab-case and describe the motion (`fade-in`, `slide-from-start`). `enforced-by: naming/identifiers`
- Stylesheet files are kebab-case and named for what they hold (`order-card.css`,
  `tokens.css`, `layout.css`). `enforced-by: naming/identifiers`
- Utility classes, when the project uses a utility system, keep that system's names; hand-written
  utilities are not added beside it. `unenforced`
- No abbreviations that drop letters (`btn`, `hdr`, `txt`). `nav`, `id`, and platform words are
  allowed. `unenforced`
