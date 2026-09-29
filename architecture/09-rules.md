# Guides Corpus

This document decides the agent guide files: their layers, how they are assembled into a repository, and what the guides lint of this repository holds them to.

## What ships

The corpus is Markdown an agent reads before editing. It lives in `packages/cli/guides/`,
arranged by layer:

| Layer      | Directory                 | Files                                                                                                                                                                                                                  | Installed when                       |
| ---------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| agent      | `general/agent/`          | `WORKING.md`, `PLANNING.md`, `TALKING.md`, `GIT.md`, `SUPPRESSIONS.md`                                                                                                                                                 | always                               |
| code       | `general/code/`           | `NAMING.md`, `NAMING-FILES.md`, `COMMENTS.md`, `ERRORS.md`, `LOGGING.md`, `TESTING.md`, `SECRETS.md`, `SECURITY.md`, `CONFIGURATION.md`, `DEPENDENCIES.md`, `GENERATED.md`, `ACCESSIBILITY.md`, `CLI.md`               | always                               |
| prose      | `general/prose/`          | `WRITING.md`, `DOCS.md`, `DOCS-FORMAT.md`, `DOCS-CONTENT.md`, `DOCS-MEDIA.md`, `DOCS-SURFACES.md`, `DOCS-REVIEW.md`                                                                                                    | always                               |
| language   | `language/`               | `TYPESCRIPT.md`, `JAVASCRIPT.md`, `PYTHON.md` with its `python/` siblings, `SWIFT.md`, `BASH.md` with its `bash/` siblings, `SQL.md`, `HTML.md`, `CSS.md`, `YAML.md`, plus `naming/<LANGUAGE>.md` for each except YAML | the language kit                     |
| runtime    | `runtime/<name>/`         | `NODE.md`, `BUN.md`, `DENO.md`, `BROWSER.md`, `WORKERS.md`                                                                                                                                                             | detected runtime                     |
| framework  | `framework/<name>/`       | `NEXTJS.md` with `SECURITY.md`, `REACT.md`, `EXPRESS.md` with `API.md` and `OPENAPI.md`, `FASTAPI.md` with `RUNTIME.md`, `SWIFTUI.md`, `UIKIT.md`                                                                      | the framework kit                    |
| library    | `library/<name>/`         | `ZOD.md`, `DRIZZLE.md`, `TRPC.md`, `TANSTACKQUERY.md`, `ZUSTAND.md`, `REACTHOOKFORM.md`, `NEXTINTL.md`                                                                                                                 | the library kit                      |
| tool       | `tool/<name>/`            | `DOCKER.md`, `NGINX.md`, `VITEST.md`, `PLAYWRIGHT.md`, `GITHUB-ACTIONS.md`, `XCODE.md`, `XCTEST.md`, `TAILWIND.md`, `COMMITLINT.md`, `TASKS.md`                                                                        | the tool kit                         |
| platform   | `platform/supabase/`      | `SUPABASE.md`                                                                                                                                                                                                          | the platform kit                     |
| database   | `database/postgres/`      | `POSTGRES.md`                                                                                                                                                                                                          | the database kit                     |
| shared     | `shared/`                 | `HTTP.md`, `I18N.md`                                                                                                                                                                                                   | any kit that lists the shared block  |
| repository | `repository/static-site/` | `STATIC-SITE.md`                                                                                                                                                                                                       | the repository kit                   |
| templates  | `templates/docs/`         | document templates                                                                                                                                                                                                     | offered once at init, never upgraded |
| project    | the repository's own      | whatever the team writes                                                                                                                                                                                               | never written by gspot               |

Each kit manifest names its files under `[guides]`. A source file has one owner; several kits can select shared guidance without copying it.

The agent layer tells the agent how to work in a repository; the code and prose layers say
what the code and text must look like. The general layers are installed whenever guides are.
Other layers follow kit selection; installation does not make every guide required reading
for every task.

## Layer boundary

The general and language layers carry no architecture. The framework, library, tool, platform
and database layers carry only what the thing itself dictates: the App Router layout because
`create-next-app` produces it, `supabase/migrations/` because the CLI produces it. Ownership maps,
layer names, deployment topology and product vocabulary belong to the project layer, which the
team writes and gspot never touches. A guide about one product belongs to that product's
repository, listed in its own agent file outside the managed block.

The guides lint enforces the boundary with a word list per layer. A general or language file that names a directory layout, a service tier, or a deployment target fails it.

## What a guide says

A guide states the rule and nothing else. It names no check and no enforcement state. It does
not name gspot, an engine of gspot, or a key of `gspot.toml`, and it does not say that anything
is enforced. A guide may name a tool as a standard, such as a script that passes ShellCheck, or
as its subject, such as a suppression comment. A person who installs the guides alone reads
nothing about a setup they do not have.

