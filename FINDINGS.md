# Unresolved Findings

802 unresolved review records remain. This includes implementation work, verification, and summary reconciliation. The checklists retain stable IDs and evidence for partially completed work. Historical proposals follow the current [repository decisions](findings/progress.json).

## Review checklists

| Review                                                                                                         | Open records | Checklist                                                                    |
| -------------------------------------------------------------------------------------------------------------- | -----------: | ---------------------------------------------------------------------------- |
| Main-summary reconciliation                                                                                    |          104 | [JSON](findings/implementation/FINDINGS.json)                                |
| [Findings From Implementation Verification](findings/additional.md)                                            |            1 | [JSON](findings/implementation/additional.json)                              |
| [Built-in Checks](findings/areas/checks.md)                                                                    |           59 | [JSON](findings/implementation/areas/checks.json)                            |
| [Developer Experience in Non-JavaScript and Mixed Projects](findings/areas/developer-experience.md)            |           34 | [JSON](findings/implementation/areas/developer-experience.json)              |
| [Integration Tests Outside the Checks Folder](findings/areas/integration-tests.md)                             |           75 | [JSON](findings/implementation/areas/integration-tests.json)                 |
| [Kits, Settings, and Names](findings/areas/kits.md)                                                            |           95 | [JSON](findings/implementation/areas/kits.json)                              |
| [Repository Setup and Ceremony](findings/areas/repository.md)                                                  |            5 | [JSON](findings/implementation/areas/repository.json)                        |
| [Native-Tool, Acceptance, and Package Tests](findings/areas/tool-tests.md)                                     |           42 | [JSON](findings/implementation/areas/tool-tests.json)                        |
| [Unit Tests and Check Integration Tests](findings/areas/unit-tests.md)                                         |           17 | [JSON](findings/implementation/areas/unit-tests.json)                        |
| [Docs diagram](findings/images/docs.png)                                                                       |            2 | [JSON](findings/implementation/images/docs.json)                             |
| [Install diagram](findings/images/install.png)                                                                 |            2 | [JSON](findings/implementation/images/install.json)                          |
| [Repository diagram](findings/images/repository.png)                                                           |            2 | [JSON](findings/implementation/images/repository.json)                       |
| [Source diagram](findings/images/source.png)                                                                   |            1 | [JSON](findings/implementation/images/source.json)                           |
| [Checks: Database, Framework, Library, Platform, Tool, and the Registry](findings/slices/checks-other.md)      |           11 | [JSON](findings/implementation/slices/checks/other.json)                     |
| [The Config Constants](findings/slices/config.md)                                                              |            6 | [JSON](findings/implementation/slices/config.json)                           |
| [Kits: Frameworks, Libraries, Platforms, Tools, and Postgres](findings/slices/kits-frameworks-tools.md)        |           41 | [JSON](findings/implementation/slices/configurations/frameworks-tools.json)  |
| [Kits: General](findings/slices/kits-general.md)                                                               |           15 | [JSON](findings/implementation/slices/configurations/general.json)           |
| [Kits: Python, Swift, Bash, and SQL](findings/slices/kits-other-languages.md)                                  |           10 | [JSON](findings/implementation/slices/configurations/other-languages.json)   |
| [Kits: JavaScript, TypeScript, CSS, HTML, and Markdown](findings/slices/kits-web-languages.md)                 |            5 | [JSON](findings/implementation/slices/configurations/web-languages.json)     |
| [Repository Files, Line by Line](findings/slices/repository-root.md)                                           |            2 | [JSON](findings/implementation/slices/repository/root.json)                  |
| [Tests: Acceptance](findings/slices/tests-acceptance.md)                                                       |           40 | [JSON](findings/implementation/slices/tests/acceptance.json)                 |
| [Tests: Check Integration Tests](findings/slices/tests-integration-checks.md)                                  |           46 | [JSON](findings/implementation/slices/tests/integration/checks.json)         |
| [Tests: Command, Policy, Platform, and Tools Integration Tests](findings/slices/tests-integration-commands.md) |           20 | [JSON](findings/implementation/slices/tests/integration/command-review.json) |
| [Tests: Execution Integration Tests](findings/slices/tests-integration-execution.md)                           |           40 | [JSON](findings/implementation/slices/tests/integration/execution.json)      |
| [Tests: Generation Integration Tests](findings/slices/tests-integration-generation.md)                         |            2 | [JSON](findings/implementation/slices/tests/integration/generation.json)     |
| [Tests: Lifecycle and Repository Integration Tests](findings/slices/tests-integration-lifecycle.md)            |           49 | [JSON](findings/implementation/slices/tests/integration/lifecycle.json)      |
| [Tests: Native-Tool Tests and Samples](findings/slices/tests-tools-samples.md)                                 |           67 | [JSON](findings/implementation/slices/tests/tools-samples.json)              |
| [Tests: Unit](findings/slices/tests-unit.md)                                                                   |            9 | [JSON](findings/implementation/slices/tests/unit.json)                       |

