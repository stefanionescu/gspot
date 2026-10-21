<!-- >>> gspot managed >>> -->

# Rules

Read these rules first:

- `.gspot/configurations/general/engineering/rules/WORKING.md`
- `.gspot/configurations/general/prose/rules/WRITING.md`
- `.gspot/configurations/general/engineering/rules/TALKING.md`

Read a rule below when its sentence fits your task.
A rule marked `in <folder>/` applies only to files in that folder.
A more specific rule wins over a general one.

## Languages

- `.gspot/configurations/language/javascript/rules/BUN.md`: when code runs on Bun.
- `.gspot/configurations/language/javascript/rules/COMPONENTS.md`: when you change an Astro, Svelte, Vue, or React component.
- `.gspot/configurations/language/javascript/rules/JAVASCRIPT.md`: when you change JavaScript or TypeScript code.
- `.gspot/configurations/language/javascript/rules/NODE.md`: when code runs on Node.
- `.gspot/configurations/language/typescript/rules/TYPESCRIPT.md`: when you change TypeScript code.
- `.gspot/configurations/language/bash/rules/BASH.md`: when you write or change a shell script.
- `.gspot/configurations/language/bash/rules/LANGUAGE.md`: when you write Bash functions, variables, quoting, or loops.
- `.gspot/configurations/language/bash/rules/OPERATIONS.md`: when you write a deployment, publishing, or remote shell script.
- `.gspot/configurations/language/bash/rules/SAFETY.md`: when a shell script runs commands, handles paths, downloads files, or deletes files.
- `.gspot/configurations/language/css/rules/CSS.md` in `docs/`: when you change a stylesheet.
- `.gspot/configurations/language/html/rules/HTML.md` in `docs/`: when you change HTML or an HTML template.

## Infrastructure

- `.gspot/configurations/infrastructure/github-actions/rules/GITHUB-ACTIONS.md`: when you change a GitHub Actions workflow or action.

## General

- `.gspot/configurations/general/commits/rules/GIT.md`: before you commit, push, tag, or open a pull request.
- `.gspot/configurations/general/dependencies/rules/DEPENDENCIES.md`: before you add, upgrade, or remove a dependency.
- `.gspot/configurations/general/docs/rules/DOCS.md`: when you write or change documentation.
- `.gspot/configurations/general/engineering/rules/ACCESSIBILITY.md`: when you change a user interface.
- `.gspot/configurations/general/engineering/rules/CLI.md`: when you change a command-line program that the project ships.
- `.gspot/configurations/general/engineering/rules/COMMENTS.md`: when you write or change a comment.
- `.gspot/configurations/general/engineering/rules/CONFIGURATION.md`: when you change how a program reads its configuration or environment.
- `.gspot/configurations/general/engineering/rules/ERRORS.md`: when you write code that raises, catches, or reports an error.
- `.gspot/configurations/general/engineering/rules/HTTP.md`: when you change an HTTP service.
- `.gspot/configurations/general/engineering/rules/LOGGING.md`: when you add or change logging.
- `.gspot/configurations/general/engineering/rules/PLANNING.md`: before you write a plan.
- `.gspot/configurations/general/engineering/rules/SUPPRESSIONS.md`: before you add a suppression comment or run `gspot ignore`.
- `.gspot/configurations/general/engineering/rules/TASKS.md`: when you change `mise` tasks, `package.json` scripts, a `Makefile`, or another task runner.
- `.gspot/configurations/general/engineering/rules/TESTING.md`: when you write or change a test.
- `.gspot/configurations/general/files/rules/YAML.md`: when you change a `.yml` or `.yaml` file.
- `.gspot/configurations/general/gspot/rules/GENERATED.md`: when you change a generated file, or the code that writes one.
- `.gspot/configurations/general/naming/rules/NAMING.md`: when you name a file, folder, type, function, or variable.
- `.gspot/configurations/general/secrets/rules/SECRETS.md`: when code reads, stores, or logs a secret.
- `.gspot/configurations/general/security/rules/SECURITY.md`: when code handles input, authentication, redirects, or downloads.

## Frameworks

- `.gspot/configurations/framework/astro/rules/ASTRO.md` in `docs/`: when you change Astro components, pages, or content collections.
- `.gspot/configurations/framework/site/rules/SITE.md` in `docs/`: when you change a site that a build turns into static HTML.

