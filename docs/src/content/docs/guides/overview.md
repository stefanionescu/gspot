---
title: What gspot does
description: Understand configurations, checks, settings, and the files gspot manages.
---

gspot provides a command-line tool that lints AI-generated code and writes rules for AI coding agents. Git hooks run its
checks before each commit and push, and a finding stops the commit or push. CI runs the checks again.

`gspot init` looks at your files and dependencies and shows what it will set up: the configurations, the tools they
need, and the files it will write. It writes nothing until you accept. Your choices live in `gspot.toml`.
`gspot install` then installs the tools and turns on the Git hooks.

## Levels

- `recommended`, the default, finds bugs, security and accessibility problems, type errors, formatting problems,
  and misuse of the frameworks and libraries your project declares.
- `all` also checks naming, word choice, code structure, doc comments, the order of declarations, API style, and
  complexity.

Neither level turns on experimental or preview lint rules. To check more, run `gspot set level all`.

## Words the guides use

- A **configuration** holds checks, tool files, and rules for one language, framework, library,
  platform, or tool, such as `typescript` or `docker`. See the [configuration reference](/reference/configurations/).
- A **check** runs a tool, or code implemented by gspot, and reports **findings**. See the [check reference](/reference/checks/).
- A **lint rule** specifies one thing a linter checks, such as `no-console`.
- **Rules** use Markdown to describe how coding agents must write code. See [Coding agents](/guides/agents/).
- **Settings** supply the values in `gspot.toml`. See [gspot.toml](/guides/gspot-toml/).
- A **tool file** holds settings that gspot writes for one tool, under `.gspot/config/`. A **pointer**, such as `eslint.config.mjs`, sends your editor to the tool file. See [Generated files](/guides/generated-files/).
- A **runner** starts gspot from hooks: your package manager when the root `package.json` lists `@gspothq/cli`,
  mise starts it otherwise. See [How hooks start gspot](/guides/install/#how-hooks-start-gspot).
- The **ESLint plugin** supplies the ESLint lint rules of gspot. See [ESLint plugin](/reference/eslint-plugin/).
- A **stage** specifies when a check runs: `commit`, `push`, `message`, or `manual`. The `message` stage checks commit messages.
  See [Git hooks](/guides/hooks/).
- A **scope** supplies the configurations and settings for one folder, such as one app in a monorepo.
  See [Monorepos](/guides/monorepos/).
- A **managed block** contains the text between two gspot marker comments. gspot writes it and preserves the rest of the file.
- A **template** copies your `gspot.toml` for use in another repository. See [Reuse templates](/guides/templates/).

Continue with [Install](/guides/install/), [JavaScript and TypeScript](/guides/quickstart/javascript-typescript/), [Python](/guides/quickstart/python/), or [Swift](/guides/quickstart/swift/).
