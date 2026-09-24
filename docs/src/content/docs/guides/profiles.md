---
title: Share a team profile
description: Export portable policy, review it, and use it when initializing another repository.
---

With the [CLI available](/guides/install/), start from the root of a configured repository
whose policy you want to share:

```bash
gspot export team.profile.toml
```

Choose a destination inside the repository, relative to your working directory. Export refuses
symlinked destinations, unrelated existing content, and later edits to a previous export.
Repeat the command to refresh an unchanged export. Apply and uninstall retain exported profiles.
An interrupted export resumes through the local recovery journal when you retry.

Read the resulting TOML and the list of omitted entries. A profile excludes repository-specific
scope definitions, custom checks, generated/vendored declarations, and path-based entries.
It is not a backup of hooks, original files, or installation state.

## Preview adoption

Copy the reviewed profile into the new repository. Change to its root, then preview initialization:

```bash
gspot init --from team.profile.toml --dry-run
```

The preview validates the profile and reports the proposed changes without applying them.
Fix reported profile errors before continuing. Then run:

```bash
gspot init --from team.profile.toml
```

Review and accept the plan. Initialization applies it once and runs no checks. Run `gspot check`
after setup. A profile with `selection = "exact"` selects its configuration list; `selection = "detect"`
combines its policy with project detection.

Adopting an existing tool configuration preserves the profile settings for that tool which
the repository does not override. For example, a native spelling locale can override the
profile locale while retaining the profile word allowances.

## Share a remote source

The same `--from` option accepts HTTPS and `github:owner/repository` sources. Review the source
and use an immutable revision when reproducibility matters. Exported policy is copied into
the receiving repository; changing the source profile does not silently rewrite existing projects.
Keep repository-specific exceptions in each repository and review profile updates as policy changes.
