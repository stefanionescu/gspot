# Engines

This document decides the six things inside gspot that produce findings, what each owns, and
where each draws its line against writing original analysis.

```text
                     gspot.toml + presets
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

Every engine returns findings with the same fields: `check`, optional `file`, `line`, `column`, and `rule`, plus `message`, optional `help`, and `fixable`. `check` holds a check name. Fileless failures stay representable. The reporter and the ignore filter never know which engine spoke.

## 1. Tool runner

Runs external tools. Owns nothing about what they find.

- **File lists, always.** gspot computes the file set (the files git tracks or is about to track, filtered by claims, scope, declarations and ignores) and passes it to the tool.
- **Tools that walk the tree** (`runs = "per-scope"` or `"once"`) receive a generated ignore file that mirrors git's ignored set and the declarations. gspot compares what the tool reported against the list it expected.
- **Explicit configuration.** Every tool receives its config path by flag. Discovery is for
  editors; the runner never relies on it.
- **Concurrency.** Checks within a stage run in parallel up to the CPU count. Checks that share a
  fixer order run in that order under `--fix`.
- **Exit codes.** A non-zero exit is findings unless the check declares `count_regex`, in which
  case the count comes from the output. Output that matches a preset's `tool_errors` pattern is
  reported as "the tool broke" with the remediation text, never as a code finding.
- **Result cache.** Each check's verdict is stored under `.gspot/cache/` keyed on the tool
  version, the generated configuration hash and the content hash of every file it read.
  Unchanged inputs skip the run and print `unchanged`.
- **Cache scope.** File-list checks can reuse unchanged inputs; a project-wide check still depends on all its project inputs. `--staged` does not make that cost proportional to the staged file count. The cache is per machine and never tracked.
- **Platforms.** Commands are spawned without a shell. Paths are joined with `node:path` and
  passed to tools in the platform's form. On Windows, npm-installed tools are `.cmd` shims that
  a plain spawn cannot run; `cross-spawn` resolves them without a shell and without quoting by gspot.
- **Missing tool.** The check reports `missing` with the install hint and fails.
- **Skips.** `--skip` prints and records, and no file holds a skip for one machine (D-173). A `docker` requirement with
  no daemon fails; a platform requirement (`macos`, `linux`) that does not hold passes as
  skipped.

## 2. The `@gspot/eslint-plugin` package

An ESLint plugin published from the gspot repository and imported by the generated flat config.
Editors run it. The plugin owns structural policies that the pinned tools do not enforce.
Generated configuration selects those tools' rules where they already enforce the policy.
Executed findings establish coverage; a fixed number of plugin rules does not.

| Rule                                   | Reports                                                                                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gspot/no-call-through`                | A function that calls one other function or constructor with its own parameters unchanged and in order                                                            |
| `gspot/no-trivial-files`               | A file whose only runtime behavior is calling imported values; generated files exempt by banner                                                                   |
| `gspot/no-export-only-files`           | A non-index file that only re-exports                                                                                                                             |
| `gspot/no-exported-alias-constants`    | `export const A = B` where B is an identifier or member                                                                                                           |
| `import-x/export`                      | A name exported twice, including through two `export *`                                                                                                           |
| `gspot/max-barrel-reexports`           | More than the limit of re-exports in one index                                                                                                                    |
| `gspot/no-index-imports`               | An import path that names an index file or a barrel                                                                                                               |
| `gspot/header-comments-before-imports` | A file comment placed after the import block                                                                                                                      |
| `gspot/import-layout`                  | Imports not grouped and sorted by statement shape and length                                                                                                      |
| `gspot/import-path-style`              | An internal import using the wrong suffix or alias style for its runtime boundary                                                                                 |
| `gspot/no-cross-folder-imports`        | A relative import that crosses a sibling top-level folder; use the alias                                                                                          |
| `gspot/no-cross-project-imports`       | A relative import that escapes the scope                                                                                                                          |
| `gspot/tests-directory-contents`       | A file that is not a test beside test files                                                                                                                       |
| `gspot/no-harness-barrel-imports`      | An import from a test-harness barrel                                                                                                                              |
| `gspot/registry-instance-only`         | An exported `new` instance outside a `registry.ts`                                                                                                                |
| `gspot/require-server-only`            | A server module without `import 'server-only'` (Next.js)                                                                                                          |
| `gspot/no-client-environment`          | `process.env` in a client module beyond `NEXT_PUBLIC_*` and `NODE_ENV` (Next.js)                                                                                  |
| `gspot/private-before-public`          | An exported declaration above a non-exported one                                                                                                                  |
| `gspot/types-placement`                | A type alias, `interface`, or enum-replacement object outside the `[architecture] types_directory`; a runtime export, default export or non-type import inside it |
| `gspot/import-direction`               | An import that breaks one of the four shipped direction rules (types, runtime, tests and support, config and env)                                                 |
| `gspot/no-reexports`                   | Any re-export in application source when `[structure] reexports = "none"`                                                                                         |
| `gspot/env-access-owner`               | `process.env` read outside the declared configuration owner                                                                                                       |

