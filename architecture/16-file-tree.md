# File Tree

This document defines repository ownership. It replaces the proposed inventory of every source
and test filename. Exact filenames follow the implementing owner and repository naming policy;
no mirrored constants/types tree or one-file-per-check scheme is required. A move must simplify
ownership or dependencies. Existing code and an earlier planned layout carry no preservation
privilege. [22-remaining.md](22-remaining.md) owns the implementation sequence and open work.

## Root

```text
gspot/
├── architecture/               canonical contracts and existing evidence
├── docs/                       public manual and website source
├── examples/                   executable product examples
├── packages/
│   ├── cli/                    command-line application and its tests
│   ├── eslint-plugin/          independently usable ESLint artifact and its tests
│   ├── npm/                    launcher and platform packaging
│   └── testing/                shared filesystem test setup and cleanup
├── presets/                    executable policy and assets grouped by kind
├── rules/                      authored engineering instructions grouped by layer
├── tests/                      command acceptance, release acceptance, shared harness
├── gspot.schema.json           generated public schema
└── gspot.toml                  repository policy
```

Root build metadata, contributor files, workflows, and generated integration paths retain the
owners defined in the CLI, configuration, hooks, and release contracts. This tree deliberately
omits filename inventories; omission does not order deletion of a required product surface.

## `packages/cli/`

Build and packaging entry points own artifact assembly. Source modules own behavior at the
boundaries below; tests stay beside this separately shipped package under its test tree.

### `config/`

Keep shared literal data only where multiple consumers need the same contract. Presets own
shipped tool pins and rule policy. Algorithm constants stay with the algorithm. Delete tables
that merely centralize unrelated literals, along with forwarding accessors.

### `src/`

#### `commands/`

Arguments, command selection, and presentation belong at the CLI boundary. Application behavior
remains callable without a terminal. A thin adapter is justified when it translates that boundary;
a file that only forwards a call is not required.

#### `checks/` and `readers/`

Group check implementations by the domain inspected. Separate shared parsing and platform
operations from executable check catalogs. A domain may use several checks from one module;
one file per identifier is not a contract. Planning resolves implementations once.

Readers share repository observations within a command session. They distinguish absent,
unreadable, and malformed inputs. Language-specific semantics remain explicit. Sharing does
not require a universal syntax-tree framework or a table describing every language operation.

#### The other folders

| Owner                               | Responsibility                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `run/`                              | Planning, common tool execution, cancellation, results, and execution status. |
| `repository/`                       | Command-scoped file, scope, metadata, and Git observations.                   |
| `policy/`                           | Validated user policy, merge, persistent exceptions, and policy editing.      |
| `presets/`                          | Manifest loading, detection, selection, and asset lookup.                     |
| `emit/`                             | Pure generation of proposed output from validated inputs.                     |
| `lifecycle/`                        | Managed application, ownership, collision handling, recovery, and removal.    |
| Naming, structure, and prose owners | Actual analysis and operational parsing, using preset-owned policy.           |
| Presentation owner                  | Human and structured output from the same command results.                    |

These responsibilities constrain dependencies, not the number of files. Split a module when it
owns distinct behavior; merge forwarding-only layers. Generation never applies its own writes.
Infrastructure never depends on a large check catalog for basic path or configuration work.

### `types/`

Keep shared types only for shared contracts. Derive parsed-input types from schemas. Colocate
owner-specific and normalized types where used. Test-only types belong to tests. Delete
parallel handwritten definitions that repeat schema fields without a transformation.

## `packages/eslint-plugin/`

The plugin owns editor-compatible rule implementation and standalone exports. Its package tests
exercise actual invalid and valid code. Release tests install its published artifact and use
exports and declarations. Recommended and all derive from one level-policy owner.

A rule implementation is deleted only after replacement proves intended enforcement through
generated configuration. Keep custom rules for policies a maintained external rule cannot express.

## `packages/npm/`

