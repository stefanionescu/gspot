# Release notes

The newest version comes first. The release task copies the section of the version it publishes into the GitHub release.

## 0.3.0

`@gspothq/cli` 0.3.0 moves the files gspot writes into one folder per configuration, replaces the `[architecture]`
table with `[[import_rule]]` records, removes four checks and the `coverage` configuration, and rewrites the shipped
rules and the documentation. `@gspothq/eslint-plugin` stays at 0.2.0. Version 0.2.3 was never published; its fixes
are part of this release.

### Upgrade from 0.2

1. Install 0.3.0 with your package manager, such as `npm i -D -E @gspothq/cli@0.3.0`, or with
   `mise use --pin --tool-option allow_low_downloads=true npm:@gspothq/cli@0.3.0`.
2. Change `gspot.toml` for the breaking changes below: the `[architecture]` table, the `coverage` configuration,
   ignores of removed checks, `rules.exclude` paths, and limits or naming keys that gspot now refuses. gspot names each
   refused key.
3. Run `gspot apply`. It writes `.gspot/configurations/` and deletes the old files under `.gspot/config/` and
   `.gspot/rules/`.
4. Run `gspot install` and `gspot check`. Commit `gspot.toml`, `.gspot/`, and the other generated files that changed,
   together with `package.json` and its lockfile or `mise.toml`.

