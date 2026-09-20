# `security`

Kind: concern. Requires: nothing. Static analysis for security patterns, per language. One SAST tool.

## Claims

Every file a language preset claims.

## Tools

semgrep (or opengrep; same rule format), codeql.

Bearer is not used: Semgrep hosts the repository's own rules and the vendored packs in one
format, and the reference repositories used none of Bearer's data-flow classification. Bearer
ignore entries carried at init become Semgrep rule ignores.

## Generated configuration

| Target                         | Holds                                                                                                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/semgrep/`              | one pack per selected preset (D-94): `node.yml` (9 rules) and `secrets.yml` (1) from this preset; `express.yml`, `supabase.yml` and `swift.yml` from theirs; `[tools.semgrep] rules` adds repository files |
| `.semgrepignore`               | build output, dependencies, lockfiles, and the paths in `tools.semgrep.ignore`                                                                                                                             |
| `.gspot/codeql/<language>.yml` | query suites per language; false positives with reasons and paths that exist                                                                                                                               |

## Checks

| Id                          | Stage  | Command                                                                                         |
| --------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| `security/semgrep`          | push   | `semgrep scan --config .gspot/semgrep --error --metrics off --vim {files}`                      |
| `security/semgrep-registry` | manual | the registry packs of `tools.semgrep.registry`; needs the network                               |
| `security/codeql`           | manual | database create per language, analyze with the suite, SARIF filtered by the false-positive list |
| `integrity/suppressions`    | commit | `nosemgrep` carries a reason; the census does not grow                                          |

Semgrep ran in none of the reference repositories despite forty rules and a pinned binary. Here
it is a `push` check from day one.

## Settings

`tools.semgrep.rules`, `tools.semgrep.registry`, `tools.semgrep.ignore` (paths; a rule turned off is `gspot ignore security/semgrep --rule <rule>`), `tools.codeql.languages`,
`tools.codeql.suite`, `tools.codeql.false_positives` (rule, path, reason).

## Rule files

`general/code/SECURITY.md`, `general/code/SECRETS.md`; the security sections of each framework file.
