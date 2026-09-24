---
layer: language
configuration: typescript
title: TypeScript
---

# TypeScript

## Core TypeScript philosophy

TypeScript is useful here because it makes contracts explicit at compile time,
but it is not a runtime validation layer. Use the type system to describe values
after they have crossed a trusted boundary. Use Zod, custom guards, or
database constraints to prove unknown input before treating it as typed data.

Prefer plain values, small functions, discriminated unions, and clear module
boundaries. Avoid type gymnastics that make code harder to understand than the
runtime behavior. If enforcement differs from this document, fix the enforcement
or update the rule explicitly. Do not use mismatch as an excuse to ignore the
standard.

## TypeScript standard

TypeScript projects must use strict compiler settings:

- `strict`
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`
- `noImplicitOverride`
- `forceConsistentCasingInFileNames`

How an internal import resolves is a fact about the runtime, not about TypeScript. See the
`runtime/` rules for the runtime this code targets.

Local lint configuration owns exact TypeScript enforcement. Do not duplicate
rule IDs or lint options here.

The durable standards are these. Type-only imports and exports stay explicit. Object shapes use
`type` aliases. External input is validated at runtime. `any` and unsafe assertions are avoided, and TypeScript enums are not
introduced. Type declarations live where the project declares them.

When implementation or enforcement conflicts with this standard, call out the
conflict or fix it in an explicit task. Do not weaken the rule to match drift.

## File classes

Every TypeScript file is one of three classes, and the generated lint configuration treats them
differently:

- Application and service source: the strictest rule set, `no-console`, the boundaries matrix,
  the import style supported by the declared runtime and compiler configuration.
- Scripts and generators: `n/no-process-exit` off, JSDoc off, the same import style as their
  runtime.
- Shared tooling: follows the JavaScript ESLint configuration and the tooling file class.

## Source files

Keep TypeScript files as normal UTF-8 source files with imports before
implementation. Do not put imports after statements.

Rules:

- Private declarations first, public last: every non-exported function, constant, and class
  precedes the first `export`. A reader meets the helpers before the contract that uses them.
- Read `process.env` in one configuration owner module. Nowhere else.

- Use `const` by default.
- Use `let` only for reassignment.
- Never use `var`.
- Keep side-effect imports rare and explicit.
- Do not use triple-slash references.
- Do not add file-level history comments, stale path references, or generated
  examples that are not part of the working code.

Prefer direct, searchable code over clever indirection. If a module needs a
short explanation, document the purpose, not how it changed.

## Modules, imports, and exports

Use ES module syntax everywhere.

Rules:

- Use `import type` for symbols used only as types.
- Use `export type` when re-exporting type-only symbols.
- Prefer named imports and named exports for app code.
- Avoid mutable exports such as `export let`.
- Avoid default exports in app modules.
- Allow default exports for ecosystem-owned config files when the tool expects
  them.
- Do not create container classes or exported objects only to simulate a
  namespace.
- Do not use `namespace`, `module`, or `import x = require(...)`.

Follow the import extension policy of the runtime this code targets. It is stated once, in the
`runtime/` rule file for that runtime, and not repeated per language.

No re-exports in application source: no `export { x } from`, no `export * from`, no index
barrels. Import the module that declares the symbol. A library scope may allow re-exports in
index files only, as a recorded project choice.

## Type placement

Keep type aliases, interfaces, enum-replacement objects, and generic helper types beside their
behavioral owner. Infer schema types from their authored schema. Use `import type` when an import
has no runtime use. A shared contract belongs with its consumers, not in a mandatory top-level
types directory. Do not split declarations into files merely to satisfy a placement convention.

## Values, literals, and coercion

Prefer explicit, unsurprising values.

Rules:

- Use `const` for values that do not change.
- Prefer literal unions and `as const` objects over enums.
- Do not use TypeScript enums.
- Avoid implicit coercion for user input, environment values, and provider
  responses.
- Use explicit parsing for strings, numbers, booleans, and dates that cross a
  runtime boundary.
- Do not use truthiness checks when `0`, `''`, `false`, `null`, and `undefined`
  have different meanings.

Use `as const` for fixed value sets when it improves type precision and does not
make the runtime shape harder to read.

## Objects, arrays, and destructuring

Keep object and array handling readable and type-safe.

Rules:

- Use object literals for grouped data instead of positional parameter lists.
- Add type annotations to object literals when the contract matters.
- Prefer annotations over `as SomeType` for object literals.
- Use destructuring when it clarifies the fields being used.
- Use `T[]` for simple arrays.
- Use `Array<T>` or `ReadonlyArray<T>` when the element type is complex.
- Prefer readonly arrays or readonly properties only when immutability is part
  of the contract, not as decoration.

With `noUncheckedIndexedAccess`, indexed reads produce optional values. Narrow
those values before use in production code.

## Functions and parameters

Use TypeScript annotations to make public function contracts explicit while
letting local implementation details rely on clear inference.

Rules:

- Annotate exported function return types.
- Annotate callback parameter types when inference is unclear.
- Avoid parameter reassignment.
- Do not use overloads when a discriminated union or options object is clearer.
- Keep generics minimal.

Use optional parameters only for truly optional inputs. Do not make a parameter
optional to avoid fixing a caller contract.

## Classes

Use classes only when instance identity or encapsulated state is real.

Rules:

- Do not create static container classes for namespacing.
- Prefer plain functions and objects for stateless behavior.
- Use `override` when overriding class members.
- Keep constructors simple.
- Do not use decorators unless an approved framework or toolchain requires them.

If a class has no meaningful instance state, it is a module with
named exports.

## Types and inference

Let TypeScript infer local details, but make public contracts explicit.

Rules:

- Avoid `any`. Use `unknown` plus narrowing for untrusted values.
- Do not assert to `any`.
- Avoid double assertions.
- Avoid broad `as` casts.
- Avoid non-null assertions in production code.
- Prefer runtime narrowing, typed helpers, or fixing the source type over casts.
- Use discriminated unions for known variants.
- Avoid type aliases that only rename another type without adding meaning.

Use `type` aliases for object shapes. Do not require interfaces over types, even
though Google prefers interfaces in some cases.

## Null, undefined, and optional values

Be precise about absence.

Rules:

- Prefer optional properties and optional parameters over `| undefined`.
- Do not create nullable aliases such as `type Foo = Bar | undefined`.
- Add nullability at the usage boundary where absence is part of that specific
  contract.
- Normalize external empty strings, missing fields, and null values at runtime
  boundaries.
- Do not use non-null assertions to skip narrowing in production code.

`exactOptionalPropertyTypes` is enabled, so `property?: T` is not the same
contract as `property: T | undefined`. Pick the one that matches the real data.

## Runtime boundaries

TypeScript types do not validate runtime input.

Use Zod or custom runtime validation for:

- HTTP bodies, query strings, route params, and headers
- environment variables
- database rows and RPC results when the query boundary has not validated them
- provider responses
- file input and generated data sources
- webhooks, cron payloads, and Edge Function requests

After validation, pass typed values inward. Do not spread raw `unknown` or
request-shaped values through domain code. Keep validation close to the boundary
that receives untrusted data.

## Errors and async code

Throw only `Error` subclasses.

Rules:

- Use `new Error(...)` or a custom `Error` subclass.
- Do not throw strings, numbers, plain objects, or unknown provider payloads.
- Catch as `unknown` and narrow before reading properties.
- Preserve original causes when wrapping errors.
- Keep `try` blocks focused around the operation that can throw.
- Do not use catch blocks that only rethrow the same error.
- Use `Promise.all` only for bounded fan-out.
- Use sequential `await` when order, rate limits, or failure isolation matter.

## Comments and JSDoc

Document purpose and contracts, not TypeScript syntax.

Rules:

- Document exported public APIs when the purpose is not obvious.
- Do not put TypeScript type annotations in JSDoc.
- Explain non-obvious invariants, security boundaries, concurrency behavior, and
  runtime assumptions.
- Do not add comments that restate the code.
- Do not include change history in comments.
- A `TODO` is `TODO(<issue-url-or-YYYY-MM-DD>): <sentence>`; the owner is an issue link or an
  expiry date, never a person.

JSDoc lint rules must require documentation for exported functions, with type
tags disabled because TypeScript owns types.

## Tests and mocks

Use tests to verify behavior, not implementation detail.

Rules:

- Keep shared test types beside the support module or behavior that owns their contract.
- Use the test runner's typed mock helpers rather than casting a mock to `any`.
- Mock external boundaries, not internal implementation details.
- Avoid `any` in tests. Use `unknown`, typed test data, or narrow mock helpers.
- Non-null assertions are allowed in test files only when the arrange step makes
  the value obviously present.
- Documentation-only TypeScript guidance changes must not update tests.

## Generated code

Generated TypeScript is mostly exempt from this guide.

Rules:

- Do not manually edit generated database type files.
- Regenerate generated types through the owning generator when schema changes
  require it.
- Do not refactor generated output to satisfy style guidance.
- Keep hand-written wrappers around generated types small and owned by the
  boundary that needs them.

If generated code violates a style preference, fix the generator or document the
exception. Do not patch generated files by hand.

## Async and promises

Async code must preserve correctness, debuggability, and bounded resource use.
Do not let promise behavior become implicit.

Rules:

- Mark functions `async` when they return promises from asynchronous work.
- Use `return await` inside `try` or error-boundary functions when it preserves useful stack traces.
- Await asynchronous work before returning from route handlers, middleware, startup, and shutdown paths.
- Do not pass `async` callbacks to synchronous iteration APIs when the caller expects completion.
- Use `Promise.all()` only for independent work that can safely run concurrently.
- Use platform concurrency utilities for large fan-out, provider calls, and
  batch work.
- Do not leave floating promises unless they are intentionally detached, logged, and supervised.
- Do not swallow promise rejections.
- Prefer `async`/`await` or promise chains over callback pyramids.
- Use `finally` for required cleanup after async work.

```ts
// Bad: forEach does not wait for async callbacks.
messages.forEach(async (message) => {
    await persistMessage(message);
});

