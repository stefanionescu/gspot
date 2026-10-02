---
title: Naming Files
---

# Naming Files

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

Casing across languages, file and directory names, boundary and external names, and test names.
The vocabulary and function-name rules are in the Naming file.

## Casing across languages

<!-- level: all -->

Each language naming file states its own case table. These decisions hold across every language so
the same concept reads the same way at every boundary.

| Concern               | Rule                                                                                                                                                                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acronyms              | Follow the language: TypeScript, JavaScript treat them as words (`parseHttpUrl`, `userId`); Swift keeps uppercase initialisms (`avatarURL`, `userID`, `apiClient` at the start of a name); Python, SQL, Bash lowercase them inside snake_case (`http_url`, `user_id`). A platform name keeps its spelling (`XMLHttpRequest`). |
| Directories           | kebab-case for TypeScript, JavaScript, Bash, HTML, CSS, and static sites; snake_case for Python packages; PascalCase for Swift directories, which mirror type names.                                                                                                                                                          |
| Test files            | `<name>.test.ts` (never `.spec`); `test_<module>.py` grouped by behavior; `<Type>Tests.swift`; pgTAP files under `tests/`. The directory is `tests/`, never `__tests__`, `test/`, or `spec/`. Support code lives in the harness folder that `architecture.roles.harness` names.                                               |
| Booleans              | Stored state uses concise positive names such as `enabled` or `retryable`. Computed predicates use `is`, `has`, or `can` in the language's case convention. External names keep their spelling.                                                                                                                               |
| Identifiers           | `userID` in Swift, `userId` in TypeScript and JSON, `user_id` in Python and SQL. The boundary that maps a row to a response translates the casing; domain code never sees both.                                                                                                                                               |
| On the wire           | Preserve existing external contracts. For project-owned contracts, use camelCase JSON fields, kebab-case URL segments, `UPPER_SNAKE_CASE` environment variables, and lower_snake_case log events.                                                                                                                             |
| Environment variables | `UPPER_SNAKE_CASE`, named by the external contract. No application prefix is required; platform-owned names are kept verbatim.                                                                                                                                                                                                |
| Constants             | Module-level constants bound to a literal or a frozen object are `UPPER_SNAKE_CASE` in TypeScript, JavaScript, Python, and Bash, and lowerCamelCase in Swift.                                                                                                                                                                 |

## Files and directories

<!-- level: all -->

Files and directories define ownership. Name them for the behavior or entity
they own, not for reuse intent.

Rules:

- File names follow the language-specific case rules below.
- A source file with one primary top-level type is named after that type when
  the language uses primary-type filenames.
- A module file is named after the cohesive capability it owns.
- Do not create catch-all files or directories for unrelated code.
- Do not move code into shared locations for a caller that does not exist yet.
- Promote shared code only when there is a repeated concept and a stable owner.
- A directory named by a broad layer is acceptable only when the project
  architecture explicitly owns that layer.
- Prefer feature ownership over top-level type buckets.
- No directory is named `common`, `core`, `helper`, `helpers`, `util`, `utils`, `support`,
  `misc`, `shared`, or after a language or runtime (`bash`, `javascript`, `python`, `node`,
  `js`). Name it for what it owns.
- The harness folder that `architecture.roles.harness` names is the declared exception for test
  setup and lifecycle support. Group its
  contents by responsibility instead of collecting unrelated helpers in one module.
- A leaf directory holds more than one code file. One file in a folder is a file, not a folder.
- Sibling files do not share a leading name part: `asset-card.ts`, `asset-list.ts`, and
  `asset-row.ts` in one folder are an `asset/` directory with `card.ts`, `list.ts`, `row.ts`.
- Alternate formats of one basename count as one owner when grouping prefixes.
- A file stem never equals a sibling directory name: `orders.ts` beside `orders/` is a collision.
- A file name is a whole-part match against the same banned term list as identifiers.
- A generated artifact (a test result, a report, a build output) may carry a timestamp in its name;
  hand-written source never does.

| Avoid              | Prefer                        | Meaning                |
| ------------------ | ----------------------------- | ---------------------- |
| `Helpers.swift`    | `DateRangeFormatter.swift`    | Date range formatting. |
| `LoginStuff.swift` | `LoginView.swift`             | Login presentation.    |
| `common-utils.ts`  | `email-address-validation.ts` | Email validation.      |
| `src/helpers/`     | `src/accounts/`               | Account behavior.      |

## Boundaries and external names

<!-- level: all -->

External systems often use names that do not match the domain language. Keep
those names at the boundary and translate them intentionally.

Rules:

- Preserve external field names in DTOs, SQL rows, generated types, wire
  payloads, and validation schemas when changing them misrepresents the contract.
- Translate provider names into domain names before passing values into domain
  or presentation layers.
- Do not leak provider, database, storage, or HTTP mechanics into ViewModels,
  domain entities, use cases, or API-facing response names.
- If a name is part of an external contract, treat renaming it as a contract
  change.
