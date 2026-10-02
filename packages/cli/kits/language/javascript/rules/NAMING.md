---
title: JavaScript Naming
---

# JavaScript Naming

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

JavaScript naming follows the same role, responsibility, and boundary principles
as TypeScript. Use the JavaScript rules when editing `.js`, `.mjs`, `.cjs`, and
plain JavaScript tooling files.

## Project decisions

<!-- level: all -->

- Prefer TypeScript for app code. Use JavaScript naming rules for tooling,
  config, migration support, quality scripts, and ecosystem-owned JavaScript.
- Use `kebab-case` source filenames, even though some external guides also allow
  underscores.
- Prefer named exports in hand-written modules.
- Use default exports only for ecosystem files that require them or external
  packages that expose them.
- Do not create static container classes or nested namespaces for organization.

## JavaScript case rules

<!-- level: all -->

Rules:

- Classes, constructor values, and React components use `PascalCase`.
- JSDoc record, interface, enum item, and typedef names use `PascalCase`.
- Functions, methods, variables, parameters, properties, and module aliases use
  `camelCase`.
- A module-level `const` bound to a literal or a frozen object is `UPPER_SNAKE_CASE`. Every
  other binding is `camelCase`.
- JSDoc enum members use `UPPER_SNAKE_CASE`.
- Source filenames use `kebab-case` unless an ecosystem tool owns the filename.
- Do not use default exports unless an ecosystem file requires them.
- Do not use namespaces or static classes as containers.
- Use ASCII identifier names. Keep non-ASCII characters in strings or comments
  unless an external API requires otherwise.
- Do not abbreviate by deleting letters from a word.
- Do not use a trailing underscore to signal privacy; use module scope or the
  language/framework visibility mechanism available in that file.
- Short one-letter local names are acceptable only in tiny scopes where the role
  is conventional and obvious, such as `i` in a small loop.
- `handle` starts a name only for a DOM or framework event callback (`handleClick`). Never
  `Handler` as a type suffix.
- Directories are kebab-case. Test files are `<name>.test.js`, never `.spec`.

| Avoid          | Prefer            | Meaning                       |
| -------------- | ----------------- | ----------------------------- |
| `user_service` | `UserRepository`  | A persistence owner.          |
| `MAXCOUNT`     | `MAX_RETRY_COUNT` | A module-level literal limit. |
| `Build_User`   | `buildUser`       | Construct a user value.       |
| `nErr`         | `errorCount`      | Number of errors.             |
| `cstmrId`      | `customerId`      | Customer identifier.          |

## JavaScript imports and exports

<!-- level: all -->

Rules:

- Namespace import aliases use `camelCase` derived from the imported filename or
  clear package name.
- Named imports keep their exported name unless a collision forces an alias.
- If aliasing a named import is required, use a domain or path component that
  explains the collision.
- Default import names follow the identifier type being imported, but default
  imports are limited to ecosystem modules that require them.
- Named exports keep naming consistent across import sites.
- Do not export mutable variables as the public contract. Export functions or an
  item with clearly named mutable fields when mutation is intentional.

Use `fileOne` for a namespace import from `file-one.js`. If two modules export
`Cat`, use an alias such as `DomesticatedCat` that identifies the owning domain.
Export `ProfileClient` by name so its import sites retain the same term.

Keep mutable state with its behavioral owner. Do not introduce a getter that
only returns a global variable to make an export look like an API.

## JavaScript files

<!-- level: all -->

| Avoid             | Prefer                         | Meaning                        |
| ----------------- | ------------------------------ | ------------------------------ |
| `Helpers.js`      | `session-token-verifier.js`    | Session token verification.    |
| `UserService.js`  | `user-repository.js`           | User persistence.              |
| `sharedUtils.mjs` | `email-template-formatter.mjs` | Email template formatting.     |
| `data.cjs`        | `database-connection.cjs`      | Database connection lifecycle. |

## JavaScript functions and values

<!-- level: all -->

Use `currentDate` for the current date and `userIds` for a collection of user
identifiers. A parser that validates the user contract can be named
`parseUserPayload`. Call `JSON.parse` directly when parsing JSON is the entire
operation; do not create a forwarding function solely to give it a domain name.

## JavaScript boundaries

<!-- level: all -->

JavaScript often appears in tooling, config, and quality scripts. Name the
script owner and exported functions by the contract they serve.

Name a function `collectNamingViolations` when it inspects a scope under a
naming policy and returns violations. A generic `run` name hides that contract.
Do not invent a script-wide abstraction when the behavior already has an owner.
