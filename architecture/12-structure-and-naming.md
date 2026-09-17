# Structure and Naming

The rules the reference repositories wrote code for, and the mechanisms that express them without
code. This is the largest single reduction in the design: eighteen structural rules implemented four
times across four repositories, plus a naming policy implemented three times, become
configuration, declarative rule files and one policy document.

The instruction this answers: keep every rule, because they exist to kill slop and ban specific
terms, and write as little original code as possible.

## Why it exists

The adoption test for a bespoke check: **it survives only when no maintained tool expresses the
rule.** Applied to the reference set, the rules below survive, and the evidence that they are real is
that three independent codebases implemented the same set without sharing code:

| Rule                                         | `yap-swift-app`                                                         | `slopshop`                                | `yap-text-inference`                                    |
| -------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| File length                                  | `config/limits.js` `MAX_FILE_LINES`                                     | `config/tooling/limits.mjs`               | `python/rules/module_length.py`                         |
| Function length                              | `functions/`                                                            | `shared/shell/checks/length.mjs`          | `python/rules/function_length.py`                       |
| Trivial file                                 | `local/no-trivial-files.js`                                             | `plugin/rules/no-trivial-files.mjs`       | none                                                    |
| Trivial function                             | `local/no-trivial-functions.js`                                         | `plugin/rules/no-trivial-functions.mjs`   | `workspace/shell/trivial-functions.mjs` (in `slopshop`) |
| Export-only file                             | `local/no-export-only-files.js`                                         | `plugin/rules/export-only-files.mjs`      | `python/rules/imports/exports.py`                       |
| Single-file folder                           | `local/no-single-file-folders.js`                                       | `plugin/rules/no-lone-files.mjs`          | `python/rules/single_file_folders.py`                   |
| Prefix collisions                            | `local/no-prefix-collisions.js`                                         | `plugin/rules/no-prefix-collisions.mjs`   | `python/rules/prefix_collisions.py`                     |
| Barrel re-export ceiling                     | `local/max-barrel-reexports.js`                                         | `plugin/rules/max-barrel-reexports.mjs`   | none                                                    |
| Re-exports only in index                     | `local/no-reexports-outside-index.js`                                   | `plugin/rules/index-only-reexports.mjs`   | none                                                    |
| Duplicate barrel exports                     | `local/no-duplicate-barrel-exports.js`                                  | `plugin/rules/no-barrel-duplicates.mjs`   | none                                                    |
| No index imports                             | `local/no-index-imports.js`                                             | `plugin/rules/no-index-imports.mjs`       | none                                                    |
| Import layout                                | `local/import-layout.js`                                                | `plugin/rules/import-layout.mjs`          | `python/rules/imports/layout.py`                        |
| Import path style                            | `local/import-path-style.js`                                            | `plugin/path-policy/`                     | none                                                    |
| Cross-boundary imports                       | `local/no-cross-project-imports.js`, `local/no-cross-folder-imports.js` | `eslint/boundary-plugin.mjs`              | `python/rules/imports/boundary.py`                      |
| Header comments before imports               | `local/header-comments-before-imports.js`                               | `plugin/rules/header-comment-order.mjs`   | none                                                    |
| Exported alias constants                     | `local/no-exported-alias-constants.js`                                  | `plugin/rules/no-alias-exports.mjs`       | none                                                    |
| Call-through                                 | `local/no-call-through.js`                                              | none                                      | none                                                    |
| Exports at the bottom                        | none                                                                    | none                                      | `python/rules/all_at_bottom.py`                         |
| Duplicate functions                          | `shell/` duplicate-functions                                            | none                                      | `shell/checks/duplicate_functions.py`                   |
| Unused functions                             | `shell/` unused-functions                                               | none                                      | `shell/checks/unused_functions.py`                      |
| Doc comment required                         | `config/shell.js` `SHELL_DOC_COMMENT_REGEX`                             | `shared/shell/checks/docs.mjs`            | `shell/checks/docs.py`                                  |
| Shell branches, nesting, mutable assignments | none                                                                    | none                                      | `shell/checks/complexity.py`                            |
| Disable justification                        | `lint:justify`                                                          | `shared/shell/checks/disable-reasons.mjs` | `shell/checks/disable_justification.py`                 |

Three languages, three implementations, one rule set. The reference audit reaches the same
conclusion independently: "The five file-existence rules are original work. `no-trivial-files`,
`no-trivial-functions`, `no-export-only-files`, `no-single-file-folders` and `no-prefix-collisions`
have no published equivalent." And: "The four barrel rules stay local. `eslint-plugin-barrel-files`
and `eslint-plugin-no-barrel-files` are lightly maintained and express neither re-exports only from
index files nor a re-export ceiling."

## The four extension mechanisms

Ranked by preference. A rule uses the highest mechanism that expresses it.

| Rank | Mechanism                     | Original code | Notes                                                                                                                                                           |
| ---- | ----------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Existing rule, configured** | zero          | The rule already exists in a maintained linter and only needs options.                                                                                          |
| 2    | **Declarative rule file**     | zero          | ast-grep YAML, Semgrep YAML, SwiftLint `custom_rules` regex, `no-restricted-syntax` esquery selectors, ls-lint config, pylint `bad-names-rgxs`. Data, not code. |
| 3    | **Documented plugin API**     | small         | An ESLint rule module, a sqlfluff rule plugin, a stylelint plugin. Original code, but inside somebody else's framework, invoked by their runner.                |
| 4    | **Original check**            | large         | A standalone analyzer gspot owns end to end. Permitted only where 1 to 3 cannot reach.                                                                          |

