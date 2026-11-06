---
title: Command checks
description: Run a command of your own as a check, with its findings in the same report as every other check.
---

A command check runs a command of your own on the files that you choose, and gspot reads its output as findings in the
same report as every other check.

## Example: find unfinished notes

This check reports each line with `FIXME` in the files under `notes/`. It needs Node.js on your `PATH`, and in a
JavaScript or TypeScript project, `@types/node` in `devDependencies`, so that `javascript/tsc` knows the types of
`process` and `node:fs`.

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
id = "notes"
command = ["node", "scripts/check-notes.mjs", "{files}"]
paths = ["notes/**"]
stage = "commit"
summary = "Finds unfinished FIXME notes."
help = "Replace each FIXME note with the finished instruction."
output = { format = "regex", pattern = '^(?<file>[^:]+):(?<line>\d+): (?<message>.*)$' }
```

Given this note:

```text title="notes/deploy.txt"
FIXME: document the deployment command.
```

Write the generated files and run the check:

```shell
gspot install
gspot check --only notes
```

`gspot check` exits with `1` and reports a finding on line 1 of the note. After you replace that line with the finished
text, the same command exits with `0`.

## How the command runs

`command` is a list of arguments, and gspot runs it without a shell. gspot replaces `{files}` with the selected files,
one argument for each file, so file names with spaces need no extra quotes. To run the command once for each file, use
`{file}` instead. With `{file}`, the pattern needs no `file` group, and each finding belongs to the file of that run.

By default, any exit code other than 0 means that the command found something. If your tool uses one code for findings
and others for crashes, set `exit_codes = [1]`. Any other non-zero code then stops the check with an error, and gspot
exits with `2`, even when the tool printed findings first.

## Read the output

`output.format` sets how gspot reads the output, and
[the format list](/reference/gspot-toml/#command_check.output.format) says what each format reads. With
`format = "regex"`, the pattern names its groups `file`, `line`, `column`, `rule`, and `message`, and `file` holds a path
relative to the folder where the command runs. With `format = "json"`, name the field of the report that holds each value:

```toml
output = { format = "json", fields = { message = "message" } }
```

When gspot cannot parse the output, the run does not finish, and gspot exits with code `2`.

## Add a fix command

To give the check a fixer for `gspot check --fix`, set `fix` to a list of arguments. `--fix` runs every fixer, runs them
again on the files that changed, so that a formatter also formats what another fixer wrote, and then runs the checks
again. The fix commands change the files in your working tree, not the staged files.

If the fix command exits with one of the `exit_codes`, gspot reports the findings that remain, and any other non-zero
code stops the run with an error.

[Command check settings](/reference/gspot-toml/#command_check) lists every setting.
