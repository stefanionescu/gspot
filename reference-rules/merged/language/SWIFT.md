# Swift

## Swift Source Style

Swift source follows Apple API Design Guidelines, Google Swift style guidance
where it improves clarity, and the local formatting and lint configuration.

Rules:

- Swift source files use UTF-8 and end in `.swift`.
- Let formatter and lint configuration own indentation, wrapping, alignment,
  spacing, semicolon policy, and brace placement.
- Do not add manual formatting exceptions to work around local tooling.
- Use `// MARK: - Section` only for meaningful groups in larger files.
- Do not add file header comments. Let source command own history.
- File comments are optional and should appear only when the file groups
  multiple related abstractions and the grouping needs explanation.
- Use type inference when the right-hand side makes the type obvious.
- Add explicit type annotations for empty arrays/dictionaries, nil initial
  values, weak type information, or public API clarity.

Import rules:

- Import exactly the top-level modules the file uses.
- Do not rely on transitive imports.
- Prefer whole-module imports.
- Import individual declarations only when importing the whole module would
  pollute the namespace or create a known conflict.
- Imports are the first non-comment tokens in the file.
- Group imports by compiler condition where needed.
- Place `@testable import` after regular imports when test files need it.
- Remove unused imports instead of tolerating drift.

File organization:

- One primary top-level type per file by default.
- Related small helper types may live in the same file when they are
  private/fileprivate to the primary type.
- Keep overloads with the same base name adjacent.
- Extensions should have a logical organization. Do not scatter a type across
  many extension files without a clear reason.

Formatting constructs:

- Use one `let` or `var` declaration per statement except tuple destructuring.
- Do not add multiple stored properties in one declaration except tuple
  destructuring where appropriate.
- Keep SwiftUI configured properties grouped by wrapper type when practical.
- Omit redundant `break` in switch cases.
- Omit redundant `return` when Swift's implicit return improves readability and
  local tooling accepts it.
- Omit redundant raw enum values unless values map to external wire or
  persistence contracts.
- When enum raw values map to external systems, document the reason.
- Prefer explicit enum case lists over `default` when future cases should force
  code review.
- Use `default` only when the behavior is intentionally the same for future
  cases.
- Use numeric separators for long numeric literals when they improve
  readability.
- Attributes with parameters go on their own line before the declaration when
  they would hurt readability inline.

## Swift Programming Practices

Rules:

- Code must compile without warnings when feasible.
- Remove easy warnings. Do not normalize warning debt.
- Prefer code that runs tests, removes meaningful duplication, expresses intent,
  and minimizes unnecessary types and methods.
- Remove duplication after the repeated concept is understood. Do not create a
  speculative abstraction for a single call site.
- Small functions are preferred, but line count is not the rule. Split functions
  by responsibility, not arbitrary size.
- Prefer `let`; use `var` only when mutation is required.
- Use synthesized memberwise initializers for structs when they are sufficient
  and public API is not needed.
- Prefer value types for data without identity.
- Use classes for identity, reference semantics, lifecycle, observable state, or
  framework requirements.
- Mark classes `final` by default unless subclassing is intended.
- Prefer `static func` over `class func` unless overriding is intended.
- Use `AnyObject` for class-constrained protocols.
- Do not call literal protocol initializers directly, such as `integerLiteral:`.
- Avoid explicit `.init(...)` when calling a concrete type initializer directly.
- Omit `get` for read-only computed properties.
- Prefer shorthand types: `[Element]`, `[Key: Value]`, and `Wrapped?`.
- Use `Void` for function type returns, but omit `-> Void` in `func`
  declarations.
- Use optionals for valid absence, not sentinel values.
- Compare optional values to `nil` when only presence matters and the wrapped
  value is unused.
- Use typed errors when there are multiple meaningful failure states.
- Avoid `try!`, `as!`, and force unwraps in production.
- A force unwrap/cast requires a nearby invariant comment unless in tests or a
  clearly safe literal-only programmer-error case.
- Avoid implicitly unwrapped optionals except Apple lifecycle cases such as
  `@IBOutlet`, Objective-C interop nullability gaps, and test fixtures.
- Use `private` over `fileprivate` unless same-file cross-type access is
  required.
- Avoid explicit `internal`.
- Do not put explicit access control on an entire extension; mark members as
  needed.
- Nest types when the nested type only makes sense in the parent's context.
- Use caseless enums for namespaces only when grouping truly related static
  declarations.
- Avoid global mutable state.
- Prefer immutable `static let` or computed `static var` over stored mutable
  `static var`.
- Prefer methods/properties over free functions unless the free function is
  standard-library-like and symmetric.
- Prefer `guard` for early exits and invalid preconditions.
- Use `for ... where` when the whole loop body would be guarded by one
  condition.
- Prefer `for` loops over `forEach` when control flow uses `return`, `break`,
  `continue`, or async work.
- Prefer `map`, `compactMap`, and `filter` when they directly express collection
  transformation without side effects.