A rule file is the discovery that changes the design. **ast-grep takes YAML rule files with
`pattern`, `kind`, `regex`, `nthChild`, `inside`, `has`, `precedes`, `follows`, `all`, `any`, `not`,
`matches`, and `constraints` that apply a regex to a captured metavariable**, across Bash, C, C++,
C#, CSS, Elixir, Go, Haskell, HCL, HTML, Java, JavaScript, JSON, Kotlin, Lua, Nix, PHP, Python,
Ruby, Rust, Scala, Solidity, **Swift**, TSX, TypeScript and YAML. Every language the reference
repositories use except SQL.

That means most of the structural rule set becomes a directory of YAML files that works across
TypeScript, Python, Swift and Bash from one authoring format, instead of three parallel
implementations in three repositories.

## The eighteen structural rules, mapped

Each rule has three reference implementations. Where each one lands:

| Rule                                                                                      | Mechanism | How                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **file length**                                                                           | 1         | ESLint `max-lines`; Ruff `PLC0302` plus pylint `max-module-lines`; SwiftLint `file_length`; ast-grep has no line counter, so Bash and SQL use original code (a line count, twelve lines of code)                                                                |
| **function length**                                                                       | 1         | ESLint `max-lines-per-function`; Ruff `PLR0915` `max-statements`; SwiftLint `function_body_length`; Bash and SQL as above                                                                                                                                     |
| **function parameter count**                                                              | 1         | ESLint `max-params`; Ruff `PLR0913` `max-args`; SwiftLint `function_parameter_count`                                                                                                                                                                          |
| **cyclomatic and cognitive complexity**                                                   | 1         | `sonarjs/cognitive-complexity`; Ruff `C901` plus `PLR0912`; SwiftLint `cyclomatic_complexity`                                                                                                                                                                 |
| **nesting depth**                                                                         | 1         | `sonarjs`; pylint `max-nested-blocks`; SwiftLint `nesting`                                                                                                                                                                                                    |
| **trivial function** (2 statements or fewer, or 10 AST nodes or fewer, and forwards only) | 2         | ast-grep: `pattern` for a function whose body is a single `return $CALL(...)` or `$CALL(...)`, with `constraints` excluding declared allowances, plus the finding counter for the node threshold. One YAML file, four language variants.                            |
| **call-through** (calls one function with identical arguments)                            | 2         | ast-grep, same shape with an argument-identity constraint                                                                                                                                                                                                     |
| **trivial file** (one declaration, no logic)                                              | 2         | ast-grep with `not: has: {kind: <statement kinds>}` at file scope, plus `nthChild` to assert a single top-level declaration                                                                                                                                   |
| **export-only file**                                                                      | 2         | ESLint `import-x/no-namespace` does not cover it; ast-grep over the module body, asserting every top-level node is an export                                                                                                                                  |
| **re-exports only in index files**                                                        | 2         | ast-grep rule plus a path constraint, or `no-restricted-syntax` with a `files` glob in the flat config                                                                                                                                                        |
| **duplicate barrel exports**                                                              | 2         | ast-grep `not` over duplicate `$NAME` captures within one file                                                                                                                                                                                                |
| **barrel re-export ceiling**                                                              | 4         | A count over one file. ast-grep reports matches; the ceiling is a count of them, which is `the finding counter <rule> --max 20`. Generic counter, one implementation, every rule can use it.                                                                          |
| **no index imports**                                                                      | 1         | `import-x/no-internal-modules` with `allow`, or `import-x/no-useless-path-segments` plus a `no-restricted-imports` pattern for `**/index`                                                                                                                     |
| **import layout and ordering**                                                            | 1         | `eslint-plugin-perfectionist` `sort-imports` with declared groups. Python: Ruff `I` (isort). Swift: SwiftFormat `sortImports`. Bash: ast-grep.                                                                                                                |
| **blank line after imports**                                                              | 1         | `import-x/newline-after-import` with `count: 1`                                                                                                                                                                                                               |
| **imports before statements**                                                             | 1         | `import-x/first`                                                                                                                                                                                                                                              |
| **header comments before imports**                                                        | 2         | ast-grep `precedes` with `stopBy: neighbor`, one rule per language                                                                                                                                                                                            |
| **import path style** (alias over deep relative)                                          | 1         | `import-x/no-relative-parent-imports` plus `no-restricted-imports` patterns; Python: Ruff `TID252` relative imports                                                                                                                                           |
| **cross-boundary imports**                                                                | 1         | `eslint-plugin-boundaries`; Python: `import-linter` contracts                                                                                                                                                                                                 |
| **import cycles**                                                                         | 1         | `import-x/no-cycle`; Python: `import-linter`                                                                                                                                                                                                                  |
| **exported alias constants** (`export const A = B`)                                       | 2         | `no-restricted-syntax` selector: `ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[init.type="Identifier"]`                                                                                                                                  |
| **exports at the bottom**                                                                 | 1         | `import-x/exports-last`; Python: ast-grep for `__all__` position                                                                                                                                                                                              |
| **single-file folder**                                                                    | 4         | Directory-level, no linter sees it. A tree walk, roughly forty lines.                                                                                                                                                                                         |
| **prefix collisions** (two files sharing a name prefix in one directory)                  | 4         | Directory-level, same walk                                                                                                                                                                                                                                    |
| **duplicate functions**                                                                   | 1         | `sonarjs/no-identical-functions`; Python and Swift and Bash: `jscpd` with a token threshold                                                                                                                                                                   |
| **unused functions**                                                                      | 1         | `knip`; Python: `vulture`; Swift: `periphery`. Bash and SQL: original code, because nothing exists.                                                                                                                                                             |
| **doc comment required**                                                                  | 1         | `jsdoc/require-jsdoc` with contexts; Python: Ruff `D100`-`D107` plus `pydoclint`; Swift: SwiftLint `missing_docs`. Bash: a rule file (ast-grep `precedes` on a comment before a function).                                                                    |
| **suppression justification**                                                             | 1         | `@eslint-community/eslint-comments/require-description`, `reportUnusedDisableDirectives: "error"`; Ruff `PGH003`, `PGH004`; Python `# type: ignore[code]` enforced by basedpyright `reportIgnoreCommentWithoutRule`. Bash and SwiftLint: a rule file (regex). |
| **file and directory naming**                                                             | 1         | **ls-lint**, one config, every language and every path at once.                                                                                                                                                                                               |
| **magic numbers**                                                                         | 1         | `sonarjs/no-magic-numbers`; Ruff `PLR2004`; SwiftLint `no_magic_numbers`                                                                                                                                                                                      |
| **one declaration per file**                                                              | 1         | SwiftLint `one_declaration_per_file`; TypeScript and Python: ast-grep, a rule file                                                                                                                                                                            |
| **commented-out code**                                                                    | 1         | Ruff `ERA001`; `eslint-plugin-unicorn` has no equivalent, so ast-grep with a regex constraint                                                                                                                                                                 |
| **`TODO` discipline**                                                                     | 1         | `unicorn/expiring-todo-comments` (requires an expiry date in the marker); Ruff `TD` family plus `FIX`; `proselint.Annotations` through Vale                                                                                                                   |

