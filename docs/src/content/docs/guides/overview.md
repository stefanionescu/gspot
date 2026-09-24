---
title: Overview
description: Choose a setup, run checks, and resolve findings with gspot.
---

gspot configures linters, runs checks, and generates instructions for coding agents from one repository configuration. It runs selected tools
and repository checks, then reports findings with paths, check names, and correction guidance.
It does not determine who wrote the code.

## Set up a repository

Start with the [source installation prerequisites](/guides/install/). From your project root,
`gspot init` proposes configurations and configuration. A configuration selects checks and the tools they need.
Review the proposed writes before accepting them. Initialization does not run checks.

- For a disposable example, [run your first check](/guides/quick-start/).
- To retain existing configuration, [adopt gspot in an existing repository](/guides/existing-repository/).
- After cloning a configured repository, [install its locked tools and hooks](/guides/install/#join-a-configured-repository).

## Check and correct

From a configured repository root, run `gspot check`. Exit 0 means the executed checks passed,
1 means findings remain, and 2 means a check could not complete. Read skipped-check messages:
a skip does not verify the affected files.

A finding names its check and explains what to correct. Edit the affected file and rerun the
check. Use [finding guidance](/guides/you-got-a-finding/) to inspect a check, select a narrower
run, or use an available automatic fixer. Checks that require external tools need those tools
installed first.

## Maintain the policy

`gspot.toml` owns the policy. [Choose checks and exceptions](/guides/customize/) there or through
the configuration commands. Commands apply their changes; after a manual edit, run `gspot apply`
to regenerate configuration. Review generated
changes and share matching tool locks. Teammates run `gspot install` after receiving them.

Use [scopes](/guides/scopes/) for different parts of a repository and [profiles](/guides/profiles/)
for policy shared across repositories. Configure [hooks and CI](/guides/hooks-and-ci/) to run
checks at the intended stages. If setup or removal conflicts with edited files, follow the
[recovery procedure](/guides/uninstall/) before deleting anything.

## From policy to findings

![Policy, apply, and check workflow](/brand/diagrams/workflow.svg)

Choose configurations and settings in policy. Run `gspot apply` to generate configuration for those
tools. Run `gspot check` to execute the selected checks and report findings. Correct the code
or change policy with a reason, then apply policy changes before checking again.
