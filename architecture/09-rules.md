# Rules Corpus

This document decides the agent rule files: their layers and how they are assembled into a repository. It also decides how the merged corpus is repaired before it ships and how each rule links to the check that enforces it.

## What ships

The corpus is Markdown an agent reads before editing. It lives in `rules/`,
arranged by layer:

| Layer      | Directory                               | Files                                                                                                                                                                                                                                                                                  | Installed when                         |
| ---------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| agent      | `general/agent/`                        | `WORKING.md`, `PLANNING.md`, `TALKING.md`, `GIT.md`, `SUPPRESSIONS.md`                                                                                                                                                                                                                 | always                                 |
| code       | `general/code/`                         | `NAMING.md`, `NAMING-FILES.md`, `COMMENTS.md`, `ERRORS.md`, `LOGGING.md`, `TESTING.md`, `SECRETS.md`, `SECURITY.md`, `CONFIGURATION.md`, `DEPENDENCIES.md`, `GENERATED.md`, `ACCESSIBILITY.md`, `CLI.md`                                                                               | always                                 |
| prose      | `general/prose/`                        | `WRITING.md`, `DOCS.md`, `DOCS-FORMAT.md`, `DOCS-CONTENT.md`, `DOCS-MEDIA.md`, `DOCS-SURFACES.md`, `DOCS-REVIEW.md`                                                                                                                                                                    | always                                 |
| language   | `language/`                             | `TYPESCRIPT.md`, `JAVASCRIPT.md`, `PYTHON.md` with `python/TYPING.md`, `DESIGN.md`, `FLOW.md`, `PACKAGING.md`, `SWIFT.md`, `BASH.md` with `bash/LANGUAGE.md`, `SAFETY.md`, `OPERATIONS.md`, `SQL.md`, `HTML.md`, `CSS.md`, `YAML.md`, plus `naming/<LANGUAGE>.md` for each except YAML | the language preset                    |
| runtime    | `runtime/<name>/`                       | `NODE.md`, `BUN.md`, `DENO.md`, `BROWSER.md`, `WORKERS.md`                                                                                                                                                                                                                             | detected runtime                       |
| framework  | `framework/<name>/`                     | `NEXTJS.md` with `SECURITY.md`, `REACT.md`, `EXPRESS.md` with `API.md` and `OPENAPI.md`, `FASTAPI.md` with `RUNTIME.md`, `SWIFTUI.md`, `UIKIT.md`                                                                                                                                      | the framework preset                   |
| library    | `library/<name>/`                       | `ZOD.md`, `DRIZZLE.md`, `TRPC.md`, `TANSTACKQUERY.md`, `ZUSTAND.md`, `REACTHOOKFORM.md`, `NEXTINTL.md`                                                                                                                                                                                 | the library preset                     |
| tool       | `tool/<name>/`                          | `DOCKER.md`, `NGINX.md`, `VITEST.md`, `PLAYWRIGHT.md`, `GITHUB-ACTIONS.md`, `XCODE.md`, `XCTEST.md` (owed with the xctest preset), `TAILWIND.md`, `COMMITLINT.md`, `TASKS.md`                                                                                                          | the tool preset                        |
| platform   | `platform/supabase/`                    | `SUPABASE.md`                                                                                                                                                                                                                                                                          | the platform preset                    |
| database   | `database/postgres/`                    | `POSTGRES.md`                                                                                                                                                                                                                                                                          | the database preset                    |
| shared     | `shared/`                               | `http/HTTP.md`, `i18n/I18N.md`                                                                                                                                                                                                                                                         | any preset that lists the shared block |
| repository | `repository/static-site/`               | `STATIC-SITE.md`                                                                                                                                                                                                                                                                       | the repository preset                  |
| templates  | `templates/docs/`, `templates/project/` | document templates; project architecture templates                                                                                                                                                                                                                                     | offered once at init, never upgraded   |
| project    | the repository's own                    | whatever the team writes                                                                                                                                                                                                                                                               | never written by gspot                 |

