# Tailwind CSS

Read this rule when you change Tailwind CSS classes or configuration.

## Generated styles

- Verify that source detection covers templates and content containing class names. Tailwind CSS 4
  detects sources automatically; register excluded ones with `@source`. Tailwind CSS 3 uses
  `content` configuration.
- Keep complete class names in source so the scanner can find them.
- Preserve the application's configured dark-mode strategy.
- When the project configures a formatter plugin that sorts classes, let it own the order.

Use the [source detection documentation](https://tailwindcss.com/docs/detecting-classes-in-source-files)
for the installed major version.

## Styling conventions

<!-- level: all -->

- Use theme tokens for colors, spacing, radii, fonts, and breakpoints. Explain deliberate values
  outside those tokens where the code uses them.
- Compose component styles with utility classes. Keep reusable theme and utility declarations
  in the configured stylesheet.
- Use the project's adopted class-merging function when conditional utilities conflict.
  Do not introduce a separate merging implementation.
- Avoid handwritten CSS that duplicates an existing utility without a component requirement.
- Follow the syntax of the installed Tailwind version for custom utilities, variants, and plugins.
