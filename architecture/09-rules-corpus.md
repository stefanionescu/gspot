# Rules Corpus

This document decides the agent rule files: their layers, how they are assembled into a
repository, how the merged corpus is repaired before it ships, and how each rule links to the
check that enforces it.

## What ships

The corpus is Markdown an agent reads before editing. It lives in `reference-rules/merged/`,
arranged by layer:

| Layer | Directory | Files | Installed when |
| --- | --- | --- | --- |
| agent | `general/agent/` | `WORKING.md`, `PLANNING.md`, `TALKING.md`, `GIT.md`, `SUPPRESSIONS.md` | always |
| code | `general/code/` | `NAMING.md`, `NAMING-FILES.md`, `COMMENTS.md`, `ERRORS.md`, `LOGGING.md`, `TESTING.md`, `SECRETS.md`, `SECURITY.md`, `CONFIGURATION.md`, `DEPENDENCIES.md`, `GENERATED.md`, `ACCESSIBILITY.md`, `CLI.md` | always |
| prose | `general/prose/` | `WRITING.md`, `DOCS.md`, `DOCS-FORMAT.md`, `DOCS-CONTENT.md`, `DOCS-MEDIA.md`, `DOCS-SURFACES.md`, `DOCS-REVIEW.md` | always |
| language | `language/` | `TYPESCRIPT.md`, `JAVASCRIPT.md`, `PYTHON.md` with `python/TYPING.md`, `DESIGN.md`, `FLOW.md`, `PACKAGING.md`, `SWIFT.md`, `BASH.md` with `bash/LANGUAGE.md`, `SAFETY.md`, `OPERATIONS.md`, `SQL.md`, `HTML.md`, `CSS.md`, `YAML.md`, plus `naming/<LANGUAGE>.md` for each except YAML | the language preset |
| runtime | `runtime/<name>/` | `NODE.md`, `BUN.md`, `DENO.md`, `BROWSER.md`, `WORKERS.md` | detected runtime |
| framework | `framework/<name>/` | `NEXTJS.md` with `SECURITY.md`, `REACT.md`, `EXPRESS.md` with `API.md` and `OPENAPI.md`, `FASTAPI.md` with `RUNTIME.md`, `SWIFTUI.md`, `UIKIT.md` | the framework preset |
| library | `library/<name>/` | `ZOD.md`, `DRIZZLE.md`, `TRPC.md`, `TANSTACKQUERY.md`, `ZUSTAND.md`, `REACTHOOKFORM.md`, `NEXTINTL.md` | the library preset |
| tool | `tool/<name>/` | `DOCKER.md`, `NGINX.md`, `VITEST.md`, `PLAYWRIGHT.md`, `GITHUB-ACTIONS.md`, `XCODE.md`, `TAILWIND.md`, `COMMITLINT.md`, `TASKS.md` | the tool preset |
| platform | `platform/supabase/` | `SUPABASE.md` | the platform preset |
| database | `database/postgres/` | `POSTGRES.md` | the database preset |
| shared | `shared/` | `http/HTTP.md`, `i18n/I18N.md` | any preset that lists the shared block |
| repository | `repository/static-site/` | `STATIC-SITE.md` | the repository preset |
| templates | `templates/docs/`, `templates/project/` | document templates; project architecture templates | offered once at init, never upgraded |
| project | the repository's own | whatever the team writes | never written by gspot |

Each preset manifest names its files under `[rules]`. A file belongs to exactly one preset.

The agent layer tells the agent how to work in a repository; the code and prose layers say
what the code and text must look like. The split matters because the agent files are installed
unconditionally and the code files per preset.

## Project templates

The merge left out one team's architecture on purpose. That material still has value to the
team that wrote it, so it ships as templates under `templates/project/`, and
`gspot init --project-templates` or `gspot sync --project-templates` copies the ones that match
the selection into the repository's project layer once. gspot never upgrades a project file. The
copy opens with `<!-- gspot-template: IOS-ARCHITECTURE 0.4.0 -->`, so `upgrade --check` can report
that the template changed upstream; merging is the person's choice.

