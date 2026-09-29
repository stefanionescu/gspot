# Engines

This document decides the six things inside gspot that produce findings, what each owns, and
where each draws its line against writing original analysis.

```text
                     gspot.toml + kits
                              |
        +----------+----------+-----------+----------+-----------+
        |          |          |           |          |           |
   tool runner  eslint-    structure    naming     prose     integrity
                plugin-     engine      engine     engine     checks
                gspot
        |          |          |           |          |           |
   external    ESLint     tree-sitter  tree-sitter  Vale     git, fs,
   binaries    (editor    WASM +       WASM        (+ ESLint  manifests,
               too)       ast-grep CLI             selectors) lockfiles
```

Every engine returns findings with the same fields: `check`, optional `file`, `line`, `column`, and `rule`, plus `message`, optional `help`, and `fixable`. Fileless failures stay representable. The reporter and the ignore filter never know which engine spoke.

## Shared enforcement across languages and frameworks

Shared policies apply across Swift, JavaScript, TypeScript, Python, and their supported
frameworks. Framework integration extends coverage; it never disables the underlying language
rules, and folder policies apply to component files as to ordinary language files. Universal
enforcement means consistent policy coverage, not one language-blind parser: each language
uses its own parser and rule engine. An exception requires an explicit policy decision and a
narrow tested scope, and tests report the same defect and accept corrected input in each
affected language and framework. Missing coverage is unfinished work, never a reason to delete
the policy.

## Execution ownership

Check definitions are validated as explicit external-tool or built-in forms when the manifest
loads; the implementation is resolved once during planning, and execution uses that plan.
Ordinary code owns multistep preparation: manifests are policy and tool contracts, not a
workflow language.

The runner owns executable resolution, versions, environment, working directory, batching,
timeouts, cancellation, output capture, and failure classification. Adapters own discovery,
preparation, and diagnostic interpretation. A command session owns repository reads and
justified caches; the next command observes changed inputs. Required unreadable or malformed
input is an error, not an empty collection.

For structured tool reports, missing output, invalid shape, and a fatal exit never become `{}`,
`[]`, zero counts, or an empty success. Each adapter checks the documented success and findings
exits and validates the required report fields. Cache keys include the source, policy, tool, and scope inputs they depend on. Applicability
is distinct from execution. Skips, unavailable platforms, missing prerequisites, missing
tools, and delegated coverage are reported as what they are. `reported_by` and `replaces`
ownership is validated, so descriptive coverage never impersonates an executed check.

Configured build or generator commands are argument vectors, resolved in the configuration
owner and never split on spaces. Forwarding helpers that add no policy, transformation,
lifecycle, or external boundary do not exist; neither does a generic dispatcher in their place.
The trivial-function and trivial-file rules apply at every level, and a required external
callback contract uses a narrow, reasoned suppression. Structure, naming, and prose each own
their analysis, and domain checks own project and artifact checks. The runner produces one
result model, and output renders it without repeating analysis or reclassifying success.

## 1. Tool runner

Runs external tools. Owns nothing about what they find.

- **File lists, always.** gspot computes the file set and passes it to the tool: the files
  git tracks or is about to track, filtered by owners, scope, declarations, and ignores.
- **Ignore files for tree walkers.** A tool that walks the tree (`per-scope` or `once`)
  receives a generated ignore file that mirrors the ignored set of git and the declarations.
- **Explicit configuration.** Every tool receives its config path by flag. Discovery is for
  editors; the runner never relies on it.
- **Concurrency.** Checks within a stage run in parallel up to the CPU count. Checks that share
  a fixer order run in that order under `--fix`.
- **Exit codes.** Native adapters recognize their tool's documented success and findings exits.
  Unexpected exits, fatal diagnostics, and invalid required reports are inability, even when no
  finding was parsed. A custom command cannot pass because output is empty. Aggregate exits:
  success `0`, findings `1`, inability `2`.
- **Result cache.** Each check's verdict is stored under `.gspot/cache/` keyed on the tool
  version, the generated configuration hash and the content hash of every file it read. A
  project-wide check still depends on all its project inputs. The cache is per machine.
- **Platforms.** Commands are spawned without a shell. Paths are joined with `node:path` and
  passed to tools in the platform's form; on Windows, `cross-spawn` resolves `.cmd` shims.
- **Missing tool.** The check reports `missing` with the install hint and fails. A `docker`
  requirement with no daemon fails; a platform requirement that does not hold passes as skipped.
- **Snapshots.** A staged or pushed run copies the selected revision to a snapshot, and the
  tools run there from the working tree's installed environment; nothing is relocated.

## 2. The `@gspot/eslint-plugin` package

