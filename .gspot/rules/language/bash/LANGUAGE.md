---
layer: language
preset: bash
title: Bash Language
---

# Bash Language

Functions, variables, quoting, arrays, conditionals, arithmetic, loops, delimited data, paths,
command substitution, and pipelines. Script structure and options are in the Bash file.

## Functions

Rules:

- Use `name() { ... }` consistently for new code. `unenforced`
- Do not write `function name()`, `function name() { ... }`, or
  `function name { ... }`. `unenforced`
- Keep functions small and single-purpose. `enforced-by: structure/function-length`
- Declare function-local variables with `local`. `enforced-by: bash/shellcheck`
- Separate `local` declaration from command substitution assignment when the
  exit code matters. `enforced-by: bash/shellcheck`
- Return status codes with `return`. Print data to STDOUT only when the function
  is designed as a value-producing command. `enforced-by: structure/shell-safety`
- Do not make a function both print data and log progress to STDOUT. `enforced-by: structure/shell-safety`
- Keep a function within the configured statement, branch, and nesting limits. `enforced-by: structure/shell-branches`
- A function that coordinates enough flags, counters, mutable state, or status
  codes to resemble a state machine does not belong in Bash. Simplify the
  workflow or move the domain behavior to its existing application-code owner. `enforced-by: structure/shell-branches`
- Do not use a non-zero status to represent an ordinary result such as
  `unchanged`. Print or assign an explicit result and reserve non-zero statuses
  for failures. `enforced-by: structure/shell-safety`

Good:

```bash
# current_branch - Prints the current Git branch.
# Outputs:
#   Writes the branch name to stdout.
current_branch() {
  local branch

  branch="$(git rev-parse --abbrev-ref HEAD)" || return 1
  printf '%s\n' "${branch}"
}
```

Use `main` for every executable script that has functions:

```bash
main() {
  parse_args "$@"
  run
}

main "$@"
```

Libraries must not call `main`.

## Variables and constants

Rules:

- Quote variable expansions unless a specific shell mechanism requires unquoted
  expansion. `enforced-by: bash/shellcheck`
- Prefer `${name}` over `$name` for normal variables. `enforced-by: bash/shellcheck`
- Do not brace single-character positional or shell-special parameters unless it
  avoids confusion. `unenforced`
- Positional parameters above 9 must be braced. Use `${10}`, not `$10`. `enforced-by: bash/shellcheck`
- Use `readonly` for constants immediately after assignment. `enforced-by: bash/shellcheck`
- Use `export` only for variables that child processes need. `enforced-by: bash/shellcheck`
- Do not overwrite important environment variables casually, especially `PATH`,
  `HOME`, `IFS`, `CDPATH`, `SHELL`, `PWD`, or `BASH_ENV`. `enforced-by: bash/shellcheck`
- Do not export `CDPATH`. `enforced-by: bash/shellcheck`
- A directory constant is computed with `CDPATH= cd -- <path> && pwd -P` and has a failure
  path (`|| exit 1` in an entrypoint, `|| return 1` in a library). `enforced-by: structure/shell-interpreter`
- Do not put spaces around `=`. `unenforced`
- Use `$HOME`, not quoted `~`, inside paths. `enforced-by: bash/shellcheck`
- Assign a home-relative value before exporting it, or use `$HOME`. `enforced-by: bash/shellcheck`
- Quote array elements passed to `unset`, and prefer `unset -v`. `enforced-by: bash/shellcheck`

Good:

```bash
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)" || exit 1
readonly PROJECT_ROOT
export PROJECT_ROOT

tool_home="${HOME%/}/.tool"
export tool_home

unset -v 'files[0]'
```

When assigning from commands:

```bash
local output
output="$(some_command)" || return 1
```

Separate `local`, `declare`, `readonly`, and `export` from command substitution `enforced-by: bash/shellcheck`
when the command status matters. These declarations can report their own status
instead of the command substitution's status:

```bash
local output="$(some_command)"
declare output="$(some_command)"
readonly output="$(some_command)"
export output="$(some_command)"
```

The exit code is the `local` builtin's status, not reliably the command
substitution status.

## Quoting and expansion

Rules:

- Always quote variable expansions, command substitutions, and strings with
  spaces or shell metacharacters. `enforced-by: bash/shellcheck`
- Use `"$@"` when forwarding arguments. `enforced-by: bash/shellcheck`
- Do not use `$*` except when intentionally joining arguments into one string. `enforced-by: bash/shellcheck`
- Prefer single quotes for literal strings with no expansion. `enforced-by: bash/shellcheck`
- Prefer double quotes when expansion is required. `enforced-by: bash/shellcheck`
- Do not use unquoted command substitution output as an argument list. `enforced-by: bash/shellcheck`
- Do not depend on word splitting for data parsing. `enforced-by: bash/shellcheck`
- Do not use `eval`. Use arrays, direct validation, explicit `case` branches,
  or fixed dispatch tables. `enforced-by: bash/shellcheck`
