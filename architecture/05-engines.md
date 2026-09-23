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

## Shared enforcement across languages and frameworks

Preserve all existing policies for Swift, JavaScript, TypeScript, and Python. Shared policies
apply across all four languages and their supported frameworks. Framework integration extends
coverage; it does not silently disable the underlying language rules. Folder policies apply
to component files and framework-owned source as well as ordinary language files.

Universal framework enforcement means consistent policy coverage across supported frameworks.
It does not require one language-blind parser or analysis implementation. Use the parser and
rule engine appropriate to each language while preserving the intended protection. Keep
language-specific rules where their semantics differ.

A cleanup may change implementation ownership, but must retain enforcement in every shipped
surface that provides it. A CLI replacement cannot justify removing a rule from
the standalone ESLint plugin. Keep its public rule exports and options. Configure overlapping
checks once per surface so a defect need not produce duplicate diagnostics.

An exception requires an explicit policy decision and a narrow tested scope. Selecting a
framework alone is not permission to disable a shared rule. Tests must report the same intended
defect, accept corrected input, and verify any approved exception in each affected language
and framework. Missing coverage is unfinished work, never a reason to delete the policy.

## Execution ownership

Validate check definitions as explicit external-tool or built-in forms. Reject impossible
combinations when loading the manifest. Resolve the implementation once during planning;
execution uses that resolved plan. Ordinary code owns multistep preparation. Manifests are
policy and tool contracts, not a generic workflow language.

The runner owns executable resolution, versions, environment, working directory, batching,
timeouts, cancellation, output capture, and failure classification. Adapters own discovery,
preparation, and diagnostic interpretation. Ansible, import-linter, Docker, and framework
builds use the same process contract. Delete their repeated process plumbing after migration.
Do not add a forwarding layer in its place.

A command session owns repository observations and justified caches. Share files, scopes,
metadata, and Git state within that session; the next command observes changed inputs.
Required unreadable or malformed input is an error, not an empty collection.
For structured tool reports, missing output, invalid shape, and a fatal exit must not become
`{}`, `[]`, zero counts, or an empty success. Each adapter checks the documented success and
findings exits and validates the required report fields. The process runner cannot decide
whether an ordinary nonzero exit means findings or a tool failure without that tool contract.
Cache keys must include the actual source, policy, tool, and scope inputs they depend on.

Distinguish applicability from execution. Report explicit skips, unavailable platforms, missing
prerequisites, missing tools, and delegated coverage accurately. Validate `reported_by` and
`takes_over` ownership so descriptive coverage never impersonates an executed check.
Infrastructure stays independent of domain check catalogs.

Command arguments must retain boundaries, including spaces, quotes, and empty arguments.
Do not interpret configured build or generator commands with `split(' ')`. Resolve their syntax
in the configuration owner and pass an argument vector to the runner. Retain the public setting
shape unless its owning contract is deliberately changed; add no alternate compatibility field.

Delete forwarding helpers that add no policy, transformation, lifecycle, or external boundary.
Remove internal fallback values for states already excluded by validation or loop invariants.
Keep optional values that are part of the actual contract and guards at input, process, network,
and persistence boundaries. Do not replace a removed wrapper with a generic dispatcher or new
registry. The mandatory trivial-function and trivial-file rules still apply at every level. Required
external callback contracts use narrow, reasoned suppressions; implementation cleanup must not
disable those rules, introduce blanket exemptions, or pad bodies to cross their thresholds.