Count of rules needing original code: **four**, plus one shared counter and one shared directory
walk. File and function line counts for Bash and SQL, the directory walk that serves both
single-file folders and prefix collisions, and unused functions for Bash and SQL. Against eighteen
rules implemented three times each in the reference set, and a nineteenth (shell complexity)
implemented once.

## The adapter, for what remains

A few rules and one counter cannot be expressed declaratively, because they are directory-level or
count-level rather than node-level. Those use a language adapter that answers a fixed set of
questions about a file.

```text
                 rules/           language-agnostic, 18 rules
                   |
              +----+----+
              |  adapter interface
              |
  +-----------+-----------+-----------+-----------+-----------+
  typescript   python      swift       bash        sql         css
  ts grammar   py grammar  swift       bash        pg          css
```

### The adapter interface

```text
parse(source, path)        -> Tree            rejects ERROR and MISSING nodes
functions(tree)            -> FunctionRecord[]  name, span, statements, params, docComment, exported
declarations(tree)         -> SymbolRecord[]    name, kind, span, exported
imports(tree)              -> ImportRecord[]    specifier, kind, span, names
exports(tree)              -> ExportRecord[]    name, isReexport, source, span
comments(tree)             -> CommentRecord[]   span, text, attachedTo
suppressions(tree)         -> Suppression[]     rule, reason, owner, span
callGraph(tree)            -> Edge[]            local only; cross-file resolution is the runtime's job
```

Every rule is written against these and knows nothing about the language. A new language is one
adapter, not a reimplementation of every rule.

### Grammar choices

| Language                    | Grammar                                  | Notes                                                                                                                    |
| --------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| TypeScript, JavaScript, TSX | `@typescript-eslint/typescript-estree`   | Already the ESLint parser, so the ESLint plugin and the CLI share one tree                                               |
| Python                      | ast-grep with the Python grammar         | See D-05 in [19-decisions.md](19-decisions.md) for the tradeoff against Python's own `ast`                               |
| Swift                       | ast-grep with `@ast-grep/language-swift` | The reference repository planned this and never added the dependency, leaving `functions/swift.js` dead                  |
| Bash                        | ast-grep with `@ast-grep/language-bash`  | Already proven: the grammar found 1,336 names where the regex found 916, and corrected two wrongly merged function pairs |
| SQL, PL pgSQL               | `libpg-query`                            | The real PostgreSQL parser. The reference repository planned this and never added it.                                    |
| CSS                         | `postcss`                                | Already a dependency wherever `language:css` applies                                                                     |

## Parser policy

Three rules, each from a defect.

### 1. A parse error is a lint failure

`tree-sitter-bash` emits an `ERROR` node on `"${hostname%%\]*}"` in one shell file. Neither
`quality/shell/parsers.mjs` nor the naming extractor checks for error nodes, so every function after
that line disappeared from three checks. Four functions that `master` found, the branch found none
of. One file out of 204, silent.

The adapter contract: `parse` walks for `ERROR` and `MISSING` nodes and throws with the path, the
byte offset, the line and the surrounding text. A throw is a check failure, not a warning, and not
an empty result.

A parse failure on a file the grammar cannot handle is therefore visible and actionable: fix the
source, or declare the file. It is never coverage that silently evaporates.

### 2. A parser swap is verified by superset diff

The reference audit's own method, adopted as a test in the extractor suite:

```text
the parity test --baseline <ref> --paths <glob>
```

Runs the old and the new extractor over the tree and requires the new record set to be a superset of
the old. The shell rewrite is the worked example: 1,336 names against 916 is a pass, two corrected
merges are an improvement, and one lost file is the regression that this gate catches and the
reference branch shipped.

### 3. No regex fallback

