# Unresolved Findings

1,092 unresolved review records remain. 616 come from the review of October 6, 2026 and the owner decisions of that day. 476 are older records that the same review checked and kept open. Each record has a stable ID, and its JSON checklist holds the verification evidence. Owner decisions are in [progress](findings/progress.json); they win over any record.

On October 6, 2026, a read-only verification checked all 802 older records against commit `3e1445a2d` and closed 203. The owner decisions of that day closed 14 more. A coherence check then compared every open record with the decisions and with every other record, and closed 272 duplicates, superseded records, and wrong records. [The closed list](findings/review/closed.md) gives the evidence for each. Each older findings file ends with a "Status on October 6, 2026" table that gives the current file and what remains; the original rows above it are history.

## Start here

1. [Owner decisions](findings/review/owner-decisions.md): the per-OS binaries go for good, and the ASD-STE100 rule and every banned naming term come back. The docs move to generativespotting.com on Cloudflare. One small server replaces the three test registries, and no GitHub environments remain.
2. [Owner questions](findings/review/owner-questions.md): every question has an answer. Records of kind "decision" carry their answer in their JSON checklist.
3. [Vocabulary](findings/review/glossary.md): one name for each concept. Every record uses these names; where an older record says otherwise, the vocabulary wins.
4. Nothing can be installed yet. `@gspothq/cli` returns 404 on npm, and no tag or release exists (`main/001`).
5. Templates cannot carry a repository's customization today. Export drops scopes, excludes, `[[check]]`, and every entry that names a path. `init --from` writes schema defaults as if the user set them. A committed template cannot be exported again ([commands and templates](findings/review/commands-templates.md)).
6. gspot.toml has no canonical writer and many mechanisms for one job. [The format review](findings/review/policy-format.md) explains the TOML forms, compares 20 tools, and gives the target format, which is the plan.
7. This repository's gspot.toml hides problems instead of fixing them. The `tests` scope selects framework configurations for plain test files. Many exceptions are dead, and the architecture layers allow two-way imports ([exceptions](findings/review/policy-exceptions.md)).
8. Carve-outs: test time limits sit in six layers. The owner rule is one setting for each concern ([carve-outs](findings/review/carve-outs.md)).
9. File and folder names: `commands/policy-edit.ts`, `tools/installed-files.ts`, and `tools/installation.ts` are explained, with a target tree and a move table, in [the source layout review](findings/review/source-layout.md). [The test layout review](findings/review/tests-layout.md) has the same for `tests/`.

## Review of October 6, 2026

Read-only reviewers read every folder of the repository. Each file below holds a findings table and the sections its reviewer added, such as simpler designs, library replacements, carve-outs, target trees, and move tables. Each file ends with a "Not read" section that says what its reviewer did not read.

