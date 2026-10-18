---
title: Command checks
description: Run your own command as a gspot check, with its findings in the same report.
---

A command check runs your own command on the files you select. gspot reads its output as
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

```shell
gspot apply
gspot check --only notes
```

The check exits with `1` and reports a finding on the first line of the note. Replace that line with
the finished instruction:

```text
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

`output.format` selects the parser:

| Format         | What it reads                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `regex`        | Lines matched by `pattern`, with named `file`, `line`, `column`, `rule`, and `message` groups. |
| `grouped`      | A file heading matched by `file_pattern`, then findings matched by `pattern`.                  |
| `sarif`        | SARIF results, rule metadata, source locations, and fixes.                                     |
| `knip`         | Knip JSON issue categories and source positions.                                               |
| `semgrep`      | Semgrep JSON results, locations, lint rule IDs, messages, and fixes.                           |
| `trufflehog`   | TruffleHog JSON findings, with raw secret output withheld.                                     |
| `typos`        | typos JSON, with byte offsets converted to character columns.                                  |
| `markdownlint` | markdownlint result objects and their lint rule and source locations.                          |
| `json`         | JSON findings selected by `items`, `children`, and `fields`.                                   |
| `lines`        | Each nonempty output line as a finding without a source location.                              |
| `none`         | Exit status only, without output findings.                                                     |

The regex groups have these meanings:

| Group     | Meaning                                                  |
| --------- | -------------------------------------------------------- |
| `file`    | Source path, resolved from the command's working folder. |
| `line`    | Source line number.                                      |
| `column`  | Source column number.                                    |
| `rule`    | Lint rule name.                                          |
| `message` | Finding text.                                            |

For JSON, map the report's field names:

```toml
output = { format = "json", fields = { message = "message" } }
```

Malformed output makes the run incomplete with exit code `2`.

## Add a fix command

For `gspot check --fix`, set `fix` to a list of arguments.
`--fix` runs every fixer, then runs them again on the files that changed, so a formatter
reads what another fixer wrote. Then it runs the checks again. The fix commands change your working tree, not the staging area.

If the fix command exits with one of the `exit_codes`, gspot reports remaining findings.
Other nonzero exits count as a failed run.

[Command check settings](/reference/gspot-toml/command_check/) lists the accepted inputs.
