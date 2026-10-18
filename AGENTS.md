<!-- >>> gspot managed >>> -->

# Rules

Level: `all`.

Read `.gspot/rules/general/engineering/agent/WORKING.md` and `.gspot/rules/general/prose/WRITING.md` first. Then read the rules for the files you change. A more specific rule wins over a general one.

Languages:

- `.gspot/rules/language/javascript/BUN.md`
- `.gspot/rules/language/javascript/COMPONENTS.md`
- `.gspot/rules/language/javascript/JAVASCRIPT.md`
- `.gspot/rules/language/javascript/NAMING.md`
- `.gspot/rules/language/javascript/NODE.md`
- `.gspot/rules/language/typescript/NAMING.md`
- `.gspot/rules/language/typescript/TYPESCRIPT.md`
- `.gspot/rules/language/bash/BASH.md`
- `.gspot/rules/language/bash/LANGUAGE.md`
- `.gspot/rules/language/bash/NAMING.md`
- `.gspot/rules/language/bash/OPERATIONS.md`
- `.gspot/rules/language/bash/SAFETY.md`
- `.gspot/rules/language/css/CSS.md`
- `.gspot/rules/language/css/NAMING.md`
- `.gspot/rules/language/html/HTML.md`
- `.gspot/rules/language/html/NAMING.md`

Infrastructure:

- `.gspot/rules/infrastructure/github-actions/GITHUB-ACTIONS.md`

General:

- `.gspot/rules/general/commits/GIT.md`
- `.gspot/rules/general/dependencies/DEPENDENCIES.md`
- `.gspot/rules/general/docs/DOCS.md`
- `.gspot/rules/general/engineering/agent/PLANNING.md`
- `.gspot/rules/general/engineering/agent/SUPPRESSIONS.md`
- `.gspot/rules/general/engineering/agent/TALKING.md`
- `.gspot/rules/general/engineering/agent/TASKS.md`
- `.gspot/rules/general/engineering/code/ACCESSIBILITY.md`
- `.gspot/rules/general/engineering/code/CLI.md`
- `.gspot/rules/general/engineering/code/COMMENTS.md`
- `.gspot/rules/general/engineering/code/CONFIGURATION.md`
- `.gspot/rules/general/engineering/code/ERRORS.md`
- `.gspot/rules/general/engineering/code/HTTP.md`
- `.gspot/rules/general/engineering/code/LOGGING.md`
- `.gspot/rules/general/engineering/code/TESTING.md`
- `.gspot/rules/general/files/YAML.md`
- `.gspot/rules/general/gspot/GENERATED.md`
- `.gspot/rules/general/naming/NAMING.md`
- `.gspot/rules/general/secrets/SECRETS.md`
- `.gspot/rules/general/security/SECURITY.md`

Frameworks:

- `.gspot/rules/framework/astro/ASTRO.md`
- `.gspot/rules/framework/site/SITE.md`

Libraries:

- `.gspot/rules/library/zod/ZOD.md`

Platforms:

- `.gspot/rules/platform/cloudflare/CLOUDFLARE.md`

Run `mise exec -- gspot check --staged` before you commit. To change gspot.toml, use `mise exec -- gspot set`, `mise exec -- gspot unset`, `mise exec -- gspot ignore`, or `mise exec -- gspot unignore`. After you edit gspot.toml by hand, run `mise exec -- gspot apply`. Never edit files under `.gspot/`, or these generated files: `.editorconfig`, `.github/workflows/gspot.yml`, `.markdownlint-cli2.mjs`, `.prettierignore`, `.semgrepignore`, `bunfig.toml`, `docs/.stylelintrc.json`, `eslint.config.mjs`, `prettier.config.mjs`. Change `gspot.toml` and run `mise exec -- gspot apply` instead.

<!-- <<< gspot managed <<< -->

## This repository

- Commit straight to `main`. Do not open branches or pull requests.
- Name a tool check after its tool. Name a built-in check after what it checks.
- Unit tests make no network calls.
- Do not use subagents or parallel agents unless asked in the conversation.

## Folders

These folder rules apply to this repository only.

- Each package keeps its fixed values in `config/` and its TypeScript types in `types/`, one file per topic:
  `packages/cli/src/`, `packages/eslint-plugin/src/`, `docs/src/`, and `tests/`. `tests/` keeps its values in
  `data/`.
- Other files take their constants from `config/` and their types from `types/`. They declare no module-level
  literal constants and export no types. A Zod schema, a value computed at import time, or a type that one file
  uses stays in that file.
- Write each exported type in plain TypeScript. Check each Zod schema against its type with
  `satisfies z.ZodType<T>`. Do not export a `z.infer` type.
- Declare a list of allowed names as an `as const` array in `config/`, its type as `(typeof LIST)[number]` in
  `types/`, and its schema as `z.enum(LIST)`.

## Dependency overrides

The root `package.json` overrides keep transitive packages on security fixes.

| Override                  | Version  | Advisory and reason                                                                                                                                      |
| ------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handlebars`              | `4.7.10` | [GHSA-xw65-4hp5-5hc7](https://github.com/advisories/GHSA-xw65-4hp5-5hc7) — Prevents JavaScript injection from precompiled templates.                     |
| `js-yaml@3`               | `4.3.2`  | [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) — Bounds empty merge-source processing; Jest requests major 3.                  |
| `postcss-selector-parser` | `7.1.6`  | [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) — Bounds flat-selector processing; PurgeCSS and postcss-nested request major 6. |
| `sharp`                   | `0.35.5` | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) — Fixes the bundled librsvg vulnerability; Miniflare pins 0.35.4.               |
| `undici@7`                | `7.29.1` | [GHSA-w293-vg96-wgc3](https://github.com/advisories/GHSA-w293-vg96-wgc3) — Preserves TLS validation options in BalancedPool.                             |
