# SwiftUI

Read this rule when you change SwiftUI views or state.

## SwiftUI views

- Keep state local when its lifetime matches the identity of the view. Use `@State`, `@FocusState`, `@GestureState`, and
  bindings according to their ownership and read contracts.
- Keep view-owned state properties private. Inject values owned by a parent through the appropriate input or binding.
- Preserve read and actor isolation when state changes.
- Do not store derived values in `@State` when you can compute them from the source state.
- Avoid heavy computation in `body`; SwiftUI can evaluate it repeatedly.
- Preserve cancellation and stale-result handling for lifecycle work started with `.task`, `.onAppear`, or refresh
  actions.

### View organization

<!-- level: all -->

- Views render state and forward user intent to the project operation or the object that holds it.
- Keep business workflows, network and database calls, and concrete infrastructure construction in the types that handle
  them.
- Do not add explicit `@ViewBuilder` to `body`; the compiler provides it.
- Use `@ViewBuilder` for helper properties or functions that need conditional view branches.
- Omit `else { EmptyView() }` when the missing branch already produces no content.
- Extract subviews by visual responsibility, not to reduce line count.
- Give reusable views explicit inputs instead of hidden dependencies on broad environment objects.
- Keep short display formatting local. Put reusable or domain-sensitive formatting with the behavior that owns it.

## State ownership

<!-- level: all -->

Keep screen and flow state in the type the project chose for it. Use a shared store when multiple screens need the same
state. A store owns cohesive feature or domain state. App composition holds only global state, such as session, theme,
or connectivity.

Keep transient UI state out of the domain model.

## Shared state correctness

Use a single source of truth or an explicit refresh strategy when multiple views consume the same domain state. Do not
assume that creating a second observable object keeps it synchronized with the first. Preserve the intended object's
lifetime across view reconstruction and identity changes.

## Accessibility

- Interactive controls get traits, states, and hints when the visible label does not provide enough information.
- `.accessibilityHidden(true)` hides only decorative or duplicate content.
- Ask the user to check navigation, modal presentation, focus, and custom controls with VoiceOver.
