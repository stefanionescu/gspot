# Rules: CLAUDE.md, AGENTS.md and rules/

Requirement R7: installable `CLAUDE.md`, `AGENTS.md` and `rules/`, selected by preset. Requirement
R10: no rule file dictates an architecture unless the framework itself does. Requirement R11: split
and clean the existing corpus.

## The corpus today: four forks

| File                              | yap-swift-app | yap-text-inference | yap-landing |   slopshop |
| --------------------------------- | ------------: | -----------------: | ----------: | ---------: |
| `GENERAL.md`                      |           349 |                355 |         329 |        177 |
| `NAMING.md`                       |         2,574 |                825 |         365 |        257 |
| `BASH.md`                         |         2,433 |              2,559 |       2,212 |      2,143 |
| `DOCUMENTATION.md`                |         4,088 |              4,154 |      absent |      4,068 |
| `PLANNING.md`                     |           157 |                157 |         135 |     absent |
| `TYPESCRIPT.md` / `JAVASCRIPT.md` |           358 |             absent |         296 |        282 |
| `DOCKER.md`                       |           527 |                481 |      absent |     absent |
| `PYTHON.md`                       |        absent |              5,190 |      absent |     absent |
| `IOS.md`                          |         1,531 |             absent |      absent |     absent |
| `API.md`                          |         1,470 |             absent |      absent |     absent |
| `SUPABASE.md`                     |           450 |             absent |      absent |     absent |
| `TALKING.md`                      |             3 |             absent |      absent |     absent |
| `WRITING.md`                      |        absent |             absent |      absent |         20 |
| Framework files (9)               |        absent |             absent |      absent |      3,595 |
| **Total**                         |    **13,940** |         **13,721** |   **3,337** | **10,542** |

Tens of thousands of lines across four repositories, of which the overlap is heavy: `BASH.md` exists four times at
2,143 to 2,559 lines, and `DOCUMENTATION.md` three times at 4,068 to 4,154.

### How the forks relate

Read by diff, not by assumption:

- **`GENERAL.md` in yap-swift-app, yap-text-inference and yap-landing is one document with parameter
  substitutions.** The diff is: the H1 ("monorepo" / "repository" / "repo"), the example snippets (a
  WebSocket example against a model-checkpoint example), the enumerated sibling rule files, and one
  extra section. The rules themselves are identical.
- **`GENERAL.md` in slopshop is a rewrite**, 177 lines against 349 in the longest fork, with sentence-case
  headings and rules restated as imperatives. It is the most advanced fork, and it resolves two of
  the conflicts below.
- **`NAMING.md` diverges by scale, not by content.** 2,574 lines in the monorepo covers five
  languages; 825 covers Python and Bash; 365 covers JavaScript and Bash; 257 is a condensed general
  version. The language sections are additive.
- **`PYTHON.md` at 5,190 lines is the largest single file in the corpus** and exists in one fork
  only.

**Conclusion: the corpus is one document per subject with per-project parameters, and it has been
maintained as four copies.** That is the thing the design fixes, and it is why rules is assembled
rather than copied.

## Four layers

| Layer | Path               | Contents                                                        | Architecture allowed                         | Shipped                     | Upgraded |
| ----- | ------------------ | --------------------------------------------------------------- | -------------------------------------------- | --------------------------- | -------- |
| 0     | `rules/general/`   | Craft. Language-agnostic, framework-agnostic.                   | None                                         | yes                         | yes      |
| 1     | `rules/language/`, `rules/runtime/` | What the language and the runtime imply.        | None                                         | yes                         | yes      |
| 2     | `rules/framework/`, `rules/library/`, `rules/tool/`, `rules/database/`, `rules/platform/`, `rules/shared/` | Only what the framework, library, tool, database or platform itself dictates. | The thing's own default, and nothing beyond it | yes                         | yes      |
| 3     | `rules/project/`   | This project's architecture, ownership, boundaries, vocabulary. | Anything                                     | no, starts empty            | never    |

The layer boundary is the answer to R10, and it is enforced, not asked for. See "The rules lint"
below.

### The general layer

Derived from `GENERAL.md`, `PLANNING.md`, `TALKING.md` and the parts of `DOCUMENTATION.md` that are
not Markdown mechanics.

```text
rules/general/WORKING.md        Thinking before coding, scope discipline, no defensive
                                logic, managing sprawl, abstractions, no backward
                                compatibility, working with uncommitted changes
rules/general/NAMING.md         Role instead of type, redundant context, vague and
                                inflated words, booleans and predicates, one concept
                                per name, boundary names. Language-agnostic only.
rules/general/COMMENTS.md       Present state only, no file paths, what a comment is for
rules/general/ERRORS.md         Message shape, no interpolated identifiers to clients,
                                failure at real boundaries
rules/general/TESTING.md        Test behaviour not values, what a test asserts
rules/general/DOCS.md           Structure, headings, tables of contents, code fences
rules/general/WRITING.md        Prose rules: dashes, modals, contractions, present
                                state, sentence length. Paired with repository:prose.
rules/general/PLANNING.md       Complete change content, implementation order, detail
                                level, no unrequested testing or linting
rules/general/TALKING.md        How to answer
```

The files above, against `GENERAL.md`, `PLANNING.md`, `TALKING.md` and `DOCUMENTATION.md` today. The growth is real:
`DOCUMENTATION.md` at 4,088 lines is being cut to its enforceable core, and `GENERAL.md` is being
kept nearly whole because it is the best file in the corpus.

### The language layer

One file per language, plus a naming appendix per language. `NAMING.md` at 2,574 lines is the
clearest split candidate: it already has sections titled "Swift", "TypeScript", "JavaScript",
"Bash", "SQL and Supabase", and each is self-contained.

```text
rules/language/TYPESCRIPT.md     rules/language/naming/TYPESCRIPT.md
rules/language/JAVASCRIPT.md     rules/language/naming/JAVASCRIPT.md
rules/language/PYTHON.md         rules/language/naming/PYTHON.md
rules/language/SWIFT.md          rules/language/naming/SWIFT.md
rules/language/BASH.md           rules/language/naming/BASH.md
rules/language/SQL.md            rules/language/naming/SQL.md
rules/language/CSS.md
rules/language/MARKDOWN.md
rules/general/CONFIGURATION.md   JSON, YAML, TOML, env files, plists
```

The language layer rules are the ones the language forces. `TYPESCRIPT.md` says
`verbatimModuleSyntax`, discriminated unions over optional soup, no `as` assertions outside runtime
boundaries, `readonly` where it means something. It does not say where a type lives in the directory
tree, because TypeScript has no opinion about that.

The existing `TYPESCRIPT.md` is 358 lines and close to correct already. The problem is `API.md` at
1,470 lines, which the prompt names: the JavaScript and TypeScript rules are written for one HTTP
service. The split:

| `API.md` section                                                                                                                                                                                               | Destination                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Core API Philosophy, HTTP Handler Rules, Request Validation, Response Shapes                                                                                                                                   | the framework layer `rules/shared/http/HTTP-API.md`, generalised: a contract exists, requests validate at the boundary, responses have one shape |
| Contracts, Zod, and OpenAPI                                                                                                                                                                                    | the framework layer, split: `rules/library/zod/ZOD.md` (from `slopshop`, already exists at 305 lines) and `rules/shared/http/OPENAPI.md`           |
| Errors, Async and Promises, Function Shape and Parameters                                                                                                                                                      | the language layer `rules/language/TYPESCRIPT.md`                                                                                              |
| Logging and Telemetry, Secrets, Security Boundaries                                                                                                                                                            | the general layer `rules/general/ERRORS.md` and a new the general layer `rules/general/SECRETS.md`                                             |
| Testing, Testing Data and Infrastructure, Vitest Mocking Patterns                                                                                                                                              | the framework layer `rules/tool/vitest/VITEST.md`                                                                                                |
| Ownership Map, API Architecture, Module Boundaries, Endpoint Structure, Entry Points, Domain Logic, Services and Cross-Module Communication, Data Access, Provider Integrations, Configuration and Environment | **the project layer template.** This is one project's architecture.                                                                            |
| Production Operations, nginx and Runtime, Performance                                                                                                                                                          | the project layer template, or deleted: these describe a deployment, not a rule                                                                |

