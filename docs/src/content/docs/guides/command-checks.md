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

Add the check to `gspot.toml` as a `[[command_check]]` record:

```toml
[[command_check]]
name = "notes"
command = ["node", "scripts/check-notes.mjs", "{files}"]
paths = ["notes/**"]
stage = "commit"
summary = "Finds unfinished FIXME notes."
help = "Replace each FIXME note with the finished instruction."
output = { format = "regex", pattern = '^(?<file>[^:]+):(?<line>\d+): (?<message>.*)$' }
```

Save this note under the example filename:

```text title="notes/deploy.txt"
FIXME: document the deployment command.
```

Apply the settings and run the check:

```bash
gspot apply
gspot check --only notes
```

The check exits with `1` and reports a finding on the note's first line. Replace it with
the finished instruction:

```text title="Fixed note"
Run the deployment command documented in the release guide.
```

Run the same check again. It exits with `0` and reports no findings.

## How the command runs

`command` lists arguments; gspot runs them without a shell. `{files}` expands to the
selected files, one argument each. File names with spaces need no extra quoting. To run the
command once for each file, use `{file}` instead. Then a regular expression match without a `file` group
uses the file of that run.

By default, any nonzero exit fails the check. When your tool uses one exit code for findings,
set `exit_codes = [1]`. Any other nonzero exit then counts as a failed run, exit code
`2`, even when the tool printed findings first. An empty list makes every nonzero exit a failed
run.

## Read the output

`output` decides how the output becomes findings:

- `format = "regex"` matches each line. The groups `file`, `line`, and `message` fill the
  finding.
- Set `format = "json"` for JSON output, then map fields under `output`. Use `items` or `children` for nested results:

    ```toml
    output = { format = "json", fields = { message = "message" } }
    ```

gspot also reads the JSON of Semgrep, TruffleHog, typos, markdownlint, and Knip; see the [gspot.toml reference](/reference/gspot-toml/#command_check).

Malformed output counts as a failed run, exit code `2`. The
[gspot.toml reference](/reference/gspot-toml/#command_check) lists every field.

## Add a fix command

To let `gspot check --fix` fix the findings, set `fix` to a list of arguments.
`--fix` runs every fixer, then runs them again on the files that changed, so a formatter
reads what another fixer wrote. Then it runs the checks again. The fix commands change your working tree, not the staging area.

If the fix command exits with one of the `exit_codes`, gspot reports remaining findings.
Other nonzero exits count as a failed run.
