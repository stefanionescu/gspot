---
title: TypeScript Naming
---

# TypeScript Naming

TypeScript naming follows the project rules here. Google TypeScript guidance is
a strong default for many language choices. The rules below deliberately override some of it, and
say so where they do.

## TypeScript files and modules

<!-- level: all -->

Rules:

- File names describe the primary exported type, function, route, or cohesive
  capability.
- Do not use namespaces, `module`, triple-slash references, or
  `import x = require(...)` to simulate ownership.
- Do not create files named only for generic reuse.
- Keep generated file names only when generator-owned.

| Avoid                      | Prefer                        | Meaning                     |
| -------------------------- | ----------------------------- | --------------------------- |
| `UserService.ts`           | `user-repository.ts`          | User persistence.           |
| `userHelpers.ts`           | `email-address-validation.ts` | Email validation.           |
| `utils.ts`                 | `session-token-verifier.ts`   | Session token verification. |
| `ReportReaderContainer.ts` | `report-reader.ts`            | Report reading.             |

## TypeScript variables

<!-- level: all -->

Rules:

- Use meaningful, pronounceable names.
- Use the same vocabulary for the same concept.
- Use explanatory destructuring names.
- Avoid mental mapping with single-letter names except tiny local scopes.
- Use named constants for meaningful repeated numbers or strings.
- Do not add context already present in the type or owner.

For a range comparison, name the value `value` and the bounds `minimum` and
`maximum`. Use a type that supports the comparison, such as `number`; an
unconstrained generic does not establish ordering semantics.

When iterating a map of users, destructure its entries as `[userId, user]`
instead of naming each pair `keyValue`.

Name a reused daily timer duration `MILLISECONDS_PER_DAY` and define it as
`86_400_000`. The name explains both the interval and its unit.

## TypeScript functions

<!-- level: all -->

Rules:

- Function names say what they do.
- Prefer two or fewer parameters.
- Use an options object for many arguments, multiple same-type arguments,
  optional groups, or boolean flags.
- Do not use boolean flags to choose separate behaviors.
- Prefer a positive predicate name plus `!` at the call site over a negative
  predicate function.
- Use async/await in names only when distinguishing from a blocking counterpart
  is necessary. Normally the return type communicates async.
- Name functions by domain work, not implementation mechanics.

## TypeScript types

<!-- level: all -->

Rules:

- Use unions and discriminated unions for alternatives.
- Use interfaces only when a framework contract, declaration merging, or
  `implements` relationship makes an interface the clearest tool.
- Do not encode optionality in an alias name.
- Use optional fields and parameters for values that may be omitted.
- Avoid return-type-only generics. When using an existing return-type-only
  generic API, specify the generic explicitly.
- Name index keys meaningfully if an index signature is needed.
- Prefer `Map` when key/value behavior is the point.

Name a coffee response union `CoffeeResponse`; put `| undefined` on an
operation that can return no response. Name a user index `UsersById` and its
index key `userId`.

A function that selects a collection element ties its generic to the input
collection. Its return contract must account for an empty collection unless
the input type or validation proves that an element exists.