`gspot/newline-after-imports` and `gspot/no-imports-after-statements` are expressed by
`import-x/newline-after-import` and `import-x/first`, which the generated config enables. The
ledger records both.

Each rule has options for its limits and allowlists. The generated config sets them from
`[limits]` and `[[ignore]]`.

## 3. Structure engine

For every language that is not JavaScript or TypeScript, and for repository-level rules.

- **Parsing.** `web-tree-sitter` with WASM grammars embedded in the binary: bash, python, swift,
  css, html, and the JavaScript family for the naming extractors. SQL parses through
  `libpg-query` compiled to WASM. No native modules.
- **Declarative rules.** ast-grep YAML files under each preset, executed through the ast-grep
  CLI (`ast-grep scan --json`), which gspot pins as a tool. Node kinds match tree-sitter's.
- **Counted rules.** Rules that need a count (barrel ceiling, shell branches, nesting, mutable assignments) run the YAML and gspot counts the matches per file or per enclosing function.
- **One parse for a scope.** A source file is parsed once for a scope and a run. The naming
  engine, every structure analysis, and the cross-file index share the trees.
- **Cross-file index.** Before any analysis runs, the engine builds one index for each scope:
  declarations by file, calls and references by name, and imports by module.
- **One analysis for each idea.** An analysis asks a small table of its language for node
  kinds, and names no language (D-149).
- **An id for each language.** The manifest of each language lists the idea under an id of its
  own, such as `python/call-through`. An ignore then holds one language (D-98).
- **TypeScript in the editor.** TypeScript keeps its ESLint rules (D-02). One table of cases
  holds both implementations to the same answers.
- **One count.** Every line limit gspot owns counts code lines, through one function.

| Idea                                                                | Level       | Bash | Python | Swift | TypeScript | SQL |
| ------------------------------------------------------------------- | ----------- | ---- | ------ | ----- | ---------- | --- |
| File and function length                                            | all         | yes  | yes    | yes   | yes        | yes |
| Call-through                                                        | all         | yes  | yes    | yes   | yes        | yes |
| Duplicate functions                                                 | all         | yes  | yes    | yes   | yes        | no  |
| Unused functions, dead parameters                                   | recommended | yes  | yes    | yes   | yes        | no  |
| Import cycles                                                       | recommended | no   | yes    | no    | yes        | no  |
| Folder facts: prefix, file beside folder                            | all         | yes  | yes    | yes   | yes        | yes |
| Shell safety: strict mode, a trap for `mktemp`, a discarded failure | recommended | yes  | no     | no    | no         | no  |
| Environment owner                                                   | all         | yes  | yes    | yes   | yes        | no  |
| Import layout and boundaries                                        | all         | no   | yes    | no    | yes        | no  |
| Export-only files, alias constants                                  | all         | no   | yes    | no    | yes        | no  |
| Private before public, doc comment form                             | all         | yes  | yes    | yes   | yes        | no  |
| Script header, config owner, section order                          | all         | yes  | no     | no    | no         | no  |
| Migration documents and section layout                              | all         | no   | no     | no    | no         | yes |
| HTML copy and inline scripts                                        | all         | no   | no     | no    | no         | no  |

