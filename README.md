# ![gspot](docs/public/banner.svg)

gspot is a command-line tool that lints AI-generated code and installs rules for AI coding agents.

It finds the languages and frameworks in your repository and turns on linters, formatters, and type checkers for them.
gspot pins each tool that it installs, so every machine runs the same version. Git hooks run these checks before each
commit and each push, and stop on a problem. For coding agents, gspot writes `AGENTS.md` and rule files that say how to
write code that passes the checks.

## Try it

To see what gspot finds and what `gspot init` changes, run this in the root folder of any Git repository:

```shell
npx @gspothq/cli scan
```

The scan works on a copy of your files and skips your tests, your build, and other checks that run your code. It still
loads your Prettier config and runs your installed ESLint, Stylelint, and TypeScript, so run it only on code that you
trust.

## Set up

You need Git, Node.js, and npm, pnpm, or Bun, as well as mise or each tool that it installs, because a missing tool stops
every commit. Node.js 22 comes with an npm that is too old, so run `npm install --global npm@latest`.
[Install](https://generativespotting.com/start/install/) lists the versions, and the commands for npm, pnpm, Yarn, and a
repository without a `package.json`.

`gspot init` deletes the tool config files that gspot replaces, such as `.eslintrc.json`, so commit your work first and
Git keeps a copy. Then run these commands in the root folder of your repository:

```shell
bun add --dev --exact @gspothq/cli
bunx --no-install gspot init
```

`gspot init` prints what it will change, writes `gspot.toml`, the tool configs, the agent rules, and the Git hooks, then
installs the tools and turns on the hooks. gspot starts at level `basic`, which checks for bugs, security problems, code
style, broken docs and config, formatting, and a reason on each suppression. For stricter rules, add `--level all` to the
init command.

Commit the setup files, then fix each file as you touch it. In an existing repository, a commit fails on the old findings
of the files that it touches, the setup commit included. The first push fails until the checks that read the whole
project pass. Some findings are a matter of taste, so `gspot ignore` takes the rule and a reason.
[Clean up the first findings](https://generativespotting.com/start/quickstart/#clean-up-the-first-findings) shows both.

CI stays off until you run `gspot set ci.enabled true`, and each new clone needs its dependencies installed, then
`gspot install`. To let a coding agent do the setup, give it the prompt from the
[Quickstart](https://generativespotting.com/start/quickstart/).

## Documentation

- [Run checks](https://generativespotting.com/use/run-checks/): read a finding, explain it, and fix it.
- [Change settings](https://generativespotting.com/configure/gspot-toml/): what you can change in `gspot.toml`.
- [Checks](https://generativespotting.com/reference/checks/): what each check finds, and how to fix its findings.
- [Commands](https://generativespotting.com/reference/commands/)
- [ESLint plugin](https://generativespotting.com/reference/eslint-plugin/): rules that also work in ESLint without gspot.
- [Tests](https://github.com/stefanionescu/gspot/blob/main/tests/README.md): run the test suites of gspot, or one test
  file.
- [Issues](https://github.com/stefanionescu/gspot/issues)

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md)
