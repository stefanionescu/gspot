<!-- >>> gspot managed >>> -->

# Engineering Guidelines

Selected level: `all`. Correctness, security, accessibility, type safety, routine formatting, and declared project contracts apply at both levels.

Guide requirements about vocabulary, architecture, naming, documentation coverage, declaration order, API style, and complexity apply only at all or when the project explicitly opts into them. Neither level enables experimental or preview lint rules.

Read `.gspot/guides/general/agent/WORKING.md` and `.gspot/guides/general/prose/WRITING.md` first. Then read the guides for the files you change. A more specific layer wins over a general one.

How to work here:

- `.gspot/guides/general/agent/GIT.md`
- `.gspot/guides/general/agent/PLANNING.md`
- `.gspot/guides/general/agent/SUPPRESSIONS.md`
- `.gspot/guides/general/agent/TALKING.md`
- `.gspot/guides/general/agent/WORKING.md`

Code, everywhere:

- `.gspot/guides/general/code/ACCESSIBILITY.md`
- `.gspot/guides/general/code/CLI.md`
- `.gspot/guides/general/code/COMMENTS.md`
- `.gspot/guides/general/code/CONFIGURATION.md`
- `.gspot/guides/general/code/DEPENDENCIES.md`
- `.gspot/guides/general/code/ERRORS.md`
- `.gspot/guides/general/code/GENERATED.md`
- `.gspot/guides/general/code/LOGGING.md`
- `.gspot/guides/general/code/NAMING-FILES.md`
- `.gspot/guides/general/code/NAMING.md`
- `.gspot/guides/general/code/SECRETS.md`
- `.gspot/guides/general/code/SECURITY.md`
- `.gspot/guides/general/code/TESTING.md`

Documentation:

- `.gspot/guides/general/prose/DOCS-CONTENT.md`
- `.gspot/guides/general/prose/DOCS-FORMAT.md`
- `.gspot/guides/general/prose/DOCS-MEDIA.md`
- `.gspot/guides/general/prose/DOCS-REVIEW.md`
- `.gspot/guides/general/prose/DOCS-SURFACES.md`
- `.gspot/guides/general/prose/DOCS.md`
- `.gspot/guides/general/prose/WRITING.md`

Languages:

- `.gspot/guides/language/BASH.md`
- `.gspot/guides/language/bash/LANGUAGE.md`
- `.gspot/guides/language/bash/SAFETY.md`
- `.gspot/guides/language/bash/OPERATIONS.md`
- `.gspot/guides/language/naming/BASH.md`
- `.gspot/guides/language/JAVASCRIPT.md`
- `.gspot/guides/language/naming/JAVASCRIPT.md`
- `.gspot/guides/language/TYPESCRIPT.md`
- `.gspot/guides/language/naming/TYPESCRIPT.md`
- `.gspot/guides/language/YAML.md`
- `.gspot/guides/language/CSS.md`
- `.gspot/guides/language/naming/CSS.md`

Runtimes:

- `.gspot/guides/runtime/node/NODE.md`
- `.gspot/guides/runtime/bun/BUN.md`

Tools:

- `.gspot/guides/tool/commitlint/COMMITLINT.md`
- `.gspot/guides/tool/tasks/TASKS.md`
- `.gspot/guides/tool/github-actions/GITHUB-ACTIONS.md`

Frameworks:

- `.gspot/guides/framework/astro/ASTRO.md`

Run `gspot check --staged` before committing. Change policy with `gspot set` or `gspot ignore` (or by editing `gspot.toml`), then `gspot apply`; never edit files under `.gspot/`.

<!-- <<< gspot managed <<< -->

Do not use subagents or parallel agents unless asked in the conversation.