- **Parse errors are findings.** A tree with an `ERROR` or `MISSING` node fails the file with the
  byte offset and surrounding text. The engine never returns an empty result for a file it
  failed to read.

## 4. Naming engine

The one analysis the reference audit judged not replaceable. One policy document, one engine,
extractors per language, no emission into other tools.

- **Extractors** (tree-sitter): identifiers by category per language.
    - TypeScript and JavaScript: files, directories, types, classes, functions, parameters, variables, properties, routes, path parameters, operation ids.
    - Python: files, directories, modules, packages, classes, exceptions, functions, methods, parameters, variables, constants, attributes, type aliases.
    - Swift: files, types, functions, parameters, variables, enum cases.
    - Shell: files, directories, functions, variables.
    - SQL: files, schemas, tables, columns, functions, parameters, indexes, triggers, policies.
- **Validation** per identifier: case for its category, length ceiling, word ceiling, digits,
  duplicate words, banned terms, reserved terms, structural prefixes, path-scoped rules,
  external-name and contract-property exemptions.
- **Levels:** house-style case, length, word-count, digit, ordering, banned-term, reserved-term, and folder-name rules run at `all`
  only. Prose and tool-template copies follow the same level. `generate` and `service` are
  permitted (D-174). Single-file-folder checks also run at `all`.
- **Recommended findings:** a naming check must demonstrate an actual external-contract
  violation, not a spelling preference.
- **Matching:** split the identifier into parts at case boundaries, underscores and hyphens;
  match banned terms against whole parts, case-insensitively; multi-word terms match
  consecutive parts. `uncommon` does not match `common`.
- **Findings** name the file, line, category, identifier, the term or rule that fired, and the
  policy line that set it.

[08-naming-policy.md](08-naming-policy.md) has the schema and the shipped lists.

## 5. Prose engine

Vale, driven by gspot, over comments, and documentation.

- gspot renders `.gspot/vale.ini` with the `gspot` style, the pinned upstream packages (Google,
  Microsoft, write-good, proselint, alex, RedHat, Harper), and the vocabulary from `[prose]`.
- Files with a Vale grammar (Markdown, TypeScript, JavaScript, Swift) go to Vale by path.
  Shell and SQL comments go through stdin under a grammar with the same comment marker (`.rb`
  and `.lua`), and gspot rewrites the reported path.
- Every alert fails, whatever its level. gspot does not trust the Vale exit code.
- Strings are out of reach for Vale. Three ESLint `no-restricted-syntax` selectors own error
  message capitalization, interpolated identifiers in client messages, and stable log messages.
  Ruff `EM` and `G` families own the Python side. A SwiftLint custom rule owns `///` over
  `/** */`.
- The banned-term vocabulary in [08-naming-policy.md](08-naming-policy.md) is also a Vale
  substitution list, so a marketing adjective is refused in a comment and in an identifier by
  one list.

## 6. Integrity checks

Repository-level assertions. Each is small, reads git or a manifest, and answers one question.

