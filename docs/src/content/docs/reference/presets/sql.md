---
title: "SQL"
description: "SQL files: sqlfluff for layout and style, a parse by the Postgres parser, names checked by category, and line comments only."
---

SQL files: sqlfluff for layout and style, a parse by the Postgres parser, names checked by category, and line comments only.

Kind: language. Requires: `formatting`.

## Tools

- sqlfluff 4.0.0

## Generated configuration

- `.gspot/sqlfluff.cfg`

## Checks

| Check                                                        | Stage  | What it finds                                                                                                                  |
| ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| [`sql/sqlfluff`](/reference/rules/sql/sqlfluff/)             | commit | Lints every SQL file for layout, capitalization, aliasing, and ambiguous references, in the dialect the database preset names. |
| [`sql/syntax`](/reference/rules/sql/syntax/)                 | commit | Parses every SQL file with the parser Postgres itself uses, when the dialect is postgres or ansi.                              |
| [`sql/block-comments`](/reference/rules/sql/block-comments/) | commit | Refuses block comments in SQL, so every comment is a line comment.                                                             |
| [`sql/file-length`](/reference/rules/sql/file-length/)       | commit | Checks that no SQL file has more code lines than the ceiling.                                                                  |

## Settings

- `tools.sqlfluff.dialect`: The sqlfluff dialect; a database preset sets it.
- `limits.sql.file_lines`: The most code lines a SQL file may have.

## Rule files

- `language/SQL.md`
- `language/naming/SQL.md`
