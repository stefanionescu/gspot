# drizzle

Kind: library. Requires: typescript, postgres when the dialect is Postgres.

## Detects

`drizzle-orm` in dependencies; `drizzle.config.*`.

## Generated configuration

The ESLint config gains `eslint-plugin-drizzle` (`enforce-delete-with-where`,
`enforce-update-with-where`) and a `no-restricted-syntax` selector that refuses `sql` template
literals outside `[tools.drizzle] raw_sql_allowed`.

## Checks

| Id                           | Stage  | Command                                                                                |
| ---------------------------- | ------ | -------------------------------------------------------------------------------------- |
| `typescript/eslint`          | commit | with the rules above                                                                   |
| `drizzle/migrations-fresh`   | push   | `drizzle-kit generate` produces no new migration (the schema and the migrations agree) |
| `drizzle/relations-complete` | commit | ast-grep: every `references()` has a matching `relations()` entry                      |

## Settings

`tools.drizzle.config`, `tools.drizzle.raw_sql_allowed` (paths, reason).

## Rule files

`library/drizzle/DRIZZLE.md`.
