<!-- >>> gspot managed >>> -->

# Engineering Guidelines

Selected level: `all`. Correctness, security, accessibility, type safety, routine formatting, and declared project contracts apply at both levels.

These rules apply only at level `all`: vocabulary, architecture, naming, documentation coverage, declaration order, API style, and complexity. Neither level enables experimental or preview lint rules.

Read `.gspot/rules/general/engineering/agent/WORKING.md` and `.gspot/rules/general/engineering/prose/WRITING.md` first. Then read the rules for the files you change. A more specific rule wins over a general one.

Repository:

- `.gspot/rules/general/engineering/agent/GIT.md`
- `.gspot/rules/general/engineering/agent/PLANNING.md`
- `.gspot/rules/general/engineering/agent/SUPPRESSIONS.md`
- `.gspot/rules/general/engineering/agent/WORKING.md`
- `.gspot/rules/general/engineering/code/ACCESSIBILITY.md`
- `.gspot/rules/general/engineering/code/CLI.md`
- `.gspot/rules/general/engineering/code/COMMENTS.md`
- `.gspot/rules/general/engineering/code/CONFIGURATION.md`
- `.gspot/rules/general/engineering/code/DEPENDENCIES.md`
- `.gspot/rules/general/engineering/code/ERRORS.md`
- `.gspot/rules/general/engineering/code/GENERATED.md`
- `.gspot/rules/general/engineering/code/HTTP.md`
- `.gspot/rules/general/engineering/code/LOGGING.md`
- `.gspot/rules/general/engineering/code/NAMING-FILES.md`
- `.gspot/rules/general/engineering/code/NAMING.md`
- `.gspot/rules/general/engineering/code/SECRETS.md`
- `.gspot/rules/general/engineering/code/SECURITY.md`
- `.gspot/rules/general/engineering/code/TESTING.md`
- `.gspot/rules/general/engineering/prose/DOCS-CONTENT.md`
- `.gspot/rules/general/engineering/prose/DOCS-FORMAT.md`
- `.gspot/rules/general/engineering/prose/DOCS-MEDIA.md`
- `.gspot/rules/general/engineering/prose/DOCS-REVIEW.md`
- `.gspot/rules/general/engineering/prose/DOCS-SURFACES.md`
- `.gspot/rules/general/engineering/prose/DOCS.md`
- `.gspot/rules/general/engineering/prose/WRITING.md`
- `.gspot/rules/general/files/TASKS.md`
- `.gspot/rules/general/files/YAML.md`

Languages:

- `.gspot/rules/language/javascript/BUN.md`
- `.gspot/rules/language/javascript/JAVASCRIPT.md`
- `.gspot/rules/language/javascript/NAMING.md`
- `.gspot/rules/language/javascript/NODE.md`
- `.gspot/rules/language/typescript/NAMING.md`
- `.gspot/rules/language/typescript/TYPESCRIPT.md`
- `.gspot/rules/language/css/CSS.md`
- `.gspot/rules/language/css/NAMING.md`

Tools:

- `.gspot/rules/tool/actions/GITHUB-ACTIONS.md`
- `.gspot/rules/tool/vitest/VITEST.md`

Frameworks:

- `.gspot/rules/framework/astro/ASTRO.md`
- `.gspot/rules/framework/nestjs/NESTJS.md`
- `.gspot/rules/framework/react/REACT.md`
- `.gspot/rules/framework/nextjs/NEXTJS.md`
- `.gspot/rules/framework/svelte/SVELTE.md`

Libraries:

- `.gspot/rules/library/zod/ZOD.md`

Platforms:

- `.gspot/rules/platform/cloudflare/WORKERS.md`

Run `gspot check --staged` before committing. Change policy with `gspot set` or `gspot ignore` (or by editing `gspot.toml`), then `gspot apply`; never edit files under `.gspot/`.

<!-- <<< gspot managed <<< -->

Do not use subagents or parallel agents unless asked in the conversation.

This repository keeps module-level types in each package's `types/` folder and static constants in its `config/` folder, grouped by behavior. This applies to CLI source, the ESLint plugin, test support, and test data. Shipped configuration assets live under `packages/cli/configurations/`; their parsers remain under source parsing owners. These folder choices are specific to this repository and are not required of consumer repositories. Inline redundant forwarding functions; retain required callbacks and shared calculations with real callers.

Owner decisions are recorded in `findings/progress.json`. Read them before you change how gspot ships, installs, or is configured, and never reverse one inside unrelated work. These decisions are final:

- gspot ships only as JavaScript on npm. Never add per-OS binaries, standalone archives, platform packages, or a release-archive pin.
- Use one setting for each concern. Do not add special time limits, per-suite or per-OS budgets, environment switches, or options for one caller. Fix the cause instead.
- The shipped banned naming terms stay complete, no group is removable, and they apply at level `all` only.
- The agent rule `TALKING.md` ("When you talk, use ASD-STE100.") ships in every installation.
- The documentation site is generativespotting.com, deployed to Cloudflare Workers.
- Every change simplifies: it deletes, merges, or replaces with less code, and it keeps every CLI command.
- Use one name for each concept, as `findings/review/glossary.md` fixes it. Never give one thing two names or one name two meanings.
- This repository has no `CONTRIBUTING.md`. Repository rules that no check enforces live in this file.
