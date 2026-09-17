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

Every engine returns the same record: check id, file, line, column, rule, message, and whether
a fixer exists. The reporter, the baseline and the ignore filter never know which engine spoke.

## 1. Tool runner

Runs external tools. Owns nothing about what they find.

- **File lists, always.** gspot computes the file set (tracked files, filtered by claims, scope,
  declarations and ignores) and passes it to the tool. A tool that walks the tree itself
  (`takes = "project"`) receives a generated ignore file that mirrors git's ignored set and the
  declarations, and gspot compares what the tool reported against the list it expected.
- **Explicit configuration.** Every tool receives its config path by flag. Discovery is for
  editors; the runner never relies on it.
- **Concurrency.** Checks within a stage run in parallel up to the CPU count. Checks that share a
  fixer order run in that order under `--fix`.
- **Exit codes.** A non-zero exit is findings unless the check declares `count_regex`, in which
  case the count comes from the output. Output that matches a preset's `tool_errors` pattern is
  reported as "the tool broke" with the remediation text, never as a code finding.
- **Result cache.** Each check's verdict is stored under `.gspot/cache/` keyed on the tool
  version, the generated configuration hash and the content hash of every file it read.
  Unchanged inputs skip the run and print `cache`. `--staged` therefore costs the staged files
  only. The cache is per machine and never tracked.
- **Platforms.** Commands are spawned without a shell. Paths are joined with `node:path` and
  passed to tools in the platform's form. On Windows, npm-installed tools are `.cmd` shims that
  a plain spawn cannot run; `cross-spawn` resolves them, with no shell and no quoting of gspot's
  own.
- **Missing tool.** The check reports `MISSING` with the install hint and fails.
- **Skips.** `gspot.local.toml` skips and `--skip` print and record. A `docker` requirement with
  no daemon fails; a platform requirement (`macos`, `linux`) that does not hold passes as
  skipped.

## 2. eslint-plugin-gspot

An ESLint plugin published from the gspot repository and imported by the generated flat config.
Editors run it. The rules are the 21 JavaScript and TypeScript structural rules the reference
repositories wrote, ported with their tests and their semantics, plus the five gspot adds
(`private-before-public`, `types-placement`, `import-direction`, `no-reexports`,
`env-access-owner`).

| Rule | Reports |
| --- | --- |
| `gspot/no-trivial-functions` | A block-bodied function with two or fewer executable statements, or ten or fewer AST nodes, that only forwards |
| `gspot/no-call-through` | A function that calls one other function or constructor with its own parameters unchanged and in order |
| `gspot/no-trivial-files` | A file whose only runtime behaviour is calling imported values; generated files exempt by banner |
| `gspot/no-export-only-files` | A non-index file that only re-exports |
| `gspot/no-exported-alias-constants` | `export const A = B` where B is an identifier or member |
| `gspot/no-duplicate-barrel-exports` | A name exported twice from one index, including through two `export *` |
| `gspot/no-reexports-outside-index` | A re-export in a file that is not an index |
| `gspot/max-barrel-reexports` | More than the limit of re-exports in one index |
| `gspot/no-index-imports` | An import path that names an index file or a barrel |
| `gspot/no-single-file-folders` | A leaf folder holding one code file |
| `gspot/no-prefix-collisions` | Two or more files in one directory sharing a name prefix, above the threshold |
| `gspot/header-comments-before-imports` | A file comment placed after the import block |
| `gspot/import-layout` | Imports not grouped and sorted by statement shape and length |
| `gspot/import-path-style` | An internal import using the wrong suffix or alias style for its runtime boundary |
| `gspot/no-cross-folder-imports` | A relative import that crosses a sibling top-level folder; use the alias |
| `gspot/no-cross-project-imports` | A relative import that escapes the scope |
| `gspot/no-support-in-dirs` | Non-test support code beside test files |
| `gspot/no-tests-support-imports` | An import from a test-support barrel |
| `gspot/registry-instance-only` | An exported `new` instance outside a `registry.ts` |
| `gspot/require-server-only` | A server module without `import 'server-only'` (Next.js) |
| `gspot/no-client-environment` | `process.env` in a client module beyond `NEXT_PUBLIC_*` and `NODE_ENV` (Next.js) |
| `gspot/private-before-public` | An exported declaration above a non-exported one |
| `gspot/types-placement` | A type alias, `interface`, or enum-replacement object outside the `[architecture] types_directory`; a runtime export, default export or non-type import inside it |
| `gspot/import-direction` | An import that breaks one of the four shipped direction rules (types, runtime, tests and support, config and env) |
| `gspot/no-reexports` | Any re-export in application source when `[structure] reexports = "none"` |
| `gspot/env-access-owner` | `process.env` read outside the declared configuration owner |

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
  CLI (`sg scan --json`), which gspot pins as a tool. Node kinds match tree-sitter's. Rules that
  need a count (barrel ceiling, shell branches, nesting, mutable assignments) run the YAML and
  gspot counts the matches per file or per enclosing function.
