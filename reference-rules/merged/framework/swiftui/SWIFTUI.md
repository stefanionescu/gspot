---
layer: framework
preset: swift
title: SwiftUI
---

# SwiftUI

## Core iOS Philosophy

Architecture must make the app's domain obvious. A reader sees what the
app does, not only framework buckets such as `Views`, `ViewModels`, `Managers`,
or `Services`.

SwiftUI is the default UI framework. UIKit is an interop tool and platform API
surface, not the default app architecture.

SwiftUI does not require a presentation pattern, and this file does not pick one. What it does
require is that a view renders state and forwards intent, which the sections below spell out.

Whichever pattern a project picks, a view must not reach past its own layer into a network client,
a database, an SDK singleton or process-global framework state. That constraint is what the
sections below enforce, and it holds under MVVM, TCA, observable state or anything else.

A project that wants a named pattern writes it down itself. The distribution does not pick one.

## SwiftUI Views

SwiftUI `View` types render state and forward user intent.

Rules:

- Views may own view-local UI state with `@State`, `@FocusState`,
  `@GestureState`, and local bindings. `enforced-by: swift/swiftlint`
- Internal SwiftUI views rely on synthesized memberwise
  initializers by keeping injected non-state properties internal, unless access
  control or API stability requires otherwise. `enforced-by: swift/swiftlint`
- SwiftUI dynamic properties such as `@State`, `@FocusState`, `@GestureState`,
  `@Environment`, `@EnvironmentObject`, `@Binding`, `@ObservedObject`, and
  `@StateObject` are grouped at the top of the view. `enforced-by: swift/swiftlint`
- Dynamic properties that are view-private are `private`. `enforced-by: swift/swiftlint`
- Views must not own business workflows, network calls, database calls, SDK
  calls, or durable app state. `enforced-by: security/semgrep`
- Views must not instantiate concrete infrastructure dependencies. `enforced-by: security/semgrep`
- Views may start lifecycle work with `.task`, `.onAppear`, or refresh actions,
  and the work delegates to a ViewModel or use case owner. `enforced-by: swift/swiftlint`
- Do not add explicit `@ViewBuilder` to `body`; it is implicit. `enforced-by: swift/swiftlint`
- Use `@ViewBuilder` on helper properties or functions only when there are
  multiple conditional view branches. `enforced-by: swift/swiftlint`
- Do not write `else { EmptyView() }` when an omitted branch produces no
  content. `unenforced`
- Avoid heavy computation in `body`; compute in ViewModel, domain logic, or
  small pure formatting helpers. `enforced-by: swift/swiftlint`
- Keep view modifiers and subviews small enough that layout intent remains
  readable. `enforced-by: swift/swiftlint`
- Extract subviews by visual responsibility, not just to reduce line count. `enforced-by: swift/swiftlint`
- Do not store derived state in `@State` when it can be computed from source
  state. `enforced-by: swift/swiftlint`
- Do not use SwiftUI views as service locators by reading many unrelated
  environment objects. `enforced-by: swift/swiftlint`
- Avoid reusable views that secretly read broad environment objects. Prefer
  explicit inputs for reusable components. `enforced-by: swift/swiftlint`
- View-local formatting is acceptable for simple display strings; reusable or
  domain-sensitive formatting moves to a ViewModel or formatter
  dependency. `enforced-by: swift/swiftlint`

## State Management

Rules:

- Use `@State` for view-private state that dies with the view. `enforced-by: swift/swiftlint`
- Use ViewModel published state for screen or flow state. `enforced-by: swift/swiftlint`
- Use feature state owners only when state is shared across multiple screens in
  the same bounded context. `enforced-by: swift/swiftlint`
- A shared store is allowed as a feature state owner. It does not replace whatever owns a single
  screen's state. `unenforced`
- Stores are not a dumping ground for all app state. They own cohesive
  feature/domain state. `enforced-by: swift/swiftlint`
- App-wide state belongs in app composition only when truly global, such as
  session, theme, routing root, or connectivity. `enforced-by: swift/swiftlint`
- Do not duplicate the same domain state across multiple ViewModels without a
  single owner or refresh strategy. `enforced-by: swift/swiftlint`
- Prefer explicit state enums for loading flows instead of parallel booleans
  such as `isLoading`, `hasLoaded`, `error`, and `isEmpty` when states are
  mutually exclusive. `enforced-by: swift/swiftlint`
- Keep UI-local transient state out of Domain. `enforced-by: swift/swiftlint`

## Accessibility

Accessibility is part of the feature contract, not a final pass.

Rules:

- Interactive controls need clear labels, traits, states, and hints when the
  visible label is not enough. `enforced-by: swift/swiftlint`
- Use `.accessibilityIdentifier()` for stable UI test targets and important
  interaction surfaces. `enforced-by: swift/swiftlint`