| Template | Content |
| --- | --- |
| `IOS-ARCHITECTURE.md` | MVVM with Clean Architecture boundaries: layers and dependency direction, feature organization, ViewModels, domain layer, use cases, repositories, DTOs and mapping, dependency injection and scoped factories, protocols, state management, navigation and coordinators, services and platform boundaries, networking |
| `API-ARCHITECTURE.md` | the Express modular monolith: ownership map, module boundaries, endpoint structure, entry points, domain logic, cross-module calls, data access, provider integrations, configuration and environment, production operations, nginx and runtime, performance |
| `DOCKER-ML.md` | image stack ownership, build contexts, CUDA base images, dependency inputs, Python and shell inside images, models and artifacts, Hugging Face downloads |
| `SUPABASE-DEPLOYMENT.md` | the scripted remote deployment flow and its order |
| `INFERENCE-VOCABULARY.md` | engine, quantization, scenario and metric names for a model-serving repository |

## What the merge dropped and the repair restored

A heading comparison between the four source corpora and the merged corpus found general
content with no counterpart. The repair pass restored each into the file named.

| Restored | Into |
| --- | --- |
| Docker: image stack ownership, build contexts, CUDA, models, Hugging Face downloads | `templates/project/DOCKER-ML.md`; layering and cache discipline was already in `tool/docker/DOCKER.md` |
| Swift: networking and API clients | `language/SWIFT.md` (the neutral rules) and `templates/project/IOS-ARCHITECTURE.md` (the layered version) |
| General: verification and tests policy, once | `general/agent/WORKING.md` |
| Static site: boundaries, build, routes, HTML, CSS and content naming, tests and fixtures naming | `repository/static-site/STATIC-SITE.md`, `language/naming/HTML.md`, `language/naming/CSS.md`, `general/code/TESTING.md` |
| The iOS and API architecture, Supabase deployment, inference vocabulary | `templates/project/` |

The completeness check below is clean as of 2026-09-18: 7,616 source statements, 6,551 matched
exactly or as duplicates, 220 matched at the fuzzy ratio, 490 listed in `DROPPED.md`, 355
dropped with a recorded reason (292 decisions, 38 restatements, 17 superseded, 8 owned by a
formatter), none unresolved. The reasons live in `reference-rules/DROPPED.md` and
`reference-rules/lint/dropped-manual.json`. What Phase 6 still owes is code, not editing: the
assembler, the corpus lint inside the binary, and a Vale run in the gate.

The guard is mechanical: a completeness check normalises every statement (sentence or list
item) in the four source corpora and asserts it appears in the merged corpus or a project
template, or is listed in `rules/DROPPED.md` with a reason. The check runs in gspot's own gate
until the four repositories have migrated, then the source corpora are removed.

## Layer boundary

The general and language layers carry no architecture. The framework, library, tool, platform
and database layers carry only what the thing itself dictates: the App Router layout because
`create-next-app` produces it, `supabase/migrations/` because the CLI produces it. Ownership maps,
layer names, deployment topology and product vocabulary belong to the project layer, which the
team writes and gspot never touches.

The corpus lint enforces the boundary with a word list per layer: a general or language file that
names a directory layout, a service tier or a deployment target fails the corpus lint in gspot's
own repository.

## Repair pass

The first editorial pass is done: the corruption residue is gone, the twelve cross-file
contradictions are resolved, the "only when the user asks" statements are one sentence in
`WORKING.md`, the Express API and next-intl content is re-homed, the SQL examples match the SQL
casing rule, the cross-language casing decisions are written in `general/code/NAMING.md`, and
the missing general, language and tool files exist. Each remaining item is a check in gspot's
own gate so the corpus cannot regress.

