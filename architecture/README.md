# gspot Architecture

The [active CI bypass](22-remaining.md#active-ci-bypass) governs all implementation work.
Skip CI on every commit and push until the user explicitly re-enables it.

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

The [repository accounting](23-repository-audit.md) distinguishes current implementation,
open requirements, historical completion claims, and deferred verification.

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
| [16-file-tree.md](16-file-tree.md)                   | Repository ownership and the boundaries that justify moves                                                                                        |
| [17-migration.md](17-migration.md)                   | The two goals; what `init` replaces, carries, deletes and leaves in a repository that has its own linting, with yap-swift-app worked file by file |
| [18-gaps.md](18-gaps.md)                             | Where the repository differs from this folder, with evidence, and the order in which the gaps close                                               |
| [19-names.md](19-names.md)                           | The names that change, and the one meaning each word keeps                                                                                        |
| [20-adoption.md](20-adoption.md)                     | What the install in yap-swift-app showed, and the design that answers each defect                                                                 |
| [21-documentation.md](21-documentation.md)           | What the README, the manual, and the site at gspot.dev hold, and what must be true before launch                                                  |
| [22-remaining.md](22-remaining.md)                   | Everything that is left, in order, with the linters and the custom rules of every language, and what happens to the ESLint of the developer       |
| [presets/README.md](presets/README.md)               | One page per preset                                                                                                                               |

Read 01 to 05 to understand the tool. Read 06 to 09 to understand the rules. Read 10 to 19 to
build it.

## Glossary

One word, one meaning, everywhere in this folder, and in the code.

| Term           | Meaning                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| preset         | A named bundle of tools, config, checks, settings, and agent rule files.                                                  |
| check          | One external command or built-in analysis that produces findings.                                                         |
| rule           | A named diagnostic within a check, such as an ESLint rule. Not an agent instruction file.                                 |
| finding        | A message from a check, optionally with a file location and tool rule name.                                               |
| result         | The status and findings of one check execution.                                                                           |
| report         | Results of the complete run, including failures, skips, and metadata.                                                     |
| engine         | The implementation that executes a class of checks.                                                                       |
| config         | The repository's choices in `gspot.toml`. Internal `Policy` names are implementation names, not public synonyms.          |
| ignore         | A tracked exception for a check or one of its rules, optionally restricted by paths. Reasons follow `require_reasons`.    |
| scope          | A config-relative subtree with its own preset selection and settings.                                                     |
| stage          | When a check runs: commit, push, manual, or the hook-only message stage.                                                  |
| level          | Which checks are enabled by default: recommended or all. Not a stage.                                                     |
| rule file      | Markdown instructions an agent reads. Use the full phrase to distinguish it from a diagnostic rule.                       |
| rule category  | The folder category of agent rule files. It is not a level or a front-matter `layer` field.                               |
| generated file | Output derived from another input, whether generated by gspot or by the project.                                          |
| managed output | A gspot-written output governed by the ownership and recovery contract. A path under `.gspot/` alone proves no ownership. |
| file kind      | Source, generated, vendored, or binary.                                                                                   |
| file set       | Files selected from the relevant working tree, index, or committed snapshot, with exclusions and check claims applied.    |
| owned tool     | A tool whose generated config gspot maintains; ownership does not imply exclusive ownership of every developer file.      |
| drift          | A difference between actual output and the expected output from its inputs.                                               |
| fixer          | An executable operation that corrects source or formatting. Advice is `help`, not a fixer.                                |
| runner         | How the repository invokes gspot tasks: mise, npm, pnpm, yarn, or bun. An absent runner table means no integration.       |
| check coverage | The kinds of checks a file receives, such as syntax, types, or spelling.                                                  |
| test coverage  | Code exercised by tests. Distinct from check coverage.                                                                    |
| version pin    | The gspot version selected by the repository. Upgrade and recovery exceptions follow the CLI contract.                    |
| takeover       | Accepted replacement of existing tooling, with configuration carryover and saved originals.                               |
| setting        | One named configuration choice with a type, scope, and default.                                                           |
| allowed list   | Entries a specific check permits through a setting ending in `_allowed`. It is not a second ignore mechanism.             |
| profile        | Portable config without repository-specific paths.                                                                        |
| concern        | The manifest preset kind for checks that span languages; public prose says what the preset checks.                        |

[19-names.md](19-names.md) owns exact field and parameter spellings. File ownership and
recovery are defined in [03-configuration.md](03-configuration.md), not inferred from a name.

## How this folder is maintained

- Every document opens with what it decides.
- Canonical sections describe the target contract. Keep historical defect evidence in its
  existing record and link to it; do not repeat current status across documents.
- A number that summarizes a list lives beside the list, or not at all.
- No document links to a file that does not exist. A link check runs over this folder in the gate of this repository.
- Paths from the reference repositories appear only in the source column of the ledger.

## Contract owners

These documents specify the target, not a claim that the implementation already conforms.
When a contract changes, update its owner, decision, fix acceptance tests, and remaining-work row
together. Historical evidence in the gap log describes the defect, not a competing target.

| Contract                                                             | Owner                                            |
| -------------------------------------------------------------------- | ------------------------------------------------ |
| Commands, dry-run, init and upgrade sequence                         | [02-cli.md](02-cli.md)                           |
| Paths, recovery, ownership, carryover, serialization, and tool locks | [03-configuration.md](03-configuration.md)       |
| Banned terms and naming defaults                                     | [08-naming-policy.md](08-naming-policy.md)       |
| Revision selection, hooks and CI                                     | [10-hooks-ci-runners.md](10-hooks-ci-runners.md) |
| Public and internal domain vocabulary                                | [19-names.md](19-names.md)                       |
| Website source, released docs and deployment                         | [21-documentation.md](21-documentation.md)       |
| Implementation verification and app branch handoff                   | [22-remaining.md](22-remaining.md)               |

The September 20 review is tracked in [24-contracts.md](fixes/24-contracts.md), with the
existing subject fixes amended in place. [22-remaining.md](22-remaining.md) remains the work index.

The cleanup backlog in [22-remaining.md](22-remaining.md#cleanup-acceptance-backlog) supersedes
older implementation prescriptions where they conflict. [12-repository-layout.md](12-repository-layout.md#tests)
owns meaningful test acceptance; [05-engines.md](05-engines.md#execution-ownership) owns
execution boundaries; [04-presets.md](04-presets.md) owns shipped preset policy.
[16-file-tree.md](16-file-tree.md) defines ownership without mandatory filename inventories.
Fixed counts, source-text guards, generic frameworks, and paperwork do not establish completion.
