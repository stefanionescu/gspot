# Bash Naming

Bash naming follows Google shell guidance, with the overrides below for file stems.

## Bash case rules

<!-- level: all -->

- Executable scripts use `.sh` when invoked through a task runner or build
  rules.
- Omit the extension on an executable script only when users invoke it
  as a command on `PATH`.
- Give sourced libraries the `.sh` extension and no executable permission.
- Numbered pipeline steps use `NN-description.sh`, such as `01-install.sh`; the numeric prefix defines a
  structural prefix the naming check strips before it matches the stem.
- Functions and mutable variables use `lower_snake_case`.
- Package-like function prefixes may use `::` only when a script family already
  uses that convention.

| Avoid              | Prefer                     | Meaning              |
| ------------------ | -------------------------- | -------------------- |
| `DeployScript.sh`  | `deploy-api.sh`            | API deployment.      |
| `deploy_script.sh` | `upload-storage-assets.sh` | Storage upload.      |
| `helpers.sh`       | `archive-reports`          | A command on `PATH`. |

Name a deployment function `deploy_api` and its local target
`target_environment`.

## Bash variables

<!-- level: all -->

- Loop variables name each item in the loop.
- Name a temporary path after what it holds, such as `download_file` or `work_dir`; `tmp` and
  `temp` say nothing.
- Avoid vague names when the domain provides a name.
- Avoid shell-reserved and shell-special names for unrelated values.

Use `migration_file` when iterating migration paths and `report_output` for
captured report text. Check the report command's exit status before printing
the captured output. A loop variable such as `i` does not describe a file.

## Bash functions

<!-- level: all -->

- Function names use verb phrases when the function has side effects.
- Name a function that prints to `stdout` for the data it prints.
- Do not name scripts or functions after shell builtins or common commands.
- Do not make function names so generic that logs and stack traces lose context.

Name a port validator `validate_port`. Avoid `test`, which shadows a shell builtin, and
generic names such as `run` or `process`.

## Files

<!-- level: all -->

- Put a related script family in an owning subdirectory and give the contained
  files role names such as `main.sh`, `state.sh`, `query.sh`, or `report.sh`.
- External hook families may use a dynamic shared prefix when the external
  interface owns those filenames.
