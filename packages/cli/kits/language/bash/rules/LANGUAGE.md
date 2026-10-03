---
title: Bash Language
---

# Bash Language

Functions, variables, quoting, arrays, conditionals, arithmetic, loops, delimited data, paths,
command substitution, and pipelines. Script structure and options are in the Bash file.

## Functions

Declare function-local variables with `local`, and separate the declaration from a command
substitution assignment when the exit code matters, because `local`, `declare`, `readonly`,
and `export` report their own status rather than the substitution's:

```bash
local output
output="$(some_command)" || return 1
```

Return status codes with `return`, and print data to STDOUT only when the function is a
value-producing command; a function never both prints data and logs progress to STDOUT.
Preserve the documented status contract: a predicate may use status 1 for false, kept
distinct from an execution error. A function that coordinates enough flags, counters, mutable
state, or status codes to resemble a state machine does not belong in Bash. Simplify the
workflow or move the behavior to its application-code owner. An executable keeps its entry in
`main` when that gives argument handling and coordination an owner, and never wraps a direct
command only to create one. A library never starts a workflow when sourced.

```bash
# report_unreadable_files - Reports each unreadable input and fails if any input is unreadable.
report_unreadable_files() {
  local path
  local status=0

  for path in "$@"; do
    if [[ -r ${path} ]]; then
      continue
    fi
    printf 'error: input is unreadable: %s\n' "${path}" >&2
    status=1
  done
  return "${status}"
}
```

### Function conventions

<!-- level: all -->

Use `name() { ... }` for a function that runs in the caller's shell, and a subshell body,
`name() ( ... )`, for deliberate isolation of the caller's state and traps. Keep functions
within the configured statement, branch, and nesting limits, and inline a wrapper that only
forwards a command unless its signature or repeated configuration is a real caller contract.

## Variables and constants

Quote every expansion unless a specific shell mechanism requires an unquoted one. Brace
positional parameters above nine. Mark constants `readonly` immediately after assignment, and
`export` only what child processes need. Never casually overwrite `PATH`, `HOME`, `IFS`,
`CDPATH`, `SHELL`, `PWD`, or `BASH_ENV`, and never export `CDPATH`.

A directory constant is
computed with `CDPATH='' cd -- <path> && pwd -P` and carries a failure path, `|| exit 1` in an
entrypoint and `|| return 1` in a library. Use `$HOME`, not a quoted `~`, inside paths, and
assign a home-relative value before exporting it. Quote array elements passed to `unset -v`.

```bash
script_parent="$(dirname -- "${BASH_SOURCE[0]}")" || exit 1
PROJECT_ROOT="$(CDPATH='' cd -- "${script_parent}/.." && pwd -P)" || exit 1
readonly PROJECT_ROOT
export PROJECT_ROOT
```

### Variable conventions

<!-- level: all -->

Prefer `${name}` for named variables, and brace a single-character positional or special
parameter only to separate it from adjacent characters.

## Quoting and expansion

Forward arguments with `"$@"`, and use `$*` only to join arguments into one string on
purpose. Single quotes hold literals and double quotes hold expansions. Command substitution
output is never an unquoted argument list, and word splitting never parses data. `eval` does
not exist; dispatch uses arrays, direct validation, `case`, or fixed tables. Aliases are
functions. Parameter expansion replaces external tools for simple string work:

```bash
filename="archive.tar.gz"
base="${filename%.tar.gz}"
```

## Arrays and argument lists

Command arguments live in arrays, expanded with `"${array[@]}"` and never populated from raw
`$(...)`. Bash 3.2 scripts use indexed arrays only. Read lines with a `while read` loop, or
`readarray` where Bash 4+ is guaranteed, and read filenames from NUL-delimited streams:

```bash
declare -a archive_args
archive_args=(-czf "${archive_path}" -C "${source_directory}" .)
tar "${archive_args[@]}"

while IFS= LC_ALL=C read -r -d '' file; do
  files+=("${file}")
done < <(find . -type f -name '*.sql' -print0)
```

Arrays are not ersatz nested data structures; that need is the sign to leave Bash.

## Conditionals and arithmetic

`[[ ... ]]` holds string, pattern, and file tests. `==` compares for equality with a quoted
right-hand side when the value may hold glob characters, and an unquoted right-hand side only
when pattern matching is intended. A regular expression is stored in a variable and used
unquoted with `=~`. `-z` and `-n` test for emptiness. `cmd1 && cmd2 || cmd3` is not an `if/else` when `cmd2` can
fail. Numeric comparisons live in `(( ... ))` after untrusted numbers are validated; `<` and
`>` inside `[[ ... ]]` compare strings.

```bash
readonly version_re='^[0-9]+\.[0-9]+\.[0-9]+$'
if [[ "${version}" =~ ${version_re} ]]; then
  printf 'valid version\n'
fi
```

