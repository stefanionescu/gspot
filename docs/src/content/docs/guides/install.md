---
title: Install gspot
description: Run the prerelease CLI from a contributor checkout.
sidebar:
    order: 1
---

gspot is prerelease. Public npm packages and release binaries are not available yet.
Use a repository checkout for contributor work:

```bash
git clone https://github.com/stefanionescu/gspot.git
cd gspot
bun install
bun packages/cli/src/main.ts --help
```

Run the source entry point with Bun from the repository you want to check. Candidate package
validation uses an isolated local registry. A cross-compiled binary does not establish that
its target platform has passed acceptance.

## What the repository pins

`gspot init` writes `.gspot/version` and, when mise runs the repository, a pin in
`.config/mise/conf.d/gspot.toml`. Everyone on the repository runs that version; another version
refuses `check` and says how to install the pinned one or move the pin with
`gspot upgrade --to`.