| Check                             | Question                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `integrity/generated-drift`       | Does every generated file match its render?                                                                                                                                                                                                                                                                                                                                              |
| `docs/stale-paths`                | Does every path mentioned in prose, comments, config allowlists and ignore lists exist, and does every runner task or script a document tells the reader to run exist?                                                                                                                                                                                                                   |
| `integrity/allowlists-match`      | Does every path in an allowlist or `[[ignore]]` match at least one tracked file?                                                                                                                                                                                                                                                                                                         |
| `integrity/config-purity`         | Does every file in a declared config directory hold only literals (no functions, control flow, I/O)?                                                                                                                                                                                                                                                                                     |
| `integrity/suppressions`          | Does every inline suppression carry a reason, and did the census grow?                                                                                                                                                                                                                                                                                                                   |
| `javascript/required-rules`       | Does the resolved configuration of every owned tool still enable every rule the preset requires?                                                                                                                                                                                                                                                                                         |
| `dependencies/manifest-policy`    | Exact versions, sorted keys, no range prefixes, no foreign lockfiles, engines match the runtime pin, root packages private, `packageManager` pinned and equal across workspace packages; scripts policy: `any`, `wrappers` (root scripts limited to an approved set, every `bun run X` names an existing script, no `---` section markers, no package script wraps the runner) or `none` |
| `dependencies/install-policy`     | Is the package manager's minimum release age at or above the limit (bun `minimumReleaseAge`, npm `min-release-age`, pnpm `minimumReleaseAge`)? Is a security scanner declared where the manager supports one? Does the installed tree match the lockfile, version for version, with every peer satisfied?                                                                                |
| `dependencies/lockfile-fresh`     | Does the lockfile match the manifest (`bun install --frozen-lockfile --dry-run`, `uv lock --check`)?                                                                                                                                                                                                                                                                                     |
| `dependencies/ownership`          | Are Python dependencies declared in `pyproject.toml` only, with no stray `requirements*.txt` and no `pip install` outside the allowlist?                                                                                                                                                                                                                                                 |
| `integrity/large-files`           | Is every tracked file above the size limit (default 1 MB) under LFS or declared?                                                                                                                                                                                                                                                                                                         |
| `docs/headings`                   | Are banned headings (`Project structure`, `File map`) absent?                                                                                                                                                                                                                                                                                                                            |
| `typescript/tsconfig-options`     | Are the required compiler options on?                                                                                                                                                                                                                                                                                                                                                    |
| `typescript/typecheck-membership` | Does every governed source file belong to a type-check project?                                                                                                                                                                                                                                                                                                                          |
| `integrity/task-policy`           | Do the required runner tasks exist, with no runtime-named folders and no stale paths?                                                                                                                                                                                                                                                                                                    |
| `secrets/env-files`               | Is no `.env*` file except a template staged?                                                                                                                                                                                                                                                                                                                                             |
| `i18n/locales`                    | Do every locale's messages parse as ICU, have no empty values, and match the base locale's keys? Is every message key used?                                                                                                                                                                                                                                                              |
| `css/usage`                       | Is every CSS module class used, and every used class defined?                                                                                                                                                                                                                                                                                                                            |
| `integrity/next-config`           | Does `next.config.*` expose no secret and set no bypass flag?                                                                                                                                                                                                                                                                                                                            |
| `integrity/route-segments`        | Does no route segment hold both a `page` and a `route` file?                                                                                                                                                                                                                                                                                                                             |
| `secrets/gitleaks-baseline`       | Does every baseline fingerprint carry a reviewed reason?                                                                                                                                                                                                                                                                                                                                 |
| `integrity/security-headers`      | Does `_headers` set the required security headers?                                                                                                                                                                                                                                                                                                                                       |

Each integrity check is one function with one test repository. New ones are added when a
repository shows a class of drift nothing catches.

Two jobs that looked like integrity checks are tools instead. Relative links and heading anchors in Markdown go to lychee (`--offline --include-fragments`). Workspace version alignment, including paired packages, goes to syncpack with a rendered configuration. gspot
writes no analysis a maintained tool already ships.

## What no engine does

- No engine re-implements a rule a maintained tool ships. Complexity, dead exports, cycles,
  import ordering, type checking, and formatting belong to the tools.
- No engine reads a tool's ignore file to guess coverage. gspot hands the list.
- No engine returns success when it failed to run.
