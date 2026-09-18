---
layer: framework
preset: swift
title: SwiftUI
---

# SwiftUI

## Core iOS philosophy

Architecture must make the app's domain obvious. A reader sees what the
app does, not only framework buckets such as `Views`, `ViewModels`, `Managers`,
or `Services`.

SwiftUI is the default UI framework. UIKit is an interop tool and platform API
surface, not the default app architecture.

SwiftUI does not require a presentation pattern, and this file does not pick one. What it does
require is that a view renders state and forwards intent, which the sections below spell out.

Whichever pattern a project picks, a view must not reach past its own layer into a network client,
a database, an SDK singleton or process-global framework state. That constraint is what the
sections below enforce, and it holds under MVVM, TCA, observable state, or anything else.

A project that wants a named pattern writes it down itself. The distribution does not pick one.

## SwiftUI views

SwiftUI `View` types render state and forward user intent.

Rules:

- Views may own view-local UI state with `@State`, `@FocusState`,
  `@GestureState`, and local bindings.
- Internal SwiftUI views rely on synthesized memberwise
  initializers by keeping injected non-state properties internal, unless access
  control or API stability requires otherwise.
- SwiftUI dynamic properties such as `@State`, `@FocusState`, `@GestureState`,
  `@Environment`, `@EnvironmentObject`, `@Binding`, `@ObservedObject`, and
  `@StateObject` are grouped at the top of the view.
- Dynamic properties that are view-private are `private`.
- Views must not own business workflows, network calls, database calls, SDK
  calls, or durable app state.
- Views must not instantiate concrete infrastructure dependencies.
- Views may start lifecycle work with `.task`, `.onAppear`, or refresh actions,
  and the work delegates to a ViewModel or use case owner.
- Do not add explicit `@ViewBuilder` to `body`; it is implicit.
- Use `@ViewBuilder` on helper properties or functions only when there are
  multiple conditional view branches.
- Do not write `else { EmptyView() }` when an omitted branch produces no
  content.
- Avoid heavy computation in `body`; compute in ViewModel, domain logic, or
  small pure formatting helpers.
- Keep view modifiers and subviews small enough that layout intent remains
  readable.
- Extract subviews by visual responsibility, not just to reduce line count.
- Do not store derived state in `@State` when it can be computed from source
  state.
- Do not use SwiftUI views as service locators by reading many unrelated
  environment objects.
- Avoid reusable views that secretly read broad environment objects. Prefer
  explicit inputs for reusable components.
- View-local formatting is acceptable for simple display strings; reusable or
  domain-sensitive formatting moves to a ViewModel or formatter
  dependency.

## State management

Rules:

- Use `@State` for view-private state that dies with the view.
- Use ViewModel published state for screen or flow state.
- Use feature state owners only when state is shared across multiple screens in
  the same bounded context.
- A shared store is allowed as a feature state owner. It does not replace whatever owns a single
  screen's state.
- Stores are not a dumping ground for all app state. They own cohesive
  feature/domain state.
- App-wide state belongs in app composition only when truly global, such as
  session, theme, routing root, or connectivity.
- Do not duplicate the same domain state across multiple ViewModels without a
  single owner or refresh strategy.
- Prefer explicit state enums for loading flows instead of parallel booleans
  such as `isLoading`, `hasLoaded`, `error`, and `isEmpty` when states are
  mutually exclusive.
- Keep UI-local transient state out of Domain.

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

## Testing

Rules:

- Unit test domain entities, value objects, mapping, use cases, and ViewModel
  behavior.
- Test use cases with mocked repository protocols or boundary clients.
- Test repository mapping separately from use case behavior.
- Test ViewModels by asserting state transitions and user-visible behavior, not
  private method calls.
- Do not mock SwiftUI.
- Do not test trivial getters, setters, or framework behavior.
- Do not add protocols only to make a mock if the boundary to mock is
  lower-level and already injectable.
- Test invalid DTO mapping and external-data validation at boundaries.
- Test cancellation or stale-result behavior for ViewModels that launch async
  tasks.

### Test data and fixtures

Rules:

- Test data makes the behavior under test obvious.
- Prefer private test builders, factory methods, or stubs with sensible defaults
  when model construction noise obscures the test.
- Keep fixture helpers close to the tests unless they are shared intentionally
  across many test files.
- Shared fixture APIs stay small.
- Allow key-path customization helpers only in test targets and only when they
  improve readability.
- Avoid decoding JSON fixtures for ordinary domain tests. Use JSON fixtures when
  testing actual decoding/mapping or preserving an external payload contract.
- Do not add production defaults just to make tests shorter.
- Avoid force unwraps in fixture creation unless the fixture is proving a
  programmer-error invariant.
- Prefer stable IDs, dates, clocks, and deterministic ordering in tests.

```swift
private extension Message {
    static func stub(
        id: Message.ID = .init("message-1"),
        subject: String = "Subject",
        body: String = "Body",
        sender: Person = .stub(),
        metadata: Metadata = .stub()
    ) -> Self {
        Self(
            id: id,
            subject: subject,
            body: body,
            sender: sender,
            metadata: metadata
        )
    }
}
```

Optional key-path helpers belong in test code when they improve readability:

```swift
private extension Message {
    func setting<Value>(
        _ keyPath: WritableKeyPath<Self, Value>,
        to value: Value
    ) -> Self {
        var copy = self
        copy[keyPath: keyPath] = value
        return copy
    }
}
```

These helpers belong in test code unless production preview fixtures already
have a clear owner. Test fixture APIs never become a parallel model layer.

### Unit tests

Rules:

- Domain tests cover value validation, invariants, domain errors, and business
  computed properties.
- Use case tests cover success, repository failure, validation failure,
  cancellation where relevant, and policy decisions.
- Repository tests cover DTO/record mapping and error translation separately
  from use case behavior.
- Network client tests cover URL/path/query construction, HTTP method and
  headers, request body encoding, non-HTTP response, non-2xx status, decoding
  failure, cancellation, and successful DTO decoding.
- ViewModel tests cover initial state, loading state transitions, success state,
  empty state, error state, retry behavior, stale result/cancellation behavior,
  and navigation output or route requests where applicable.
- Coordinator tests cover route stack changes, modal presentation state,
  dismissal, root resets, and deep-link route translation.

### XCTest and Swift testing style

Rules:

- In XCTest, prefer throwing test methods plus `try XCTUnwrap`.
- In Swift Testing, prefer `try #require`.
- Avoid `try!`, force unwraps, and force casts in tests unless the test is
  specifically proving a programmer-error invariant.
- Avoid guard statements in tests when assertion helpers express the failure more
  clearly.
- Test helpers and fixtures are private unless shared intentionally.
- Do not add protocols only to mock a concrete type if a lower boundary can be
  injected.

### UI and snapshot tests

Rules:

- Snapshot test reusable visual states and regressions that unit tests cannot
  cover.
- UI test critical navigation, authentication, submission, purchase, and
  recovery flows.
- Do not mock SwiftUI itself.
- Do not rely on localized copy as UI test selectors; use accessibility
  identifiers.
