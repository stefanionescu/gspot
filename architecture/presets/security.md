# `security`

Kind: concern. Static analysis for security patterns, per language. One SAST tool.

## Claims

Every file a language preset claims.

## Tools

semgrep (or opengrep; same rule format), codeql.

Bearer is not used: Semgrep hosts the repository's own rules and the vendored packs in one
format, and the reference repositories used none of Bearer's data-flow classification. Bearer
ignore entries carried at init become Semgrep rule ignores.

## Generated configuration

| Target                         | Holds                                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/semgrep/`              | the preset rule packs: api (15 rules), supabase (10), ios (14), landing and workers (10), hooks (2), python (6), secrets (1); the vendored upstream sets (OWASP top ten, python, bash, secrets) pinned by version; `[tools.semgrep] rules` adds repository files. The vendored bandit set is not shipped: Ruff `S` is the port. |
| `.gspot/codeql/<language>.yml` | query suites per language; false positives with reasons and paths that exist                                                                                                                                                                                                                                                    |

## Checks

| Id                       | Stage  | Command                                                                                         |
| ------------------------ | ------ | ----------------------------------------------------------------------------------------------- |
| `security/semgrep`       | push   | `semgrep scan --config .gspot/semgrep --error --metrics off {files}`                            |
| `security/codeql`        | manual | database create per language, analyze with the suite, SARIF filtered by the false-positive list |
| `integrity/suppressions` | commit | `nosemgrep` carries a reason; the census does not grow                                          |

Semgrep ran in none of the reference repositories despite forty rules and a pinned binary. Here
it is a `push` check from day one.

## Settings

`tools.semgrep.rules` (paths; a rule turned off is `gspot ignore security/semgrep --rule <id>`), `tools.codeql.languages`,
`tools.codeql.suite`, `tools.codeql.false_positives` (rule, path, reason).

## Rule files

`general/code/SECURITY.md`, `general/code/SECRETS.md`; the security sections of each framework file.
