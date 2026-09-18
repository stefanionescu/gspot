# `postgres`

Kind: database. Requires: sql.

## Detects and claims

|                         |                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detect                  | Postgres syntax in any `.sql` file; a Postgres connection string in configuration; supabase                                                               |
| Claims                  | `.sql` files under a migrations directory (`[tools.postgres] migrations_dir`, default detected from `supabase/migrations`, `migrations`, `db/migrations`) |
| Architecture it assumes | none. Postgres, not any product on it.                                                                                                                    |

## Tools

squawk, sqlfluff with dialect `postgres`, `libpg-query` inside gspot.

## Generated configuration

| Target                | Holds                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/squawk.toml`  | `assume_in_transaction` from `[tools.squawk]`, `excluded_rules` rendered from the `[[ignore]]` entries for `postgres/squawk`, `--exclude-path` for migrations at or before `frozen_through` |
| `.gspot/sqlfluff.cfg` | `dialect = postgres`                                                                                                                                                                        |

## Checks

| Id                                      | Stage  | Command                                                                                                                                                                                                                                                          |
| --------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `postgres/squawk`                       | commit | `squawk --config .gspot/squawk.toml {migrations after frozen_through}`                                                                                                                                                                                           |
| `postgres/migrations-frozen`            | commit | a migration at or before `frozen_through` differs from its committed bytes at that version: fail                                                                                                                                                                 |
| `postgres/migration-order`              | commit | timestamps ascend; no two migrations share a timestamp                                                                                                                                                                                                           |
| `structure/sql-migration-docs`          | commit | boxed header with `-- Migration: <file>` and `-- Purpose:`; section headings boxed; `CREATE SCHEMA`, `TABLE`, `INDEX`, `FUNCTION`, `TRIGGER`, `EXTENSION` under their section; entity labels with purpose and separators; `-- Row Level Security` capitalization |
| `postgres/rls-present`                  | commit | every `CREATE TABLE` in a schema exposed to clients has `ENABLE ROW LEVEL SECURITY` and at least one policy in the same or a later migration                                                                                                                     |
| `postgres/explicit-grants`              | commit | no `GRANT ALL`; grants name columns or a role the repository declares                                                                                                                                                                                            |
| `postgres/security-definer-search-path` | commit | every `SECURITY DEFINER` function sets `search_path`                                                                                                                                                                                                             |
| `postgres/index-covers-foreign-key`     | commit | every foreign key column has an index                                                                                                                                                                                                                            |
| `naming/identifiers`                    | commit | the SQL categories; `uuid_v7` suffix rule                                                                                                                                                                                                                        |

## Settings

`tools.squawk.assume_in_transaction` (default `true` under supabase), `tools.squawk.frozen_through` (`none`, `all`, or a version), `tools.postgres.migrations_dir`,
`tools.postgres.client_schemas` (default `public`), `tools.postgres.doc_sections` (the section
name list).

## Rule files

`database/postgres/POSTGRES.md`.
