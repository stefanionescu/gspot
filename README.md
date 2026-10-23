# ![gspot](docs/banner/light.svg#gh-light-mode-only)![gspot](docs/banner/dark.svg#gh-dark-mode-only)

gspot is a command-line tool that lints AI-generated code and installs rules for AI coding agents.

## What it does

- **Picks the checks.** `gspot init` reads your files and turns on the checks for the languages and frameworks it
  finds.
- **Pins the tools.** Every tool runs at one version on every machine and in CI, so a check that passes for you passes
  for everyone.
- **Stops bad commits.** Git hooks check the staged files, and a CI job checks every push.
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

You need Git and Node.js 24.15 or newer. gspot runs on macOS, Linux, and Windows. Some checks need more, such as the
Swift toolchain or a running Docker daemon; [Installation](https://generativespotting.com/start/install/) lists what
each kind of check needs.

## Set up

`gspot init` deletes the config files that gspot replaces, such as `.eslintrc.json`. Commit your work first, so Git
keeps a copy of each file that init deletes.

Run these commands in the root folder of a repository that has a `package.json`:

```shell
npm install --save-dev --save-exact @gspothq/cli
npm exec --no -- gspot init
npm exec --no -- gspot install
npm exec --no -- gspot check
```

1. `npm install --save-dev --save-exact @gspothq/cli` adds gspot as a development dependency, pinned to one version.
2. `gspot init` shows a plan. When you accept it, gspot writes `gspot.toml`, the config files, the rules for coding
   agents, the Git hooks, and the CI workflow, and deletes the config files it replaces.
3. `gspot install` installs the pinned tools and turns on the Git hooks. With mise, it also installs the programs that
   do not come from npm or PyPI. Without mise, it names each program that you must install yourself.
4. `gspot check` runs the checks on every file. From then on, the Git hooks check each commit and push.

gspot starts at level `recommended`. To start at level `all`, run `npm exec --no -- gspot init --level all`. To print
the plan and write nothing, run `npm exec --no -- gspot init --dry-run`.

Commit `gspot.toml` and the files that `gspot init` and `gspot install` wrote. In each new clone, install the
dependencies first, then run `npm exec --no -- gspot install`.

[Installation](https://generativespotting.com/start/install/) gives the commands for pnpm, Yarn, Bun, and a repository
without a `package.json`. The [Quickstart](https://generativespotting.com/start/quickstart/) gives a prompt that lets
your coding agent do the setup.

## Documentation

- [Run checks](https://generativespotting.com/use/run-checks/): read a finding, explain it, and fix it.
- [gspot.toml](https://generativespotting.com/configure/gspot-toml/): choose configurations and a level, and change
  settings.
- [Customize gspot](https://generativespotting.com/configure/customize/): each thing you can change, and the one
  command or setting that changes it.
- [Checks](https://generativespotting.com/reference/checks/): what each check finds, and how to fix its findings.
- [Commands](https://generativespotting.com/reference/commands/): every command, its options, and its exit codes.
- [ESLint plugin](https://generativespotting.com/reference/eslint-plugin/): the lint rules of gspot, for ESLint with or
  without gspot.
- [Issues](https://github.com/stefanionescu/gspot/issues): report a problem.

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md)
