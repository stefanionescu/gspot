# `prose`

Kind: concern. Requires: markdown. Runs Vale over every comment and every documentation file.

## Claims

Comments in `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.swift` (Vale native); `.sh`, `.bash`, hook
and task files (stdin as `.rb`); `.sql`, `.pgsql`, `.psql` (stdin as `.lua`); `.py` (stdin as
`.rb`, heredoc lines excluded by gspot); every `.md`.

## Tools

vale, with the pinned packages: Google, Microsoft, write-good, proselint, alex, RedHat, Harper.

## Generated configuration

| Target                                                    | Holds                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/vale.ini`                                         | `StylesPath`, `MinAlertLevel = suggestion`, the packages, `BasedOnStyles`, `SkippedScopes` with tables added, `BlockIgnores` for front matter, `TokenIgnores` for URLs, tool directives (`eslint-disable`, `@ts-expect-error`, `swiftlint:`, `shellcheck`, `nosemgrep`, `MARK: -`, JSDoc tags), spelling rules off (typos owns spelling), the disabled-rule list with its reasons in comments                                   |
| `.gspot/vale/styles/gspot/*.yml`                          | the 30 rules: `dashes`, `present-state`, `modals`, `hedging`, `marketing`, `idioms`, `since`, `self-reference`, `file-paths`, `locations`, `defaults`, `future`, `version-range`, `interface-verbs`, `us-english`, `possessives`, `headings`, `title`, `heading-names`, `sentence-length`, `step-length`, `paragraph-length`, `acronyms`, `link-text`, `alt-text`, `placeholders`, `dates`, `currency`, `symbols`, `corruption` |
| `.gspot/vale/styles/config/vocabularies/gspot/accept.txt` | the tool and product names from `[prose] vocabulary`                                                                                                                                                                                                                                                                                                                                                                            |

Style packages are fetched by `vale apply` at setup into an ignored directory. Only the gspot
style and vocabulary are tracked.

## Checks

| Id                  | Stage  | Command                                                                                                                                                                                                                                                   |
| ------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prose/vale`        | commit | `vale --config .gspot/vale.ini --output=line --no-exit {files}` per grammar; any alert fails                                                                                                                                                              |
| `prose/source-bans` | commit | no `<!-- vale` directive in Markdown; no `/* */` in SQL                                                                                                                                                                                                   |
| `prose/messages`    | commit | the three ESLint selectors: error messages start uppercase, client messages (a `message` or `error` field in an object passed to `.json()` or `.send()`) carry no interpolated identifiers, log calls use a stable message; Ruff `EM101`, `EM102`, `G004` |
| `prose/doc-tags`    | commit | `jsdoc/no-types`; SwiftLint custom rule `///` over `/** */`                                                                                                                                                                                               |

## Settings

`prose.vocabulary` (accept list) and `limits.docs.*`. A Vale rule is turned off through `gspot ignore prose/vale --rule <id>`, as every rule is.

## Rule files

`general/prose/WRITING.md`, `general/code/COMMENTS.md`, `general/prose/DOCS.md` and its five siblings.

## Rollout

The prose checks read the files a change touches, so a repository with a backlog of old text is
not blocked by it (D-165).
disabled upstream rules and the reason for each is in the template.
