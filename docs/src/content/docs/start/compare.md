---
title: Compare with other tools
description: How gspot differs from pre-commit, Husky with lint-staged, Lefthook, MegaLinter, and Trunk.
---

gspot, pre-commit, Husky with lint-staged, Lefthook, MegaLinter, and Trunk Code Quality all run linters on your code.
They differ in who picks the linters, how the versions stay fixed, which Git hooks they install, what runs in CI, and
what they cost. Each claim about another tool links the page it comes from, and the sections below the table give the
source of each cell. The pages of the other tools date from November 4, 2026, when this page read them, and a tool can
change after that date.

## Summary

| Tool                   | Picks the linters                  | Pins versions                              | Git hooks                                     | CI                                                   | Cost                                                                      |
| ---------------------- | ---------------------------------- | ------------------------------------------ | --------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| gspot                  | Yes, from the files of each scope  | The tools it installs, in `.gspot/`        | `pre-commit`, `pre-push`, `commit-msg`        | Writes a GitHub Actions or GitLab CI job             | Free, Apache-2.0 license                                                  |
| pre-commit             | No, you list hook repositories     | Each hook repository, by its `rev`         | `pre-commit`, others by `--hook-type`         | `pre-commit run --all-files`, or pre-commit.ci       | Free, MIT license; pre-commit.ci is free for open source                  |
| Husky with lint-staged | No, you write the commands         | The tools that you install in your project | Any of the 13 client-side hooks               | Husky advises `HUSKY=0` on CI servers                | Free, MIT license                                                         |
| Lefthook               | No, you write the commands         | Not described on the pages read            | The hooks that `lefthook.yml` names           | Not described on the pages read                      | Free, MIT license                                                         |
| MegaLinter             | Enables every linter of its image  | The image tag, such as `v10`               | Through pre-commit, with `mega-linter-runner` | GitHub Actions, GitLab CI, Azure Pipelines, and more | Free, AGPL v3 license                                                     |
| Trunk Code Quality     | Recommends linters from your files | Each linter, in `.trunk/trunk.yaml`        | Formats on commit, checks on push             | GitHub integration, or any CI                        | Free for public repositories and up to 5 committers; a paid license above |

## Which linters run

