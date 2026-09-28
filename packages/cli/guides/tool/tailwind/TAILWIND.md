---
layer: tool
configuration: css
title: Tailwind CSS
---

# Tailwind CSS

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

## Generated styles

- Verify that source detection covers templates and content containing class names. Tailwind CSS 4
  detects sources automatically; register excluded sources with `@source`. Tailwind CSS 3 uses
  `content` configuration.
- Keep complete class names in source so the scanner can find them.
- Preserve the application's configured dark-mode strategy and verify contrast in both themes.
- When the project configures a class-ordering formatter plugin, let that formatter own ordering.

Use the [source detection documentation](https://tailwindcss.com/docs/detecting-classes-in-source-files)
for the installed major version.

## Styling conventions

<!-- level: all -->

- Use theme tokens for colors, spacing, radii, fonts, and breakpoints. Explain deliberate values
  outside those tokens at their owner.
- Compose component styles with utility classes. Keep reusable theme and utility declarations
  in their configured style owner.
- Use the project's adopted class-merging function when conditional utilities conflict.
  Do not introduce a separate merging implementation.
- Avoid handwritten CSS that duplicates an existing utility without a component requirement.
- Follow the installed Tailwind version's syntax for custom utilities, variants, and plugins.

These conventions require review unless the project declares a corresponding automated rule.
