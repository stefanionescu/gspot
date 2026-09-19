# `duplication`

Kind: concern. Requires: nothing. Copy-paste detection across every language.

## Tools

jscpd.

## Generated configuration

`.gspot/jscpd.json`: `mode: strict`, `minLines` 8, `minTokens` 40, `threshold` 4 percent,
formats from the selected languages, ignore by nature, reporters `console` and `json`.

## Checks

| Id                  | Stage | Command                                                        |
| ------------------- | ----- | -------------------------------------------------------------- |
| `duplication/jscpd` | push  | `jscpd --config .gspot/jscpd.json {files}` per language format |

Function-level duplicates are caught earlier by `sonarjs/no-identical-functions` and
`structure/duplicate-functions`; jscpd catches the rest.

## Settings

`limits.duplication.min_lines`, `min_tokens`, `threshold_percent`; `tools.jscpd.ignore` (paths, reason).

## Rule files

`general/agent/WORKING.md` (the duplication section).