- Do not use aliases in scripts. Use functions. `enforced-by: bash/shellcheck`
- Do not rely on backslash-escaped words for readability when quotes work. `enforced-by: bash/shellcheck`

Good:

```bash
cp -- "${source_file}" "${target_dir}/"
printf '%s\n' "${message}"
command --flag "${value}" "$@"
```

Quoted command substitution:

```bash
version="$(node --version)"
```

Nested quoting is normal:

```bash
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```

Use parameter expansion instead of external tools for simple string operations:

```bash
filename="archive.tar.gz"
base="${filename%.tar.gz}"
```

## Arrays and argument lists

Use arrays for command arguments. `unenforced`

Good:

```bash
declare -a quantize_args
quantize_args=(
  --model
  "${model_name}"
  --out
  "${checkpoint_dir}"
)

python -m src.quantization.vllm.quantize "${quantize_args[@]}"
```

Rules:

- Expand arrays with `"${array[@]}"`. `unenforced`
- Do not populate arrays with raw `$(...)`. `enforced-by: bash/shellcheck`
- Use a `while read` loop or Bash 4+ `readarray` only when runtime support is
  guaranteed. `enforced-by: bash/shellcheck`
- Avoid arrays as ersatz nested data structures. `unenforced`
- On Bash 3.2-compatible scripts, indexed arrays are allowed; associative arrays
  are not. `enforced-by: structure/shell-interpreter`

Safe multi-line command output into an array on Bash 4+:

```bash
readarray -t files < <(find . -type f -name '*.sql' -print)
```

Bash 3.2-compatible line loop:

```bash
while IFS= read -r file; do
  files+=("${file}")
done < <(find . -type f -name '*.sql' -print)
```

For filenames, prefer NUL delimiters:

```bash
while IFS= LC_ALL=C read -r -d '' file; do
  files+=("${file}")
done < <(find . -type f -name '*.sql' -print0)
```

## Conditionals

Use `[[ ... ]]` for Bash conditionals:

```bash
if [[ -f "${config_file}" ]]; then
  load_config "${config_file}"
fi
```

Rules:

- Prefer `[[ ... ]]` over `[ ... ]` in Bash scripts. `enforced-by: bash/shellcheck`
- Do not use `test -a`, `test -o`, `[ ... -a ... ]`, `[ ... -o ... ]`, or
  grouping operators inside `[ ... ]`. Use `[[ ... ]]`, explicit `if`
  branches, or `case`. `enforced-by: bash/shellcheck`
- Use `==` for string equality. `enforced-by: bash/shellcheck`
- Quote the right-hand side when string equality is intended and the value may
  contain glob characters. `enforced-by: bash/shellcheck`
- Leave the right-hand side unquoted only when pattern matching is intended. `enforced-by: bash/shellcheck`
- Store regular expressions in variables and use them unquoted with `=~`. `enforced-by: bash/shellcheck`
- Use `-z` and `-n` for empty and non-empty string checks. `enforced-by: bash/shellcheck`
- Use `(( ... ))` for trusted numeric comparisons. `enforced-by: bash/shellcheck`
- Validate untrusted numbers before arithmetic evaluation. `unenforced`

String equality:

```bash
if [[ "${actual}" == "${expected}" ]]; then
  printf 'match\n'
fi
```

Pattern matching:

```bash
if [[ "${file}" == *.sql ]]; then
  lint_sql "${file}"
fi
```

Regular expressions:

```bash
readonly version_re='^[0-9]+\.[0-9]+\.[0-9]+$'

if [[ "${version}" =~ ${version_re} ]]; then
  printf 'valid version\n'
fi
```

Do not use `cmd1 && cmd2 || cmd3` as an `if/else` replacement when `cmd2` can `unenforced`
fail:

```bash
if cmd1; then
  cmd2
else
  cmd3
fi
```

## Arithmetic

Rules:

- Use `$(( ... ))` for arithmetic expansion. `enforced-by: bash/shellcheck`
- Use `(( ... ))` for trusted arithmetic comparisons and assignments. `enforced-by: bash/shellcheck`
- Do not use `expr`, `$[ ... ]`, or `let`. `enforced-by: bash/shellcheck`
- Do not use `<` or `>` inside `[[ ... ]]` for numeric comparisons. `enforced-by: bash/shellcheck`
- Validate untrusted numeric input before arithmetic contexts. `unenforced`
- Be careful with `(( i++ ))` under `errexit`; it returns false when the
  expression evaluates to zero. `enforced-by: bash/shellcheck`
- Avoid array subscripts inside arithmetic contexts unless both the array name
  and index are trusted. `unenforced`