The reference implementation is half-migrated: `collectShellFunctions`, `duplicate-functions.js` and
the naming extractor walk the AST, while `unused-functions.js` and `docs.js` still match a
declaration regex, and `unused-functions.js` carries a byte-identical copy of `stripShellComments`.
The result is two definitions of "a function" in one codebase.

The adapter is the only way to ask about a file. A rule that needs a regex is a rule whose adapter
question is missing.

## Rule defaults and settings

Each rule states its parameters, its default, and the settings it exposes. Defaults come from
the reference set where all three repositories agree.

Mechanism column: `1` an existing rule configured, `2` a declarative rule file, `3` a documented
plugin API, `4` original code. See 12-structure-and-naming.md for the per-language mapping.

| Rule                             | Mechanism   | Default                                                                                 | Settings                                                           |
| -------------------------------- | ----------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `file-length`                    | 1 / 4       | 300 lines source, 140 shell                                                             | `set.max_file_lines`, `set.max_shell_file_lines`, per-path `set`   |
| `function-length`                | 1 / 4       | 60 lines source, 40 shell                                                               | `set.max_function_lines`                                           |
| `function-params`                | 1           | 5                                                                                       | `set.max_params`                                                   |
| `trivial-file`                   | 2           | fails a file with one declaration and no logic                                          | none                                                   |
| `trivial-function`               | 2           | fails a function of 2 statements or fewer, or 10 AST nodes or fewer, that only forwards and has one caller | `set.trivial_statements`, `set.trivial_nodes`  |
| `export-only-file`               | 2           | fails a file that only re-exports, outside an index                                     | none                                                   |
| `single-file-folder`             | 4           | fails a directory with one source file                                                  | none                                                   |
| `prefix-collisions`              | 4           | fails 2 or more files sharing a 2-part name prefix in one directory                     | `set.threshold`                                  |
| `barrel-ceiling`                 | rule-file + counter | 20 re-exports per index                                                                 | `set.max_reexports`                                                |
| `reexports-in-index-only`        | 2           | on                                                                                      | none                                                   |
| `duplicate-barrel-exports`       | 2           | on                                                                                      | none                                                               |
| `no-index-imports`               | 1           | on                                                                                      | none                                                   |
| `import-layout`                  | 1           | grouped, ordered, one blank line after imports                                          | `set.groups`                                                       |
| `import-path-style`              | 1           | alias over deep relative                                                                | `set.alias_map`                                                    |
| `boundaries`                     | 1           | declared contracts, forbidden-import style                                              | `add.contracts`                                                    |
| `header-comments-before-imports` | 2           | on                                                                                      | none                                                               |
| `exported-alias-constants`       | 2           | fails `export const A = B`                                                              | none                                                               |
| `call-through`                   | 2           | fails a function that only calls one other with the same arguments                      | none                                                 |
| `exports-at-bottom`              | 1           | Python only, `__all__` at the bottom                                                    | none                                                               |
| `private-prefix`                 | 2           | Python: a top-level name not listed in `__all__` starts with `_`, so the list and the prefix cannot disagree. Bash: a function called from no other file starts with `_` | none                                                 |
| `private-before-public`          | 2           | every internal definition sits above the first public one: `_` names in Python and Bash, non-exported declarations in TypeScript and JavaScript; `main` last in Bash | none                                                   |
| `duplicate-functions`            | 1           | fails 3 or more identical function bodies                                               | `set.threshold`                                                    |
| `unused-functions`               | 1 / 4       | cross-file reachability from declared entry points                                      | `add.entry_points`                                                 |
| `doc-comment-required`           | 1 / 2       | exported functions carry a doc comment in the declared shape                            | none                                                 |
| `disable-justification`          | 1 / 2       | every suppression carries a `reason:`                                        | none                                                               |
| `mutable-assignments`            | rule-file + counter | 8 reassignments per function. Shell only.                                               | `set.shell.mutable_assignments`                                    |
| `function-branches`              | rule-file + counter | 8. Shell only, where no complexity tool exists.                                         | `set.shell.function_branches`                                      |
| `function-nesting`               | rule-file + counter | 3. Shell only.                                                                          | `set.shell.function_nesting`                                       |

`boundaries` deserves a note. Three mechanisms exist in the reference set:
`eslint-plugin-boundaries` (TypeScript), `[[tool.importlinter.contracts]]` (Python, nine contracts
declared), and two bespoke ESLint rules (`no-cross-project-imports`, `no-cross-folder-imports`). The
design takes the `import-linter` contract shape as canonical, because it is declarative and
language-agnostic:

```toml
[[structure.contracts]]
name      = "config must not import application implementation"
kind      = "forbidden"
source    = ["config"]
forbidden = ["src.engines", "src.runtime", "src.server"]
```

The engine evaluates these directly for every language, and additionally emits the equivalent
`eslint-plugin-boundaries` config and the equivalent `importlinter` contracts, so the mature tools
enforce them too where they exist. Two enforcers of one declaration, and `gspot explain` prints
the table, so no hand-written prose has to describe it.

## The ESLint plugin, and why it is not in v0

One engine runs the structural rules: ast-grep, over every language. A second path exists on paper,
an ESLint plugin hosting the per-file AST-local rules in process, and its only advantage is editor
feedback: a squiggle while you type rather than a finding at commit.

That advantage is real and it is not v0. A second engine means the same rule written twice, in two
dialects, kept in agreement by a test nobody runs after the first month. It also only ever covers
JavaScript and TypeScript, so it cannot replace the first engine, only shadow part of it.

