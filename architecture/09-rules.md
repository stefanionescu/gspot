# Rules Corpus

This document decides the agent rule files: their layers and how they are assembled into a repository. It defines relevant instructions, selection, and validation; remaining work owns repair status.

## What ships

The corpus is Markdown an agent reads before editing. It lives in `rules/`,
arranged by layer:

| Layer      | Directory                 | Files                                                                                                                                                                                                                                                                                  | Installed when                         |
| ---------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| agent      | `general/agent/`          | `WORKING.md`, `PLANNING.md`, `TALKING.md`, `GIT.md`, `SUPPRESSIONS.md`                                                                                                                                                                                                                 | always                                 |
| code       | `general/code/`           | `NAMING.md`, `NAMING-FILES.md`, `COMMENTS.md`, `ERRORS.md`, `LOGGING.md`, `TESTING.md`, `SECRETS.md`, `SECURITY.md`, `CONFIGURATION.md`, `DEPENDENCIES.md`, `GENERATED.md`, `ACCESSIBILITY.md`, `CLI.md`                                                                               | always                                 |
| prose      | `general/prose/`          | `WRITING.md`, `DOCS.md`, `DOCS-FORMAT.md`, `DOCS-CONTENT.md`, `DOCS-MEDIA.md`, `DOCS-SURFACES.md`, `DOCS-REVIEW.md`                                                                                                                                                                    | always                                 |
| language   | `language/`               | `TYPESCRIPT.md`, `JAVASCRIPT.md`, `PYTHON.md` with `python/TYPING.md`, `DESIGN.md`, `FLOW.md`, `PACKAGING.md`, `SWIFT.md`, `BASH.md` with `bash/LANGUAGE.md`, `SAFETY.md`, `OPERATIONS.md`, `SQL.md`, `HTML.md`, `CSS.md`, `YAML.md`, plus `naming/<LANGUAGE>.md` for each except YAML | the language configuration                    |
| runtime    | `runtime/<name>/`         | `NODE.md`, `BUN.md`, `DENO.md`, `BROWSER.md`, `WORKERS.md`                                                                                                                                                                                                                             | detected runtime                       |
| framework  | `framework/<name>/`       | `NEXTJS.md` with `SECURITY.md`, `REACT.md`, `EXPRESS.md` with `API.md` and `OPENAPI.md`, `FASTAPI.md` with `RUNTIME.md`, `SWIFTUI.md`, `UIKIT.md`                                                                                                                                      | the framework configuration                   |
| library    | `library/<name>/`         | `ZOD.md`, `DRIZZLE.md`, `TRPC.md`, `TANSTACKQUERY.md`, `ZUSTAND.md`, `REACTHOOKFORM.md`, `NEXTINTL.md`                                                                                                                                                                                 | the library configuration                     |
| tool       | `tool/<name>/`            | `DOCKER.md`, `NGINX.md`, `VITEST.md`, `PLAYWRIGHT.md`, `GITHUB-ACTIONS.md`, `XCODE.md`, `XCTEST.md`, `TAILWIND.md`, `COMMITLINT.md`, `TASKS.md`                                                                                                                                        | the tool configuration                        |
| platform   | `platform/supabase/`      | `SUPABASE.md`                                                                                                                                                                                                                                                                          | the platform configuration                    |
| database   | `database/postgres/`      | `POSTGRES.md`                                                                                                                                                                                                                                                                          | the database configuration                    |
| shared     | `shared/`                 | `http/HTTP.md`, `i18n/I18N.md`                                                                                                                                                                                                                                                         | any configuration that lists the shared block |
| repository | `repository/static-site/` | `STATIC-SITE.md`                                                                                                                                                                                                                                                                       | the repository configuration                  |
| templates  | `templates/docs/`         | document templates                                                                                                                                                                                                                                                                     | offered once at init, never upgraded   |
| project    | the repository's own      | whatever the team writes                                                                                                                                                                                                                                                               | never written by gspot                 |

Each configuration manifest names its files under `[rule_files]`. A source file has one owner; multiple configurations can select shared guidance without copying it.

The agent layer tells the agent how to work in a repository; the code and prose layers say
what the code and text must look like. The general agent, code, and prose layers are installed when rules are enabled.
Other layers follow configuration selection; installation does not make every guide required reading
for every task.

## What belongs to one product

The merge left the architecture of one team out of the shipped rule files on purpose. A rule
file about one product belongs to that product, so gspot ships none (K-97). During the
migration of a reference repository, its material moves into that repository as rule files of
its own. yap-swift-app takes the iOS architecture, the API architecture, and the Supabase
deployment flow. yap-text-inference takes the Docker image stack and the inference vocabulary. A repository lists such files in its own agent file, outside the managed
block, and gspot lints them as it lints any Markdown.

The retired project templates remain in Git at `b553f9d`, under `rules/templates/project/`.
Use that revision as the source when carrying the relevant material into its owning repository.

## Layer boundary

The general and language layers carry no architecture. The framework, library, tool, platform
and database layers carry only what the thing itself dictates: the App Router layout because
`create-next-app` produces it, `supabase/migrations/` because the CLI produces it. Ownership maps,
layer names, deployment topology and product vocabulary belong to the project layer, which the
team writes and gspot never touches.

