# Product

This document decides who gspot serves, what it promises, and what it refuses to do.

## The problem

Code written with AI agents accumulates a specific kind of junk. Functions forward their arguments, files only re-export, folders hold one file, and names read like `enhancedHandler` and `ensureConfigIfNeeded`. Guards cover states that cannot occur, comments narrate history, and tests assert nothing. Some patterns require checks beyond standard linters. Some indicate defects; others express the optional house style.

Teams that notice this write their own checks. Each repository grows a folder of scripts that
differs from the last one, gets a different bug, and is maintained by nobody. The same rule is
implemented four times in four repositories and drifts in each.

## The product

gspot is the shared house style for AI-written code, delivered as one binary:

- **Configured linters.** gspot writes the configuration for the tools the repository needs,
  such as ESLint, Prettier, Ruff, SwiftLint, ShellCheck, and sqlfluff. It runs file-list tools over an
  explicit file list and whole-project tools over affected projects.
- **Two levels.** At `recommended` a tool runs its recommended set and the rules that find a
  defect. The level `all` adds the house style.
- **The missing rules.** gspot ships the structural, naming, prose, security, and drift checks
  the standard tools lack, as one engine per concern, versioned with the rest.
- **Agent instructions.** gspot installs rule files that tell an agent how to write code in this
  repository, selected by what the repository uses.

These arrive together, pinned to one version, in every repository that runs gspot.

## Who it is for

The primary user is a developer who did not write gspot and does not read this folder. They may
not read code at all: they describe what they want to an AI agent and check the result. They
run `gspot init` in a repository nobody at gspot has seen, answer the questions it asks (or pass
`--yes`), and get a working gate. They change one line to adjust it. They run `gspot upgrade` and
read a short diff.

The secondary user is an AI agent working in that repository. It reads the installed rule files
and gets findings from the hooks with a message it can act on.

## Promises

Each promise names the test that holds it. A promise with no test is a row of
[18-gaps.md](18-gaps.md).

| Promise                                                  | What it means                                                                                                                                                     | Held by                                                                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| One command installs it                                  | `gspot init --yes` detects, writes the config, and installs the tools. It runs no check, and the developer decides when to lint (D-165)                           | the six planted installs, and one generated project for each generator    |
| Initialization preserves application build configuration | gspot edits no `tsconfig.json`, no `package.json` beyond its launcher and explicitly accepted lint-task entries, and no `pyproject.toml` (D-126, D-145)           | the planted installs compare every file of the developer before and after |
| gspot deletes only what it owns                          | takeover saves originals; lifecycle deletion requires confinement and unchanged owned content; unowned or edited files survive, and no check writes into the tree | the takeover cases, and the planted cases for untracked files             |
| One file configures it                                   | `gspot.toml` holds repository choices; CLI edits cover supported settings and complex entries can be edited directly                                              | the completion test and the settings test over the manifests              |
| Nothing is silent                                        | an ignore prints with `--verbose`; a reason is required only with `require_reasons`, a skipped check prints why, and a check whose tool is absent fails           | the failing case of every check, and the report shape test                |
| Nothing is hidden in the ignore file of a tool           | gspot hands every tool a file list, and `doctor` names a file or a kind of file no check reads                                                                    | the coverage tests of `doctor`                                            |
| An upgrade is a diff                                     | generated configuration is tracked, and `upgrade --dry-run` lists every rule that changes, for every tool                                                         | the upgrade test repository                                               |
| The rules an agent reads match the checks                | a rule file follows the level, names no tool of another preset, and its good examples pass their linter                                                           | the rules lint                                                            |
| gspot obeys its own rules                                | this repository runs gspot at the level `all` with no `[[ignore]]` entry                                                                                          | the gate of this repository, green on GitHub                              |

## The developer's day

- Save a file. The editor shows Ruff and SwiftLint findings through a root pointer, and ESLint
  findings once its extension points at `.gspot/`, which the guide on editors shows.
- Commit. The pre-commit hook runs `gspot check --staged`: the fast checks over staged files
  only. It takes seconds.
- Push. The pre-push hook checks the commits being pushed: the committed files that changed, and all findings from the
  whole-project checks of the projects they affect. `gspot check` runs commit and push checks; CI follows its configured scope and stage.
- See a finding. The output names the file, line, rule and message, and prints the command that
  reproduces that one check alone.
- Disagree with a finding. `gspot ignore <check> --paths <glob> --reason "..."`, or
  `gspot set limits.function_lines 80 --reason "..."`, or `gspot set tools.typos.words <word>`. Each writes
  one entry to `gspot.toml`, and each is reported with `--verbose`.
- Add a language. `gspot add python`, or `gspot doctor` to see what appeared after the install
  and the command that adds it. The new checks are on from the next run.
- Wonder what a finding means. `gspot explain <check>` says what the check looks for, what goes
  wrong without it, and what to do, in plain words.
- Upgrade. Run `gspot upgrade`. Read the plan: new rules for every tool, tool pins, and rule
  file changes. Say yes. Commit the diff. Nothing you wrote is touched.

## Principles

- **Everything is an error.** No warning level. Two levels decide what runs: `recommended`
  holds what finds a defect, and `all` adds the house style. An old repository adopts gspot by checking the
  files a change touches, and gspot records no old findings.
- **A maintained tool wins.** gspot writes original analysis only where no maintained tool
  expresses the rule, and the preset names the tools it searched.
- **Detect, never assume.** gspot learns the repository from its tracked files and manifests.
  It never assumes a directory layout.
- **Do not report what nobody can fix.** Generated, vendored, and binary files get the checks
  that apply to them and nothing else.
- **Easy to change, impossible to hide.** One TOML line changes a limit or adds a term. Reasons follow `require_reasons`, and the entry prints with `--verbose`.
- **gspot brings its own tools and touches none of yours.** Its lint tools install under
  `.gspot/`. The linters of the developer, their configs, and their plugins stay until the
  developer removes them.
- **Take over what one tool owns, and list the rest.** At `init`, gspot deletes a config file
  only when one tool owns it. A shared file is read and left in place.
- **Carry both ways.** gspot carries what was turned off and what was turned on, and lists every
  setting it did not carry.
- **Written for someone who does not code.** Every message, help text, check summary, and page
  says what happened and what to do next, in plain words, and names the command that does it.
  The prose of gspot itself runs through its own prose engine.

## Non-goals

- gspot is not a language server. Editors work through a root pointer, where a tool has an
  include form, and through the guide on editors elsewhere.
- gspot is not a package manager. It pins tool versions and runs the install of mise and of the
  package manager the repository uses.
- gspot is not a CI system. It writes one job, for GitHub or GitLab, on request.
- gspot runs tests and builds only through declared checks at the manual stage. It does not deploy applications.
- gspot does not manage product configuration. A check that needs a product fact reads the
  product's file.
- gspot does not host every linter for every language. It covers the languages in
  [presets/README.md](presets/README.md) completely and adds one when a repository needs it.
