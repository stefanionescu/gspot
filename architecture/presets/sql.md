# `sql`

Kind: language. Requires: formatting. Recommends: naming, structure, spelling.

## Detects and claims

|                         |                                                           |
| ----------------------- | --------------------------------------------------------- |
| Detect                  | `.sql`, `.pgsql`, `.psql` in the tree                     |
| Claims                  | `.sql`, `.pgsql`, `.psql`                                 |
| Required check coverage | format, syntax, style, structure, naming, prose, spelling |

## Tools

sqlfluff; `libpg-query` (WASM, inside gspot) for parsing and naming extraction.

## Generated configuration

| Target                | Stub                                                                        | Holds                                                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/sqlfluff.cfg` | no root file: sqlfluff has no include form, and the check passes `--config` | `sql_file_exts` covering all three extensions, dialect from the database preset (`ansi` alone), line length and indent from `[format]`, `capitalization` and `references` rules aligned with the naming policy |

sqlfluff never reads a `.sqlfluffignore`; gspot passes the file list.

## Shipped sqlfluff settings

| Key                                    | Value                                  |
| -------------------------------------- | -------------------------------------- |
| `templater`                            | `raw`                                  |
| `max_line_length`                      | `format.print_width`, shipped 120      |
| `large_file_skip_byte_limit`           | 0                                      |
| `indent_unit`, `tab_space_size`        | from `[format]`, shipped `space` and 4 |
| `capitalisation.keywords`, `.literals` | `upper`                                |
| `capitalisation.functions`, `.types`   | `upper` (extended policy)              |
| `capitalisation.identifiers`           | `lower` (extended policy)              |
| `exclude_rules`                        | none shipped                           |

The reference repository excludes `RF02`, `RF04`, `RF05`, `RF06`, `AM04`, `LT02`, `LT05` and
`LT12`. Takeover carries each one as an `[[ignore]]` entry for `sql/sqlfluff` with the comment
above it as the reason, so the exclusions stay visible and reviewable, and no repository inherits
them.

## Checks

| Id                   | Stage  | Command                                                                                               |
| -------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| `sql/sqlfluff`       | commit | `sqlfluff lint --config .gspot/sqlfluff.cfg --nofail=false {files}`; fix `sqlfluff fix`, order format |
| `sql/syntax`         | commit | `libpg-query` parse when the dialect is `postgres` or `ansi`; a parse error is a finding              |
| `sql/file-length`    | commit | code lines against `limits.sql.file_lines` (default 400)                                              |
| `naming/identifiers` | commit | schemas, tables, columns, functions, parameters, indexes, triggers, policies                          |
| `sql/block-comments` | commit | `/* */` refused so the prose engine reads every comment                                               |

## Settings

`tools.sqlfluff.dialect` (set by the database preset), `tools.sqlfluff.rules` (per-rule options; a rule turned off
is `gspot ignore sql/sqlfluff --rule <code>`, rendered into `exclude_rules`).

## Rule files

`language/SQL.md`, `language/naming/SQL.md`.

## Not covered here

Migration safety, documentation layout, and immutability belong to postgres. Row-level security
and grants belong to supabase.
