# Accessibility

Read this rule when you change a user interface.

## Structure

- Use semantic elements and roles: headings in order, landmarks, lists, tables for data, and
  standard controls such as `button`, `a`, `input`, and `select` before custom ones.
- Every page has one `h1` and a document language.
- Reading order matches visual order.

## Names and descriptions

- Every interactive control has an accessible name. An icon-only control gets a label attribute. A
  form field shows a visible label. An image gets `alt` that states its purpose, or empty `alt` when
  decorative.
- Link each error and hint to its field with `aria-describedby` on the web or `accessibilityHint` on iOS.
  Announce an error when it appears.
- Do not convey meaning by color, position, shape, or icon alone. State it in text.

## Keyboard and focus

- Let keyboard users reach every target a pointer can, in a sensible order.
- Show focus. Do not remove the focus indicator without replacing it.
- Move focus deliberately: into a dialog on open, back to its trigger on close, to the first error
  after a failed submission, and to new content on route change.
- No keyboard traps. Escape closes a dialog, menu, or popover and returns focus to its trigger.

## Motion, size, and contrast

- Honor the reduced-motion setting. No information depends on an animation.
- Text scales with the user's size preference through Dynamic Type or browser zoom without clipping.
- Tap and click targets meet the platform minimum size.
- Text and essential graphics meet the platform contrast minimum in every theme.
