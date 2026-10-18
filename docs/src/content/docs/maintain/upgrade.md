---
title: Upgrade gspot
description: Install a new gspot version and update the generated files.
---

Commit first, so you can go back. Read the [release notes](https://github.com/stefanionescu/gspot/releases), pick a
release, such as `1.2.0`, and put it in place of `<version>` below.

## With a package manager

```shell
npm install --save-dev --save-exact '@gspothq/cli@<version>'
npx gspot apply
npx gspot install
npx gspot check
```

With pnpm, Yarn, or Bun, use the exact install and start commands of that package manager.
See [Install gspot](/start/install/).

## With mise

```shell
mise use --pin --tool-option allow_low_downloads=true npm:@gspothq/cli@<version>
mise exec -- gspot apply
mise exec -- gspot install
mise exec -- gspot check
```

`gspot apply` writes the new version to `.gspot/version` and updates the generated files. Review the diff and fix any findings. Then commit `gspot.toml`, the files in `.gspot/`,
and either `package.json` with its lockfile or `mise.toml`, together. Every other clone then runs `gspot install`. See
[Set up a clone](/start/install/#set-up-a-clone).