| Review                                                                                                | Open records | Checklist                                                         |
| ----------------------------------------------------------------------------------------------------- | -----------: | ----------------------------------------------------------------- |
| [Owner decisions of October 6, 2026](findings/review/owner-decisions.md)                              |            6 | [JSON](findings/implementation/review/owner-decisions.json)       |
| [Owner questions and their answers](findings/review/owner-questions.md)                               |              |                                                                   |
| [Vocabulary: one name for each concept](findings/review/glossary.md)                                  |           28 | [JSON](findings/implementation/review/glossary.json)              |
| [Commands and templates](findings/review/commands-templates.md)                                       |           27 | [JSON](findings/implementation/review/commands-templates.json)    |
| [The gspot.toml format](findings/review/policy-format.md)                                             |           29 | [JSON](findings/implementation/review/policy/format.json)         |
| [This repository's own gspot.toml exceptions](findings/review/policy-exceptions.md)                   |           34 | [JSON](findings/implementation/review/policy/exceptions.json)     |
| [Carve-outs](findings/review/carve-outs.md)                                                           |            1 | [JSON](findings/implementation/review/carve-outs.json)            |
| [Source layout, names, and import graph](findings/review/source-layout.md)                            |           51 | [JSON](findings/implementation/review/source-layout.json)         |
| [Code: commands, lifecycle, policy, generation](findings/review/code-commands.md)                     |           43 | [JSON](findings/implementation/review/code/command-review.json)   |
| [Code: execution, tools, parsers, platform, repository, checks](findings/review/code-execution.md)    |           46 | [JSON](findings/implementation/review/code/execution.json)        |
| [Configurations and the ESLint plugin](findings/review/configurations-plugin.md)                      |           59 | [JSON](findings/implementation/review/configurations-plugin.json) |
| [Test layout and wiring](findings/review/tests-layout.md)                                             |           38 | [JSON](findings/implementation/review/tests/layout.json)          |
| [Tests in tests/cli](findings/review/tests-cli.md)                                                    |          125 | [JSON](findings/implementation/review/tests/cli.json)             |
| [Tests in tests/tools, tests/plugin, tests/packages, and the harness](findings/review/tests-tools.md) |           50 | [JSON](findings/implementation/review/tests/tools.json)           |
| [READMEs, guides, and the docs site](findings/review/docs-site.md)                                    |           40 | [JSON](findings/implementation/review/docs-site.json)             |
| [Repository root, scripts, workflows, and dependencies](findings/review/repository-root.md)           |           28 | [JSON](findings/implementation/review/repository-root.json)       |
| [Found while verifying the older records](findings/review/verification.md)                            |           11 | [JSON](findings/implementation/review/verification.json)          |

## Older review checklists

These records come from the reviews of October 3, 2026. The record IDs and their original text are kept. The status table at the end of each file gives the current location and what remains.

| Review                                                                                                         | Open records | Checklist                                                                    |
| -------------------------------------------------------------------------------------------------------------- | -----------: | ---------------------------------------------------------------------------- |
| Main-summary reconciliation                                                                                    |            4 | [JSON](findings/implementation/FINDINGS.json)                                |
| [Findings From Implementation Verification](findings/additional.md)                                            |            1 | [JSON](findings/implementation/additional.json)                              |
| [Built-in Checks](findings/areas/checks.md)                                                                    |           35 | [JSON](findings/implementation/areas/checks.json)                            |
| [Developer Experience in Non-JavaScript and Mixed Projects](findings/areas/developer-experience.md)            |            9 | [JSON](findings/implementation/areas/developer-experience.json)              |
| [Integration Tests Outside the Checks Folder](findings/areas/integration-tests.md)                             |           57 | [JSON](findings/implementation/areas/integration-tests.json)                 |
| [Kits, Settings, and Names](findings/areas/kits.md)                                                            |           70 | [JSON](findings/implementation/areas/kits.json)                              |
| [Repository Setup and Ceremony](findings/areas/repository.md)                                                  |            4 | [JSON](findings/implementation/areas/repository.json)                        |
| [Native-Tool, Acceptance, and Package Tests](findings/areas/tool-tests.md)                                     |           26 | [JSON](findings/implementation/areas/tool-tests.json)                        |
| [Unit Tests and Check Integration Tests](findings/areas/unit-tests.md)                                         |            8 | [JSON](findings/implementation/areas/unit-tests.json)                        |
| [findings/images/docs.png](findings/images/docs.png)                                                           |            0 | [JSON](findings/implementation/images/docs.json)                             |
| [findings/images/install.png](findings/images/install.png)                                                     |            0 | [JSON](findings/implementation/images/install.json)                          |
| [findings/images/repository.png](findings/images/repository.png)                                               |            1 | [JSON](findings/implementation/images/repository.json)                       |
| [findings/images/source.png](findings/images/source.png)                                                       |            0 | [JSON](findings/implementation/images/source.json)                           |
| [Checks: Database, Framework, Library, Platform, Tool, and the Registry](findings/slices/checks-other.md)      |           10 | [JSON](findings/implementation/slices/checks/other.json)                     |
| [The Config Constants](findings/slices/config.md)                                                              |            6 | [JSON](findings/implementation/slices/config.json)                           |
| [Kits: Frameworks, Libraries, Platforms, Tools, and Postgres](findings/slices/kits-frameworks-tools.md)        |           35 | [JSON](findings/implementation/slices/configurations/frameworks-tools.json)  |
| [Kits: General](findings/slices/kits-general.md)                                                               |           11 | [JSON](findings/implementation/slices/configurations/general.json)           |
| [Kits: Python, Swift, Bash, and SQL](findings/slices/kits-other-languages.md)                                  |            8 | [JSON](findings/implementation/slices/configurations/other-languages.json)   |
| [Kits: JavaScript, TypeScript, CSS, HTML, and Markdown](findings/slices/kits-web-languages.md)                 |            5 | [JSON](findings/implementation/slices/configurations/web-languages.json)     |
| [Repository Files, Line by Line](findings/slices/repository-root.md)                                           |            0 | [JSON](findings/implementation/slices/repository/root.json)                  |
| [Tests: Acceptance](findings/slices/tests-acceptance.md)                                                       |           21 | [JSON](findings/implementation/slices/tests/acceptance.json)                 |
| [Tests: Check Integration Tests](findings/slices/tests-integration-checks.md)                                  |           35 | [JSON](findings/implementation/slices/tests/integration/checks.json)         |
| [Tests: Command, Policy, Platform, and Tools Integration Tests](findings/slices/tests-integration-commands.md) |           19 | [JSON](findings/implementation/slices/tests/integration/command-review.json) |
| [Tests: Execution Integration Tests](findings/slices/tests-integration-execution.md)                           |           18 | [JSON](findings/implementation/slices/tests/integration/execution.json)      |
| [Tests: Generation Integration Tests](findings/slices/tests-integration-generation.md)                         |            2 | [JSON](findings/implementation/slices/tests/integration/generation.json)     |
| [Tests: Lifecycle and Repository Integration Tests](findings/slices/tests-integration-lifecycle.md)            |           43 | [JSON](findings/implementation/slices/tests/integration/lifecycle.json)      |
| [Tests: Native-Tool Tests and Samples](findings/slices/tests-tools-samples.md)                                 |           48 | [JSON](findings/implementation/slices/tests/tools-samples.json)              |
| [Tests: Unit](findings/slices/tests-unit.md)                                                                   |            0 | [JSON](findings/implementation/slices/tests/unit.json)                       |

## Pending summary records

These summary records stay open. Their original text and verification evidence are in [the summary checklist](findings/implementation/FINDINGS.json).

| ID         | Review section                                                                                                            | Status  | What remains                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main/001` | The biggest problems                                                                                                      | partial | Publish the first version of `@gspothq/eslint-plugin` and then `@gspothq/cli` to npm by hand with a short-lived granular npm token (`npm publish ./packages/eslint-plugin`, then `npm publish ./packages/cli`, after `mise run build:cli`), once the per-OS archives are gone (`review/owner-decisions/001`). Then configure npm trusted publishing on both packages for this repository and `.github/workflows/release.yml`, with no GitHub environment (`review/owner-decisions/006`, which also rewrites the comment at `release.yml:105-106`), and cut later releases with the manual `release.yml` run. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets, so that `docs.yml` serves the site at generativespotting.com (`review/owner-decisions/004`).                                                                                                                                                                                                                                                                                                 |
| `main/017` | Why `check-state.ts`, `json-schema.ts`, `loosening.ts`, `normalize.ts`, `setting-surface.ts`, and `written-keys.ts` exist | partial | Name the `Policy` fields exactly as their TOML keys (answer to owner question Q10). In `buildPolicy` (`packages/cli/src/policy/normalize.ts:155-193`), rename `checks` to `check`, `agentRules` to `agent_rules`, `ignores` to `ignore`, and `scopes` to `scope`, and delete the `agent_rules: policy.agentRules` map-back in `packages/cli/src/policy/settings/entries.ts:211`. Fields that no single TOML key holds (`configurationSettings`, `scopeTables`, `declarations`) keep their names. Update the `Policy` type in `packages/cli/src/types/policy/settings.ts:102-126` and every reader.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `main/064` | From the second pass                                                                                                      | partial | Apply the remaining agent-rule layout changes in `packages/cli/configurations/general/engineering/rules/`. Merge `prose/DOCS-REVIEW.md` into `prose/DOCS.md` as its last section and delete `DOCS-REVIEW.md`. Move the "Casing across languages" section of `code/NAMING-FILES.md` (lines 10-24, with its table) into `code/NAMING.md`, and its "Structural ownership" section (lines 60-66, which `review/configurations-plugin/066` also edits) into `agent/WORKING.md`; change the intro of `NAMING-FILES.md` to name only the two sections it keeps, "Files and directories" and "Boundaries and external names" (it has no Tests section). Run `gspot apply` so this repository's written copies of the agent rules follow. Do not merge `TALKING.md` into `WRITING.md`: `review/owner-decisions/002` restores `TALKING.md`. The `PLAYWRIGHT.md` move is `slices/kits-frameworks-tools/053`, the `NEXTINTL.md` condition is `review/verification/015`, the `NODE.md` condition is `areas/developer-experience/026`, and the `TASKS.md` move is `review/configurations-plugin/054`. |
| `main/097` | Phase 1: fix the bugs                                                                                                     | open    | In `packages/cli/src/checks/tool/xctest.ts:225-229`, stop refusing a scope that has a `Package.swift` and no `tools.xcode.project`. Run `swift test --enable-code-coverage` there, read the coverage report at the path that `swift test --show-codecov-path` prints, and compare each target with its floor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Architecture material

- [Built-in Checks](findings/areas/checks.md)
- [Commands, Lifecycle, Generation, and Output](findings/areas/commands.md)
- [READMEs, Guides, Reference, and the Docs Site](findings/areas/docs.md)
- [Execution, Tools, Repository, Platform, and Parsers](findings/areas/execution.md)
- [Policy, Kits, Rules, Config, and Types](findings/areas/policy.md)
- [Repository Setup and Ceremony](findings/areas/repository.md)
- [Test Structure: Tiers, Harness, and Samples](findings/areas/test-structure.md)

The relocation map is retained as [architecture support](findings/relocations.json).

## Diagrams

Each image compares the tree at commit `3e1445a2d` (October 6, 2026) with the target that the owner decisions and the open records describe. Every "After" annotation comes from a decision or an open record. If an image and a record ever disagree, the record and the decisions win.

Red means deleted. Orange means moved or renamed. Green means new, or gathered from several places. Purple means dissolved into the code that uses it.

### Repository

![The repository root today and after the cleanup](findings/images/repository.png)

### Source

![packages/cli/src today and after the cleanup](findings/images/source.png)

### Tests

![tests/ today and after the cleanup](findings/images/tests.png)

### Docs

![The docs site and READMEs today and after the cleanup](findings/images/docs.png)

### What a Python project gets

![The files gspot writes in a Python project, today and after the cleanup](findings/images/install.png)