A rule a linter reports is one line that names the rule. The guide keeps the rules no tool
enforces, and explains the decision behind them. It does not describe the linters'
configuration, does not enumerate directories, and does not tell an agent to run commands the
gate already runs. It says to run `gspot check --staged`.

Every list item is a whole sentence. A section that describes checks of the level `all`
carries the mark `<!-- level: all -->`, and the assembler leaves it out at `recommended`. A
guide never asks for what a check of the same kit refuses.

## Front matter

Every guide opens with front matter the lint verifies against the path:

```yaml
---
layer: language          # agent | code | prose | language | runtime | framework | library | tool | platform | database | shared | repository | template
kit: python              # the kit that installs it; none for templates
title: Python            # equals the H1
---
```

## Size

No guide exceeds 250 lines. A guide that grows past the ceiling is cut to the rules no tool
enforces before it is split. A split into siblings under the same kit needs distinct reader
tasks. Templates are project files and are not
measured.

## Assembly

`gspot apply`, when `[guides] install = true`:

1. Selects the files for the selected kits, root, and every scope.
2. Writes them under `[guides] directory` (default `.gspot/guides/`), keeping the layer folders.
3. Removes files under that directory that no selected kit installs.
4. Writes the shared managed block into `AGENTS.md`, supported detected agent files, and
   additional files configured in `[guides] agents`:

```markdown
<!-- >>> gspot managed >>> -->
# Engineering guidelines

Read `.gspot/guides/general/agent/WORKING.md` and `.gspot/guides/general/prose/WRITING.md` first. Then read
only the guides relevant to the task and files you change. A more specific layer wins over a general one.

- Naming: `.gspot/guides/general/code/NAMING.md`
- Comments: `.gspot/guides/general/code/COMMENTS.md`
- Documentation: `.gspot/guides/general/prose/DOCS.md`
- TypeScript: `.gspot/guides/language/TYPESCRIPT.md`
- TypeScript naming: `.gspot/guides/language/naming/TYPESCRIPT.md`
- Bash: `.gspot/guides/language/BASH.md`
- Next.js: `.gspot/guides/framework/nextjs/NEXTJS.md`
- React: `.gspot/guides/framework/react/REACT.md`
- Zod: `.gspot/guides/library/zod/ZOD.md`

Run `gspot check --staged` before committing. Change policy with `gspot set` or
`gspot ignore` (or by editing `gspot.toml`), then `gspot apply`; never edit files under `.gspot/`. Do not use subagents or parallel agents unless asked in the conversation.
<!-- <<< gspot managed <<< -->
```

The closing paragraph depends on what is installed. With at least one check selected it
reads as above. With guides alone (`kits = []`) it keeps only the sentence about
subagents, and adds: "These files are installed copies. Change `[guides]` in `gspot.toml` and run
`gspot apply`, and never edit files under the guides directory."

`AGENTS.md` is always written, because most agents read it. `CLAUDE.md`, `GEMINI.md`, and
`.github/copilot-instructions.md` get a managed block where the file exists or the person names
it under `[guides] agents`. Cursor gets `.cursor/rules/gspot.mdc` where `.cursor/` exists. Every
block holds the same list, and `uninstall` removes them all.

`[guides] exclude` leaves files out. An entry is a file path under the corpus
(the accessibility guide of the code layer) or a layer folder (`library`). An entry that matches no corpus
file fails the load with the near matches. The working and writing guides cannot be excluded
while the block tells the reader to open them first.

The block is written again on every `apply`, and text outside the markers is never read or moved.
The block is a compact task index with one guide per entry, grouped where that helps selection.

## The guides lint

The guides lint belongs to this repository, not to the commands of the binary. It runs as the
`[[check]]` entry `guides/lint` in the `gspot.toml` of this repository, at the push stage, over
`packages/cli/guides/**` and its implementation and test owners. Its code sits in
`packages/cli/src/agents/`. Prose is no part of it: `prose/vale` reads the guides like every
other text.

- Front matter holds `layer`, `kit`, and `title`. The layer agrees with the path and the title
  agrees with the H1.
- Kit-specific files have a manifest owner. General agent, code, and prose files belong to the
  general corpus.
- No file links to another guide, and no file exceeds 250 lines.
- A list item is a whole sentence. An item that stops at a comma or at `and` fails.
- A section marked `<!-- level: all -->` is left out at `recommended`. A unit test assembles
  `TYPESCRIPT.md` at both levels and compares the headings.
- A fenced example under a line that starts with `Good` passes the linter of its kit. The lint
  runs those examples at the push stage.
- No file names a tool or a library of another kit. The word list is built from the manifests.
- A rule name a guide names agrees with the template of its kit: the lint fails where the
  template turns that rule the other way.
