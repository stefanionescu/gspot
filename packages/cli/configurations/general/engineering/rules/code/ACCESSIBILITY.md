---
title: Accessibility
---

# Accessibility

## Structure

- Use semantic elements and roles: headings in order, landmarks, lists for lists, tables for data,
  native controls (`button`, `a`, `input`, `select`) before custom ones.
- Every page has one `h1` and a document language.
- Reading order matches visual order.

## Names and descriptions

- Every interactive control has an accessible name. An icon-only control gets a label attribute; a
  form field gets a visible label; an image gets `alt` that states its purpose, or empty `alt` when
  decorative.
- Link each error and hint to its field (`aria-describedby` on the web, `accessibilityHint` on iOS).
  Announce an error when it appears.
- Do not convey meaning by color, position, shape, or icon alone. State it in text.

## Keyboard and focus

- Everything reachable by pointer is reachable by keyboard, in a sensible order.
- Focus is visible. Do not remove the focus indicator without replacing it.
- Move focus deliberately: into a dialog when it opens, back to the trigger when it closes, to the
  first error on failed submission, to the new content on route change.
- No keyboard traps. Escape closes a dialog, menu, or popover and returns focus to its trigger.

## Motion, size, and contrast

- Honor the reduced-motion setting. No information depends on an animation.
- Text scales with the user's size preference (Dynamic Type, browser zoom) without clipping.
- Tap and click targets meet the platform minimum size.
- Text and essential graphics meet the platform contrast minimum in every theme.
