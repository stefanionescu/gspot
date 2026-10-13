---
title: Install gspot
description: Choose an installation method for your repository and prepare its checks.
---

## What you need

Use Git and Node.js 24.2 or newer. Bun can install and start gspot, but the checks run on Node.js.
Use your package manager for a repository with `package.json`, or mise for another repository.

Program tools such as Gitleaks, typos, and ShellCheck need mise on both paths.
Without mise, `gspot install` installs npm tools and Python tools when `PATH` includes uv.
It names each missing program, including uv, and exits 0. A check with a missing program exits 2;
`gspot doctor` lists the missing tools.

Run `gspot init --dry-run` to see which tools your repository needs. gspot installs only what its checks and fixers need. File types count too: Markdown files in a Python repository still need Node.js for the Markdown checks.

| Tools                                                                        | What you need                                                                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| npm tools, such as ESLint or markdownlint                                    | Node.js and the project's npm, pnpm, Yarn, or Bun package manager. With no declaration, gspot uses npm. |
| Python tools, such as Ruff or yamllint                                       | uv; gspot pins Python 3.13.16 and lets uv download it when needed.                                      |
| Program tools: command-line programs such as ShellCheck, Gitleaks, and typos | mise, or the exact pinned tools on `PATH`. `gspot doctor` lists missing tools.                          |
| Project commands, such as Jest, Vitest, Next.js, or Swift builds             | Your project's runtime, dependencies, and build tools.                                                  |

### Operating system limits

Swift needs its toolchain. SwiftFormat supports macOS and Linux. Xcode checks and XCTest coverage need macOS with Xcode selected by `xcode-select`. Container checks can need a running Docker daemon. Some scans and generators need network access. Each [check page](/reference/checks/) lists its operating systems and other requirements.

The Bash checks need Bash 4.4 or newer. macOS comes with Bash 3.2, so install a newer Bash.

## Choose how to install

| Repository                         | Install gspot as                                  | Start later commands with                                          |
| ---------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| Has `package.json`                 | a dev dependency, pinned to one version           | `npx gspot`, `pnpm exec gspot`, `yarn exec gspot`, or `bunx gspot` |
| Any other, such as Python or Swift | an npm package that mise pins in your `mise.toml` | `mise exec -- gspot`                                               |

The guides write commands as `gspot ...`. Add the start from this table.

## Repository with package.json

```shell
npm install --save-dev --save-exact @gspothq/cli
npx gspot init
npx gspot install
```

| Package manager | Add gspot                                       | Then run                                          |
| --------------- | ----------------------------------------------- | ------------------------------------------------- |
| pnpm            | `pnpm add --save-dev --save-exact @gspothq/cli` | `pnpm exec gspot init`, `pnpm exec gspot install` |
| Yarn            | `yarn add --dev --exact @gspothq/cli`           | `yarn exec gspot init`, `yarn exec gspot install` |
| Bun             | `bun add --dev --exact @gspothq/cli`            | `bunx gspot init`, `bunx gspot install`           |

## Repository without package.json

```shell
mise use node@24 'npm:@gspothq/cli@<version>'
mise exec -- gspot init
mise exec -- gspot install
```

Replace `<version>` with the version you install, such as `0.1.2`. `mise use` pins Node.js and gspot in your
`mise.toml`, the same way a dev dependency pins gspot in `package.json`.

## Read the plan

Run `gspot init --dry-run` to read the plan before accepting it. The plan names existing tool files it replaces, such as `.eslintrc.json`, `.prettierrc`, `ruff.toml`, `.stylelintrc.json`, `typos.toml`, and `.shellcheckrc`. `init` deletes those files and writes its own tool files; it does not read settings out of them. Move settings you still need into `gspot.toml` with `gspot set` and `gspot ignore`. A tool without a tool file can run as a [command check](/guides/command-checks/).

### What init leaves alone

gspot leaves your application settings and your text outside managed blocks alone. Tool sections in shared files, such as `[tool.ruff]` in `pyproject.toml` or `prettier` in `package.json`, stay in place. The plan names each section; the generated tool files take over. Delete the section when you have moved its settings.

If Husky, Lefthook, or your own hooks folder already runs your Git hooks, gspot leaves them alone and prints three gspot hook lines for you to add. See [Git hooks](/guides/hooks/). Until you add them, gspot checks do not run on commit or push.

The list under `no longer runs` in the plan names folders of lint scripts and dependency files that list only lint tools. Check that nothing else uses them, then delete them.

## Set up the tools

`init` shows a plan: the files it replaces, the configurations, the tools, the Git hooks, and CI. It prints
"Continue?" and writes the files when you accept; `--yes` accepts without asking. It installs nothing and runs no
check, and it ends with `run gspot install`. `gspot install` installs the tools and installs Git hooks when `hooks.enabled = true`.

`init` proposes Git hooks and detects your CI provider; its plan shows the choices it writes. When you use a template, its hook and CI settings supply those choices. If `gspot install` fails, see [Troubleshooting](/guides/troubleshooting/).

## Check your files

Run the check command for your installation:

```shell
npx gspot check
```

For a mise installation, run `mise exec -- gspot check`.
The check reads your current files, including uncommitted changes and untracked files that `.gitignore` does not hide.
You do not need to commit first. See [Fix findings](/guides/findings/) for corrections and file selection.

## How hooks start gspot

When the root `package.json` lists `@gspothq/cli`, the Git hooks start gspot through your package manager:

```text title="Hook start commands by package manager"
npm: npm exec --no -- gspot
pnpm: pnpm exec gspot
Yarn: yarn exec gspot
Bun: bun run --no-install gspot
```

Otherwise, they run `mise exec -- gspot`.

## Private registries

The npm, pnpm, Yarn, and Bun installs of gspot use the registry settings of your repository and your environment. uv
reads Python package indexes from `uv.toml` or `[tool.uv]` in `pyproject.toml`.

Keep credentials in environment variables or your user settings, never in `gspot.toml` or a lockfile. Each
teammate gives their own credentials when they run `gspot install`.

Cloned a repository that already uses gspot? See [Join a repository](/guides/join/).
