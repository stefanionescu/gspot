# `markdown`

Kind: language. Requires: docs, formatting, spelling.

## Detects and claims

|                      |                                       |
| -------------------- | ------------------------------------- |
| Detect               | `.md`, `.mdx` in the tree             |
| Claims               | `.md`, `.mdx`                         |
| Required inspections | format, style, links, prose, spelling |

## Tools

markdownlint-cli2, prettier, lychee.

## Generated configuration

| Target                      | Stub                                                                     | Holds                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.gspot/markdownlint.jsonc` | `.markdownlint-cli2.jsonc` with `config.extends` and `globs` from claims | `default: true`; MD007 indent from `[format] indent_width`; MD013 off; MD024 siblings only; MD033 off; MD041 on; MD046 fenced; MD048 backtick; MD049 underscore; MD050 asterisk; MD060 off |
| `.gspot/lychee.toml`        | none                                                                     | through docs: `offline`, `include_fragments`; an online profile for the manual run                                                                                                         |

## Checks

| Id                        | Stage  | Command                                                                                                                                                            |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `markdown/markdownlint`   | commit | `markdownlint-cli2 --config .gspot/markdownlint.jsonc {files}`; fix, order format                                                                                  |
| `markdown/prettier`       | commit | through formatting                                                                                                                                                 |
| `docs/links`              | commit | lychee offline with fragments, through docs                                                                                                                        |
| `integrity/docs-headings` | commit | banned headings absent                                                                                                                                             |
| `markdown/fences`         | commit | every fenced block with a language tag parses; TypeScript, Python, Bash, SQL, TOML, JSON and YAML fences are extracted and handed to their language's syntax check |
| `prose/vale`              | commit | through prose                                                                                                                                                      |

## Settings

`tools.markdownlint.rules` (per-rule options; off is a `gspot ignore --rule`), `tools.lychee.exclude` (reason).

## Rule files

`general/prose/DOCS.md` and its siblings (installed by docs), `general/prose/WRITING.md`.
