---
title: Install
description: Install gspot from npm and set it up in a repository.
sidebar:
    order: 1
---

gspot is an npm package. It runs on Node.js 22 or newer, or on Bun, under macOS, Linux, and
Windows. You also need Git. The `bash` kit needs Bash 4.4 or newer; macOS ships Bash 3.2, so
install a newer one with `brew install bash`.

## Install gspot

In a JavaScript or TypeScript repository, add gspot as an exact development dependency, so the
version stays the one the repository pins:

```bash
npm install --save-dev --save-exact @gspothq/cli
```

With another package manager: `pnpm add -D -E @gspothq/cli`, `yarn add -D -E @gspothq/cli`, or
`bun add -d --exact @gspothq/cli`. In a repository without `package.json`, install it once for
your user with `npm install --global @gspothq/cli`.

Check that it runs with `npx gspot --version`. After a global install, leave out `npx`.

## Set up a repository

From the root of your repository, run:

```bash
npx gspot init
```

`init` shows a plan and writes it after you accept. The Git hooks it installs run gspot through
your package manager, or through the `gspot` on your `PATH`. The
[quickstart](/guides/quick-start/) goes through a full example.

## Join a configured repository

When a teammate already set up gspot, install the dependencies of the repository and run:

```bash
npx gspot install
npx gspot check
```

`install` installs the tools at the versions in the committed locks and sets up the Git hooks.
It changes no tracked file. If the policy and the locks disagree, `install` stops: the person
who changed the policy runs `gspot apply` and commits the result.

`.gspot/version` pins the gspot version of the repository, and another version refuses to
check. [Upgrade gspot](/guides/customize/#upgrade-gspot) says how to move the pin.
