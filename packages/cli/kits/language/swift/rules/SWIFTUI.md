---
title: SwiftUI
---

# SwiftUI

## Architecture

<!-- level: all -->

The architecture makes the app's domain obvious: a reader sees what the app does, not only
framework buckets such as `Views`, `ViewModels`, `Managers`, or `Services`. Keep the project's
chosen UI framework, and use UIKit interoperability where a platform feature requires it, without
rewriting existing UIKit screens.

This rule picks no presentation pattern, such as MVVM or TCA; a project that wants one writes it
down. A view in any pattern renders state and forwards intent. It never reaches a network
client, a database, an SDK singleton, or process-global framework state.

## SwiftUI views

- Keep view-local state in the view when its lifetime matches the view's identity.
  Use `@State`, `@FocusState`, `@GestureState`, and bindings according to their
  ownership and read contracts.
- Keep view-owned state properties private. Inject values owned by a parent
  through the appropriate input or binding.
- Preserve read and actor isolation when state changes.
- Do not store derived state in `@State` when it can be computed from source state.
- Avoid heavy computation in `body`; SwiftUI can evaluate it repeatedly.
- Preserve cancellation and stale-result handling for lifecycle work started with
  `.task`, `.onAppear`, or refresh actions.

### View organization

<!-- level: all -->

- Views render state and forward user intent to the project's operation or state owner.
- Keep business workflows, network calls, database calls, and concrete infrastructure
  construction in their existing owners.
- Group SwiftUI dynamic properties at the top of the view.
- Prefer synthesized memberwise initializers for internal views when their access
  control and API contracts permit them.
- Do not add explicit `@ViewBuilder` to `body`; it is implicit.
- Use `@ViewBuilder` for helper properties or functions that need conditional view branches.
- Omit `else { EmptyView() }` when the missing branch already produces no content.
- Extract subviews by visual responsibility, not to reduce line count.
- Give reusable views explicit inputs instead of hidden dependencies on broad environment objects.
- Keep simple display formatting local. Put reusable or domain-sensitive formatting
  with the behavior that owns it.

## State ownership

<!-- level: all -->

Keep screen and flow state in the project's selected state owner. Use a shared owner
when multiple screens need the same state. A store owns cohesive feature or domain
state; app-wide state belongs in app composition only when it is global, such as
session, theme, or connectivity.

Prefer an enum for mutually exclusive loading states instead of parallel booleans.
Keep transient UI state out of the domain model.

## Shared state correctness

Use a single source of truth or an explicit refresh strategy when multiple views
consume the same domain state. Do not assume that creating a second observable
object keeps it synchronized with the first. Preserve the intended object's lifetime
across view reconstruction and identity changes.

## Accessibility

- Interactive controls get traits, states, and hints when the visible label is not enough.
- `.accessibilityIdentifier()` marks stable UI test targets and important interaction surfaces.
- `.accessibilityHidden(true)` hides only decorative or duplicate content.
- A change to navigation, modal presentation, focus, or a custom control checks the flow with
  VoiceOver.

## Testing SwiftUI behavior

- Test cancellation and stale results for owners that start asynchronous work.
- Never mock SwiftUI or test its framework behavior.
- Test reusable visual states and regressions that ordinary unit tests cannot observe.
- Exercise critical navigation, authentication, submission, purchase, and recovery flows
  through the interface when those features exist.
- UI tests select by accessibility identifier, not localized copy.
- Snapshot recording stays out of committed test runs.
- Never add production defaults, protocols, or parallel model layers only to shorten a test.
