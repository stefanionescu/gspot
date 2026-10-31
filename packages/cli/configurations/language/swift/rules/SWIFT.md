# Swift

Read this rule when you change Swift code.

Swift source follows the Apple API Design Guidelines and the local formatting and lint configuration. SwiftFormat owns
layout. Treat warnings as errors in the build settings.

## Files and style

Every file imports exactly the top-level modules it uses. Import whole modules unless a single declaration avoids a
known conflict. Group imports by compiler condition, with `@testable import` after regular ones in tests.
`// MARK: - Section` marks meaningful groups in larger files. Write a header comment only where several abstractions
share the file and their arrangement needs explanation.

Rely on inference when the right-hand side has a clear type. Add an explicit annotation for empty collections, `nil`
initial values, weak type information, and public API clarity. Document enum raw values that map to an external wire or
persistence contract. Replace `default` with an explicit list where a future case must force review. Put an attribute
with parameters on its own line when it hurts readability inline.

### File organization

<!-- level: all -->

One primary top-level type per file, with small private helpers allowed beside it. Put `private` and `fileprivate`
top-level functions above the other functions of the file. Keep overloads adjacent. Organize extensions rather than
scattering them across files. Group SwiftUI dynamic properties by wrapper type.

## Practices

Use `let` by default and `var` for required mutation. Class-constrained protocols use `AnyObject`. Prefer shorthand
types such as `[Element]`, `[Key: Value]`, or `Wrapped?`, and `Void` in function signatures. Use an optional, not a
sentinel, for a value that the program can omit. Compare it to `nil` when only presence matters, bind it when the code
uses the value, and chain it for one-off access.

A force unwrap or cast needs a proven invariant. Avoid global mutable state: prefer `static let` or a computed
`static var` to a stored one.

Use `guard` for early exits and `for ... where` for a loop with one condition. Prefer `for` to `forEach` for control
flow or async work. `map`, `compactMap`, and `filter` express side-effect-free transformation. Pattern bindings put
`let` on each element where that avoids ambiguity.

Use weak capture only when a callback must not extend the lifetime of an object it holds. Otherwise, capture the
immutable values the callback needs. Use `#fileID` in production logs and `#filePath` only in tests and tools. Overload
operators only with their standard meaning. Define a custom operator only for standard domain notation.

### Force unwraps

<!-- level: all -->

When the code needs a force unwrap, put `// swiftlint:disable:next force_unwrapping - reason: <the invariant>.` on the
line above it, as SUPPRESSIONS.md requires.

### API and ownership conventions

<!-- level: all -->

Structs keep synthesized memberwise initializers where sufficient. Value types hold data without identity. Write a class
only for identity, reference semantics, lifecycle, observable state, or framework requirements. An implicitly unwrapped
optional appears only for Apple lifecycle cases such as `@IBOutlet`, Objective-C nullability gaps, and test data.

Declare top-level access to match the public contract. An extension carries no blanket access modifier. Nest a type when
it makes sense only inside its parent. Use a caseless enum only for closely related statics. Prefer methods and
properties to free functions, except a symmetric function that follows the standard library.

## Networking

Build URLs with `URLComponents` or a typed endpoint value, never concatenated query strings. A production
`URL(string:)!` documents its invariant. Inject base URLs and credentials at composition. Use `Encodable` types for
request bodies with an explicit method and content type, never `[String: Any]`. `URLSession` succeeds for non-2xx
responses. Validate `HTTPURLResponse` status explicitly, and treat a non-HTTP response as a transport failure.

Responses decode into data transfer objects, or DTOs, mapped into domain values at the boundary. Validate required
fields and external enum values there. Do not invent a fallback ID, date, or case. Clients expose typed errors for
encoding, decoding, transport, an invalid response or status, and cancellation. Cancellation stays distinct when
navigation supersedes a task.

### Networking ownership

<!-- level: all -->

A network client owns base URL, path construction, query items, method, headers, body encoding, transport calls, status
validation, and decoding. Never build a `URLRequest`, call `URLSession`, decode a DTO, or inspect a status in a view or
a view model. Prefer Foundation `URLSession` with async/await rather than a third-party networking framework.

## Doc comments

`///` documents a declaration before its attributes and modifiers. Swift markup uses `- Parameter name:`,
`- Parameters:`, `- Returns`, and `- Throws`. Backticks name parameters and types. `// MARK:`, implementation notes, and
tool directives use ordinary `//` comments.

