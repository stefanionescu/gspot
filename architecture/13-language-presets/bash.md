# `language:bash`

The language with the widest gap between "linted" and "covered" in the reference set: 204 shell
files, of which 129 get ShellCheck and shfmt but not the project rules, because the rule table knows
only three project prefixes.

## Claims

```text
.sh .bash .bats
extensionless tracked files whose first line is a bash or sh shebang
.mise/tasks/**            (task files, usually extensionless)
.githooks/**              (hook files, usually extensionless)
```

The extensionless case is the whole problem. `yap-swift-app` has 104 mise task files and 3 hook
files with no extension, and `slopshop` and `yap-text-inference` have 28 and 35. A preset that claims
only `.sh` misses 140 files in one repository.

Detection is by shebang, read from the first line of every tracked text file that has no extension,
plus the two conventional directories. A tracked extensionless file with no recognised shebang and
no executable bit fails the coverage as unchecked, which is correct: a file like that needs a human
decision.

## Tools

| Kind        | Tool                                          | Notes                                                                                                    |
| ----------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| format            | `shfmt`                                       | Flags derived from `[format]`: indent width, `switch_case_indent`, binary operators at line start        |
| syntax            | `bash -n`                                     | Cheap, catches what ShellCheck's parser recovers from                                                    |
| style             | `shellcheck`                                  | `enable=all`, `severity=style`, `external-sources=true`, `source-path=SCRIPTDIR`                         |
| structure, naming | gspot structure engine, ast-grep Bash grammar | Doc comments, function length, file length, unused functions, duplicate functions, disable justification |
| prose             | Vale through stdin as `.rb`                   | Full-line and trailing comments                                                                          |
| spelling          | `typos`                                       |                                                                                                          |
| secrets           | gitleaks, trufflehog                          |                                                                                                          |
| sast              | `semgrep` with the Bash rule set              |                                                                                                          |

### ShellCheck configuration

From the reference `.shellcheckrc`, which is the strictest of the three:

```text
shell=bash
source-path=SCRIPTDIR
external-sources=true
enable=all
disable=SC1090,SC1091,SC2029,SC2154,SC2310,SC2312
```

Each disable is justified in the generated file, and each is a loosening entry the preset declares
rather than the consumer:

| Code           | Why the preset disables it                                                                      |
| -------------- | --------------------------------------------------------------------------------------------- |
| SC1090, SC1091 | Non-constant and unfollowable source paths, unavoidable with `source-path=SCRIPTDIR` dispatch |
| SC2029         | Remote command expansion, deliberate in deploy scripts                                        |
| SC2154         | Variables assigned by a sourced config file                                                   |
| SC2310, SC2312 | `set -e` interaction warnings that fire on every correct `if function; then`                  |

A consumer re-enabling any of them is tightening, and needs no metadata.

## Required kinds

```text
.sh .bash                  format syntax style structure naming prose spelling
extensionless with shebang format syntax style structure naming prose spelling
.bats                      format syntax style spelling
```

Identical for `.sh` and for extensionless task files. That identity is the fix for the fourth blind
spot: `SHELL_PROJECT_RULES` in the reference repository maps three project prefixes to their script
directories, so the 129 files outside those prefixes get two checks instead of six. There is no
prefix table in gspot. Scope decides which preset applies; the preset applies the same required kinds
everywhere.

## Structure rules for shell

The shell-specific parameters, from the reference set:

| Rule                    | Value                                                                                                                    | Source                                                                                                                  | Mechanism                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `file-length`           | 140 lines                                                                                                                | `yap-swift-app` and `yap-text-inference` agree; `yap-landing` says 180 and loses                                        | counter                          |
| `function-length`       | 40 lines                                                                                                                 | `yap-text-inference`, which already passes at 40 against 100 in the other two                                           | counter                          |
| `function-branches`     | 8                                                                                                                        | `yap-text-inference/quality/config/shell.py`                                                                            | ast-grep plus counter            |
| `function-nesting`      | 3                                                                                                                        | same                                                                                                                    | ast-grep plus counter            |
| `mutable-assignments`   | 8 per function                                                                                                           | same. Caps reassignments to one variable inside a function, which matters in a language with no local scope by default. | ast-grep plus counter            |
| `doc-comment-required`  | Every function carries `# name: Description.` plus the Globals, Arguments, Outputs and Returns sections where they apply | `rules/BASH.md`, 181 existing headers                                                                                   | ast-grep `precedes`              |
| `unused-functions`      | Cross-file reachability from task files and hooks as entry points                                                        |                                                                                                                         | original code, roughly 200 lines |
| `duplicate-functions`   | 3 identical bodies                                                                                                       | `IDENTICAL_FUNCTIONS_THRESHOLD`                                                                                         | `jscpd`                          |
| `disable-justification` | Every `# shellcheck disable=SCxxxx` carries `reason:` and `owner:`                                                       | 24 existing disables                                                                                                    | ast-grep regex                   |
| `strict-mode` | Every script sets `set -euo pipefail` before its first command. ShellCheck does not require it. | `comfyui-reactor-connector/quality/shell/checks/safety.py` | ast-grep |
| `no-eval` | No `eval`, and no `bash -c` or `sh -c` over a string built from a variable | same | ast-grep |
| `guarded-removal` | `rm -rf` and `rm -r` take a quoted path that is not a bare variable, `/`, `~` or `.` | same | ast-grep |
| `inline-code-extracted` | A `python -c`, `node -e` or `bun -e` argument is extracted and linted by the owning language preset, like a heredoc | `comfyui-reactor-connector/quality/shell/checks/embeds.py` | preset extraction |
| `executable-bit`        | Every file with a shebang is executable, and every executable has a shebang                                              | MegaLinter's `bash_exec` linter                                                                                         | `bash-exec`                      |

### Bash complexity is not a gap

`yap-text-inference/quality/shell/checks/complexity.py` measures branches and nesting,
`quality/config/shell.py` sets both thresholds plus a mutable-assignment cap, and all three run in
that repository's gate today.

They reproduce as three ast-grep rules plus the finding counter, which is a rule file and a shared counter
rather than original code. One reference repository solved this, and the solution generalises.

### The doc comment separator

The reference documentation rules ban em dashes and spaced hyphens, while 181 shell function headers
use `# name - Description.` and the regex that validates them accepts an em dash. The preset emits and
validates the colon form, `# name: Description.`, which satisfies both rules. `gspot fix` performs
the one-time migration.

## Totality

| Habit                                     | Reference evidence                                                                                                    | gspot                                                                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task and hook files are tooling, not code | 129 files with two checks instead of six                                                                              | One required kinds, no prefix table                                                                                                                                                      |
| The lint package's own shell is exempt    | `quality/security/codeql/scan.sh` is 150 lines against a limit of 140, and `main` in the Trivy runner is undocumented | Self-hosting: the distribution's shell obeys the same rules                                                                                                                       |
| Sourced config files are unlinted         | `api/scripts/config.sh` read by a lint runner                                                                         | Claimed as shell                                                                                                                                                                  |
| Heredoc contents are invisible            |                                                                                                                       | `structure`'s heredoc check, ported from `yap-text-inference/quality/shell/checks/heredocs.py`: an embedded SQL or Python heredoc is extracted and linted by that language's preset |

The heredoc row is the one genuinely new coverage idea. A shell script with an embedded SQL heredoc
contains SQL that no SQL linter sees. The Bash adapter extracts heredoc bodies with a declared
language tag and hands them to the owning preset through stdin, exactly as Vale handles borrowed
grammars.
