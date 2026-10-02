---
title: TypeScript
---

# TypeScript

`tsc` runs with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, and `forceConsistentCasingInFileNames`. ESLint with typescript-eslint
reports `any`, unsafe assertions, non-null assertions, enums, namespaces, triple-slash
references, `var`, and parameter reassignment. It reports a missing `import type`, default
exports, mutable exports, re-exports and barrels, thrown non-errors, and floating and misused
promises. It reports `return await` placement, missing JSDoc on exports, declaration order,
and the placement of enum-replacement objects. Prettier owns formatting.

This guide says why, and holds the rules those tools cannot see. Import extensions and module
resolution belong to the runtime file.

## Philosophy

TypeScript makes contracts explicit at compile time; it is not a runtime validation layer.
Types describe values after they cross a trusted boundary, and Zod, custom guards, or
database constraints prove unknown input before it is treated as typed data. Plain values,
small functions, discriminated unions, and clear module boundaries beat type gymnastics
harder to read than the runtime behavior. When enforcement and this guide disagree, fix the
enforcement or change the rule explicitly; drift is not a reason to weaken either.

## Files and modules

A file is UTF-8 with imports before implementation, `const` by default, and `let` only for
reassignment. Side-effect imports are rare and explicit. No history comments, stale path
references, or example code sit outside the working code. Direct, searchable code beats clever
indirection, and a module comment states purpose, not change history. Diagnostics and process
termination stay at executable boundaries. Application source, scripts, tests, generated
files, and tooling have different lint configuration, so check the effective configuration
for a path before assuming a rule.

### Module conventions

<!-- level: all -->

`process.env` is read in one configuration owner module and nowhere else. App code uses named
imports and exports; a default export exists only in an ecosystem-owned configuration file
whose tool expects it. No container class or exported object simulates a namespace. Every
symbol is imported from the module that declares it; a library scope may allow re-exports in
its index files as a recorded project choice.

Type aliases, interfaces, enum-replacement objects, and generic helper types sit beside their
behavioral owner. Schema types are inferred from the authored schema. A shared contract lives
with its consumers rather than a mandatory top-level types directory. When a project
configures a types directory, enum-replacement objects go there beside their types. The
placement check recognizes literal records whose member names match their string values, or
whose values form a `typeof Record[keyof typeof Record]` union. Column widths, download
metadata, and other constant records stay runtime values.

## Values and shapes

User input, environment values, and provider responses are parsed explicitly, never coerced,
and a truthiness check is not used where `0`, `''`, `false`, `null`, and `undefined` mean
different things. `as const` fixes a value set when it improves precision without obscuring
the runtime shape. Grouped data is an object literal, annotated rather than cast when its
contract matters, and destructured where that names the fields in use. `T[]` serves simple
arrays and `Array<T>` or `ReadonlyArray<T>` complex element types; `readonly` marks a
contract, not decoration. With `noUncheckedIndexedAccess`, an indexed read is optional and is
narrowed before use.

Untrusted values are `unknown` plus narrowing. Casts give way to runtime narrowing, typed
helpers, or fixing the source type, and a type alias that only renames another adds nothing.
Known variants are discriminated unions.

Absence is precise: `property?: T` and
`property: T | undefined` are different contracts under `exactOptionalPropertyTypes`. A
nullable alias gets a name only when the union is an owned domain contract. Nullability is
added at the usage boundary where absence belongs to that contract. External empty strings,
missing fields, and nulls are normalized at the runtime boundary.

A non-null assertion is narrowed away in production code; a test may assert when its setup
establishes the value.

### Type conventions

<!-- level: all -->

Object shapes are `type` aliases, and fixed value sets are literal unions or `as const`
objects rather than enums.

## Functions and classes

Exported functions annotate their return types, callback parameters are annotated where
inference is unclear, local details rely on inference, and generics stay minimal. A
discriminated union or options object replaces overloads when clearer, and a parameter is
optional only for a truly optional input, never to dodge fixing a caller. `override` marks
every overridden member.

### Class conventions

