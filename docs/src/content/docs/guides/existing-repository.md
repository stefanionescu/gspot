---
title: Adopt gspot in an existing repository
description: Review configuration adoption, preserve unsupported settings, and run your first checks.
sidebar:
    order: 2
---

Use the [source installation guide](/guides/install/) to prepare the CLI. Run the commands below
from the repository root unless a step names another directory.

Preview adoption from the repository root:

```bash
gspot init --dry-run
```

Review the proposed presets, configuration changes, and integrations. Run `gspot init` to
accept the proposal. Keep unsupported configuration until you have converted its behavior.

If the plan lists unread configuration, `gspot init` without `--dry-run` exits with status 2 before
writing or installing anything. Fix the listed files and run `gspot init` again.
Use `gspot init --dry-run` to inspect the proposal without changing files.
Executable formatter and ESLint configurations are evaluated through the installed owning tool.
The proposal identifies captured settings and retained behavior. Missing ESLint, unregistered
executable behavior, and selectors that cannot be carried remain in the original configuration.
A tool evaluation failure is unread configuration and refuses initialization.

## Preserve originals

Readable configurations of selected tools include `typos.toml`, `.shellcheckrc`,
and `.markdownlint.jsonc`. Before replacing or removing a file, gspot saves its exact bytes
and permissions in local recovery data under `.gspot/recovery/`. Keep that directory private
and retain it until you no longer need the originals.

## Carry existing policy

Supported exception lists become explicit repository policy:

- typos words and excludes;
- rules turned off in a linter configuration, as `[[ignore]]` entries;
- gitleaks allowlists, osv ignored advisories and license exceptions, when those presets run.

Carried entries retain source comments where supported. Otherwise, their reason identifies
the source as `carried from <file> at init`. Review these reasons after adoption.

### Dependency licenses

License package exclusions are resolved through the project's installed
`license-checker-rseidelsohn` scanner. Each exception records the installed package version
and reported license. An unresolved package stops adoption. License allowances that cannot
be represented as supported SPDX allowances remain in the original configuration for conversion.

### SQLFluff

SQLFluff rule exclusions can be carried from `.sqlfluff`, or from the `[sqlfluff]` section
of `setup.cfg` and `tox.ini`. Shared files retain their exact bytes and permissions, even when
they contain only that section. The plan names the adopted section for manual removal.
Exclusion lists can continue onto indented lines. Duplicate options and unsupported settings
stop adoption before any original is replaced.

### Markdown

Markdown rule tables retain enabled rules, disabled rules, and options. Adoption preserves
native defaults, including when the source omits `default`. An explicit native `default: false`
keeps unspecified rules disabled. Directory-local configuration creates a policy scope with its own generated configuration
and editor pointer. Descendant scopes inherit those rule choices. Static JSON and YAML parents
use explicit `./` or `../` paths. Child values replace inherited values by rule name.
Parent files remain intact and are checked for changes before publication. Overlapping
configuration, package inheritance, and custom rules remain intact for explicit conversion.
CLI checks and corrections use only selected files and generated configuration in a temporary
directory. Other native configuration files do not override that policy or execute during a check.

### Stylelint

Root and directory-local Stylelint rule tables retain enabled options, numeric limits, and disabled rules.
Adoption validates rule names and options with the installed Stylelint version pinned by the
CSS preset. Install that version before adopting its configuration. Local JSON and YAML
inheritance uses explicit `./` or `../` paths and preserves parent order and child overrides.
Inherited files remain intact and are
checked for changes before publication. Directory-local configuration creates a policy scope.
Disabled rules keep that directory selector and apply to its generated editor configuration.
Overlapping configurations, package-provided inheritance,
executable configuration, and options that cannot be represented in TOML remain active for
explicit conversion. Enabled settings are stored in `tools.stylelint.rules`.
Disabled rules become `gspot ignore css/stylelint --rule` entries.
Declared scopes can set their own `tools.stylelint.rules`. Each scope receives its own generated
configuration and editor pointer, while the tools remain in the shared private installation.
A scope inherits rules it does not override. An override replaces the entire option value for
that rule, including any secondary options.

### Ruff

