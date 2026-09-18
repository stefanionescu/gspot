---
layer: language
preset: typescript
title: TypeScript
---

# TypeScript

## Core TypeScript philosophy

TypeScript is useful here because it makes contracts explicit at compile time,
but it is not a runtime validation layer. Use the type system to describe values
after they have crossed a trusted boundary. Use Zod, custom guards, or
database constraints to prove unknown input before treating it as typed data.

Prefer plain values, small functions, discriminated unions, and clear module `enforced-by: typescript/eslint @typescript-eslint/switch-exhaustiveness-check`
boundaries. Avoid type gymnastics that make code harder to understand than the
runtime behavior. If enforcement differs from this document, fix the enforcement
or update the rule explicitly. Do not use mismatch as an excuse to ignore the
standard.

## TypeScript standard

TypeScript projects must use strict compiler settings:

- `strict` `enforced-by: integrity/tsconfig-options`
- `noUncheckedIndexedAccess` `enforced-by: integrity/tsconfig-options`
- `exactOptionalPropertyTypes` `enforced-by: integrity/tsconfig-options`
- `noImplicitOverride` `enforced-by: integrity/tsconfig-options`
- `forceConsistentCasingInFileNames` `enforced-by: integrity/tsconfig-options`

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

Every TypeScript file is one of three classes, and the generated lint configuration treats them `enforced-by: integrity/generated-fresh`
differently:

- Application and service source: the strictest rule set, `no-console`, the boundaries matrix,
  the runtime's import style (`.js` suffix under NodeNext, extensionless under Bun or tsx, `.ts`
  under Deno). `unenforced`
- Scripts and generators: `n/no-process-exit` off, JSDoc off, the same import style as their
  runtime. `enforced-by: typescript/eslint jsdoc/require-jsdoc`
- Shared tooling: follows the JavaScript ESLint configuration and the tooling file class. `unenforced`

## Source files

Keep TypeScript files as normal UTF-8 source files with imports before `enforced-by: typescript/eslint import-x/first`
implementation. Do not put imports after statements.

Rules:

- Private declarations first, public last: every non-exported function, constant, and class
  precedes the first `export`. A reader meets the helpers before the contract that uses them. `enforced-by: typescript/eslint gspot/private-before-public`
- Read `process.env` in one configuration owner module. Nowhere else. `enforced-by: typescript/eslint gspot/env-access-owner`

- Use `const` by default. `enforced-by: typescript/eslint prefer-const`
- Use `let` only for reassignment. `enforced-by: typescript/eslint prefer-const`
- Never use `var`. `enforced-by: typescript/eslint prefer-const`
- Keep side-effect imports rare and explicit. `enforced-by: typescript/eslint import-x/first`
- Do not use triple-slash references. `enforced-by: typescript/eslint @typescript-eslint/no-namespace`
- Do not add file-level history comments, stale path references, or generated
  examples that are not part of the working code. `enforced-by: typescript/eslint sonarjs/no-commented-code`

Prefer direct, searchable code over clever indirection. If a module needs a `unenforced`
short explanation, document the purpose, not how it changed.

## Modules, imports, and exports

Use ES module syntax everywhere. `unenforced`

Rules:

- Use `import type` for symbols used only as types. `enforced-by: typescript/eslint gspot/types-placement`
- Use `export type` when re-exporting type-only symbols. `enforced-by: typescript/eslint gspot/types-placement`
- Prefer named imports and named exports for app code. `enforced-by: typescript/eslint import-x/no-default-export`
- Avoid mutable exports such as `export let`. `enforced-by: typescript/eslint import-x/no-default-export`
- Avoid default exports in app modules. `enforced-by: typescript/eslint import-x/no-default-export`
- Allow default exports for ecosystem-owned config files when the tool expects
  them. `enforced-by: typescript/eslint import-x/no-default-export`
- Do not create container classes or exported objects only to simulate a
  namespace. `enforced-by: typescript/eslint @typescript-eslint/no-namespace`
- Do not use `namespace`, `module`, or `import x = require(...)`. `enforced-by: typescript/eslint @typescript-eslint/no-namespace`

Follow the import extension policy of the runtime this code targets. It is stated once, in the `unenforced`
`runtime/` rule file for that runtime, and not repeated per language.

No re-exports in application source: no `export { x } from`, no `export * from`, no index `enforced-by: typescript/eslint gspot/no-reexports`
barrels. Import the module that declares the symbol. A library scope may allow re-exports in
index files only, through the `[structure] reexports` setting.

