# formatting

Kind: repository. Required by every language preset. One `[format]` block that every formatter
reads, so indentation cannot disagree between Prettier, shfmt, Ruff and markdownlint.

## Settings

```toml
[format]
indent_style  = "space"
indent_width  = 4
print_width   = 120
line_ending   = "lf"
final_newline = true
quotes        = "single"        # prettier and ruff; swift keeps double
trailing_comma = "all"
semicolons    = true
```

Defaults are the values three of four reference repositories share.

## Generated configuration

| Target | Stub | Derived |
| --- | --- | --- |
| `.editorconfig` | managed block | `end_of_line`, `insert_final_newline`, `charset`, `trim_trailing_whitespace`, indent per extension, `switch_case_indent` for shell |
| `.gspot/prettier.json` | `.prettierrc.json` (the whole document is the path) | `tabWidth`, `printWidth`, `singleQuote`, `trailingComma`, `semi`, `arrowParens: always`, `embeddedLanguageFormatting: off` |
| `.gspot/prettierignore` | `.prettierignore` managed block | by nature: generated, vendored, binary, lockfiles |
| shfmt flags | in the bash check command | `-i <width> -ci -s` |
| ruff format section | in `.gspot/ruff.toml` | `indent-width`, `quote-style`, `line-ending` |
| markdownlint MD007 | in `.gspot/markdownlint.jsonc` | `indent` |
| SwiftFormat `--indent`, `--maxwidth` | in `.gspot/swiftformat` | |
| taplo, yamllint indent | in their configs | |

## Checks

| Id | Stage | Command |
| --- | --- | --- |
| `formatting/prettier` | commit | `prettier --check --config .gspot/prettier.json {files}`; fix `--write`, order format |
| `formatting/editorconfig-checker` | commit | `editorconfig-checker {files}` |

## Tools

prettier, editorconfig-checker.

## Rule files

None. Formatting decisions are the tools' and are not restated in prose.
