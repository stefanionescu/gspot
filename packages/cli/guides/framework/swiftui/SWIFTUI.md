---
layer: framework
kit: swift
title: SwiftUI
---

# SwiftUI

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

## Core iOS philosophy

<!-- level: all -->

Architecture must make the app's domain obvious. A reader sees what the
app does, not only framework buckets such as `Views`, `ViewModels`, `Managers`,
or `Services`.

Preserve the project's chosen UI framework. Use supported UIKit interoperability where the
platform feature requires it; selecting SwiftUI does not require rewriting existing UIKit screens.

SwiftUI does not require a presentation pattern, and this file does not pick one. What it does
require is that a view renders state and forwards intent, which the sections below spell out.

Whichever pattern a project picks, a view must not reach past its own layer into a network client,
a database, an SDK singleton or process-global framework state. That constraint is what the
sections below enforce, and it holds under MVVM, TCA, observable state, or anything else.

A project that wants a named pattern writes it down itself. The distribution does not pick one.

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

Accessibility is part of the feature contract, not a final pass.

Rules:

- Interactive controls need clear labels, traits, states, and hints when the
  visible label is not enough.
- Use `.accessibilityIdentifier()` for stable UI test targets and important
  interaction surfaces.
- Use `.accessibilityHidden(true)` only for decorative or duplicate content.
- Preserve Dynamic Type unless a fixed size is required by a platform control.
- Keep tap targets large enough for reliable touch interaction.
- Verify important flows with VoiceOver behavior in mind when changing
  navigation, modal presentation, focus, or custom controls.

## Testing SwiftUI behavior

- Assert state transitions and visible behavior, never private method calls.
- Test cancellation and stale results for owners that start asynchronous work.
- Do not mock SwiftUI or test its framework behavior.
- Test reusable visual states and regressions that ordinary unit tests cannot observe.
- Exercise critical navigation, authentication, submission, purchase, and recovery flows
  through the interface when those features exist.
- Use accessibility identifiers for stable UI test selectors instead of localized copy.
- Keep snapshot recording out of committed test runs and inspect reference images.

Test data belongs with its tests. Do not add production defaults, protocols, or parallel
model layers only to shorten a test.