- **Cross-file index.** Before any analysis runs, the engine builds one index per scope:
  declarations by file, calls and references by name, imports by module. The trivial-function,
  private-prefix, unused-function and env-access analyses read it. It is built once per run
  and cached with the results.
- **Original analyses.** Kept to what a pattern cannot express, each with the tools searched
  recorded in the manifest:

| Analysis | Languages | Why original |
| --- | --- | --- |
| trivial-function, two forms: forwarding-only (any call count) and single-use with at most two executable statements or ten AST nodes (inline it) | python, swift, bash | Decorator, protocol, dataclass hook, dunder and `main` exemptions plus a cross-module reference count need context a pattern lacks |
| call-through | python, swift, bash | Parameter list and argument list identity |
| private-prefix | python, bash | Compares `__all__` and cross-file call counts with names |
| private-before-public | python, swift, bash | Order of top-level declarations by visibility |
| single-file-folder | all | A directory is not a node |
| prefix-collisions | all | Compares sibling names |
| file-directory-collision | all | A file stem equal to a sibling directory name |
| env-access-owner | python (`os.environ`), swift (`ProcessInfo.processInfo.environment`), bash (`${VAR}` reads of names declared in the owner) | Cross-file: the owner is one declared module |
| file-length, function-length | bash, sql, python (code lines, not raw lines) | Counting code lines excludes blanks, comments, docstrings |
| unused-functions, dead-parameters | bash | No maintained tool exists for shell |
| duplicate-function-bodies | bash, swift | Normalised body comparison across files |
| import graph: cycles, boundaries, layout | python | Contracts across files |
| package exports: `__all__` placement, ceiling, duplicates, alias constants, export-only modules | python | Reads `__all__` contents |
| runtime singletons, lazy export hooks | python | Name and shape combined |
| shell script policy, safety, config defaults, config guards, architecture boundaries, interpreter policy, ssh blocks, heredocs, embeds | bash | Line-level policies over shell that ShellCheck has no rule for |
| migration documentation and section layout | sql | Comment structure around statements |
| HTML copy and script policy | html | Text nodes and attributes |

- **Parse errors are findings.** A tree with an `ERROR` or `MISSING` node fails the file with the
  byte offset and surrounding text. The engine never returns an empty result for a file it
  failed to read.

## 4. Naming engine

The one analysis the reference audit judged not replaceable. One policy document, one engine,
extractors per language, no emission into other tools.

- **Extractors** (tree-sitter): identifiers by category per language. TypeScript and
  JavaScript: files, directories, types, classes, functions, parameters, variables, properties,
  routes, path parameters, operation ids. Python: files, directories, modules, packages,
  classes, exceptions, functions, methods, parameters, variables, constants, attributes, type
  aliases. Swift: files, types, functions, parameters, variables, enum cases. Shell: files,
  directories, functions, variables. SQL: files, schemas, tables, columns, functions,
  parameters, indexes, triggers, policies.
- **Validation** per identifier: case for its category, length ceiling, word ceiling, digits,
  duplicate words, banned terms, reserved terms, structural prefixes, path-scoped rules,
  external-name and contract-property exemptions.
- **Matching:** split the identifier into parts at case boundaries, underscores and hyphens;
  match banned terms against whole parts, case-insensitively; multi-word terms match
  consecutive parts. `uncommon` does not match `common`.
- **Findings** name the file, line, category, identifier, the term or rule that fired, and the
  policy line that set it.

[08-naming-policy.md](08-naming-policy.md) has the schema and the shipped lists.

## 5. Prose engine

Vale, driven by gspot, over comments and documentation.

- gspot renders `.gspot/vale.ini` with the `gspot` style, the pinned upstream packages (Google,
  Microsoft, write-good, proselint, alex, RedHat, Harper), and the vocabulary from `[prose]`.
