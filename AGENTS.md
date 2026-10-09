<!-- >>> gspot managed >>> -->

# Engineering Guidelines

Selected level: `all`. Correctness, security, accessibility, type safety, routine formatting, and declared project contracts apply at both levels.

These rules apply only at level `all`: word choice, architecture, naming, doc comments, declaration order, API style, and complexity. Neither level enables experimental or preview lint rules.

Read `.gspot/rules/general/engineering/agent/WORKING.md` and `.gspot/rules/general/prose/WRITING.md` first. Then read the rules for the files you change. A more specific rule wins over a general one.

Repository:

- `.gspot/rules/general/commits/GIT.md`
- `.gspot/rules/general/dependencies/DEPENDENCIES.md`
- `.gspot/rules/general/engineering/agent/PLANNING.md`
- `.gspot/rules/general/engineering/agent/SUPPRESSIONS.md`
- `.gspot/rules/general/engineering/agent/TALKING.md`
- `.gspot/rules/general/engineering/agent/TASKS.md`
- `.gspot/rules/general/engineering/agent/WORKING.md`
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
- `.gspot/rules/general/naming/NAMING-FILES.md`
- `.gspot/rules/general/naming/NAMING.md`
- `.gspot/rules/general/prose/DOCS-CONTENT.md`
- `.gspot/rules/general/prose/DOCS-FORMAT.md`
- `.gspot/rules/general/prose/DOCS-MEDIA.md`
- `.gspot/rules/general/prose/DOCS-SURFACES.md`
- `.gspot/rules/general/prose/DOCS.md`
- `.gspot/rules/general/prose/WRITING.md`
- `.gspot/rules/general/secrets/SECRETS.md`
- `.gspot/rules/general/security/SECURITY.md`

Languages:

- `.gspot/rules/language/javascript/BUN.md`
- `.gspot/rules/language/javascript/COMPONENTS.md`
- `.gspot/rules/language/javascript/JAVASCRIPT.md`
- `.gspot/rules/language/javascript/NAMING.md`
- `.gspot/rules/language/javascript/NODE.md`
- `.gspot/rules/language/typescript/NAMING.md`
- `.gspot/rules/language/typescript/TYPESCRIPT.md`
- `.gspot/rules/language/python/DESIGN.md`
- `.gspot/rules/language/python/FLOW.md`
- `.gspot/rules/language/python/NAMING.md`
- `.gspot/rules/language/python/PACKAGING.md`
- `.gspot/rules/language/python/PYTHON.md`
- `.gspot/rules/language/python/TYPING.md`
- `.gspot/rules/language/css/CSS.md`
- `.gspot/rules/language/css/NAMING.md`
- `.gspot/rules/language/html/HTML.md`
- `.gspot/rules/language/html/NAMING.md`

Infrastructure:

- `.gspot/rules/infra/github-actions/GITHUB-ACTIONS.md`

Frameworks:

- `.gspot/rules/framework/astro/ASTRO.md`
- `.gspot/rules/framework/site/SITE.md`

Libraries:

- `.gspot/rules/library/zod/ZOD.md`

Platforms:

- `.gspot/rules/platform/cloudflare/WORKERS.md`

Run `gspot check --staged` before committing. Change policy with `gspot set` or `gspot ignore`. After a hand edit of `gspot.toml`, run `gspot apply`. Never edit files under `.gspot/`.

<!-- <<< gspot managed <<< -->

Do not use subagents or parallel agents unless asked in the conversation.

This repository keeps module-level types in each package's `types/` folder and static constants in its `config/` folder, grouped by behavior. This applies to CLI source, the ESLint plugin, test support, and test data. Shipped configuration assets live under `packages/cli/configurations/`. Their parsers remain under source parsing owners.

These folder choices are specific to this repository and are not required of consumer repositories. Inline redundant forwarding functions. Retain required callbacks and shared calculations with real callers.

