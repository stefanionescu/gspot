---
title: "Structure"
description: "The structural rules no standard linter ships, over every language: wrappers, barrels, lone files, private-first order, and the size limits."
---

The structural rules no standard linter ships, over every language: wrappers, barrels, lone files, private-first order, and the size limits.

Kind: repository.

## Tools

- ast-grep 0.45.3

## Checks

| Check                                                                                        | Stage  | What it finds                                                                                                                                             |
| -------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`structure/single-file-folder`](/reference/rules/structure/single-file-folder/)             | commit | Finds a folder that holds one code file and nothing else.                                                                                                 |
| [`structure/prefix-collisions`](/reference/rules/structure/prefix-collisions/)               | commit | Finds sibling files that share a name prefix, like asset-card, asset-list and asset-row in one folder.                                                    |
| [`structure/file-directory-collision`](/reference/rules/structure/file-directory-collision/) | commit | Finds a file and a folder in the same place with the same stem, like turn.ts beside turn/.                                                                |
| [`structure/folder-names`](/reference/rules/structure/folder-names/)                         | commit | Finds a folder named after a container word like common, core, helpers or utils, or after a language.                                                     |
| [`integrity/baselines-current`](/reference/rules/integrity/baselines-current/)               | commit | Checks that every baseline names a check that still runs and that every file in a tool's suppressions file is still tracked.                              |
| [`integrity/config-purity`](/reference/rules/integrity/config-purity/)                       | commit | Checks that every module under the config role holds literals only: no function, no control flow, no call, no value import from outside the config roots. |
| [`integrity/suppressions`](/reference/rules/integrity/suppressions/)                         | commit | Counts every inline suppression by form and reports each one that carries no reason; nosemgrep is refused outright.                                       |
| [`integrity/allowlists-match`](/reference/rules/integrity/allowlists-match/)                 | commit | Checks that every path pattern in gspot.toml matches at least one tracked file.                                                                           |
| [`integrity/task-policy`](/reference/rules/integrity/task-policy/)                           | commit | Checks that the runner surface holds every task gspot writes and that the installed hooks exist, call gspot and are pointed at by core.hooksPath.         |
| [`integrity/large-files`](/reference/rules/integrity/large-files/)                           | commit | Checks that every tracked file over the size limit is stored through LFS or declared with a reason.                                                       |

## Settings

- `limits.file_lines`: The most lines a file may have. Bash counts code lines; the other languages count every line.
- `limits.function_lines`: The most lines one function may have.
- `limits.function_parameters`: The most parameters one function may take.
- `limits.cognitive_complexity`: How hard a function is to follow, by the sonarjs cognitive score.
- `limits.cyclomatic_complexity`: How many paths run through one function.
- `limits.classes_per_file`: The most classes one file may declare.
- `limits.nested_blocks`: How deep blocks may nest inside one function.
- `limits.positional_arguments`: The most positional arguments one Python function may take.
- `limits.branches`: The most branches one function may have.
- `limits.returns`: The most return statements one function may have.
- `limits.statements`: The most statements one function may have.
- `limits.locals`: The most local variables one function may declare.
- `limits.boolean_expressions`: The most boolean operators in one condition.
- `limits.public_methods`: The most public methods one class may have.
- `limits.nested_callbacks`: How deep callbacks may nest.
- `limits.identical_functions`: The fewest lines two function bodies must share before they count as identical.
- `limits.barrel_reexports`: The most re-exports one index file may hold.
- `limits.prefix_collisions`: How many sibling files may share a name prefix before it is a finding.
- `limits.trivial_statements`: A function with this many statements or fewer, used once, is reported as trivial.
- `limits.trivial_ast_nodes`: A function with this many syntax nodes or fewer, used once, is reported as trivial.
- `limits.line_length`: The most characters on one line.
- `limits.file_size_kb`: The largest tracked file, in kilobytes, outside LFS, or a declaration.
- `limits.bash.file_lines`: The most code lines a shell script may have.
- `limits.bash.function_lines`: The most code lines one shell function may have.
- `limits.bash.function_branches`: The most branches one shell function may have.
- `limits.bash.function_nesting`: How deep blocks may nest in one shell function.
- `limits.bash.mutable_assignments`: The most variable assignments one shell function may make.
- `limits.bash.duplicate_min_lines`: The fewest lines two shell functions must share before they count as duplicates.
- `limits.sql.function_lines`: The most lines one SQL function body may have.
- `limits.swift.type_body_length`: The most lines one Swift type body may have.
- `limits.swift.closure_body_length`: The most lines one Swift closure may have.
- `limits.duplication.min_lines`: The fewest lines a copied block must have before jscpd reports it.
- `limits.duplication.min_tokens`: The fewest tokens a copied block must have before jscpd reports it.
- `limits.duplication.threshold_percent`: The most duplicated code a repository may hold, as a percentage.
- `limits.docs.sentence_words`: The most words one sentence of documentation may have.
- `limits.docs.list_item_words`: The most words one list item may have.
- `limits.docs.paragraph_sentences`: The most sentences one paragraph may have.
- `limits.install.min_release_age_days`: How many days a package must have been published before the package manager installs it.
- `structure.reexports`: Whether re-exports are allowed: none, or index-only for libraries with barrels.
- `structure.call_through_allowed`: Functions allowed to forward their arguments to one call, each with a file, a name, and a reason.
- `structure.trivial_exemptions`: Small single-use functions allowed to stay, by path and name, each with a reason.
- `structure.single_file_folder_allowed`: Folders allowed to hold one file, by path, each with a reason.
- `structure.prefix_collision_allowed`: Folders where sibling files may share a prefix, by path, each with a reason.
- `structure.folder_name_allowed`: Folder names from the banned list that this repository keeps, by path, each with a reason.
- `architecture.types_directory`: The directory every type alias lives under; turns on the types placement rules.
- `architecture.roles`: Which elements play the types, config, env, tests, support and runtime roles for the import direction rules.
- `architecture.elements`: The named parts of the code and the paths each covers.
- `architecture.allow`: Which element may import which; an element imports only itself unless a row says otherwise.

## Rule files

- `general/agent/WORKING.md`
