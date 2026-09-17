---
layer: language
preset: swift
title: Swift
---

# Swift

## Swift Source Style

Swift source follows Apple API Design Guidelines, Google Swift style guidance
where it improves clarity, and the local formatting and lint configuration.

Rules:

- Swift source files use UTF-8 and end in `.swift`. `enforced-by: naming/identifiers`
- Let formatter and lint configuration own indentation, wrapping, alignment,
  spacing, semicolon policy, and brace placement. `enforced-by: swift/swiftformat`
- Do not add manual formatting exceptions to work around local tooling. `enforced-by: swift/swiftformat`
- Use `// MARK: - Section` only for meaningful groups in larger files. `unenforced`
- Do not add file header comments. Let source control own history. `enforced-by: swift/swiftlint`
- File comments are optional and appear only when the file groups
  multiple related abstractions and the grouping needs explanation. `enforced-by: swift/swiftlint`
- Use type inference when the right-hand side makes the type obvious. `enforced-by: swift/swiftlint`
- Add explicit type annotations for empty arrays/dictionaries, nil initial
  values, weak type information, or public API clarity. `enforced-by: swift/swiftlint`

Import rules:

- Import exactly the top-level modules the file uses. `enforced-by: swift/swiftlint`
- Do not rely on transitive imports. `enforced-by: swift/swiftlint`
- Prefer whole-module imports. `enforced-by: swift/swiftlint`
- Import individual declarations only when importing the whole module would
  pollute the namespace or create a known conflict. `unenforced`
- Imports are the first non-comment tokens in the file. `enforced-by: swift/swiftlint`
- Group imports by compiler condition where needed. `enforced-by: swift/swiftlint`
- Place `@testable import` after regular imports when test files need it. `enforced-by: swift/swiftlint`
- Remove unused imports instead of tolerating drift. `enforced-by: swift/swiftlint`

File organization:

- Private declarations first, public last: every `private` and `fileprivate` top-level
  declaration precedes the first internal or public one, so a reader meets the helpers before
  the contract that uses them. `enforced-by: structure/private-before-public`
- One primary top-level type per file by default. `enforced-by: swift/swiftlint`
- Related small helper types may live in the same file when they are
  private/fileprivate to the primary type. `enforced-by: swift/swiftlint`
- Keep overloads with the same base name adjacent. `enforced-by: swift/swiftlint`
- Extensions have a logical organization. Do not scatter a type across
  many extension files without a clear reason. `enforced-by: swift/swiftlint`

Formatting constructs:

- Use one `let` or `var` declaration per statement except tuple destructuring. `enforced-by: swift/swiftlint`
- Do not add multiple stored properties in one declaration except tuple
  destructuring where appropriate. `enforced-by: swift/swiftlint`
- Keep SwiftUI dynamic properties grouped by wrapper type. `unenforced`
- Omit redundant `break` in switch cases. `enforced-by: swift/swiftlint`
- Omit redundant `return` when Swift's implicit return improves readability and
  local tooling accepts it. `enforced-by: swift/swiftlint`
- Omit redundant raw enum values unless values map to external wire or
  persistence contracts. `enforced-by: swift/swiftlint`
- When enum raw values map to external systems, document the reason. `unenforced`
- Prefer explicit enum case lists over `default` when future cases must force
  code review. `enforced-by: swift/swiftlint`
- Use `default` only when the behavior is intentionally the same for future
  cases. `enforced-by: swift/swiftlint`
- Use numeric separators for long numeric literals when they improve
  readability. `enforced-by: swift/swiftlint`
- Attributes with parameters go on their own line before the declaration when
  they would hurt readability inline. `enforced-by: swift/swiftlint`

## Swift Programming Practices

Rules:

- Code compiles without warnings. Warnings are errors in the build settings. `enforced-by: swift/swiftlint`
- Remove easy warnings. Do not normalize warning debt. `enforced-by: swift/swiftlint`
- Prefer code that runs tests, removes meaningful duplication, expresses intent,
  and minimizes unnecessary types and methods. `enforced-by: structure/trivial-function`
- Remove duplication after the repeated concept is understood. Do not create a
  speculative abstraction for a single call site. `enforced-by: structure/trivial-function`
- Small functions are preferred, but line count is not the rule. Split functions
  by responsibility, not arbitrary size. `enforced-by: structure/trivial-function`