If it ships later, it ships as a folder inside this package, not a published one. Flat config accepts
a plugin object, so a generated config imports it from `gspot` rather than resolving a package name.

## Limits and thresholds

The instruction notes that limits are shared in spirit across languages. They become one block that
compiles outward:

The reference repositories agree on most values and diverge on four. The divergences are reconciled
below, taking the strictest value in each case, because a limit that one repository already meets is
a limit the others can reach.

```toml
[limits]
file_lines             = 300
function_lines         = 60
function_parameters    = 5
cognitive_complexity   = 8
cyclomatic_complexity  = 8
branches               = 8
returns                = 4
statements             = 30
locals                 = 10
boolean_expressions    = 4
nesting                = 3
public_methods         = 12
barrel_reexports       = 20
identical_functions    = 3
prefix_collisions      = 2
trivial_statements     = 2
trivial_nodes          = 10

[limits.shell]
file_lines             = 140
function_lines         = 40
function_branches      = 8
function_nesting       = 3
mutable_assignments    = 8
```

### The divergences

| Limit                       | `yap-swift-app` | `yap-text-inference` | `yap-landing` | Taken |
| --------------------------- | --------------: | -------------------: | ------------: | ----: |
| `shell.file_lines`          |             140 |                  140 |       **180** |   140 |
| `shell.function_lines`      |             100 |               **40** |           100 |    40 |
| `shell.function_branches`   |          absent |                    8 |        absent |     8 |
| `shell.function_nesting`    |          absent |                    3 |        absent |     3 |
| `shell.mutable_assignments` |          absent |                    8 |        absent |     8 |
| `trivial_nodes`             |          absent |                   10 |        absent |    10 |

Four observations follow, and each changes the design.

1. **`shell.function_lines = 40` against 100 is a 2.5x difference.** The Python service holds shell
   functions to 40 lines and passes. Taking 40 is the strictest-wins rule, and it lands in the
   baseline for the two repositories at 100 rather than as an immediate failure.
1. **`shell.mutable_assignments = 8` is a rule that appears nowhere else in the design.** It caps
   reassignments to a variable inside one shell function, which is a genuinely good anti-slop rule
   for a language with no local scope by default. It is added to the structural rule set,
   expressible as an ast-grep rule plus the generic counter.
1. **`shell.function_branches` and `shell.function_nesting` exist.** So the question is answered by
   evidence rather than by opinion: Bash complexity is worth measuring, one repository already
   measures it with two thresholds, and the ast-grep-plus-counter approach reproduces both with no
   new code.
1. **`trivial_nodes = 10` is a second trivial-function threshold**, counting AST nodes alongside
   statements. A two-statement function that builds a large expression is not trivial, and the
   statement count alone misses that. Both thresholds ship.

| Limit                       | TypeScript                                                                 | Python                      | Swift                      | Bash                  |
| --------------------------- | -------------------------------------------------------------------------- | --------------------------- | -------------------------- | --------------------- |
| `file_lines`                | `max-lines`                                                                | pylint `max-module-lines`   | `file_length`              | gspot counter         |
| `function_lines`            | `max-lines-per-function`                                                   | Ruff `PLR0915`              | `function_body_length`     | gspot counter         |
| `function_parameters`       | `max-params`                                                               | Ruff `PLR0913`              | `function_parameter_count` | pylint has no shell   |
| `cognitive_complexity`      | `sonarjs/cognitive-complexity`                                             | Ruff `C901`                 | `cyclomatic_complexity`    | none                  |
| `branches`                  | `sonarjs`                                                                  | Ruff `PLR0912`              | none                       | none                  |
| `returns`                   | `sonarjs/max-returns`? no: `consistent-return` plus `no-restricted-syntax` | Ruff `PLR0911`              | none                       | none                  |
| `statements`                | `max-statements`                                                           | Ruff `PLR0915`              | none                       | none                  |
| `locals`                    | none                                                                       | pylint `max-locals`         | none                       | none                  |
| `boolean_expressions`       | `sonarjs`                                                                  | pylint `max-bool-expr`      | none                       | none                  |
| `nesting`                   | `max-depth`                                                                | pylint `max-nested-blocks`  | `nesting`                  | ast-grep plus counter |
| `shell.function_branches`   | none                                                                       | none                        | none                       | ast-grep plus counter |
| `shell.mutable_assignments` | none                                                                       | none                        | none                       | ast-grep plus counter |
| `public_methods`            | `max-classes-per-file` plus `no-restricted-syntax`                         | pylint `max-public-methods` | `type_body_length`         | none                  |

The `none` cells are honest gaps, and the coverage check reports them as inspection gaps rather than
pretending a limit applies everywhere.

The Bash rows are not gaps. `yap-text-inference/quality/shell/checks/complexity.py` already measures
branches and nesting, and `quality/config/shell.py` sets both thresholds plus a mutable-assignment
cap. All three reproduce as an ast-grep rule plus the finding counter, which is a rule file and a shared
counter rather than original code. D-05 records it.

## The naming policy

The densest asset and the one most at risk of being reimplemented. Its parts:

| Policy element                                                                                                                               | Reference implementation                     | gspot mechanism                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **103 banned terms**, case-insensitive substring match against identifier parts                                                              | Original extractor plus matcher, three times | **2.** TypeScript: `@typescript-eslint/naming-convention` with `custom: {regex, match: false}`, plus core `id-denylist` for exact names. Python: pylint `bad-names-rgxs`, one regex. Swift: SwiftLint `identifier_name` `excluded` plus a `custom_rules` regex. Bash and SQL: ast-grep regex constraint and a sqlfluff plugin.                |
| **banned duplicate words** in one identifier                                                                                                 | Original                                     | **2.** One regex per language, `(?i)\b(\w+)[A-Z_]?\1\b` shaped per case convention                                                                                                                                                                                                                                                            |
| **banned digits** in identifiers                                                                                                             | Original                                     | **1.** `@typescript-eslint/naming-convention` `format` plus a custom regex; pylint `invalid-name` regexes; SwiftLint `identifier_name`                                                                                                                                                                                                        |
| **max characters** per language (35 TS, 40 Swift, 55 SQL)                                                                                    | Original                                     | **2.** A length bound inside the same `naming-convention` custom regex, `^.{1,35}$`; pylint `*-rgx` with a bounded length; SwiftLint `identifier_name` `max_length`                                                                                                                                                                           |
| **max words** per language (4 TS, 5 Swift, 7 SQL)                                                                                            | Original                                     | **2.** A word-count regex in the same place: at most N case-boundary groups                                                                                                                                                                                                                                                                   |
| **case conventions** per category (files, types, functions, parameters, variables, properties, routes, enum cases, tables, columns, indexes) | Original                                     | **1.** `@typescript-eslint/naming-convention` has a `selector` per category and is strictly more expressive than the policy's category list. pylint has a `*-naming-style` and `*-rgx` per category. SwiftLint has `identifier_name` and `type_name`. sqlfluff has `capitalisation.*` and `references.*`. ls-lint owns files and directories. |
| **reserved terms with allowed uses** (`data`, `message`, `id`)                                                                              | Original                                     | **2.** `naming-convention` with a `filter` and a `files` override, or an ast-grep rule with a path constraint                                                                                                                                                                                                                                 |
| **role-word preferences** (prefer specific verbs over `get`, ban abbreviations)                                                              | Prose only                                   | **1.** `unicorn/prevent-abbreviations` with a custom `replacements` map, which is exactly this rule as a maintained plugin                                                                                                                                                                                                                    |
| **per-path exemptions and `nameRules`**                                                                                                      | Original                                     | **5 settings in `gspot.toml`**, rendered into each tool's native override mechanism                                                                                                                                                                                                                                                              |

The naming policy stops being an engine and becomes **one JSON document that compiles into five tool
configurations**. The compiler is a emitter, not an analyzer: it reads the policy and emits a
`naming-convention` rule array, a pylint regex set, a SwiftLint block, a sqlfluff config and an
ls-lint config.

That is the single largest reduction in the design. The reference set has roughly 2,479 lines under
`naming/` in one repository, 14 files in another and 13 in a third. gspot has one policy document,
one emitter, and no extractor at all, because the tools already extract.

**The tradeoff, stated.** A emitter cannot express everything an engine can. Three known losses:

1. **Cross-file prefix collision** needs the directory walk, original code. Kept.
1. **Per-identifier-kind reporting** gets coarser: pylint reports `disallowed-name` rather than
   naming which banned term matched. The emitter compensates by emitting one rule per term group
   with a distinct message, accepting more config for better diagnostics.
1. **`banDuplicateWords` across case boundaries** is regex-expressible per convention but not in one
   pattern. Five patterns instead of one function.

All three are acceptable. None of them is worth an extractor per language.

## Why a term list works

The rules in `GENERAL.md` that matter most are judgements a linter cannot make: "prefer duplication
over the wrong abstraction", "do not add defensive logic for states that cannot occur", "keep one
clear implementation for each concept". None is mechanisable.

The term list is the mechanisable shadow of those rules. A developer or an agent that adds a
speculative guard names it `ensureConfigIfNeeded`. One that adds a parallel implementation names it
`enhancedHandler`. One that cannot find the owner of a concept creates `utils/common.ts`. **The slop
announces itself in the name**, and banning the name blocks the construct at the only point where it
is visible to a regex.

That is the whole argument, and it is why this list is worth more than its 103 lines suggest.

## The categories

### 1. Vague containers and abstractions (15 terms)

`core`, `common`, `generic`, `misc`, `stuff`, `thing`, `things`, `details`, `info`, `object`,
`data`, `catalog`, `catalogue`, `corpus`, `taxonomy`

**Reason.** A name that describes the container rather than the contents has no owner, so everything
lands in it. `utils/common.ts` and `core/generic.py` are where a codebase goes to stop having an
architecture.

**Notes.** `data` is banned in the Python fork and reserved-with-allowed-uses in the monorepo,
where the API success envelope legitimately has a `data` field. Ships as a reserved term, not a ban.
`catalog` has one path exemption in the reference tree, which is the signal that it belongs in a
lower layer.

### 2. Role words with no role (11 terms)

`helper`, `helpers`, `util`, `utils`, `manager`, `handler`, `processor`, `service`, `wrapper`,
`shim`, `shims`

**Reason.** These name a position in an imagined architecture rather than a behaviour. `NAMING.md`
devotes three sections to `Service`, `Manager` and `Helper and Utility` for this reason. A module
that genuinely mediates a boundary has a name for what it mediates.

**Notes.** The strictest category and the one most likely to need project exemptions, because
frameworks use these words: an Express `handler`, a Kubernetes `manager`, a React `useService`.
Every exemption is scoped to a path or a symbol rather than unbanning the word.

### 3. Marketing and comparative adjectives (17 terms)

`advanced`, `enhanced`, `improved`, `intelligent`, `smart`, `modern`, `robust`, `seamless`,
`ultimate`, `comprehensive`, `optimized`, `reusable`, `final`, `latest`, `old`, `plus`, `combined`

