# sql

Kind: language. Requires: structure, naming, formatting, spelling.

## Detects and claims

| | |
| --- | --- |
| Detect | `.sql`, `.pgsql`, `.psql` in the tree |
| Claims | `.sql`, `.pgsql`, `.psql` |
| Required inspections | format, syntax, style, structure, naming, prose, spelling |

## Tools

sqlfluff; `libpg-query` (WASM, inside gspot) for parsing and naming extraction.

## Generated configuration

| Target | Stub | Holds |
| --- | --- | --- |
| `.gspot/sqlfluff.cfg` | `.sqlfluff` with `[sqlfluff] config_path` is not supported by sqlfluff; the stub is a copy with a header, guarded by `sync --check` | `sql_file_exts` covering all three extensions, dialect from the database preset (`ansi` alone), line length and indent from `[format]`, `capitalisation` and `references` rules aligned with the naming policy |

sqlfluff never reads a `.sqlfluffignore`; gspot passes the file list.

## Checks

| Id | Stage | Command |
| --- | --- | --- |
| `sql/sqlfluff` | commit | `sqlfluff lint --config .gspot/sqlfluff.cfg --nofail=false {files}`; fix `sqlfluff fix`, order format |
| `sql/syntax` | commit | `libpg-query` parse; a parse error is a finding |
| `structure/file-length` | commit | code lines |
| `naming/identifiers` | commit | schemas, tables, columns, functions, parameters, indexes, triggers, policies |
| `structure/sql-no-block-comments` | commit | `/* */` refused so the prose engine reads every comment |

## Settings

`tools.sqlfluff.dialect` (set by the database preset), `tools.sqlfluff.rules` (per-rule, off with a reason),
`tools.sqlfluff.exclude_rules`.

## Rule files

`language/SQL.md`, `language/naming/SQL.md`.

## Not covered here

Migration safety, documentation layout and immutability belong to postgres. Row-level security
and grants belong to supabase.
