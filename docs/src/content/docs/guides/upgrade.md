---
title: Upgrade gspot
description: Install a new CLI version and regenerate the repository pin and configuration.
---

Start with a clean working tree and read the release notes. Keep the previous commit so you can restore its policy and lockfiles if verification fails.

## Install the new version

For npm, install the intended exact version, for example:

```shell
npm install --save-dev --save-exact @gspothq/cli@0.1.0
```

Use the equivalent exact install with pnpm, Yarn, or Bun. With a global installation, use `npm install --global @gspothq/cli@0.1.0`.

For mise, first run the new version explicitly so the old repository pin does not choose the old executable:

```shell
mise exec npm:@gspothq/cli@0.1.0 -- gspot apply --dry-run
mise exec npm:@gspothq/cli@0.1.0 -- gspot apply
```

Replace the example version with the release you reviewed. `apply` updates `.gspot/version` and the generated mise pin from the running CLI.

## Regenerate and verify

With the new version and the prefix for your runner:

```shell
gspot apply --dry-run
gspot apply
gspot install
gspot doctor
gspot check
```

Review the policy, generated config files, tool requirements, and lockfile changes. An edited managed output is reported instead of overwritten. Move its desired settings into `gspot.toml` and move the edited output aside before regenerating it.

Commit the updated CLI dependency, policy, generated files, and lockfiles together. Teammates then follow [Join a repository](/guides/join/).