## Pending summary records

These summary records remain open in the review ledger. Their original text and verification evidence are in [the summary checklist](findings/implementation/FINDINGS.json).

| ID         | Review section                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `main/001` | The biggest problems                                                                                                      |
| `main/002` | The biggest problems                                                                                                      |
| `main/003` | The biggest problems                                                                                                      |
| `main/004` | The biggest problems                                                                                                      |
| `main/006` | The biggest problems                                                                                                      |
| `main/007` | The biggest problems                                                                                                      |
| `main/008` | The biggest problems                                                                                                      |
| `main/009` | The biggest problems                                                                                                      |
| `main/010` | The biggest problems                                                                                                      |
| `main/011` | The biggest problems                                                                                                      |
| `main/012` | The biggest problems                                                                                                      |
| `main/013` | Why `check-state.ts`, `json-schema.ts`, `loosening.ts`, `normalize.ts`, `setting-surface.ts`, and `written-keys.ts` exist |
| `main/014` | Why `check-state.ts`, `json-schema.ts`, `loosening.ts`, `normalize.ts`, `setting-surface.ts`, and `written-keys.ts` exist |
| `main/016` | Why `check-state.ts`, `json-schema.ts`, `loosening.ts`, `normalize.ts`, `setting-surface.ts`, and `written-keys.ts` exist |
| `main/017` | Why `check-state.ts`, `json-schema.ts`, `loosening.ts`, `normalize.ts`, `setting-surface.ts`, and `written-keys.ts` exist |
| `main/018` | Why `check-state.ts`, `json-schema.ts`, `loosening.ts`, `normalize.ts`, `setting-surface.ts`, and `written-keys.ts` exist |
| `main/019` | Why `check-state.ts`, `json-schema.ts`, `loosening.ts`, `normalize.ts`, `setting-surface.ts`, and `written-keys.ts` exist |
| `main/020` | Why there are so many files, why they are not in sensible folders, and why the names are so bad                           |
| `main/025` | Whether the workflows are for gspot itself or templates for other repositories                                            |
| `main/027` | Where `HF_TOKEN` and `[[config.selectors]]` come from                                                                     |
| `main/028` | Which settings are too specific for gspot and belong to each project                                                      |
| `main/033` | Whether Python, Swift, React Native, and monorepo projects see JavaScript tooling                                         |
| `main/034` | Whether Python, Swift, React Native, and monorepo projects see JavaScript tooling                                         |
| `main/035` | Whether Python, Swift, React Native, and monorepo projects see JavaScript tooling                                         |
| `main/036` | Whether Python, Swift, React Native, and monorepo projects see JavaScript tooling                                         |
| `main/037` | Whether Python, Swift, React Native, and monorepo projects see JavaScript tooling                                         |
| `main/039` | Why `tests/tools` has a `cli` folder, why acceptance and integration exist, what samples are, and how to group tests      |
| `main/040` | Which tests are fake                                                                                                      |
| `main/041` | What else in this repository, or in what gspot installs, is junk                                                          |
| `main/043` | Product                                                                                                                   |
| `main/045` | Product                                                                                                                   |
| `main/046` | Product                                                                                                                   |
| `main/047` | Product                                                                                                                   |
| `main/049` | Code                                                                                                                      |
| `main/050` | Code                                                                                                                      |
| `main/051` | Code                                                                                                                      |
| `main/052` | Code                                                                                                                      |
| `main/054` | Tests                                                                                                                     |
| `main/055` | Tests                                                                                                                     |
| `main/057` | Repository                                                                                                                |
| `main/063` | From the second pass                                                                                                      |
| `main/064` | From the second pass                                                                                                      |
| `main/065` | Phase 1: fix the bugs                                                                                                     |
| `main/066` | Phase 1: fix the bugs                                                                                                     |
| `main/067` | Phase 1: fix the bugs                                                                                                     |
| `main/068` | Phase 1: fix the bugs                                                                                                     |
| `main/069` | Phase 1: fix the bugs                                                                                                     |
| `main/070` | Phase 1: fix the bugs                                                                                                     |
| `main/072` | Phase 1: fix the bugs                                                                                                     |
| `main/073` | Phase 1: fix the bugs                                                                                                     |
| `main/074` | Phase 1: fix the bugs                                                                                                     |
| `main/075` | Phase 1: fix the bugs                                                                                                     |
| `main/076` | Phase 1: fix the bugs                                                                                                     |
| `main/077` | Phase 1: fix the bugs                                                                                                     |
| `main/078` | Phase 1: fix the bugs                                                                                                     |
| `main/079` | Phase 1: fix the bugs                                                                                                     |
| `main/080` | Phase 1: fix the bugs                                                                                                     |
| `main/081` | Phase 1: fix the bugs                                                                                                     |
| `main/083` | Phase 1: fix the bugs                                                                                                     |
| `main/084` | Phase 1: fix the bugs                                                                                                     |
| `main/085` | Phase 1: fix the bugs                                                                                                     |
| `main/086` | Phase 1: fix the bugs                                                                                                     |
| `main/087` | Phase 1: fix the bugs                                                                                                     |
| `main/088` | Phase 1: fix the bugs                                                                                                     |
| `main/089` | Phase 1: fix the bugs                                                                                                     |
| `main/092` | Phase 1: fix the bugs                                                                                                     |
| `main/093` | Phase 1: fix the bugs                                                                                                     |
| `main/094` | Phase 1: fix the bugs                                                                                                     |
| `main/095` | Phase 1: fix the bugs                                                                                                     |
| `main/096` | Phase 1: fix the bugs                                                                                                     |
| `main/097` | Phase 1: fix the bugs                                                                                                     |
| `main/098` | Phase 1: fix the bugs                                                                                                     |
| `main/099` | Phase 1: fix the bugs                                                                                                     |
| `main/100` | Phase 1: fix the bugs                                                                                                     |
| `main/101` | Phase 1: fix the bugs                                                                                                     |
| `main/103` | Phase 1: fix the bugs                                                                                                     |
| `main/104` | Phase 1: fix the bugs                                                                                                     |
| `main/106` | Phase 1: fix the bugs                                                                                                     |
| `main/108` | Phase 1: fix the bugs                                                                                                     |
| `main/109` | Phase 1: fix the bugs                                                                                                     |
| `main/110` | Phase 1: fix the bugs                                                                                                     |
| `main/111` | Phase 1: fix the bugs                                                                                                     |
| `main/112` | Phase 1: fix the bugs                                                                                                     |
| `main/113` | Phase 1: fix the bugs                                                                                                     |
| `main/114` | Phase 1: fix the bugs                                                                                                     |
| `main/115` | Phase 1: fix the bugs                                                                                                     |
| `main/116` | Phase 1: fix the bugs                                                                                                     |
| `main/117` | Phase 1: fix the bugs                                                                                                     |
| `main/118` | Phase 1: fix the bugs                                                                                                     |
| `main/119` | Phase 1: fix the bugs                                                                                                     |
| `main/120` | Phase 1: fix the bugs                                                                                                     |
| `main/121` | Phase 1: fix the bugs                                                                                                     |
| `main/122` | Phase 1: fix the bugs                                                                                                     |
| `main/123` | Phase 1: fix the bugs                                                                                                     |
| `main/125` | Phase 2: stop shipping one project's choices                                                                              |
| `main/126` | Phase 3: install cleanly in every stack                                                                                   |
| `main/127` | Phase 4: restructure the source                                                                                           |
| `main/128` | Phase 5: shrink the checks                                                                                                |
| `main/129` | Phase 6: name settings and checks clearly                                                                                 |
| `main/130` | Phase 7: rebuild the tests                                                                                                |
| `main/131` | Phase 8: cut the repository ceremony                                                                                      |
| `main/132` | Phase 9: rewrite the docs                                                                                                 |
| `open/4`   | Open items                                                                                                                |
| `open/5`   | Open items                                                                                                                |

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

Each image compares today with the target. Red means deleted. Orange means moved or renamed. Green means new, or
gathered from several places. Purple means dissolved into the code that uses it.

### Repository

![The repository root today and after the cleanup](findings/images/repository.png)

### Source

![packages/cli/src today and after the cleanup](findings/images/source.png)

### Tests

![tests/ today and after the cleanup](findings/images/tests.png)

### Docs

![The docs site and READMEs today and after the cleanup](findings/images/docs.png)

### What a Python or Swift project gets

![The files gspot writes in a Python and a Swift project, today and after the cleanup](findings/images/install.png)