From 0.2.0 or 0.2.1, read the [0.2.2 notes](https://github.com/stefanionescu/gspot/releases/tag/v0.2.2) first.

### Files gspot writes

- Tool files and rules move from `.gspot/config/` and `.gspot/rules/` to `.gspot/configurations/<group>/<configuration>/`.
  Each tool file takes the name of its tool, such as `language/javascript/eslint.mjs`, the rules of a configuration sit
  in its `rules/` folder, and a scope that needs other text gets `scopes/<scope>/` there. Update `rules.exclude`, editor
  settings, and scripts that name the old paths.
- `prettier.config.mjs` holds one line that points at the generated Prettier file, in every repository.
- A root `.markdownlint.jsonc` replaces the `.markdownlint-cli2.mjs` pointer, so repositories without JavaScript get one
  too.
- gspot no longer writes `.semgrepignore`, the Vale styles that the level does not run, a `commit-msg` hook when no
  check runs in it, or the `Level:` line of the `AGENTS.md` section. `gspot init` no longer writes
  `tools.commitlint.scopes`.
- The `AGENTS.md` section lists the settings commands under one Commands heading, with `add` and `remove`.

### Settings

- `[architecture]` goes. Each `[[architecture.module]]` record becomes an `[[import_rule]]` record: `name` and `paths`
  keep their names, and `may_import` becomes `can_also_import`. The roles move to the configuration that reads them:
  `architecture.roles.environment_readers` becomes `structure.environment_readers`, `scripts` becomes
  `javascript.script_files`, `stores` becomes `zustand.store_files`, and `routers` becomes `trpc.router_files`. The new
  `trpc.server_files` names the files that other code may import as types only.
- The `coverage` configuration goes. Remove it from `configurations`. The `coverage` settings keep their names and
  belong to the `jest`, `vitest`, `pytest`, and `swift-tests` configurations.
- A language table under `limits` accepts only the limits that a check of that language reads; `limits.css` and
  `limits.html` go. A language table under `naming` accepts only the name categories that its parser reports.
- The value and the reason of each reasoned value have their own descriptions in the JSON Schema.

### Checks

- `bash/forwarders` and `xcode/xcconfig` go. Delete their ignores.
- `cloudflare/security-headers` merges into `cloudflare/headers`, which reports a missing header with the lint rule
  `missing-header`. Move its ignores.
- `dependencies/package-json` goes. At level `all`, `javascript/eslint` reports a missing `packageManager` with the
  lint rule `package-json/require-packageManager`.
- `structure/environment-readers` reports `read-outside-reader` in place of `read-outside-owner`.
- A comment that turns off every rule, such as a bare `eslint-disable`, gets the lint rule `eslint-all`, `ruff-all`, or
  `swiftlint-all` from `gspot/suppressions`.
- The `gspot doctor` JSON calls its list of existing lint jobs `lintJobs` in place of `written`.

### Fixes

- `gspot set` and `gspot unset` reach the settings of detected configurations, and say so when `gspot.toml` stays the
  same.
- `gspot explain` shows the defaults of a scope, and tells you to write record lists by hand.
- The JavaScript limits apply to JavaScript files; before, only `function_parameters` reached them.
- A migration that does not parse gives one finding, not nine.
- The heredoc rule no longer reports a heredoc that writes a data file.
- The Vale alt-text style reads markup files only.
- `gspot --help` lists the registered commands, and the command help marks code.
- The published JSON Schema describes every key and table.
- On Windows, stopping a process tree that `taskkill` reports late no longer fails.
- When the package manager version differs from the tool project, the error names the version it found.
- `jsdoc/match-name` reports only the `root0` placeholder, and the `AGENTS.md` section names the folders of a scoped
  rule without parentheses.

### Documentation

The site groups its pages into six sections: Getting started, Usage, Configuration, Languages, Checks, and Reference.
Old addresses redirect. New pages cover editors, environment variables, and the JSON output, and each check page shows
how to suppress one finding.

## 0.2.2

`@gspothq/cli` 0.2.2 fixes the upgrade path and the npm release hold. `@gspothq/eslint-plugin` stays at 0.2.0.

- npm release hold: `gspot apply` wrote `min-release-age-exclude` as one line per package, and npm keeps only the last of repeated keys. npm then refused a new `@gspothq/cli` version during the hold. gspot now writes `min-release-age-exclude[]=` lines, the list form npm reads. Run `gspot apply` to rewrite `.npmrc`.
- Upgrade from 0.1: `gspot apply` refused to replace `.editorconfig`, `eslint.config.mjs`, and the other files that gspot 0.1 generated, and showed the refusal as an internal error. gspot now recognizes the files of every earlier release.
- Agent rules: gspot writes the rules into `AGENTS.md` only. `gspot apply` removes the `@AGENTS.md` block that 0.2.0 and 0.2.1 wrote at the top of `CLAUDE.md`, keeps your own text, and deletes `CLAUDE.md` when the block was all it held.

To upgrade from 0.2.0 or 0.2.1 in an npm project during the first 7 days after this release, the old `.npmrc` still holds `@gspothq/cli` back. Run `npm i -D -E @gspothq/cli@0.2.2 --min-release-age=0` once, then `gspot apply` and `gspot install`. Read the [0.2.0 notes](https://github.com/stefanionescu/gspot/releases/tag/v0.2.0) when you upgrade from 0.1.

## 0.2.1

`@gspothq/cli` 0.2.1 fixes `gspot install` in the first days after a release. `@gspothq/eslint-plugin` stays at 0.2.0.

- `gspot install` failed in npm repositories that use the ESLint plugin while the plugin release was newer than `dependencies.min_release_age_days`. npm stopped with `ETARGET` for `@gspothq/eslint-plugin`. The release hold now applies only when gspot resolves the tool lockfile, where npm honors the exclude list. The install from the lockfile takes the versions it records.
- `gspot init` writes "1 pinned Python tool" instead of "1 pinned Python tools".

Upgrade from 0.2.0 with your package manager, for example `npm i -D -E @gspothq/cli@0.2.1`, then run `gspot install`. Read the [0.2.0 notes](https://github.com/stefanionescu/gspot/releases/tag/v0.2.0) when you upgrade from 0.1.

## 0.2.0

Both `@gspothq/cli` and `@gspothq/eslint-plugin` are 0.2.0. This release changes command flags, check IDs, settings, and generated files. Update references to the old names when you upgrade.

### New in 0.2.0

- Release hold: a new release waits `dependencies.min_release_age_days` days, 7 by default, before an install can pick it up. `gspot apply` writes the hold for each installer a folder uses: Bun (`bunfig.toml`), npm 11.17 or newer (`.npmrc`), pnpm 10.16 or newer (`pnpm-workspace.yaml`), Yarn 4.10 or newer (`.yarnrc.yml`), uv 0.9.17 or newer (`[tool.uv]` in `pyproject.toml`), and mise (`mise.toml`). A longer hold that a file already has stays. `@gspothq/cli` and `@gspothq/eslint-plugin` go on each exclude list. gspot installs its own tools in `.gspot/` with the same hold. Run `gspot apply` after upgrading and commit the changed files.
- `dependencies/release-age` reports a `packageManager` version too old to hold releases back.
- The generated GitHub Actions workflow gives mise the job's token, so its downloads from GitHub do not hit the lower rate limit of requests without a token.

### Upgrade from 0.1

Run `gspot apply` after upgrading to regenerate managed files. Then update your own scripts, settings, ignores, and rule-file references for the changes below that apply to you.

Commands and output:

- The CLI requires Node.js 24.15 or newer.
- Git hooks: use `gspot check --hook <pre-commit|pre-push|commit-msg> -- <hook arguments>`. Replace `--message-file` with `--hook commit-msg -- <file>`.
- Changed files: use `--changed [ref]` in place of `--changed --base <ref>`. `check --dry-run` requires `--fix`. Use `init --no-configurations` instead of `--configurations none`.
- `gspot apply --dry-run --json` names its list of stale files `stale` instead of `drift`.
- `apply` no longer adds configurations.
- `install` requires current generated tool files. Run `gspot apply` first when they are stale.
- `GSPOT_JOBS` no longer controls check concurrency.
- Outside a Git repository, gspot does not read `.gitattributes` to classify files.

Check IDs and lint rules:

- Renamed: `expo/doctor` → `expo/expo-doctor`, `html/validate` → `html/html-validate`, `dependencies/osv` → `dependencies/osv-scanner`, `naming/settings` → `naming/allowed-names`, `repository/tracked-files` → `repository/local-files`, `secrets/trufflehog` → `secrets/trufflehog-pushed`, `dependencies/lockfile-hosts` → `dependencies/lockfiles`, `structure/env-reads` → `structure/environment-readers`, `structure/file-lines` → `structure/long-files`, `gspot/unused-entries` → `gspot/unmatched-patterns`, `bash/wrappers` → `bash/forwarders`.
- Naming findings use the lint rule `banned-word` instead of `banned-term`. The lint rule `unused-entry` of `gspot/unmatched-patterns`, `licenses/allowed`, and `naming/allowed-names` is now `unused-record`. Update ignores that name them.
- `naming/allowed-names` runs at level `all` only. Exported JavaScript and TypeScript forwarders with one importing file get checked at level `all`. Ruff `RUF022` runs at level `recommended` and `PLR0915` at level `all`.
- `nextjs/next-config` is replaced by shipped Semgrep lint rules under `security/semgrep` at the push stage.
- ESLint: replace `gspot/header-first` with `gspot/no-comments-in-imports`. The rule reports comments in an import block and file headers after it. Comments that lead the next declaration stay valid. Tool directives are allowed after the last import; a directive between imports gets reported without an automatic fix.
- `typescript/tsc` checks with your own compiler options.
- Removed checks. Delete these check IDs from `gspot.toml`: `gspot/settings`, `dependencies/bun-release-age`, `bash/ssh-blocks`, `nextjs/version-pairs`, `react/version-pairs`, `site/build-reproducible`, `dependencies/stale-lockfile`, `docs/readme-shape`, `python/export-order`, `python/function-size`, `python/exports-at-bottom`, `python/singletons`, `python/pyproject`, `python/module-getattr`, `python/package-exports`, `python/private-prefix`, `drizzle/relations`, `cloudflare/wrangler`, `supabase/project-file`, `supabase/migration-names`, `nextjs/route-segments`, `nextjs/build`, `bash/bash-syntax`, `bash/bats-syntax`, `bash/variable-defaults`, `bash/include-guards`, `bash/source-order`, `bash/private-prefix`, `files/taplo`, `github-actions/pinact`, `site/linkinator-external`, `site/svgo`, `site/webmanifest`, `security/codeql`, `sql/functions`, `html/template-text`, `gspot/settings-format`, `secrets/gitleaks-files`, `xcode/symlinks`, `xcode/test-plans`, `swift-tests/sleep`, `swift-snapshot-testing/recording`, and `swift-snapshot-testing/references`. The `swift-snapshot-testing` configuration is removed too.
- Remove ignores for `translations/messages` `dotted-key`, `bash/wrappers` `wrapper-name`, `xcode/files-without-target` `missing-file`, and `dependencies/package-json` `private-root` and `package-manager` in workspace packages.

Settings:

- Structure limits name their units: `function_statements`, `function_branches`, `function_returns`, `function_assignments`, `block_nesting`, `trivial_function_statements`, and `shared_prefix_files`.
- Limits for repository file size, prose, and duplication move to the `repository`, `prose`, and `duplication` tables.
- Use `dependencies.bun_scanner`, `secrets.environment_functions`, `coverage.swift_target`, `naming.<language>.folders`, and `swift.xcode_project`, `swift.xcode_scheme`, and `swift.xcode_destination`.
- Architecture module record order sets the layer order; `may_import` lists exceptions.
- Removed settings. Delete them from `gspot.toml`: `rules.instruction_files`, `limits.duplicate_percent`, `limits.docs.headings_before_contents`, `tools.svgo.min_saving_percent`, `tools.codeql.languages`, `html.templates`, `limits.python.function_lines`, `limits.python.index_exports`, `limits.sql.function_parameters`, `limits.sql.min_function_statements`, and `when = { git = false }` in `command_check` records.

Generated files:

- gspot writes `AGENTS.md` and a one-line `@AGENTS.md` block in `CLAUDE.md`.
- `apply` replaces generated files it owns and leaves settings it stops managing in shared files. Merge markers get reported as changed files.
- gspot finds the files it owns from `.gspot/`, generated headers, and the managed `.gitattributes` block. It no longer reads or writes an ownership log.
- Generated ignore files and tool exclusions use the same ordered sections. Scoped tool files share one copy for each distinct text.
- Each language's `NAMING.md` rule file merges into its main rule file: `.gspot/rules/language/<language>/NAMING.md` moves into `JAVASCRIPT.md`, `TYPESCRIPT.md`, `BASH.md`, `CSS.md`, `HTML.md`, `PYTHON.md`, `SQL.md`, or `SWIFT.md`. Update your own links to the removed paths.

Configuration manifests, for custom configurations:

- Manifests use `shared_prefixes`, `ruff`, and `generator_outputs` instead of `prefix_collisions`, `ruff_rules`, and `generated_paths`.
- Manifests use `replace` file lists and `replace_key` records, and `tool_file` source paths come from `tool-files/`. ESLint runtime data carries package and version metadata.

Documentation and this repository:

- Guide URLs move from `/guides/` to task routes. The old URLs redirect with a 301.
- Contributors: the mise tasks `build:docs` and `serve:docs` are now `docs:build` and `docs:serve`. Use `mise run test integration` and `mise run test e2e` in place of `test:integration` and `test:e2e`; `mise run test` runs the unit tests.

The documentation is at [generativespotting.com](https://generativespotting.com). The unversioned settings schema is
[gspot.schema.json](https://generativespotting.com/gspot.schema.json).
