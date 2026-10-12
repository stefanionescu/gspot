# Swift

Swift source follows the Apple API Design Guidelines and the local formatting and lint
configuration. SwiftFormat owns layout. Treat warnings as errors in the build settings.

## Files and style

Every file imports exactly the top-level modules it uses, as whole modules unless a single
declaration avoids a known conflict. Group imports by compiler condition, with
`@testable import` after regular imports in tests. `// MARK: - Section` marks meaningful groups in larger files,
and a file comment appears only when the file groups several abstractions and the grouping
needs explanation. Type inference covers a right-hand side with a clear type; an explicit annotation
covers empty collections, `nil` initial values, weak type information, and public API
clarity. Enum raw values that map to an external wire or persistence contract need documentation;
an explicit case list replaces `default` where a future case must force review. Attributes
with parameters go on their own line when they hurt readability inline.

### File organization

<!-- level: all -->

One primary top-level type per file, with small private helpers allowed beside it. Keep overloads adjacent. Organize extensions rather than scattering them across files. Group SwiftUI
dynamic properties by property-wrapper type.

Good:

```swift
private func sumPositive(_ values: [Int]) -> Int {
    var total = 0
    for value in values where value > 0 {
        total += value
    }
    return total
}

/// Compare the sums of positive values in two collections.
public func comparePositiveTotals(_ left: [Int], _ right: [Int]) -> Int {
    sumPositive(left) - sumPositive(right)
}
```

## Practices

Use `let` by default and `var` for required mutation. Class-constrained protocols use
`AnyObject`. Prefer shorthand types such as `[Element]`, `[Key: Value]`, or `Wrapped?`, and use `Void` for function
types. Optionals express valid absence rather than sentinel values, compared to
`nil` when only presence matters and bound when the code uses the value, chained for one-off access.

Typed errors distinguish several meaningful failure states. A force unwrap or cast needs a
proven invariant. At level `all`, use `// swiftlint:disable:next force_unwrapping` with the
invariant as the reason for an unavoidable unwrap. Avoid global mutable state, with `static let` or computed `static var` over stored
mutable statics.

`guard` handles early exits, `for ... where` a loop guarded by one condition,
`for` over `forEach` for control flow or async work, and `map`, `compactMap`, and
`filter` express side-effect-free transformation. Pattern bindings put `let` on each element
where that avoids ambiguity. Use weak capture only when a callback must not extend the captured
object's lifetime. Otherwise, capture the immutable values the callback needs. `#fileID` serves production diagnostics; `#filePath`
only tests and tooling. Overload operators only with their standard meaning, and a
custom operator exists only as standard domain notation.

### API and ownership conventions

<!-- level: all -->

Structs keep synthesized
memberwise initializers where sufficient, value types hold data without identity, and classes
serve identity, reference semantics, lifecycle, observable state, or framework requirements.
An implicitly unwrapped optional appears only for Apple lifecycle cases such as `@IBOutlet`,
Objective-C nullability gaps, and test data.

Declare top-level access to match the public contract. An extension carries no blanket access
modifier. Types nest when they only make sense in the parent's context, and a caseless enum
groups truly related statics. Methods and properties beat free functions unless the function
follows the standard library and stays symmetric.
Logging goes through the project logging system, and
images and colors come from named assets or explicit constructors.

## Networking

URLs come from `URLComponents` or a typed endpoint value, never concatenated query strings,
and a production `URL(string:)!` documents its invariant. Inject base URLs and credentials
at composition. Use `Encodable` types for request bodies with an explicit method and
content type, never `[String: Any]`. `URLSession` succeeds for non-2xx responses.
Validate `HTTPURLResponse` status explicitly. Treat a non-HTTP response as a transport
failure.

Responses decode into DTOs mapped into domain values at the boundary. Validate required fields and
external enum values there. Do not invent a fallback ID, date, or case.
Clients expose typed errors distinguishing encoding, decoding, transport, invalid response,
invalid status, and cancellation, which stays distinguishable when navigation supersedes a
task. When you write tests, inject the transport and cover request construction, status validation,
decoding failure, cancellation, and mapping without a live service.

### Networking ownership

<!-- level: all -->

A network client owns base URL, path construction, query items, method, headers, body
encoding, transport calls, status validation, and decoding. Views and view models never build
a `URLRequest`, call `URLSession`, decode a DTO, or inspect a status. Prefer Foundation `URLSession`
with async/await rather than a third-party networking framework.

## Documentation comments

`///` documents a declaration before its attributes and modifiers. Swift markup uses
`- Parameter name:`, `- Parameters:`, `- Returns`, and `- Throws`. Backticks name parameters
and types. `// MARK:`, implementation notes, and tool directives use ordinary `//` comments.

## Concurrency and errors

Structured `async`/`await` with `async throws` APIs replaces callback pyramids and unmanaged
task trees. UI state mutates on the main actor. When the project uses view models, keep them
`@MainActor`.

Expensive work moves into use cases, repositories, actors, or background tasks. `Task` creation stays
in the modules that need them: view models, coordinators, or views through `.task`, never in an initializer, always
with an owner and a cancellation strategy. Store handles when a disappearing view, a
retry, or a newer request must cancel older work. Check cancellation in long loops and
before publishing stale results.

Shared mutable state sits behind actors, main-actor
isolation, or explicit synchronization, with actor isolation preferred over
`DispatchQueue.main.async`. The compiler verifies `Sendable` designs; a module without
concurrency annotations gets `@preconcurrency import`, and `@unchecked Sendable` or
`nonisolated(unsafe)` appears only with a documented local invariant and no safer design.
Inject clocks and scheduling interfaces where time affects logic or tests.

Typed errors serve callers with different recovery paths, and untyped `Error` only generic
boundaries where cases add nothing. Technical errors become user-facing messages at the presentation
boundary. Failed operations throw, and UI loading and error display use explicit state enums.
Reserve `fatalError` for an unrecoverable programmer error with a documented invariant,
`assertionFailure` for an unexpected but recoverable state, and `precondition` for an invariant
that continuing requires.
