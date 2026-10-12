# JavaScript Naming

JavaScript naming follows the same role, responsibility, and boundary principles
as TypeScript. Use the JavaScript rules when editing `.js`, `.mjs`, `.cjs`, and
plain JavaScript tooling files.

## JavaScript imports and exports

<!-- level: all -->

- Namespace import aliases derive from the imported filename or
  clear package name.
- Named imports keep their exported name unless a collision forces an alias.
- If the module requires a named import alias, use a domain or path component that
  explains the collision.
- Default import names follow the imported identifier type, but use default
  imports only for ecosystem modules that require them.

Use `fileOne` for a namespace import from `file-one.js`. If two modules export
`Cat`, use an alias such as `DomesticatedCat` that identifies the owning domain.

## JavaScript and TypeScript files

<!-- level: all -->

| Avoid            | Prefer                        | Meaning                        |
| ---------------- | ----------------------------- | ------------------------------ |
| `Helpers.js`     | `session-token-verifier.js`   | Session token verification.    |
| `UserService.ts` | `user-repository.ts`          | User persistence.              |
| `sharedUtils.ts` | `email-template-formatter.ts` | Email template formatting.     |
| `data.cjs`       | `database-connection.cjs`     | Database connection lifecycle. |
