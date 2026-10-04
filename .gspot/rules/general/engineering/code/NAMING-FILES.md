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
| On the wire           | Preserve existing external contracts. For project-owned contracts, use camelCase JSON fields, kebab-case URL segments.                                                                                                                                                                                                        |
| Environment variables | `UPPER_SNAKE_CASE`, named by the external contract. No application prefix is required; platform-owned names are kept verbatim.                                                                                                                                                                                                |
| Constants             | Module-level constants bound to a literal or a frozen object are `UPPER_SNAKE_CASE` in TypeScript, JavaScript, Python, and Bash, and lowerCamelCase in Swift.                                                                                                                                                                 |

## Files and directories

<!-- level: all -->

Files and directories define ownership: name them for the behavior or entity they own, not for
reuse.

- A file with one primary type is named after it where the language does so; a module is named
  after the capability it owns. Prefer feature folders to top-level type buckets.
- Move code to a shared place only for a repeated concept with a stable owner, never for a caller
  that does not exist yet.
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

## Structural ownership

<!-- level: all -->

Follow the repository's declared arrangement for constants, types, and schemas. Group each by
the behavior it belongs to. Do not impose a config or types folder on another project, and do
not mirror the source tree in tests.
