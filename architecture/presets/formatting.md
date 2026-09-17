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

Defaults are the values three of four reference repositories share. They are the one policy
`init` does not impose: when an existing formatter configuration (Prettier, `.editorconfig`,
Ruff format, SwiftFormat) differs from them, `init` asks whether to keep the repository's values
or take the shipped ones, and `--yes` keeps them (D-58). Either answer is written to `[format]`
and is one `gspot set format.indent_width 4` away from the other. The reason is stated once:
formatting has no strictest value, and reformatting every file is the most disruptive thing
`init` could do unasked.

## Generated configuration

| Target | Stub | Derived |
| --- | --- | --- |
| `.editorconfig` | none; gspot owns the whole file at its conventional path, with the header | `end_of_line`, `insert_final_newline`, `charset`, `trim_trailing_whitespace`, indent per extension, `switch_case_indent` for shell; `[tools.editorconfig.extra]` for a section gspot does not render |
| `.gspot/prettier.json` | `.prettierrc.json` (the whole document is the path) | `tabWidth`, `printWidth`, `singleQuote`, `trailingComma`, `semi`, `arrowParens: always`, `embeddedLanguageFormatting: off` |
| `.prettierignore` | none; gspot owns the whole file at the root, with the header, for editors (the gate passes file lists) | by nature: generated, vendored, binary, lockfiles |
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
