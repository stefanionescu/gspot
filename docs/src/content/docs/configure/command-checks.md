---
title: Command checks
description: Run your own command as a gspot check, with its findings in the same report.
---

A command check runs a command of your own on the files that you choose. gspot reads the output of the command as
findings, and shows them in the same report as the findings of every other check.

## Example: find unfinished notes

This check reports each line with `FIXME` in the files under `notes/`. It needs Node.js on your `PATH`. In a JavaScript
or TypeScript project, it also needs `@types/node` in `devDependencies`, so that `javascript/tsc` knows the types of
`process` and `node:fs`.

Save this script under the file name in its title:

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

Save this note under the file name in its title:

```text title="notes/deploy.txt"
FIXME: document the deployment command.
```

Write the generated files and run the check:

```shell
gspot install
gspot check --only notes
```

`gspot check` exits with `1` and reports a finding on line 1 of the note. Replace that line with the finished text:

```text
Run the deployment command documented in the release guide.
```

Run the same check again. `gspot check` exits with `0` and reports no findings.

## How the command runs

`command` is a list of arguments, and gspot runs it without a shell. gspot replaces `{files}` with the selected files,
one argument for each file. File names with spaces need no extra quotes. To run the command once for each file, use
`{file}` instead. With `{file}`, a regular expression match that has no `file` group belongs to the file of that run.

By default, any exit code other than 0 fails the check. When your tool exits with one code for findings, set
`exit_codes = [1]`. Any other exit code except 0 then counts as a failed run, and gspot exits with code `2`, even when
the tool printed findings first. With an empty list, every exit code other than 0 counts as a failed run.

## Read the output

`output.format` sets how gspot reads the output. [The format list](/reference/gspot-toml/#command_check.output.format)
says what each format reads.

With `format = "regex"`, the named groups of the pattern mean:

| Group     | Meaning                                                              |
| --------- | -------------------------------------------------------------------- |
| `file`    | The path of the file, relative to the folder where the command runs. |
| `line`    | The line number.                                                     |
| `column`  | The column number.                                                   |
| `rule`    | The name of the lint rule.                                           |
| `message` | The text of the finding.                                             |

With `format = "json"`, name the field of the report that holds each value:

```toml
output = { format = "json", fields = { message = "message" } }
```

When gspot cannot parse the output, the run does not finish, and gspot exits with code `2`.

## Add a fix command

To give the check a fixer for `gspot check --fix`, set `fix` to a list of arguments. `--fix` runs every fixer, and then
runs them again on the files that changed, so that a formatter also formats what another fixer wrote. Then it runs the
checks again. The fix commands change the files in your working tree, not the staged files.

If the fix command exits with one of the `exit_codes`, gspot reports the findings that remain. Any other exit code
except 0 counts as a failed run.

[Command check settings](/reference/gspot-toml/#command_check) lists the keys and the values that they accept.
