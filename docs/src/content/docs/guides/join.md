---
title: Join a repository
description: Install the pinned gspot version, checks, and hooks after cloning.
---

Use the version recorded in `.gspot/version`. Do not run `init` in a repository that already has `gspot.toml`.

## With a JavaScript package manager

Install app dependencies from the committed lockfile, then run the matching commands:

| Manager      | Dependencies                     | Prepare checks            | Check                   |
| ------------ | -------------------------------- | ------------------------- | ----------------------- |
| npm          | `npm ci`                         | `npx gspot install`       | `npx gspot check`       |
| pnpm         | `pnpm install --frozen-lockfile` | `pnpm exec gspot install` | `pnpm exec gspot check` |
| Yarn Classic | `yarn install --frozen-lockfile` | `yarn gspot install`      | `yarn gspot check`      |
| Yarn Berry   | `yarn install --immutable`       | `yarn gspot install`      | `yarn gspot check`      |
| Bun          | `bun install --frozen-lockfile`  | `bunx gspot install`      | `bunx gspot check`      |

Install native tools when the repository does not use mise. `gspot doctor` names missing requirements.

## With mise

```shell
mise trust .mise/conf.d/gspot-tools.toml
mise install
mise exec -- gspot install
mise exec -- gspot doctor
mise exec -- gspot check
```

## With a global npm install

On a POSIX shell, install the repository's pin:

```shell
npm install --global "@gspothq/cli@$(cat .gspot/version)"
gspot install
gspot doctor
gspot check
```

In PowerShell, read the same pin with `Get-Content .gspot/version` and supply it to `npm install --global`.

`install` prepares required missing or outdated lockfiles in tool projects, then installs the tools and sets up hooks in this clone. If installation fails, repair the registry, credentials, or package manager and run `install` again. Commit any updated lockfiles with the policy. When another hook manager owns the hooks, add the three integration lines printed by `install`. Otherwise, gspot checks will not run on commit or push.
