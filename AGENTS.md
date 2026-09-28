<!-- >>> gspot managed >>> -->

# Engineering Guidelines

Selected level: `all`. Correctness, security, accessibility, type safety, routine formatting, and declared project contracts apply at both levels.

Guide requirements about vocabulary, architecture, naming, documentation coverage, declaration order, API style, and complexity apply only at all or when the project explicitly opts into them. Neither level enables experimental or preview lint rules.

Read `.gspot/rules/general/agent/WORKING.md` and `.gspot/rules/general/prose/WRITING.md` first. Then read the guides for the files you change. A more specific layer wins over a general one.

How to work here:

- `.gspot/rules/general/agent/GIT.md`
- `.gspot/rules/general/agent/PLANNING.md`
- `.gspot/rules/general/agent/SUPPRESSIONS.md`
- `.gspot/rules/general/agent/TALKING.md`
- `.gspot/rules/general/agent/WORKING.md`

Code, everywhere:

- `.gspot/rules/general/code/ACCESSIBILITY.md`
- `.gspot/rules/general/code/CLI.md`
- `.gspot/rules/general/code/COMMENTS.md`
- `.gspot/rules/general/code/CONFIGURATION.md`
- `.gspot/rules/general/code/DEPENDENCIES.md`
- `.gspot/rules/general/code/ERRORS.md`
- `.gspot/rules/general/code/GENERATED.md`
- `.gspot/rules/general/code/LOGGING.md`
- `.gspot/rules/general/code/NAMING-FILES.md`
- `.gspot/rules/general/code/NAMING.md`
- `.gspot/rules/general/code/SECRETS.md`
- `.gspot/rules/general/code/SECURITY.md`
- `.gspot/rules/general/code/TESTING.md`

Documentation:

- `.gspot/rules/general/prose/DOCS-CONTENT.md`
- `.gspot/rules/general/prose/DOCS-FORMAT.md`
- `.gspot/rules/general/prose/DOCS-MEDIA.md`
- `.gspot/rules/general/prose/DOCS-REVIEW.md`
- `.gspot/rules/general/prose/DOCS-SURFACES.md`
- `.gspot/rules/general/prose/DOCS.md`
- `.gspot/rules/general/prose/WRITING.md`

Languages:

- `.gspot/rules/language/JAVASCRIPT.md`
- `.gspot/rules/language/naming/JAVASCRIPT.md`
- `.gspot/rules/language/BASH.md`
- `.gspot/rules/language/bash/LANGUAGE.md`
- `.gspot/rules/language/bash/SAFETY.md`
- `.gspot/rules/language/bash/OPERATIONS.md`
- `.gspot/rules/language/naming/BASH.md`
- `.gspot/rules/language/TYPESCRIPT.md`
- `.gspot/rules/language/naming/TYPESCRIPT.md`
- `.gspot/rules/language/YAML.md`
- `.gspot/rules/language/CSS.md`
- `.gspot/rules/language/naming/CSS.md`

Runtimes:

- `.gspot/rules/runtime/node/NODE.md`
- `.gspot/rules/runtime/bun/BUN.md`

Tools:

- `.gspot/rules/tool/commitlint/COMMITLINT.md`
- `.gspot/rules/tool/tasks/TASKS.md`
- `.gspot/rules/tool/github-actions/GITHUB-ACTIONS.md`

Run `gspot check --staged` before committing. Change policy with `gspot set` or `gspot ignore` (or by editing `gspot.toml`), then `gspot apply`; never edit files under `.gspot/`.

<!-- <<< gspot managed <<< -->

Do not use subagents or parallel agents unless asked in the conversation.