- Prefer `let`; use `var` only when mutation is required. `unenforced`
- Use synthesized memberwise initializers for structs when they are sufficient
  and public API is not needed. `enforced-by: swift/swiftlint`
- Prefer value types for data without identity. `unenforced`
- Use classes for identity, reference semantics, lifecycle, observable state, or
  framework requirements. `unenforced`
- Mark classes `final` by default unless subclassing is intended. `enforced-by: swift/swiftlint`
- Prefer `static func` over `class func` unless overriding is intended. `enforced-by: swift/swiftlint`
- Use `AnyObject` for class-constrained protocols. `enforced-by: swift/swiftlint`
- Do not call literal protocol initializers directly, such as `integerLiteral:`. `enforced-by: swift/swiftlint`
- Avoid explicit `.init(...)` when calling a concrete type initializer directly. `enforced-by: swift/swiftlint`
- Omit `get` for read-only computed properties. `enforced-by: swift/swiftlint`
- Prefer shorthand types: `[Element]`, `[Key: Value]`, and `Wrapped?`. `enforced-by: swift/swiftlint`
- Use `Void` for function type returns, but omit `-> Void` in `func`
  declarations. `enforced-by: swift/swiftlint`
- Use optionals for valid absence, not sentinel values. `enforced-by: swift/swiftlint`
- Compare optional values to `nil` when only presence matters and the wrapped
  value is unused. `enforced-by: swift/swiftlint`
- Use typed errors when there are multiple meaningful failure states. `enforced-by: swift/swiftlint`
- Avoid `try!`, `as!`, and force unwraps in production. `enforced-by: swift/swiftlint`
- A force unwrap/cast requires a nearby invariant comment unless in tests or a
  clearly safe literal-only programmer-error case. `enforced-by: swift/swiftlint`
- Avoid implicitly unwrapped optionals except Apple lifecycle cases such as
  `@IBOutlet`, Objective-C interop nullability gaps, and test fixtures. `enforced-by: swift/swiftlint`
- Use `private` over `fileprivate` unless same-file cross-type access is
  required. `enforced-by: swift/swiftlint`
- Avoid explicit `internal`. `enforced-by: swift/swiftlint`
- Do not put explicit access control on an entire extension; mark members as
  needed. `enforced-by: swift/swiftlint`
- Nest types when the nested type only makes sense in the parent's context. `enforced-by: swift/swiftlint`
- Use caseless enums for namespaces only when grouping truly related static
  declarations. `enforced-by: swift/swiftlint`
- Avoid global mutable state. `enforced-by: swift/swiftlint`
- Read `ProcessInfo.processInfo.environment` and `Bundle.main.infoDictionary` in one
  configuration owner. Nowhere else. `enforced-by: structure/env-access-owner`
- Prefer immutable `static let` or computed `static var` over stored mutable
  `static var`. `enforced-by: swift/swiftlint`
- Prefer methods/properties over free functions unless the free function is
  standard-library-like and symmetric. `enforced-by: swift/swiftlint`
- Prefer `guard` for early exits and invalid preconditions. `enforced-by: swift/swiftlint`
- Use `for ... where` when the whole loop body would be guarded by one
  condition. `enforced-by: swift/swiftlint`
- Prefer `for` loops over `forEach` when control flow uses `return`, `break`,
  `continue`, or async work. `enforced-by: swift/swiftlint`
- Prefer `map`, `compactMap`, and `filter` when they directly express collection
  transformation without side effects. `enforced-by: swift/swiftlint`
- Use optional binding when the value is needed; compare to `nil` when only
  presence matters. `enforced-by: swift/swiftlint`
- Prefer optional chaining for one-off optional access; use binding when
  multiple operations need the unwrapped value. `enforced-by: swift/swiftlint`
- Do not use `fallthrough` for cases that can be merged. `enforced-by: swift/swiftlint`
- In pattern matching, put `let` or `var` on each bound element rather than
  distributing it across the whole pattern when that avoids ambiguity. `enforced-by: swift/swiftlint`
- Avoid `unowned` captures; prefer `[weak self]` with an early return after
  unwrapping, or capture the specific immutable values needed. `enforced-by: swift/swiftformat`
- Do not use `print`, `debugPrint`, or `dump` for production logging; use the
  project logging system. `enforced-by: swift/swiftlint`
