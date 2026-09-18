---
title: "Bash"
description: "Shell scripts, hooks and task files: ShellCheck, shfmt, a syntax pass, and the structure rules for shell."
---

Shell scripts, hooks and task files: ShellCheck, shfmt, a syntax pass, and the structure rules for shell.

Kind: language. Requires: `structure`, `naming`, `formatting`, `spelling`.

## Tools

- shellcheck 0.11.0
- shfmt 3.12.0
- bash

## Generated configuration

- `.gspot/shellcheckrc`

## Checks

| Check                                                                                          | Stage  | What it finds                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`bash/syntax`](/reference/rules/bash/syntax/)                                                 | commit | Checks that every shell script parses before anything else runs it.                                                                                                          |
| [`bash/shellcheck`](/reference/rules/bash/shellcheck/)                                         | commit | Runs ShellCheck with every rule on, over every shell script, and the files they source.                                                                                      |
| [`bash/shfmt`](/reference/rules/bash/shfmt/)                                                   | commit | Checks that every shell script is formatted the way shfmt formats it.                                                                                                        |
| [`structure/shell-interpreter`](/reference/rules/structure/shell-interpreter/)                 | commit | Checks the contract every Bash script keeps: the four-line header, strict mode, one main called last, readonly constants, declarative libraries, cleaned-up temporary files. |
| [`structure/doc-comment`](/reference/rules/structure/doc-comment/)                             | commit | Checks that every shell function announces itself in a comment above it that says more than its name.                                                                        |
| [`structure/duplicate-functions`](/reference/rules/structure/duplicate-functions/)             | commit | Finds shell functions with the same body in the same scope.                                                                                                                  |
| [`structure/unused-functions`](/reference/rules/structure/unused-functions/)                   | commit | Finds shell functions no script in the scope calls.                                                                                                                          |
| [`structure/dead-parameters`](/reference/rules/structure/dead-parameters/)                     | commit | Finds shell functions called with arguments they never read.                                                                                                                 |
| [`structure/private-prefix`](/reference/rules/structure/private-prefix/)                       | commit | Checks that a shell function no other file calls starts with an underscore, and that an underscore function is not called from outside.                                      |
| [`structure/private-before-public`](/reference/rules/structure/private-before-public/)         | commit | Checks that underscore functions come before the public ones and main comes last.                                                                                            |
| [`structure/trivial-function`](/reference/rules/structure/trivial-function/)                   | commit | Finds a shell function used once whose body fits the trivial ceiling.                                                                                                        |
| [`structure/call-through`](/reference/rules/structure/call-through/)                           | commit | Finds a shell function whose whole body forwards its arguments to one command.                                                                                               |
| [`structure/file-length`](/reference/rules/structure/file-length/)                             | commit | Checks that no shell script has more code lines than the ceiling.                                                                                                            |
| [`structure/function-length`](/reference/rules/structure/function-length/)                     | commit | Checks that no shell function has more code lines than the ceiling.                                                                                                          |
| [`structure/shell-script-policy`](/reference/rules/structure/shell-script-policy/)             | commit | Finds forwarding wrappers, compatibility aliases, and inline Node in shell scripts.                                                                                          |
| [`structure/shell-embeds`](/reference/rules/structure/shell-embeds/)                           | commit | Finds inline Python, Node and generated-script heredocs in shell scripts.                                                                                                    |
| [`structure/shell-ssh-blocks`](/reference/rules/structure/shell-ssh-blocks/)                   | commit | Checks that multi-line ssh blocks are named, documented, and inside a function.                                                                                              |
| [`structure/shell-config-defaults`](/reference/rules/structure/shell-config-defaults/)         | commit | Finds variable defaults of the form name:-value outside the configuration owners.                                                                                            |
| [`structure/shell-config-guards`](/reference/rules/structure/shell-config-guards/)             | commit | Checks that every configuration owner opens with one include guard nobody else uses.                                                                                         |
| [`structure/shell-boundaries`](/reference/rules/structure/shell-boundaries/)                   | commit | Checks that scripts under the architecture roots declare their boundary and source what they call.                                                                           |
| [`structure/env-access-owner`](/reference/rules/structure/env-access-owner/)                   | commit | Checks that environment variables the owner declares are read elsewhere only through it.                                                                                     |
| [`structure/shell-branches`](/reference/rules/structure/shell-branches/)                       | commit | Counts the branches in each shell function against the ceiling.                                                                                                              |
| [`structure/shell-nesting`](/reference/rules/structure/shell-nesting/)                         | commit | Measures how deep control flow nests in each shell function against the ceiling.                                                                                             |
| [`structure/shell-mutable-assignments`](/reference/rules/structure/shell-mutable-assignments/) | commit | Counts the variable assignments in each shell function against the ceiling.                                                                                                  |
| [`structure/shell-safety`](/reference/rules/structure/shell-safety/)                           | commit | Finds discarded failures, broad process kills, recursive deletes outside their owners, unchecked cd, and sourced state files.                                                |

## Settings

- `tools.bash.doc_style`: How a shell function announces itself: colon means a header line like `# name: what it does`.
- `tools.bash.config_owners`: The scripts allowed to read environment variables with defaults; every other script reads them through these.
- `tools.bash.architecture_roots`: The directories whose scripts carry a Boundary header and source annotations.
- `tools.bash.safety.owners`: The scripts allowed to delete recursively or kill processes; everything else is refused.
- `tools.bash.default_fragments_allowed`: Variable defaults of the form name:-value that appear outside the configuration owners.
- `tools.bash.runtime_header`: The platforms the fourth header line of every script names.

## Rule files

- `language/BASH.md`
- `language/bash/LANGUAGE.md`
- `language/bash/SAFETY.md`
- `language/bash/OPERATIONS.md`
- `language/naming/BASH.md`
