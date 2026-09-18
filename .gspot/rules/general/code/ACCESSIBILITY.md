---
layer: code
preset: rules
title: Accessibility
---

# Accessibility

Accessibility is part of the feature contract, not a final pass.

## Structure

- Use semantic elements and roles: headings in order, landmarks, lists for lists, tables for data,
  native controls (`button`, `a`, `input`, `select`) before custom ones. `enforced-by: html/html-validate`
- Every page has one `h1` and a document language. `enforced-by: html/html-validate`
- Reading order matches visual order. `unenforced`

## Names and descriptions

- Every interactive control has an accessible name. An icon-only control gets a label attribute; a
  form field gets a visible label; an image gets `alt` that states its purpose, or empty `alt` when
  decorative. `enforced-by: html/html-validate`
- Errors and instructions are associated with their field through the platform's description
  mechanism and announced when they appear. `unenforced`
- Do not convey meaning by color, position, shape, or icon alone. State it in text. `unenforced`

## Keyboard and focus

- Everything reachable by pointer is reachable by keyboard, in a sensible order. `unenforced`
- Focus is visible. Do not remove the focus indicator without replacing it. `unenforced`
- Move focus deliberately: into a dialog when it opens, back to the trigger when it closes, to the
  first error on failed submission, to the new content on route change. `unenforced`
- No keyboard traps. Escape closes what Enter opened. `unenforced`

## Motion, size, and contrast

- Respect the reduced-motion preference; animation is decorative or optional. `unenforced`
- Text scales with the user's size preference (Dynamic Type, browser zoom) without clipping. `unenforced`
- Tap and click targets meet the platform minimum size. `unenforced`
- Text and essential graphics meet the platform contrast minimum in every theme. `unenforced`

## Identifiers for tests

- Stable `camelCase` accessibility identifiers (or `data-*` test hooks where the platform has no
  identifier) name the interaction surface, never localized copy, user content, IDs, or tokens. `enforced-by: naming/identifiers`