## Libraries

- `.gspot/configurations/library/zod/rules/ZOD.md` in `docs/`, `packages/cli/`, `tests/`: when you write or change a Zod schema.

## Platforms

- `.gspot/configurations/platform/cloudflare/rules/CLOUDFLARE.md` in `docs/`: when code runs on Cloudflare Workers.

## Commands

Before you commit, run `mise exec -- gspot check --staged`.

To change `gspot.toml`, run `mise exec -- gspot set`, `unset`, `add`, `remove`, `ignore`, or `unignore`.
After you edit `gspot.toml` by hand, run `mise exec -- gspot apply`.

## Generated files

Do not edit these files. Change `gspot.toml`, then run `mise exec -- gspot apply`.

- every file under `.gspot/`
- `.editorconfig`
- `.github/workflows/gspot.yml`
- `.markdownlint.jsonc`
- `.prettierignore`
- `docs/.stylelintrc.json`
- `eslint.config.mjs`
- `prettier.config.mjs`

gspot also sets one key in `bunfig.toml`: `install.security.scanner`.
You can edit the other keys of that file.

<!-- <<< gspot managed <<< -->

## This repository

- Commit straight to `main`. Do not open branches or pull requests.
- Name a tool check after its tool. Name a built-in check after what it checks.
- Unit tests make no network calls.
- In unit check tests, choose the entrypoint for the assertion:
    - Use `checkFindings` for one check's findings or error.
    - Use `planSandboxCheck` with `findBuiltInCheck` when files or the read cache change after the session opens.
    - Use `runCheckImplementation` for a command check whose plan the test changes.
    - Use `runChecks` with `buildRunOptions` for status, notes, exit codes, skips, or cancellation.
    - Use `runCheckSample` for a sample that fails and passes after its fix.
- Keep CLI calls and direct imports of check functions out of `tests/unit/cli/checks/`.
  CLI behavior belongs to `tests/unit/cli/commands/`.
- Do not use subagents or parallel agents unless asked in the conversation.
- Keep the owner's descriptions word for word: the first sentence of `README.md`, and the `description` in
  `packages/cli/package.json`. Their copies in the docs, `llms.txt`, and `gspot --help` match them.

## Folders

These folder rules apply to `packages/cli/src/`, `packages/eslint-plugin/src/`, `docs/src/`, and `tests/` in this repository.

- Each package keeps fixed values in `config/`, TypeScript types in `types/`, and runtime schemas in `schemas/`.
- Group subfolders and files by topic. Keep test values in `tests/data/`.
- Other files take their constants from `config/` and their types from `types/`. They declare no module-level
  literal constants or types. Declare schemas only in `schemas/`, including schemas used by one file.
  A value computed at import time stays with the behavior that uses it.
- Write each exported type in plain TypeScript. Check each Zod schema against its type with
  `satisfies z.ZodType<T>`. Do not export a `z.infer` type.
- Declare a list of allowed names as an `as const` array in `config/`, its type as `(typeof LIST)[number]` in
  `types/`, and its schema as `z.enum(LIST)`.

## Dependency overrides

The root `package.json` overrides keep transitive packages on security fixes.

| Override                  | Version  | Advisory and reason                                                                                                                                                                     |
| ------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handlebars`              | `4.7.10` | [GHSA-xw65-4hp5-5hc7](https://github.com/advisories/GHSA-xw65-4hp5-5hc7) — Prevents JavaScript injection from precompiled templates.                                                    |
| `js-yaml@3`               | `4.3.2`  | [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) — Removes the unpatched sprintf-js dependency chain that @istanbuljs/load-nyc-config receives through major 3. |
| `postcss-selector-parser` | `7.1.6`  | [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) — Bounds flat-selector processing; PurgeCSS and postcss-nested request major 6.                                |
| `sharp`                   | `0.35.5` | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) — Fixes the bundled librsvg vulnerability; Miniflare pins 0.35.4.                                              |
| `undici@7`                | `7.29.1` | [GHSA-w293-vg96-wgc3](https://github.com/advisories/GHSA-w293-vg96-wgc3) — Preserves TLS validation options in BalancedPool.                                                            |