- Do not put untrusted strings into `(( ... ))`, `$(( ... ))`, `[[ value -gt n ]]`,
  array indices, or arithmetic `for` expressions. `enforced-by: bash/shellcheck`
- Avoid associative arrays in arithmetic contexts. Project-default Bash 3.2 does
  not support associative arrays, and newer Bash versions differ in expansion
  behavior. `enforced-by: structure/shell-interpreter`
- Convert base-10 strings with care. `10#${value}` only works for unsigned
  numbers. `unenforced`
- Call `date` one time when multiple fields must describe the same instant. `enforced-by: bash/shellcheck`
- Compute redirection paths before a command if the path expression mutates a
  variable. `enforced-by: bash/shellcheck`

Good:

```bash
if (( retry_count < max_retries )); then
  (( retry_count += 1 ))
fi
```

Safer increment under `errexit`:

```bash
retry_count=$(( retry_count + 1 ))
```

Validate external input:

```bash
if [[ ! "${port}" =~ ^[0-9]+$ ]]; then
  printf 'error: port must be numeric\n' >&2
  return 1
fi

if (( port < 1 || port > 65535 )); then
  printf 'error: port is out of range\n' >&2
  return 1
fi
```

That is a lexicographical comparison.

Safer signed base-10 conversion:

```bash
if [[ "${value}" =~ ^[+-]?[0-9]+$ ]]; then
  value_base10=$(( ${value%%[!+-]*}10#${value#[-+]} ))
fi
```

Safer redirection target:

```bash
output_file="result$(( index + 1 )).txt"
index=$(( index + 1 ))
generate_result >"${output_file}"
```

## Loops and input

Rules:

- Iterate over arguments with `for arg in "$@"; do`. `unenforced`
- Do not use compact loop forms such as `for arg; { ...; }`. `unenforced`
- Iterate over globs directly, not over `ls`. `enforced-by: bash/shellcheck`
- Read files with `while IFS= read -r line; do ... done < file`. `unenforced`
- Do not use `for line in $(cat file)`. `unenforced`
- Avoid piping into `while` when variables set inside the loop must survive. `unenforced`
- Use process substitution for current-shell loops. `unenforced`
- Use NUL-delimited streams for filenames. `enforced-by: structure/shell-interpreter`
- Use `read` with a bare variable name, not `$variable`. `unenforced`
- Do not use a here-string containing command substitution as loop input. `unenforced`

Good line reading:

```bash
while IFS= read -r line; do
  process_line "${line}"
done < "${input_file}"
```

Good command output loop:

```bash
while IFS= read -r line; do
  process_line "${line}"
done < <(generate_lines)
```

It collects all output first, strips trailing newlines, discards NUL bytes, and
adds a final newline.

Good filename loop:

```bash
while IFS= LC_ALL=C read -r -d '' file; do
  process_file "${file}"
done < <(find "${root_dir}" -type f -print0)
```

Counter loop:

```bash
for (( index = 0; index < count; index++ )); do
  run_case "${index}"
done
```

Do not use `seq` for simple Bash counters. `enforced-by: bash/shellcheck`

## Delimited data and IFS

Rules:

- Use `IFS= read -r` for line input to prevent trimming and backslash handling. `unenforced`
- Use `IFS= LC_ALL=C read -r -d ''` for NUL-delimited filename streams. `enforced-by: structure/shell-interpreter`
- Do not save and restore `IFS` with `old_ifs="${IFS}"`; that loses the
  distinction between unset and empty. `enforced-by: bash/shellcheck`
- Prefer function-local `IFS` or a subshell when a temporary separator is
  needed. `enforced-by: bash/shellcheck`
- Do not parse general CSV with `IFS=, read ...`; use product-owned application
  code with a real CSV parser. `unenforced`
- If a simple delimiter format is truly controlled, remember that `read` treats
  `IFS` as a terminator. A trailing empty field is discarded unless you account
  for it. `enforced-by: bash/shellcheck`
- Do not populate arrays from raw command substitution. `unenforced`

Good local `IFS`:

```bash
join_path_parts() {
  local IFS='/'
  printf '%s\n' "$*"
}
```

Controlled trailing field:

```bash
input='name,value,'
IFS=, read -r -a fields <<< "${input},"
```

Command output into arrays:

```bash
declare -a hosts
while IFS= read -r host; do
  hosts+=("${host}")
done < <(aws_command_that_prints_one_host_per_line)
```

## Paths, globs, and file names

Rules:

- Quote paths. `enforced-by: bash/shellcheck`
- Use `--` before path arguments when a command supports it. `enforced-by: bash/shellcheck`
- Prefer globs with explicit path prefixes such as `./*.mp3`. `enforced-by: bash/shellcheck`
- Do not parse `ls`. `enforced-by: bash/shellcheck`
- Do not filter filenames with `grep`; use globs or `[[ ... == pattern ]]`. `enforced-by: bash/shellcheck`
- Handle no-match glob behavior deliberately. `enforced-by: bash/shellcheck`
- Do not assume filenames cannot contain spaces, newlines, quotes, brackets, or
  leading dashes. `enforced-by: bash/shellcheck`
- Do not assume the current directory. Set or compute it. `unenforced`
- Check `cd` explicitly. `enforced-by: bash/shellcheck`
- Test broken symlinks with `-e` or `-L` when existence matters. `enforced-by: bash/shellcheck`
- Match path basenames deliberately when using globs against paths that include
  `./`. `enforced-by: bash/shellcheck`
- Do not use `grep` to decide whether a path has an extension. `unenforced`

Good:

```bash
for file in ./*.sql; do
  [[ -e "${file}" ]] || continue
  lint_sql "${file}"
done
```

Broken symlink-aware conditional:

```bash
if [[ -e "${path}" || -L "${path}" ]]; then
  process_path "${path}"
fi
```

Basename pattern conditional:

```bash
if [[ "${path##*/}" == *.* ]]; then
  process_file_with_extension "${path}"
fi
```

With `nullglob`, scope the option:

```bash
list_sql_files() {
  (
    shopt -s nullglob

    declare -a files
    files=( ./*.sql )
    printf '%s\n' "${files[@]}"
  )
}
```

Prefer the simpler local form:

```bash
shopt -s nullglob
sql_files=( ./*.sql )
shopt -u nullglob
```

If changing directories:

```bash
if ! cd -- "${target_dir}"; then
  printf 'error: cannot enter target dir: %s\n' "${target_dir}" >&2
  return 1
fi
```

When using `cd` in command substitution, clear `CDPATH`:

```bash
repo_root="$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd -P)" || return 1
```

## Command substitution

Rules:

- Use `$(...)`, not backticks. `enforced-by: bash/shellcheck`
- Quote command substitutions. `enforced-by: bash/shellcheck`
- Remember command substitution strips trailing newlines. `unenforced`
- Do not use command substitution to carry binary data. `unenforced`
- Do not use command substitution to create argument lists. `unenforced`
- Capture the exit status immediately when needed. `enforced-by: bash/shellcheck`
- Use `$(<file)` only when stripping trailing newlines is acceptable. `unenforced`

Good:

```bash
commit_sha="$(git rev-parse HEAD)" || return 1
```

If trailing newlines matter, avoid command substitution or deliberately preserve
them with a sentinel.

Sentinel pattern:

```bash
content_with_sentinel="$(some_command; printf x)" || return 1
content="${content_with_sentinel%x}"
```

## Pipelines and redirection

Rules:

- Split long pipelines one command per line. `enforced-by: bash/shfmt`
- Know whether each command consumes all input before enabling `pipefail`. `enforced-by: structure/shell-interpreter`
- Use `PIPESTATUS` immediately if individual pipeline statuses matter. `enforced-by: bash/shellcheck`
- Redirect stdout and stderr in the correct order. `enforced-by: bash/shellcheck`
- Do not use `&>file` or `>&file`. Use `>file 2>&1` so ordering is visible. `unenforced`
- Do not use `cmd |& other`. Use `cmd 2>&1 | other`. `unenforced`
- Do not close standard file descriptors as a shortcut for `/dev/null`. `enforced-by: structure/shell-interpreter`
- Do not read from and write to the same file in a pipeline. `unenforced`
- Use temp files plus atomic rename for file replacement. `unenforced`
- Do not rely on parallel `xargs` jobs writing ordered, unmixed output. `enforced-by: bash/shellcheck`
- Do not use `cmd; (( ! $? )) || die`; check the command directly or capture
  the status in a named variable. `enforced-by: bash/shellcheck`

Redirect both stdout and stderr:

```bash
some_command >>"${log_file}" 2>&1
```

Check pipeline statuses:

```bash
tar -cf - ./* | (cd -- "${target_dir}" && tar -xf -)
statuses=( "${PIPESTATUS[@]}" )

if (( statuses[0] != 0 || statuses[1] != 0 )); then
  printf 'error: tar copy failed\n' >&2
  return 1
fi
```

Safe file rewrite:

```bash
tmp_file="$(mktemp "${file}.XXXXXX")" || return 1
sed 's/foo/bar/g' "${file}" >"${tmp_file}" || {
  rm -f -- "${tmp_file}"
  return 1
}
mv -- "${tmp_file}" "${file}"
```

Command status with cases:

```bash
if command_may_fail; then
  handle_success
else
  statusCode=$?
  handle_failure "${statusCode}"
fi
```

For parallel execution, write per-job output to separate files and combine them
after all jobs complete, or use a tool that serializes output.
