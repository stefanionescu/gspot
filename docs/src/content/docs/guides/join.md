---
title: Join a repository
description: Install the pinned gspot version, checks, and hooks after cloning.
---

Use the version recorded in `.gspot/version`. `gspot init` refuses to run where `gspot.toml` exists; use `gspot install`.

## With a JavaScript package manager

Install app dependencies from the committed lockfile, then run the matching commands:

| Manager      | Dependencies                     | Prepare checks            | Check                   |
| ------------ | -------------------------------- | ------------------------- | ----------------------- |
| npm          | `npm ci`                         | `npx gspot install`       | `npx gspot check`       |
| pnpm         | `pnpm install --frozen-lockfile` | `pnpm exec gspot install` | `pnpm exec gspot check` |
| Yarn Classic | `yarn install --frozen-lockfile` | `yarn exec gspot install` | `yarn exec gspot check` |
| Yarn Berry   | `yarn install --immutable`       | `yarn exec gspot install` | `yarn exec gspot check` |
| Bun          | `bun install --frozen-lockfile`  | `bunx gspot install`      | `bunx gspot check`      |

Without mise, install the program tools yourself. `gspot doctor` names missing requirements.

## With mise

```shell
mise exec -- gspot install
mise exec -- gspot check
```

`gspot install` installs the tools and turns on hooks in this clone. If it fails, fix the error and run it again.
When another hook manager runs your hooks, add the gspot hook lines that install prints.
See [Git hooks](/guides/hooks/).

If `gspot install` changes a lockfile under `.gspot/`, commit that file. If it fails, see [Troubleshooting](/guides/troubleshooting/).
