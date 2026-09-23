---
title: Diagnose a check that cannot run
description: Resolve missing tools, mismatched locks, version pins, and edited generated files.
---

Use the [source installation guide](/guides/install/) to prepare the CLI. Run the commands below
from the repository root unless a step names another directory.

Run diagnostics from the repository root:

```bash
gspot doctor
```

Keep the command output, check name, and reproduction command when reporting a problem.
Do not include credentials from configuration or environment variables.

## Configuration does not load

TOML syntax and schema errors name the file, line, and column. Correct the named value or
table, then rerun the command. For a missing required value, the location identifies its
nearest authored table. Syntax diagnostics do not print neighboring configuration lines.
Missing scopes, invalid adopted tool paths, missing reasons, and disabled-rule errors also
identify their policy declarations.
Unknown presets and unsupported settings name their source entries. A refused loosening
points to the configured value and includes the command for recording its reason.

## A tool is missing

Run `gspot install` to install the matching private tool projects. Native tools need the
selected mise integration or [manual provisioning](/guides/without-mise/). Doctor reports
missing prerequisites separately from successful execution. Skipping a tool does not prove
its check passes.

## Configuration and locks disagree

`install` consumes matching locks without regenerating tracked files. Run `gspot apply` when
you intentionally change policy or upgrade tool dependencies. Review and share its output.
Then teammates can run `gspot install` against the matching policy and locks.

## The CLI version differs from the pin

Read `.gspot/version`. Use that exact CLI version, or intentionally upgrade with the target
binary and `gspot apply`. Preview first:

```bash
gspot apply --dry-run
```

Review the generated text diff and the added, removed, and changed rule entries. Rule
comparisons use each tool's configuration format. If a configuration cannot be compared,
the preview retains its text diff and reports the reason. Executable ESLint comparisons need
the project's installed dependencies; missing dependencies are reported explicitly.

`gspot apply` validates configuration, prepares generated output, and changes the pin after
successful application. It runs no checks. Run `gspot check` separately.

## Generated files have local edits

Apply preserves conflicting edits instead of assuming they belong to gspot. Review the named
paths. Move intentional policy changes into `gspot.toml`, then apply again. Keep authored copies
until you understand the conflict. Uninstall also preserves conflicts; see
[restoration and recovery](/guides/uninstall/).

## A check is slow

Run the printed reproduction command to isolate it. Use `--verbose` for execution details.
Use `--no-cache` when checking whether a cached result differs. An affected project-wide check
can read more files than the selected paths. A timeout or canceled command is not a clean result.

Swift compilation reuses compiler state. SwiftLint analysis runs at the manual stage and uses
a separate clean build to capture its complete compiler log. Build state lives under a
repository-specific `gspot` directory in the platform cache:

- macOS: `~/Library/Caches`.
- Linux: `XDG_CACHE_HOME`, or `~/.cache` when unset.
- Windows: `LOCALAPPDATA`, or `~/AppData/Local` when unset.

The environment overrides are optional absolute directory paths. Relative values fail before
build-cache access. Compiler state is separate from the check-result cache in `.gspot/cache`.

Run the analyzer with:

```shell
gspot check --stage manual --only swift/swiftlint-analyze
```

A full check with caching enabled removes unchanged, owned cache results older than 30 days.
Narrowed checks and `--no-cache` leave those files alone. Edited or unowned cache files remain
preserved.

## A Windows path is refused

Managed paths reject drive-relative paths, UNC paths, reserved device names, and linked
output directories. Use repository-relative paths with forward slashes in `gspot.toml`.
Run `gspot apply` after correcting the policy.
