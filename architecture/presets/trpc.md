# trpc

Kind: library. Requires: typescript.

## Detects

`@trpc/server` in dependencies.

## Generated configuration

The ESLint config gains `no-restricted-syntax` selectors: every procedure has an `.input()`
schema before `.query`, `.mutation` or `.subscription`; no `any` in a procedure output.

## Checks

| Id | Stage | Command |
| --- | --- | --- |
| `typescript/eslint` | commit | with the selectors |
| `trpc/router-boundaries` | commit | routers live in the server element of `[architecture]`; the client imports only the router type |

## Settings

None beyond `architecture.*`.

## Rule files

`library/trpc/TRPC.md`, `shared/http/HTTP.md`.