- Files with a Vale grammar (Markdown, TypeScript, JavaScript, Swift) go to Vale by path.
  Shell and SQL comments go through stdin under a grammar with the same comment marker (`.rb`
  and `.lua`), and gspot rewrites the reported path.
- Every alert fails, whatever its level. gspot does not trust Vale's exit code.
- Strings are out of Vale's reach. Three ESLint `no-restricted-syntax` selectors own error
  message capitalisation, interpolated identifiers in client messages, and stable log messages.
  Ruff `EM` and `G` families own the Python side. A SwiftLint custom rule owns `///` over
  `/** */`.
- The banned-term vocabulary in [08-naming-policy.md](08-naming-policy.md) is also a Vale
  substitution list, so a marketing adjective is refused in a comment and in an identifier by
  one list.

## 6. Integrity checks

Repository-level assertions. Each is small, reads git or a manifest, and answers one question.

| Check | Question |
| --- | --- |
| `integrity/generated-drift` | Does every generated file match its render? |
| `integrity/stale-paths` | Does every path mentioned in prose, comments, config allowlists and ignore lists exist? |
| `integrity/allowlists-resolve` | Does every path in an allowlist or `[[ignore]]` match at least one tracked file? |
| `integrity/config-purity` | Does every file in a declared config directory hold only literals (no functions, control flow, I/O)? |
| `integrity/suppressions` | Does every inline suppression carry a reason, and did the census grow? |
| `integrity/required-rules` | Does the resolved configuration of every owned tool still enable every rule the preset requires? |
| `integrity/manifest-policy` | Exact versions, sorted keys, no range prefixes, no foreign lockfiles, engines match the runtime pin, root packages private, `packageManager` pinned and equal across workspace packages; scripts policy: `any`, `wrappers` (root scripts limited to an approved set, every `bun run X` names an existing script, no `---` section markers, no package script wraps the runner) or `none` |
| `integrity/install-policy` | Is the package manager's minimum release age at or above the limit (bun `minimumReleaseAge`, npm `min-release-age`, pnpm `minimumReleaseAge`)? Is a security scanner declared where the manager supports one? Does the installed tree match the lockfile, version for version, with every peer satisfied? |
| `integrity/lockfile-fresh` | Does the lockfile match the manifest (`bun install --frozen-lockfile --dry-run`, `uv lock --check`)? |
| `integrity/dependency-ownership` | Are Python dependencies declared in `pyproject.toml` only, with no stray `requirements*.txt` and no `pip install` outside the allowlist? |
| `integrity/large-files` | Is every tracked file above the size limit (default 1 MB) under LFS or declared? |
| `integrity/docs-headings` | Are banned headings (`Project structure`, `File map`) absent? |
| `integrity/tsconfig-options` | Are the required compiler options on? |
| `integrity/typecheck-membership` | Does every governed source file belong to a type-check project? |
| `integrity/task-policy` | Do the required runner tasks exist, with no runtime-named folders and no stale paths? |
| `integrity/generated-fresh` | Does running `produced_by` for each declared generated file leave it unchanged? |
| `integrity/baselines-current` | Does every baseline name a rule that exists? |
| `integrity/env-files` | Is no `.env*` file except a template staged? |
| `integrity/locales` | Do every locale's messages parse as ICU, have no empty values, and match the base locale's keys? Is every message key used? |
| `integrity/css-usage` | Is every CSS module class used, and every used class defined? |
| `integrity/next-config` | Does `next.config.*` expose no secret and set no bypass flag? |
| `integrity/route-segments` | Does no route segment hold both a `page` and a `route` file? |
| `integrity/gitleaks-baseline` | Does every baseline fingerprint carry a reviewed reason? |
| `integrity/security-headers` | Does `_headers` set the required security headers? |

Each integrity check is one function with one test fixture. New ones are added when a
repository shows a class of drift nothing catches.

Two jobs that looked like integrity checks are tools instead: relative links and heading
anchors in Markdown go to lychee (`--offline --include-fragments`), and workspace version
alignment, including paired packages, goes to syncpack with a rendered configuration. gspot
writes no analysis a maintained tool already ships.

## What no engine does

- No engine re-implements a rule a maintained tool ships. Complexity, dead exports, cycles,
  import ordering, type checking and formatting belong to the tools.
- No engine reads a tool's ignore file to guess coverage. gspot hands the list.
- No engine returns success when it failed to run.