- Use `.accessibilityHidden(true)` only for decorative or duplicate content. `unenforced`
- Preserve Dynamic Type unless a fixed size is required by a platform control. `enforced-by: swift/swiftlint`
- Keep tap targets large enough for reliable touch interaction. `enforced-by: swift/swiftlint`
- Verify important flows with VoiceOver behavior in mind when changing
  navigation, modal presentation, focus, or custom controls. `enforced-by: swift/swiftlint`

## Testing

Rules:

- Unit test domain entities, value objects, mapping, use cases, and ViewModel
  behavior. `enforced-by: swift/swiftlint`
- Test use cases with mocked repository protocols or boundary clients. `enforced-by: swift/swiftlint`
- Test repository mapping separately from use case behavior. `enforced-by: swift/swiftlint`
- Test ViewModels by asserting state transitions and user-visible behavior, not
  private method calls. `enforced-by: swift/swiftlint`
- Do not mock SwiftUI. `enforced-by: swift/swiftlint`
- Do not test trivial getters, setters, or framework behavior. `enforced-by: swift/swiftlint`
- Do not add protocols only to make a mock if the boundary to mock is
  lower-level and already injectable. `unenforced`
- Test invalid DTO mapping and external-data validation at boundaries. `enforced-by: swift/swiftlint`
- Test cancellation or stale-result behavior for ViewModels that launch async
  tasks. `enforced-by: swift/swiftlint`

### Test Data and Fixtures

Rules:

- Test data makes the behavior under test obvious. `enforced-by: swift/swiftlint`
- Prefer private test builders, factory methods, or stubs with sensible defaults
  when model construction noise obscures the test. `enforced-by: swift/swiftlint`
- Keep fixture helpers close to the tests unless they are shared intentionally
  across many test files. `enforced-by: swift/swiftlint`
- Shared fixture APIs stay small. `enforced-by: swift/swiftlint`
- Allow key-path customization helpers only in test targets and only when they
  improve readability. `enforced-by: swift/swiftlint`
- Avoid decoding JSON fixtures for ordinary domain tests. Use JSON fixtures when
  testing actual decoding/mapping or preserving an external payload contract. `enforced-by: swift/swiftlint`
- Do not add production defaults just to make tests shorter. `enforced-by: swift/swiftlint`
- Avoid force unwraps in fixture creation unless the fixture is proving a
  programmer-error invariant. `enforced-by: swift/swiftlint`
- Prefer stable IDs, dates, clocks, and deterministic ordering in tests. `enforced-by: swift/swiftlint`

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

### Unit Tests

Rules:

- Domain tests cover value validation, invariants, domain errors, and business
  computed properties. `enforced-by: swift/swiftlint`
- Use case tests cover success, repository failure, validation failure,
  cancellation where relevant, and policy decisions. `enforced-by: swift/swiftlint`
- Repository tests cover DTO/record mapping and error translation separately
  from use case behavior. `enforced-by: swift/swiftlint`
- Network client tests cover URL/path/query construction, HTTP method and
  headers, request body encoding, non-HTTP response, non-2xx status, decoding
  failure, cancellation, and successful DTO decoding. `enforced-by: swift/swiftlint`
- ViewModel tests cover initial state, loading state transitions, success state,
  empty state, error state, retry behavior, stale result/cancellation behavior,
  and navigation output or route requests where applicable. `enforced-by: swift/swiftlint`
- Coordinator tests cover route stack changes, modal presentation state,
  dismissal, root resets, and deep-link route translation. `enforced-by: swift/swiftlint`

### XCTest and Swift Testing Style

Rules:

- In XCTest, prefer throwing test methods plus `try XCTUnwrap`. `enforced-by: swift/swiftlint`
- In Swift Testing, prefer `try #require`. `enforced-by: swift/swiftlint`
- Avoid `try!`, force unwraps, and force casts in tests unless the test is
  specifically proving a programmer-error invariant. `enforced-by: swift/swiftlint`
- Avoid guard statements in tests when assertion helpers express the failure more
  clearly. `enforced-by: swift/swiftlint`
- Test helpers and fixtures are private unless shared intentionally. `enforced-by: swift/swiftlint`
- Do not add protocols only to mock a concrete type if a lower boundary can be
  injected. `unenforced`

### UI and Snapshot Tests

Rules:

- Snapshot test reusable visual states and regressions that unit tests cannot
  cover. `enforced-by: swift/swiftlint`
- UI test critical navigation, authentication, submission, purchase, and
  recovery flows. `enforced-by: swift/swiftlint`
- Do not mock SwiftUI itself. `enforced-by: swift/swiftlint`
- Do not rely on localized copy as UI test selectors; use accessibility
  identifiers. `enforced-by: swift/swiftlint`
