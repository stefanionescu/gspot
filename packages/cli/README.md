# gspot

gspot sets up linters, formatters, and security scanners for your repository and runs them before every commit.

## What it does

- **Picks the checks.** `gspot init` reads your files and turns on the checks for the languages and frameworks it
  finds.
- **Pins the tools.** Each check runs a known tool, such as ESLint, Ruff, or ShellCheck, at one version everywhere.
- **Stops bad commits.** Git hooks check the staged files, and a CI job checks every push.
- **Writes rules for your agent.** `AGENTS.md` and one rule file for each language say how to write code that
  passes.

## What it flags

- Bugs and type errors
- Security problems and leaked secrets
- Vulnerable dependencies and licenses that you do not allow
- Formatting, broken links, and spelling
- Lint rules turned off without a reason
- With `gspot set level all`: naming, structure, doc comments, duplication, and complexity

## Install

You need Git and Node.js 24.15 or newer. With mise, gspot also installs program tools such as Gitleaks and
ShellCheck.

| Package manager                | Install                                                                          | Run                  |
| ------------------------------ | -------------------------------------------------------------------------------- | -------------------- |
| npm                            | `npm install --save-dev --save-exact @gspothq/cli`                               | `npx gspot`          |
| pnpm                           | `pnpm add --save-dev --save-exact @gspothq/cli`                                  | `pnpm exec gspot`    |
| Yarn                           | `yarn add --dev --exact @gspothq/cli`                                            | `yarn exec gspot`    |
| Bun                            | `bun add --dev --exact @gspothq/cli`                                             | `bunx gspot`         |
| mise, without a `package.json` | `mise use --pin node@24 --tool-option allow_low_downloads=true npm:@gspothq/cli` | `mise exec -- gspot` |

## Set up

```shell
npx gspot init      # pick the checks, then write gspot.toml, the tool files, and the agent rules
npx gspot install   # install the tools and turn on the Git hooks
npx gspot check     # check every file now
```

Commit the files that `gspot init` writes. Git does not keep the installed tools or the hooks, so run
`npx gspot install` again in each new clone.

## Documentation

- [Quickstart](https://generativespotting.com/start/quickstart/)
- [Read and fix findings](https://generativespotting.com/use/findings/)
- [Settings in gspot.toml](https://generativespotting.com/configure/gspot-toml/)
- [Every check](https://generativespotting.com/reference/checks/) and
  [every command](https://generativespotting.com/reference/commands/)
- [Source code and issues](https://github.com/stefanionescu/gspot)

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md)