- Prefer `#fileID` in production diagnostics; use `#filePath` only in tests or
  developer tooling where the full path is useful. `enforced-by: swift/swiftlint`
- Avoid `#imageLiteral` and `#colorLiteral`; use named assets or explicit
  constructors. `enforced-by: swift/swiftlint`
- Avoid custom operators unless the operator is a standard notation in the
  problem domain. `enforced-by: swift/swiftlint`
- Overload existing operators only when the meaning matches the standard
  semantic meaning. `enforced-by: swift/swiftlint`

Design rules:

- Avoid large `viewDidLoad`, `viewDidAppear`, app delegate, or scene delegate
  methods. Move setup into named private methods or composition objects when it
  clarifies responsibility. `enforced-by: swift/swiftlint`
- Avoid condition flags that force the same branching across multiple methods.
  Prefer separate strategy/data source objects or explicit state types when
  modes have different behavior. `enforced-by: swift/swiftlint`
- Prefer composition over inheritance for sharing UI behavior. `enforced-by: swift/swiftlint`
- Inheritance is acceptable for framework requirements or stable shared
  behavior, but not as a default reuse mechanism. `enforced-by: swift/swiftlint`

Avoid mode checks repeated across every `UITableViewDataSource` method:

```swift
if mode == .sectioned {
    // Section logic.
} else {
    // Flat logic.
}
```

Prefer swapping a focused data source when the list mode changes:

```swift
currentDataSource = SectionedProductsDataSource(products: products)
tableView.dataSource = currentDataSource
tableView.reloadData()
```

## Networking

- A network client owns base URL, path construction, query items, method, headers, body
  encoding, transport calls, response status validation, and response decoding. Views and view
  models never construct a `URLRequest`, call `URLSession`, decode a DTO, or inspect a status code. `enforced-by: security/semgrep`
- Build URLs with `URLComponents` or a typed endpoint value. Do not concatenate query strings.
  `URL(string:)!` in production needs a documented invariant. `enforced-by: security/semgrep`
- Base URLs and credentials come from configuration injected at composition. `enforced-by: security/semgrep`
- Request bodies are `Encodable` types with an explicit method and content type, never
  `[String: Any]`. `enforced-by: security/semgrep`
- `URLSession` succeeds for non-2xx responses: validate the `HTTPURLResponse` status explicitly
  and treat a non-HTTP response as a transport failure. `enforced-by: security/semgrep`
- Decode into DTOs, map DTOs into domain values at the boundary, and validate required fields and
  external enum values during mapping. Do not invent fallback IDs, dates, or cases. `enforced-by: security/semgrep`
- Clients expose typed errors that distinguish encoding, decoding, transport, invalid response,
  invalid status, and cancellation. Cancellation stays distinguishable when navigation supersedes
  a task. `enforced-by: swift/swiftlint`
- Prefer Foundation `URLSession` with async/await over a third-party networking framework. `enforced-by: security/semgrep`
- Tests inject the transport and cover request construction, status validation, decoding
  failure, cancellation, and mapping. They never hit a live service. `enforced-by: swift/swiftlint`

## Documentation Comments

Rules:

- Use `///` for Swift documentation comments, not block comments. `enforced-by: swift/swiftlint`
- Place doc comments before attributes and modifiers. `enforced-by: swift/swiftlint`
- Public and open declarations require documentation when the local documentation
  policy requires it. `unenforced`
- Internal/private declarations need comments only when they explain non-obvious
  invariants, concurrency, security, lifecycle, or domain rules. `unenforced`
- Start doc comments with a brief summary. `enforced-by: swift/swiftlint`
- Add `- Parameter`, `- Parameters`, `- Returns`, and `- Throws` only when they
  add information not already obvious from the summary and signature. `enforced-by: swift/swiftlint`
- Use singular `- Parameter name:` for one parameter. `unenforced`
- Use grouped `- Parameters:` for multiple parameters. `enforced-by: swift/swiftlint`
- Do not document overrides or protocol conformances by copying base
  documentation. `enforced-by: swift/swiftlint`
- Do not add comments that only repeat the declaration. `enforced-by: swift/swiftlint`
- Do not include change history, old names, file paths, or implementation
  chronology. `enforced-by: swift/swiftlint`
- A TODO is `TODO(<issue-url-or-YYYY-MM-DD>): <sentence>`; the owner is an issue link or an
  expiry date, never a person. `enforced-by: swift/swiftlint todo`
