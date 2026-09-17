# structure

Kind: repository. Required by every language preset. Runs the structural rules no standard
linter ships, over every language, from one engine and one `[limits]` table.

## Claims

Every file a language preset claims. The engine dispatches by grammar.

## Checks

| Id | Languages | Mechanism |
| --- | --- | --- |
| `structure/trivial-function` | ts, js (ESLint plugin); py, swift, bash, sql (engine) | two forms: a function that only forwards, at any use count; a single-use function (one reference across the scope) with at most `[limits] trivial_statements` statements or `trivial_ast_nodes` nodes, reported as "inline it"; language exemptions |
| `structure/call-through` | ts, js (plugin); py, swift, bash (engine) | parameters forwarded unchanged and in order to one call |
| `structure/private-prefix` | py, bash (engine) | `_` on every name the file does not publish |
| `structure/private-before-public` | ts, js (plugin plus `import-x/exports-last`); py, swift, bash (engine) | private declarations first, public last; `main` and `__all__` last |
| `structure/types-placement` | ts, js (plugin) | type aliases under `[architecture] types_directory`; type-only imports and no runtime exports there |
| `structure/import-direction` | ts, js (plugin); py (engine, through import-linter contracts rendered from `[architecture] roles`) | the four shipped direction rules |
| `structure/env-access-owner` | ts, js (plugin); py, swift, bash (engine) | environment reads only in the declared owner |
| `structure/file-directory-collision` | all | a file stem equal to a sibling directory |
| `structure/trivial-file` | ts, js (plugin) | only calls imported values |
| `structure/export-only-file` | ts, js (plugin); py (engine, `__init__.py` exempt) | only re-exports |
| `structure/exported-alias-constants` | ts, js (plugin); py (engine) | `export const A = B` |
| `structure/duplicate-barrel-exports` | ts, js (plugin); py (engine) | a name exported twice |
| `structure/reexports-in-index-only` | ts, js (plugin) | re-export outside an index (`[structure] reexports = "index-only"`) |
| `structure/no-reexports` | ts, js (plugin) | any re-export in application source (`[structure] reexports = "none"`, the default) |
| `structure/barrel-ceiling` | ts, js (plugin); py (engine) | `[limits] barrel_reexports` |
| `structure/no-index-imports` | ts, js (plugin) | import of an index path |
| `structure/single-file-folder` | all | one code file in a leaf folder |
| `structure/prefix-collisions` | all | siblings sharing a prefix at or above `[limits] prefix_collisions` |
| `structure/header-comments-before-imports` | ts, js (plugin); py, swift (ast-grep) | file comment after imports |
| `structure/import-layout` | ts, js (plugin); py (engine) | grouping and order |
| `structure/exports-at-bottom` | py (engine) | `__all__` last |
| `structure/doc-comment` | bash (engine); ts through `jsdoc/require-jsdoc`; py through Ruff `D100` to `D107` and pydoclint; swift through SwiftLint `missing_docs` | every public function documented |
| `structure/duplicate-functions` | bash, swift (engine); ts through sonarjs; py through jscpd | identical bodies at or above `[limits] identical_functions` |
| `structure/unused-functions`, `dead-parameters` | bash (engine); ts knip; py vulture; swift Periphery | unreachable declarations |
| `structure/file-length`, `function-length` | bash, sql, py code lines (engine); ts, swift through their linters | `[limits]`; sql function bodies against `sql.function_lines` |
| `structure/classes-per-file` | py (engine); ts, js through `max-classes-per-file`; swift through `one_declaration_per_file` | `[limits] classes_per_file` |
| `structure/folder-names` | all | no folder named `common`, `core`, `helper(s)`, `util(s)`, `support`, `misc`, `shared`, or after a language or runtime (`bash`, `javascript`, `python`, `node`, `js`) |
| `structure/no-singletons`, `no-lazy-exports`, `import-boundary`, `import-cycles`, `package-exports`, `placeholder-docstring` | py (engine) | see python |
| the shell family | bash (engine, ast-grep) | see bash |
| `structure/sql-migration-docs`, `sql-no-block-comments` | sql (engine) | see postgres and sql |
| `structure/html-copy`, `html-scripts` | html (engine) | see html |
| `structure/no-blocking-io-in-async` | py (ast-grep) | see fastapi |

## Settings

Every `[limits]` key in the ledger, at the root or under a language table (`limits.python.file_lines`); `structure.reexports` (`none`, `index-only`);
`structure.trivial_exemptions` (language, path, names, reason); `structure.single_file_folder_allowed`
(paths, reason); `structure.prefix_collision_allowed` (paths, reason); `structure.call_through_allowed`
(file, name, reason); `structure.folder_name_allowed` (paths, reason); `architecture.types_directory`;
`architecture.roles`. Every allowance is a loosening and prints.

## Rule files

`general/agent/WORKING.md` carries the intent each rule enforces; `general/code/NAMING.md` "Files and
Directories" states the folder, stem, and collision rules; `general/code/CONFIGURATION.md` states the
environment owner rule; each language file states its private-first, private-prefix, types, and
re-export rules.
