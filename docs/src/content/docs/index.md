---
title: gspot
description: CLI to lint and enforce rules for LLM generated code bases.
---

gspot is a CLI to lint and enforce rules for LLM generated code bases. One binary installs the house style. It writes the configuration of the linters a repository already needs, adds the checks those linters lack, and installs the rule files an agent reads. Everything runs from one gate on commit, on push, and in CI.

## Start

```bash
gspot init --yes
gspot check
```

`init` reads the repository, proposes presets for the languages it finds, writes `gspot.toml`
and everything under `.gspot/`, and installs the hooks. `check` runs every check and prints
findings the way a linter does, one line each, with a `help:` line that says what to do.

## Read next

- [Install gspot](/guides/install/)
- [Run it in a repository you already have](/guides/existing-repository/)
- [You got a finding, now what](/guides/you-got-a-finding/)
- [Monorepos and scopes](/guides/scopes/)
- [Without mise](/guides/without-mise/)
- [Working with an agent](/guides/agents/)

The reference lists every [command](/reference/commands/init/), [preset](/reference/presets/bash/),
[check](/reference/engines/) and [setting](/reference/settings/), from the same data the binary
carries. The design lives in the
[architecture folder](https://github.com/stefanionescu/gspot/tree/main/architecture) of the
repository.