## Type placement

Every type alias, every `as const` object that replaces an enum, and every generic helper type `enforced-by: typescript/eslint @typescript-eslint/prefer-as-const`
lives under the `types/` directory (`types/` at the scope root, or the directory the project
configures). Generated types and test-only types get their own subdirectories there and are not
mixed with hand-written shared types.

Rules:

- No `interface`. Use `type` aliases for object shapes. `enforced-by: typescript/eslint gspot/types-placement`
- A file under `types/` holds only type declarations and type-only imports. It has no default
  export and exports no function, class, or runtime value. `enforced-by: typescript/eslint gspot/types-placement`
- Source imports from `types/` are `import type`. `enforced-by: typescript/eslint gspot/types-placement`
- A component's props type, a function's options type, and a module's result type all live in
  `types/`, named for the contract (`types/orders.ts` holds `SubmitOrderRequest`). `enforced-by: typescript/eslint gspot/types-placement`
- The exceptions are framework-generated `*.d.ts` files and a Zod schema module that exports
  `z.infer` of its own schema, each declared through the gate's ignore list with a reason. `enforced-by: security/semgrep`

## Values, literals, and coercion

Prefer explicit, unsurprising values. `unenforced`

Rules:

- Use `const` for values that do not change. `enforced-by: typescript/eslint prefer-const`
- Prefer literal unions and `as const` objects over enums. `enforced-by: typescript/eslint no-restricted-syntax`
- Do not use TypeScript enums. `enforced-by: typescript/eslint no-restricted-syntax`
- Avoid implicit coercion for user input, environment values, and provider
  responses. `enforced-by: typescript/eslint unicorn/prefer-number-properties`
- Use explicit parsing for strings, numbers, booleans, and dates that cross a
  runtime boundary. `enforced-by: typescript/eslint unicorn/prefer-number-properties`
- Do not use truthiness checks when `0`, `''`, `false`, `null`, and `undefined`
  have different meanings. `enforced-by: typescript/eslint @typescript-eslint/strict-boolean-expressions`

Use `as const` for fixed value sets when it improves type precision and does not `enforced-by: typescript/eslint @typescript-eslint/prefer-as-const`
make the runtime shape harder to read.

## Objects, arrays, and destructuring

Keep object and array handling readable and type-safe. `unenforced`

Rules:

- Use object literals for grouped data instead of positional parameter lists. `unenforced`
- Add type annotations to object literals when the contract matters. `unenforced`
- Prefer annotations over `as SomeType` for object literals. `unenforced`
- Use destructuring when it clarifies the fields being used. `unenforced`
- Use `T[]` for simple arrays. `enforced-by: typescript/eslint @typescript-eslint/array-type`
- Use `Array<T>` or `ReadonlyArray<T>` when the element type is complex. `enforced-by: typescript/eslint @typescript-eslint/array-type`
- Prefer readonly arrays or readonly properties only when immutability is part
  of the contract, not as decoration. `enforced-by: typescript/eslint @typescript-eslint/array-type`

With `noUncheckedIndexedAccess`, indexed reads produce optional values. Narrow
those values before use in production code.

## Functions and parameters

Use TypeScript annotations to make public function contracts explicit while `unenforced`
letting local implementation details rely on clear inference.

Rules:

- Annotate exported function return types. `enforced-by: typescript/eslint @typescript-eslint/explicit-module-boundary-types`
- Annotate callback parameter types when inference is unclear. `unenforced`
- Avoid parameter reassignment. `enforced-by: typescript/eslint no-param-reassign`
- Do not use overloads when a discriminated union or options object is clearer. `enforced-by: typescript/eslint @typescript-eslint/unified-signatures`
- Keep generics minimal. `enforced-by: typescript/eslint @typescript-eslint/unified-signatures`

Use optional parameters only for truly optional inputs. Do not make a parameter `enforced-by: typescript/eslint @typescript-eslint/no-redundant-type-constituents`
optional to avoid fixing a caller contract.

## Classes

Use classes only when instance identity or encapsulated state is real. `enforced-by: typescript/eslint unicorn/no-static-only-class`

Rules:

- Do not create static container classes for namespacing. `enforced-by: typescript/eslint @typescript-eslint/no-namespace`
- Prefer plain functions and objects for stateless behavior. `unenforced`
- Use `override` when overriding class members. `unenforced`
- Keep constructors simple. `enforced-by: typescript/eslint unicorn/no-static-only-class`
- Do not use decorators unless an approved framework or toolchain requires them. `enforced-by: typescript/eslint no-restricted-syntax`

