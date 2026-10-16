---
title: Upgrade gspot
description: Install a new CLI version and regenerate the repository pin and configuration.
---

Commit first, so you can go back. Read the [release notes](https://github.com/stefanionescu/gspot/releases) of the
version you pick, and use that version, such as `1.2.0`, in place of `<version>` below.

## With a package manager

```shell
npm install --save-dev --save-exact '@gspothq/cli@<version>'
npx gspot apply
npx gspot install
npx gspot check
```

With pnpm, Yarn, or Bun, use that package manager's exact install command and start command.
See [Install gspot](/start/install/).

## With mise

```shell
mise use --pin --tool-option allow_low_downloads=true npm:@gspothq/cli@<version>
mise exec -- gspot apply
mise exec -- gspot install
mise exec -- gspot check
```

`gspot apply` writes the new version to `.gspot/version` and updates the generated files. The editor schema stays at
[one address](https://generativespotting.com/gspot.schema.json) for every version. Review the diff, fix any findings, and commit `package.json` and its lockfile, or `mise.toml`,
`gspot.toml`, and the files in `.gspot/` together. Teammates then run `gspot install`. See
[Set up a clone](/start/install/#set-up-a-clone).