**Reason.** A comparative in a name means a second implementation exists and neither was deleted.
`enhancedParser` beside `parser` is a migration that stopped halfway, recorded in a name instead of
in the code. `final` and `latest` are the same defect with a timestamp.

**Reason, second order.** This category is the highest-signal one for machine-generated code. It is
the vocabulary a model reaches for when asked to improve something it does not want to replace.

### 4. Defensive and hedging names (19 terms)

`ensure`, `maybe`, `likely`, `should`, `if_needed`, `ifneeded`, `ifNeeded`, `if_available`,
`ifavailable`, `if_changed`, `ifchanged`, `if_possible`, `ifpossible`, `or_throw`, `orthrow`,
`waitfor`, `with_retries`, `with retries`, `transient`

**Reason.** These are the names that defensive logic gets. `GENERAL.md` has a section titled "No
Defensive Logic" stating that guards for states that cannot occur under the real contract must not
exist; this category is that rule made checkable. `ensureDirectoryIfNeeded` is a function whose name
admits it does not know whether its own precondition holds.

**Notes.** The strongest category in the list, and the one the other three forks agree on most
closely.

### 5. Ambiguous verbs (21 terms)

`load`, `loaded`, `loader`, `loaders`, `loading`, `fetch`, `render`, `generate`, `sync_`, `_sync`,
`sync-`, `-sync`, `synchronize`, `synchronise`, `materialize`, `materialise`, `coerce`, `resolve`,
`resolving`, `resolution`, `scoped`

**Reason.** Each covers several distinct operations, so the name does not say which happened. `load`
is read-from-disk, deserialize, initialize, fetch-over-network or populate-a-cache. `generate` is push,
pull, reconcile or merge, and `NAMING.md` has a retrieval-and-CRUD section that assigns a specific
verb to each.

**Notes.** The `load`, `resolve` and `loader` family is banned in the Python fork only, because a
model-serving codebase is full of genuine loaders. That is an argument for tiering rather than for
dropping them: they ship in a `verbs-strict` group that is on by default and removable as one unit
with a reason.

### 6. Conjunctions and multi-concept markers (8 terms)

`and`, `or`, `with`, `when`, `what`, `whatever`, `once`, `plus`

**Reason.** `NAMING.md` has a section titled "One Concept per Function Name". A conjunction in a
name is a function doing two things, and the name is the smallest possible warning.

**Notes.** The highest false-positive rate in the list, because the matcher is case-insensitive
substring over identifier parts and English is full of these letters inside other words. This group
needs word-boundary matching against split identifier parts, never raw substring, and it is the one
group where the reference implementation's `caseInsensitive: true` substring match is a hazard
rather than a feature.

### 7. Test slop (12 terms)

`fixture`, `fixtures`, `test case`, `test_case`, `testcase`, `under-test`, `under_test`,
`undertest`, `edge case`, `edge-case`, `edge_cases`, `edge-cases`

**Reason.** `GENERAL.md` has "Test Behavior, Not Values". A test named `testEdgeCases` asserts
nothing nameable, and a `fixtures` directory is category 1 wearing a test costume.

### 8. Project-specific (4 terms, do not ship)

`runpsql`, `postlock`, `prelock`, `values`

**Reason.** `runpsql` is one repository's script, `prelock` and `postlock` are one repository's
migration phases, and `values` is banned globally with eight exemptions for the SQL `VALUES` clause.
All four belong in a consumer settings, and `values` specifically moves into the SQL language
section as a reserved word. See C-14 in [10-rules.md](10-rules.md).

## What ships

| Group             |   Terms | Default     | Removable as a unit            |
| ----------------- | ------: | ----------- | ------------------------------ |
| `containers`      |      15 | on          | yes, with a reason             |
| `roles`           |      11 | on          | yes                            |
| `marketing`       |      17 | on          | no. This group is the product. |
| `defensive`       |      19 | on          | no                             |
| `verbs-core`      |       8 | on          | yes                            |
| `verbs-strict`    |      13 | on          | yes                            |
| `conjunctions`    |       8 | on          | yes                            |
| `test-slop`       |      12 | on          | yes                            |
| **Total shipped** | **103** |             | none                                |
| Project-specific  |       4 | not shipped | none                           |

Two groups cannot be removed wholesale: `marketing` and `defensive`. They are the two that
correspond to rules the corpus states as absolutes, and a repository that wants to permit
`enhancedHandler` is not using this distribution. Individual terms in those groups still take scoped
exemptions, which is the difference between a policy and a wall.

Reserved terms, banned except in named uses:

| Term      | Allowed uses                                 |
| --------- | -------------------------------------------- |
| `data`    | API success envelope field                   |
| `message` | API client message field                     |
| `id`      | identifier word                              |
| `values`  | SQL `VALUES` clause                          |
| `control` | protected against mass replacement, per C-10 |

## Enforcement, with no original matcher

Per 12-structure-and-naming.md, the policy compiles into each tool's own mechanism. One JSON
document, five emitters, no extractor.