`IOS.md` at 1,531 lines splits the same way: Swift source style, naming, programming practices,
documentation comments, concurrency, error handling and the UIKit boundary rules are the language
layer or the framework layer. "Architecture Standard", "Layers and Dependency Direction", "MVVM",
"Use Cases", "Repositories", "DTOs and Mapping", "Dependency Injection", "Scoped Factories" and
"Navigation and Coordinators" are the project layer.

### The framework layer

Architecture is allowed here, and only the framework's own.

The test, applied per statement: **would the framework's own documentation, scaffolding tool or
compiler produce this layout?** If yes, it is the framework layer. If it is a choice the team made
on top of the framework, it is the project layer.

| File                                                                                                                               | Permitted architecture, because the framework dictates it                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rules/framework/nextjs/NEXTJS.md`                                                                                                        | App Router directory conventions, `page`, `layout`, `route`, `loading`, `error`, server and client component boundary, `server-only`, metadata exports, `middleware.ts` at the root. `create-next-app` produces all of it. |
| `rules/platform/supabase/SUPABASE.md`                                                                                                      | `supabase/migrations/<timestamp>_<name>.sql`, `supabase/functions/<name>/index.ts`, `config.toml`, RLS as the authorisation model. The CLI produces all of it.                                                             |
| `rules/framework/fastapi/FASTAPI.md`                                                                                                       | `APIRouter` composition, `Depends` for injection, Pydantic models at the boundary, lifespan handlers. The framework's own tutorial.                                                                                        |
| `rules/framework/swiftui/SWIFTUI.md`                                                                                                   | `App` and `Scene`, `@State`, `@Observable`, `@Environment`, the view identity and lifecycle rules. Apple's own model. Not MVVM.                                                                                            |
| `rules/shared/http/HTTP-API.md`                                                                                                      | Only what HTTP itself dictates: status semantics, idempotency, content negotiation, one error shape. No layering.                                                                                                          |
| `rules/tool/vitest/VITEST.md`, `PYTEST.md`, `SWIFT-TESTING.md`                                                                       | Test file location conventions the runner discovers by default.                                                                                                                                                            |
| `rules/library/zod/ZOD.md`, `DRIZZLE.md`, `TRPC.md`, `TANSTACKQUERY.md`, `ZUSTAND.md`, `REACTHOOKFORM.md`, `I18N.md` | Library usage. Taken from `slopshop`, which already has them at the right granularity.                                                                                                                                     |

`slopshop` already got this right and is worth naming: a rule file per library, selected by what the
project depends on, is the preset model applied to prose.

### The project layer

`rules/project/` is the consumer's. It starts empty, gspot never writes into it, never upgrades it
and never lints it for architecture-prescriptive language. The ownership map, the layer names, the
deployment topology and the project vocabulary go here, in whatever files the team wants. The
reference repositories' own material of this kind (module maps, MVVM stacks, deploy runbooks) was
not carried into the merge, because it applies to one repository only.

## Assembly

### Rules are blocks

Every rule file is a block, and every block belongs to exactly one preset:

| Block | Preset that installs it |
| --- | --- |
| `rules/general/*.md` | always installed with `rules/` |
| `rules/language/<L>.md` and `rules/language/naming/<L>.md` | `language:<l>` |
| `rules/framework/<f>/*.md` | `framework:<f>` |
| `rules/library/<l>/*.md` | `library:<l>` |
| `rules/tool/<t>/*.md` | `tool:<t>` |
| `rules/database/<d>/*.md` | `database:<d>` |

A `library:`, `framework:`, `tool:` or `database:` block installs only when the preset is selected,
and a preset is selected only when its dependency is detected. A rule file present for a
dependency that is absent fails `gspot generate --check`. `slopshop` ships tRPC, TanStack Query and
Drizzle rules with none of the three in its `package.json`; under gspot those three files do not
exist there.
| `rules/platform/<p>/*.md` | `platform:<p>` |
| `rules/shared/http/*.md`, `rules/shared/i18n/*.md` | every preset whose manifest lists the package in `shared` |

Adding a language or a framework is adding its preset to `presets` in `gspot.toml`. Removing it is
removing the preset. `gspot generate` installs the blocks for the presets that are present and deletes
the blocks for the presets that are not, so `rules/` never holds a block for a language or a
framework the repository does not use. `gspot init` selects presets by detection and asks; `gspot
sync` never guesses.

Three rules keep blocks independent, and the rules lint enforces them on gspot's own corpus:

1. **No block links to another block.** A rule file never contains a link or a "see X.md" pointer
   to another rule file, because the other file may not be installed. A rule that needs a
   statement from another block restates it in its own words, in the one sentence the block needs.
   The reference corpus has 43 such pointers, most of them "follow `NAMING.md` for test names";
   they become "follow the naming rules for test names", which holds whether or not the naming
   block is installed.
2. **One statement lives in one block.** The same rule stated in two blocks is a defect the rules
   lint reports, because two copies drift. The general layer holds what applies everywhere; a
   language or framework block holds only what is specific to it.
3. **No block names a directory, tool or file of one repository.** `quality/`, `mise run
   lint:quality`, `createApp()` and a module list are one project's facts, and the rules lint bans
   them through the same term lists that catch product names.

`CLAUDE.md` and `AGENTS.md` are generated. They are never edited, and they are never allowed to
differ except in the header, because an agent that reads one must get the same rules as an agent
that reads the other.

`gspot generate` writes an index that **names no rule file**. The four reference `CLAUDE.md` files
do the opposite: three list their rule files as a prose sentence and one lists nine framework files
in a table, and every one of them goes stale when a preset is added or a dependency is dropped.

```markdown
<!-- Generated by gspot 0.1.0. Do not edit. Run: gspot generate -->

# Engineering Guidelines

The rules for this repository live under `rules/`. Read the ones that cover what you are changing,
and read `rules/general/` before any change: it applies to every file in this repository regardless
of language.

`rules/general/` holds rules about how to work: scope, naming, comments, errors, secrets, tests,
documentation, writing, suppressions and tooling. `rules/language/` holds one file per language, and
`rules/language/naming/` holds that language's naming conventions. `rules/framework/`, `rules/library/`,
`rules/tool/`, `rules/database/` and `rules/platform/` hold one folder per thing this repository
uses, under the kind it is, named after it. `rules/shared/` holds what several of them share. `rules/project/` holds this repository's own
architecture, boundaries and vocabulary.

Find the rules for a change by the path you are editing: the language of the file, then the
framework that owns the directory, then `rules/project/`. When two rules disagree, the more specific
layer wins, and a contradiction between two files at the same layer is a defect to report rather
than a choice to make.

Every file under `rules/` other than `rules/project/` is generated. Edit `rules/project/` freely. Do
not edit any other file under `rules/`, `CLAUDE.md` or `AGENTS.md`; change `gspot.toml` and run
`gspot generate`.

The linters are authoritative for anything they check. Do not run them unless asked. When a
finding is reported to you, `gspot explain <rule>` names the rule behind it.

Five properties, each closing a defect found in the reference set:

1. **No rule file is named.** Adding `rules/language/GO.md` or dropping `rules/library/zustand/ZUSTAND.md`
   changes nothing in this document. The `rules/DOCUMENTATION.md` orphan (4,088 lines that no file
   links to and that `CLAUDE.md` does not name) becomes structurally impossible, because membership
   is by directory rather than by list.
1. **Navigation is structural**, so an agent finds the right file from the path it is editing. A
   table mapping area to file needs a human to keep it true; a directory does not.
1. **Layer precedence is stated.** Four layers can disagree, and no reference `CLAUDE.md` says which
   wins. This one does, and it tells the agent that a same-layer contradiction is a bug to report
   rather than a judgement call.
1. **`AGENTS.md` is the same body** with a different first line. One emitter, two outputs,
   byte-comparable body, so the two files cannot drift the way two hand-maintained identical files
   did.
1. **It survives `rules/` being absent.** Under `--rules none` neither file is written at all, so
   there is no version of this document that describes rules the repository does not have.

### Installing the halves separately

`rules/` is optional, and so is the linting. Three valid states:

| Command                   | Writes                                                                            | Linting |
| ------------------------- | --------------------------------------------------------------------------------- | ------- |
| `gspot init`              | `gspot.toml`, generated configs, tasks, hooks, `CLAUDE.md`, `AGENTS.md`, `rules/` | yes     |
| `gspot init --rules install --presets ""` | `gspot.toml` with `checks = false`, `CLAUDE.md`, `AGENTS.md`, `rules/`            | no      |
| `gspot init --rules none`                 | `gspot.toml`, generated configs, tasks, hooks                                     | yes     |

Rules without checks is the "repository of LLM rules" half of the product, usable with no tool pins, no
generated configuration and no hooks. That is requirement R1, and it is why the rules assembler
reads the preset selection rather than the installed tools: a repository can select `language:swift`
for its rules without installing SwiftLint.

`gspot generate` is idempotent and can be run in a repository that has never run `gspot check`.

### Front matter

Every shipped rule file carries machine-readable front matter, which is what makes the table and the
rules lint possible.

```yaml
---
layer: language
language: typescript
preset: language:typescript
title: TypeScript
enforced-by:
  - ts/eslint
  - ts/tsc
  - structure/function-length
unenforced:
  - "Prefer a discriminated union to an optional field soup"
architecture: none
---
```

`architecture: none` is asserted for the general and language layers and required for the framework
layer, where the value names the framework whose default is being described:
`architecture: nextjs-app-router`. The project layer carries no front matter; gspot does not read it.

`unenforced` is the honest list: statements the prose makes that no check enforces.
`gspot report --rules` prints the count per file, which is the maintained version of the
`yap-swift-app` section titled "Enforcement on paper only".

## The rules lint

The rules lint is a check like any other: in the graph, run by `gspot check`, gated.

| Rule                                  | Applies to                      | Detection                                                                                                                                                                                                                                                                                                       |
| ------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No architecture prescription          | the general and language layers | A term list plus a section-heading list: MVVM, MVC, VIPER, clean architecture, hexagonal, layer, use case, repository pattern, DTO, ownership map, dependency injection container, coordinator, service locator, domain layer, application layer, infrastructure layer. A hit fails with the layer rule quoted. |
| No framework assumption               | the general and language layers | Framework name list: Next.js, React, FastAPI, Express, SwiftUI, Supabase, Drizzle. A hit in the general layer or the language layer fails.                                                                                                                                                                      |
| Framework confined to its own default | the framework layer             | Every architectural claim carries a `source:` annotation pointing at the framework's own documentation. An unsourced claim fails.                                                                                                                                                                               |
| Reachable from the index              | every generated layer           | Every installed file sits in a directory the index describes, and every directory the index describes has at least one installed file. Membership is by directory, not by list.                                                                                                                                 |
| No link to another block              | every generated layer           | Any Markdown link or `see <FILE>.md` phrase whose target is a rule file fails, because the target may not be installed.                                                                                                                                                                                       |
| One statement in one block            | every generated layer           | Normalised sentences are hashed across the corpus; the same sentence in two blocks fails, naming both.                                                                                                                                                                                                         |
| No empty pointer                      | every generated layer           | A bullet or sentence whose only content is "follow the X rules" fails. The naming rules already apply to every name; a reminder is noise, and the reference corpus had 23 of them.                                                                                                                              |
| No repository-specific name           | every generated layer           | The banned-term lists plus a path list (`quality/`, `mise run`, function names such as `createApp()`) that hold for one repository only.                                                                                                                                                                       |
| No runtime in a language file         | the language layer              | Runtime name list: Node, Deno, Bun, the browser, Workers. Module resolution, globals and available APIs are runtime facts and live in `rules/runtime/`. |
| No tool in a language file            | the language layer              | The tool registry. A tool may be named where it is the subject (ShellCheck in the Bash rules) and not where it is configuration ("the ESLint config for `shared/`").          |
| No library or platform in a framework file | the framework layer        | The preset id list for the `library:` and `platform:` kinds. A framework rule that names a library assumes a stack.                                                          |
| No language-specific example in the general layer | the general layer   | Every fenced example in a general file has a sibling in each other language the corpus ships, or the rule moves down a layer.                                                 |
| Every `enforced-by` id exists         | all                             | Cross-check against the check registry                                                                                                                                                                                                                                                                          |
| Every file path in prose exists       | all                             | The same referent assertion `gspot generate --check` applies to configs                                                                                                                                                                                                                                                   |
| Prose rules pass                      | all                             | `repository:prose`, which means the rule files obey the writing rules they state                                                                                                                                                                                                                                |
| No duplicate statement across layers  | all                             | A near-duplicate paragraph between the general and language layers fails, because the corpus already forked three ways                                                                                                                                                                                          |

The four layer-boundary rules exist because every one of them was violated in the merged corpus
before anyone checked: a language file enumerating three runtimes, a database file giving one
platform's instructions, a framework file naming four libraries. A word list per layer catches all
of it mechanically, which is the only thing that makes it stick.

The duplicate-statement rule is the one that keeps the corpus from doubling. The reference corpus has
`NAMING.md` restating the general naming rules inside each language section, and `BASH.md`,
`DOCUMENTATION.md` and `GENERAL.md` overlapping on comments, naming and present-state prose.

## Per-agent output

`CLAUDE.md` and `AGENTS.md` are the two named in the requirement. The assembler is an emitter over
one document model, so other targets are a config entry rather than a new corpus:

```toml
[rules]
targets = ["CLAUDE.md", "AGENTS.md"]
```

MegaLinter ships eight agent targets and is the best available evidence of what the real set is:
`.claude/rules/`, `.claude/skills/`, `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`,
`.agents/plugins/`, `gemini-extension.json` and `com.github.copilot/agents/`. That settles the shape
of the question: the emitter needs more than two outputs eventually, so the document model has to
come first and the targets are views over it.

Candidates the emitter supports with no new content: `.cursor/rules/*.mdc`,
`.github/copilot-instructions.md`, `.windsurfrules`, `gemini-extension.json`, and a
`.claude/skills/` directory for the task-shaped subset. Adding a target never duplicates prose,
because the source of truth is `rules/` and the target is a view. Which targets ship in v0 is
[19-decisions.md](19-decisions.md), Q-05.

## Conflicts

Every one of these is a case where two forks, or one fork and its own tooling, state incompatible
rules. Each needs a resolution, and the resolution is stated.

### C-01 List indentation: two spaces against four

- `yap-swift-app/rules/DOCUMENTATION.md:2211` and `yap-text-inference/rules/DOCUMENTATION.md:2276`:
  "For unordered lists, indent nested content by two spaces".
- `yap-swift-app/.markdownlint-cli2.jsonc`: `MD007` indent is `4`, with the comment "matching
  Prettier's tabWidth".
- `yap-swift-app/rules/GENERAL.md` uses four-space list indentation; `yap-landing/rules/GENERAL.md`
  uses two.
- `slopshop/rules/general/DOCUMENTATION.md:2173`: "Let Prettier set list indentation."

**Resolution: slopshop is right.** Prose never states a number a formatter owns. The corpus says
"the formatter sets list indentation" and the `[format].indent_width` block sets it once for
Prettier, markdownlint `MD007`, `.editorconfig` and shfmt together.

### C-02 Prose line width: 100 against 120 against unwrapped

- `DOCUMENTATION.md:1361` in two forks: "Wrap prose at approximately 100 characters."
- `.prettierrc.json` in three of four: `printWidth: 120`; `yap-landing` says 100.
- `yap-swift-app` and `yap-text-inference` hard-wrap their Markdown at roughly 80; `yap-landing`
  does not wrap at all.
- `slopshop/rules/general/DOCUMENTATION.md:1329`: "Follow the root Prettier configuration for prose
  wrapping."

**Resolution: as C-01.** One `print_width`, stated once, in configuration.

### C-03 Code line width: 80 against 120

- `DOCUMENTATION.md:1822`: "Aim for code lines of approximately 80 characters."
- `yap-text-inference/pyproject.toml`: Ruff `line-length = 120`, and `PYTHON.md:186` explicitly
  overrides the 80 guidance for local code.
- `.prettierrc.json`: 120.

**Resolution: one `print_width` per language**, set in configuration, with the prose stating only
that the formatter is authoritative. `PYTHON.md` already contains the correct pattern: a table
naming the upstream guidance, the local limit, and which wins.

### C-04 Ordered list numbering

- `DOCUMENTATION.md` requires `1.` on every item.
- markdownlint `MD029` default accepts `1. 2. 3.`
- Prettier renumbers.

**Resolution:** set `MD029` to `one` and let Prettier agree with it. A rule with a tool that
contradicts it is a defect in the configuration, not in the prose.

### C-05 Table alignment

- `DOCUMENTATION.md` says do not realign table rows.
- Prettier realigns every table row on every run.

**Resolution: delete the rule.** It is unenforceable against the formatter that runs on every
commit, and the reference audit already lists it as an open conflict.

### C-06 Heading case

- Three forks use Title Case for H2 and below. 164 of 352 H2 headings in yap-swift-app are Title
  Case.
- `DOCUMENTATION.md` states H1 title case, H2 and below sentence case.
- slopshop already uses sentence case throughout.

**Resolution: the stated rule, enforced.** H1 title case, H2 and below sentence case, by a Vale rule
plus a markdownlint check on the contents anchors, because re-casing 164 headings changes every
anchor that points at them.

### C-07 Em dashes against shell doc-comment convention

- `DOCUMENTATION.md` bans the em dash, the en dash, the spaced double hyphen and the spaced hyphen.
- `BASH.md` specifies the function header form `# name - Description.`, and there are 181 such
  headers in yap-swift-app.
- `SHELL_DOC_COMMENT_REGEX` in the same repository accepts an em dash as the separator.

**Resolution: the colon form, `# name: Description.`** It satisfies both rules. The 181 headers and
the validating regex are a one-time migration `gspot fix` performs.

### C-08 Suppression metadata format against the dash ban

- `lint:justify reason: X -- ticket: Y` uses a spaced double hyphen, which the same corpus bans.
  Thirty uses.

**Resolution: `reason: X.`** No ticket field, per [09-gates.md](09-gates.md), because
nine of 23 tickets in the reference tree say `N/A`.

### C-09 `TODO` markers: banned against required-with-format

- `DOCUMENTATION.md`, through `proselint.Annotations`, bans `TODO`, `FIXME`, `XXX` and `HACK`
  everywhere.
- `BASH.md` permits `TODO(identifier):`.
- `yap-text-inference/rules` contains 11 `TODO`-family markers; the other three forks contain one
  each.

**Resolution: `unicorn/expiring-todo-comments` and Ruff `TD`.** A `TODO` must carry an owner and an
expiry date, and it fails the build when it expires. That is stricter than banning it, because a ban
produces an unmarked comment saying the same thing.

### C-10 "Access control" corrupted to "Access command"

A mass replacement of `control` with `command` in yap-swift-app produced "inversion of command",
"Access command" and "command-flow statements" in `GENERAL.md`, `IOS.md`, `NAMING.md`,
`SUPABASE.md`, `BASH.md` and a lint message. `yap-text-inference/rules/GENERAL.md:202` still reads
"Access control". `typos` cannot see it, because every word is real.

**Resolution: yap-text-inference is the clean fork for this word.** The merge takes its text, and
`control` enters the vocabulary as a protected term so the replacement cannot recur.

### C-11 The naming-authority statement names a path, against its own rule

- `GENERAL.md` in yap-text-inference and yap-landing: "The local linting tools under `quality/` and
  `mise run lint:quality` are also authoritative."
- `GENERAL.md`, same file, section "Avoid Referencing Specific File Paths".
- yap-swift-app states the same rule without the path: "Automated naming checks are authoritative
  when they exist for the touched scope."

**Resolution: yap-swift-app's wording.** A rule file never names a directory that a refactor can
move, which is the same assertion `gspot generate --check` makes about configuration.

### C-12 Modal verbs banned, used 231 times

`DOCUMENTATION.md` bans `may`, `might`, `could`, `would` and `should`. Counts of `should` and `may`
in each corpus:

| Fork               | `should` | `may` |
| ------------------ | -------: | ----: |
| yap-swift-app      |      145 |    86 |
| yap-text-inference |       71 |    46 |
| slopshop           |       32 |    51 |
| yap-landing        |       18 |    18 |

**Resolution: the rule stands, enforced by Vale, adopted through the baseline.** The corpus is
rewritten in the imperative during the merge, which is work the merge has to do anyway. `should`
becomes `must` or an imperative; `may` becomes an explicit permission or is deleted.

### C-13 Contractions banned, present

One contraction in each of three forks. Trivial, and it proves the rule was never enforced.

**Resolution: enforced by `RedHat.Contractions`.**

### C-14 `values` banned globally, needed by SQL

`values` is in the 94-term banned list, with eight exemptions for the SQL `VALUES` clause.

**Resolution: the term moves out of the global list into the SQL language section as a reserved word
with allowed uses.** A global ban needing eight exemptions is a scoping error, not a policy.

### C-15 Coverage thresholds stated, not gated

`GENERAL.md` and two test configs state 80 percent coverage. The threshold runs only under
`RUN_COVERAGE=1`, and there is no CI to set it.

**Resolution:** the threshold becomes a check in the task graph, or the prose loses the number.
[14-framework-presets.md](14-framework-presets.md).

### C-16 Shell limits disagree across three repositories

- `SHELL_MAX_FILE_LINES`: 140 in `yap-swift-app` and `yap-text-inference`, 180 in `yap-landing`.
- `SHELL_MAX_FUNCTION_LINES`: 100 in `yap-swift-app` and `yap-landing`, **40** in
  `yap-text-inference`.
- `SHELL_MAX_FUNCTION_BRANCHES`, `SHELL_MAX_FUNCTION_NESTING` and `SHELL_MAX_MUTABLE_ASSIGNMENTS`
  exist in `yap-text-inference` only.

**Resolution: strictest wins, and the two looser repositories baseline.** 140 file lines, 40
function lines, and all three of the missing limits adopted. A limit one repository already meets is
a limit the others reach. The full table is in
[12-structure-and-naming.md](12-structure-and-naming.md).

### C-17 The trivial-function threshold is counted two ways

`yap-swift-app` counts statements (`MAX_TRIVIAL_FUNCTION_STATEMENTS = 2`). `yap-text-inference`
counts statements **and** AST nodes (`max_trivial_ast_nodes: 10`).

**Resolution: both.** A two-statement function that builds a large expression is not trivial, and
the statement count alone misses it.

## Rules that cannot be kept

Not "bad rules". Rules that no longer belong in the corpus for a stated reason.

### Category A: a formatter or linter owns the decision

A rule stating a number that a tool sets is a second source of truth. These are deleted from prose
and stated once in `[format]` or `[limits]`.

| Rule                                                   | Owner                          |
| ------------------------------------------------------ | ------------------------------ |
| Indent width, list indent, nested-block alignment      | `[format].indent_width`        |
| Prose and code line width                              | `[format].print_width`         |
| Quote style, semicolons, trailing commas, arrow parens | `[format]`                     |
| Code fence style, emphasis style, strong style         | markdownlint                   |
| Table alignment, ordered-list numbering                | Prettier and markdownlint      |
| Import group order and blank lines                     | `perfectionist` and `import-x` |
| Blank lines between declarations                       | the formatter                  |
| Trailing whitespace, final newline, line endings       | `.editorconfig`                |

Estimated deletion from `DOCUMENTATION.md`: roughly 2,300 of 4,088 lines. The document is a style
guide written for humans in an era before the formatter ran on every commit.

### Category B: unenforceable as written, and rewritable

| Rule                                                             | Problem                              | Rewrite                                                                                                                                                   |
| ---------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Aim for approximately N characters"                             | "Approximately" cannot be checked    | A number in configuration, or delete                                                                                                                      |
| "Be ready to explain why the owning module should grow that way" | Addressed to a person, not checkable | Keep as the general layer craft prose, marked `unenforced`, because an agent acts on it                                                                   |
| "Keep messages consistent in tone and casing"                    | No tool measures tone                | Split: casing is an ESLint selector; tone stays prose, marked `unenforced`                                                                                |
| "Prefer duplication over the wrong abstraction"                  | A judgement                          | the general layer, marked `unenforced`. This is the most valuable rule in the corpus and it is not mechanisable.                                          |
| "Do not add defensive logic for states that cannot occur"        | A judgement about contracts          | the general layer prose, plus the banned-term list, which catches the names those guards get (`ensure`, `if_needed`, `or_throw`, `maybe`, `with_retries`) |

Category B rules are **kept and labelled**. `gspot report --rules` prints the unenforced count per
file, which is the honest accounting the reference audit does by hand under "Enforcement on paper
only".

### Category C: one project's architecture

Not rules. Facts about one codebase, in a file another project would install. Moved to the project
layer templates, per 10-rules.md.

| Source      | Sections                                                                                                                                                                                                                                                 |      Lines |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------: |
| `API.md`    | Ownership Map, API Architecture, Module Boundaries, Endpoint Structure, Entry Points, Domain Logic, Services and Cross-Module Communication, Data Access, Provider Integrations, Configuration and Environment, Production Operations, nginx and Runtime |       ~600 |
| `IOS.md`    | Architecture Standard, Layers and Dependency Direction, MVVM, Domain Layer, Use Cases, Repositories, DTOs and Mapping, Dependency Injection, Scoped Factories, Navigation and Coordinators, Feature Organization                                         |       ~600 |
| `NAMING.md` | Feature Organization                                                                                                                                                                                                                                     |        ~70 |
| **Total**   |                                                                                                                                                                                                                                                          | **~1,270** |

### Category D: project-specific data masquerading as policy

| Item                                                                                                                                     | Where         | Verdict                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------- |
| `runpsql`, `postlock`, `prelock` in the banned-term list                                                                                 | naming policy | Project terms. Out of the shipped list, into the consumer settings. |
| Nine `nameRules` entries with paths like `^supabase/src/data/20260415175200_insert_prompts/source/analysis/catalog\.ts$`                 | naming policy | Per-file exemptions. Settings, counted against the limit.           |
| `RTCAudioSink`, `RTCPeerConnection` exemptions                                                                                           | naming policy | A vendor vocabulary. Settings.                                      |
| `e2e` exemption                                                                                                                          | naming policy | Shipped: every project has this word.                               |
| Twelve application integrity checks in slopshop (`css-usage`, `locales`, `translation-usage`, `next-configuration`, `application-files`) | `quality/`    | consumer checks, per D-40.                                          |

### Category E: duplicated across layers

The corpus restates general naming rules inside each language section of `NAMING.md`, and `BASH.md`,
`DOCUMENTATION.md` and `GENERAL.md` overlap on comments, naming and present-state prose.

**Resolution: the rules lint fails on a near-duplicate paragraph across layers.** A the language
layer file states only what the language adds to the general layer.

## What is missing

Rules the corpus does not state and should, found by reading the tooling against the prose. Each is
a rule the linters can enforce today with nothing written down for the agent.

| Missing rule                                                                                              | Layer   | Enforced by                                                                   |
| --------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| **Create a branch or a worktree only when the user asks for one.** Work on the current branch by default. | general | unenforced by design: an agent reads it, and no linter sees an agent's intent |
| Never commit, push, or rewrite history unless the user asks                                               | general | unenforced, same reason                                                       |
| Never create a branch or worktree as a workaround for a failing gate                                      | general | unenforced, same reason                                                       |
| Every suppression carries a reason                                                                        | 0       | `require-description`, Ruff `PGH`, the limit                                  |
| A `TODO` carries an owner and an expiry date                                                              | 0       | `unicorn/expiring-todo-comments`, Ruff `TD`                                   |
| Configuration is generated; never edit a generated file                                                   | 0       | `gspot generate --check`                                                                |
| Every tracked file is covered; a gap is declared, not ignored                                             | 0       | the coverage check                                                            |
| A generated file declares its producer and is asserted fresh                                              | 0       | `[[declare]]`                                                                 |
| No secret, credential or token in any tracked file, including assets and project files                    | 0       | `repository:secrets`                                                          |
| Dependencies are pinned exactly; a lockfile is tracked and matches the manifest                           | 0       | `repository:dependencies`                                                     |
| A migration at or before the baseline is immutable                                                        | 2       | `supabase/migration-immutable`                                                |
| Plain-language prose: short sentences, active voice, concrete words, one idea per paragraph               | 0       | Vale, ISO 24495 alignment. [03-repo-layout.md](03-repo-layout.md)             |
| An asset referenced from no source is deleted                                                             | 0       | `repository:assets`                                                           |
| Every fenced code block in documentation is valid code in its declared language                           | 0       | `md/fenced-code-lints`                                                        |
| Type completeness: no implicit or explicit `Any` outside a declared boundary                              | 1       | `type-coverage`, basedpyright `reportAny`                                     |
| A public interface change is intentional and reviewed                                                     | 1       | `attw`, `publint`, `griffe` for libraries                                     |
| Workflow actions are pinned to a commit SHA                                                               | 2       | `zizmor`                                                                      |
| Bundle size has a limit                                                                                   | 2       | `size-limit`                                                                  |

## The git rules

`rules/general/GIT.md` is new. No fork has it, and it covers the class of action an agent takes on
its own that a linter never sees.

The rules, in the order they matter:

1. **Create a branch only when the user asks for one.** Work on the current branch by default. A
   branch created without a request splits the work from where the user is looking.
1. **Create a worktree only when the user asks for one.** A worktree is a second checkout on disk.
   An unrequested one leaves the user editing files that the agent is not changing.
1. **Never create a branch or a worktree to escape a failing gate.** A failing check is a finding to
   fix or a declaration to write. It is not a reason to move the work somewhere the gate has not
   run.
1. **Commit only when the user asks.** Stage nothing on the user's behalf without being asked.
1. **Never push, force-push, rebase, amend, reset or rewrite history unless the user asks**, and
   name the exact command before running it.
1. **Never bypass a hook.** `--no-verify` is the user's decision, not the agent's.
1. **Report uncommitted work rather than committing or discarding it.** The existing "Working With
   Uncommitted Changes" section in `GENERAL.md` states this and belongs here instead.

Every one of these is `unenforced` by design, and the rules lint marks them so. A linter reads
files; it does not read an agent's intent to branch. That is exactly the case the `unenforced`
annotation exists for, and listing these rules honestly is better than pretending a check covers
them.

The one mechanical companion: `gspot` never creates a branch, a worktree or a commit.
`gspot hooks install` writes hook files and sets `core.hooksPath`, and that is the only git state it
touches.

## Arrangement

The four-layer scheme from 10-rules.md, with the corpus mapped onto it.

```text
rules/
  general/                  holds for every file, in every language and framework
    WORKING.md              thinking, scope, sprawl, abstractions, no defensive logic,
                            no backward compatibility, uncommitted changes
    NAMING.md               role over type, redundant context, vague and inflated words,
                            booleans, one concept per name, boundary names
    COMMENTS.md             present state, no paths, what a comment is for
    ERRORS.md               message shape, no leaks, failure at real boundaries
    SECRETS.md              secrets, tokens, tracked files, assets
    TESTING.md              behaviour not values, what a test asserts
    DOCS.md                 structure, contents lists, fences, what a document is for
    WRITING.md              plain language, dashes, modals, contractions, present state
    SUPPRESSIONS.md         reasons
    TOOLING.md              generated configuration, coverage, declarations
    CONFIGURATION.md        JSON, YAML, TOML, env files, plists
    GIT.md                  branches, worktrees, commits, history, uncommitted work
    PLANNING.md             complete change content, order, detail level
    TALKING.md              how to answer
  language/
    TYPESCRIPT.md  JAVASCRIPT.md  PYTHON.md  SWIFT.md  BASH.md  SQL.md
    CSS.md  MARKDOWN.md
    naming/
      TYPESCRIPT.md  JAVASCRIPT.md  PYTHON.md  SWIFT.md  BASH.md  SQL.md
  framework/                one folder per preset, under the kind it is
    nextjs/ NEXTJS.md   express/ EXPRESS.md   fastapi/ FASTAPI.md
    swiftui/ SWIFTUI.md   uikit/ UIKIT.md   comfyui/ COMFYUI.md
  library/
    zod/ ZOD.md   drizzle/ DRIZZLE.md   trpc/ TRPC.md   tanstack-query/ TANSTACKQUERY.md
    zustand/ ZUSTAND.md   react-hook-form/ REACTHOOKFORM.md
  tool/
    docker/ DOCKER.md   nginx/ NGINX.md   vitest/ VITEST.md   pytest/ PYTEST.md
    swift-testing/ SWIFT-TESTING.md   (xcode: checks only, no block)
  database/
    postgres/ POSTGRES.md
  platform/
    supabase/ SUPABASE.md
  repository/
    static-site/ STATIC-SITE.md
  shared/                   installed by every preset that lists the package
    http/ HTTP-API.md OPENAPI.md      (express, fastapi, nextjs)
    i18n/ I18N.md                     (next-intl, i18next, react-intl)
  project/                  consumer-owned, starts empty, never written by gspot
```

### Parameterized examples

The diff between three `GENERAL.md` forks is mostly the example snippets. The corpus therefore
stores examples per language and selects them at assembly:

```markdown
Do not describe what changed. Describe what the code does.

<!-- gspot:example lang=typescript -->

Bad: `// Removed the old polling logic.` Good: `// Fetches updates over a WebSocket.`

<!-- /gspot:example -->

<!-- gspot:example lang=python -->

Bad: `# Removed the old checkpoint loader.` Good:
`# Loads model checkpoints from the configured artifact directory.`

<!-- /gspot:example -->
```

The assembler emits only the blocks whose language is installed. One rule, one statement, examples
that match the repository. That removes the reason the forks diverged.

### Sizing

| Layer     |  Files | Estimated lines | From                                                                                                                                                             |
| --------- | -----: | --------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0         |     14 |          ~2,600 | `GENERAL.md` kept nearly whole, `PLANNING.md`, `TALKING.md`, the enforceable half of `DOCUMENTATION.md`, the general half of `NAMING.md`, plus four new files    |
| 1         |     16 |          ~9,500 | `BASH.md` (~2,400), `PYTHON.md` (~3,000 after Category A and C cuts), `NAMING.md` language sections (~2,000), `TYPESCRIPT.md`, `DOCKER.md`, `SQL.md`, `SWIFT.md` |
| 2         |     17 |          ~4,200 | slopshop's nine framework files, plus `SUPABASE.md`, `HTTP-API.md`, the framework layer halves of `IOS.md` and `API.md`                                          |
| 3         |      4 |            ~400 | Templates, from Category C                                                                                                                                       |
| **Total** |        |                 | from the forks above                                                                                                                                              |

Roughly 40 percent of the current line count, covering strictly more subjects, with one copy of each
rule.

## Section inventory

The source files are in this repository under `reference-rules/<repository>/`,
copied verbatim from all five forks. They are read, never edited; the merge
writes into `presets/rules/` and leaves them as the record of what was
reconciled.

Every H2 in every unique rule file across the five forks, with its destination.
Nothing here is copied yet; this is the map the importer and the merge follow.
Four destinations: a layer directory, `project` (a template copied once and
never shipped as a rule), or `drop` with the reason.

Two rules applied to every file:

- **Review checklists and verification-command sections drop.** A checklist
  restates the rules above it, and the commands are gspot's to generate. Every
  fork has both.
- **Anything naming one product, one host, one team's layout or one repository's
  task names is `project`.** A generic tool ships no rule that only one
  repository can obey.

### A substitution defect in every fork

Every fork carries the marks of a global word replacement that was never reviewed. `object` became
`item` (`z.item({...})` is not a Zod call; "options item"; "log item keys"), `control` became
`command` ("access command", "inversion of command", "command flow"), `dynamic` became
`configured` ("configured SQL", "configured imports"), `package manager` became
`package coordinator`, and `base64` became `encodedBytes`. The importer treats these as text
defects to repair on the way in, with a list per fork, and the rules lint bans the five phrases so
they cannot come back.

### `GENERAL.md` (349 lines, four forks)

| Goes to | Sections |
| --- | --- |
| `general/WORKING.md` | Thinking Before Coding, Scope Discipline, No Defensive Logic, Managing Sprawl, Abstractions and its eight subsections, Language Discipline, No Backward Compatibility, Working With Uncommitted Changes |
| `general/NAMING.md` | Naming |
| `general/SECRETS.md` | Secrets and Sensitive Data |
| `general/ERRORS.md` | Error Messages |
| `general/TESTING.md` | Testing Philosophy, Test Behavior Not Values |
| `general/COMMENTS.md`, `general/DOCS.md` | Code Style and its subsections: Present State Only, Avoid Referencing Specific File Paths, Punctuation, Table of Contents, Comments, Documentation Requirements, Documentation Maintenance |
| `general/GIT.md` | Protected Files (two forks), plus the new git rules |
| drop | Verification Commands (gspot generates them) |

### `NAMING.md` (2,574 lines)

| Goes to | Sections |
| --- | --- |
| `general/NAMING.md` | Authority and Quality Enforcement (rewritten without paths), General Naming Rules, Vocabulary and Role Words, Functions and Methods, Booleans and Predicates, Files and Directories, Boundaries and External Names, Tests |
| `language/naming/SWIFT.md` | Swift and its eleven subsections |
| `language/naming/TYPESCRIPT.md` | TypeScript and its six |
| `language/naming/JAVASCRIPT.md` | JavaScript and its five |
| `language/naming/BASH.md` | Bash and its four |
| `language/naming/SQL.md` | SQL Case Rules, Migration Filenames, Tables and Columns, Functions and Parameters, Indexes Constraints Triggers and Policies |
| `platform/supabase/SUPABASE.md` | Supabase Edge Functions |
| `shared/http/HTTP-API.md` | API Naming |
| `project` | Feature Organization |
| drop | Review Checklist |

### `BASH.md` (2,433 lines, five forks)

| Goes to | Sections |
| --- | --- |
| `language/BASH.md` | Core Bash Philosophy, When to Use Bash, File Types and Invocation, File Encoding and Line Endings, Runtime Compatibility, Deprecated and Forbidden Syntax, Script Structure, Shell Options, Output Logging and Errors, Literal Text and Here Documents, Comments and Documentation, Formatting, Naming, Functions, Variables and Constants, Quoting and Expansion, Arrays and Argument Lists, Conditionals, Arithmetic, Loops and Input, Delimited Data and IFS, Paths Globs and File Names, Command Substitution, Pipelines and Redirection, Calling Commands, Process Management and Privilege Boundaries, Text JSON and Structured Data, Network Commands, Secrets and Environment, Temporary Files Locks and Cleanup, Security Rules, Portability Rules, No Bash Tests, Debugging Bash, Refactoring Existing Scripts, Anti-Patterns |
| `tool/docker/DOCKER.md` | Docker RUN Blocks |
| `project` | Deployment Pipelines, CI Scripts |
| drop | Linting and Formatting, Review Checklist, Pitfall Coverage Audit (a checklist of the sections above) |

### `DOCUMENTATION.md` (4,088 lines, three forks)

| Goes to | Sections |
| --- | --- |
| `general/DOCS.md` | Authority and scope, Core documentation standard, Documentation as the single source of truth, Write for a defined reader, Organize the documentation set, Split a README and an advanced guide deliberately, Use cognitive funneling, Choose the correct topic type, Plan documentation before writing, Structure pages predictably, Write useful code examples, Write procedures that people can complete, Use lists for scannable information, Use tables only for real comparisons, Create durable and descriptive links, Use alerts sparingly, Document user interfaces precisely, Document keyboard input consistently, Use illustrations only when they add meaning, Make all documentation accessible, Document specialized technical surfaces, Document releases and lifecycle changes, Maintain documentation continuously, Review documentation systematically, Documentation anti-patterns, Definition of done |
| `general/WRITING.md` | Voice and tone, Write clear and translatable language, Use inclusive and respectful language, Ground every claim in evidence |
| `general/SECRETS.md` | Protect secrets and personal information |
| `project` | Reusable templates and every skeleton heading under it: Example, Key capabilities, Prerequisites, Setup, Usage, Configuration, Architecture, Common problems, Advanced guide, Contributing, License, Runtime behavior, Advanced configuration, Operations, Deep troubleshooting, Complete the task, Troubleshooting, Next steps, How it works, Boundaries and ownership, Constraints, Related tasks, Syntax, Parameters, Output, Errors, Examples, EXACT_OR_VISIBLE_SYMPTOM, METHOD /path. About thirty H2s that are a README template, not rules. |
| drop | Use portable Markdown and Format text by meaning where they state fence style, emphasis style, table alignment, list indentation and line width (the formatter owns those); Respect source licensing and legal content (a policy, not a writing rule); Configure authentication, which appears twice |

### `TYPESCRIPT.md` (358 lines, three forks) and `JAVASCRIPT.md` (296 lines, one fork)

| Goes to | Sections |
| --- | --- |
| `language/TYPESCRIPT.md` | Core TypeScript Philosophy, TypeScript Standard, Source Files, Modules Imports and Exports, Type Placement, Values Literals and Coercion, Objects Arrays and Destructuring, Functions and Parameters, Classes, Types and Inference, Null Undefined and Optional Values, Runtime Boundaries, Errors and Async Code, Comments and JSDoc, Tests and Mocks, Generated Code, Rules Not Adopted |
| `language/JAVASCRIPT.md` | Core JavaScript Philosophy, Runtime Standard, Source Files, Modules Imports and Exports, Comments and JSDoc, Generated Code, plus every section shared with TypeScript, rendered into both files from one source. A repository without `language:typescript` never installs `TYPESCRIPT.md`, so nothing may live only there. |
| `repository/static-site/STATIC-SITE.md` | Static Site Boundaries, Templates and Browser Assets |
| `language/naming/*.md` | Naming |
| drop | Scope, Source Material Decisions (which upstream style guides were read: provenance, not a rule), Verification Commands |

### `PYTHON.md` (5,190 and 3,125 lines, two forks)

| Goes to | Sections |
| --- | --- |
| `language/PYTHON.md` | Core Python Philosophy, Runtime Encoding and Files, Environment and Configuration, Package Installation Security, Module Structure, Imports, Public and Internal Interfaces, Formatting (principle only), Naming, Comments and Docstrings, Type Annotations, Constants Globals and Mutable State, Functions and Methods, Classes, Exceptions and Error Handling, Assertions, Boolean Logic and Comparisons, Control Flow Simplification, Iteration and Collections, Strings Logging and Error Messages, Files and Stateful Resources, Main Programs and Top-Level Code, Power Features, Threading and Concurrency, Tests, Anti-Patterns |
| `framework/fastapi/FASTAPI.md` | FastAPI |
| `project` | Packages and Architecture, External integration boundaries, Manual verification |
| drop | Source Material Decisions, Local Tooling Authority (names `quality/` and mise tasks, against the no-paths rule), Verification Commands, Review Checklist |

The two forks diverge by 2,000 lines inside sections with the same headings.
The longer fork is the base for content; the shorter is the base for form,
because its headings are already sentence case.

### `IOS.md` (1,531 lines)

| Goes to | Sections |
| --- | --- |
| `language/SWIFT.md` | Swift Source Style, Swift Naming, Swift Programming Practices, Documentation Comments, Concurrency, Error Handling |
| `framework/swiftui/SWIFTUI.md` | Core iOS Philosophy, SwiftUI Views, State Management, Accessibility, Testing |
| `framework/uikit/UIKIT.md` | UIKit and Apple Framework Boundaries, UIKit Lists and Data Sources |
| `project` | Architecture Standard, Feature Organization, Layers and Dependency Direction, MVVM, Domain Layer, Use Cases, Repositories, DTOs and Mapping, Dependency Injection, Protocols and Abstractions, Navigation and Coordinators, Services and Platform Boundaries, Networking and API Clients |

### `API.md` (1,470 lines)

| Goes to | Sections |
| --- | --- |
| `shared/http/HTTP-API.md` | Core API Philosophy, HTTP Handler Rules (the framework-neutral half), Request Validation, Response Shapes, Security Boundaries, Errors (shape and leakage) |
| `framework/express/EXPRESS.md` | The Express half of HTTP Handler Rules: middleware order, `express.json` body limits per route, the four-argument error handler, rate-limit middleware placement, helmet |
| `library/zod/ZOD.md`, `shared/http/OPENAPI.md` | Contracts Zod and OpenAPI, OpenAPI and Contract Testing |
| `tool/vitest/VITEST.md` | Testing, Testing Data and Infrastructure, Network and Provider Testing, Vitest Mocking Patterns |
| `language/TYPESCRIPT.md` | Async and Promises, Function Shape and Parameters, Dependencies and Abstractions |
| `general/ERRORS.md`, `general/SECRETS.md` | Logging and Telemetry, Secrets |
| `project` | API Architecture, Ownership Map, Module Boundaries, Endpoint Structure, Entry Points, Domain Logic, Services and Cross-Module Communication, Data Access, Provider Integrations, Configuration and Environment, Production Operations, nginx and Runtime, Performance |

### `SUPABASE.md` (450 lines)

| Goes to | Sections |
| --- | --- |
| `language/SQL.md` | SQL Style |
| `language/naming/SQL.md` | Naming |
| `database/postgres/POSTGRES.md` | Migration Naming, Migration Immutability, Migration Structure, Tables and Data Modeling, Row Level Security, Database Functions, Grants, Durable Data Migrations, Tests |
| `platform/supabase/SUPABASE.md` | Ground Rules, Supabase Platform Rules, Change Workflow, Storage, Edge Functions, Edge Function Imports, Config and Environment, Cron and Vault, Generated Types, Do Not Do These, References |
| `project` | Remote Deployment |
| drop | Lint and Quality, Review Checklist |

### `DOCKER.md` (527 lines, two forks)

| Goes to | Sections |
| --- | --- |
| `tool/docker/DOCKER.md` | What Docker itself dictates: images, layers, build context, users, signals, secrets, scanning |
| `project` | Image Stack Ownership, Dependency Inputs, CUDA, model and artefact handling, HF download, the TRT and vLLM stages: one project's pipeline, not the tool's |
| `tool/nginx/NGINX.md` | nginx and Edge Containers |
| drop | Security Scanning where it names the scanner invocations (gspot owns them) |

### `PLANNING.md`, `TALKING.md`, `WRITING.md`

Whole files, to `general/PLANNING.md`, `general/TALKING.md` and
`general/WRITING.md`. `WRITING.md` from `slopshop` is 20 lines and is the seed;
the prose rules from `DOCUMENTATION.md` above fill it.

### `slopshop/rules/nextjs/*` (nine files)

| Goes to | Files |
| --- | --- |
| `framework/nextjs/NEXTJS.md` | `NEXTJS.md` sections "Next.js application rules" and "Data access, writes, and caching"; `SECURITY.md` whole |
| `library/drizzle/DRIZZLE.md`, `TRPC.md`, `ZOD.md`, `ZUSTAND.md`, `TANSTACKQUERY.md`, `REACTHOOKFORM.md`, `I18N.md` | whole files, one library each |
| `project` | `NEXTJS.md` section "Deployment and runtime" (Cloudflare) |

### What ships, counted

Fourteen general files, sixteen language files, twenty framework files, four
project templates. Sections marked `project` total roughly 1,900 lines across
the forks and never ship as rules. Sections marked `drop` total roughly 2,800
lines, most of it the README template inside `DOCUMENTATION.md` and the
checklists.

## The merge, first pass: done

`reference-rules/merged/` holds the first pass: 45 files, 22,478 lines, built
from the source sections by the inventory above. Every section came from its
canonical fork verbatim, with one edit: the `control` to `command` corruption is
reversed, and it turned out to exist in the `yap-text-inference` fork as well,
so no fork was clean. Checklists, verification-command sections, source-material
notes, tooling-authority sections and project-only sections (module maps, MVVM
stacks, deploy runbooks) are dropped. The README skeletons stay inside
`general/DOCS.md`, where the source had them: they are part of the documentation
standard, not one project's material.

## The merge, second pass: done

The first pass concatenated forks where they differed and let project-specific
text through. The second pass fixed both:

- `framework/` is one folder per framework, named after the preset id:
  `nextjs/`, `i18n/`, `node/` (`HTTP-API.md`,
  `OPENAPI.md`), `express/`, `fastapi/`, `docker/`, `nginx/`, `postgres/`,
  `supabase/`, `drizzle/`, `zod/`, `trpc/`, `tanstack-query/`, `zustand/`,
  `react-hook-form/`, `swiftui/`, `uikit/`,
  `static-site/`, `vitest/`.
- Stacked forks merged: `general/SECRETS.md` is one file with three sections
  instead of three forks; the generic test rules moved from
  `tool/vitest/VITEST.md` into `general/TESTING.md`, and the
  "tests only when asked" rule lives once, in `general/PLANNING.md`; the short
  comment-focused fork at the top of `general/DOCS.md` moved into
  `general/COMMENTS.md`; the "Rules Not Adopted" section (commentary on the
  Google style guide) left `language/TYPESCRIPT.md`; the Python and Bash
  naming sections moved into `language/naming/`, leaving a pointer.
- Project-specific text removed from shipped layers: `yap-landing`'s folder
  layout from `repository/static-site/STATIC-SITE.md`; `yap-text-inference`'s
  include-guard scheme, GPU reset owner and `quality/` tooling mentions from
  `language/BASH.md` and the naming files; `slopshop`'s inference-endpoint
  section from `framework/nextjs/NEXTJS.md`; the dependency bans that
  contradict other presets (no ORMs, no DI containers, no other HTTP
  framework, Express version policy) from `language/TYPESCRIPT.md`, whose
  Express-only "Function Shape" section moved to `framework/express/EXPRESS.md`;
  product words (Yap, Hugging Face, transcripts, "Text Inference API") replaced
  in examples and lists.
- Every link between rule files removed, 43 of them, and the pointer-only
  "Naming" sections that existed to hold such links deleted. "Follow
  `NAMING.md` for test names" is "follow the naming rules for test names".
  Each file is a block that reads whole on its own.
- `ios-app/` split into `swiftui/` and `uikit/`, one framework per folder, no
  "app" suffix and no "iOS" prefix. The Xcode project checks are
  `tool:xcode`, which installs no rule block.
- The 23 "follow the naming rules for X" bullets deleted. Each said nothing
  the naming block does not already say for every name.
- `I18N.md` moved out of `nextjs/` to `shared/i18n/I18N.md`,
  its own block under `library:next-intl`, because the text is generic i18n and
  an Express or FastAPI repository with an i18n library gets it too.

| Layer | Files | Lines |
| --- | ---: | ---: |
| `general/` | 14 | 5,530 |
| `language/` | 6 | 5,813 |
| `language/naming/` | 6 | 1,654 |
| `framework/`, `library/`, `tool/`, `database/`, `platform/`, `repository/`, `shared/` | 20 | 7,397 |

The merge roughly halves the line count. No merged file links to another merged file.

### What the two passes did not do

Each of these is editorial, and the instruction for the pass was to copy and
arrange, not to rewrite.

1. **Modal verbs to imperatives.** The text still uses `should` and `may`
   where the writing rules ban them. The prose lint measures the count; the
   rewrite is a pass of its own.
2. **Heading case.** Headings are in the case their fork used, mostly Title
   Case. The rule says sentence case below H1.
3. **Two documentation sections kept whole.** "Use portable Markdown" and
   "Format text by meaning" in `general/DOCS.md` mix rules with statements a
   formatter owns (fence style, emphasis style, table alignment). Trimming
   inside a section is manual.
4. **Parameterized examples.** Each merged file carries its canonical fork's
   examples. The `<!-- gspot:example lang=... -->` markers are not applied.
5. **Four general files have no source text**: `SUPPRESSIONS.md`,
   `TOOLING.md`, `CONFIGURATION.md`, and the new git rules for `GIT.md`. They
   describe gspot's own mechanisms, which no reference repository had, and
   they are written when those mechanisms exist.
6. **`framework/fastapi/FASTAPI.md` is 1,758 lines**, a full FastAPI guide with 23
   subsections. It is complete rather than long, and it stays.

## The merge, as work

The one part of the design that is editorial rather than mechanical. What the importer automates and
what it does not:

| Step                                                                         | Automated                          |
| ---------------------------------------------------------------------------- | ---------------------------------- |
| Classify every section by layer, using the rules lint's term lists           | yes                                |
| Detect near-duplicate paragraphs across the four forks and pick the longest  | yes                                |
| Detect the Category A rules by matching against the tool-owned decision list | yes                                |
| Rewrite modals to imperatives                                                | no                                 |
| Re-case 164 Title Case headings and fix every contents anchor                | yes                                |
| Resolve C-01 through C-17                                                    | decided here, applied by hand once |
| Split `NAMING.md` at its language headings                                   | yes                                |
| Extract Category C sections into the project layer templates                 | yes                                |
| Parameterize examples by language                                            | no                                 |
| Write the four new the general layer files                                   | no                                 |

Four of ten steps are editorial. That is the honest cost, and it is why the corpus merge is its own
roadmap phase and why the gate ships before it.
