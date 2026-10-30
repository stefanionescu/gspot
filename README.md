# <picture><source media="(prefers-color-scheme: light)" srcset="docs/public/banner/light.svg"><img src="docs/public/banner/dark.svg" alt="gspot"></picture>

gspot is a command-line tool that lints AI-generated code and installs rules for AI coding agents.

## What it does

- **Picks the checks.** `gspot init` reads your files and turns on the checks for the languages and frameworks it
  finds.
- **Pins the tools.** Every tool that gspot installs runs at one version on every machine and in CI, so a check that
  passes for you passes for everyone.
- **Stops bad commits.** Git hooks check the staged files, and a CI job checks each pull request and each push to the
  default branch.
- **Writes rules for your agent.** `AGENTS.md` lists rule files for your languages, frameworks, and level. They say
  how to write code that passes the checks.

## What it flags

- Bugs and type errors
- Security and accessibility problems, and leaked secrets
- Vulnerable dependencies and licenses that you do not allow
- Formatting, broken links, and spelling
- Lint rules turned off without a reason
- At level `all`: the stricter checks that [Levels](https://generativespotting.com/start/concepts/#levels) lists

## Requirements

You need Git and Node.js 24.15 or newer. The commands below use Bun 1.4.2 or newer. gspot runs on macOS, Linux,
and Windows. Some checks need more, such as the Swift toolchain or a running Docker daemon;
[Installation](https://generativespotting.com/start/install/) lists what each kind of check needs.

## Set up

`gspot init` deletes the config files that gspot replaces, such as `.eslintrc.json`. Commit your work first, so Git
keeps a copy of each file that init deletes.

Run these commands in the root folder of a repository that has a `package.json`:

```shell
bun add --dev --exact @gspothq/cli
bun run --no-install gspot init
bun run --no-install gspot install
bun run --no-install gspot check
```

1. `bun add --dev --exact @gspothq/cli` adds gspot as a development dependency, pinned to one version.
2. `gspot init` shows a plan. When you accept it, gspot writes `gspot.toml`, the config files, the rules for coding
   agents, and the Git hooks, and deletes the config files it replaces. CI stays off until you enable it;
   `gspot doctor` suggests the commands for your provider.
3. `gspot install` installs the pinned tools and turns on the Git hooks. With mise, it also installs the programs that
   do not come from npm or PyPI. Without mise, it names each program that you must install yourself.
4. `gspot check` runs the checks on every file. From then on, the Git hooks check each commit and push.

gspot starts at level `basic`. To start at level `all`, add `--level all` to the init command. To print the plan
and write nothing, add `--dry-run`.

Commit `gspot.toml` and the files that `gspot init` and `gspot install` wrote. In each new clone, install the
dependencies first, then run the install command above.

[Installation](https://generativespotting.com/start/install/) gives the commands for npm, pnpm, Yarn, and a repository
without a `package.json`. The [Quickstart](https://generativespotting.com/start/quickstart/) gives a prompt that lets
your coding agent do the setup.

## Documentation

- [Run checks](https://generativespotting.com/use/run-checks/): read a finding, explain it, and fix it.
- [gspot.toml](https://generativespotting.com/configure/gspot-toml/): each thing you can change, and the command or
  setting that changes it.
- [Checks](https://generativespotting.com/reference/checks/): what each check finds, and how to fix its findings.
- [Commands](https://generativespotting.com/reference/commands/): every command, its options, and its exit codes.
- [ESLint plugin](https://generativespotting.com/reference/eslint-plugin/): the lint rules of gspot, for ESLint with or
  without gspot.
- [Issues](https://github.com/stefanionescu/gspot/issues): report a problem.

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md)
