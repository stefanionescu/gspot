---
title: Swift
---

# Swift

Swift source follows the Apple API Design Guidelines and the local formatting and lint
configuration. swift-format owns layout. SwiftLint reports unused imports, `try!`, `as!`,
force unwraps at `all`, `fatalError`, `print`, `fallthrough`, and `unowned`. It reports
implicitly unwrapped optionals, redundant `break`, `return`, `get`, `.init`, and raw values,
`class func`, non-final classes, `fileprivate`, and `#imageLiteral`. It reports function
length and complexity. The structure checks report declaration order.

Warnings are errors in the build settings. This file says why, and holds the rules no tool
sees.

## Files and style

Every file imports exactly the top-level modules it uses, as whole modules unless a single
declaration avoids a known conflict. Imports are grouped by compiler condition, with
`@testable import` after regular imports in tests. `// MARK: - Section` marks meaningful groups in larger files,
and a file comment appears only when the file groups several abstractions and the grouping
needs explanation. Type inference covers an obvious right-hand side; an explicit annotation
covers empty collections, `nil` initial values, weak type information, and public API
clarity. Enum raw values that map to an external wire or persistence contract are documented;
an explicit case list replaces `default` where a future case must force review. Attributes
with parameters go on their own line when they hurt readability inline.

### File organization

<!-- level: all -->

One primary top-level type per file, with small private helpers allowed beside it. Overloads
sit adjacent, extensions are organized rather than scattered across files, and SwiftUI
dynamic properties are grouped by wrapper type. Private declarations come first and public last, so a
reader meets the helpers before the contract that uses them.

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

`let` is the default and `var` marks required mutation; class-constrained protocols use
`AnyObject`; shorthand types (`[Element]`, `[Key: Value]`, `Wrapped?`) and `Void` for function
types are preferred. Optionals express valid absence rather than sentinel values, compared to
`nil` when only presence matters and bound when the value is used, chained for one-off access.
Typed errors distinguish several meaningful failure states. A force unwrap or cast needs a
proven invariant stated in a nearby comment, except in tests or a literal-only programmer
error. Global mutable state is avoided, with `static let` or computed `static var` over stored
mutable statics.

`guard` handles early exits, `for ... where` a loop guarded by one condition,
`for` over `forEach` when control flow or async work is involved, and `map`, `compactMap`, and
`filter` express side-effect-free transformation. Pattern bindings put `let` on each element
where that avoids ambiguity. Closures capture `[weak self]` with an early return, or the
specific immutable values they need. `#fileID` serves production diagnostics; `#filePath`
only tests and tooling. Operators are overloaded only with their standard meaning, and a
custom operator exists only as standard domain notation.

### API and ownership conventions

<!-- level: all -->

Code runs its tests, removes understood duplication, expresses intent, and minimizes types
and methods; no speculative abstraction serves one call site. Structs keep synthesized
memberwise initializers where sufficient, value types hold data without identity, and classes
serve identity, reference semantics, lifecycle, observable state, or framework requirements.
An implicitly unwrapped optional appears only for Apple lifecycle cases such as `@IBOutlet`,
Objective-C nullability gaps, and test data.

Top-level access is declared explicitly per the real contract, `private` over `fileprivate`
unless same-file cross-type access is required. An extension carries no blanket access
modifier. Types nest when they only make sense in the parent's context, and a caseless enum
groups truly related statics. Methods and properties beat free functions unless the function
is standard-library-like and symmetric.
`ProcessInfo.processInfo.environment` and `Bundle.main.infoDictionary` are read in one
configuration owner and nowhere else. Logging goes through the project logging system, and
images and colors come from named assets or explicit constructors.

Large `viewDidLoad`, `viewDidAppear`, app delegate, or scene delegate methods move their
setup into named private methods or composition objects. A mode flag that forces the same
branching across several methods becomes separate strategy or data source objects or an
explicit state type. Composition shares UI behavior. Inheritance serves framework
requirements or stable shared behavior rather than default reuse:

```swift
currentDataSource = SectionedProductsDataSource(products: products)
tableView.dataSource = currentDataSource
tableView.reloadData()
```

## Networking

URLs come from `URLComponents` or a typed endpoint value, never concatenated query strings,
and a production `URL(string:)!` documents its invariant. Base URLs and credentials are
injected at composition. Request bodies are `Encodable` types with an explicit method and
content type, never `[String: Any]`. `URLSession` succeeds for non-2xx responses, so the
`HTTPURLResponse` status is validated explicitly and a non-HTTP response is a transport
failure.

Responses decode into DTOs mapped into domain values at the boundary. Required fields and
external enum values are validated there, and no fallback ID, date, or case is invented.
Clients expose typed errors distinguishing encoding, decoding, transport, invalid response,
invalid status, and cancellation, which stays distinguishable when navigation supersedes a
task. Tests inject the transport and cover request construction, status validation, decoding
failure, cancellation, and mapping without a live service.

### Networking ownership

<!-- level: all -->

A network client owns base URL, path construction, query items, method, headers, body
encoding, transport calls, status validation, and decoding. Views and view models never build
a `URLRequest`, call `URLSession`, decode a DTO, or inspect a status. Foundation `URLSession`
with async/await is preferred over a third-party networking framework.

## Documentation comments

`///` documents a declaration and sits before attributes and modifiers, opening with a brief
summary; `- Parameter name:`, `- Parameters:`, `- Returns`, and `- Throws` appear only when
they add information beyond the summary and signature. Public and open declarations are
documented when the documentation policy requires it; internal and private ones only for
non-obvious invariants, concurrency, security, lifecycle, or domain rules. No comment
repeats the declaration, copies base documentation onto an override or conformance, or
records change history, old names, or file paths. Unfinished work goes to the issue tracker, not
a `TODO` comment. `// MARK:` lines, implementation notes, and tool directives are ordinary `//`
comments, and Apple markup backticks name parameters and types.

## Concurrency and errors

Structured `async`/`await` with `async throws` APIs replaces callback pyramids and unmanaged
task trees. UI state mutates on the main actor: view models are `@MainActor`, and expensive
work moves into use cases, repositories, actors, or background tasks. `Task` creation stays
at owners (view models, coordinators, views through `.task`), never in an initializer, always
with an owner and a cancellation strategy. Handles are stored when a disappearing view, a
retry, or a newer request must cancel older work. Cancellation is checked in long loops and
before publishing stale results.

Shared mutable state sits behind actors, main-actor
isolation, or explicit synchronization, with actor isolation preferred over
`DispatchQueue.main.async`. Designs are `Sendable` as the compiler verifies; a module without
concurrency annotations gets `@preconcurrency import`, and `@unchecked Sendable` or
`nonisolated(unsafe)` appears only with a documented local invariant and no safer design.
Clocks and scheduling boundaries are injected where time affects logic or tests.

Typed errors serve callers with different recovery paths, and untyped `Error` only generic
boundaries where cases add nothing. Technical errors become user-facing messages at the
presentation boundary; status codes, SQL errors, file paths, tokens, internal IDs, and SDK
messages never reach users. Failed operations throw, and UI loading and error display use
explicit state enums. `fatalError` is reserved for an unrecoverable programmer error with a
documented invariant, `assertionFailure` for an unexpected but recoverable state, and
`precondition` for an invariant without which continuing is invalid. No speculative fallback
handles a state the real contract cannot produce.
