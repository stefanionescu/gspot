---
title: JavaScript Naming
---

# JavaScript Naming

JavaScript naming follows the same role, responsibility, and boundary principles
as TypeScript. Use the JavaScript rules when editing `.js`, `.mjs`, `.cjs`, and
plain JavaScript tooling files.

## JavaScript imports and exports

<!-- level: all -->

Rules:

- Namespace import aliases derive from the imported filename or
  clear package name.
- Named imports keep their exported name unless a collision forces an alias.
- If aliasing a named import is required, use a domain or path component that
  explains the collision.
- Default import names follow the identifier type being imported, but default
  imports are limited to ecosystem modules that require them.

Use `fileOne` for a namespace import from `file-one.js`. If two modules export
`Cat`, use an alias such as `DomesticatedCat` that identifies the owning domain.

## JavaScript files

<!-- level: all -->

| Avoid             | Prefer                         | Meaning                        |
| ----------------- | ------------------------------ | ------------------------------ |
| `Helpers.js`      | `session-token-verifier.js`    | Session token verification.    |
| `UserService.js`  | `user-repository.js`           | User persistence.              |
| `sharedUtils.mjs` | `email-template-formatter.mjs` | Email template formatting.     |
| `data.cjs`        | `database-connection.cjs`      | Database connection lifecycle. |