gspot picks the linters. `gspot init` reads the files and dependencies of each scope, and selects the configurations
that fit; see [Choose configurations](/configure/gspot-toml/#choose-configurations). Each configuration names the
tools it runs and the settings it writes for them.

pre-commit runs the hook repositories that you list in `.pre-commit-config.yaml`. Source:
[pre-commit](https://pre-commit.com/), read on November 4, 2026.

lint-staged runs the commands you configure on the staged files that match a glob pattern. You install the tools
yourself; the README names ESLint and Prettier. Source: [lint-staged](https://github.com/lint-staged/lint-staged), read on
November 4, 2026. Husky runs the shell script that you write in `.husky/` for each hook. Source:
[Husky how-to](https://typicode.github.io/husky/how-to.html), read on November 4, 2026.

Lefthook runs the commands that you write in `lefthook.yml`, and can run them in parallel. Sources:
[Lefthook](https://lefthook.dev/) and [Lefthook repository](https://github.com/evilmartians/lefthook), read on
November 4, 2026.

MegaLinter "has all linters enabled by default," and its `ENABLE` and `DISABLE` variables narrow the list. All of its
linters ship in the MegaLinter Docker image. Sources:
[MegaLinter activation](https://megalinter.io/latest/config-activation/) and
[MegaLinter](https://megalinter.io/latest/), read on November 4, 2026.

Trunk Code Quality gives "linter recommendations based on your project's files" when you set it up. Source:
[Trunk Code Quality](https://docs.trunk.io/code-quality/overview), read on November 4, 2026.

## How versions stay fixed

Each gspot version pins the version of every tool that it installs. `.gspot/mise.toml` pins the programs with checksums, and gspot
writes lockfiles for its npm and Python tools; see [What gspot adds](/start/footprint/).

In pre-commit, each hook repository takes a `rev`, which pre-commit treats as an immutable ref, and
`pre-commit autoupdate` moves it to the latest version. Source: [pre-commit](https://pre-commit.com/), read on
November 4, 2026.

lint-staged and Husky run the tools that your project installs. Lefthook installs through the package manager of
your project, and the pages read describe no pinning of the linters it runs. Source:
[Lefthook](https://lefthook.dev/), read on November 4, 2026.

MegaLinter takes its version from the image tag, such as `v10` for the latest stable release, or `beta`. Source:
[MegaLinter versions](https://megalinter.io/latest/install-version/), read on November 4, 2026.

The sample `.trunk/trunk.yaml` of Trunk lists each enabled linter with a version, such as `bandit@1.7.0`. Trunk
"hermetically installs the static analysis tools you run and their required runtimes." Sources:
[Trunk configuration](https://docs.trunk.io/check/configuration) and
[Trunk Code Quality](https://docs.trunk.io/code-quality/overview), read on November 4, 2026.

## Git hooks

gspot writes the `pre-commit`, `pre-push`, and `commit-msg` hooks, each with the checks of its stage; see
[Git hooks](/use/hooks/).

`pre-commit install` sets up the `pre-commit` hook, and `--hook-type` or `default_install_hook_types` installs others,
such as `pre-push` and `commit-msg`. Source: [pre-commit](https://pre-commit.com/), read on November 4, 2026.

Husky supports "all 13 client-side Git hooks." Source: [Husky](https://typicode.github.io/husky/), read on
November 4, 2026. `lefthook install` installs the hooks that `lefthook.yml` configures into `.git/hooks/`. Source:
[Lefthook](https://lefthook.dev/), read on November 4, 2026.

`mega-linter-runner` runs MegaLinter on your computer, needs Node.js and Docker, and can run as a hook of the
pre-commit framework. Source: [mega-linter-runner](https://megalinter.io/latest/mega-linter-runner/), read on
November 4, 2026.

The built-in actions of Trunk run `trunk fmt` on each commit and `trunk check` on each push. Source:
[Trunk actions](https://docs.trunk.io/code-quality/overview/cli/getting-started/actions), read on November 4, 2026.

## What runs in CI

gspot leaves CI off until you run `gspot set ci.enabled true`. It then writes one workflow file that runs the checks on
the files that a pull request changes; see [Continuous integration](/use/ci/).

For pre-commit, the home page suggests `pre-commit run --all-files` as a CI step. The hosted pre-commit.ci service
runs the hooks on pull requests, fixes them, and updates the hook versions. Sources:
[pre-commit](https://pre-commit.com/) and [pre-commit.ci](https://pre-commit.ci/), read on November 4, 2026.

To keep Husky from installing hooks on CI servers or in Docker, its how-to page advises `HUSKY=0`. Source:
[Husky how-to](https://typicode.github.io/husky/how-to.html), read on November 4, 2026. The Lefthook pages read
describe no CI job.

MegaLinter is "an open-source tool for CI/CD workflows," and runs on GitHub Actions, GitLab CI, Azure Pipelines,
Jenkins, and other CI tools. Source: [MegaLinter](https://megalinter.io/latest/), read on November 4, 2026.

Trunk Code Quality runs in GitHub or any other CI. Its hold-the-line mode runs only on new changes. Source:
[Trunk Code Quality](https://docs.trunk.io/code-quality/overview), read on November 4, 2026.

## What it costs

The gspot npm packages carry the Apache-2.0 license.

pre-commit, Husky, lint-staged, and Lefthook carry the MIT license. Sources:
[pre-commit repository](https://github.com/pre-commit/pre-commit),
[Husky repository](https://github.com/typicode/husky),
[lint-staged repository](https://github.com/lint-staged/lint-staged), and
[Lefthook repository](https://github.com/evilmartians/lefthook), all read on November 4, 2026.

pre-commit.ci "will always be free for open source repositories," and private repositories go through the GitHub
Marketplace. Source:
[pre-commit.ci](https://pre-commit.ci/), read on November 4, 2026.

MegaLinter is "100% open source and free for all uses," under the GNU Affero General Public License (AGPL) v3. Source:
[MegaLinter](https://megalinter.io/latest/), read on November 4, 2026.

The Trunk licensing page calls the command-line tool closed-source. It is free in any public repository, and in a
private one with up to 5 active committers. Private repositories with more committers need a
paid license. Source: [Trunk licensing](https://docs.trunk.io/code-quality/overview/licensing), read on
November 4, 2026.
