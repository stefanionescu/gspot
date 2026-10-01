---
title: Team profiles
description: Export your policy as a profile and start another repository from it.
---

A profile is a policy other repositories can start from. It carries your kits, your level, and
your settings to a new repository.

## Export a profile

From the root of a configured repository, run:

```bash
gspot export team.profile.toml
```

The destination is relative to the current folder and inside the repository. gspot refuses a
destination that is a link, a file with other content, or an export you edited later. Run the
same command again to refresh an export you did not edit.

Read the profile before you share it. A profile leaves out everything that belongs to one
repository: scopes, custom checks, generated and vendored declarations, and entries that name a
path. The command lists what it left out. A profile holds no hooks or installed tools.

## Start a repository from a profile

1. Copy the profile into the new repository.
2. From its root, preview the plan:

    ```bash
    gspot init --from team.profile.toml --dry-run
    ```

    The preview checks the profile and shows the plan. It writes nothing. Fix any error it
    reports.

3. Run init and accept the plan:

    ```bash
    gspot init --from team.profile.toml
    ```

Init writes the plan once and runs no check, so run `gspot check` afterwards.

With `selection = "exact"`, the profile's kit list is the selection. With
`selection = "detect"`, gspot adds the kits it detects in the repository.

## Share a profile from a URL

`--from` also takes an HTTPS URL or `github:owner/repository`. Pin an exact revision when you
need the same result every time. gspot copies the profile into the repository, so a later
change to the source does not change repositories that already used it. Keep exceptions for one
repository in that repository, and review profile updates like any policy change.
