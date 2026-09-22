---
title: Diagnose a check that cannot run
description: Resolve missing tools, mismatched locks, version pins, and edited generated files.
---

Run diagnostics from the repository root:

```bash
gspot doctor
```

Keep the command output, check name, and reproduction command when reporting a problem.
Do not include credentials from configuration or environment variables.

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

Upgrade migrates configuration before target validation, prepares generated output, and changes
the pin after successful application. It runs no checks. Run `gspot check` separately.

## Generated files have local edits

Apply preserves conflicting edits instead of assuming they belong to gspot. Review the named
paths. Move intentional policy changes into `gspot.toml`, then apply again. Keep authored copies
until you understand the conflict. Uninstall also preserves conflicts; see
[restoration and recovery](/guides/existing-repository/).

## A check is slow

Run the printed reproduction command to isolate it. Use `--verbose` for execution details.
Use `--no-cache` when checking whether a cached result differs. An affected project-wide check
can read more files than the selected paths. A timeout or canceled command is not a clean result.

Swift compilation reuses compiler state. SwiftLint analysis runs at the manual stage and uses
a separate clean build to capture its complete compiler log:

```shell
gspot check --stage manual --only swift/swiftlint-analyze
```

A full check with caching enabled removes unchanged, owned cache results older than 30 days.
Narrowed checks and `--no-cache` leave those files alone. Edited or unowned cache files remain
preserved.

## Windows lifecycle mutations refuse

The current implementation refuses lifecycle writes on Windows because its secure mutation
boundary is not implemented there. A cross-compiled Windows executable does not remove that
limitation. Do not bypass the refusal with direct generated-file edits.
