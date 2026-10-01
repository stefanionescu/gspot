---
slug: guides/custom-checks
title: Custom checks
description: Run your own command as a gspot check, with its findings in the same report.
---

A custom check runs a command of yours on the files you select. gspot reads its output as
findings, so they appear in the same report as every other check.

## Example: find unfinished notes

This check reports `FIXME` lines in the files under `notes/`. It needs Bun on your `PATH`.

Save the checker as `scripts/check-notes.ts`:

```typescript
for (const path of process.argv.slice(2)) {
    const lines = (await Bun.file(path).text()).split('\n');
    for (const [index, line] of lines.entries()) {
        if (!line.includes('FIXME')) continue;
        console.log(`${path}:${index + 1}: ${line}`);
        process.exitCode = 1;
    }
}
```

Add the check to `gspot.toml`. For a new repository, this is the complete policy. In an
existing policy, add only the `[[check]]` entry and its `[check.output]` table:

```toml
version = 1
kits = []

[[check]]
name = "project/notes"
command = ["bun", "scripts/check-notes.ts", "{files}"]
paths = ["notes/**"]
stage = "commit"
summary = "Finds unfinished FIXME notes."
help = "Replace each FIXME note with the completed instruction."

[check.output]
format = "regex"
pattern = '^(?<file>[^:]+):(?<line>\d+): (?<message>.*)$'
```

Save a note with a defect as `notes/deploy.txt`:

```text
FIXME: document the deployment command.
```

Apply the policy and run the check:

```bash
gspot apply
gspot check --only project/notes
```

The check exits with `1` and reports a finding at `notes/deploy.txt:1`. Replace the note with
the finished instruction:

```text
Run the deployment command documented in the release guide.
```

Run the same check again. It exits with `0` and reports no findings.

## How the command runs

`command` is a list of arguments, and gspot runs it without a shell. `{files}` expands to the
selected files, one argument each. File names with spaces need no extra quoting. To run the
command once for each file, use `{file}` instead. Then a regex match without a `file` group
uses the file of that run.

By default, any nonzero exit fails the check. When your tool uses one exit code for findings,
set `findings_exit_codes = [1]`. Any other nonzero exit then counts as a failed run, exit code
`2`, even when the tool printed findings first. An empty list makes every nonzero exit a failed
run.

## Read the output

`[check.output]` decides how the output becomes findings:

- `format = "regex"` matches each line. The groups `file`, `line`, and `message` fill the
  finding.
- For JSON output, map the fields of your tool under `[check.output.fields]`. Name nested
  arrays with `items` or `children`.
- `format = "typos-json"` reads the JSON of typos. It turns byte offsets into character columns.
- `format = "markdownlint-json"` reads the results of markdownlint.

Malformed output counts as a failed run, exit code `2`. The
[policy reference](/reference/configuration/#check) lists every field.

## Count failures in the output

Some tools print a summary and always exit with `0`. For those, set `count_regex` on the check.
With `count_regex = "FAILED"`, each match in stdout or stderr is a failure. Use it only for a
tool that works this way.

## Add a correction command

To let `gspot check --fix` correct the findings, set `fix_command` to a list of arguments.
`--fix` runs every correction, then runs them again on the files that changed, so a formatter
sees what a codemod wrote. Then it runs the checks again. The corrections change your working
tree, not the staging area.

A correction that exits with one of the check's `findings_exit_codes` left findings in place.
Other nonzero exits count as a failed run.

When a tool uses its findings exit code for crashes too, set `tool_errors` to a regular
expression that matches its crash messages. A match counts as a failed run, whatever the exit
code.