An ESLint plugin published from the gspot repository and imported by the generated flat config.
Editors run it. The plugin owns the structural policies that the pinned tools do not enforce.
Generated configuration selects the rule of a tool where it already enforces the policy, such
as `import-x/export` for duplicate exports and `import-x/first` for imports after statements.
Executed findings establish coverage; a fixed number of plugin rules does not.

| Rule                                   | Reports                                                                                                                                                                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gspot/no-trivial-functions`           | Every function whose statements, including nested callbacks, stay at or below the threshold. Only an inline value, recursion, a type predicate, an accessor, an override, a decorated or stateful constructor, or an inherited member is exempt |
| `gspot/no-trivial-files`               | A file containing only forwarding, aliases, re-exports, or trivial functions                                                                                                                                                                    |
| `gspot/no-export-only-files`           | A non-index file that only re-exports                                                                                                                                                                                                           |
| `gspot/no-exported-alias-constants`    | `export const A = B` where B is an identifier or member                                                                                                                                                                                         |
| `gspot/max-barrel-reexports`           | More than the limit of re-exports in one index                                                                                                                                                                                                  |
| `gspot/no-index-imports`               | An import path that names an index file or a barrel                                                                                                                                                                                             |
| `gspot/header-comments-before-imports` | A file comment placed after the import block                                                                                                                                                                                                    |
| `gspot/import-layout`                  | Imports not grouped and sorted by statement shape and length                                                                                                                                                                                    |
| `gspot/export-layout`                  | Export statements and the names inside export braces not sorted by length                                                                                                                                                                       |
| `gspot/no-import-comments`             | A comment inside the import block that is not a suppression directive                                                                                                                                                                           |
| `gspot/import-path-style`              | An internal import using the wrong suffix or alias style for its runtime boundary                                                                                                                                                               |
| `gspot/no-cross-folder-imports`        | A relative import that crosses a sibling top-level folder; use the alias                                                                                                                                                                        |
| `gspot/no-cross-project-imports`       | A relative import that escapes the scope                                                                                                                                                                                                        |
| `gspot/tests-directory-contents`       | A file that is not a test beside test files                                                                                                                                                                                                     |
| `gspot/no-harness-barrel-imports`      | An import from a test-harness barrel                                                                                                                                                                                                            |
| `gspot/registry-instance-only`         | An exported `new` instance outside a `registry.ts` or the `[architecture] config_directory`                                                                                                                                                     |
| `gspot/require-server-only`            | A server module without `import 'server-only'` (Next.js)                                                                                                                                                                                        |
| `gspot/no-client-environment`          | `process.env` in a client module beyond `NEXT_PUBLIC_*` and `NODE_ENV` (Next.js)                                                                                                                                                                |
| `gspot/private-before-public`          | An exported declaration above a non-exported one                                                                                                                                                                                                |
| `gspot/types-placement`                | A type alias, `interface`, or enum-replacement object outside the `[architecture] types_directory`; a runtime export, default export or non-type import inside it                                                                               |
| `gspot/import-direction`               | An import that breaks one of the four shipped direction rules (types, runtime, tests and support, config and env)                                                                                                                               |
| `gspot/no-reexports`                   | Any re-export in application source when `[structure] reexports = "none"`; `allowIndex` keeps index barrels                                                                                                                                     |
| `gspot/env-access-owner`               | `process.env` read outside the declared configuration owner                                                                                                                                                                                     |

Each rule has options for its limits and allowlists, set by the generated config from `[limits]`
and `[[ignore]]`. The trivial-function rule keeps no exemption for shared computation,
contextual signatures, callback properties, or repeated references: a kept function needs a
line suppression whose reason names the external contract. Unused parameters report in every
position by default. Folder shape (single-file folders, prefix collisions) is the structure
engine's, for JavaScript as for every language.

## 3. Structure engine

For every language that is not JavaScript or TypeScript, and for repository-level rules.

- **Parsing.** `web-tree-sitter` with WASM grammars embedded in the binary: bash, python, swift,
  css, html, and the JavaScript family for the naming extractors. SQL parses through
  `libpg-query` compiled to WASM. No native modules.
- **Parse errors are findings.** A tree with an `ERROR` or `MISSING` node fails the file with
  the byte offset and surrounding text. The engine never returns an empty result for a file it
  failed to read.
- **Declarative rules.** ast-grep YAML files under each kit, executed through the ast-grep CLI,
  which gspot pins as a tool. Counted rules run the YAML and gspot counts the matches per file
  or per enclosing function.
- **One parse for a scope.** A source file is parsed once for a scope and a run. The naming
  engine, every structure analysis, and the cross-file index (declarations by file, calls and
  references by name, imports by module) share the trees.
- **One analysis for each idea.** An analysis asks a small table of its language for node
  kinds, and names no language. The manifest of each language lists the idea under an id of
  its own, such as `python/trivial-function`, so an ignore holds one language.
- **One count.** Every line limit counts code lines through one function. The Bash limits
  (branches, nesting, mutable assignments, function and file length) are one check,
  `structure/bash-limits`.
- **Import blocks.** The plugin owns TypeScript imports and export braces. `python/export-order`
  owns `__all__`, and Ruff `I001` with `length-sort` owns Python imports. SwiftFormat
  `sortImports` owns Swift imports. `structure/source-order` owns shell `source` lines. SQL has
  no import block.

| Idea                                                                | Level       | Bash | Python | Swift | TypeScript | SQL |
| ------------------------------------------------------------------- | ----------- | ---- | ------ | ----- | ---------- | --- |
| File and function length                                            | all         | yes  | yes    | yes   | yes        | yes |
| Call-through                                                        | all         | yes  | yes    | yes   | yes        | yes |
| Duplicate functions                                                 | all         | yes  | yes    | yes   | yes        | no  |
| Unused functions, dead parameters                                   | recommended | yes  | yes    | yes   | yes        | no  |
| Import cycles                                                       | recommended | no   | yes    | no    | yes        | no  |
| Folder fields: prefix, file beside folder                           | all         | yes  | yes    | yes   | yes        | yes |
| Shell safety: strict mode, a trap for `mktemp`, a discarded failure | recommended | yes  | no     | no    | no         | no  |
| Environment owner                                                   | all         | yes  | yes    | yes   | yes        | no  |
| Import layout and boundaries                                        | all         | yes  | yes    | yes   | yes        | no  |
| No comment among imports; imports and exports shortest first        | all         | yes  | yes    | yes   | yes        | no  |
| Export-only files, alias constants                                  | all         | no   | yes    | no    | yes        | no  |
| Private before public, doc comment form                             | all         | yes  | yes    | yes   | yes        | no  |
| Script header, config owner, section order                          | all         | yes  | no     | no    | no         | no  |
| Migration documents and section layout                              | all         | no   | no     | no    | no         | yes |

## 4. Naming engine

One policy document, one engine, extractors per language, no emission into other tools.

- **Extractors** (tree-sitter): identifiers by category per language, with files and
  directories everywhere. TypeScript and JavaScript add types, classes, functions, parameters,
  variables, properties, routes, path parameters, and operation ids.
- Python adds modules, packages, classes, exceptions, functions, methods, parameters,
  variables, constants, attributes, and type aliases. Swift adds types, functions, parameters,
  variables, and enum cases. Shell adds functions and variables. SQL adds schemas, tables,
  columns, functions, parameters, indexes, triggers, and policies.
- **Validation** per identifier: length ceiling, word ceiling, digits, duplicate words, banned
  terms, reserved terms, structural prefixes, and external-name and contract-property
  exemptions.
- **Case** is checked by the tool of the language where it has the rule and the template turns
  it on: `@typescript-eslint/naming-convention`, Ruff `N8xx`, SwiftLint `identifier_name` and
  `type_name`, Stylelint `selector-class-pattern`. The engine keeps case for Bash and SQL, and
  for the categories those tools do not cover.
- **Levels:** house-style rules run at `all` only. A naming check at `recommended` demonstrates
  an actual external-contract violation, not a spelling preference. `generate` and `service`
  are permitted.
- **Matching:** split the identifier into parts at case boundaries, underscores and hyphens;
  match banned terms against whole parts, case-insensitively; multi-word terms match
  consecutive parts. `uncommon` does not match `common`.
- **Findings** name the file, line, category, identifier, the term or rule that fired, and the
  policy line that set it. [08-naming-policy.md](08-naming-policy.md) has the schema.

## 5. Prose engine

Vale, driven by gspot, over comments, and documentation.

- gspot renders `.gspot/config/vale.ini` with the `gspot` style, the pinned upstream packages
  (Google, Microsoft, write-good, proselint, alex, RedHat, Harper), and the vocabulary from
  `[prose]`. The `gspot` style is source under `packages/cli/kits/general/prose/styles/`.
- Files with a Vale grammar (Markdown, TypeScript, JavaScript, Swift) go to Vale by path. Shell
  and SQL comments go through stdin under a grammar with the same comment marker, and gspot
  rewrites the reported path.
- Every alert fails, whatever its level. gspot does not trust the Vale exit code.
- Strings are out of reach for Vale. ESLint `no-restricted-syntax` selectors own error message
  capitalization, interpolated identifiers in client messages, and stable log messages. Ruff
  `EM` and `G` families own the Python side. A SwiftLint custom rule owns `///` over `/** */`.
