---
layer: tool
preset: css
title: Tailwind CSS
---

# Tailwind CSS

- The theme is the token source. Colors, spacing, radii, fonts, and breakpoints are declared in
  the theme configuration and referenced by name. An arbitrary value (`w-[13px]`,
  `text-[#3b82f6]`) is a finding unless it carries a reason comment. `enforced-by: css/stylelint`
- Class order follows the official ordering plugin; the formatter owns it and a hand-ordered list
  is not reviewed. `enforced-by: css/stylelint`
- Component styles are composed in the component with utility classes. `@apply` is for
  base-layer element styles and third-party overrides only, never for a one-off class that one
  component uses. `enforced-by: css/stylelint`
- Variants (`hover:`, `focus-visible:`, `dark:`, breakpoints) are applied on the element they
  affect; no global variant classes on a wrapper. `enforced-by: css/stylelint`
- Conditional classes go through the one class-merging helper the project adopts, never string
  concatenation with ternaries. `enforced-by: css/stylelint`
- The content configuration lists every path that contains class names, including template and
  content files, so purging never drops a used class. `enforced-by: css/stylelint`
- Custom utilities and plugins live in the configuration, named like the built-ins, and are
  documented where the theme is. `enforced-by: css/stylelint`
- No hand-written CSS that duplicates a utility. Hand-written CSS is for what utilities cannot
  express, in a scoped stylesheet. `enforced-by: css/stylelint`
- Dark mode uses one strategy (`class` or `media`) for the whole application. `enforced-by: css/stylelint`
