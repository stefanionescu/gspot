# gspot Architecture

This folder is the specification for gspot. Implementation follows it. When code and this folder
disagree, fix one of them in the same change.

## What gspot is

gspot is one binary a developer runs once in any repository. It reads the repository, proposes a
policy, and on a yes it:

1. Writes configuration for the standard linters, formatters, type checkers, and scanners that
   match the languages and frameworks in the repository.
2. Adds the rules those tools lack: structural limits, banned names, slop patterns, drift
   detection, and prose rules for comments and documentation.
3. Installs instruction files for AI agents (`CLAUDE.md`, `AGENTS.md`, a rules directory) that
   match the same selection.

Every repository on the same gspot version runs the same rules. Upgrading gspot upgrades all three.

## Reading order

| File                                                 | Decides                                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01-product.md](01-product.md)                       | Who gspot is for, what it promises, what it refuses to do                                                                                         |
| [02-cli.md](02-cli.md)                               | Every command, flag, output line, and exit code                                                                                                   |
| [03-configuration.md](03-configuration.md)           | The one file a person edits, and the files gspot owns                                                                                             |
| [04-presets.md](04-presets.md)                       | The unit of selection: manifest format, detection, catalog                                                                                        |
| [05-engines.md](05-engines.md)                       | The six things that produce findings                                                                                                              |
| [06-enforcement-ledger.md](06-enforcement-ledger.md) | Every rule and check carried from the reference repositories, and where it lands                                                                  |
| [07-slop-drift.md](07-slop-drift.md)                 | New enforcement: what LLM slop and repository drift look like and how gspot catches them                                                          |
| [08-naming-policy.md](08-naming-policy.md)           | The banned-term and case policy, its schema, and its matching rules                                                                               |
| [09-rules.md](09-rules.md)                           | The agent rule files: layers, assembly, repair, enforcement links                                                                                 |
| [10-hooks-ci-runners.md](10-hooks-ci-runners.md)     | Git hooks, staged mode, task runners, the CI workflow                                                                                             |
| [11-toolchain.md](11-toolchain.md)                   | How gspot itself is installed and pinned per repository; how each tool is obtained, pinned, verified, and upgraded                                |
| [12-repository-layout.md](12-repository-layout.md)   | gspot's own repository, packages, tests and self-lint                                                                                             |
| [13-roadmap.md](13-roadmap.md)                       | Phases, the v1 cut, acceptance per phase                                                                                                          |
| [14-decisions.md](14-decisions.md)                   | The decision log with the rejected alternative for each                                                                                           |
| [15-prior-art.md](15-prior-art.md)                   | What gspot copies from tools people already use, and which libraries it reuses instead of writing its own                                         |
| [16-file-tree.md](16-file-tree.md)                   | Every folder and file in gspot's repository, and what each holds                                                                                  |
| [17-migration.md](17-migration.md)                   | The two goals; what `init` replaces, carries, deletes and leaves in a repository that has its own linting, with yap-swift-app worked file by file |
| [presets/README.md](presets/README.md)               | One page per preset                                                                                                                               |

Read 01 to 05 to understand the tool. Read 06 to 09 to understand the rules. Read 10 to 17 to
build it.

## Glossary

One word, one meaning, everywhere in this folder, and in the code.

| Term                | Meaning                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| preset              | A named bundle of tools, configuration, checks, settings and rule files for one language, framework, platform, tool, library, database, or repository concern. The unit a person selects.                         |
| check               | One command or one built-in analysis that produces findings over a set of files. The unit that runs and the unit a person turns off.                                                                              |
| finding             | One location and one message from one check.                                                                                                                                                                      |
| engine              | Code inside gspot that produces findings without an external tool, or that drives one.                                                                                                                            |
| policy              | The repository's selection and settings, held in `gspot.toml`.                                                                                                                                                    |
| baseline            | A recorded finding count per rule that `check` compares against. It falls and never rises.                                                                                                                        |
| ignore              | An entry in `gspot.toml` that turns a check off for named paths, with a reason.                                                                                                                                   |
| scope               | A subtree of the repository with its own preset selection.                                                                                                                                                        |
| stage               | When a check runs: `commit`, `push` or `manual`.                                                                                                                                                                  |
| rule file           | A Markdown file an agent reads before editing.                                                                                                                                                                    |
| layer               | The level a rule file belongs to: general, language, framework, library, tool, platform, database, project.                                                                                                       |
| generated file      | A file gspot writes and rewrites. It carries a header saying so and a person never edits it.                                                                                                                      |
| file set            | The files git tracks or would track (`git ls-files --cached --others --exclude-standard`), minus what natures, and ignores remove. Every check receives a list drawn from it.                                     |
| owned tool          | A tool whose configuration gspot writes.                                                                                                                                                                          |
| drift               | A difference between two things that are meant to agree: a generated file and its render, a lockfile and its manifest, a document, and the tree it describes.                                                     |
| private declaration | A declaration a file keeps to itself: a `_` name in Python or Bash, a non-exported declaration in TypeScript or JavaScript, a `private` or `fileprivate` one in Swift. Private declarations come first in a file. |
| install policy      | The package manager's own supply-chain settings: minimum release age, security scanner, lockfile agreement.                                                                                                       |
| project template    | A rule file gspot copies into the project layer once and never upgrades.                                                                                                                                          |
| slop                | Code, names or prose that add nothing: wrappers, hedges, marketing words, defensive guards for impossible states, restated comments.                                                                              |
| version pin         | The gspot version a repository runs, in `.gspot/version` and the runner surface. A binary of another version refuses to check or apply.                                                                           |
| takeover            | What `init` does to a tool's existing configuration: deletes it, writes gspot's, carries the exception lists.                                                                                                     |

## How this folder is maintained

- Every document opens with what it decides.
- Sentences are short and active. The text describes the present design, not its history.
- A number that summarizes a list lives beside the list, or not at all.
- No document links to a file that does not exist. A link check runs over this folder in the gate of this repository.
- Paths from the reference repositories appear only in the source column of the ledger.