- The banned-term vocabulary is also a Vale substitution list, so a marketing adjective is
  refused in a comment and in an identifier by one list.

## 6. Integrity checks

Repository-level assertions. Each is one function with one test repository. It reads git, or a manifest, and answers one
question. New ones are added when a repository shows a class of
drift nothing catches.

| Check                            | Question                                                                                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `integrity/generated-drift`      | Does every generated file match its render?                                                                                                                                   |
| `integrity/stale-paths`          | Does every path mentioned in prose, comments, config allowlists and ignore lists exist, and does every runner task a document tells the reader to run exist?                  |
| `integrity/allowlists-match`     | Does every path in an allowlist or `[[ignore]]` match at least one tracked file?                                                                                              |
| `integrity/files`                | Does every file in a declared config directory hold only literals?                                                                                                            |
| `integrity/suppressions`         | Does every inline suppression carry a reason, and did the census grow?                                                                                                        |
| `integrity/required-rules`       | Does the resolved configuration of every owned tool still enable every rule the kit requires?                                                                                 |
| `integrity/manifest-policy`      | Exact versions, sorted keys, no range prefixes, no foreign lockfiles, engines match the runtime pin, root packages private, `packageManager` pinned and equal, scripts policy |
| `integrity/install-policy`       | Is the package manager's minimum release age at or above the limit, and a security scanner declared where the manager supports one?                                           |
| `integrity/lockfile-fresh`       | Does the lockfile match the manifest (`bun install --frozen-lockfile --dry-run`, `uv lock --check`)?                                                                          |
| `integrity/dependency-ownership` | Are Python dependencies declared in `pyproject.toml` only, with no stray `requirements*.txt` and no `pip install` outside the allowlist?                                      |
| `integrity/large-files`          | Is every tracked file above the size limit (default 1 MB) under LFS or declared?                                                                                              |
| `integrity/docs-headings`        | Are banned headings (`Project structure`, `File map`) absent?                                                                                                                 |
| `integrity/tsconfig-options`     | Are the required compiler options on?                                                                                                                                         |
| `integrity/typecheck-membership` | Does every governed source file belong to a type-check project?                                                                                                               |
| `integrity/task-policy`          | Do the required runner tasks exist, with no runtime-named folders and no stale paths?                                                                                         |
| `files/env-example`, `secrets/*` | Is no `.env*` file except a template staged, and does every baseline fingerprint carry a reviewed reason?                                                                     |
| `i18n/locales`                   | Do every locale's messages parse as ICU, have no empty values, and match the base locale's keys? Is every message key used?                                                   |
| `integrity/css-usage`            | Is every CSS module class used, and every used class defined?                                                                                                                 |
| `integrity/next-config`          | Does `next.config.*` expose no secret and set no bypass flag?                                                                                                                 |
| `integrity/route-segments`       | Does no route segment hold both a `page` and a `route` file?                                                                                                                  |
| `integrity/security-headers`     | Does `_headers` set the required security headers?                                                                                                                            |

