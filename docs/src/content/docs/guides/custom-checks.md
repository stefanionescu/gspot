---
title: Add your own check
description: Run a repository command with explicit inputs, stage, and output.
---

Run commands from the configured repository root with the [CLI available](/guides/install/).

This example requires Bun on `PATH`. It reports unfinished `FIXME` notes and passes after
you replace them with completed instructions.

Create `scripts/check-notes.ts`:

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

Create `notes/deploy.txt` with this defect:

```text
FIXME: document the deployment command.
```

For a disposable project, save this complete policy as `gspot.toml`. In an existing policy,
add only the `[[check]]` entry and its `[check.output]` table:

```toml
version = 1
configurations = []

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

The command is an argument array. `{files}` expands the selected paths as arguments. Do not
add shell quoting inside an argument to compensate for spaces in filenames.

From the configured repository root, run:

```bash
gspot apply
gspot check --only project/notes --no-cache
```

Apply writes managed configuration. Check writes reports under `.gspot/` and exits 1 with a
finding at `notes/deploy.txt:1`. Replace that file with the correction:

```text
Run the deployment command documented in the release guide.
```

Run the same check again. It exits 0 with no findings. If the script cannot read a selected
file, resolve its filesystem error before rerunning.

By default, a nonzero command exit fails the check. The output adapter determines how diagnostics become
findings. Use the [configuration reference](/reference/configuration/#check) for other output
formats. For JSON, map the tool fields under `[check.output.fields]` and identify nested arrays
with `items` or `children` as needed.
Use `{file}` to invoke the command separately for each selected file. With `format = "regex"`
and path diagnostics, a match without a `file` capture uses that invocation's file. This avoids
reconstructing unusual filenames from a tool's line-oriented output. A supplied `file` capture
still names the reported location.
For native typos JSON output, use `format = "typos-json"`. It preserves filename diagnostics
and converts UTF-8 byte offsets to character columns. Malformed output and native execution
errors return status 2.
The spelling fixer changes file contents. Rename misspelled files yourself.

`markdownlint-json` accepts the native result arrays emitted by the generated Markdown CLI
configuration. It preserves filenames, source locations, and native fixability. Invalid records,
unavailable source, and fatal native exits return status 2.

## Count failures in summary output

Set `count_regex` on the `[[check]]` entry when output matches determine failure instead of
the command exit code. For example, `count_regex = "FAILED"` fails when that text appears in
stdout or stderr. Matching uses Unicode regular expressions and counts every match. A match
remains a failure even if no diagnostic includes a file location. No match does not establish
that the process completed: launch failures, interruptions, and configured `tool_errors`
still report execution errors.

Use this only for a tool with that output contract. Ordinary commands should use exit codes.

## Declare cache inputs

Add `inputs` only when file globs can describe everything the command reads. Include configuration,
lockfiles, scripts, and ignored inputs where applicable. Changed bytes or matching paths invalidate
the result. Leave `inputs` absent for a command whose result depends on uncaptured external state.

## Add a correction command

Set `fix_command` to an argument array and `fix_order` to `codemod`, `imports`, `manifest`, or
`format`. `gspot check --fix` runs correction commands in that order, then checks again.
Corrections change the working tree, not the staging area. Review partial changes if a correction
fails; do not treat a later clean check as proof that every correction succeeded.

If the correction tool documents a nonzero exit code for remaining findings, list that code
in `fix_findings_exit_codes`, for example `[1]`. This setting requires `fix_command`.
gspot checks the corrected files again to determine whether findings remain. Other nonzero
correction exits, launch failures, and interrupted runs remain execution errors with status `2`.
If a tool also uses a findings code for fatal failures, set `tool_errors` to a regular expression
matching its fatal diagnostics. gspot tests stdout and stderr with multiline and Unicode matching
for both checks and corrections. A matching diagnostic takes precedence over the exit code.
