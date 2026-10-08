---
title: Command checks
description: Run your own command as a gspot check, with its findings in the same report.
---

A command check runs a command of yours on the files you select. gspot reads its output as
findings, so they appear in the same report as every other check.

## Example: find unfinished notes

This check reports `FIXME` lines in the files under `notes/`. It needs Node.js on your `PATH`.

Save this checker under the example filename:

```javascript title="scripts/check-notes.mjs"
import { readFile } from 'node:fs/promises';

for (const path of process.argv.slice(2)) {
    const lines = (await readFile(path, 'utf8')).split('\n');
    for (const [index, line] of lines.entries()) {
        if (!line.includes('FIXME')) continue;
        console.log(`${path}:${index + 1}: ${line}`);
        process.exitCode = 1;
    }
}
```

Add the check to `gspot.toml`. For a new repository, this is the complete policy. In an
existing policy, add the named check and its output table:

```toml title="Note checker policy"
configurations = []

[check."project/notes"]
command = ["node", "scripts/check-notes.mjs", "{files}"]
paths = ["notes/**"]
stage = "commit"
summary = "Finds unfinished FIXME notes."
help = "Replace each FIXME note with the completed instruction."

[check."project/notes".output]
format = "regex"
pattern = '^(?<file>[^:]+):(?<line>\d+): (?<message>.*)$'
```

Save this note under the example filename:

```text title="notes/deploy.txt"
FIXME: document the deployment command.
```

Apply the policy and run the check:

```bash
gspot apply
gspot check --only project/notes
```

The check exits with `1` and reports a finding on the note's first line. Replace it with
the finished instruction:

```text title="Corrected note"
Run the deployment command documented in the release guide.
```

Run the same check again. It exits with `0` and reports no findings.

## How the command runs

`command` is a list of arguments, and gspot runs it without a shell. `{files}` expands to the
selected files, one argument each. File names with spaces need no extra quoting. To run the
command once for each file, use `{file}` instead. Then a regex match without a `file` group
uses the file of that run.

By default, any nonzero exit fails the check. When your tool uses one exit code for findings,
set `exit_codes = [1]`. Any other nonzero exit then counts as a failed run, exit code
`2`, even when the tool printed findings first. An empty list makes every nonzero exit a failed
run.

## Read the output

`[check."project/notes".output]` decides how the output becomes findings:

- `format = "regex"` matches each line. The groups `file`, `line`, and `message` fill the
  finding.
- Set `format = "json"` for JSON output, then map fields under `[check."project/notes".output.fields]`. Use `items` or `children` for nested results:

    ```toml
    [check."project/notes".output]
    format = "json"
    [check."project/notes".output.fields]
    message = "message"
    ```

- `sarif`, `grouped`, `lines`, and `none` support other output contracts described in the [policy reference](/reference/gspot-toml/#check).
- `format = "semgrep"` reads Semgrep JSON.
- `format = "trufflehog-json"` reads TruffleHog JSON without exposing secret values.
- `format = "typos"` reads the JSON of typos. It turns byte offsets into character columns.
- `format = "markdownlint"` reads the results of markdownlint.
- `format = "knip"` reads Knip JSON and preserves issue categories and source positions.

Malformed output counts as a failed run, exit code `2`. The
[policy reference](/reference/gspot-toml/#check) lists every field.

## Count failures in the output

Some tools print a summary and always exit with `0`. For those, set `finding_count_pattern` on the check.
With `finding_count_pattern = "FAILED"`, each match in stdout or stderr is a failure. Use it only for a
tool that works this way.

## Add a correction command

To let `gspot check --fix` correct the findings, set `fix` to a list of arguments.
`--fix` runs every correction, then runs them again on the files that changed, so a formatter
sees what a codemod wrote. Then it runs the checks again. The corrections change your working
tree, not the staging area.

A correction that exits with one of the check's `exit_codes` left findings in place.
Other nonzero exits count as a failed run.

When a tool uses its findings exit code for crashes too, set `crash_pattern` to a regular
expression that matches its crash messages. A match counts as a failed run, whatever the exit
code.

## Native exclusions

Set `ignore_file = ".exampleignore"` on the check to read ordered gitignore patterns from that scope-relative file. Saved `[[ignore]]` exclusions still apply. Include the ignore file in Git with your check policy.
