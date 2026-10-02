---
title: Bash Naming
---

# Bash Naming

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

Bash naming follows Google shell guidance, with the overrides below for file stems.

## Bash case rules

<!-- level: all -->

Rules:

- Shell source file stems use `kebab-case` unless an existing tool or external
  command owns the name.
- Executable scripts use `.sh` when invoked through a task runner or build
  rules.
- Executable scripts may omit the extension only when the file is intended to be
  a command on `PATH`.
- Sourced libraries use `.sh` and are not executable.
- Numbered pipeline steps use `NN-description.sh` (`01-install.sh`); the numeric prefix is a
  structural prefix the naming check strips before it matches the stem.
- Functions and mutable variables use `lower_snake_case`.
- Function-local variables use `lower_snake_case`.
- Constants, readonly values, exported environment variables, and externally
  configured values use `UPPER_SNAKE_CASE`.
- Package-like function prefixes may use `::` only when a script family already
  uses that convention.
- Do not use the `function` keyword for new functions. Use `name() { ...; }`.

| Avoid              | Prefer                     | Meaning            |
| ------------------ | -------------------------- | ------------------ |
| `DeployScript.sh`  | `deploy-api.sh`            | API deployment.    |
| `deploy_script.sh` | `upload-storage-assets.sh` | Storage upload.    |
| `helpers.sh`       | `database-branch`          | A command on PATH. |

Name a deployment function `deploy_api` and its local target
`target_environment`. The function must still validate allowed targets and
propagate deployment failures; a clearer name does not establish those contracts.

## Bash variables

<!-- level: all -->

Rules:

- Loop variables describe the item being iterated.
- Use `tmp_dir` or `tmp_file` only for actual temporary filesystem paths.
- Avoid vague names when a domain name is available.
- Avoid shell-reserved and shell-special names for unrelated values.
- Initialize variables before use.
- Prefer explicit empty strings or arrays over relying on unset variables.
- Declare function-specific variables with `local`.
- Separate `local`, `declare`, `readonly`, and `export` from command
  substitutions when the command status matters.

Use `migration_file` when iterating migration paths and `report_output` for
captured report text. Check the report command's exit status before printing
the captured output. A loop variable such as `i` does not describe a file.

## Bash functions

<!-- level: all -->

Rules:

- Function names use verb phrases when the function has side effects.
- Functions that print data to STDOUT are named for the data printed.
- Functions that validate return a status and log errors deliberately.
- Do not name scripts or functions after shell builtins or common commands.
- Do not make function names so generic that logs and stack traces lose context.

Name a project-reference validator `validate_project_ref`. Its validation
criteria belong to the declared provider contract. Avoid `test`, which shadows
a shell builtin, and generic names such as `run` or `process`.

## Bash environment names

<!-- level: all -->

Rules:

- Environment variables are `UPPER_SNAKE_CASE`.
- Export only variables child processes need.
- Do not overwrite important shell environment names casually.
- Validate dynamic environment variable names before using indirect expansion.
- Name required environment values by the external contract when the deployment
  platform owns the name.

Preserve an external name such as `DEPLOY_ACCESS_TOKEN` and export it only
for child processes that require it. A dynamic variable-name input can be
named `env_name`. Validate it before indirect expansion and do not print
credential values to demonstrate the operation.

## Files

<!-- level: all -->

- Bash files in one directory must not share the first filename component before
  `_` or `-`.
- Put a related script family in an owning subdirectory and give the contained
  files role names such as `main.sh`, `state.sh`, `query.sh`, or `report.sh`.
- External hook families may use a dynamic shared prefix when the external
  interface owns those filenames.
- Directories are kebab-case.
- A function called from no other file starts with `_`. `main` is exempt.
