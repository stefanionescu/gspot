---
title: Naming Files
---

# Naming Files

Files and directories, and boundaries and external names.
The vocabulary and function-name rules are in the Naming file.

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
