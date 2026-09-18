---
title: "Formatting"
description: "One [format] block every formatter reads, so indentation cannot disagree between Prettier, shfmt, Ruff, and markdownlint."
---

One [format] block every formatter reads, so indentation cannot disagree between Prettier, shfmt, Ruff, and markdownlint.

Kind: concern.

## Tools

- prettier 3.8.1
- ec 3.4.0

## Generated configuration

- `.editorconfig`
- `.gspot/prettier.json`
- `.prettierignore`

## Checks

| Check                                                                                  | Stage  | What it finds                                                                                    |
| -------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| [`formatting/prettier`](/reference/rules/formatting/prettier/)                         | commit | Checks that every file Prettier formats is already formatted that way.                           |
| [`formatting/editorconfig-checker`](/reference/rules/formatting/editorconfig-checker/) | commit | Checks line endings, final newlines and trailing whitespace in every file against .editorconfig. |

## Settings

- `format.indent_style`: What one indent level is made of: space or tab.
- `format.indent_width`: Spaces per indent level.
- `format.print_width`: The line width formatters wrap at.
- `format.line_ending`: The line ending every file uses: lf or crlf.
- `format.newline_at_end`: Whether every file ends with a newline.
- `format.quotes`: single or double, for the languages where a formatter chooses.
- `format.trailing_comma`: Where trailing commas go: all, es5, or none.
- `format.semicolons`: Whether JavaScript and TypeScript statements end with semicolons.
- `tools.editorconfig.extra`: A section gspot does not render, added verbatim to .editorconfig with a reason.
