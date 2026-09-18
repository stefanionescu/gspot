---
title: Run it in a repository you already have
description: What init deletes, carries and leaves alone when the repository already has linting.
sidebar:
    order: 2
---

`gspot init` on a repository with linting in it replaces what it owns and lists what it can prove
redundant. It prints its plan and waits for a yes.

## What it deletes

The configuration file of every tool a selected preset owns: `.eslintrc`, `eslint.config.js`,
`.prettierrc`, `typos.toml`, `.shellcheckrc`, `.markdownlint.jsonc` and the rest. Git keeps
them; the plan prints the `git show` command for each.

## What it carries

The exception lists, because they are facts about the repository and not policy:

- typos words and excludes;
- rules turned off in a linter configuration, as `[[ignore]]` entries;
- gitleaks allowlists, osv ignored advisories and license exceptions, when those presets run.

Every carried entry says `carried from <file> at init` as its reason. Rewrite or remove it when
you have read it.

## What it lists and leaves alone

- Hand-written hooks: `init` points `core.hooksPath` at `.gspot/hooks` and lists the old folder
  under `no longer runs; delete when ready`.
- A folder of lint scripts nothing in the gate calls, a manifest whose dependencies are all
  tools gspot pins, a duplicate pin of a tool gspot pins.
- A tool gspot has no preset for: add it as a `[[check]]` entry in `gspot.toml` when you want it
  in the gate.

## The first run

After the write, `init` runs every check once. A check with findings gets a baseline, so the
gate passes that day and fails when a count grows. `gspot apply --lower-baselines` lowers a baseline
as findings are fixed; it never raises one.