// Good: the caller waits for all writes to finish.
await Promise.all(messages.map((message) => persistMessage(message)));
```

```ts
// Good: cleanup still runs when the provider call fails.
try {
    return await createProviderOperation(providerRequest);
} finally {
    releaseOperationLock(operationId);
}
```

```ts
// Good: preserve the provider failure stack and cause at the boundary.
export async function createProviderOperation(request: ProviderOperationRequest) {
    try {
        return await postProviderOperation(request);
    } catch (error) {
        throw new Error('Provider request failed', { cause: error });
    }
}
```

## Dependencies and abstractions

Rules:

- Use native Node and TypeScript APIs first.
- Use approved dependencies before adding new ones.
- Do not add lodash-style dependencies for array, object, or string helpers.
- Keep exact dependency versions.
- Do not add a dependency for a one-line native API or a small local helper.

## Declaration order

Bad, public before private:

```ts
export function parseOrder(input: unknown): Order {
    return normalizeOrder(orderSchema.parse(input));
}

function normalizeOrder(order: Order): Order {
    return { ...order, items: order.items.filter(isActiveItem) };
}
```

Good:

```ts
function normalizeOrder(order: Order): Order {
    return { ...order, items: order.items.filter(isActiveItem) };
}

export function parseOrder(input: unknown): Order {
    return normalizeOrder(orderSchema.parse(input));
}
```

## Rules not adopted

The following external-guide rules are not adopted:

- Do not copy Google's full formatting rules. The formatter and the linter own formatting.
- Do not require interfaces over type aliases.
- Do not add Angular, Polymer, JSPB proto, or Google-internal conformance rules.
- Do not globally ban default exports where ecosystem config files need them.
- Do not introduce broad naming-lint policy changes as part of normal feature or docs work.
- Do not do opportunistic code refactors to make unrelated code match this guide.

These choices define the TypeScript standard. When enforcement does not match the standard, fix
the enforcement.
