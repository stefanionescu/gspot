---
title: Naming Files
---

# Naming Files

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

Files and directories define ownership: name them for the behavior or entity they own, not for
reuse.

- A file with one primary type is named after it where the language does so; a module is named
  after the capability it owns. Prefer feature folders to top-level type buckets.
- No catch-all file or directory: no `common`, `core`, `helper`, `helpers`, `util`, `utils`,
  `support`, `misc`, or `shared`, and no folder named after a language or runtime. The harness
  folder that `architecture.roles.harness` names is the exception for test setup.
- Move code to a shared place only for a repeated concept with a stable owner, never for a caller
  that does not exist yet.
- A leaf directory holds more than one code file. Sibling files do not share a leading name part:
  `asset-card.ts` and `asset-list.ts` are `asset/card.ts` and `asset/list.ts`. A file stem never
  equals a sibling directory name.
- A file name avoids the banned terms identifiers avoid. Only a generated artifact may carry a
  timestamp in its name.

| Avoid              | Prefer                        | Meaning                |
| ------------------ | ----------------------------- | ---------------------- |
| `Helpers.swift`    | `DateRangeFormatter.swift`    | Date range formatting. |
| `LoginStuff.swift` | `LoginView.swift`             | Login presentation.    |
| `common-utils.ts`  | `email-address-validation.ts` | Email validation.      |
| `src/helpers/`     | `src/accounts/`               | Account behavior.      |

## Boundaries and external names

<!-- level: all -->

External systems use names that do not match the domain language. Keep them at the boundary:
DTOs, SQL rows, generated types, wire payloads, and validation schemas keep the external field
names, and renaming one is a contract change. Translate them into domain names, through explicitly
named mappings, before the values reach domain or presentation code; provider, database, and HTTP
mechanics stay out of domain names.

A wire shape such as `MessageAttachmentDTO` keeps `storage_object_path`. The validated
`MessageAttachment` uses `attachmentPath`, and the boundary that knows the storage protocol
converts one into the other.

## Tests

<!-- level: all -->

A test name is a sentence that states the scenario and the expected outcome, such as `accepts
February 29 in a leap year`, never `edge cases`, `happy path`, `works`, or `test1`. Test data uses
descriptive unique values that show the scenario. The testing rules cover where tests and their
helpers live.

## Structural ownership

<!-- level: all -->

Keep constants, types, and schemas with their behavioral owner. Do not require top-level config
or types buckets, forwarding modules, one declaration per file, or mirrored source and test
folders.

A function that only forwards to another, with `limits.trivial_statements` statements or fewer,
is inlined into its callers. Keep the function values a contract needs: callbacks passed or
returned, accessors, overrides, and methods an interface requires. For an external requirement the
check cannot see, use a narrow suppression with a reason; never add filler statements. A
calculation with two or more callers keeps one owner, and a file of only forwarding, aliases,
re-exports, or trivial functions merges into its owner.

Folder names such as `build`, `dist`, and `coverage` do not make a file generated; declare
generated output explicitly.
