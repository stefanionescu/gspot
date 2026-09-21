---
title: Share a team profile
description: Export portable policy, review it, and use it when initializing another repository.
---

Start from a configured repository whose policy you want to share:

```bash
gspot export team.profile.toml
```

Read the resulting TOML and the list of omitted entries. A profile excludes repository-specific
scope definitions, custom checks, generated/vendored declarations, and path-based entries.
It is not a backup of hooks, original files, or installation state.

## Preview adoption

Copy the reviewed profile into the new repository, then preview initialization:

```bash
gspot init --from team.profile.toml --dry-run
```

The preview validates the profile and reports the proposed changes without applying them.
Fix reported profile errors before continuing. Then run:

```bash
gspot init --from team.profile.toml
```

Review and accept the plan. Initialization applies it once and runs no checks. Run `gspot check`
after setup. A profile with `selection = "exact"` selects its preset list; `selection = "detect"`
combines its policy with project detection.

## Share a remote source

The same `--from` option accepts HTTPS and `github:owner/repository` sources. Review the source
and use an immutable revision when reproducibility matters. Exported policy is copied into
the receiving repository; changing the source profile does not silently rewrite existing projects.
Keep repository-specific exceptions in each repository and review profile updates as policy changes.