| Defect | Fix | Guard |
| --- | --- | --- |
| Six global substitutions damaged the source forks: `control` became `command`, `object` became `item`, `dynamic` became `configured`, `custom` became `project`, `package manager` became `package coordinator`, `base64` became `encodedBytes` | Read every file for the phrases (`access command`, `command flow`, `inversion of command`, `z.item(`, `configured SQL`, `configured import`, `package coordinator`, `encodedBytes`) and restore the word | Vale `gspot.corruption` existence rule over the corpus with those phrases |
| 154 uses of `should`, plus `may`, `might`, `could`, `would` | Rewrite as an imperative or a statement of fact | Vale `gspot.modals` |
| Title Case in H2 and below | Sentence case | Vale `gspot.headings` |
| Cross-file pointers (`see NAMING.md`) | Restate the one sentence the block needs | corpus lint: no link to another rule file |
| The same rule stated in two layers | Keep the lower layer's copy | corpus lint: duplicate statement detection on normalised sentences |
| `DOCS.md` at 2,990 lines restates formatter and markdownlint decisions | Cut to what an agent needs before the linter runs; the tools own the rest | size ceiling per file, 800 lines, with `DOCS.md`, `PYTHON.md`, `BASH.md` and `FASTAPI.md` baselined |
| Rules that name a reference repository's paths or products | Replace with the concept | Vale `gspot.file-paths`, `integrity/stale-paths` |

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

## Enforcement markers

Every rule statement (a list item, or a paragraph that opens with an imperative) ends with a
marker. An item that ends with a colon introduces the statements under it and carries none.
Tables, code blocks, headings, explanatory prose, and templates carry none.

```markdown
- Do not use `enum`. Use a literal union or an `as const` object. `enforced-by: typescript/eslint no-restricted-syntax`
- Prefer duplication over the wrong abstraction. `unenforced`
```

The check id before the space is one the architecture names (`reference-rules/lint/check-ids.txt`,
generated from this folder); the words after it name the rule inside that check. The marker is
written by `reference-rules/lint/mark-statements.ts` from `enforcement-map.json` (file glob,
pattern, check) and hand-corrected; `unenforced.json` records the count per file, and the count
rises only with a reason in the commit. The marker renders as small text in the installed file so
an agent sees which rules the gate backs.

## Size

No file exceeds 800 lines. A file that grows past the ceiling is split into siblings under the
same preset (`language/python/TYPING.md` beside `language/PYTHON.md`), each self-contained, each
opening with one sentence that names its siblings by title. Templates are project files and are
not measured.

## Assembly

`gspot sync`, when `[rules] install = true`:

1. Selects the files for the selected presets, root and every scope.
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
`gspot ignore` (or by editing `gspot.toml`), then `gspot sync`; never edit files under `.gspot/`. Do not use subagents or parallel agents unless asked in the conversation.
<!-- <<< gspot managed <<< -->
```

The block is regenerated on every `sync`; text outside the markers is never read or moved. The
table lists layers by area, names each file, and states precedence. When the repository has a
project rule directory (`[rules] project = "rules/project"`), the block links it last.

## Corpus lint

`bun reference-rules/lint/corpus-lint.ts` runs on every change to the corpus (and moves into
gspot's own gate with the CLI):

- Front matter present; layer matches the path; preset names a preset page; title equals the H1.
- Every `enforced-by` names a check id in `check-ids.txt`.
- No file links to another rule file.
- No file exceeds 800 lines.
- The layer boundary word list holds in agent, code, prose and language files: no reference
  repository, product, layout path or deployment target outside code formatting.
- Every fenced code block has a language tag from the allowed set and is closed.
- The corruption phrase list from the repair pass returns nothing.
- Vale with the `gspot` style under `reference-rules/lint/vale/` (30 rules, every alert an
  error) when the binary is installed.

`bun reference-rules/lint/mark-statements.ts --check` reports statements without a marker and
unknown ids.

## Completeness

`bun reference-rules/lint/completeness-check.ts` reads the four source `rules/` folders,
normalises every list item (lowercase, punctuation stripped, the six corrupted words restored),
and requires each to match a corpus or template statement, heading or sentence exactly, at a
word-bigram ratio of 0.85, or at a word-set overlap of 0.8, or to be listed in
`reference-rules/DROPPED.md` with a reason. `--write-dropped` appends the reasons the script can
prove: a duplicate of a kept statement, a review-checklist question, a project-specific path or
product, a statement a recorded decision superseded, or formatting a tool owns. The remaining
reasons are written by hand. The check runs until the four repositories have migrated, then the
source corpora are removed.

## What the corpus does not do

- It does not describe the linters' configuration. The tools own their options; the rule says
  the intent and names the check.
- It does not enumerate directories. Layout belongs to the project layer.
- It does not tell an agent to run commands the gate already runs. It says: run `gspot check
  --staged`.
