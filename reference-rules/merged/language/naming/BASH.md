---
layer: language
preset: bash
title: Bash Naming
---

# Bash Naming

Bash naming follows Google shell guidance, with the overrides below for file stems.

## Bash Case Rules

Rules:

- Shell source file stems use `kebab-case` unless an existing tool or external
  command owns the name. `enforced-by: naming/identifiers`
- Executable scripts use `.sh` when invoked through a task runner or build
  rules. `unenforced`
- Executable scripts may omit the extension only when the file is intended to be
  a command on `PATH`. `unenforced`
- Sourced libraries use `.sh` and are not executable. `unenforced`
- Numbered pipeline steps use `NN-description.sh` (`01-install.sh`); the numeric prefix is a
  structural prefix the naming check strips before it matches the stem. `enforced-by: naming/identifiers`
- Functions and mutable variables use `lower_snake_case`. `enforced-by: naming/identifiers`
- Function-local variables use `lower_snake_case`. `enforced-by: naming/identifiers`
- Constants, readonly values, exported environment variables, and externally
  configured values use `UPPER_SNAKE_CASE`. `unenforced`
- Package-like function prefixes may use `::` only when a script family already
  uses that convention. `unenforced`
- Do not use the `function` keyword for new functions. Use `name() { ...; }`. `unenforced`

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

## Bash Variables

Rules:

- Loop variables describe the item being iterated. `unenforced`
- Use `tmp_dir` or `tmp_file` only for actual temporary filesystem paths. `unenforced`
- Avoid vague names when a domain name is available. `enforced-by: naming/identifiers`
- Avoid shell-reserved and shell-special names for unrelated values. `unenforced`
- Initialize variables before use. `unenforced`
- Prefer explicit empty strings or arrays over relying on unset variables. `unenforced`
- Declare function-specific variables with `local`. `unenforced`
- Separate `local`, `declare`, `readonly`, and `export` from command
  substitutions when the command status matters. `unenforced`

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

## Bash Functions

Rules:

- Function names use verb phrases when the function has side effects. `unenforced`
- Functions that print data to STDOUT are named for the data printed. `unenforced`
- Functions that validate return a status and log errors deliberately. `unenforced`
- Do not name scripts or functions after shell builtins or common commands. `unenforced`
- Do not make function names so generic that logs and stack traces lose context. `unenforced`

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

## Bash Environment Names

Rules:

- Environment variables are `UPPER_SNAKE_CASE`. `unenforced`
- Export only variables child processes need. `unenforced`
- Do not overwrite important shell environment names casually. `unenforced`
- Validate dynamic environment variable names before using indirect expansion. `unenforced`
- Name required environment values by the external contract when the deployment
  platform owns the name. `unenforced`

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
  `_` or `-`. `enforced-by: naming/identifiers`
- Put a related script family in an owning subdirectory and give the contained
  files role names such as `main.sh`, `state.sh`, `query.sh`, or `report.sh`. `unenforced`
- External hook families may use a dynamic shared prefix when the external
  interface owns those filenames. `enforced-by: naming/identifiers`
- Directories are kebab-case. `enforced-by: naming/identifiers`
- A function called from no other file starts with `_`. `main` is exempt. `unenforced`
