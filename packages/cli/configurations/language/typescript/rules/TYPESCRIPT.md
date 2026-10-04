---
title: TypeScript
---

# TypeScript

TypeScript checks static types. JavaScript and runtime rules cover modules and execution.

## Philosophy

TypeScript makes contracts explicit at compile time; it is not a runtime validation layer.
Types describe values after they cross a trusted boundary, and Zod, custom guards, or
database constraints prove unknown input before it is treated as typed data. Plain values,
small functions, discriminated unions, and clear module boundaries beat type gymnastics
harder to read than the runtime behavior. If a check and this file disagree, tell the user.

## Files and modules

Diagnostics and process termination stay at executable boundaries. Check the effective lint
configuration for a path before assuming a rule. Follow the project's arrangement for types
and constants. Infer schema types from their authored schemas.

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

## Functions and classes

Annotate callback parameters when inference is unclear, rely on inference for local details,
and keep generics minimal. A discriminated union or options object replaces overloads when
clearer. Make a parameter optional only for an optional input.

## Runtime boundaries

Untrusted input is validated with Zod or a custom runtime check at the boundary that receives
it. That covers HTTP bodies, query strings, route params, headers, and environment variables.
It also covers unvalidated database rows and RPC results, provider responses, file input,
generated data sources, webhooks, and scheduled-job payloads. Typed values pass inward; raw `unknown` or
request-shaped values never spread through domain code.

## Errors and async work

Catches narrow from `unknown`. Preserve the cause when wrapping a failure. Keep a `try` block
focused on the operation that can throw. Functions doing asynchronous work are `async`. Route handlers,
middleware, startup, and shutdown paths await their work before returning, and required
cleanup runs in `finally`.

`Promise.all` serves bounded independent fan-out. Order, rate limits, or failure isolation
call for sequential `await`. Large fan-out, provider calls, and batch work use platform
concurrency utilities. A detached promise is intentional, logged,
and supervised, and no rejection is swallowed.

This fragment assumes the message and provider types, persistence functions, and lock operations
are already declared by their owners.

```ts
// Bad: forEach does not wait for async callbacks.
messages.forEach(async (message) => {
    await persistMessage(message);
});

// Good: the caller waits for all writes to finish.
await Promise.all(messages.map((message) => persistMessage(message)));

/**
 * Run a provider operation and release its lock on success or failure.
 * @param request the provider operation to submit
 * @returns the provider's result
 * @throws wraps a provider failure while preserving its cause
 */
export async function createProviderOperation(request: ProviderOperationRequest): Promise<ProviderOperationResult> {
    try {
        return await postProviderOperation(request);
    } catch (error) {
        throw new Error('Provider operation failed.', { cause: error });
    } finally {
        releaseOperationLock(request.operationId);
    }
}
```

## Comments

Comments document purpose, invariants, security boundaries, concurrency behavior, and runtime
assumptions, never TypeScript syntax or restated code; type tags stay out of JSDoc because
TypeScript owns types.