The launcher selects the installed platform artifact. Build and publication use one version
source. Installed-consumer acceptance verifies package identity and execution together.
No second publication scenario is required solely to repeat metadata assertions.

## `presets/`

Group existing named presets under `language/`, `framework/`, `library/`, `platform/`,
`database/`, `tool/`, and `concern/` according to manifest kind. Public names stay unchanged.
Discovery uses the actual manifest directory; no aliases or duplicate category registry.

`presets/concern/prose/` owns its manifest, Vale template, `styles/gspot/`, and
`vocabularies/gspot/accept.txt`. The root `prose/` directory has no separate responsibility.
Presets own shipped tools, versions, templates, rule defaults, styles, and vocabulary.
CLI code owns operational loading, validation, parsing, and execution.

## `rules/`

Keep authored engineering instructions grouped by layer and referenced by presets. They are
not executable preset configuration. Reorganizing implementation is not authority to remove
an engineering policy or its enforcement.

## `docs/`

Public documentation describes implemented release behavior. Generate reference pages during
build from validated definitions; do not track duplicate generated copies. Render before
applying, replace or prune only owned pages, and preserve authored files and prior output on
failure. Delete the generated architecture-decisions mirror and sidebar entry; link history
separately where useful. Preserve website, artwork, accessibility, and release documentation
requirements in their existing owners.

## `.gspot/` in a repository

[03-configuration.md](03-configuration.md) owns the exact generated paths, ownership records,
recovery, and serialization contracts. A directory name or generated header does not establish
permission to delete a file. Do not recursively remove the directory during uninstall.

## `tests/`

Package-owned unit and integration suites remain in their packages. Root acceptance covers
public commands and representative project journeys. Root release tests cover installed
artifacts, identity, assets, plugin consumption, and isolated tool installation. Shared harness
code owns real setup and cleanup. No extra E2E directory or test README is required.

[12-repository-layout.md](12-repository-layout.md#tests) defines evidence: real current logic,
exact defects, corrected input, actual process status, and preserved files. Delete tests of
removed details; retain surviving behavioral contracts at their new owners. Test filenames,
source tokens, counts, and forwarding calls are not acceptance.

## What is not in the tree

Do not add compatibility forwarding files, generic workflow or test-case languages, parallel
audit systems, duplicated category registries, or mirrored type and constant inventories.
Delete unused code and proven duplicates after migrating their callers and behavioral tests.
Keep legitimate subprocess, registry, filesystem, restoration, and serialization boundaries.

## What moves

| Current responsibility                                                  | Target and deletion condition                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `integrity/`, `web/`, `apple/`, `pyproject/`, and SQL check collections | Domain-owned checks; move shared parsers and platform operations outside catalogs. Preserve every retained finding. |
| Adapter subprocess/reporting copies                                     | Shared runner contract after actual adapter execution tests pass; retain necessary preparation.                     |
| Dispatch-only engine and analysis layers                                | Resolve in planning and execute once; retain real context and preparation.                                          |
| Lifecycle ownership reconstructed from templates or paths               | One recorded ownership and recovery model after preservation and interruption tests pass.                           |
| Writers embedded in generation                                          | One managed application boundary, with render failure leaving prior output intact.                                  |
| Repeated schema, help, docs, and type fields                            | Validated definition owner; preserve real normalized representations.                                               |
| Process-global caches and test reset hooks                              | Command-session observations or justified caches with verified invalidation.                                        |
| Duplicate custom rules                                                  | Pinned replacement through generated config, only after equivalent enforcement is demonstrated.                     |
| Repeated release publication setup                                      | One fresh installed-consumer journey retaining identity assertions.                                                 |
| Generated reference copies and decisions mirror                         | Build-owned reference output and a separate link to design history.                                                 |

The full task list and acceptance live in [22-remaining.md](22-remaining.md#cleanup-acceptance-backlog).
Do not execute a cosmetic rename campaign before the behavioral and ownership prerequisites.
