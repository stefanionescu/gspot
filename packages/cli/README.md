# ![gspot](../../docs/public/banner.svg)

gspot is a command-line tool that lints AI-generated code and installs rules for AI coding agents.

## What it does

- `gspot init` finds the languages and frameworks in your repository, and turns on the linters, formatters, and type
  checkers for them.
- gspot pins every tool that it installs to one version, so every machine and CI run the same version.
- Git hooks check the staged files before each commit, and the pushed files before each push. If gspot finds problems,
  the commit or push stops, and gspot lists each problem. A CI job checks each pull request and each push to the
  default branch.
- gspot writes `AGENTS.md` and rule files for your languages, frameworks, and level. The rule files tell coding agents
  how to write code that passes the checks.

The [Checks](https://generativespotting.com/reference/checks/) reference lists every check and the problems that it
finds.

## Requirements

You need Git and Node.js. gspot runs on macOS, Linux, and Windows. Some checks need the Swift toolchain or a running
Docker daemon.

The setup steps here use Bun. [Install](https://generativespotting.com/start/install/) gives the commands for npm,
pnpm, Yarn, and a repository without a `package.json`. It also lists the versions that gspot needs, and what each kind
of check needs.

## Set up

`gspot init` deletes the tool config files that gspot replaces, such as `.eslintrc.json`. Commit your work first, so
that Git keeps a copy.

Run these commands in the root folder of your repository. They need a `package.json` there:

```shell
bun add --dev --exact @gspothq/cli
bunx --no-install gspot init
bunx --no-install gspot check
```

1. `bun add` adds gspot as a development dependency, pinned to one version.
2. `gspot init` prints what it will change, then writes `gspot.toml`, the tool config files, the rules for coding
   agents, and the Git hooks. Then it installs the tools and turns on the Git hooks.
3. `gspot check` runs the checks on every file. From then on, the Git hooks check each commit and each push.

With mise installed, init also installs the tools that do not come from npm or PyPI. Without mise, init names each tool
that you must install yourself. CI stays off until you turn it on. `gspot doctor` prints the commands that turn it on
for GitHub or GitLab.

A finding is one problem that a check reports. To accept the findings that exist today, run `gspot baseline` after
`gspot init`, and commit the `gspot.baseline.json` file that it writes. `gspot check` then fails only on new findings
and on secrets.

gspot starts at level `basic`, which turns on only the rules that rarely flag correct code. For stricter rules, add
`--level all` to the init command. `gspot init` writes its files without asking, so run `gspot scan` first to see what
init will change.

Commit `gspot.toml` and the files that `gspot init` wrote. In each new clone, install the dependencies first, then run
`gspot install`.

To let a coding agent do the setup, give it the prompt from the
[Quickstart](https://generativespotting.com/start/quickstart/).

## Try it

Run this command in the root folder of any Git repository:

```shell
npx @gspothq/cli scan
```

The scan works on a copy of your files, so nothing in your repository changes. It reports the findings, the files that
do not match your formatting style, how long each tool took, and the plan of `gspot init`: the changes that init makes.

## Documentation

- [Run checks](https://generativespotting.com/use/run-checks/): read a finding, explain it, and fix it.
- [Change settings](https://generativespotting.com/configure/gspot-toml/): what you can change in `gspot.toml`, and the
  command or setting that changes it.
- [Checks](https://generativespotting.com/reference/checks/): what each check finds, and how to fix its findings.
- [Commands](https://generativespotting.com/reference/commands/): every command, its options, and its exit codes.
- [ESLint plugin](https://generativespotting.com/reference/eslint-plugin/): the ESLint rules that gspot ships, which
  also work in ESLint without gspot.
- [Tests](https://github.com/stefanionescu/gspot/blob/main/tests/README.md): how to run the test suites of gspot, or one
  test file.
- [Issues](https://github.com/stefanionescu/gspot/issues): report a problem.

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md)