- Use optional binding when the value is needed; compare to `nil` when only
  presence matters.
- Prefer optional chaining for one-off optional access; use binding when
  multiple operations need the unwrapped value.
- Do not use `fallthrough` for cases that can be merged.
- In pattern matching, put `let` or `var` on each bound element rather than
  distributing it across the whole pattern when that avoids ambiguity.
- Avoid `unowned` captures; prefer `[weak self]` with an early return after
  unwrapping, or capture the specific immutable values needed.
- Do not use `print`, `debugPrint`, or `dump` for production logging; use the
  project logging system.
- Prefer `#fileID` in production diagnostics; use `#filePath` only in tests or
  developer tooling where the full path is useful.
- Avoid `#imageLiteral` and `#colorLiteral`; use named assets or explicit
  constructors.
- Avoid project operators unless the operator is a standard notation in the
  problem domain.
- Overload existing operators only when the meaning matches the standard
  semantic meaning.

Design rules:

- Avoid large `viewDidLoad`, `viewDidAppear`, app delegate, or scene delegate
  methods. Move setup into named private methods or composition objects when it
  clarifies responsibility.
- Avoid condition flags that force the same branching across multiple methods.
  Prefer separate strategy/data source objects or explicit state types when
  modes have different behavior.
- Prefer composition over inheritance for sharing UI behavior.
- Inheritance is acceptable for framework requirements or stable shared
  behavior, but not as a default reuse mechanism.

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

## Documentation Comments

Rules:

- Use `///` for Swift documentation comments, not block comments.
- Place doc comments before attributes and modifiers.
- Public and open declarations require documentation when the local documentation
  policy requires it.
- Internal/private declarations need comments only when they explain non-obvious
  invariants, concurrency, security, lifecycle, or domain rules.
- Start doc comments with a brief summary.
- Add `- Parameter`, `- Parameters`, `- Returns`, and `- Throws` only when they
  add information not already obvious from the summary and signature.
- Use singular `- Parameter name:` for one parameter.
- Use grouped `- Parameters:` for multiple parameters.
- Do not document overrides or protocol conformances by copying base
  documentation.
- Do not add comments that only repeat the declaration.
- Do not include change history, old names, file paths, or implementation
  chronology.
- `// MARK:` comments are regular comments, not doc comments.
- Comments before declarations should be doc comments only when they document the
  declaration's API contract.
- Use ordinary `//` comments for implementation notes, TODOs, lint/tool
  directives, and grouped blocks.
- Keep DTO payload examples short if used; they must represent the current
  external contract.
- Use Apple markup where it improves symbol clarity, especially backticks for
  parameter or type names.

## Concurrency

Rules:

- Prefer structured concurrency with `async`/`await` over callback pyramids and
  unmanaged task trees.
- Prefer `async throws` APIs for asynchronous operations that can fail.
- UI state mutation belongs on the main actor.
- ViewModels are main-actor isolated; move expensive work into use cases,
  repositories, actors, or background tasks.
- Use `@MainActor` for UI-facing observable state.
- Keep `Task` creation at lifecycle owners such as ViewModels, coordinators,
  services, or views using `.task`.
- Avoid starting long-running work in initializers; expose `start()`, `load()`,
  or lifecycle methods instead.
- Do not create unstructured `Task` values without a lifecycle owner and
  cancellation strategy.
- Store task handles when work should be cancellable because a view disappears,
  the user retries, or a newer request supersedes an older one.
- Check cancellation in long-running loops and before publishing stale async
  results.
- Keep shared mutable state behind actors, main-actor isolation, locks, or other
  explicit synchronization.
- Use actors for mutable shared state that can be accessed concurrently.
- Avoid `DispatchQueue.main.async` when actor isolation can express the same
  requirement.
- Prefer `Sendable` designs the compiler can verify.
- Use `@preconcurrency import` for legacy modules when appropriate instead of
  unsafe Sendable workarounds.
- Do not mark types `@unchecked Sendable` or use `nonisolated(unsafe)` unless a
  local invariant is documented and there is no safer design.
- Any `@unchecked Sendable` exception requires a nearby explanation of the
  synchronization or invariant.
- Inject clocks or scheduling boundaries when time affects business logic or
  tests.

## Error Handling

Rules:

- Use typed errors where callers need different recovery paths.
- Use untyped `Error` only at generic boundaries where concrete cases add no
  value.
- Convert technical errors to user-facing messages at presentation boundaries.
- Do not expose API status codes, SQL errors, file paths, tokens, internal IDs,
  or SDK messages directly to users.
- Prefer throwing errors for failed operations and explicit state enums for UI
  loading/error display.
- Avoid `fatalError` in production except unrecoverable programmer errors with a
  documented invariant; local lint already restricts this further.
- Use `assertionFailure` for unexpected but recoverable states where production
  can safely continue.
- Use `precondition` only when continuing would be invalid and the invariant is
  required.
- Do not add speculative fallback handling for states that cannot occur under
  the real contract.
