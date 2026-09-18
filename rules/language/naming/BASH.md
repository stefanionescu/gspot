---
layer: language
preset: bash
title: Bash Naming
---

# Bash Naming

Bash naming follows Google shell guidance, with the overrides below for file stems.

## Bash case rules

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

Bad:

```text
DeployScript.sh
deploy_script.sh
helpers.sh
```

Good:

```text
deploy-api.sh
upload-storage-assets.sh
database-branch
```

Bad:

```bash
function Deploy() {
  local TMP="$1"
}
```

Good:

```bash
deploy_api() {
  local target_environment="$1"
}
```

## Bash variables

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

Bad:

```bash
X=/tmp/a
for i in "${things[@]}"; do
  do_it "${i}"
done

local output="$(generate_report)"
```

Good:

```bash
readonly API_ROOT="${REPO_ROOT}/api"

for migration_file in "${migration_files[@]}"; do
  lint_migration "${migration_file}"
done

local report_output
report_output="$(generate_report)" || return 1
```

## Bash functions

Rules:

- Function names use verb phrases when the function has side effects.
- Functions that print data to STDOUT are named for the data printed.
- Functions that validate return a status and log errors deliberately.
- Do not name scripts or functions after shell builtins or common commands.
- Do not make function names so generic that logs and stack traces lose context.

Bad:

```bash
test() {
  ...
}

run() {
  ...
}

process() {
  ...
}
```

Good:

```bash
current_branch() {
  git branch --show-current
}

deploy_staging_database() {
  ...
}

validate_project_ref() {
  ...
}
```

## Bash environment names

Rules:

- Environment variables are `UPPER_SNAKE_CASE`.
- Export only variables child processes need.
- Do not overwrite important shell environment names casually.
- Validate dynamic environment variable names before using indirect expansion.
- Name required environment values by the external contract when the deployment
  platform owns the name.

Bad:

```bash
export token="${TOKEN}"
name="$1"
printf '%s\n' "${!name}"
```

Good:

```bash
export DEPLOY_ACCESS_TOKEN="${DEPLOY_ACCESS_TOKEN}"

env_name="$1"
if [[ ! "${env_name}" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
  printf 'error: invalid environment variable name\n' >&2
  return 1
fi
printf '%s\n' "${!env_name}"
```

## Files

- Bash files in one directory must not share the first filename component before
  `_` or `-`.
- Put a related script family in an owning subdirectory and give the contained
  files role names such as `main.sh`, `state.sh`, `query.sh`, or `report.sh`.
- External hook families may use a dynamic shared prefix when the external
  interface owns those filenames.
- Directories are kebab-case.
- A function called from no other file starts with `_`. `main` is exempt.
