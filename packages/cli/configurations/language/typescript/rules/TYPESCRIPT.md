# TypeScript

Read this rule when you change TypeScript code.

TypeScript checks static types. JavaScript and runtime rules cover modules and execution.

## Files and modules

Error output and process exits stay at executable boundaries.

Do not edit compiler output with string replacement. Change the source or the compiler options, then ship the
output.

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

Annotate callback parameters when inference gives no clear type, rely on it for local details,
and keep generics minimal. A discriminated union or options object replaces overloads when
clearer. Make a parameter optional only when callers can omit the input.

## Errors and async work

`Promise.all` serves bounded independent fan-out. Order, rate limits, or failure isolation
call for sequential `await`. Large fan-out, provider calls, and batch work use runtime
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
 *
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

## Naming

<!-- level: all -->

### TypeScript files and modules

- Keep generator-style file names only for generator output.

### TypeScript variables

- Use explanatory destructuring names.

For a range comparison, name the value `value` and the bounds `minimum` and
`maximum`. Use a type that supports the comparison, such as `number`; an
unconstrained generic does not establish ordering semantics.

When iterating a map of users, destructure its entries as `[userId, user]`
instead of naming each pair `keyValue`.

Name a reused daily timer duration `MILLISECONDS_PER_DAY` and define it as
`86_400_000`. The name explains both the interval and its unit.

### TypeScript functions

- Use async/await in names only to distinguish a function from a blocking counterpart. The return type already shows async.

### TypeScript types

- Use plain and discriminated unions for alternatives.
- Use interfaces only when a framework contract, declaration merging, or
  `implements` relationship makes one the clearest tool.
- Use optional fields for values callers can omit.
- Avoid return-type-only generics. When you call an existing one, specify the
  type argument explicitly.
- Give the keys of an index signature meaningful names.
- Prefer `Map` for key/value operations.

Name a coffee response union `CoffeeResponse`; put `| undefined` on an
operation that can return nothing. Name a user index `UsersById` and its
key `userId`.

A function that selects a collection element ties its generic to the input.
Its return contract must account for an empty collection unless
the input type or validation proves that an element exists.