[implementation ownership](12-repository-layout.md#ownership) assigns implementation ownership. Structure, naming, and
prose each own their analysis; domain checks own project and artifact checks. The runner
produces one result model and aggregate status. Output renders that model for terminals and
structured reports without repeating analysis or reclassifying success.

Preserve intended enforcement when replacing rules. Generated configuration using the pinned
replacement must demonstrate scope, aliases, type-only imports, exemptions, valid cases, and
finding locations before deleting an implementation. If the replacement cannot express the
policy, retain a focused custom rule. Recommended and all share one policy owner; moving a
preference to all preserves it. Cross-language sharing follows proven common operations and
keeps language semantics explicit; no analysis is required to be language-blind.

## 1. Tool runner

Runs external tools. Owns nothing about what they find.

- **File lists, always.** gspot computes the file set (the files git tracks or is about to track, filtered by claims, scope, declarations and ignores) and passes it to the tool.
- **Tools that walk the tree** (`runs = "per-scope"` or `"once"`) receive a generated ignore file that mirrors git's ignored set and the declarations. gspot compares what the tool reported against the list it expected.
- **Explicit configuration.** Every tool receives its config path by flag. Discovery is for
  editors; the runner never relies on it.
- **Concurrency.** Checks within a stage run in parallel up to the CPU count. Checks that share a
  fixer order run in that order under `--fix`.
- **Exit codes.** Native adapters recognize their tool's documented success and findings exits.
  Unexpected exits, fatal diagnostics, and invalid required reports are inability, even when no
  finding was parsed. A count expression cannot hide a failed execution. Repository custom
  commands follow their declared output contract; a failed command cannot pass because output
  is empty. Preserve aggregate exits: success `0`, findings `1`, inability `2`.
- **Result cache.** Each check's verdict is stored under `.gspot/cache/` keyed on the tool
  version, the generated configuration hash and the content hash of every file it read.
  Unchanged inputs skip the run and print `unchanged`.
- **Cache scope.** File-list checks can reuse unchanged inputs; a project-wide check still depends on all its project inputs. `--staged` does not make that cost proportional to the staged file count. The cache is per machine and never tracked.
- **Platforms.** Commands are spawned without a shell. Paths are joined with `node:path` and
  passed to tools in the platform's form. On Windows, npm-installed tools are `.cmd` shims that
  a plain spawn cannot run; `cross-spawn` resolves them without a shell and without quoting by gspot.
- **Missing tool.** The check reports `missing` with the install hint and fails.
- **Skips.** `--skip` prints and records, and no file holds a skip for one machine. A `docker` requirement with
  no daemon fails; a platform requirement (`macos`, `linux`) that does not hold passes as
  skipped.

## 2. The `@gspot/eslint-plugin` package

An ESLint plugin published from the gspot repository and imported by the generated flat config.
Editors run it. The plugin owns structural policies that the pinned tools do not enforce.
Generated configuration selects those tools' rules where they already enforce the policy.
Executed findings establish coverage; a fixed number of plugin rules does not.

The following plugin exports remain available. Generated CLI configuration may select the
listed owner to avoid duplicate findings; standalone plugin coverage remains required.

| Retained plugin rule                | Enforcement owner                      | Behavior retained                                                                                     |
| ----------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `gspot/no-duplicate-barrel-exports` | `import-x/export`                      | Duplicate exported names, including local declarations and nested star exports                        |
| `gspot/no-reexports-outside-index`  | `gspot/no-reexports` with `allowIndex` | Re-exports outside index files when the policy permits index barrels                                  |
| `gspot/no-single-file-folders`      | `structure/single-file-folder`         | Leaf folders holding one code file across Swift, JavaScript, TypeScript, Python, and framework source |
| `gspot/no-prefix-collisions`        | `structure/prefix-collisions`          | Files sharing a name prefix, with the configured threshold and allowances                             |

| Rule                                   | Reports                                                                                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gspot/no-trivial-functions`           | Every implemented function at or below the executable statement threshold                                                                                         |
| `gspot/no-trivial-files`               | A file containing only forwarding, aliases, re-exports, or trivial functions                                                                                      |
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
  kinds, and names no language.
- **An id for each language.** The manifest of each language lists the idea under an id of its
  own, such as `python/trivial-function`. An ignore then holds one language.
- **TypeScript in the editor.** TypeScript keeps its ESLint rules. One table of cases
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
  permitted. Single-file-folder checks also run at `all`.
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

## Acceptance contracts

These clauses specify required behavior. [Remaining work](22-remaining.md) owns status and evidence.

### Acceptance K-207

The pin is the newest ESLint that every shipped plugin supports, which is 9
today. `@eslint/js` and unicorn are pinned at their last version for ESLint 9.

The registry test reads `peerDependencies.eslint` of every pinned plugin and fails a
pin outside one of them. The react setting is `version: 'detect'`.

That registry test.

### Acceptance K-208

The list of code files holds the endings a framework claims, and one ESLint check
reads it. A framework turns a shared rule off in its manifest, with a reason.
Type check, format, style, and names reach a component file.

`CODE` in the template is built from the `claims.extensions` of the selected presets.
A manifest takes `[[rules_off]]` with `rule` and `reason`, and the template renders that list.

`vue/eslint` and `svelte/eslint` go, because `javascript/eslint` reads their files. The vue preset
runs `vue-tsc` and the svelte preset `svelte-check` through `takes_over` of `typescript/tsc`. The
formatting manifest gains `prettier-plugin-svelte` where svelte is selected. Stylelint gains
`postcss-html` for component files. The naming extractor reads the script block of a component
through the offsets its parser gives.

A unit test builds the final ESLint config for `a.ts` and for `A.vue`, and holds that
they differ by exactly the `rules_off` list. A planted Vue file with a long function is a
finding.

### Acceptance K-102

Preserve `no-trivial-functions`, `no-single-file-folders`,
`no-prefix-collisions`, `no-duplicate-barrel-exports`, `no-reexports-outside-index`, and interface
enforcement in `types-placement`, with their public options. Retain the improved
`no-trivial-functions` handling of every implemented function, nested statements, and expression bodies.
Both levels enable trivial-function and trivial-file enforcement. Select one diagnostic owner for each equivalent rule; alternate exports remain usable.

Generated CLI configuration can use `import-x/export`, TypeScript's interface rule,
`no-reexports` with `allowIndex`, and structure-engine folder checks without double reporting.
These selections do not remove standalone plugin capabilities. Preserve narrow Next.js
index-only exceptions without exempting the policy that forbids all re-exports.

Shared policies apply to Swift, JavaScript, TypeScript, Python, and
all their supported frameworks. Language-only file claims missed Vue and Svelte components.
Shared selection must include framework source. Component parsers must receive shared language
rules as well as their framework-specific rules. See
[05-engines.md](#shared-enforcement-across-languages-and-frameworks).

Execute invalid and corrected inputs through the standalone plugin and generated
CLI configurations. Assert check or rule, diagnostic, file, and location. Cover aliases,
type-only imports, approved exemptions, valid code, and repeated runs after files change.
Folder tests cover all four languages and framework source. Preserve process and parser fixes;
do not restore stale global observations merely to restore a rule.

K-188 remains open for import direction and harness imports. Their public rules and policies
stay; any internal consolidation requires equivalent behavior on every shipped surface.

### Acceptance K-307

Keep real boundary validation, but do not turn failed observation into valid empty input or a clean verdict.

Use the existing structured process result to distinguish no Git repository from a failed Git operation. Fall back to a directory walk only after the no-Git case is established. Report permission, corruption, parse, and unexpected I/O errors with their path or command.

Treat `ENOENT` as optional only where the caller's contract permits absence. A tracked deletion remains a change trigger, not an unreadable source to hide. Make one takeover reader return parsed content or its error; retain unsupported formats explicitly instead of a second suffix-based preflight.

No-Git folders still work. A failed Git listing inside a repository does not silently walk a different file set. Unreadable or malformed package JSON reports a failure. Takeover keeps originals after read errors. Missing optional files and deleted tracked paths retain their documented behavior.

### Acceptance K-308

Definitions use `name`; references retain `check`, `preset`, or `rule`. Keep external wire names and existing internal `Policy` terminology. Distinguish actions from predicates, executable `fix_command` from `help`, and failed fixes from unchanged output. Retire synonym replacement campaigns and cosmetic source renames.

### Acceptance K-43

Cache keys cover the actual configuration inputs of the selected check as well as source,
tool, policy, and scope inputs. Share observation hashes within a run and refresh them after
edits. Full-run pruning removes owned verdict entries older than 30 days. Tool build state uses
the platform cache location.

Verify that changing a relevant configuration invalidates the result, changing an unrelated
configuration does not, and stale owned entries are pruned without deleting unrelated files.
The contract does not require a particular session field, hash helper, or module name.

### Acceptance K-53

Initialization detects and proposes once, validates the accepted proposal, then applies it through the lifecycle owner. It runs no checks and has no accidental second application. Verify read-only preview, unchanged authored files, final selection, and absence of check execution.

### Acceptance K-125

One read of the first 4 KB of a file, shared by the three.

`head(path)` opens the file, reads 4,096 bytes, and keeps them on the `TrackedFile`.
`sniff` and `hasBanner` take that buffer.

A unit test with a 50 MB file holds that opening a session reads under 1 MB.

### Acceptance K-138

Share parsing of the same file and grammar within its scope and command session. Naming and structural analyses consume that shared observation while preserving language-specific semantics and source locations. A later session must observe changed content. Verify cross-analysis findings and corrected inputs without requiring a particular helper filename or parser-call count.

### Acceptance K-143

Retain incremental compiler state across command sessions. Manual Swift analysis uses separate clean build state and logs. Verify an unchanged compile preserves its object files, a later defect is reported, and analyzer cleanup never removes incremental state. Native Xcode behavior and platform cache locations need their own acceptance; host timing ratios are not correctness tests.

### Acceptance K-162

Batch committed SQL observations and reuse them within a command session. Respect the deepest scope and configured migration root. Verify immutable migration findings, corrected input, unusual filenames, corrupt Git input, and refresh in a subsequent session. A fixed number of subprocess calls is not the contract.

### Acceptance K-176

Vale runs once for each extension, over paths.

`vale.ini` maps a borrowed extension under `[formats]`, the key Vale has for this:
`sh = py` style lines for the languages Vale does not read. Python, CSS, and every other language
Vale reads go by their own extension. `alerts` takes paths in batches through `fileBatches`.

A unit test with a spy holds one Vale spawn for ten Python files. The prose planted
test holds a finding in a CSS comment.

### Acceptance K-196

A check is at `commit` when it takes the staged files, or when it ends within five
seconds on the planted repository of its preset. Every other check is at `push` or `manual`.

The test runs each commit-stage check on the planted repository of its preset, warm,
and fails one that takes over five seconds with no file list. The type checkers move to `push`.
The commit hook still runs a whole-project check of a project that holds a staged file, where the
manifest marks it `runs = "per-scope"` and it passes the test.

That test. The timed test of a large repository is in [12-repository-layout.md](12-repository-layout.md).

### Acceptance K-156

A check never writes into the tree, never runs `git clean`, and never runs
`git checkout`.

`scratchCopy(input, paths)` copies the named paths into `.gspot/cache/scratch/<check>/`
and returns that folder. The drizzle check copies the schema, the config, and the migrations
folder, runs `generate` there, and compares the two folders. The OpenAPI check runs its command
with the output path inside the scratch folder, and compares the text.

A planted drizzle repository with an untracked `0009_manual.sql` holds that the file
exists after `gspot check --stage push`. The same for an edited, uncommitted `openapi.json`.

### Acceptance K-140

A check whose tool is absent reports `missing` and contributes inability exit `2`. Required
AST search tools follow the shared resolver and process contract. File arguments use shared
bounded batching. An absent tool cannot become an empty match list or clean result.

Verify missing-tool behavior and a corrected run with the required tool available through the
owning checks. Keep diagnostic and file-selection assertions; do not test a removed sentinel
return or prescribe an intermediate helper.

### Acceptance K-157

A check that waits for a setting reports `skipped` and names the setting.

A check in a manifest takes `waits_for = "<setting>"`. `plan.ts` marks the check
`skipped` with the note `set <setting> to turn this on` when the setting is unset, false, or
empty. A static-site check takes `requires = "build"`, which already exists, and a failed build
marks its six checks `skipped` with the note `the site did not build`.

A unit test over the manifests holds that every check that reads a setting with an
empty default declares `waits_for`. A planted Next.js repository holds the `skipped` line.

### Acceptance K-114

The comment works for every check an engine of gspot runs.

A finding carries `engine`, set by `runEngineCheck`. The filter reads that field.

A planted Swift file with `// gspot-ignore swift/... -- reason` holds no finding.

### Acceptance K-246

`integrity/generated-drift` ships in the structure preset at the commit stage. The
name `generated-fresh` leaves every document.

The workflow runs `gspot check`, and the drift check fails a generated file that
differs from what the policy writes.

A planted repository with an edited file under `.gspot/` holds the finding.

### Acceptance K-42

Every spawn of a tool with a file list goes through `fileBatches`, and a fixer that
fails is a line of the fix report.

`run/tool-runner.ts` returns a list of commands for a file list, and the fixer, the
checks, and ast-grep all take their commands from it. Rename the executing function to `runFixer`; return a `FixResult` instead of mutating a caller-owned failure list. Its `plannedCheck` and `workingDirectory` parameters follow [public vocabulary](README.md#glossary). A successful invocation without byte changes is unchanged, not changed.

A unit test with 20,000 long paths holds more than one command, and a planted fixer
that exits 3 holds its line in the report.

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

`fixable` means a supported correction is available. It does not mean that the correction ran or changed bytes.
`runFixer` returns its result instead of mutating a caller-owned `failed` string array.
The caller builds the report. Define changed status by the checked output bytes, not merely
exit zero. Missing tools and failed execution are failures, not an unchanged result.

Reserve `command` for an argument vector and `commandText` for a displayed shell line.
Use `filePaths` for resolved path strings and `patterns` for selectors inside code.
The public `paths` selector field keeps its established spelling. Distinguish absolute
filesystem paths from config-relative paths at their boundary; do not pass either as an
unqualified `root` when both config and Git roots are in scope.

`config` is the repository's settings in public prose. Existing internal `Policy` types and
`policy/` paths remain explicitly identified implementation names, not new public terminology.
A naming policy is the specific naming-rule data, not another name for the complete config.

`coverage` means check coverage when discussing `[coverage]`; use `test coverage` for tests.
A manifest's `[coverage]` table declares required check kinds by extension, and a check's
`coverage` list names the kinds it supplies. Local code calls that list `coverageKinds`.
These replace manifest `[inspections]` and check `inspection` without changing their meaning.

## Required analysis results

An engine can return a direct result or a promise. Execution awaits either form. A selected
analysis must report inability when its parser cannot produce the required tree or statements.
Release trees already created before a later source fails. Share parser initialization promises
across concurrent calls. Serialize observation keys structurally so valid filenames cannot collide.

Required structured reports must contain their declared arrays. Missing or malformed output and
fatal adapter exits are inability, never fabricated findings or empty success. Counted custom-check
failures remain failures after location filtering. Required framework generation cannot suppress
failure based on diagnostic wording. Configured commands preserve quoted and empty arguments.
