# Product

This document decides who gspot serves, what it promises, and what it refuses to do.

## The problem

Code written with AI agents accumulates a specific kind of junk. Functions forward their arguments, files only re-export, folders hold one file, and names read like `enhancedHandler` and `ensureConfigIfNeeded`. Guards cover states that cannot occur, comments narrate history, and tests assert nothing. Standard linters do not catch it, because none of it is a bug.

Teams that notice this write their own checks. Each repository grows a folder of scripts that
differs from the last one, gets a different bug, and is maintained by nobody. The same rule is
implemented four times in four repositories and drifts in each.

## The product

gspot is the shared house style for AI-written code, delivered as one binary:

- **Configured linters.** gspot writes the configuration for the tools the repository already
  needs (ESLint, Prettier, Ruff, SwiftLint, ShellCheck, sqlfluff and the rest) at full strictness. It runs them over an explicit file list.
- **The missing rules.** gspot ships the structural, naming, prose, security, and drift checks
  the standard tools lack, as one engine per concern, versioned with the rest.
- **Agent instructions.** gspot installs rule files that tell an agent how to write code in this
  repository, selected by what the repository uses.

The three arrive together, pinned to one version, in every repository that runs gspot.

## Who it is for

The primary user is a developer who did not write gspot and does not read this folder. They may
not read code at all: they describe what they want to an AI agent and check the result. They
run `gspot init` in a repository nobody at gspot has seen, answer the questions it asks (or pass
`--yes`), and get a working gate. They change one line to adjust it. They run `gspot upgrade` and
read a short diff.

The secondary user is an AI agent working in that repository. It reads the installed rule files
and gets findings from the hooks with a message it can act on.

## Promises

1. **One command installs it.** `gspot init --yes` produces a passing gate in any repository gspot
   has a preset for, on the day it runs, through a baseline of existing findings.
2. **One file configures it.** `gspot.toml` holds every decision, and every decision has a
   one-line command that writes it. Nothing else is edited by hand.
3. **Nothing is silent.** Every ignore carries a reason and prints on every run. Every skipped
   check prints. Every baseline prints its count. A tool that cannot run fails the checks that need it.
4. **Nothing is hidden in a tool's own ignore file.** gspot hands every tool an explicit file
   list. A file is either checked or listed as unchecked in `doctor`.
5. **Upgrades are reviewable.** Generated configuration is tracked, so an upgrade is a diff a
   reviewer reads.
6. **Rules and enforcement stay in step.** Every rule statement in the agent files names the
   check that enforces it, or says it is unenforced. The unenforced count is reported.
7. **The tool obeys its own rules.** The gspot repository runs gspot at full strictness with no
   ignores.

## The developer's day

- Save a file. The editor shows ESLint, Ruff or SwiftLint findings, including the gspot structural rules for JavaScript and TypeScript, because gspot wrote the configuration those editors read.
- Commit. The pre-commit hook runs `gspot check --staged`: the fast checks over staged files
  only. It takes seconds.
- Push. The pre-push hook runs `gspot check`: everything, including build, container and
  network checks.
- See a finding. The output names the file, line, rule and message, and prints the command that
  reproduces that one check alone.
- Disagree with a finding. `gspot ignore <check> --paths <glob> --reason "..."`, or
  `gspot set limits.function_lines 80 --reason "..."`, or `gspot allow typos <word>`. Each writes
  one entry to `gspot.toml`, and each prints on every run.
- Add a language. `gspot add python`, or `gspot doctor` to see what appeared after the install
  and the command that adds it. New findings enter a baseline.
- Wonder what a finding means. `gspot explain <check>` says what the check looks for, what goes
  wrong without it, and what to do, in plain words.
- Upgrade. Run `gspot upgrade`. Read the plan: new rules, changed limits, tool bumps, rule file
  changes, coverage change, templates changed upstream. Say yes. Commit the diff. Nothing you wrote
  is touched.

## Principles

- **Everything is an error.** No warning level. Adoption uses a baseline that falls and never
  rises.
- **A maintained tool wins.** gspot writes original analysis only where no maintained tool
  expresses the rule, and the preset names the tools it searched.
- **Detect, never assume.** gspot learns the repository from its tracked files and manifests.
  It never assumes a directory layout.
- **Do not report what nobody can fix.** Generated, vendored, and binary files get the checks
  that apply to them and nothing else.
- **Easy to change, impossible to hide.** One TOML line changes a limit or adds a term. The line
  carries a reason and prints every run.
- **The tool owns a job or leaves it alone.** When gspot owns a linter, no second configuration
  for that linter exists in the repository.
- **Take over, list, never guess.** At `init`, gspot replaces the configuration of every tool it has a preset for and carries the repository's exception lists. Everything else it found (other tools, hand-written hooks, home-grown lint folders) is listed and left alone.
- **Written for someone who does not code.** Every message, help text, check summary, and page
  says what happened and what to do next, in plain words, and names the command that does it.
  The prose of gspot itself runs through its own prose engine.

## Non-goals

- gspot is not a language server. Editors work because gspot writes real configuration at
  conventional paths.
- gspot is not a package manager. It pins tool versions and tells the ecosystem's own manager
  what to install. It downloads nothing.
- gspot is not a CI system. It writes one workflow file on request.
- gspot does not run tests, build, or deploy. It runs checks.
- gspot does not manage product configuration. A check that needs a product fact reads the
  product's file.
- gspot does not host every linter for every language. It covers the languages in
  [presets/README.md](presets/README.md) completely and adds one when a repository needs it.
