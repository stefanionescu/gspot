# ![gspot](docs/public/banner.svg)

gspot is a command-line tool that lints AI-generated code and installs rules for AI coding agents.

## What it does

- **Picks the checks.** `gspot init` reads your files and turns on the checks for the languages and frameworks it
  finds.
- **Pins the tools.** Every tool that gspot installs runs at one version on every machine and in CI.
- **Stops bad commits.** Git hooks check the staged files. A CI job checks each pull request and each push to the
  default branch.
- **Writes rules for your agent.** `AGENTS.md` lists rule files for your languages, frameworks, and level. They say
  how to write code that passes the checks.

[What it flags](https://generativespotting.com/start/overview/#what-it-flags) lists the problems that gspot finds.

## Requirements

You need Git and Node.js. gspot runs on macOS, Linux, and Windows. Some checks need the Swift toolchain or a running
Docker daemon.

The commands below use Bun. [Installation](https://generativespotting.com/start/install/) gives the commands for npm,
pnpm, Yarn, and a repository without a `package.json`. It also lists the versions and what each kind of check needs.

## Set up

`gspot init` deletes the config files that gspot replaces, such as `.eslintrc.json`. Commit your work first, so Git
keeps a copy.

Run these commands in the root folder of a repository that has a `package.json`:

```shell
bun add --dev --exact @gspothq/cli
bunx --no-install gspot init
bunx --no-install gspot check
```

1. `bun add` adds gspot as a development dependency, pinned to one version.
2. `gspot init` prints its plan and writes `gspot.toml`, the config files, the rules for coding agents, and the Git
   hooks. Then it installs the pinned tools and turns on the Git hooks.
3. `gspot check` runs the checks on every file. From then on, the Git hooks check each commit and push.

With mise, init also installs the programs that do not come from npm or PyPI. Without mise, it names each program that
you must install yourself. CI stays off until you enable it. `gspot doctor` suggests the commands for your provider.

To accept the findings that exist today, run `gspot baseline` after `gspot init`, and commit the
`gspot.baseline.json` file it writes. `gspot check` then fails only on new findings and on secrets.

gspot starts at level `basic`. To start at level `all`, add `--level all` to the init command. Init writes without
asking, so run `gspot scan` first to read its plan.

Commit `gspot.toml` and the files that `gspot init` wrote. In each new clone, install the dependencies first, then run
`gspot install`.

The [Quickstart](https://generativespotting.com/start/quickstart/) gives a prompt that lets your coding agent do the
setup.

## Try it

Run this at the root of a Git repository:

```shell
npx @gspothq/cli scan
```

The scan works on a copy, so your repository does not change. It reports the findings, the files that differ from your
style, how long each tool took on this scan, and the plan of `gspot init`.

## Documentation

- [Run checks](https://generativespotting.com/use/run-checks/): read a finding, explain it, and fix it.
- [gspot.toml](https://generativespotting.com/configure/gspot-toml/): each thing you can change, and the command or
  setting that changes it.
- [Checks](https://generativespotting.com/reference/checks/): what each check finds, and how to fix its findings.
- [Commands](https://generativespotting.com/reference/commands/): every command, its options, and its exit codes.
- [ESLint plugin](https://generativespotting.com/reference/eslint-plugin/): the lint rules of gspot, for ESLint with or
  without gspot.
- [Tests](https://github.com/stefanionescu/gspot/blob/main/tests/README.md): run the test suites, or one test file.
- [Issues](https://github.com/stefanionescu/gspot/issues): report a problem.

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md)