The corpus lint enforces the boundary with a word list per layer. A general or language file that names a directory layout, a service tier or a deployment target fails the corpus lint in this repository.

## Instruction relevance

Agent entry files are task indexes, not complete policy manuals. Keep the initial instructions
short: how to select relevant guides, how to change managed policy, and the required local gate.
Use readable lists or compact tables with one guide per entry. Do not pad every source line to
match a cell containing an entire layer's paths.

Keep general working and writing principles concise. Read detailed code, documentation, and
language guidance when the task touches that area. Do not require every change to read the full
general corpus. Remove repeated instructions, narrated history, tautological examples, and
formatting directions already owned by tools. Keep rules that explain a real decision.

Generate supported agent entry files from one selection. Preserve authored text outside managed
blocks. Separate files for separate agent integrations are valid; independently maintained copies
of their shared instructions are not. Update the generator and corpus, then use apply to refresh
installed copies. Never hand-edit `.gspot/` or generated blocks as the cleanup mechanism.

## Front matter

Every rule file opens with front matter the lint verifies against the path:

```yaml
---
layer: language          # agent | code | prose | language | runtime | framework | library | tool | platform | database | shared | repository | template
configuration: python           # the configuration page that installs it; none for templates
title: Python            # equals the H1
---
```

## Rules describe guidance independently of installation

A rule file states the rule and nothing else. It names no check and no enforcement state.
It does not name gspot, an engine of gspot, or a key of `gspot.toml`, and it does not say that
anything is enforced. Where a rule needs the idea, it names the checks of the repository.

A rule may name a tool as a standard, such as a script that passes ShellCheck, or as its subject,
such as a suppression comment. A person who installs the rule files alone reads nothing about a
setup they do not have. The rules lint of this repository fails on each of those patterns outside
inline code. What the gate enforces is the ledger's business ([06-enforcement-ledger.md](06-enforcement-ledger.md)), not the reader's.

## Size

No file exceeds 800 lines. A file that grows past the ceiling is split into siblings under the
same configuration (`language/python/TYPING.md` beside `language/PYTHON.md`) only when distinct reader
tasks justify the split. Remove repetition before splitting. Each guide states its own scope. Templates are project files and are
not measured.

## Assembly

`gspot apply`, when `[rules] install = true`:

1. Selects the files for the selected configurations, root, and every scope.
2. Writes them under `[rules] directory` (default `.gspot/rules/`), keeping the layer folders.
3. Removes files under that directory that no selected configuration installs.
4. Writes the shared managed block into `AGENTS.md`, supported detected agent files, and
   additional files configured in `[rules] agents`:

```markdown
<!-- >>> gspot managed >>> -->
# Engineering guidelines

Read `.gspot/rules/general/agent/WORKING.md` and `.gspot/rules/general/prose/WRITING.md` first. Then read
only the guides relevant to the task and files you change. A more specific layer wins over a general one.

- Naming: `.gspot/rules/general/code/NAMING.md`
- Comments: `.gspot/rules/general/code/COMMENTS.md`
- Documentation: `.gspot/rules/general/prose/DOCS.md`
- TypeScript: `.gspot/rules/language/TYPESCRIPT.md`
- TypeScript naming: `.gspot/rules/language/naming/TYPESCRIPT.md`
- Bash: `.gspot/rules/language/BASH.md`
- Next.js: `.gspot/rules/framework/nextjs/NEXTJS.md`
- React: `.gspot/rules/framework/react/REACT.md`
- Zod: `.gspot/rules/library/zod/ZOD.md`

Run `gspot check --staged` before committing. Change policy with `gspot set` or
`gspot ignore` (or by editing `gspot.toml`), then `gspot apply`; never edit files under `.gspot/`. Do not use subagents or parallel agents unless asked in the conversation.
<!-- <<< gspot managed <<< -->
```

The closing paragraph depends on what is installed. With at least one check selected it
reads as above. With rule files alone (`configurations = []`) it keeps only the sentence about
subagents, and adds: "These files are installed copies. Change `[rules]` in `gspot.toml` and run
`gspot apply`, and never edit files under the rules directory."

`[rules] exclude` leaves files out. An entry is a file path under the corpus
(`general/code/ACCESSIBILITY.md`) or a layer folder (`library`). An entry that matches no corpus
file fails the load with the near matches. `general/agent/WORKING.md` and
`general/prose/WRITING.md` cannot be excluded while the block tells the reader to open them first.

The block is written again on every `apply`, and text outside the markers is never read or moved.
The block is a compact task index with one guide per entry, grouped where that helps selection.

## The rules lint

The rules lint belongs to this repository, not to the commands of the binary. It runs as
the `[[check]]` entry `rules/lint` in the `gspot.toml` of this repository, at the commit stage,
over `rules/**`. Its code sits in `packages/cli/src/agents/`. Prose is no part of it: `prose/vale`
reads the rule files like every other text.

