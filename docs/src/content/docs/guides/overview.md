---
title: What gspot does
description: Understand configurations, checks, settings, and the files gspot manages.
---

gspot sets up linters and checks for the languages in your repository. Git hooks run checks before commits and pushes. A finding stops the Git operation. CI runs checks again and fails its job when findings remain.

`gspot init` detects languages, frameworks, dependencies, and shared file types. It shows the configurations, tool requirements, and files it proposes before writing them. Your choices live in `gspot.toml`.

## Levels

| Level                   | What it checks                                                                                                                                  | Examples                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `recommended` (default) | Correctness, security, accessibility, type safety, dependency health, formatting, and declared project contracts                                | `bash/syntax`, `typescript/tsc`        |
| `all`                   | Everything at `recommended`, plus conventions for vocabulary, naming, architecture, documentation, declaration order, API style, and complexity | `naming/paths`, `structure/lone-files` |

At level `all`, gspot also reports unnecessary forwarding files and functions. Neither level enables experimental or preview rules. Use `gspot set level all` to select the additional conventions, or enable an individual check with `extra_checks`.

## Concepts

- A **configuration** is a built-in setup for a language, framework, library, platform, or concern. [Configuration reference](/reference/configurations/).
- A **template** exports reusable configuration choices and policy for another repository. [Reuse templates](/guides/templates/).
- **Settings** are values customized in `gspot.toml`. A **config file** is a tool's own configuration file. [Policy guide](/guides/policy/).
- A **check** runs a tool or analyzes source and reports findings. [Check reference](/reference/checks/).
- A **rule** is an individual lint instruction or an instruction for a coding agent. [ESLint plugin](/reference/plugin/) and [coding agents](/guides/agents/).
- A **stage** determines when a check runs: commit, push, message, or manual. [Hooks](/guides/hooks/).
- A **scope** identifies a project inside a repository. It has its own configurations and settings. [Monorepos](/guides/monorepos/).
- A **runner** launches gspot through mise or a package manager. [Runners](/guides/runners/).
- A **managed block** is a marked section gspot can update while keeping the rest of the file. A **pointer** is an editor-facing config file that refers to generated configuration. [Generated files](/guides/generated-files/).

## Next steps

Read the [requirements](/guides/requirements/), choose an [installation method](/guides/install/), and follow a quickstart for [TypeScript](/guides/quickstart/typescript/), [Python](/guides/quickstart/python/), or [Swift](/guides/quickstart/swift/).
