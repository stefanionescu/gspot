# gspot

gspot sets up linters, formatters, and security scanners for your repository and runs them before every commit.

## What it does

- **Picks the checks.** `gspot init` reads your files and turns on the checks for the languages and frameworks it
  finds.
- **Pins the tools.** Every tool runs at one version on every machine and in CI, so a check that passes for you passes
  for everyone.
- **Stops bad commits.** Git hooks check the staged files, and a CI job checks every push.
- **Writes rules for your agent.** `AGENTS.md` and one rule file for each language and topic say how to write code
  that passes.

## What it flags

- Bugs and type errors
- Security and accessibility problems, and leaked secrets
- Vulnerable dependencies and licenses that you do not allow
- Formatting, broken links, and spelling
- Lint rules turned off without a reason
- With `gspot set level all`: naming, wording, structure, doc comments, duplication, and complexity

## Install

You need Git and Node.js 24.15 or newer. With mise, gspot also installs the tools that do not come
from npm or PyPI.

| Package manager                | Install                                                                          | Run                  |
| ------------------------------ | -------------------------------------------------------------------------------- | -------------------- |
| npm                            | `npm i -D -E @gspothq/cli`                                                       | `npx gspot`          |
| pnpm                           | `pnpm add -D -E @gspothq/cli`                                                    | `pnpm exec gspot`    |
| Yarn                           | `yarn add -D -E @gspothq/cli`                                                    | `yarn exec gspot`    |
| Bun                            | `bun add -d -E @gspothq/cli`                                                     | `bunx gspot`         |
| mise, without a `package.json` | `mise use --pin node@24 --tool-option allow_low_downloads=true npm:@gspothq/cli` | `mise exec -- gspot` |

## Set up

```shell
npx gspot init      # pick the checks, then write gspot.toml, the tool files, the agent rules, the Git hooks, and the CI workflow
npx gspot install   # install the tools and turn on the Git hooks
npx gspot check     # check every file now
```

Commit the files that `gspot init` writes. Git does not keep the installed tools or the hooks, so run
`npx gspot install` again in each new clone.

## Documentation

- [Quickstart](https://generativespotting.com/start/quickstart/)
- [Read and fix findings](https://generativespotting.com/use/run-checks/)
- [Settings in gspot.toml](https://generativespotting.com/configure/gspot-toml/)
- [Every check](https://generativespotting.com/reference/checks/) and
  [every command](https://generativespotting.com/reference/commands/)
- [Source code and issues](https://github.com/stefanionescu/gspot)

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md)