- Use explicit mapping names when crossing layers.

Name an external order-submission payload `ProviderSubmitOrderResponse` and
preserve its wire fields, such as `providerOperationId` and `providerStatus`.
Convert it into `SubmittedOrder` only after validating and mapping the provider
status into the domain's order status.

Keep `storage_object_path` on a wire shape such as `MessageAttachmentDTO`.
Use `attachmentPath` on the validated `MessageAttachment` domain shape. The
conversion belongs to the boundary that understands the storage protocol.

## Tests

<!-- level: all -->

Test names and test data names describe observable behavior, not private
implementation details.

Rules:

- Name tests for the behavior and expected outcome.
- Use descriptive unique values for names, emails, IDs, queue names, event IDs,
  resource IDs, and external references.
- Avoid names tied to private helper names.
- Avoid test data names that hide the scenario.
- Test helpers are named for the behavior they create.
- Test data never become global mystery data.
- A test name is a sentence stating the scenario and the expected outcome. `edge cases`,
  `happy path`, `works`, `test1`, and `underTest` are banned.
- Support code lives in the harness folder; `mocks/`, `helpers/`, and `utils/` are banned
  directory names in test trees.
- Test file names follow the language table in "Casing Across Languages."

| Avoid       | Prefer                               |
| ----------- | ------------------------------------ |
| `2/29/2020` | `accepts February 29 in a leap year` |
| `throws`    | `rejects an invalid date format`     |

| Avoid          | Prefer                                                         | Meaning                            |
| -------------- | -------------------------------------------------------------- | ---------------------------------- |
| `test1`        | `testMessagesShowUnreadMessagesFirst`                          | Unread messages sort first.        |
| `testMessages` | `testSubmitButtonTappedShowsValidationErrorWhenEmailIsInvalid` | Invalid email prevents submission. |

## Review checklist

<!-- level: all -->

Before you run the checks of the repository, read the change against these questions:

- Does each name describe a role or domain concept that the caller recognizes?
- Does the owning module already supply any words repeated in the name?
- Do identifiers, files, and directories follow the selected language conventions?
- Do predicates read as assertions, and do singular and plural names match their values?
- Are provider fields, framework names, and other external contracts preserved?
- Does each file belong with the feature or tooling responsibility it serves?
- Do the naming checks pass without exceptions that cover unrelated names?

## Structural ownership

<!-- level: all -->

Keep constants, types, and schemas with their behavioral owner. Do not require top-level config
or types buckets, forwarding modules, one declaration per file, or mirrored source/test directories.

Report unnecessary function indirection with at most `limits.trivial_statements` executable statements.
The default is 2; the setting accepts positive integers and increasing it tightens enforcement.
Count nested statements, excluding comments, blank lines, type-only declarations, and nested
function bodies. Inspect nested functions independently. An expression body counts as one statement.

Preserve required function values and language signatures. In JavaScript and TypeScript, preserve
callbacks passed inline, stored in arrays, returned, or read through a name. Object callbacks also
retain their signatures when their containing object reaches a consumer through lexical aliases
or object spreads. Unused object methods and methods used only through direct local calls remain
subject to the threshold.

In JavaScript and TypeScript, preserve accessors, decorated methods,
overrides, and methods required by interfaces or base classes. Type predicates, assertion signatures,
and constructors that initialize instance state through parameter properties or assignments also carry contracts.
Empty constructors and constructors that only forward to `super` remain subject to the threshold.

Type assertions preserve whether a function is passed as a value or immediately called.
Directly called local wrappers and immediately
invoked functions remain subject to the threshold. Export visibility, class decorators, and filenames
alone grant no exemption.

A substantive required callback belongs to its enclosing
implementation, even when that implementation uses one return statement. Unused nested
declarations do not make a wrapper substantive. A self-call requires its function binding, including the local name of a named function expression.
Preserve identity, arity, `this`, and
evaluation order when inlining.
Use a narrow, reasoned suppression for external requirements the analyzer cannot establish.
Do not add filler statements.

Keep a calculation with two or more direct call sites in one owner. Resolve call sites through
lexical bindings and imported aliases. Shared calculations include operators, constructed values,
and composed calls. Fixed call arguments include literals and captured lexical bindings,
but not the function's own parameters. Repeated calls alone do not justify constant getters, identity functions,
property forwarding, or single-call wrappers.

A file containing only forwarding, aliases, re-exports, or trivial functions needs consolidation.
One substantial implementation or meaningful owned schema is sufficient. Factories own the
objects, arrays, and interpolated templates they construct, including structures passed to
schema builders. Returning an existing value or forwarding arguments does not establish ownership.
A shared calculation also satisfies the file ownership check.

The shared maximum is
7 declared parameters, with explicit language overrides. Bash has no formal parameter count.

Folder names such as `build`, `dist`, and `coverage` do not establish generated ownership.
Structural checks include authored files in those folders. Declare generated output explicitly.