If a class has no meaningful instance state, it is a module with
named exports.

## Types and inference

Let TypeScript infer local details, but make public contracts explicit. `unenforced`

Rules:

- Avoid `any`. Use `unknown` plus narrowing for untrusted values. `enforced-by: typescript/eslint @typescript-eslint/no-explicit-any`
- Do not assert to `any`. `enforced-by: typescript/eslint @typescript-eslint/no-explicit-any`
- Avoid double assertions. `enforced-by: typescript/eslint @typescript-eslint/no-explicit-any`
- Avoid broad `as` casts. `enforced-by: typescript/eslint @typescript-eslint/no-explicit-any`
- Avoid non-null assertions in production code. `enforced-by: typescript/eslint @typescript-eslint/no-explicit-any`
- Prefer runtime narrowing, typed helpers, or fixing the source type over casts. `unenforced`
- Use discriminated unions for known variants. `enforced-by: typescript/eslint @typescript-eslint/switch-exhaustiveness-check`
- Avoid type aliases that only rename another type without adding meaning. `enforced-by: typescript/eslint gspot/types-placement`

Use `type` aliases for object shapes. Do not require interfaces over types, even `unenforced`
though Google prefers interfaces in some cases.

## Null, undefined, and optional values

Be precise about absence.

Rules:

- Prefer optional properties and optional parameters over `| undefined`. `enforced-by: typescript/eslint @typescript-eslint/no-redundant-type-constituents`
- Do not create nullable aliases such as `type Foo = Bar | undefined`. `enforced-by: typescript/eslint @typescript-eslint/no-redundant-type-constituents`
- Add nullability at the usage boundary where absence is part of that specific
  contract. `unenforced`
- Normalize external empty strings, missing fields, and null values at runtime
  boundaries. `unenforced`
- Do not use non-null assertions to skip narrowing in production code. `enforced-by: typescript/eslint @typescript-eslint/no-explicit-any`

`exactOptionalPropertyTypes` is enabled, so `property?: T` is not the same
contract as `property: T | undefined`. Pick the one that matches the real data.

## Runtime boundaries

TypeScript types do not validate runtime input.

Use Zod or custom runtime validation for:

- HTTP bodies, query strings, route params, and headers `enforced-by: security/semgrep`
- environment variables `enforced-by: security/semgrep`
- database rows and RPC results when the query boundary has not validated them `enforced-by: security/semgrep`
- provider responses `enforced-by: security/semgrep`
- file input and generated data sources `enforced-by: integrity/generated-fresh`
- webhooks, cron payloads, and Edge Function requests `enforced-by: security/semgrep`

After validation, pass typed values inward. Do not spread raw `unknown` or
request-shaped values through domain code. Keep validation close to the boundary
that receives untrusted data.

## Errors and async code