<!-- level: all -->

A class exists only for real instance identity or encapsulated state. Stateless behavior is
a module of named exports. Constructors stay simple, and decorators appear only where an
approved framework requires them.

## Runtime boundaries

Untrusted input is validated with Zod or a custom runtime check at the boundary that receives
it. That covers HTTP bodies, query strings, route params, headers, and environment variables.
It also covers unvalidated database rows and RPC results, provider responses, file input,
generated data sources, webhooks, cron payloads, and Edge Function requests. Typed values pass inward; raw `unknown` or
request-shaped values never spread through domain code.

## Errors and async work

Only `Error` and its subclasses are thrown. Catches narrow from `unknown`, wrapping preserves
the cause, and `try` blocks stay focused on the operation that can throw. A catch that only
rethrows does not exist. Functions doing asynchronous work are `async`. Route handlers,
middleware, startup, and shutdown paths await their work before returning, and required
cleanup runs in `finally`.

`Promise.all` serves bounded independent fan-out. Order, rate limits, or failure isolation
call for sequential `await`. Large fan-out, provider calls, and batch work use platform
concurrency utilities. A detached promise is intentional, logged,
and supervised, and no rejection is swallowed.

```ts
// Bad: forEach does not wait for async callbacks.
messages.forEach(async (message) => {
    await persistMessage(message);
});

// Good: the caller waits for all writes to finish.
await Promise.all(messages.map((message) => persistMessage(message)));

// Good: preserve the provider failure stack and cause at the boundary.
export async function createProviderOperation(request: ProviderOperationRequest) {
    try {
        return await postProviderOperation(request);
    } finally {
        releaseOperationLock(request.operationId);
    }
}
```

## Comments, tests, generated code, and dependencies

Comments document purpose, invariants, security boundaries, concurrency behavior, and runtime
assumptions, never TypeScript syntax, restated code, or change history; type tags stay out of
JSDoc because TypeScript owns types. A `TODO` is `TODO(<issue-url-or-YYYY-MM-DD>): <sentence>`,
owned by an issue link or an expiry date, never a person.

Tests verify behavior and mock external boundaries rather than internals. They use the
runner's typed mock helpers instead of `any` and keep shared test types beside the support
module that owns their contract. A documentation-only change to this guidance updates no tests.

Generated TypeScript is exempt from style guidance. Generated database types are regenerated
by their generator and never edited by hand. Hand-written wrappers around them
stay small and owned by the boundary that needs them. When generated output violates a
preference, fix the generator or document the exception.

Native Node and TypeScript APIs come first, then approved dependencies, at exact versions.
No lodash-style helper package for array, object, or string work, and no dependency for a
one-line native API or a small local helper.

## Declaration order

<!-- level: all -->

Types and private helpers precede the exported functions that use them, so a reader meets
each name before its use.

Good:

```ts
type OrderItem = {
    active: boolean;
    quantity: number;
    price: number;
};

type Order = {
    items: OrderItem[];
};

function orderTotal(items: OrderItem[]): number {
    const active = items.filter((item) => item.active);
    const amounts = active.map((item) => item.quantity * item.price);
    return amounts.reduce((sum, amount) => sum + amount, 0);
}

/**
 * Compare orders by the total price of their active items.
 * @param left the first order.
 * @param right the second order.
 * @returns the signed difference between their totals.
 */
export function compareOrders(left: Order, right: Order): number {
    const leftTotal = orderTotal(left.items);
    const rightTotal = orderTotal(right.items);
    return leftTotal - rightTotal;
}
```

## Rules not adopted

Google's full formatting rules are not adopted, because the formatter and linter own
formatting. Interfaces over type aliases, and the Angular, Polymer, JSPB proto, and
Google-internal conformance rules, are not adopted. A global ban on default exports where
ecosystem configuration files need them is not adopted. Broad naming-lint changes inside
feature or docs work, and opportunistic refactors of unrelated code to match this guide, are
not adopted. These choices define the standard; when enforcement differs, fix the
enforcement.
