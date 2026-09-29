# gspot Architecture

This folder holds the contracts a code reader needs: what each part of gspot promises, in the
words the code uses. Status lives in the issue tracker and in Git, not here.

## What gspot is

gspot is one binary a developer runs once in any repository. It reads the repository, proposes a
policy, and on a yes it:

1. Writes configuration for the standard linters, formatters, type checkers, and scanners that
   match the languages and frameworks in the repository.
2. Adds the rules those tools lack: structural limits, banned names, slop patterns, drift
   detection, and prose rules for comments and documentation.
3. Installs instruction files for AI agents (`CLAUDE.md`, `AGENTS.md`, a guides directory) that
   match the same selection.

Every repository on the same gspot version runs the same rules. Upgrading gspot upgrades all three.

## Reading order

| File                                               | Decides                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| [01-product.md](01-product.md)                     | Who gspot is for, what it promises, what it refuses to do                      |
| [02-cli.md](02-cli.md)                             | Every command, flag, output line, and exit code                                |
| [03-configuration.md](03-configuration.md)         | The one file a person edits, and the files gspot owns                          |
| [04-kits.md](04-kits.md)                           | The unit of selection: manifest format, detection, available kits              |
| [05-engines.md](05-engines.md)                     | The engines that produce findings                                              |
| [08-naming-policy.md](08-naming-policy.md)         | The banned-term and case policy, its schema, and its matching rules            |
| [09-rules.md](09-rules.md)                         | The agent guide files: layers, assembly, repair, enforcement links             |
| [10-hooks-ci-runners.md](10-hooks-ci-runners.md)   | Git hooks, staged mode, task runners, the CI workflow                          |
| [11-toolchain.md](11-toolchain.md)                 | How gspot and every tool it runs are installed, pinned, verified, and upgraded |
| [12-repository-layout.md](12-repository-layout.md) | gspot's own repository, packages, tests and self-lint                          |

Read 01 to 05 to understand the tool. Read 08 and 09 to understand the rules. Read 10 to 12 to
build it. `levels/inventory.csv` and `levels/native.csv` are the source of which rule sits at
which level.

## Glossary

One word, one meaning, everywhere in this folder, and in the code.

| Term                 | Meaning                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| kit                  | A named bundle of tools, config, checks, settings, and guides, selected under `kits` in the policy.                       |
| check                | One external command or built-in analysis that produces findings.                                                         |
| rule                 | A named diagnostic within a check, such as an ESLint rule. Not an agent instruction file.                                 |
| finding              | A message from a check, optionally with a file location and tool rule name.                                               |
| result               | The status and findings of one check execution.                                                                           |
| report               | Results of the complete run, including failures, skips, and metadata.                                                     |
| engine               | The implementation that executes a class of checks.                                                                       |
| policy               | The repository's choices in `gspot.toml`: the kits it selects, its settings, and its ignores.                             |
| ignore               | A tracked exception for a check or one of its rules, optionally restricted by paths. Reasons follow `require_reasons`.    |
| scope                | A policy-relative subtree with its own kit selection and settings.                                                        |
| stage                | When a check runs: commit, push, manual, or the hook-only message stage.                                                  |
| level                | Which checks are enabled by default: recommended or all. Not a stage.                                                     |
| guide                | A Markdown file of instructions an agent reads, installed under `[guides] directory`.                                     |
| guide layer          | The folder category of guides. It is not a level.                                                                         |
| generated file       | Output derived from another input, whether generated by gspot or by the project.                                          |
| managed output       | A gspot-written output governed by the ownership and recovery contract. A path under `.gspot/` alone proves no ownership. |
| file kind            | Source, generated, vendored, or binary.                                                                                   |
| file set             | Files selected from the relevant working tree, index, or committed snapshot, with exclusions and check owners applied.    |
| owned tool           | A tool whose generated config gspot maintains; ownership does not imply exclusive ownership of every developer file.      |
| drift                | A difference between actual output and the expected output from its inputs.                                               |
| fixer                | An executable operation that corrects source or formatting. Advice is `help`, not a fixer.                                |
| runner               | How the repository invokes gspot tasks: mise, npm, pnpm, yarn, or bun. An absent runner table means no integration.       |
| check coverage       | The kinds of checks a file receives, such as syntax, types, or spelling.                                                  |
| test coverage        | Code exercised by tests. Distinct from check coverage.                                                                    |
| version pin          | The gspot version selected by the repository. Upgrade and recovery exceptions follow the CLI contract.                    |
| replacement          | A file init replaced, with its original saved under recovery for `gspot uninstall` to restore.                            |
| setting              | One named kit choice with a type, scope, and default.                                                                     |
| allowed list         | Entries a specific check permits through a setting ending in `_allowed`. It is not a second ignore mechanism.             |
| directory setting    | A single folder uses `_directory`, including `functions_directory`, `migrations_directory`, and `harness_directory`.      |
| file pattern setting | File globs use `_files`, including `route_files`, `test_files`, `server_files`, and `admin_key_files`.                    |
| tool option          | An external tool owns its option names, including `tools.knip.exclude` and `tools.typos.exclude`.                         |
| profile              | Portable config without repository-specific paths.                                                                        |
| general              | The kit kind for checks that span languages.                                                                              |

[Kit definitions](04-kits.md#names-across-the-public-contract) and
[execution results](05-engines.md#actions-and-their-results) own exact public fields. File ownership and
recovery are defined in [03-configuration.md](03-configuration.md), not inferred from a name.

## How this folder is maintained

- Every document opens with what it decides and stays under 300 lines.
- A document states a contract once, in its owning section, and links to it elsewhere.
- No document links to a file that does not exist. A link check runs over this folder in the gate of this repository.
- Status, evidence, and history do not live here. When a contract changes, its owner changes with the code.