Two jobs that looked like integrity checks are tools instead: relative links and heading
anchors in Markdown go to lychee, and workspace version alignment goes to syncpack.

## What no engine does

- No engine re-implements a rule a maintained tool ships. Complexity, dead exports, cycles,
  import ordering, type checking, and formatting belong to the tools.
- No engine reads a tool's ignore file to guess coverage. gspot hands the list.
- No engine returns success when it failed to run.

## Actions and their results

Use `fixer` for an executable source-correction operation. Use `help` for advice a person
reads. A successful tool invocation does not prove a file changed.

| Concept                                                 | Canonical name                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| Advice on a check or finding                            | `help`; printed as `help:`                                              |
| Executable correction in a manifest or repository check | `fix_command`, with `fix_order`                                         |
| Run one correction                                      | `runFixer(session, plannedCheck, workingDirectory)`                     |
| Result of one correction                                | `FixResult`, with status `changed`, `unchanged`, `failed`, or `skipped` |
| Result of the complete fix pass                         | `FixReport`                                                             |
| Produce generated text in memory                        | `emit` or a specific formatting function                                |
| Write bytes to a destination                            | `write`                                                                 |
| Apply repository configuration                          | `apply`                                                                 |
| Install recorded tools and clone-local hooks            | `install`                                                               |
| Complete results of a check run                         | `report`; one check's execution is a `CheckResult`                      |

`fixable` means a supported correction is available, not that it ran. Changed status is
defined by the checked output bytes, not by exit zero; missing tools and failed execution are
failures. `command` is an argument vector and `commandText` a displayed shell line. `filePaths`
are resolved path strings and `patterns` are selectors; the public `paths` field keeps its
spelling. `coverage` means check coverage when discussing `[coverage]`; tests have `test
coverage`, and a check's list of supplied kinds is `coverageKinds` in code.

## Required analysis results

An engine can return a direct result or a promise, and execution awaits either. A selected
analysis reports inability when its parser cannot produce the required tree or statements,
releases trees created before a later source fails, and shares parser initialization across
concurrent calls. Required structured reports contain their declared arrays; missing or
malformed output and fatal adapter exits report inability and never become fabricated findings
or empty success. Counted custom-check failures remain failures after location filtering.
