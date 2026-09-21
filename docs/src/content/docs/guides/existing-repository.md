---
title: Run it in a repository you already have
description: What init deletes, carries and leaves alone when the repository already has linting.
sidebar:
    order: 2
---

`gspot init` on a repository with linting in it replaces what it owns and lists what it can prove
redundant. It prints its plan and waits for a yes.

If the plan lists unread configuration, `init` exits with status 2 before
writing or installing anything. Fix the listed files and run `gspot init` again.
Use `gspot init --dry-run` to inspect the proposal without changing files.
Executable formatter and ESLint configurations are evaluated through the installed owning tool.
The proposal identifies captured settings and retained behavior. Missing ESLint, processors,
plugin behavior, and selectors that cannot be carried remain in the original configuration.
A tool evaluation failure is unread configuration and refuses initialization.

## What it deletes

Readable configurations of selected tools include `typos.toml`, `.shellcheckrc`,
and `.markdownlint.jsonc`. Before replacing or removing a file, gspot saves its exact bytes
and permissions in local recovery data under `.gspot/recovery/`. Keep that directory private
and retain it until you no longer need the originals.

## What it carries

The exception lists, because they are facts about the repository and not policy:

- typos words and excludes;
- rules turned off in a linter configuration, as `[[ignore]]` entries;
- gitleaks allowlists, osv ignored advisories and license exceptions, when those presets run.

Every carried entry says `carried from <file> at init` as its reason. Rewrite or remove it when
you have read it.

## What it lists and leaves alone

- Local executable hooks: `gspot install` preserves each original as a `.gspot-original`
  sibling and installs a dispatcher in the directory Git already uses. It preserves arguments,
  input, and failure status without changing `core.hooksPath`. Tracked hooks remain intact and
  require integration through their hook manager.
- `gspot uninstall` restores an unchanged dispatcher and retains edits to its original hook.
  An edited dispatcher stays in place for review.
- A folder of lint scripts nothing in the gate calls, a manifest whose dependencies are all
  tools gspot pins, a duplicate pin of a tool gspot pins.
- A tool gspot has no preset for: add it as a `[[check]]` entry in `gspot.toml` when you want it
  in the gate.

To allow caching for a repository check, declare `inputs` as root-relative file globs that
cover every file its command reads, including ignored files. Leave `inputs` out when the
command depends on external state that those files do not capture. Changes to input bytes
or matching paths invalidate the cached result.

## Remove gspot configuration

Preview the recorded removals and restorations:

```sh
gspot uninstall --dry-run
```

Run `gspot uninstall --yes` to apply them. Uninstall restores originals only when the
destination is absent or still matches the installed value. Later edits, unowned files,
`gspot.toml`, and local recovery data remain.

A fresh clone has no local ownership record. Its files remain even when they match generated
templates. If you run `gspot apply`, gspot preserves those existing bytes and permissions as
originals for later restoration. Git tracking and generated markers do not authorize deletion.

## The first run

After accepting the proposal, `init` writes the configuration and installs the tools.
Run `gspot check` when you are ready to see findings. Adding a preset or upgrading
also leaves check execution to an explicit command.

## CI

Select a provider with `gspot init --ci github` or `gspot init --ci gitlab`. Existing CI files
determine the default before the remote hostname. When initialization finds an authored lint
job, the plan identifies it and proposes no duplicate job.

For GitLab, gspot writes `.gitlab/ci/gspot.yml`. Add its include to your existing pipeline:

```yaml
include:
  - local: .gitlab/ci/gspot.yml
```

The generated job runs for merge requests and the default branch. It retains JSON, SARIF, and
GitLab Code Quality reports after a failed check. See the GitLab documentation for
[local includes](https://docs.gitlab.com/ci/yaml/#includelocal) and
[Code Quality reports](https://docs.gitlab.com/ci/testing/code_quality/).

For GitHub, the workflow checks pull requests, merge queues, and pushed commits. Manual checks
run in separate jobs on default-branch pushes. Each stage and platform retains its own reports.
A separate code-scanning job uploads available SARIF reports after repository pushes. Set
`ci.sarif` to `false` when the repository does not use GitHub code scanning:

```sh
gspot set ci.sarif false
gspot apply
```

CI checks changes relative to the event base. An absent base on a first push checks the full
tree. An invalid or unavailable comparison object fails the job. To check the full tree on
every CI run:

```sh
gspot set ci.run all
gspot apply
```

CI installs tracked tool locks before checking. Generated shell steps require Bash.
Generated jobs require the selected installer
on the runner. The mise integration provisions its pinned tools; without mise, provision the
package manager, uv when Python tools are selected, and required native tools on the runner.
