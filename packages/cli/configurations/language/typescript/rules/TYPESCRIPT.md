# TypeScript

TypeScript checks static types. JavaScript and runtime rules cover modules and execution.

## Philosophy

TypeScript makes types explicit at compile time. Plain values, small functions, discriminated
unions, and clear modules keep types easier to read than elaborate type transformations.

## Files and modules

Diagnostics and process termination stay at executable boundaries. Check the effective lint
configuration for a path before assuming a rule. Follow the project's arrangement for types
and constants. Infer schema types from their authored schemas.

## Values and shapes

`as const` fixes a value set when it improves precision without obscuring
the runtime shape. Represent grouped data with an object literal. Annotate rather than cast when the type matters,
and destructure where that names the fields in use. `T[]` serves
arrays and `Array<T>` or `ReadonlyArray<T>` complex element types; `readonly` marks a
contract, not decoration. With `noUncheckedIndexedAccess`, an indexed read can have no value;
narrow it before use.

Use `unknown` plus narrowing for untrusted values. Casts give way to runtime narrowing, typed
helpers, or fixing the source type.
Represent known variants with discriminated unions.

Describe absence precisely: `property?: T` and
`property: T | undefined` define different types under `exactOptionalPropertyTypes`. A
nullable alias gets a name only when the domain defines the union. Add nullability
where the public interface allows absence. Normalize external empty strings,
missing fields, and nulls where they enter the program.

## Functions and classes

Annotate callback parameters when inference does not give a clear type, rely on inference for local details,
and keep generics minimal. A discriminated union or options object replaces overloads when
clearer. Make a parameter optional only for an optional input.

## Errors and async work

`Promise.all` serves bounded independent fan-out. Order, rate limits, or failure isolation
call for sequential `await`. Large fan-out, provider calls, and batch work use platform
concurrency utilities. Detach a promise only deliberately. Log and supervise it; never swallow a rejection.

This fragment uses the message and provider types, persistence functions, and lock operations
that their modules declare.

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
assumptions. Do not restate TypeScript syntax or code.
