# `structure`

Kind: concern. Requires: nothing. Required by every language preset, because it owns the `limits.*`
settings their configurations read. It runs the structural rules no standard linter ships.

## Claims

Every file a language preset claims. The engine dispatches by grammar.

## Checks

One analysis holds each idea, over a small table of node kinds for each language (D-149). The
manifest of each language lists the idea under an id of its own, so a baseline and an ignore hold
one language (D-98). `structure/call-through` reads shell, and the same idea is
`python/call-through`, `swift/call-through`, and `sql/call-through`. TypeScript and JavaScript
keep their ESLint rules, such as `gspot/no-call-through`, so an editor shows them (D-02).

| Idea                                    | Level       | Bash | Python | Swift | TypeScript | SQL |
| --------------------------------------- | ----------- | ---- | ------ | ----- | ---------- | --- |
| File and function length                | recommended | yes  | yes    | yes   | yes        | yes |
| Call-through                            | recommended | yes  | yes    | yes   | yes        | yes |
| Duplicate functions                     | recommended | yes  | yes    | yes   | yes        | no  |
| Unused functions, dead parameters       | recommended | yes  | yes    | yes   | yes        | no  |
| Import cycles                           | recommended | no   | yes    | no    | yes        | no  |
| Environment owner                       | all         | yes  | yes    | yes   | yes        | no  |
| Import layout and boundaries            | all         | no   | yes    | no    | yes        | no  |
| Export-only files, alias constants      | all         | no   | yes    | no    | yes        | no  |
| Private before public, doc comment form | all         | yes  | yes    | yes   | yes        | no  |

Facts about folders hold for every language, and the structure engine alone reports them:
`structure/single-file-folder` (level `all`), `structure/prefix-collisions`,
`structure/file-directory-collision`, and `structure/folder-names`.

The preset also ships the checks over the config and the files gspot writes:
`integrity/policy`, `integrity/generated-drift`, `integrity/baselines-current`,
`integrity/config-purity`, `integrity/suppressions`, `integrity/allowlists-match`,
`integrity/task-policy`, and `integrity/large-files`.

## Settings

Every `[limits]` key in the ledger, at the root or under a language table (`limits.python.file_lines`); `structure.reexports` (`none`, `index-only`);
`structure.trivial_allowed` (language, path, names, reason); `structure.single_file_folder_allowed`
(paths, reason); `structure.prefix_collision_allowed` (paths, reason); `structure.call_through_allowed`
(file, name, reason); `structure.folder_name_allowed` (paths, reason); `architecture.types_directory`;
`architecture.roles`. Every allowance is a loosening and prints.

## Rule files

- `general/agent/WORKING.md` carries the intent each rule enforces.
- `general/code/NAMING.md` "Files and Directories" states the folder, stem, and collision rules.
- `general/code/CONFIGURATION.md` states the environment owner rule.
- Each language file states its private-first, private-prefix, types, and re-export rules.