- Front matter holds `layer`, `configuration`, and `title`. The layer agrees with the path and the title
  agrees with the H1; do not require a metadata migration merely to remove a validated field.
- Configuration-specific files have a manifest owner. General agent, code, and prose files belong to
  the general corpus. Shared selection does not require duplicated source files.
- No file links to another rule file, and no file exceeds 800 lines.
- A list item is a whole sentence. An item that stops at a comma or at `and` fails.
- A section that describes checks of the level `all` carries the mark `<!-- level: all -->`, and
  the assembler leaves it out at `recommended`.
- A fenced example under a line that starts with `Good` passes the linter of its configuration. The lint
  runs those examples at the push stage.
- No file names a tool or a library of another configuration. The word list is built from the
  manifests. The words `quality/` and the names of the reference repositories are refused.
- Instruction policy agrees with the selected checks and levels. Check identifiers and
  implementation status belong in references and remaining work, not installed rule prose.

## What the corpus does not do

- It does not describe the linters' configuration. The tools own their options; the rule says
  the intent. Check identifiers belong in the generated reference.
- It does not enumerate directories. Layout belongs to the project layer.
- It does not tell an agent to run commands the gate already runs. It says: run `gspot check
--staged`.

## Acceptance contracts

These clauses specify required behavior. [Remaining work](22-remaining.md) owns status and evidence.

### Acceptance K-230

A section of a rule file carries the level of the checks it describes, and the
assembler leaves out a section above the level of the repository.

A heading line is followed by `<!-- level: all -->` where its rules are taste. The
assembler drops such a section at `recommended`. Keep mandatory trivial-function and trivial-file guidance at both levels. Validate level
selection against the policy owner without requiring check identifiers in rule prose. `REACT.md` names the file after its component.

A unit test assembles `TYPESCRIPT.md` at both levels and compares the headings.

### Acceptance S-10

The rules lint reads front matter, links, size, layer, and fences. Prose is one
check, `prose/vale`, for every text of the repository.

The `[[check]]` entry `rules/lint` of `gspot.toml` points at the new path and drops
the words about prose from its summary.

A rule file with a broken link fails `rules/lint`, and one with a long sentence fails
`prose/vale` only.

### Acceptance K-179

Selected manifests own rule-file selection and conditional inclusion. Reject missing listed assets. Preserve SwiftUI/UIKit, Tailwind, Playwright, and Bun detection where selected. Rule guides follow selected levels and exclusions; rules-only installation must not claim that checks were installed.

### Acceptance K-231

A language, framework, library, or tool file says what holds for every project of
that kind. A general file holds what holds for every repository.

A passage about one product moves into the repository it came from, during its
migration, as a rule file of that repository under `[rules] extra`. A habit of the owner moves
into the profile of the owner. A sentence that is wrong for most projects, such as the Drizzle
cutover rule, is deleted. The rules lint refuses the word `quality/` and the names of the
reference repositories.

`rules/lint` with the word list of K-38, which is built from the manifests.

### Acceptance K-65

Generate a compact task index with one guide per entry and no width padding. Include the
required check command and how policy changes. Keep general initial instructions short and
select detailed guidance by task. Verify selected paths, preserved authored text, readable source,
and idempotent regeneration. Do not assert a fixed guide inventory or snapshot byte quota.

### Acceptance K-67

Rule front matter holds `layer`, `configuration`, and `title`. Validate these against the actual owner,
path, and heading. The managed block derives its labels from validated metadata. Verify incorrect
metadata and corrected input; no field-removal migration or compatibility parser is required.

### Acceptance K-279

`[rules] agents` lists the agent files gspot writes into, detected from what exists.

`AGENTS.md` is always written, because most agents read it. `CLAUDE.md`,
`GEMINI.md`, and `.github/copilot-instructions.md` get a managed block where the file exists or
the person names it. Cursor gets `.cursor/rules/gspot.mdc`, a file with the mark, where
`.cursor/` exists. Every block holds the same list.

A planted repository with `.cursor/` and `GEMINI.md` holds all three, and `uninstall`
removes them.

### Acceptance K-229

Every list item of a rule file is a whole sentence.

The items are written whole from the reference repositories, which are read and not
changed. `lint.ts` reports a list item whose last line ends with a comma, with `and`, or with no full stop.

A unit test of the lint with one cut item.

### Acceptance K-241

A rule file never asks for what a check of the same configuration refuses.

Each of the nine is settled on the side of the decision or the check, and the rule
file changes. `explicit_acl` moves to the level `all` (row 11), and the rule file says so.

`src/agents/lint.ts` reads every rule name a rule file names, and fails where the template
of its configuration turns that rule the other way.

### Acceptance K-261

An example marked good passes the linter of its configuration.

`examples.ts` takes each fenced block under a line that starts with `Good`, writes it
to the cache, and runs the tool the manifest names for that language. The two zod rules move to
the level `all`.

`rules/lint` runs the examples at the push stage.

Structural prose follows the executable-statement contract in [07-slop-drift.md](07-slop-drift.md). Do not encourage tiny wrappers, arbitrary declaration splitting, or padding to satisfy a threshold. Required API functions use narrow, reasoned suppressions.
