<!-- >>> gspot managed >>> -->

# Engineering Guidelines

Selected level: `all`. Correctness, security, accessibility, type safety, routine formatting, and declared project contracts apply at both levels.

Rules about vocabulary, architecture, naming, documentation coverage, declaration order, API style, and complexity apply only at all or when the project explicitly opts into them. Neither level enables experimental or preview lint rules.

Read `.gspot/rules/agent/WORKING.md` and `.gspot/rules/prose/WRITING.md` first. Then read the rules for the files you change. A more specific rule wins over a general one.

How to work here:

- `.gspot/rules/agent/GIT.md`
- `.gspot/rules/agent/PLANNING.md`
- `.gspot/rules/agent/SUPPRESSIONS.md`
- `.gspot/rules/agent/TALKING.md`
- `.gspot/rules/agent/WORKING.md`

Code, everywhere:

- `.gspot/rules/code/ACCESSIBILITY.md`
- `.gspot/rules/code/CLI.md`
- `.gspot/rules/code/COMMENTS.md`
- `.gspot/rules/code/CONFIGURATION.md`
- `.gspot/rules/code/DEPENDENCIES.md`
- `.gspot/rules/code/ERRORS.md`
- `.gspot/rules/code/GENERATED.md`
- `.gspot/rules/code/LOGGING.md`
- `.gspot/rules/code/NAMING-FILES.md`
- `.gspot/rules/code/NAMING.md`
- `.gspot/rules/code/SECRETS.md`
- `.gspot/rules/code/SECURITY.md`
- `.gspot/rules/code/TESTING.md`

Documentation:

- `.gspot/rules/prose/DOCS-CONTENT.md`
- `.gspot/rules/prose/DOCS-FORMAT.md`
- `.gspot/rules/prose/DOCS-MEDIA.md`
- `.gspot/rules/prose/DOCS-REVIEW.md`
- `.gspot/rules/prose/DOCS-SURFACES.md`
- `.gspot/rules/prose/DOCS.md`
- `.gspot/rules/prose/WRITING.md`

Languages:

- `.gspot/rules/language/bash/BASH.md`
- `.gspot/rules/language/bash/LANGUAGE.md`
- `.gspot/rules/language/bash/NAMING.md`
- `.gspot/rules/language/bash/OPERATIONS.md`
- `.gspot/rules/language/bash/SAFETY.md`
- `.gspot/rules/language/javascript/BUN.md`
- `.gspot/rules/language/javascript/JAVASCRIPT.md`
- `.gspot/rules/language/javascript/NAMING.md`
- `.gspot/rules/language/javascript/NODE.md`
- `.gspot/rules/language/typescript/NAMING.md`
- `.gspot/rules/language/typescript/TYPESCRIPT.md`
- `.gspot/rules/language/css/CSS.md`
- `.gspot/rules/language/css/NAMING.md`

Repository:

- `.gspot/rules/general/files/TASKS.md`
- `.gspot/rules/general/files/YAML.md`

Tools:

- `.gspot/rules/tool/actions/GITHUB-ACTIONS.md`

Frameworks:

- `.gspot/rules/framework/astro/ASTRO.md`

Run `gspot check --staged` before committing. Change policy with `gspot set` or `gspot ignore` (or by editing `gspot.toml`), then `gspot apply`; never edit files under `.gspot/`.

<!-- <<< gspot managed <<< -->

Do not use subagents or parallel agents unless asked in the conversation.