- `// MARK:` comments are regular comments, not doc comments. `enforced-by: swift/swiftlint`
- Comments before declarations are doc comments only when they document the
  declaration's API contract. `enforced-by: swift/swiftlint`
- Use ordinary `//` comments for implementation notes, TODOs, lint/tool
  directives, and grouped blocks. `enforced-by: swift/swiftlint todo`
- Use Apple markup where it improves symbol clarity, especially backticks for
  parameter or type names. `enforced-by: swift/swiftlint`

## Concurrency

Rules:

- Prefer structured concurrency with `async`/`await` over callback pyramids and
  unmanaged task trees. `enforced-by: swift/swiftlint`
- Prefer `async throws` APIs for asynchronous operations that can fail. `enforced-by: swift/swiftlint`
- UI state mutation belongs on the main actor. `enforced-by: swift/swiftlint`
- ViewModels are main-actor isolated; move expensive work into use cases,
  repositories, actors, or background tasks. `enforced-by: swift/swiftlint`
- Use `@MainActor` for UI-facing observable state. `enforced-by: swift/swiftlint`
- Keep `Task` creation at lifecycle owners such as ViewModels, coordinators,
  services, or views using `.task`. `enforced-by: swift/swiftlint`
- Avoid starting long-running work in initializers; expose `start()`, `load()`,
  or lifecycle methods instead. `enforced-by: swift/swiftlint`
- Do not create unstructured `Task` values without a lifecycle owner and
  cancellation strategy. `enforced-by: swift/swiftlint`
- Store task handles when work must be cancellable because a view disappears,
  the user retries, or a newer request supersedes an older one. `enforced-by: swift/swiftlint`
- Check cancellation in long-running loops and before publishing stale async
  results. `enforced-by: swift/swiftlint`
- Keep shared mutable state behind actors, main-actor isolation, locks, or other
  explicit synchronization. `enforced-by: swift/swiftlint`
- Use actors for mutable shared state that can be accessed concurrently. `enforced-by: swift/swiftlint`
- Avoid `DispatchQueue.main.async` when actor isolation can express the same
  requirement. `enforced-by: swift/swiftlint`
- Prefer `Sendable` designs the compiler can verify. `enforced-by: swift/swiftlint`
- Use `@preconcurrency import` for legacy modules when appropriate instead of
  unsafe Sendable workarounds. `unenforced`
- Do not mark types `@unchecked Sendable` or use `nonisolated(unsafe)` unless a
  local invariant is documented and there is no safer design. `enforced-by: swift/swiftlint`
- Any `@unchecked Sendable` exception requires a nearby explanation of the
  synchronization or invariant. `enforced-by: swift/swiftlint`
- Inject clocks or scheduling boundaries when time affects business logic or
  tests. `enforced-by: swift/swiftlint`

## Error Handling

Rules:

- Use typed errors where callers need different recovery paths. `enforced-by: swift/swiftlint`
- Use untyped `Error` only at generic boundaries where concrete cases add no
  value. `unenforced`
- Convert technical errors to user-facing messages at presentation boundaries. `enforced-by: security/semgrep`
- Do not expose API status codes, SQL errors, file paths, tokens, internal IDs,
  or SDK messages directly to users. `enforced-by: security/semgrep`
- Prefer throwing errors for failed operations and explicit state enums for UI
  loading/error display. `enforced-by: security/semgrep`
- Avoid `fatalError` in production except unrecoverable programmer errors with a
  documented invariant; local lint already restricts this further. `enforced-by: swift/swiftlint`
- Use `assertionFailure` for unexpected but recoverable states where production
  can safely continue. `enforced-by: swift/swiftlint`
- Use `precondition` only when continuing would be invalid and the invariant is
  required. `enforced-by: swift/swiftlint`
- Do not add speculative fallback handling for states that cannot occur under
  the real contract. `enforced-by: security/semgrep`

## Declaration Order

Bad, public before private:

```swift
func makeSession(for user: User) -> Session {
    Session(id: makeSessionID(), user: user)
}

private func makeSessionID() -> Session.ID {
    .init(UUID().uuidString)
}
```

Good:

```swift
private func makeSessionID() -> Session.ID {
    .init(UUID().uuidString)
}

func makeSession(for user: User) -> Session {
    Session(id: makeSessionID(), user: user)
}
```
