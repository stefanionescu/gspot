# TypeScript

Read this rule when you change TypeScript code.

Error output and process exits stay at executable boundaries.

## Values and shapes

Write `T[]` for arrays, and `Array<T>` or `ReadonlyArray<T>` for complex element types.

Use `unknown` plus narrowing for untrusted values. Casts give way to runtime narrowing, typed helpers, or fixing the
source type. Represent known variants with discriminated unions.

Normalize external empty strings, missing fields, and nulls where they enter the program.

Derive a type that repeats fields of another type with `Pick`, `Omit`, an indexed access, or an intersection. Check a
table keyed by a list, or a subset of a list, against the list's type with `satisfies`.

Use a literal union or an `as const` object instead of an `enum`.

Write each condition as a boolean. Compare strings, numbers, and optional values explicitly, such as `name !== ''`.

Declare the parameter and return types of each exported function.

Keep `strict` and the compiler options of the level on in every tsconfig.

## Errors and async work

Use `Promise.all` for a bounded set of independent calls. Use sequential `await` when order, rate limits, or failure
isolation matter. Use runtime concurrency utilities for large fan-out, provider calls, and batch work. Detach a promise
only deliberately. Log and supervise it; never swallow a rejection.

## Naming

<!-- level: all -->

### TypeScript types

- Write a `type` alias. Use an `interface` only to merge with a declaration in a `.d.ts` file.
- Avoid return-type-only generics. When you call an existing one, specify the type argument explicitly.