The doc comment of a `public` or `open` function or initializer documents each parameter with `- Parameter name:` or
an item of a `- Parameters:` list.

## Concurrency and errors

Structured `async`/`await` with `async throws` APIs replaces callback pyramids and unmanaged task trees. UI state
mutates on the main actor. When the project uses view models, keep them `@MainActor`.

Expensive work moves into use cases, repositories, actors, or background tasks. Create a `Task` only in the modules that
need one: view models, coordinators, or views through `.task`, never in an initializer. An object always holds and
cancels it. Store handles when a disappearing view, a retry, or a newer request must cancel older work. Check
cancellation in long loops and before publishing stale results.

Shared mutable state sits behind actors, main-actor isolation, or explicit synchronization. Prefer actor isolation to
`DispatchQueue.main.async`. The compiler verifies `Sendable` designs. A module without concurrency annotations gets
`@preconcurrency import`. `@unchecked Sendable` or `nonisolated(unsafe)` appears only with a documented local invariant
and no safer option. Inject clocks and scheduling interfaces where time affects logic or tests.

Typed errors serve callers with different recovery paths, and untyped `Error` only generic boundaries where cases add
nothing. Failed operations throw, and UI loading and error display use explicit state enums. Reserve `fatalError` for an
unrecoverable programmer error with a documented invariant, `assertionFailure` for an unexpected but recoverable state,
and `precondition` for a condition that continuing requires.

## Naming

<!-- level: all -->

### Case, scope, and files

Express privacy through access modifiers, not an underscore.

Express a structural relationship through nesting rather than a longer top-level name: `Parser.Error`, not `ParseError`.
A static property does not repeat its declaring type: `UIColor.primary`, not `UIColor.primaryColor`. Use `shared` and
`default` only when they describe the role.

### Roles

These Swift role words have one meaning:

| Role word        | Use when                                                                               |
| ---------------- | -------------------------------------------------------------------------------------- |
| `View`           | SwiftUI or UIKit view type that presents UI.                                           |
| `ViewController` | UIKit screen controller.                                                               |
| `ViewModel`      | Holds presentation state and user intent for one screen, flow, or cohesive surface.    |
| `ViewState`      | Value describing screen presentation state.                                            |
| `ViewAction`     | Typed user or lifecycle intent sent by a view.                                         |
| `Coordinator`    | Holds navigation or flow state.                                                        |
| `Router`         | Route mutation or destination-selection boundary, narrower than a coordinator.         |
| `DataSource`     | UIKit list adapter that feeds rows and sections.                                       |
| `CellModel`      | Values a reusable cell renders: strings, image references, state, and lightweight IDs. |

Repository protocols use domain language, results, and operations, such as `TemplateRepository.get(id:)`. An
implementation may name its technology, such as `HTTPTemplateRepository`, when several real variants exist. Client types
own external API or SDK mechanics such as `TemplateAPIClient`. Coordinators own route state, destination construction,
stack mutations, and presentation flow such as `TemplateCoordinator.showEditor()`. Keep route enums within their feature
and name them for the flow. Give them stable domain identifiers such as `TemplateDestination.editTemplate`, never view
models, views, repository implementations, SDK clients, database records, or DTOs.

### Method names

When the project uses view models, name a direct UI event for what happened, such as `submitButtonTapped()`,
`cameraPermissionDenied()`, or `selectedItemChanged(to:)`. Name domain work with a verb such as `enqueueFileUpload(_:)`,
`refreshOrderHistory(for:)`, or `validateEmailAddress(_:)`. `handle`, `process`, and `didTap` describe neither. Reserve
`handle...` for literal UIKit target-action and notification handlers marked `@objc`.

### Protocols and identifiers

A protocol carries no `I` prefix and no `Protocol` suffix. Name a domain role with a noun such as `TemplateRepository`.
Name a capability for its behavior, often with `-ing`, such as `ProgressReporting`, `ThemeColorProviding`, or
`LoginCoordinating`. Avoid an automatic `-able` name that describes no clear capability. `Provider`, `Repository`,
`Client`, and `Coordinating` appear only when the protocol serves that role.

Presentation identifiers provide stable interfaces for UI identity, diffable data sources, navigation, persistence, and
tests. Name them for what they identify, not for the framework that consumes them. Give snapshot items stable
presentation or domain IDs, never DTO identity, array offsets, or index paths. `id` suffices when the enclosing type
supplies the context, such as `MessageRow.id`. A role-qualified name such as `selectedMessageID` or `conversationID`
serves a scope with several identifiers.