Each preset manifest names its files under `[rule_files]`. A file belongs to exactly one preset.

The agent layer tells the agent how to work in a repository; the code and prose layers say
what the code and text must look like. The split matters because the agent files are installed
unconditionally and the code files per preset.

## Project templates

The merge left out one team's architecture on purpose. That material still has value to the
team that wrote it, so it ships as templates under `templates/project/`. `gspot init --project-templates` or `gspot apply --project-templates` copies the ones that match
the selection into the repository's project layer once. gspot never upgrades a project file. The
copy opens with `<!-- gspot-template: IOS-ARCHITECTURE 0.4.0 -->`, so `upgrade --check` can report
that the template changed upstream; merging is the person's choice.

| Template                  | Content                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IOS-ARCHITECTURE.md`     | MVVM with Clean Architecture boundaries: layers and dependency direction, feature organization, ViewModels, domain layer, use cases, repositories, DTOs and mapping, dependency injection and scoped factories, protocols, state management, navigation and coordinators, services and platform boundaries, networking |
| `API-ARCHITECTURE.md`     | the Express modular monolith: ownership map, module boundaries, endpoint structure, entry points, domain logic, cross-module calls, data access, provider integrations, configuration and environment, production operations, nginx and runtime, performance                                                           |
| `DOCKER-ML.md`            | image stack ownership, build contexts, CUDA base images, dependency inputs, Python and shell inside images, models and artifacts, Hugging Face downloads                                                                                                                                                               |
| `SUPABASE-DEPLOYMENT.md`  | the scripted remote deployment flow and its order                                                                                                                                                                                                                                                                      |
| `INFERENCE-VOCABULARY.md` | engine, quantization, scenario and metric names for a model-serving repository                                                                                                                                                                                                                                         |

## What the merge dropped and the repair restored

A heading comparison between the four source corpora and the merged corpus found general
content with no counterpart. The repair pass restored each into the file named.

| Restored                                                                                         | Into                                                                                                                    |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Docker: image stack ownership, build contexts, CUDA, models, Hugging Face downloads              | `templates/project/DOCKER-ML.md`; layering and cache discipline was already in `tool/docker/DOCKER.md`                  |
| Swift: networking and API clients                                                                | `language/SWIFT.md` (the neutral rules) and `templates/project/IOS-ARCHITECTURE.md` (the layered version)               |
| General: verification and tests policy, once                                                     | `general/agent/WORKING.md`                                                                                              |
| Static site: boundaries, build, routes, HTML, CSS and content naming, tests, and fixtures naming | `repository/static-site/STATIC-SITE.md`, `language/naming/HTML.md`, `language/naming/CSS.md`, `general/code/TESTING.md` |
| The iOS and API architecture, Supabase deployment, inference vocabulary                          | `templates/project/`                                                                                                    |

Both guards are clean as of 2026-09-18. The completeness check counted 7,616 source statements: 6,443 matched exactly or as duplicates, 255 at the fuzzy ratio, 354 listed in `DROPPED.md`, and 564 with a recorded reason. The reasons include the 48 statements the prose pass split into shorter ones. None was unresolved, and the check and its records were retired once that state was reached (D-70).

Vale with the thirty `gspot` rules reports no findings over the 98 files. That pass changed 379 headings to sentence case, split 64 long list items and 28 long sentences and paragraphs, and stated 63 conditional modals as facts, with no rule dropped. Phase 6 owed code, not editing: the assembler and the corpus lint inside the binary, both under `packages/cli/src/rules/` now.

The guard was mechanical: a completeness check normalized every statement (sentence or list item) in the four source corpora. Each had to appear in the merged corpus or a project template, or be listed in `rules/DROPPED.md` with a reason. The check ran in the gate of this repository until the state above was reached, then retired with its records (D-70).

## Layer boundary

The general and language layers carry no architecture. The framework, library, tool, platform
and database layers carry only what the thing itself dictates: the App Router layout because
`create-next-app` produces it, `supabase/migrations/` because the CLI produces it. Ownership maps,
layer names, deployment topology and product vocabulary belong to the project layer, which the
team writes and gspot never touches.

The corpus lint enforces the boundary with a word list per layer. A general or language file that names a directory layout, a service tier or a deployment target fails the corpus lint in this repository.

## Repair pass

The first editorial pass is done. The corruption residue is gone, the twelve cross-file contradictions are resolved, and the "only when the user asks" statements are one sentence in `WORKING.md`. The Express API and next-intl content is re-homed, the SQL examples match the SQL casing rule, and the cross-language casing decisions are written in `general/code/NAMING.md`. The missing general, language, and tool files exist. Each remaining item is a check in the gate of this repository, so the corpus cannot regress.

| Defect                                                                                                                                                                                                                                          | Fix                                                                                                                                                                                                      | Guard                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Six global substitutions damaged the source forks: `control` became `command`, `object` became `item`, `dynamic` became `configured`, `custom` became `project`, `package manager` became `package coordinator`, `base64` became `encodedBytes` | Read every file for the phrases (`access command`, `command flow`, `inversion of command`, `z.item(`, `configured SQL`, `configured import`, `package coordinator`, `encodedBytes`) and restore the word | Vale `gspot.corruption` existence rule over the corpus with those phrases                           |
| 154 uses of `should`, plus `may`, `might`, `could`, `would`                                                                                                                                                                                     | Rewrite as an imperative or a statement of fact                                                                                                                                                          | Vale `gspot.modals`                                                                                 |
| Title Case in H2 and below                                                                                                                                                                                                                      | Sentence case                                                                                                                                                                                            | Vale `gspot.headings`                                                                               |
| Cross-file pointers (`see NAMING.md`)                                                                                                                                                                                                           | Restate the one sentence the block needs                                                                                                                                                                 | corpus lint: no link to another rule file                                                           |
| The same rule stated in two layers                                                                                                                                                                                                              | Keep the lower layer's copy                                                                                                                                                                              | corpus lint: duplicate statement detection on normalized sentences                                  |
| `DOCS.md` at 2,990 lines restates formatter and markdownlint decisions                                                                                                                                                                          | Cut to what an agent needs before the linter runs; the tools own the rest                                                                                                                                | size ceiling per file, 800 lines, with `DOCS.md`, `PYTHON.md`, `BASH.md` and `FASTAPI.md` baselined |
| Rules that name a reference repository's paths or products                                                                                                                                                                                      | Replace with the concept                                                                                                                                                                                 | Vale `gspot.file-paths`, `integrity/stale-paths`                                                    |

The pass is editorial work and lands in its own commits, one file at a time, each with the
Vale run clean for that file.

## Front matter

Every rule file opens with front matter the lint verifies against the path:

```yaml
---
layer: language          # agent | code | prose | language | runtime | framework | library | tool | platform | database | shared | repository | template
preset: python           # the preset page that installs it; none for templates
title: Python            # equals the H1
---
```

## Rules say nothing about tooling

A rule file states the rule and nothing else. It names no check, no tool, no enforcement state
(D-73), and not gspot (D-81). Where a rule needs the idea, it names the checks of the
repository and nothing more specific. A person who installs the rule files alone reads nothing about a tool they do not
have. The corpus lint fails on `gspot` and on the name of any tool a preset pins, outside a code
fence. What the gate enforces is the ledger's business ([06-enforcement-ledger.md](06-enforcement-ledger.md)), not the reader's.

## Size

No file exceeds 800 lines. A file that grows past the ceiling is split into siblings under the
same preset (`language/python/TYPING.md` beside `language/PYTHON.md`), each self-contained, each
opening with one sentence that names its siblings by title. Templates are project files and are
not measured.

## Assembly

`gspot apply`, when `[rules] install = true`:

1. Selects the files for the selected presets, root, and every scope.
2. Writes them under `[rules] directory` (default `.gspot/rules/`), keeping the layer folders.
3. Removes files under that directory that no selected preset installs.
4. Writes one managed block into `CLAUDE.md` and `AGENTS.md`, creating the files when absent:

```markdown
<!-- >>> gspot managed >>> -->
# Engineering guidelines

Read `.gspot/rules/general/agent/WORKING.md` and `.gspot/rules/general/prose/WRITING.md` first. Then read
the guides for the files you change. A more specific layer wins over a general one.

| Area | Guide |
| --- | --- |
| Naming, files and directories | `.gspot/rules/general/code/NAMING.md` |
| Comments and documentation | `.gspot/rules/general/code/COMMENTS.md`, `.gspot/rules/general/prose/DOCS.md` |
| TypeScript | `.gspot/rules/language/TYPESCRIPT.md`, `.gspot/rules/language/naming/TYPESCRIPT.md` |
| Bash, hooks and tasks | `.gspot/rules/language/BASH.md` |
| Next.js | `.gspot/rules/framework/nextjs/NEXTJS.md`, `.gspot/rules/framework/react/REACT.md` |
| Zod | `.gspot/rules/library/zod/ZOD.md` |
| Project rules | `rules/project/` |

Run `gspot check --staged` before committing. Change policy with `gspot set`, `gspot allow` or
`gspot ignore` (or by editing `gspot.toml`), then `gspot apply`; never edit files under `.gspot/`. Do not use subagents or parallel agents unless asked in the conversation.
<!-- <<< gspot managed <<< -->
```

The closing paragraph depends on what is installed (D-81). With at least one check selected it
reads as above. With rule files alone (`presets = []`) it keeps only the sentence about
subagents, and adds: "These files are installed copies. Change `[rules]` in `gspot.toml` and run
`gspot apply`, and never edit files under the rules directory."

`[rules] exclude` leaves files out. An entry is a file path under the corpus
(`general/code/ACCESSIBILITY.md`) or a layer folder (`library`). An entry that matches no corpus
file fails the load with the near matches. `general/agent/WORKING.md` and
`general/prose/WRITING.md` cannot be excluded while the block tells the reader to open them first.

The block is regenerated on every `apply`; text outside the markers is never read or moved. The
table lists layers by area, names each file, and states precedence. When the repository has a
project rule directory (`[rules] project = "rules/project"`), the block links it last.

## Corpus lint

The corpus lint belongs to this repository, not to the binary's commands (D-86). It runs as the
`[[check]]` entry `corpus/lint` in this repository's `gspot.toml`, at the commit stage, over
`rules/**`. `gspot apply --check` in another repository reports drift and nothing else. The word
lists below live beside the script under `packages/cli/corpus-lint/` and are not embedded:

- Front matter present; layer matches the path; preset is an id or `none`; title equals the H1.

- No file links to another rule file.
- No file exceeds 800 lines.
- The layer boundary word list holds in agent, code, prose and language files: no reference
  repository, product, layout path, or deployment target outside code formatting.
- Every fenced code block has a language tag from the allowed set and is closed.
- The corruption phrase list from the repair pass returns nothing.
- No file names gspot or a pinned tool outside a code fence.
- Vale with the `gspot` style under `prose/styles/gspot/` (30 rules, every alert an error) when
  the binary is installed.

## Completeness

The four source rule corpora were checked against the merged corpus statement by statement while the merge ran. Every statement had to survive in `rules/`, in the templates, or in a list
of dropped statements with a reason. The state recorded above is the final one, and the check
retired with the source corpora (D-70).

## What the corpus does not do

- It does not describe the linters' configuration. The tools own their options; the rule says
  the intent and names the check.
- It does not enumerate directories. Layout belongs to the project layer.
- It does not tell an agent to run commands the gate already runs. It says: run `gspot check
--staged`.