A check that runs a tool uses the tool name, so readers know which rules and suppression syntax apply. A check that gspot implements uses the name of what it checks. Both use the configuration name as their prefix and the names in `findings/review/glossary.md`.

Test `config/` and `types/` folders mirror the tests that use them. Flatten a one-file folder into its parent. Keep text shared by two or more test files in `config/samples/`.

File-format schemas belong to their parsers. Shared parser contracts live in `parsers/schema/`. Policy tables, including `[agent_rules]`, belong to `policy/schema/`. The ownership log schema lives in `packages/cli/src/lifecycle/ownership/state/contracts.ts`.

Owner decisions are recorded in `findings/progress.json`. Read them before you change how gspot ships, installs, or is configured, and never reverse one inside unrelated work. These decisions are final:

- gspot ships only as JavaScript on npm. Never add per operating system binaries, standalone archives, platform packages, or a release-archive pin.
- Use one setting for each concern. Do not add special time limits, per-suite or per operating system budgets, environment switches, or options for one caller. Fix the cause instead.
- The shipped banned naming terms stay complete, no group is removable, and they apply at level `all` only.
- The agent rule `TALKING.md` ("When you talk, use ASD-STE100.") ships in every installation.
- The documentation site is generativespotting.com, deployed to Cloudflare Workers.
- Every change simplifies: it deletes, merges, or replaces with less code, and it keeps every CLI command.
- Use one name for each concept, as `findings/review/glossary.md` fixes it. Never give one thing two names or one name two meanings.
- This repository has no `CONTRIBUTING.md`. Repository rules that no check enforces live in this file.

## Dependency overrides

The root `package.json` overrides keep transitive packages on security fixes. Keep each override
until its callers resolve a fixed version without it. Verify a forced major version with its
native consumers before changing it.

| Override                  | Version  | Advisory and reason                                                                                                                        |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `@xmldom/xmldom`          | `0.8.15` | [GHSA-8344-3jmq-59r6](https://github.com/advisories/GHSA-8344-3jmq-59r6) — Prevents quadratic XML attribute processing.                    |
| `brace-expansion@1`       | `1.1.21` | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) — Prevents quadratic brace expansion.                             |
| `brace-expansion@2`       | `2.1.7`  | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) — Prevents quadratic brace expansion.                             |
| `brace-expansion@5`       | `5.0.12` | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) — Prevents quadratic brace expansion.                             |
| `fast-uri@3`              | `3.1.8`  | [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) — Fixes percent-encoded host case normalization.                  |
| `handlebars`              | `4.7.10` | [GHSA-xw65-4hp5-5hc7](https://github.com/advisories/GHSA-xw65-4hp5-5hc7) — Prevents JavaScript injection from precompiled templates.       |
| `ip-address`              | `10.7.1` | [GHSA-j6r3-76f7-8jcv](https://github.com/advisories/GHSA-j6r3-76f7-8jcv) — Prevents cross-family subnet allowlist bypass.                  |
| `js-yaml@3`               | `4.3.2`  | [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) — Bounds empty merge-source processing; Jest requests major 3.    |
| `minimatch@9`             | `9.0.9`  | [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) — Prevents repeated globstar matching from exhausting CPU.        |
| `postcss-selector-parser` | `7.1.6`  | [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) — Bounds flat-selector processing; PurgeCSS requests major 6.     |
| `qs`                      | `6.16.0` | [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) — Prevents denial of service through a supplied isBuffer value.   |
| `sharp`                   | `0.35.5` | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) — Fixes the bundled librsvg vulnerability; Miniflare pins 0.35.4. |
| `source-map-js`           | `1.2.2`  | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) — Rejects indexed source-map offsets that stall the event loop.   |
| `undici@7`                | `7.29.1` | [GHSA-w293-vg96-wgc3](https://github.com/advisories/GHSA-w293-vg96-wgc3) — Preserves TLS validation options in BalancedPool.               |
| `uuid@8`                  | `11.1.1` | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) — Checks supplied buffer bounds; consumers request major 8.       |
