---
title: TypeScript Naming
---

# TypeScript Naming

TypeScript naming follows the project rules here. Google TypeScript guidance is
a strong default for many language choices. The rules below deliberately override some of it, and
say so where they do.

## Project decisions

<!-- level: all -->

- Use `kebab-case` filenames for TypeScript source files.
- Use `type` aliases for object shapes by default.
- Do not adopt Google's blanket interface preference.
- Do not adopt Basarat's camelCase filename preference.
- Named exports are preferred for app code.
- Default exports are allowed only where ecosystem config files or frameworks
  require them.
- Prefix intentionally unused parameters or variables with `_` when needed.
- Do not introduce broad naming-lint policy changes outside an explicit
  quality-rule task.

## TypeScript case rules

<!-- level: all -->

Rules:

- Type aliases, classes, interfaces used for framework contracts, React
  components, decorators, and constructor values use `PascalCase`.
- Do not introduce TypeScript enums; if external or generated code exposes an
  enum-like type, keep its required contract name, and isolate it at the
  boundary.
- Functions, methods, variables, parameters, properties, module aliases, and
  local values use `camelCase`.
- A module-level `const` bound to a literal, a frozen object, or an `as const` object is
  `UPPER_SNAKE_CASE`. Every other binding is `camelCase`, including module-level values that
  are computed, and `static readonly` members follow the same split.
- Do not use leading or trailing underscores except intentionally unused
  parameters or variables.
- Do not prefix interfaces with `I`.
- Type parameters may use a single clear uppercase letter or a descriptive
  `PascalCase` name.
- Treat abbreviations as words unless the platform name requires otherwise:
  `parseHttpUrl`, not `parseHTTPURL`, but `XMLHttpRequest` remains a platform
  name.

| Avoid              | Prefer            | Meaning                          |
| ------------------ | ----------------- | -------------------------------- |
| `IUserRepository`  | `UserRepository`  | A user persistence contract.     |
| `user_profile`     | `UserProfile`     | A user shape.                    |
| `daysInMonth`      | `DAYS_IN_MONTH`   | A module-level literal constant. |
| `DEFAULT_CLIENT`   | `defaultClient`   | A constructed client.            |
| `restore_database` | `restoreDatabase` | A restoration operation.         |
| `URLValue`         | `urlValue`        | A local URL string.              |

## TypeScript files and modules

<!-- level: all -->

Rules:

- TypeScript source filenames use `kebab-case`.
- File names describe the primary exported type, function, route, or cohesive
  capability.
- Do not use namespaces, `module`, triple-slash references, or
  `import x = require(...)` to simulate ownership.
- Use file scope and named exports instead of static container classes.
- Do not create files named only for generic reuse.
- Keep generated file names only when generator-owned.
- React component files are kebab-case too: `login-form.tsx` exports `LoginForm`. One rule for
  every file; the export name carries the PascalCase.
- Next.js reserved names are exempt from the stem checks and keep their framework spelling:
  `page`, `layout`, `loading`, `error`, `global-error`, `not-found`, `route`, `template`,
  `default`, `middleware`, `instrumentation`, `[param]`, `[...slug]`, `(group)`, `_private`,
  `@slot`.
- Test files are `<name>.test.ts` or `<name>.test.tsx`, never `.spec`. Directories are
  kebab-case.
- `handle` starts a name only for a React event prop or a framework callback
  (`handleSubmit`, `handleKeyDown`). Never `Handler` as a type suffix.

| Avoid                      | Prefer                        | Meaning                     |
| -------------------------- | ----------------------------- | --------------------------- |
| `UserService.ts`           | `user-repository.ts`          | User persistence.           |
| `userHelpers.ts`           | `email-address-validation.ts` | Email validation.           |
| `utils.ts`                 | `session-token-verifier.ts`   | Session token verification. |
| `ReportReaderContainer.ts` | `report-reader.ts`            | Report reading.             |

Export meaningful module declarations directly. A retry limit belongs in
`MAX_RETRY_COUNT`, not in a static container class or behind a constant getter.

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

A function that creates an owned temporary file has a different lifecycle
contract from one that writes a caller-selected path. Name and implement those
operations at their owners. Do not create a Boolean mode or a one-call wrapper
that obscures path ownership.

Group a menu constructor's related text fields in `MenuOptions`. A named
`isCancellable` field makes the control explicit. Keep independent behaviors
in their existing owners instead of adding flags to a shared function.

## TypeScript types

<!-- level: all -->

Rules:

- Use `type` aliases for object shapes by default.
- Use unions and discriminated unions for alternatives.
- Use interfaces only when a framework contract, declaration merging, or
  `implements` relationship makes an interface the clearest tool.
- Do not encode optionality in an alias name.
- Use optional fields and parameters for values that may be omitted.
- Avoid return-type-only generics. When using an existing return-type-only
  generic API, specify the generic explicitly.
- Avoid `any`; use a specific type or `unknown` with narrowing.
- Name index keys meaningfully if an index signature is needed.
- Prefer `Map` when key/value behavior is the point.

Name a coffee response union `CoffeeResponse`; put `| undefined` on an
operation that can return no response. Name a user index `UsersById` and its
index key `userId`.

A function that selects a collection element ties its generic to the input
collection. Its return contract must account for an empty collection unless
the input type or validation proves that an element exists.

## TypeScript runtime boundaries

<!-- level: all -->

Rules:

- Preserve external field names in DTOs and validation schemas.
- Name parsed or validated values as trusted domain values after validation.
- Do not rename external fields just to make validation code look idiomatic if
  the runtime contract still uses the external name.
- Use explicit conversion names for DTO-to-domain mapping.

Parse and validate an HTTP body before calling it `submitOrderRequest`.
A type assertion does not establish that the body satisfies the request contract.

Use `ProviderSubmitOrderResponse` for the provider's response to an order
submission. Preserve its external fields, such as `providerOperationId` and
`providerStatus`, until the boundary converts them into domain values.
