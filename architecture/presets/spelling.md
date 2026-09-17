# spelling

Kind: repository. Selected by default. Required by every language preset.

## Claims

Every text file. Binaries, lockfiles, generated files and vendored files are excluded by nature.

## Tools

typos.

## Generated configuration

`.gspot/typos.toml` with a `typos.toml` stub: `[files] extend-exclude` from natures and
`[tools.typos] exclude`; `[default.extend-words]` from `[tools.typos] words`, each with its
reason as a comment.

## Checks

| Id | Stage | Command |
| --- | --- | --- |
| `spelling/typos` | commit | `typos --config .gspot/typos.toml {files}`; fix `--write-changes`, order format |

## Settings

`tools.typos.words` (word, reason), `tools.typos.exclude` (paths, reason), `tools.typos.locale`
(default `en-us`, matching the prose engine's US English rule).

## Rule files

None.
