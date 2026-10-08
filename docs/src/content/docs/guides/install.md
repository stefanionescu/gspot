---
title: Install gspot
description: Choose an installation method for your repository and prepare its checks.
---

Read the [requirements](/guides/requirements/) first. Choose one installation method:

| Repository                                         | Install method                                               | Prefix for later commands                                     |
| -------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| Has `package.json`                                 | Exact development dependency in its declared package manager | `npx gspot`, `pnpm exec gspot`, `yarn gspot`, or `bunx gspot` |
| Python, Swift, or another repository using mise    | Install the npm CLI through mise                             | `mise exec -- gspot`                                          |
| Uses neither a JavaScript package manager nor mise | Exact global npm installation                                | `gspot` on `PATH`                                             |

Commands in the guides start with `gspot`. Add the prefix from this table for your installation.

Replace `<version>` with the exact version from the [npm package page](https://www.npmjs.com/package/@gspothq/cli).

## Repository with package.json

For npm:

```shell
npm install --save-dev --save-exact @gspothq/cli
git add package.json package-lock.json
git commit -m "build: Add gspot"
npx gspot init
```

Commit the dependency and lockfile first. `init` requires a clean working tree so Git history keeps the files it replaces.

Use the matching install and run commands for another package manager:

| Manager               | Install                                         | Initialize             |
| --------------------- | ----------------------------------------------- | ---------------------- |
| pnpm                  | `pnpm add --save-dev --save-exact @gspothq/cli` | `pnpm exec gspot init` |
| Yarn Classic or Berry | `yarn add --dev --exact @gspothq/cli`           | `yarn gspot init`      |
| Bun                   | `bun add --dev --exact @gspothq/cli`            | `bunx gspot init`      |

Commit that manager's manifest and lockfile before initialization.

## Repository using mise

In a clean Git repository, run:

```shell
mise exec npm:'@gspothq/cli@<version>' -- gspot init
```

Choose mise at the runner question. The generated mise file pins the CLI through the npm backend (`npm:@gspothq/cli`) and pins required executable tools. Trust the file before installing its tools:

```shell
mise trust .mise/conf.d/gspot-tools.toml
mise install
mise exec -- gspot install
mise exec -- gspot doctor
```

## Global npm installation

Install the exact version you intend to use:

```shell
npm install --global '@gspothq/cli@<version>'
gspot init
```

A global install supplies one version per machine. Repositories pin their own version in `.gspot/version`. Use mise or local dependencies when repositories need different versions.

## Accept and verify the setup

Read the plan, including files to replace, configuration choices, tool requirements, hooks, and CI. After acceptance, initialization resolves required lockfiles before writing the configuration. It then installs the applicable tools. With `--no-install`, it writes the setup without resolving lockfiles. Run `gspot install` later.

`gspot install` prepares new lockfiles and tool environments before replacing the installed tool files. If it fails, repair the reported error and run `gspot install` again. Use `--refresh-lockfiles` when you intend to resolve declared tool pins again.

Then run:

```shell
gspot doctor
gspot check
```

Resolve the findings, review the generated files, and commit the setup. Initialization itself runs no check. After cloning an existing setup, follow [Join a repository](/guides/join/).
