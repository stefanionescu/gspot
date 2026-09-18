---
title: Install gspot
description: Put the gspot binary on your machine through mise, npm or a release download, and pin it in the repository.
sidebar:
    order: 1
---

gspot is one binary. Install it once on your machine to run `gspot init`; after that the
repository pins its own version and the hooks run that one.

## With mise

```bash
mise use -g ubi:stefanionescu/gspot@latest
gspot --version
```

## With npm

```bash
npm install -g gspot
gspot --version
```

The npm package is a launcher that installs the binary for your platform.

## From a release

Download the file for your platform from the
[releases page](https://github.com/stefanionescu/gspot/releases), put it on your `PATH`, and run
`gspot --version`.

## What the repository pins

`gspot init` writes `.gspot/version` and, when mise runs the repository, a pin in
`.config/mise/conf.d/gspot.toml`. Everyone on the repository runs that version; another version
refuses `check` and says how to install the pinned one or move the pin with
`gspot upgrade --to`.
