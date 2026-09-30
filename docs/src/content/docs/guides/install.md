---
title: Install
description: Install gspot from npm and set it up in a repository.
sidebar:
    order: 1
---

gspot is an npm package. It runs on Node.js 22 or newer, or on Bun, under macOS, Linux, and
Windows. You also need Git.

## Install gspot

In a JavaScript or TypeScript repository, add gspot as a development dependency:

```bash
npm install --save-dev gspot
```

With another package manager, use its add command: `pnpm add -D gspot`, `yarn add -D gspot`,
or `bun add -d gspot`.

In a repository without `package.json`, install gspot once for your user:

```bash
npm install --global gspot
```

Check that it runs:

```bash
npx gspot --version
```

The command prints the version, such as `0.1.0`. After a global install, you can leave out
`npx`.

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
It changes no tracked file. If the policy and the locks disagree, `install` stops. The person
who changed the policy runs `gspot apply` and commits the result.

## Match the repository version

`gspot init` records the gspot version in `.gspot/version`. When mise runs the repository, it
also pins that version in `.mise/conf.d/gspot-tools.toml`. Every person on the repository runs
that version.

A different version refuses `gspot check` and prints two ways forward: install the pinned
version, or move the pin. To move the pin, preview the change, apply it, and install:

```bash
npx gspot apply --dry-run
npx gspot apply
npx gspot install
```

## Tools gspot runs

Git must be on your `PATH`. gspot installs its npm and Python tools in a private project under
`.gspot/`, so your own dependencies do not change. When mise runs the repository, mise also
installs the native tools, such as ShellCheck. Without mise, see
[package managers](/guides/without-mise/).

The `bash` kit needs Bash 4.4 or newer. macOS ships Bash 3.2, so install a newer one with
`brew install bash`. With Bash 3.2, the bash checks report that Bash is too old.
