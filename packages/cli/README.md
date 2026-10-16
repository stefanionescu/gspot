# gspot

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

gspot ships 59 configurations. `gspot init` selects the ones that your files and dependencies need; the general
ones, such as secrets, spelling, and naming, apply to every repository.

- Languages: Bash, CSS, HTML, JavaScript, Markdown, Python, SQL, Swift, TypeScript.
- Frameworks: Astro, Expo, Express, FastAPI, NestJS, Next.js, React, React DOM, React Native, static sites,
  Svelte, Vue.
- Libraries: Drizzle, React Hook Form, TanStack Query, Testing Library, translations, tRPC, Zod, Zustand.
- Testing: Jest, pytest, Swift tests, Vitest.
- Infrastructure, platforms, and databases: Ansible, Docker, GitHub Actions, nginx, OpenAPI, Xcode, Cloudflare,
  Supabase, Postgres.

The [configuration reference](https://generativespotting.com/reference/configurations/) lists the checks and
tools of each one.

## Install

You need:

- Git.
- Node.js 24.15 or newer. Bun can install and start gspot; the checks run on Node.js.
- mise, for program tools such as Gitleaks, typos, and ShellCheck. Without mise, `gspot install` installs the
  npm tools, installs the Python tools when it finds uv on `PATH`, and names every program that you must install.
- The runtime of your project for checks that run it, such as Jest, Vitest, pytest, or Swift builds.

Pick the section for your package manager. Each one installs gspot, writes the setup, installs the tools, and
checks the files.

### npm

```shell
npm install --save-dev --save-exact @gspothq/cli
npx gspot init
npx gspot install
npx gspot check
```

### pnpm

```shell
pnpm add --save-dev --save-exact @gspothq/cli
pnpm exec gspot init
pnpm exec gspot install
pnpm exec gspot check
```

### Yarn

```shell
yarn add --dev --exact @gspothq/cli
yarn exec gspot init
yarn exec gspot install
yarn exec gspot check
```

### Bun

```shell
bun add --dev --exact @gspothq/cli
bunx gspot init
bunx gspot install
bunx gspot check
```

### mise, for a repository without package.json

Use this for Python, Swift, and other repositories that have no `package.json`:

```shell
mise use --pin node@24 --tool-option allow_low_downloads=true npm:@gspothq/cli
mise exec -- gspot init
mise exec -- gspot install
mise exec -- gspot check
```

`--pin` writes the exact Node.js and gspot versions to `mise.toml`. mise refuses a new npm package, or one with
few downloads, until you approve it; `allow_low_downloads=true` approves gspot.

### After you clone a repository that uses gspot

Install the dependencies of the project, then install the tools and the hooks. With npm:

```shell
npm ci
npx gspot install
```

With mise, run `mise install`, then `mise exec -- gspot install`. Do not run `gspot init` again: it stops when
`gspot.toml` exists.

### What gspot init writes

`gspot init` prints a plan and writes nothing until you accept it. Pass `--dry-run` to only print the plan, or
`--yes` to accept it without the question.

| File                                                                        | What it holds                                                                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `gspot.toml`                                                                | Your settings: configurations, level, settings, and ignores.                                      |
| `.gspot/version`                                                            | The gspot version this repository pins.                                                           |
| `.gspot/config/`                                                            | The tool files, such as the ESLint and Prettier configuration.                                    |
| `.gspot/rules/`                                                             | The agent rules: one Markdown file for each language and topic that you check.                    |
| `.gspot/package.json`, `.gspot/pyproject.toml`, `.gspot/mise.toml`          | The pinned versions of the tools. `gspot install` writes their lockfiles.                         |
| `.gspot/hooks/`                                                             | The `pre-commit`, `pre-push`, and `commit-msg` hooks.                                             |
| `eslint.config.mjs`, `.markdownlint-cli2.mjs`                               | Small files at the scope root that load the tool files from `.gspot/config/`.                     |
| `prettier.config.mjs`, `.editorconfig`, `.prettierignore`, `.semgrepignore` | Generated in full from `gspot.toml`.                                                              |
| `AGENTS.md`, `.gitignore`, `.gitattributes`                                 | A section between `gspot managed` markers. Your text outside it stays.                            |
| `.github/workflows/gspot.yml` or `.gitlab/ci/gspot.yml`                     | The CI job, when the repository has no lint job yet. On GitLab, include it from `.gitlab-ci.yml`. |

`init` replaces the tool files it takes over, such as `.eslintrc.json` or `.prettierrc`; Git keeps the old
copies. Commit everything it writes. A teammate then needs only `gspot install`.

A short `gspot.toml`:

```toml
level = "all"
configurations = ["javascript", "licenses", "markdown", "typescript"]

[hooks]
enabled = true

[limits]
function_lines = { value = 80, reason = "The parser is one state machine." }
```

A value that makes a check weaker needs a reason beside it. Editors find the schema of `gspot.toml` through
SchemaStore, so they check the file as you type.

The default level, `recommended`, checks bugs, security, types, accessibility, and formatting. Level `all` also
checks naming, structure, doc comments, wording, duplication, and complexity, and installs a few more tools. To use
it, run `gspot set level all`, then `gspot install`; see [Levels](https://generativespotting.com/start/concepts/#levels).

## Use

Run each command from any folder of the repository. The examples use `gspot`; put your run command, such as
`npx gspot`, in front.

### Check your work

```shell
gspot check                       # every file, including work you did not commit
gspot check --staged              # the staged files, as the pre-commit hook does
gspot check --changed             # the files changed since the upstream or default branch
gspot check --changed origin/main    # the files changed since origin/main
gspot check src/app.ts docs       # some files and folders
gspot check --only python/ruff    # one check
gspot check --fix                 # run the formatters and other fixers, then check again
gspot check --json                # the report as one JSON object
```

### Understand a finding

```shell
gspot explain javascript/eslint            # a check: what it finds, why, and what to do
gspot explain gspot/no-trivial-files       # a lint rule, as the report prints it
gspot explain limits.function_lines        # a setting: its value, default, and source
gspot explain ./src/app.ts                 # a file: the checks and ignores that apply to it
```

### Change the checks

```shell
gspot set level all
gspot set limits.function_lines 80 --reason "The parser is one state machine."
gspot unset limits.function_lines
gspot add pytest --scope services/api
gspot remove nextjs
gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results."
gspot unignore javascript/eslint --rule no-console
```

Each command edits `gspot.toml` and writes the generated files again. When the change needs new tools, the
command prints a note to run `gspot install`.

### Inspect and share the setup

```shell
gspot list                            # the configurations and the state of each check
gspot list settings                   # every setting, its value, and where the value comes from
gspot doctor                          # the state of the tools, hooks, CI workflow, rules, and version
gspot export gspot.template.toml      # a template for other repositories
gspot init --from ../gspot.template.toml --dry-run   # in another repository
```

### Commands and exit codes

| Command          | What it does                                                 |
| ---------------- | ------------------------------------------------------------ |
| `gspot init`     | Set up gspot in this repository.                             |
| `gspot install`  | Install the tools and turn the Git hooks on or off.          |
| `gspot apply`    | Write the generated files from `gspot.toml`.                 |
| `gspot check`    | Run the checks.                                              |
| `gspot add`      | Select configurations.                                       |
| `gspot remove`   | Remove configurations.                                       |
| `gspot set`      | Change a setting.                                            |
| `gspot unset`    | Delete your value of a setting.                              |
| `gspot ignore`   | Ignore a check or one of its lint rules.                     |
| `gspot unignore` | Stop ignoring a check.                                       |
| `gspot list`     | List configurations or settings.                             |
| `gspot explain`  | Explain a check, lint rule, configuration, setting, or file. |
| `gspot doctor`   | Check the gspot setup.                                       |
| `gspot export`   | Write a template for other repositories.                     |

Every command accepts `--help` and `--json`.

| Exit code    | Meaning for `gspot check`                                          |
| ------------ | ------------------------------------------------------------------ |
| `0`          | Every check that ran passed.                                       |
| `1`          | Findings remain.                                                   |
| `2`          | The run did not finish, for example because a tool does not exist. |
| `130`, `143` | You stopped the run with Control-C or SIGTERM.                     |

The other commands exit with `0` or `2`. `gspot doctor` exits with `1` when it finds a problem with a tool or a
hook.

## Learn more

- [Quickstart](https://generativespotting.com/start/quickstart/)
- [Install](https://generativespotting.com/start/install/)
- [Read and fix findings](https://generativespotting.com/use/findings/)
- [Git hooks](https://generativespotting.com/use/hooks/) and [CI](https://generativespotting.com/use/ci/)
- [Coding agents](https://generativespotting.com/use/agent-rules/)
- [gspot.toml](https://generativespotting.com/configure/gspot-toml/) and the
  [settings reference](https://generativespotting.com/reference/gspot-toml/)
- [Command reference](https://generativespotting.com/reference/commands/)
- [Source code and issues](https://github.com/stefanionescu/gspot)

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md)