Arithmetic uses `$(( ... ))` and `(( ... ))`. `(( i++ ))` returns false when the expression is
zero, so under `errexit` increment with `retry_count=$(( retry_count + 1 ))`. Untrusted
strings never enter `(( ... ))`, `$(( ... ))`, `[[ value -gt n ]]`, array indices, or
arithmetic `for` expressions: validate with a pattern first. `10#${value}` converts unsigned
base-10 strings; a signed value needs `$(( ${value%%[!+-]*}10#${value#[-+]} ))`. Call `date`
once when several fields describe one instant, and compute a redirection path before the
command when the path expression mutates a variable.

```bash
if [[ ! "${port}" =~ ^[0-9]{1,5}$ ]]; then
  printf 'error: port must be numeric\n' >&2
  return 1
fi
if (( 10#${port} < 1 || 10#${port} > 65535 )); then
  printf 'error: port is out of range\n' >&2
  return 1
fi
```

## Loops and delimited data

Iterate arguments with `for arg in "$@"; do`, globs directly rather than `ls`, and files with
`while IFS= read -r line || [[ -n ${line} ]]; do ... done <"${file}"`, which keeps the last
unterminated line. A pipe into `while` runs the loop in a subshell, so variables set inside it
vanish; use process substitution or a redirected file. A here-string with command
substitution collects all output first, strips trailing newlines, and drops NUL bytes.
Neither form propagates the producer's failure; use a checked temporary file when that status
matters. Counter loops use `for (( index = 0; index < count; index++ ))`, not `seq`.

```bash
root_dir="$(CDPATH='' cd -- "${1:?Root directory is required}" && pwd -P)" || exit 1
file_list="$(mktemp)" || exit 1
trap 'rm -f -- "${file_list}"' EXIT
find "${root_dir}" -type f -print0 >"${file_list}" || exit 1

while IFS= LC_ALL=C read -r -d '' file; do
  printf 'file: %q\n' "${file}"
done <"${file_list}"
```

`IFS= read -r` prevents trimming and backslash handling. Do not save and restore `IFS` with
`old_ifs="${IFS}"`, which loses the distinction between unset and empty; use a function-local
`IFS` or a subshell. `read` treats `IFS` as a terminator, so a controlled delimited line
keeps its trailing empty field only with an appended delimiter. General CSV is parsed by
application code with a real parser, never `IFS=, read`.

```bash
# join_path_parts - Joins the arguments with slashes.
join_path_parts() {
  local IFS='/'
  printf '%s\n' "$*"
}
```

## Paths, globs, and file names

Quote paths, put `--` before path arguments where the command supports it, prefer globs with
an explicit prefix such as `./*.sql`, and never filter filenames with `grep`. Filenames can
hold spaces, newlines, quotes, brackets, and leading dashes. Never assume the current
directory; compute it, and check `cd` explicitly. A broken symlink needs `-L` beside `-e`
when existence matters, and a basename pattern reads `"${path##*/}"`. Handle the no-match
glob deliberately, either with `[[ -e ${file} ]] || continue` or with `nullglob` scoped to a
subshell:

```bash
for file in ./*.sql; do
  [[ -e ${file} ]] || continue
  printf '%s\n' "${file}"
done

if ! cd -- "${target_dir}"; then
  printf 'error: cannot enter target dir: %s\n' "${target_dir}" >&2
  return 1
fi
```

## Command substitution

Quote `$(...)`, capture the status at once, and remember that it strips trailing newlines,
cannot carry binary data, and never builds an argument list. `$(<file)` is fine only when
stripping trailing newlines is acceptable. When trailing newlines matter, keep them with a
sentinel:

```bash
commit_sha="$(git rev-parse HEAD)" || exit 1
content_with_sentinel="$(some_command || exit; printf x)" || return 1
content="${content_with_sentinel%x}"
```

## Pipelines and redirection

Know whether each command consumes all its input before enabling `pipefail`, and read
`PIPESTATUS` immediately when individual statuses matter. Order redirections so the intent is
visible, `>file 2>&1`, and never close a standard descriptor as a shortcut for `/dev/null`. A
pipeline never reads from and writes to the same file; a file is rewritten through a
temporary file and an atomic rename. Parallel `xargs` jobs do not produce ordered, unmixed
output: write per-job files and combine them, or use a tool that serializes. Check a command
directly or capture its status in a named variable rather than `(( ! $? )) || die`.

```bash
tar -cf - ./* | (cd -- "${target_dir}" && tar -xf -)
statuses=( "${PIPESTATUS[@]}" )
if (( statuses[0] != 0 || statuses[1] != 0 )); then
  printf 'error: tar copy failed\n' >&2
  return 1
fi

edited_file="$(mktemp "${file}.XXXXXX")" || return 1
sed 's/foo/bar/g' "${file}" >"${edited_file}" || {
  rm -f -- "${edited_file}"
  return 1
}
mv -- "${edited_file}" "${file}"
```
