# ![gspot](docs/assets/readme/banner/light.svg#gh-light-mode-only)![gspot](docs/assets/readme/banner/dark.svg#gh-dark-mode-only)

[![npm package](docs/assets/readme/badges/npm.svg)](https://www.npmjs.com/package/@gspothq/cli)
[![License: Apache-2.0](docs/assets/readme/badges/license.svg)](LICENSE.md)

`gspot init` installs rules and linters for the languages and frameworks in your repo. Then gspot runs the
linters before every commit.

**Documentation:** [generativespotting.com](https://generativespotting.com/)

## What it catches

An agent adds a checkout module to a TypeScript project. It forgets `await`, turns off the linter for one line,
and leaves the `catch` empty:

```ts title="src/checkout.ts"
import type { Cart } from './cart.js';
import { charge } from './payments.js';

export async function pay(cart: Cart) {
    try {
        // eslint-disable-next-line
        charge(cart.total);
    } catch {}
}
```

The pre-commit hook stops the commit. This report omits help, commands to run checks again, and run time:

```text
Checked the staged files.
javascript/eslint  failed  4 findings
  src/checkout.ts:4:8  @typescript-eslint/require-await  Async function 'pay' has no 'await' expression.
  src/checkout.ts:5:5  sonarjs/no-try-promise  Consider using 'await' for the promise inside this 'try' or replace it with 'Promise.prototype.catch(...)' usage.
  src/checkout.ts:6  unicorn/no-abusive-eslint-disable  Specify the rules you want to disable.
  src/checkout.ts:8:13  no-empty  Empty block statement.

gspot/suppressions  failed  1 finding
  src/checkout.ts:6  eslint-limit  Split the code by its steps, or ask the user to raise the limit in gspot.toml.

Failed: 2 checks with 5 findings. Passed: 11 checks. Skipped: 8 checks.
Bypass this hook once: git commit --no-verify
```

The findings name the three problems:

1. **No await.** The function returns before the charge ends. Rules: `@typescript-eslint/require-await` and `sonarjs/no-try-promise`.
2. **Linter off.** The comment turns off every rule for line 7 and gives no reason. Rules: `unicorn/no-abusive-eslint-disable` and `eslint-limit`.
3. **Errors dropped.** The empty `catch` throws away every error it catches. Rule: `no-empty`.

gspot installed ESLint and its plugins and wrote their configuration. gspot itself runs `gspot/suppressions`:
it rejects this blanket directive.

The fix waits for the charge and lets a failed payment reach the caller:

```ts title="src/checkout.ts"
import type { Cart } from './cart.js';
import { charge } from './payments.js';

export async function pay(cart: Cart) {
    await charge(cart.total);
}
```

The next commit passes: `Passed: 13 checks. Skipped: 8 checks.`

## What it checks

`gspot init` reads your files and turns on the checks they need. Each check runs a tool you know, pinned to one
version on every machine and in CI.

- **Linters and formatters:** lint, format, and type checks for TypeScript, JavaScript, Python, Swift, CSS, HTML,
  Bash, SQL, and Markdown. Rules cover React, Next.js, Vue, Svelte, Astro, FastAPI, and other frameworks.
- **Secrets and dependencies:** leaked keys, vulnerable dependencies, licenses, broken links, spelling, and
  security patterns.
- **Agent rules:** `AGENTS.md` and one rule file per language and topic, so your agent writes code that passes the
  checks.

The tools include ESLint, Prettier, Ruff, Stylelint, ShellCheck, Semgrep, TypeScript, Vitest, Jest, pytest, Knip,
Trivy, Gitleaks, typos, Vale, SwiftLint, and Hadolint.

The [check reference](https://generativespotting.com/reference/checks/) lists every check.

## Install

You need Git and Node.js 24.15 or newer. Program tools such as Gitleaks, typos, and ShellCheck install with mise;
without mise, `gspot install` names the programs that you must install yourself.

In a repository with `package.json`, add gspot as a development dependency:

| Package manager | Install                                            | Run               |
| --------------- | -------------------------------------------------- | ----------------- |
| npm             | `npm install --save-dev --save-exact @gspothq/cli` | `npx gspot`       |
| pnpm            | `pnpm add --save-dev --save-exact @gspothq/cli`    | `pnpm exec gspot` |
| Yarn            | `yarn add --dev --exact @gspothq/cli`              | `yarn exec gspot` |
| Bun             | `bun add --dev --exact @gspothq/cli`               | `bunx gspot`      |

In a Python, Swift, or other repository without `package.json`, pin gspot with mise:

```shell
mise use --pin node@24 --tool-option allow_low_downloads=true npm:@gspothq/cli
```

`--pin` writes the exact Node.js and gspot versions to `mise.toml`. mise refuses a new npm package, or one with
few downloads, until you approve it; `allow_low_downloads=true` approves gspot. Run gspot with `mise exec -- gspot`.

## Set up

These commands use npm. Use the run command of your package manager from the table above.

```shell
npx gspot init
npx gspot install
```

1. `gspot init` shows a plan and writes it when you accept: `gspot.toml`, the tool files, `AGENTS.md` and the
   agent rules, and the Git hooks. On GitHub or GitLab it also writes a CI workflow when the repository has no
   lint job. It installs nothing.
2. `gspot install` installs the pinned tools and turns on the Git hooks. From then on, every commit runs the
   checks.

Run `npx gspot check` to check every file now, including work that you did not commit.

The default level, `recommended`, checks bugs, security, types, accessibility, and formatting. Level `all` also
checks naming, structure, doc comments, wording, duplication, and complexity, and installs a few more tools. To use
it, run `gspot set level all`, then `gspot install`; see [Levels](https://generativespotting.com/start/concepts/#levels).

## Learn more

- [Quickstart](https://generativespotting.com/start/quickstart/): set up gspot yourself or with your coding agent.
- [Install](https://generativespotting.com/start/install/): every package manager, mise, and private registries.
- [Read and fix findings](https://generativespotting.com/use/findings/).
- [gspot.toml](https://generativespotting.com/configure/gspot-toml/): configurations, the level, and settings.
- [Coding agents](https://generativespotting.com/use/agent-rules/): the agent rules that gspot writes.
- [Command reference](https://generativespotting.com/reference/commands/) and
  [configuration reference](https://generativespotting.com/reference/configurations/).
- [ESLint plugin](packages/eslint-plugin/README.md): the gspot lint rules for ESLint on their own.

## License

[Apache-2.0](LICENSE.md)
