<!-- >>> gspot managed >>> -->

# Engineering Guidelines

Selected level: `all`. Correctness, security, accessibility, type safety, routine formatting, and declared project contracts apply at both levels.

Guide requirements about vocabulary, architecture, naming, documentation coverage, declaration order, API style, and complexity apply only at all or when the project explicitly opts into them. Neither level enables experimental or preview lint rules.

Read `.gspot/guides/agent/WORKING.md` and `.gspot/guides/prose/WRITING.md` first. Then read the guides for the files you change. A more specific layer wins over a general one.

How to work here:

- `.gspot/guides/agent/GIT.md`
- `.gspot/guides/agent/PLANNING.md`
- `.gspot/guides/agent/SUPPRESSIONS.md`
- `.gspot/guides/agent/TALKING.md`
- `.gspot/guides/agent/WORKING.md`

Code, everywhere:

- `.gspot/guides/code/ACCESSIBILITY.md`
- `.gspot/guides/code/CLI.md`
- `.gspot/guides/code/COMMENTS.md`
- `.gspot/guides/code/CONFIGURATION.md`
- `.gspot/guides/code/DEPENDENCIES.md`
- `.gspot/guides/code/ERRORS.md`
- `.gspot/guides/code/GENERATED.md`
- `.gspot/guides/code/LOGGING.md`
- `.gspot/guides/code/NAMING-FILES.md`
- `.gspot/guides/code/NAMING.md`
- `.gspot/guides/code/SECRETS.md`
- `.gspot/guides/code/SECURITY.md`
- `.gspot/guides/code/TESTING.md`

Documentation:

- `.gspot/guides/prose/DOCS-CONTENT.md`
- `.gspot/guides/prose/DOCS-FORMAT.md`
- `.gspot/guides/prose/DOCS-MEDIA.md`
- `.gspot/guides/prose/DOCS-REVIEW.md`
- `.gspot/guides/prose/DOCS-SURFACES.md`
- `.gspot/guides/prose/DOCS.md`
- `.gspot/guides/prose/WRITING.md`

Languages:

- `.gspot/guides/language/bash/BASH.md`
- `.gspot/guides/language/bash/LANGUAGE.md`
- `.gspot/guides/language/bash/NAMING.md`
- `.gspot/guides/language/bash/OPERATIONS.md`
- `.gspot/guides/language/bash/SAFETY.md`
- `.gspot/guides/language/javascript/BUN.md`
- `.gspot/guides/language/javascript/JAVASCRIPT.md`
- `.gspot/guides/language/javascript/NAMING.md`
- `.gspot/guides/language/javascript/NODE.md`
- `.gspot/guides/language/typescript/NAMING.md`
- `.gspot/guides/language/typescript/TYPESCRIPT.md`
- `.gspot/guides/language/css/CSS.md`
- `.gspot/guides/language/css/NAMING.md`

Repository:

- `.gspot/guides/general/commits/COMMITLINT.md`
- `.gspot/guides/general/files/TASKS.md`
- `.gspot/guides/general/files/YAML.md`

Tools:

- `.gspot/guides/tool/actions/GITHUB-ACTIONS.md`

Frameworks:

- `.gspot/guides/framework/astro/ASTRO.md`

Run `gspot check --staged` before committing. Change policy with `gspot set` or `gspot ignore` (or by editing `gspot.toml`), then `gspot apply`; never edit files under `.gspot/`.

<!-- <<< gspot managed <<< -->

Do not use subagents or parallel agents unless asked in the conversation.