| Language               | Mechanism                                                                                                                        | Shape                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript, JavaScript | `@typescript-eslint/naming-convention` with `custom: {regex, match: false}`, one entry per group so each reports its own message | `{selector: "default", custom: {regex: "(?i)(^\|[_-])(helper\|helpers\|util\|utils\|manager\|...)([_-]\|$)", match: false}}`                                       |
| Python                 | pylint `bad-names-rgxs`, reporting `disallowed-name` (C0104), plus `good-names-rgxs` for exemptions                              | One regex per group. Note the pylint bug where a comma inside a regex is mangled by the config parser, so groups are comma-separated and each regex is comma-free. |
| Swift                  | SwiftLint `identifier_name` and `type_name` for case and length, plus `custom_rules` with a regex per group for the terms        | `custom_rules: {banned_role_words: {regex: "...", match_kinds: [identifier]}}`                                                                                     |
| Bash                   | ast-grep with a `regex` constraint on the captured function-name and variable-name metavariables                                 | One YAML rule per group                                                                                                                                            |
| SQL                    | a sqlfluff rule plugin, because ast-grep has no SQL grammar                                                         | One plugin reading the same policy document                                                                                                                        |
| Files and directories  | ls-lint, one config, every language                                                                                              | Case rules plus a blocklist regex                                                                                                                                  |

Matching semantics, fixed once and applied by every emitter, because the reference implementation's
substring match is the one part of the policy with a real defect:

1. **Split the identifier into parts** by case boundary, underscore and hyphen.
1. **Match whole parts only.** `commonPrefix` matches `common`; `uncommon` does not match `common`;
   `andThen` does not match `and`.
1. **Case-insensitive within a part.**
1. **Multi-word terms** (`edge case`, `with retries`) match consecutive parts.
1. **An exemption names an identifier**, not a term, unless a group is removed.

Rule 2 is the correction. `caseInsensitive: true` with substring matching over whole identifiers, as
the reference policy is written, makes the `conjunctions` group a false-positive generator, and the
fifteen `bannedTermExemptions` in the reference tree are mostly that defect leaking (`spawnSync`,
`buildValuesList`, `applyDefaultValues`, `toEnumValues`).

## Extension

The consumer never edits the shipped list. The settings, with a worked
example, are in [06-settings.md](06-settings.md) under "Extending the naming
policy". Two groups, `marketing` and `defensive`, are refused as a unit, because
they are what the distribution is for; individual terms in them still take
scoped exemptions.

## What the structure layer does not do

- **Complexity.** `sonarjs` cognitive complexity for TypeScript, Ruff `C90` and `PL` families for
  Python, SwiftLint `cyclomatic_complexity` for Swift. Three mature implementations, three different
  metrics, and the reference audit already records why not to unify them: "qlty computes a different
  metric from sonarjs, so the numbers are not comparable."
- **Duplication.** `jscpd` and `qlty smells`. `repository:duplication`.
- **Dead exports.** `knip` for TypeScript, `vulture` for Python, `periphery` for Swift. The engine's
  `unused-functions` covers shell and SQL, where no tool exists.
- **Cycles.** `import-x/no-cycle` for TypeScript, `import-linter` for Python. The reference audit's
  decision against dependency-cruiser stands.
- **Type-dependent rules.** Anything needing a type checker belongs to the type checker.

## What remains original, in total

| Component                                              | Estimated lines        | Why nothing else does it                                                                                                                          |
| ------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coverage: tracked files, file listings, statuses, report      | 1,200                  | The product. No linter and no aggregator computes it.                                                                                             |
| Settings: schema, typed merge, direction, limit        | 600                    | The consumer extension surface                                                                                                                    |
| Config emitters, one per tool                         | 900                    | Each is a template plus a provenance header                                                                                                       |
| Naming policy emitter                                 | 300                    | Compiles one policy into five tool configs                                                                                                        |
| Task graph, scheduler, runner emitters                 | 700                    | none                                                                                                                                                   |
| Generic finding counter (the finding counter)                | 80                     | Serves every mechanism-2 rule that needs a ceiling: barrel size, shell branches, shell nesting, mutable assignments, trivial-function node count  |
| Directory walk: single-file folders, prefix collisions | 60                     | Directory-level, invisible to every linter                                                                                                        |
| Line counters for Bash and SQL                         | 60                     | none                                                                                                                                                   |
| Unused-function reachability for Bash and SQL          | 200                    | Nothing exists for either language, and reachability is not expressible as a node pattern                                                         |
| SQL naming, as a sqlfluff rule plugin (a plugin)    | 150                    | ast-grep has no SQL grammar                                                                                                                       |
| ast-grep rule files                                    | 0 code, ~50 YAML files | none                                                                                                                                                   |
| Rules assembler                                        | 300                    | none                                                                                                                                                   |
| Prose runner: grammar dispatch for Vale                | 200                    | none                                                                                                                                                   |
| **Total original analysis code**                       | **~560 lines**         | Four structural rules plus SQL naming. Bash complexity moved to a rule file once `yap-text-inference` showed the thresholds, so it costs nothing. |
| **Total original code**                                | **~4,720 lines**       | Mostly orchestration, rendering and coverage                                                                                                      |

Against the reference `quality/` folders, with the
same rules diverging in each.

## The rule that keeps it this way

A check enters gspot only with a filled row in this table:

```text
rule            structure/trivial-function
mechanism       rule-file  (ast-grep YAML)
searched        eslint core, typescript-eslint, unicorn, sonarjs, import-x,
                perfectionist, ruff, pylint, SwiftLint, ast-grep
verdict         no existing rule expresses "a function whose only statement
                forwards its arguments unchanged"
artifact        presets/repository-structure/rules/trivial-function.{ts,py,swift,sh}.yml
original code   0
```

A row with a plugin or 4 requires the `searched` list and the `verdict`, and those are reviewed
at release. That is how the distribution stays a configuration layer instead of becoming a fifth
`quality/` folder.
