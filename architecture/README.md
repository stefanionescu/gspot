# gspot Architecture

The [active CI bypass](22-remaining.md#active-ci-bypass) governs all implementation work.
Skip CI on every commit and push until the user explicitly re-enables it.

This folder specifies the product contract. It does not certify the current implementation.
Start with [development readiness and next work](22-remaining.md#development-readiness-and-next-work)
to distinguish the completed layout cleanup from remaining defects and verification. Follow the
[cleanup constraints](22-remaining.md#cleanup-before-feature-work) while repairing existing behavior.
Repository lint cleanup is a later phase; keep its findings visible.

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

The [remaining-work record](22-remaining.md) distinguishes current implementation,
open requirements, historical completion claims, and deferred verification.

## Reading order

| File                                                 | Decides                                                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [01-product.md](01-product.md)                       | Who gspot is for, what it promises, what it refuses to do                                                                                   |
| [02-cli.md](02-cli.md)                               | Every command, flag, output line, and exit code                                                                                             |
| [03-configuration.md](03-configuration.md)           | The one file a person edits, and the files gspot owns                                                                                       |
| [04-configurations.md](04-configurations.md)         | The unit of selection: manifest format, detection, available configurations                                                                 |
| [05-engines.md](05-engines.md)                       | The six things that produce findings                                                                                                        |
| [06-enforcement-ledger.md](06-enforcement-ledger.md) | Every rule and check carried from the reference repositories, and where it lands                                                            |
| [07-slop-drift.md](07-slop-drift.md)                 | New enforcement: what LLM slop and repository drift look like and how gspot catches them                                                    |
| [08-naming-policy.md](08-naming-policy.md)           | The banned-term and case policy, its schema, and its matching rules                                                                         |
| [09-rules.md](09-rules.md)                           | The agent rule files: layers, assembly, repair, enforcement links                                                                           |
| [10-hooks-ci-runners.md](10-hooks-ci-runners.md)     | Git hooks, staged mode, task runners, the CI workflow                                                                                       |
| [11-toolchain.md](11-toolchain.md)                   | How gspot itself is installed and pinned per repository; how each tool is obtained, pinned, verified, and upgraded                          |
| [12-repository-layout.md](12-repository-layout.md)   | gspot's own repository, packages, tests and self-lint                                                                                       |
| [15-prior-art.md](15-prior-art.md)                   | What gspot copies from tools people already use, and which libraries it reuses instead of writing its own                                   |
| [21-documentation.md](21-documentation.md)           | What the README, the manual, and the site at gspot.dev hold, and what must be true before launch                                            |
| [22-remaining.md](22-remaining.md)                   | Everything that is left, in order, with the linters and the custom rules of every language, and what happens to the ESLint of the developer |

Read 01 to 05 to understand the tool. Read 06 to 09 to understand the rules. Read the integration, toolchain, and repository contracts to build it.

## Glossary

One word, one meaning, everywhere in this folder, and in the code.

| Term                 | Meaning                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| configuration        | A named bundle of tools, config, checks, settings, and agent rule files.                                                  |
| check                | One external command or built-in analysis that produces findings.                                                         |
| rule                 | A named diagnostic within a check, such as an ESLint rule. Not an agent instruction file.                                 |
| finding              | A message from a check, optionally with a file location and tool rule name.                                               |
| result               | The status and findings of one check execution.                                                                           |
| report               | Results of the complete run, including failures, skips, and metadata.                                                     |
| engine               | The implementation that executes a class of checks.                                                                       |
| config               | The repository's choices in `gspot.toml`. Internal `Policy` names are implementation names, not public synonyms.          |
| ignore               | A tracked exception for a check or one of its rules, optionally restricted by paths. Reasons follow `require_reasons`.    |
| scope                | A config-relative subtree with its own configuration selection and settings.                                              |
| stage                | When a check runs: commit, push, manual, or the hook-only message stage.                                                  |
| level                | Which checks are enabled by default: recommended or all. Not a stage.                                                     |
| rule file            | Markdown instructions an agent reads. Use the full phrase to distinguish it from a diagnostic rule.                       |
| rule category        | The folder category of agent rule files. It is not a level or a front-matter `layer` field.                               |
| generated file       | Output derived from another input, whether generated by gspot or by the project.                                          |
| managed output       | A gspot-written output governed by the ownership and recovery contract. A path under `.gspot/` alone proves no ownership. |
| file kind            | Source, generated, vendored, or binary.                                                                                   |
| file set             | Files selected from the relevant working tree, index, or committed snapshot, with exclusions and check claims applied.    |
| owned tool           | A tool whose generated config gspot maintains; ownership does not imply exclusive ownership of every developer file.      |
| drift                | A difference between actual output and the expected output from its inputs.                                               |
| fixer                | An executable operation that corrects source or formatting. Advice is `help`, not a fixer.                                |
| runner               | How the repository invokes gspot tasks: mise, npm, pnpm, yarn, or bun. An absent runner table means no integration.       |
| check coverage       | The kinds of checks a file receives, such as syntax, types, or spelling.                                                  |
| test coverage        | Code exercised by tests. Distinct from check coverage.                                                                    |
| version pin          | The gspot version selected by the repository. Upgrade and recovery exceptions follow the CLI contract.                    |
| takeover             | Accepted replacement of existing tooling, with configuration carryover and saved originals.                               |
| setting              | One named configuration choice with a type, scope, and default.                                                           |
| allowed list         | Entries a specific check permits through a setting ending in `_allowed`. It is not a second ignore mechanism.             |
| directory setting    | A single folder uses `_directory`, including `functions_directory`, `migrations_directory`, and `harness_directory`.      |
| file pattern setting | File globs use `_files`, including `route_files`, `test_files`, `server_files`, and `admin_key_files`.                    |
| tool option          | An external tool owns its option names, including `tools.knip.ignore` and `tools.typos.exclude`.                          |
| profile              | Portable config without repository-specific paths.                                                                        |
| policy               | The manifest configuration kind for checks that span languages; public prose says what the configuration checks.          |

[Configuration definitions](04-configurations.md#names-across-the-public-contract) and
[execution results](05-engines.md#actions-and-their-results) own exact public fields. File ownership and
recovery are defined in [03-configuration.md](03-configuration.md), not inferred from a name.

## How this folder is maintained

- Every document opens with what it decides.
- Canonical sections describe the target contract. Keep status and historical evidence only
  in remaining work; do not repeat completion claims across documents.
- A number that summarizes a list lives beside the list, or not at all.
- No document links to a file that does not exist. A link check runs over this folder in the gate of this repository.
- Reference source paths belong in the ledger or the inspected prior-art rationale.
- Delete obsolete prescriptions and empty retired acceptance sections. Retain their disposition
  once in remaining work and update incoming links.
- State each rule in its owning section and link to it elsewhere. Do not copy a policy paragraph
  into every language or framework contract.
- Keep implementation tasks behavioral. Do not require a helper, module, registry, test file,
  or abstraction merely because a previous plan named it.
- Keep one current disposition per behavior. Retain unique unresolved failures and the evidence
  needed to assess them; remove superseded successful-run narratives after reconciliation.
  Test totals, elapsed effort, and generated page counts do not establish product quality.

## Contract owners

These documents specify the target, not a claim that the implementation already conforms.
When a contract changes, update its owner and its grouped disposition in remaining work.
Acceptance clauses describe the target; only remaining work records completion evidence.

| Contract                                                             | Owner                                            |
| -------------------------------------------------------------------- | ------------------------------------------------ |
| Commands, dry-run, init and apply sequence                           | [02-cli.md](02-cli.md)                           |
| Paths, recovery, ownership, carryover, serialization, and tool locks | [03-configuration.md](03-configuration.md)       |
| Banned terms and naming defaults                                     | [08-naming-policy.md](08-naming-policy.md)       |
| Revision selection, hooks and CI                                     | [10-hooks-ci-runners.md](10-hooks-ci-runners.md) |
| Public and internal domain vocabulary                                | [public vocabulary](#glossary)                   |
| Website source, released docs and deployment                         | [21-documentation.md](21-documentation.md)       |
| Implementation verification and app branch handoff                   | [22-remaining.md](22-remaining.md)               |

The [grouped dispositions](22-remaining.md#grouped-dispositions) own all status. The ledger
preserves agreed configuration capabilities, including those without a manifest. Directory inventories,
cosmetic rename campaigns, and fixed rule totals do not establish completion. Updating this
folder does not authorize implementation changes, publication, deployment, or changes to
external repositories.