Ruff disabled rules and supported per-file exclusions can be carried from `ruff.toml`,
`.ruff.toml`, or `[tool.ruff]` in `pyproject.toml`. The project manifest remains intact.
Both `ignore` and `extend-ignore` carry. Rules under `per-file-ignores` and
`extend-per-file-ignores` combine for each selector and retain their configuration directory.
Local `extend` chains carry supported exclusions and retain inherited files. A child
`per-file-ignores` table replaces the inherited table; additive exclusions accumulate.
Inherited selectors keep their declaring directory. If a wildcard selector cannot be restricted
to the child directory without changing its meaning, adoption retains the configuration for
explicit conversion. Missing parents, cycles, and unsupported inherited settings also stop
adoption before any rules are carried.
Nested configurations retain their directory base. A nested negated selector requires
explicit conversion because moving it could exempt files outside that directory.
Overlapping Ruff configurations also require explicit conversion. Nonoverlapping nested spelling
configurations carry their locale, allowed words, and exclusions into a scope table. Native editor
configuration preserves directory selectors, basename patterns, and ordered negations.
Overlapping spelling configurations require explicit conversion because native child settings
replace parent settings while policy lists append. Nested secret allowlists, advisory exceptions,
and license settings stop adoption when their scope cannot be preserved.

### ESLint

ESLint adoption preserves ordered selectors, `basePath` directories, and processors. Named
processors retain their plugin names. Imported plugin, parser, and processor objects retain
module registrations, including nested exported members. Adoption recognizes static imports,
literal `require` calls, and top-level literal dynamic imports assigned to configuration values.
CommonJS registrations use default exports so generated configuration also runs under Node.
A registration names its `module`,
`export`, and optional `members` path. The export `"*"` refers to the module namespace. Selector bases remain relative to the
repository and apply to future files. Keep local executable modules in the repository. Exported
profiles omit entries that depend on repository paths or local executable modules.

Legacy ESLint configurations can extend other configurations. Adoption resolves inherited
rules, plugin environments, and extension processors through ESLint. Native override groups and
ignore patterns are stored as `legacyCriteria` and `legacyIgnores` under `tools.eslint.adopted`.
A root `.eslintignore` is captured and retired with the legacy configuration after conversion.
Standalone ignore files, nested ignore files, and ignore files beside flat configuration require
explicit conversion before adoption. Their selector bases remain relative to the repository.
Nested configuration uses native file
precedence and preserves `root: true` resets. Directory branches are stored as `legacyScope`.
Package-embedded configuration is captured while the shared manifest remains intact.

### Prettier and EditorConfig

Formatting adoption preserves JSON5 options, ordered Prettier overrides, and nested configuration
precedence. Selectors continue to apply to files created after initialization. Directory branches
exclude nested configurations, so a nested configuration resets unspecified parent options and
parsers. EditorConfig remains the native source for options that Prettier does not override.

EditorConfig sections are stored under `tools.editorconfig.adopted`. Its `directories` list stores
nested documents with repository-relative `basePath` values. Generation restores each document
at its native directory, preserving `root = true` and `unset` behavior.
`tools.prettier.native_defaults` lets Prettier resolve unspecified options through EditorConfig
and its native defaults. Profiles omit these repository-specific EditorConfig documents.

### Ignore files

SQLFluff and Semgrep ignore files retain their directory base, including nested files.
Nested Prettier ignore files and selectors that cannot be relocated without changing their
meaning stop adoption and leave the original configuration active.

## Keep existing integrations

Local executable hooks remain in the chain. Installation preserves their arguments, input,
and failure status without changing `core.hooksPath`. Tracked hooks require integration through
their hook manager. Configure [hooks and CI](/guides/hooks-and-ci/) before replacing that setup.

The proposal identifies potentially redundant lint scripts and tool dependencies for review.
Add tools without a preset as [custom checks](/guides/custom-checks/).

## Run the checks

After accepting the proposal, initialization writes configuration and installs selected tools
unless you pass `--no-install`. It runs no checks. Run `gspot check` to see findings.

To reverse recorded changes, follow [uninstall and recovery](/guides/uninstall/).
Keep local recovery data until restoration is complete.
