# Command-Line Programs

These rules apply to command-line programs the project ships for people or automation. Internal build tasks follow the task runner's interface.

## Streams and exit status

- Data goes to stdout. Diagnostics, progress, prompts, and errors go to stderr.
- Preserve established exit codes. New commands use `0` on success, `1` on failure, and `2`
  on usage error unless their protocol defines other behavior. List each exit code in `--help`.
- Keep machine-readable `--json` output complete, stable, and free of progress text.
- Omit color and terminal control sequences unless stdout connects to a terminal and `NO_COLOR` has no value.

## Interface

- `--help` prints usage, every flag with its default, and one example. `--version` prints the
  version and exits.
- Every value a prompt asks for also has a flag. If the process has no terminal, fail. Name the missing flag.
- A destructive command asks for confirmation on a terminal and requires `--yes` otherwise.

## Behavior

- Validate every argument before doing any work. Fail with an actionable message that names the
  argument.
- Idempotent where the operation allows it: running twice produces the same state.
- Long operations report progress on stderr and honor interruption: catch the termination signal,
  clean up, exit with the signal's status.
- Resolve a relative path against the directory the user ran the command in, or against an
  explicit argument. Never resolve it against the script's own folder.
- Create temporary files with the platform's secure call such as `mktemp`, `tempfile.mkstemp`, and
  delete them on exit.

## Flag naming

<!-- level: all -->

Use `--kebab-case` for flags. Boolean switches take no value; use `--no-flag` for negation.
Preserve names defined by an existing public interface.