Throw only `Error` subclasses. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`

Rules:

- Use `new Error(...)` or a custom `Error` subclass. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Do not throw strings, numbers, plain objects, or unknown provider payloads. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Catch as `unknown` and narrow before reading properties. `enforced-by: typescript/eslint @typescript-eslint/no-explicit-any`
- Preserve original causes when wrapping errors. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Keep `try` blocks focused around the operation that can throw. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Do not use catch blocks that only rethrow the same error. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Use `Promise.all` only for bounded fan-out. `enforced-by: typescript/eslint @typescript-eslint/no-floating-promises`
- Use sequential `await` when order, rate limits, or failure isolation matter. `enforced-by: typescript/eslint @typescript-eslint/no-floating-promises`

## Comments and JSDoc

Document purpose and contracts, not TypeScript syntax. `unenforced`

Rules:

- Document exported public APIs when the purpose is not obvious. `enforced-by: typescript/eslint jsdoc/require-jsdoc`
- Do not put TypeScript type annotations in JSDoc. `enforced-by: typescript/eslint jsdoc/require-jsdoc`
- Explain non-obvious invariants, security boundaries, concurrency behavior, and
  runtime assumptions. `unenforced`
- Do not add comments that restate the code. `enforced-by: typescript/eslint jsdoc/require-jsdoc`
- Do not include change history in comments. `enforced-by: typescript/eslint sonarjs/no-commented-code`
- A `TODO` is `TODO(<issue-url-or-YYYY-MM-DD>): <sentence>`; the owner is an issue link or an
  expiry date, never a person. `enforced-by: typescript/eslint unicorn/expiring-todo-comments`

JSDoc lint rules must require documentation for exported functions, with type
tags disabled because TypeScript owns types.

## Tests and mocks

Use tests to verify behavior, not implementation detail. `unenforced`

Rules:

- Keep shared test types under the required test type roots. `enforced-by: typescript/eslint`
- Use the test runner's typed mock helpers rather than casting a mock to `any`. `enforced-by: typescript/eslint @typescript-eslint/no-explicit-any`
- Mock external boundaries, not internal implementation details. `enforced-by: typescript/eslint`
- Avoid `any` in tests. Use `unknown`, typed fixtures, or narrow mock helpers. `enforced-by: typescript/eslint @typescript-eslint/no-explicit-any`
- Non-null assertions are allowed in test files only when the arrange step makes
  the value obviously present. `enforced-by: typescript/eslint @typescript-eslint/no-explicit-any`
- Documentation-only TypeScript guidance changes must not update tests. `unenforced`

## Generated code

Generated TypeScript is mostly exempt from this guide.

Rules:

- Do not manually edit generated database type files. `enforced-by: integrity/generated-fresh`
- Regenerate generated types through the owning generator when schema changes
  require it. `enforced-by: integrity/generated-fresh`
- Do not refactor generated output to satisfy style guidance. `enforced-by: integrity/generated-fresh`
- Keep hand-written wrappers around generated types small and owned by the
  boundary that needs them. `enforced-by: integrity/generated-fresh`

If generated code violates a style preference, fix the generator or document the
exception. Do not patch generated files by hand.

## Async and promises

Async code must preserve correctness, debuggability, and bounded resource use.
Do not let promise behavior become implicit.

Rules:

- Mark functions `async` when they return promises from asynchronous work. `enforced-by: typescript/eslint @typescript-eslint/no-floating-promises`
- Use `return await` inside `try` or error-boundary functions when it preserves useful stack traces. `enforced-by: typescript/eslint @typescript-eslint/no-floating-promises`
- Await asynchronous work before returning from route handlers, middleware, startup, and shutdown paths. `enforced-by: typescript/eslint @typescript-eslint/no-floating-promises`
- Do not pass `async` callbacks to synchronous iteration APIs when the caller expects completion. `enforced-by: typescript/eslint @typescript-eslint/no-floating-promises`
- Use `Promise.all()` only for independent work that can safely run concurrently. `enforced-by: typescript/eslint @typescript-eslint/no-floating-promises`
- Use platform concurrency utilities for large fan-out, provider calls, and
  batch work. `enforced-by: typescript/eslint @typescript-eslint/no-floating-promises`
- Do not leave floating promises unless they are intentionally detached, logged, and supervised. `enforced-by: typescript/eslint @typescript-eslint/no-floating-promises`
- Do not swallow promise rejections. `enforced-by: typescript/eslint @typescript-eslint/no-floating-promises`
- Prefer `async`/`await` or promise chains over callback pyramids. `enforced-by: typescript/eslint @typescript-eslint/no-floating-promises`
- Use `finally` for required cleanup after async work. `enforced-by: typescript/eslint @typescript-eslint/no-floating-promises`

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

- Use native Node and TypeScript APIs first. `enforced-by: integrity/manifest-policy`
- Use approved dependencies before adding new ones. `enforced-by: integrity/manifest-policy`
- Do not add lodash-style dependencies for array, object, or string helpers. `enforced-by: integrity/manifest-policy`
- Keep exact dependency versions. `enforced-by: integrity/manifest-policy`
- Do not add a dependency for a one-line native API or a small local helper. `enforced-by: integrity/manifest-policy`

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

- Do not copy Google's full formatting rules. Prettier and lint own formatting. `unenforced`
- Do not require interfaces over type aliases. `enforced-by: typescript/eslint gspot/types-placement`
- Do not add Angular, Polymer, JSPB proto, or Google-internal conformance rules. `unenforced`
- Do not globally ban default exports where ecosystem config files need them. `enforced-by: typescript/eslint import-x/no-default-export`
- Do not introduce broad naming-lint policy changes as part of normal feature or docs work. `unenforced`
- Do not do opportunistic code refactors to make unrelated code match this guide. `unenforced`

These choices define the TypeScript standard. When enforcement does not match the standard, fix
the enforcement.
