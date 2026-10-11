# Language, database, framework, library, platform, infrastructure, and testing checks

These are the built-in checks that gspot runs in its own TypeScript code for one configuration each: the Bash
script checks, the Python `__all__` and module checks, the PostgreSQL migration checks, Next.js, Svelte, Expo,
Drizzle, translations, Swift builds and tests, Cloudflare, Supabase, Docker, nginx, GitHub Actions, and Xcode. Each
check gets the files of one scope and returns findings; its ID is declared in a configuration manifest and wired to
its function in the check table. The target: one source folder per configuration group with the same name as the
group, files and exports named after their checks, fixed values in `config/` and types in `types/`, one shared
function for each repeated step, and no guard for a state the manifests or callers already rule out.

## Findings

### CKO-001: Bash function size runs a second parser (ast-grep) to count what the first parser already read

- Where: `packages/cli/src/checks/language/bash/function-size.ts:16-90`;
  `packages/cli/configurations/language/bash/ast-grep/assignments.yml`, `branches.yml`, `nesting.yml`;
  `packages/cli/configurations/language/bash/manifest.toml:1` (word list), `:54-61` (`[[tool]] ast-grep`),
  `:201` (`tool = "ast-grep"`); `packages/cli/src/parsers/schema/ast-grep.ts`;
  `packages/cli/src/types/checks/language/bash.ts:20-24` (`AstGrepMatch`, `BashCountRule`);
  `packages/cli/src/config/checks/language/bash.ts:93-100` (`COUNT_RULES`, `OUTER_LEVELS`);
  `packages/cli/src/platform/root/public.ts:137` (doc example); `tests/cli/checks/language/bash/function-size.test.ts`;
  the PATH lists in `tests/harness/repository.ts:70`, `tests/tools/commands/add-remove-configurations.test.ts:30`,
  `tests/tools/commands/template.test.ts:15`, `tests/tools/lifecycle/shared-tools.test.ts:117`
- Kind: delete
- Problem: `parseBashScript` already parses every Bash file with tree-sitter and walks each `function_definition`
  (`parsers/bash/public.ts:217-240`). Then `functionSize` starts the external `ast-grep` program three times, once
  per count, to find the same node kinds with the same tree-sitter Bash grammar. So gspot pins, installs, batches
  arguments for (with a per-OS command line limit), runs, and schema-checks a whole extra tool for counts it can
  read from the tree it already holds. No other check uses ast-grep.
- Fix: In `parseBashScript` (`parsers/bash.ts`), add `branches`, `nesting`, and `assignments` to each function,
  counted from the function node with the node kinds the three YAML rules list (`if_statement`, `elif_clause`,
  `case_item`, `while_statement`, `for_statement`, `c_style_for_statement`; and `variable_assignment` outside
  `declaration_command` and outside the three parts of a C-style `for` loop). In `function-size.ts`, compare the
  counts with `limits.branches`, `limits.nesting`, and `limits.assignments` for Bash. Keep the count table as
  `COUNT_LIMITS = [{ limit: 'branches', noun: 'branches' }, { limit: 'nesting', noun: 'levels of nesting' }, { limit: 'assignments', noun: 'assignments' }] as const` in `config/checks/language/bash.ts`, with no type annotation, so
  `config/` imports nothing from `types/`. Delete `runAstGrep`, `nestingDepth`, `countFindings`, the three YAML files,
  the ast-grep `[[tool]]` entry and `tool = "ast-grep"`, `parsers/schema/ast-grep.ts`, `AstGrepMatch`,
  `BashCountRule`, `OUTER_LEVELS`, and the ast-grep batching tests (keep one test per count). Remove `ast-grep` from
  the word list of the Bash manifest and from the PATH lists of the four test files above.
- Size: medium

### CKO-002: translations/locales fails every next-intl project that has not set a messages folder

- Where: `packages/cli/src/checks/library/translations.ts:35-57`;
  `packages/cli/configurations/library/translations/manifest.toml:20-36`
- Kind: fix-bug
- Problem: the setting `translations.messages_folder` defaults to `""`. The code keeps files where
  `path.startsWith(`${directory}/`)`, which is `startsWith('/')` for an empty folder, so no file matches. Then no
  base locale is found, and the check reports "The base locale en.json is missing from ." on every project that
  depends on next-intl. The doc comment says the opposite: "With no folder named the check passes." The manifest
  has only `when = { dependencies = ["next-intl"] }`.
- Fix: In the manifest, write `when = { dependencies = ["next-intl"], setting = "translations.messages_folder" }`
  on the check (ID `translations/messages`), so the planner skips it with "requires project setting" until the
  folder is set, the same way `xcode/entitlements` waits for its setting. The setting has no default: absent means
  unset (TML-010). Delete the sentence "With no folder named the check passes."
- Size: small

### CKO-003: postgres/rls promises a policy check that the code does not do

- Where: `packages/cli/configurations/database/postgres/manifest.toml:69,73`;
  `packages/cli/src/checks/database/postgres/access.ts:46-66`; `packages/cli/src/checks/database/postgres/contracts.ts:130-141`
- Kind: rewrite-text
- Problem: the summary says "enables row level security and has a policy in some migration". The code only
  checks `ENABLE ROW LEVEL SECURITY`. The schema reader never reads `CREATE POLICY` (its readers are `DropStmt`,
  `CreateStmt`, `AlterTableStmt`, `IndexStmt`). A user trusts a check that is not there.
- Fix: change the summary of `postgres/row-level-security` to "Checks that every table in a client schema turns on
  row level security." and drop "define its intended policies" from the example. Row security with no policy
  denies all access, which is the safe side, so no new code is needed.
- Size: small

### CKO-004: File names `public.ts` and `contracts.ts` hide which configuration the code belongs to

- Where (all under `packages/cli/src/checks/`): `framework/public.ts` (all Next.js), `framework/contracts.ts` (all
  Svelte), `platform/public.ts` (all Supabase), `tool/public.ts` (nginx and actionlint), `tool/contracts.ts` (all
  swift-tests), `language/public.ts` (TypeScript checks and pydoclint), `language/contracts.ts` (TypeScript copy
  steps and the Bash script reader), `language/swift/public.ts` (build folder), `language/swift/contracts.ts`
  (build, analyzer, Periphery), `database/postgres/public.ts` (migration reader and migration-docs),
  `database/postgres/contracts.ts` (schema builder)
- Kind: rename
- Problem: a newcomer cannot guess what is inside. Commit `9a3851a9a` (2026-10-08) gave these files their names to
  pass a generated ESLint rule that lets tests import only files named `public.*` or `contracts.*`. All 25 test
  imports of these check files point at one of them, so they fail lint after a rename unless that rule goes first.
- Fix: Do after TML-001, which deletes the test-import rule (the third entry of `ROLE_IMPORT_POLICIES`). Then
  rename and split:
    - `framework/public.ts` -> `framework/nextjs.ts` (its `sourcePaths` merges into `checks/finding.ts`, CKO-038);
      `framework/contracts.ts` -> `framework/svelte.ts`

    - `platform/public.ts` -> `platform/supabase.ts`
    - `tool/public.ts` -> `infrastructure/nginx.ts` (the nginx config test and its copy steps) and
      `infrastructure/github-actions.ts` (actionlint and the `$/` rewrite)

    - `tool/contracts.ts` -> `testing/swift-tests.ts` (CKO-005)
    - `language/public.ts` -> `language/typescript/tsc.ts` (`tsc`, `javascriptTsc`), `language/typescript/tsconfig.ts`
      (`typescriptTsconfig`), and `language/python/pydoclint.ts` (`pydoclint`, `docstringConfiguration`,
      `sourceStyle`, `docstringGroups`)

    - `language/contracts.ts` -> `language/typescript/project.ts` (`runTsc`, `projectChecked`, `appendBuildMetadata`,
      `restoreCommandPaths`, `CHECKED_PROJECTS`), `language/typescript/tsc.ts` (`scopeCompilerProject`), and
      `language/bash/scripts.ts` (`readScripts`, `readScript`, `functionAt`); DEC-008 deletes the rest

    - `language/swift/public.ts` -> `language/swift/build-folder.ts`; `language/swift/contracts.ts` ->
      `language/swift/build.ts`

    - `database/postgres/public.ts` -> `database/postgres/migrations.ts` (`readMigrations`, `parseMigrations`; its
      migration-docs part is deleted, CKO-041); `database/postgres/contracts.ts` -> `database/postgres/schema.ts`

    ARC-002 is the same rename for the whole source tree.

- Size: medium

### CKO-005: The source folder `checks/tool/` does not match the configuration groups

- Where: `packages/cli/src/checks/tool/` (ansible.ts, docker.ts, public.ts, contracts.ts, xcode/),
  `packages/cli/src/config/checks/tool/`, `packages/cli/src/checks/language/swift/coverage.ts`
- Kind: move
- Problem: the configurations live in `configurations/infra/{ansible,docker,github-actions,nginx,xcode}` and
  `configurations/test/swift-tests`. The code for them lives in `checks/tool/`. Every other group (database,
  framework, language, library, platform) uses the same name in both places, so a reader looking for the Docker
  code does not look in `tool/`. The Swift coverage code sits in `language/swift/`, but only the swift-tests check
  calls it (`measureCoverage`, one caller at `tool/contracts.ts:146`). An untracked, empty `configurations/tool/`
  folder tree is left in the working copy.
- Fix: Use the group names `infrastructure` and `testing` (NMU-009 renames the configuration folders the same way).
  Move `checks/tool/` to `checks/infrastructure/` (`ansible.ts`, `docker.ts`, `nginx.ts`, `github-actions.ts`,
  `xcode/`), `tool/contracts.ts` to `checks/testing/swift-tests.ts`, and `language/swift/coverage.ts` to
  `checks/testing/coverage.ts`. The config files follow (CKO-008). Rename the unit test folders of these checks the
  same way, under the group names `infrastructure/` and `testing/`. Delete the empty `configurations/tool/` folders
  from the working copy.
- Size: small

### CKO-006: Wrong variable name `isToolProject` means "the name starts with an underscore"

- Where: `packages/cli/src/checks/language/bash/visibility.ts:27-37`
- Kind: rename
- Problem: `const isToolProject = entry.name.startsWith('_')` reads as "this is a tool project". It means "this
  function is private". Commit `0efd033dc` changed `isPrivate` to `isToolProject` in a search-and-replace that
  renamed `isPrivateToolPath` to `isToolProjectPath`.
- Fix: rename it back to `isPrivate` in the Bash check (`bash/private-prefix.ts`). The same rename in
  `execution/copy/contracts.ts:247` is correct there (that code is about the `.gspot` tool project) and stays.
- Size: small

### CKO-007: Named values are still written inline in check code, and two config files import types

- Where: the 18 config files `packages/cli/src/config/checks/{framework,language,platform,tool}/*.ts`,
  `config/checks/postgres.ts`, `config/checks/swift-snapshot-testing.ts`; the 8 type files under
  `packages/cli/src/types/checks/` outside `general/`; inline values in the check files, for example
  `bash/ssh.ts:17`, `html.ts:132`, `tool/public.ts:94,113`; `config/checks/postgres.ts:1`,
  `config/checks/language/bash.ts:1`, `types/checks/language/bash.ts:1,3`
- Kind: move
- Problem: these checks follow the `config/` and `types/` rule unevenly. File names, tags, command arguments, and
  regular expressions are still written inline in many check functions. `'main'` is written by hand in five places
  next to the one-item list `ENTRY_FUNCTIONS = ['main']`. Some config values carry vague or wrong names, or sit in a
  file that only one of their readers belongs to. And two config files import a type to annotate a value
  (`MigrationStatement`, `BashCountRule`), and one types file imports zod and a parser schema, which breaks the rule
  that `config/` imports only `config/` and `types/` imports only `config/` and `types/`.
- Fix: Keep `config/` and `types/` (the repository rule; the `AGENTS.md` paragraph stays). Move every named value written
  inline in these checks into the config file of its group (paths in CKO-008): file and folder names, paths,
  suffixes, URLs, program names and command arguments, numbers, regular expressions, lists, lookup tables, check
  IDs, file tags, and role names. Leave in the code: messages, rule IDs, setting names read through `options()` and
  `limit()`, tree-sitter node types and other format words compared once (`'__getattr__'`, `'[emerg]'`, `'Broken contracts'`, the Drizzle call names), scratch folder prefixes, and obvious literals. The memo keys
  (`MIGRATION_MEMO`, `COMMITTED_MIGRATIONS_MEMO`, `SCRIPT_MEMO`, `CHECKED_PROJECTS`, `BUILD_MEMO`) and the function
  tables `ALTERATIONS` and `READERS` in `postgres/schema.ts` stay in their modules: they hold code. Ten existing
  values keep a place in `config/` with these final names and homes:
    - `READONLY_WORD` and `SHARED_PREFIX` stay as they are.
    - `ENTRY_FUNCTIONS` becomes the string `MAIN_FUNCTION = 'main'` in `config/checks/language/bash.ts`, read by
      script-layout (twice), doc-comments, unused-functions, and private-prefix.

    - `SCRIPT_TAG` moves to `config/repository/inventory.ts` beside the other file tags (CKO-009).
    - `PYTHON_MANIFEST` becomes `PYPROJECT_TOML` in `config/parsers/dependency-files.ts`.
    - `PACKAGE_FILE` (`config/checks/language/python.ts:22`), `WORKSPACE_SUFFIX` (`config/checks/language/swift.ts:5`), and `NGINX_MAIN` (`config/checks/tool/nginx.ts:1`) become `INIT_PY`, `XCODE_WORKSPACE_SUFFIX`, and `NGINX_CONF` (in `config/checks/infrastructure/nginx.ts`): "package file" is a retired name for a dependency file and the value is `__init__.py`, "workspace" alone means only npm workspaces, and a file-name constant carries the real file name. The Expo error "Manifest is missing: package.json" (`checks/framework/expo.ts:30`) calls `package.json` a manifest, a word the glossary keeps for `manifest.toml`; it becomes "package.json is missing: <path>". `ANSIBLE_PROJECT_FILE` becomes `ANSIBLE_CFG`.
    - `PARSED_DIALECTS` becomes `PARSED_DIALECT = 'postgres'` (CKO-021).

    Config values carry no type annotation (`as const`); every exported type is written by hand in `types/`. The
    four imports that break the rule today go with CKO-001 (`BashCountRule`, `AstGrepMatch` with its zod and
    `matchSchema` imports) and CKO-041 (`MigrationStatement`).

- Size: large

### CKO-008: The config and types files of these checks follow four layouts

- Where: `config/checks/postgres.ts` and `config/checks/swift-snapshot-testing.ts` (top level, while the code is
  in `checks/database/postgres/` and `checks/library/`); `types/checks/{cloudflare,docker,nginx,postgres}.ts` (top
  level) next to `types/checks/language/*.ts` (grouped); `config/checks/tool/{nginx,github-actions,swift-tests}.ts`
  mirror source files that do not exist; `config/checks/framework/nextjs.ts` mirrors `checks/framework/public.ts`.
  All under `packages/cli/src/`.
- Kind: move
- Problem: the "flatten a one-file folder" rule and the "mirror the source" rule pull in opposite directions, so a
  reader cannot predict where a constant lives.
- Fix: Config: one file per configuration under `config/checks/<group>/` for framework, infrastructure, language,
  and platform; one flat file for the groups with one configuration or a few small values:
  `config/checks/database.ts`, `config/checks/library.ts` (Drizzle, swift-snapshot-testing, translations), and
  `config/checks/testing.ts`. Types: one file per group, `types/checks/{database,infrastructure,language,platform, testing}.ts`. The full list is in "Layout" below.
- Size: small

### CKO-009: Language config files hold values that general checks read

- Where: `config/checks/language/python.ts:18` (`IMPORTS`) and `:27` (`DIRECTIVE`);
  `config/checks/language/swift.ts:1` (`FILE_LOCAL`), `:3` (`ENVIRONMENT_READ`), `:17` (`DIRECTIVE`);
  `config/checks/language/bash.ts:108` (`SCRIPT_TAG`), `:111` (`SHELLCHECK_DIRECTIVE`)
- Kind: move
- Problem: these live in language files, but their readers are general checks. `IMPORTS` and `ENVIRONMENT_READ`
  are read only by `checks/general/structure/env-owner.ts`; both `DIRECTIVE`s only by
  `structure/import-comments.ts`; `FILE_LOCAL` only by `structure/private-before-public.ts`; `SCRIPT_TAG` by
  `checks/general/public.ts` and the Bash script reader; `SHELLCHECK_DIRECTIVE` by `import-comments.ts` and
  `bash/doc-comments.ts`. Two different constants are both named `DIRECTIVE`.
- Fix: Move `IMPORTS` as `PYTHON_IMPORT_NODES` and `ENVIRONMENT_READ` as `SWIFT_ENV_READ` into
  `config/checks/general/structure.ts`, beside the check `structure/env-reads`. Delete both `DIRECTIVE`s and
  `FILE_LOCAL` with their only readers (CKG-055 deletes `structure/import-comments` and
  `structure/private-before-public`). Move `SCRIPT_TAG` (same name) to `config/repository/inventory.ts` beside the
  other file tags. Rename `SHELLCHECK_DIRECTIVE` to `SHELLCHECK_TOOL_COMMENT`; it stays in
  `config/checks/language/bash.ts` for its one reader left, `bash/doc-comments`.
- Size: small

### CKO-010: The "run once per group and merge the results" loop is written three times, with different bugs

- Where: `packages/cli/src/checks/language/bash/shellcheck.ts:20-36`;
  `packages/cli/src/checks/language/public.ts:226-248` (pydoclint); `packages/cli/src/checks/tool/docker.ts:231-251` (compose)
- Kind: merge
- Problem: three copies of one loop: start from `emptyResult`, run the command for each file group, add findings
  and duration, stop on a tool error. They differ: compose returns only the failing group's result and drops the
  findings of earlier groups; shellcheck and pydoclint keep them. pydoclint also has a special path
  `if (groups.size === 1) return result;`. shellcheck tests `['passed','failed']`, while pydoclint tests
  `RAN_STATUSES`.
- Fix: add one function `runCommandGroups(session, planned, groups: { files, command }[])` in
  `execution/command/check.ts` beside `runCheckTool`; it keeps earlier findings on an error. Use it in `shellcheck`,
  `pydoclint`, and `dockerCompose`, and delete the three loops and pydoclint's one-group shortcut.
- Size: small

### CKO-011: "Tool failed but printed no findings" is written eight times, with eight messages

- Where: `checks/framework/contracts.ts:66-67`, `checks/framework/expo.ts:51-52`,
  `checks/language/python/imports.ts:57-60`, `checks/language/swift/contracts.ts:97-100,118-119,148`,
  `checks/platform/public.ts:53-54`, `checks/tool/ansible.ts:32-35`
- Kind: merge
- Problem: every check that runs an outside tool repeats `if (result.code !== 0 && findings.length === 0) throw ...`,
  each with its own wording (some use `toolOutputDetail`, some `stderr.trim()`, some the whole output).
- Fix: one function `toolFindings(result, findings, toolName)` beside `toolOutputDetail` in
  `execution/command/output.ts`: it returns the findings, and throws one tool error with the tool output when the
  tool failed and printed none. Replace the eight copies.
- Size: small

### CKO-012: Comment filters on Bash code that the parser has already blanked

- Where: `checks/language/bash/contract.ts:90` and `bash/wrappers.ts:24` (`!line.code.startsWith('#!')`);
  `bash/embeds.ts:15` and `bash/guards.ts:21` (`line.trimStart().startsWith('#')`)
- Kind: delete
- Problem: `parseBashScript` replaces every tree-sitter `comment` node with spaces before it fills `file.code`
  (`maskComments`, `parsers/bash/public.ts:47-60, 220-222`). The shebang is a comment node too: parsing
  `#!/usr/bin/env bash\n# hi` with the pinned grammar returns both lines as `comment` nodes. So these filters guard
  a state that cannot happen. Their only remaining effect is to skip heredoc body lines that start with `#`, which
  nobody intended.
- Fix: delete the four filters (in `bash/script-layout.ts`, `bash/wrappers.ts`, `bash/inline-scripts.ts`, and
  `bash/variable-defaults.ts`).
- Size: small

### CKO-013: Guards for states the shipped configurations rule out

- Where:
    - `checks/language/public.ts:117-121`: "The javascript configuration declares no .gspot/config/jsconfig.json
      target." (`configurations/language/javascript/manifest.toml:457` always declares it)

    - `checks/framework/public.ts:125-126`: "The Next.js compiler check requires typescript/tsc." (the nextjs
      configuration `requires = ["typescript", "react"]`)

    - `checks/tool/ansible.ts:49-50`: "The ansible-lint check has no declared command." (the manifest declares it)
    - `checks/language/bash/function-size.ts:38`: "The ast-grep report names an unselected file" (goes with CKO-001)
    - `checks/database/postgres/history.ts:29` and `checks/tool/xcode/project.ts:122`: "A requested Git blob was not
      returned." (`parseGitBlobs`, `parsers/contracts.ts:121-137`, yields every requested hash or throws, so
      `getBlobs` always holds them all)

    - `checks/language/contracts.ts:159`: `writeScopeProject` returns early on no inputs; its only caller `checkjs`
      already returned on the same test at `language/public.ts:116`

    - `checks/tool/docker.ts:130-131`: "Trivy returned an inconsistent image report" (with `--scanners vuln,secret`
      the parsed findings are the whole report); its test row "a failing exit without findings"
      (`tests/config/cli/checks/tool/docker.ts:36-42`, run by `REPORT_FAILURES` in `tests/cli/checks/tool/docker.test.ts:64`)

    - `checks/tool/public.ts:116-117`: "The nginx run produced no configuration dump"

- Kind: delete
- Problem: each adds a branch and an error message for a case that the manifests or the callers already exclude.
  Most exist only because TypeScript sees a possibly missing value (`.find()`, `Map.get`, the optional `command`
  field) and the repository forbids the `!` shortcut (`@typescript-eslint/no-non-null-assertion` is on), so removing
  them means building the value another way, not plain deletion.
- Fix: remove each guard by giving TypeScript a defined value. For `javascriptTsc`, use the fixed target
  `.gspot/config/jsconfig.json` (`TOOL_FILE_DIRECTORY` and `JSCONFIG_FILE`). Make `readBlobs` (today `getBlobs`)
  return the buffers in request order, so callers need no lookup. For ansible-lint, use CKO-037, or read the command
  where its type is not optional. The `writeScopeProject` early return goes when CKO-023 inlines it. Delete the
  Trivy test row with the Trivy guard. Keep the two "The command was canceled." checks before `prepareBuild`
  (`swift/contracts.ts:57`, `tool/contracts.ts:144`): Ctrl-C can arrive after the run started, and they stop a full
  source copy.
- Size: small

### CKO-014: Skips written in code that the manifest `when` table already expresses

- Where: `checks/framework/expo.ts:31-32` (no expo dependency); `checks/language/html.ts:178-179` (empty
  `html.templates`); `checks/tool/xcode/project.ts:107` (`!input.hasGit`)
- Kind: simplify
- Problem: the planner already skips a check by `when = { dependencies, setting, git, configuration }`
  (`parsers/schema/configurations.ts:148-151`; `planning/contracts.ts:24-43, 58-65`). These checks repeat that in
  code, and two of them pass silently instead of showing a clear skip. The same feature already serves
  `xcode/entitlements` (`when = { setting = ... }`) and the secrets checks (`when = { git = true }`).
- Fix: add `when = { dependencies = ["expo"] }` to `expo/doctor`, `when = { setting = "html.templates" }` to
  `html/template-text`, and `when = { git = true }` to `xcode/symlinks`; delete the three code branches and the doc
  sentence "With no template files the check passes" (`html.ts:173`). CKO-002 does the same for translations.
- Size: small

### CKO-016: Swift has dead Periphery commands and a one-file export

- Where: `config/checks/language/swift.ts:26` and `:34` (`periphery` entries of `PACKAGE_COMMANDS` and
  `XCODE_COMMANDS`); `checks/language/swift/contracts.ts:129`; `checks/language/swift/public.ts:165`
  (`prepareBuildSources`)
- Kind: delete
- Problem: `swiftPeriphery` calls `buildPlan(input, 'periphery')` only to read `folder`; the computed build command
  is thrown away, so the two `periphery` command lists are never used. `prepareBuildSources` is exported but used
  only inside its own file.
- Fix: delete both `periphery` command entries; give `buildPlan` only the build purposes, and let `swiftPeriphery`
  (`swift/build.ts`) call `scopeBuildFolder(input, 'periphery')` (`swift/build-folder.ts`, stays exported for this
  call) after the same "project or Package.swift" skip; inline `prepareBuildSources` into `prepareBuild`.
- Size: small

### CKO-017: Windows path branches in checks that never run on Windows, and a CRLF branch after CRLF is removed

- Where: `config/checks/language/swift.ts:8` (`DIAGNOSTIC`, `(?:[A-Za-z]:)?[/\\]`), `:10` (`RESPONSE_FILE`,
  `(?:[A-Za-z]:[\\/]|[\\/])`); `checks/tool/public.ts:113` (`\r?$`)
- Kind: simplify
- Problem: the Swift build, analyzer, and Periphery checks run only on macOS or Linux
  (`configurations/language/swift/manifest.toml:123,136,150`), so drive letters and backslashes never appear.
  `runCheckTool` already turns CRLF into LF before the nginx pattern runs (`execution/command/public.ts:292-296`).
  No test feeds a drive letter or a CRLF line to these patterns.
- Fix: `MESSAGE_LINE = /^(?<file>\/[^\r\n]+?):.../u` (today `DIAGNOSTIC`), `RESPONSE_FILE = /@(?<path>\/\S+)/gu`,
  and `$` instead of `\r?$` in the nginx `CONFIGURATION_DUMP_LINE`. Keep the macOS `/private/tmp` rewrite
  (`swift/contracts.ts:82-85`); it is real.
- Size: small

### CKO-018: File names and check IDs do not match

- Where (all under `packages/cli/src/checks/`): `language/bash/visibility.ts` -> check `bash/private-prefix`;
  `bash/sources.ts` -> `bash/source-order`; `bash/ssh.ts` -> `bash/ssh-blocks`; `bash/guards.ts` holds
  `bash/guards` and `bash/variable-defaults`; `bash/contract.ts` -> `bash/contract`; `bash/embeds.ts` ->
  `bash/embeds`; `language/python/functions.ts` -> `python/placeholder-docstrings`; `python/imports.ts` ->
  `python/import-linter`; `python/deptry.ts` holds `python/deptry` and `python/pip-installs`; the check table
  `checks/public.ts:94-221`
- Kind: rename
- Problem: to find the code of a check, a reader has to search the check table. Some check IDs also do not say what
  they check: `bash/contract` (shebang, strict mode, main called last), `bash/guards` (include guards), `bash/embeds`
  (inline scripts), `python/lazy-exports` (a module `__getattr__`), `postgres/rls`, `postgres/migrations-frozen`,
  `xcode/ats`, `translations/locales`.
- Fix: Rename these check IDs in the manifests, the check table, tests, docs, and `gspot.toml`: `bash/contract` ->
  `bash/script-layout`, `bash/guards` -> `bash/include-guards`, `bash/embeds` -> `bash/inline-scripts`,
  `python/lazy-exports` -> `python/module-getattr`, `postgres/rls` -> `postgres/row-level-security`,
  `postgres/migrations-frozen` -> `postgres/edited-migrations`, `xcode/ats` -> `xcode/app-transport-security`,
  `translations/locales` -> `translations/messages` (NMU-022 renames the two `xcode/orphan-*` IDs; CKO-021 renames
  `sql/trivial-functions`). Name one file per check: `bash/private-prefix.ts`, `bash/source-order.ts`,
  `bash/ssh-blocks.ts`, `bash/script-layout.ts`, `bash/inline-scripts.ts`, `bash/include-guards.ts` and
  `bash/variable-defaults.ts` (split from `guards.ts`), `python/import-linter.ts`, and `python/pip-installs.ts`
  (split from `deptry.ts`). `python/functions.ts` merges into `python/modules.ts` (CKO-022). Export names follow
  CKO-019.
- Size: small

### CKO-019: Export names collide and are vague, so the check table renames them on import

- Where: `packages/cli/src/checks/public.ts:1-90` (the check table, 18 imports with `as`, and `BUILT_IN_CALCULATIONS`) and the check files; exports `functionSize` (bash and python),
  `privatePrefix` (bash and python), `trivialFunctions` (sql and general structure), and vague names `relations`,
  `scripts`, `literals`, `headers`, `redirects`, `wrangler`, `contract`, `guards`, `safety`, `locales`, `ats`,
  `symlinks`, `contentsFindings`
- Kind: rename
- Problem: the same word means different checks in different files, and the check table needs 18 `as` aliases to
  tell them apart (drizzleRelations, sqlTrivialFunctions, pythonSingletons, pythonImportLinter, bashFunctionSize,
  pythonLazyExports, htmlScripts, htmlLiterals, pythonPipInstalls, pythonFunctionSize, pythonPlaceholderDocstrings,
  cloudflareHeaders, cloudflareWrangler, cloudflareRedirects, pythonExportOrder, pythonPrivatePrefix,
  pythonPackageExports, pythonExportsAtBottom); in all, 22 of the 38 `import { x as y }` renames in the source exist only to add the configuration prefix the export lacks. Eight general exports also differ from their check IDs, for example `manifests` (`dependencies/package-json`, which also hides its own name with a local `manifests`), `lockfileFresh` (`dependencies/stale-lockfile`), `licensesPackages` (`licenses/allowed`), `nginxTest` (`nginx/config-test`), and `generatedCode`, which serves four stale-output checks.
- Fix: name each export after its final check ID (CKO-018), configuration first: for example `bashFunctionSize`,
  `pythonFunctionSize`, `bashPrivatePrefix`, `pythonPrivatePrefix`, `bashScriptLayout`, `bashIncludeGuards`,
  `bashInlineScripts`, `pythonModuleGetattr`, `sqlFunctions`, `drizzleRelations`, `htmlScripts`, `htmlTemplateText`,
  `cloudflareHeaders`, `cloudflareRedirects`, `cloudflareWrangler`, `postgresRowLevelSecurity`,
  `postgresEditedMigrations`, `translationsMessages`, `xcodeAssets`, `xcodeAppTransportSecurity`, `xcodeSymlinks`.
  Exports named after their tool keep that name (`shellcheck`, `deptry`, `pydoclint`, `importLinter`, `tsc`,
  `svelteCheck`, `expoDoctor`, `ansibleLint`, `trivyImage`). The swift-snapshot-testing exports keep `recording`
  and `references`, because "snapshot" is a shipped banned term. A check of a `general` configuration takes the check name alone (`packageJson`, `staleLockfile`, `allowedLicenses`). Rename `BUILT_IN_CALCULATIONS` to `CHECK_FUNCTIONS` in `checks/built-in.ts` and delete every `as` in it, so a search for a check ID finds its function.
- Size: small

### CKO-020: Two styles for writing a check

- Where: 11 of the 13 files in `checks/language/bash/` (all but `function-size.ts` and `shellcheck.ts`) and 6
  general files (`general/naming/identifiers.ts`, `general/structure/{lone-files,stem-collisions,test-placement, folder-names,prefix-collisions}.ts`) use `export const x: BuiltInCheck = async (input) => ...`; every other check
  file uses `export async function x(input: CheckInput): Promise<Finding[]>`.
- Kind: simplify
- Problem: two ways to write the same thing.
- Fix: write these 17 checks as `export async function` like the rest. A general check that another finding
  deletes needs no change.
- Size: small

### CKO-021: sql/trivial-functions also checks parameter counts, and its code is thin

- Where: `checks/language/sql.ts:14-21` (`sources`, one caller), `:88-96` (parameter rule), `:133-147`;
  `config/checks/language/sql.ts` (`PARSED_DIALECTS = new Set(['postgres'])`); `types/checks/language/sql.ts`
  (3 types, one user each); `configurations/language/sql/manifest.toml:58-63`
- Kind: rename
- Problem: the check ID says "trivial functions", but the check also reports `function-parameters`. A one-entry Set
  stands in for `dialect !== 'postgres'`. The code says "threshold" and "maximum" where the Bash and Python checks
  say "ceiling" and the settings say `limits.*`.
- Fix: rename the check to `sql/functions` (summary: "small functions and functions with too many inputs") and its
  export to `sqlFunctions`. Replace the Set with `PARSED_DIALECT = 'postgres'` in `config/checks/language/sql.ts`
  and compare `dialect !== PARSED_DIALECT`. Inline `sources` (without its kind filter, S02-006). Move the three
  types to `types/checks/language.ts`. Use the word "limit" in variables and messages.
- Size: small

### CKO-022: Five small Python files repeat the same parse preamble

- Where: `checks/language/python/function-size.ts` (33 lines), `functions.ts` (34), `lazy-exports.ts` (31),
  `singletons.ts` (41), `exports.ts` (122)
- Kind: merge
- Problem: every file opens with the same `using parsed = await visitParsed(input, readPython, disposePython); const { modules } = parsed.value;` and walks the module statements. Splitting one-concept checks over five files
  adds imports and jumps, not clarity. `visitParsed` already caches the parse per run.
- Fix: merge the four small files (`function-size.ts`, `functions.ts`, `lazy-exports.ts`, `singletons.ts`, 139
  lines in all) into `checks/language/python/modules.ts`, with one exported function per check
  (`pythonFunctionSize`, `pythonPlaceholderDocstrings`, `pythonModuleGetattr`, `pythonSingletons`). Keep `exports.ts`
  (the four `__all__` checks) as it is.
- Size: small

### CKO-023: checkjs does the same work twice and builds an empty result two ways

- Where: `checks/language/public.ts:114-152`; `checks/language/contracts.ts:153-181`
- Kind: simplify
- Problem: line 116 returns `{ ...emptyResult(planned), fileCount: 0 }`, and lines 137-144 build the same empty
  result by hand. `writeScopeProject` (one caller) reads the generated tsconfig again and runs
  `scopeCompilerProject` again on the scratch copy, though `checkjs` computed both at lines 123-128.
- Fix: use `{ ...emptyResult(planned), fileCount: 0 }` in both places (`emptyResult` alone counts the planned
  files). Inline `writeScopeProject` into `javascriptTsc` (`typescript/tsc.ts`), and stop exporting
  `scopeCompilerProject`. To drop the second read, move the first result's file paths from the repository root to
  the scratch copy instead of reading again.
- Size: small

### CKO-024: Supabase storage-policies walks a syntax tree by abusing JSON.stringify

- Where: `checks/platform/public.ts:167-173`
- Kind: simplify
- Problem: it calls `JSON.stringify(tree, replacer)` and throws the string away, only to visit every node in the
  replacer. That is hard to read. `language/sql.ts:31-40` already has a plain recursive walk over the same tree
  shape.
- Fix: add one `walkSqlTree(value, visit)` in `parsers/sql/postgres.ts` next to `nodesOf`; use it in
  `supabaseStoragePolicies` and in `countNodes` of `sql.ts`.
- Size: small

### CKO-025: The Supabase Deno checks have one-caller functions and three layers of output checks

- Where: `checks/platform/public.ts:42-86,215-230`
- Kind: simplify
- Problem: `denoLint` and `denoCheck` are three-line loops around the one-caller functions `lintFunction` and
  `checkFunctionTypes`. `lintFunction` checks the exit code, then wraps the JSON parse in try/catch to throw again,
  then checks again for "no diagnostics".
- Fix: inline each into its check (`supabaseDenoLint`, `supabaseDenoCheck`). Keep one error for unreadable output
  that still includes the tool output (`toolOutputDetail`), because that is what a user needs when Deno prints
  something unexpected; use the CKO-011 function for the exit-code case.
- Size: small

### CKO-026: The memo "get or create" block is copied four times

- Where: `checks/language/contracts.ts:92-99`, `checks/database/postgres/public.ts:166-184`,
  `checks/database/postgres/history.ts:35-44`, `checks/language/swift/contracts.ts:75-80`
- Kind: merge
- Problem: each copy does `const map = memo(reads, KEY); let value = map.get(key); if (value === undefined) { value = create(); map.set(key, value); } return value;` (the Swift one reads `get(...) ?? run()` and then sets).
- Fix: give `system/file-reads.ts` a keyed form `memoized(reads, KEY, key, create)` beside `memo`, and use it in
  `readScripts`, `readMigrations`, `committedMigrationTexts`, and `buildOutput`.
- Size: small

### CKO-027: Comments are full of jargon

- Where: across the area. Counts over the 74 files: "native" 45, "diagnostic" 39, "scratch" 33, "workspace" 11,
  "authored" 10, "disposable" 10, "isolated" 9, "consumer" 9, "boundary" 4, "ambient" 3. Examples:
    - `language/contracts.ts:215-221` "... authored dependencies and only their owning installed projects ... the
      native authored source and configuration closure"

    - `language/contracts.ts:256-262` "Copy selected compiler inputs with their physical ancestor dependency installations"
    - `language/public.ts:108-109` "Check JavaScript with the repository's ambient types instead of the tool project installation."
    - `language/markdown.ts:9` "Report invalid tagged examples at their error lines; Bash executes through the same native tool boundary."
    - `tool/docker.ts:20,44,92,223` "Group actual project paths in native base-to-override order ...", "Native YAML owns service, image, and build metadata."
    - `types/checks/docker.ts:4,7,10` "the final file owned by native output attribution", "conservative ignore candidates share one project read"
    - `language/swift/public.ts:69,140` "Locate independent native build state for one project scope and consumer."
    - `config/checks/language/python.ts:1,36` "The pinned native tool reads ...", "Native import-linter precedence"

- Kind: rewrite-text
- Problem: "native", "authored", "physical", "closure", "isolated", "disposable", "consumer" add nothing a reader
  can use.
- Fix: rewrite in plain words, for example: "List the source files the compiler needs, plus the config files they
  use." / "Copy these files and the installed packages above them into a scratch copy." / "Check JavaScript with
  the type declarations the project itself uses." / "Report each Markdown code example that does not parse." /
  "Put each Compose file after the file it overrides." Drop "native" everywhere it only means "the tool's own";
  say "scratch copy" for the temporary copy and "message" for what a tool prints.
- Size: medium

### CKO-029: css/module-classes repeats an ESLint plugin

- Where: `checks/language/css.ts`; `config/checks/language/css.ts` (`MODULE_SUFFIX`);
  `configurations/language/css/manifest.toml:101-108`; `parsers/css.ts`; `types/parsers/css.ts`;
  `tests/cli/checks/language/css.test.ts`
- Kind: delete
- Problem: the check finds classes a CSS module defines but no code reads, and classes code reads that the module
  does not define. `eslint-plugin-css-modules` (`css-modules/no-unused-class`, `css-modules/no-undef-class`) does
  the same, and gspot already runs ESLint. The check does not earn its code.
- Fix: delete `css.ts`, `config/checks/language/css.ts`, the `[[check]] module-classes` entry, and its tests. Its
  only parser goes with it: all of `parsers/css.ts` and `types/parsers/css.ts` (PAR-012), and `typescriptProgram` in
  `parsers/source/contracts.ts` once `structure/test-placement` is gone too. A user who wants the check can add
  `eslint-plugin-css-modules`.
- Size: medium

### CKO-030: Overlaps with outside tools that the manifests do not explain

- Where: `checks/library/translations.ts` (eslint-plugin-i18n-json: `valid-message-syntax`, `identical-keys`);
  `checks/language/bash/unused-functions.ts` (ShellCheck SC2329, inside one file only);
  `checks/framework/public.ts:44-66` nextjs/route-segments (repeats an error `next build` reports; nextjs/build runs
  only at level all, so this one is the cheap early copy); `checks/language/python/exports.ts:103-121`
  python/export-order (gspot turns off Ruff RUF022 in `configurations/language/python/ruff.toml.eta:23` and enforces
  shortest-first instead)
- Kind: rewrite-text
- Problem: each duplicates part of an outside tool for a good reason (across files, at an earlier stage, a different
  order), but nothing says so, and the next reader has to find the reason again.
- Fix: keep the checks, and say the reason in the `why` text of each: `translations/messages`,
  `bash/unused-functions` (for example "ShellCheck checks one file; this check looks across files"),
  `nextjs/route-segments`, and `python/export-order`.
- Size: small

### CKO-032: Finding objects are built by hand in three places

- Where: `framework/expo.ts:40-49`, `framework/contracts.ts:30-39`, `tool/public.ts:97-100`; every other check
  uses `findingAt` from `checks/finding.ts`
- Kind: simplify
- Problem: two ways to make a finding. `svelteFindings` takes a bare check name only because it is exported for a
  test.
- Fix: use `findingAt(input, ...)` everywhere, and pass `input` to `svelteFindings`. A svelte-check message can have
  no code (`framework/contracts.ts:36` leaves `rule` out), and `findingAt` needs a rule, so use the rule name
  `'svelte-check'` for such a message.
- Size: small

### CKO-033: swift-tests/coverage reports findings at an empty file path

- Where: `checks/tool/contracts.ts:147-149`
- Kind: fix-bug
- Problem: `findingAt(input, { file: '', line: 1 }, 'coverage', text)` points at no file, so editors and the
  report cannot link it.
- Fix: point the finding at the scope's `Package.swift`, or at the project in `xcode.project` when that is set;
  `buildPlan` already knows both.
- Size: small

### CKO-034: Wrangler "has a name" test is a regular expression that matches anything

- Where: `config/checks/platform/cloudflare.ts:3`
- Kind: simplify
- Problem: `pattern: /^/u` matches every string, including `""`, so the rule only tests "is a string", and an empty
  worker name passes.
- Fix: change the `name` pattern in `WRANGLER_FIELDS` to `/\S/u`, the same form `referrer-policy` uses in the same
  file. No special code is needed.
- Size: small

### CKO-035: The Bash script-layout check tests one condition twice and wraps one string in a list

- Where: `checks/language/bash/contract.ts:91-93`; `config/checks/language/bash.ts:17`
- Kind: simplify
- Problem: `if (file.isExecutable) strictModeFindings(...); if (file.isExecutable) entryFindings(...); else libraryFindings(...)`. `STRICT_MODE = ['set -euo pipefail']` is a one-item list, then joined with " and ".
- Fix: one `if (file.isExecutable) { ... } else { ... }`; `STRICT_MODE` becomes a plain string.
- Size: small

### CKO-036: The ShellCheck check sets the Bats dialect that ShellCheck already picks

- Where: `checks/language/bash/shellcheck.ts:16-19`
- Kind: simplify
- Problem: for files without a shebang, gspot passes the Bats dialect flag to `.bats` files. ShellCheck already
  picks the dialect from the `.bats` and `.bash` extensions. Only `.sh` and extensionless files without a shebang
  need the Bash dialect flag.
- Fix: confirm with one ShellCheck run on a `.bats` file without a shebang; then group only the files whose
  extension is not `.bats` or `.bash` and that have no shebang.
- Size: small

### CKO-037: The ansible-lint check builds its command by hand

- Where: `checks/tool/ansible.ts:49-60`
- Kind: simplify
- Problem: it calls `substituteValue` with a hand-made substitution object to expand its own declared command (the
  only other check that calls it is `general/generated-code.ts:72`), then appends `--skip-list` from `rulesOff`.
  Other tools get their turned-off lint rules through a generated tool file.
- Fix: write `skip_list` into a generated `.gspot/config/ansible-lint.yml` tool file like the other configurations,
  add `-c {tool_file:ansible-lint}` to the manifest command, and keep only the per-`ansible.cfg` loop in code.
- Size: medium

### CKO-038: Three small functions say "the source files of this scope that end with X"

- Where: `tool/xcode/project.ts:138-142` (`scopeSourcesByEnding`), `framework/public.ts:27-29` (`sourcePaths`),
  `platform/cloudflare.ts:16-18` (`scopePathsNamed`)
- Kind: merge
- Problem: three small functions do one job. They differ in one way that matters: `scopePathsNamed` matches a whole
  file name (`path === name || path.endsWith('/' + name)`), while the others match a bare ending, and a bare ending
  `_headers` would also match `foo_headers`.
- Fix: one `sourcePaths(input, endings?)` in `checks/finding.ts` for all three callers. Cloudflare's files keep the
  whole-name match: `wrangler.toml`, `_headers`, and `_redirects` match only as the full file name (the path is the
  name or ends in `/` plus the name). The repeated filters of the per-file checks go without a shared function
  (S02-006).
- Size: small

### CKO-039: Two copies of the shortest-first sort

- Where: `checks/language/bash/sources.ts:29-31`, `checks/language/python/exports.ts:109-111`
- Kind: merge
- Problem: both sort by length, then by name. They are the same house order.
- Fix: one exported `byLengthThenName` comparator next to `findingAt` in `checks/finding.ts`; use it in
  `bashSourceOrder` and `pythonExportOrder`.
- Size: small

### CKO-040: pip-installs text speaks of "allowed paths" that do not exist

- Where: `configurations/language/python/manifest.toml:244`; `checks/language/python/deptry.ts:64-71`
- Kind: rewrite-text
- Problem: the summary says "no pip install outside the allowed paths", but there is no allowed-paths setting; the
  only way is `gspot ignore ... --paths`. The lockfile client list `['uv', 'poetry', 'pdm']` is written in code and
  again as file names in the manifest `files` table.
- Fix: summary "Checks that pyproject.toml lists every dependency: no hand-kept requirements file and no pip
  install. To accept one file, ignore its finding with gspot ignore." Read the client list from the manifest
  `files.filenames` instead of repeating it in `pythonPipInstalls`.
- Size: small

### CKO-041: postgres/migration-docs enforces one invented migration layout

- Where: `checks/database/postgres/public.ts:49-148,214-219`; `config/checks/postgres.ts:11-40`;
  `types/checks/postgres.ts` (`MigrationStatement`); `configurations/database/postgres/manifest.toml`
  (`[[check]] migration-docs`, setting `postgres.doc_sections`); `tests/cli/checks/database/postgres/migration-docs.test.ts`
- Kind: delete
- Problem: the check requires a 76-character `-- ====` separator, an exact four-line header, boxed section names,
  and `-- Table:` / `-- Function:` labels. It is a shipped check that users turn on at level `all`, and it enforces
  one layout that few teams would choose. It does not earn its place.
- Fix: delete the check: `headerFindings`, `sectionFindings`, `commentsAbove`, `statementFindings`, `docFindings`,
  `migrationDocs`, the layout constants (`MIGRATION_STATEMENTS`, `DOC_LABELS`, `PURPOSE`, `SECTION`, `BLOCK_REACH`,
  `DOC_SEPARATOR`, `HEADER_LINES`, `LINE_ABOVE`), `MigrationStatement`, the manifest entry, the setting
  `postgres.doc_sections`, its entry in the check table, and its tests.
- Size: medium

### S02-001: swift/periphery holds one resource in a DisposableStack

- Where: `packages/cli/src/checks/language/swift/contracts.ts:142-144` (`swiftPeriphery`)
- Kind: simplify
- Problem: the function makes a `DisposableStack`, adds the one locked build folder to it, and lets the stack
  dispose it. A plain `using` does the same: `runBuild` (`:58-59`) and `measureCoverage` (`coverage.ts:59-60`) write
  `const prepared = prepareBuild(...); using files = prepared.files;` for the same value.
- Fix: in `checks/language/swift/build.ts`, write `const prepared = prepareBuild(input, folder); using files = prepared.files;` and delete the stack.
- Size: small

### S02-002: Four cross-file Bash checks see only the staged scripts in a commit hook

- Where: `packages/cli/configurations/language/bash/manifest.toml:159-198` and `:250-259` (`unused-functions`,
  `unread-arguments`, `private-prefix`, `guards`); `packages/cli/src/checks/language/contracts.ts:88-91`
  (`getScriptIndex` reads `input.files`)
- Kind: fix-bug
- Problem: these checks compare functions, calls, and guard names across scripts. They declare no `runs`, so they
  run per file (`runs = "files"` is the default, `parsers/schema/configurations.ts:126`). In a hook (`gspot check --staged`) the planner gives a per-file check only the changed files (`planning/files.ts:78-87, 175-176`).
  `bash/unused-functions` then reports a function in a staged script as "called from no script" when only an
  unstaged script calls it (`unused-functions.ts:13-16` builds `referenced` from `index.files` only).
  `bash/private-prefix` tells you to rename a public function to `_name` when its other callers are unstaged.
  `bash/unread-arguments` and `bash/include-guards` miss problems. The PostgreSQL checks, which also read across
  files, all declare `runs = "scope"` (`database/postgres/manifest.toml:50-105`).
- Fix: add `runs = "scope"` to `bash/unused-functions`, `bash/unread-arguments`, `bash/private-prefix`, and
  `bash/include-guards` in `configurations/language/bash/manifest.toml`. `readScripts` already keeps only the Bash
  scripts of the scope. No new test is planned; the "Untested logic" rule decides after the code is cut.
- Size: small

### S02-003: runTsc writes the tool file folder by hand

- Where: `packages/cli/src/checks/language/contracts.ts:339` (`runTsc`)
- Kind: merge
- Problem: `join(metadataRoot, '.gspot/config', ...)` repeats the value of `CONFIGURATION_DIRECTORY`
  (`config/platform/locations.ts:4`). If the folder name changes, this copy breaks quietly. `checkjs`
  (`language/public.ts:118`), `swiftlintAnalyze`, `swiftPeriphery`, and `scanImage` already import the constant.
- Fix: use `TOOL_FILE_DIRECTORY` (`config/system/locations.ts`, today `CONFIGURATION_DIRECTORY`) in `runTsc`
  (`typescript/project.ts`).
- Size: small

### S02-004: The list of migration files is built twice

- Where: `packages/cli/src/checks/database/postgres/public.ts:156-164` (`migrationsOf`);
  `packages/cli/src/checks/platform/public.ts:192-199` (`migrationNames`)
- Kind: merge
- Problem: both call `migrationFiles` with the same five arguments and drop `.down.sql` files. The Supabase check
  cannot reuse the PostgreSQL reader, because that parses the SQL and throws on a parse error, so the copy grew
  instead.
- Fix: in `checks/database/postgres/migrations.ts`, split the path list at the top of `readMigrations` (today
  `migrationsOf`) into `migrationPaths(input): string[]`; `readMigrations` and `supabaseMigrationNames` both call it.
  The `.down.sql` suffix becomes `DOWN_MIGRATION_SUFFIX` in `config/checks/database.ts`.
- Size: small

### S02-005: "configuration" names a tool's own settings file in six names

- Where: `contractConfiguration` (`checks/language/python/imports.ts:17`), `IMPORT_CONTRACT_FILES`
  (`config/checks/language/python.ts:37`), `configurationArguments` and `readConfiguration`
  (`checks/platform/public.ts:29,93`), `copyConfigurations` and `testConfiguration` (`checks/tool/public.ts:71,103`)
- Kind: rename
- Problem: the glossary keeps "configuration" for a selectable unit such as `bash` or `docker`. These names use it
  for import-linter's settings file, `deno.json`, `supabase/config.toml`, and `nginx.conf`.
- Fix: `importLinterFile`, `IMPORT_LINTER_FILES`, `denoConfigArguments`, `readConfigToml`, `copyNginxFiles`,
  `testNginxFile`.
- Size: small

### S02-006: Seven checks do not use the files the planner selected

- Where: `language/html.ts:162-164`, `language/markdown.ts:16`, `language/sql.ts:14-17`,
  `library/swift-snapshot-testing.ts:24-26`, `tool/contracts.ts:58-60` and `:82-84`, `tool/public.ts:21-56` (actionlint; all under `packages/cli/src/checks/`); `config/checks/tool/github-actions.ts`
- Kind: delete
- Problem: these checks run per file (no `runs`). For such a check the planner already gives only the files of the
  check's `files` table, or of the manifest's `[files]` table, and only source files (`planning/files.ts:51-57`;
  `repository/selection/public.ts:56`; `kinds` defaults to `['source']`, `parsers/schema/configurations.ts:46`). The
  html, markdown, and sql manifests declare their extensions, and swift-snapshot-testing and swift-tests declare
  `files = { tags = ["swift-test"] }`. The code filters by kind and tag again. The actionlint check goes the other way: it reads and YAML-parses every `.yml` and `.yaml` file of the whole repository (`session.repository.files`), not the planned workflow files, before it rewrites `$/` references (IGN-012), and its command sits in a one-line config file instead of the manifest.
- Fix: map `input.files` directly in the five functions. For markdown, declare `files = { extensions = [".md"] }` on
  `markdown/fences` in `configurations/language/markdown/manifest.toml` and drop the `.md` test too. The swift-snapshot-testing `references` check runs over the whole scope (`runs = "scope"`), so its tag filter stays. The actionlint check scans only `input.files` plus the `action.yml` files, and its command moves into `configurations/infrastructure/github-actions/manifest.toml` (`command = ["actionlint", "-no-color", "{files}"]`).
- Size: small

### S02-007: The Supabase project-file reader checks for the file before reading it

- Where: `packages/cli/src/checks/platform/public.ts:93-97` (`readConfiguration`)
- Kind: simplify
- Problem: it calls `statSync` and returns `undefined` when the file is missing, then reads it. `readText` already
  returns `undefined` for a missing file (`platform/root/public.ts:297-306` turns `ENOENT` into `undefined`).
- Fix: in `readConfigToml`, write `const text = readText(input.root, posix.join(input.scope, SUPABASE_CONFIG_TOML), input.reads); if (text === undefined) return undefined;` and delete the `statSync` and `join`.
- Size: small

## Layout

Source files, all under `packages/cli/src/checks/`:

```text
database/postgres/
  migrations.ts          migrationFiles, migrationPaths, readMigrations, parseMigrations
  schema.ts              the schema built from the migrations (ALTERATIONS, READERS)
  access.ts              postgres/row-level-security, postgres/grants, postgres/definer-search-path
  foreign-keys.ts        postgres/foreign-key-indexes
  history.ts             postgres/migration-order, postgres/edited-migrations
framework/
  expo.ts  nextjs.ts  svelte.ts
language/
  html.ts  markdown.ts  sql.ts
  bash/
    scripts.ts           readScripts, readScript, functionAt: the shared script reader
    doc-comments.ts  function-size.ts  include-guards.ts  inline-scripts.ts  private-prefix.ts  safety.ts
    script-layout.ts  shellcheck.ts  source-order.ts  ssh-blocks.ts  unread-arguments.ts  unused-functions.ts
    variable-defaults.ts  wrappers.ts
  python/
    modules.ts           function-size, placeholder-docstrings, module-getattr, singletons
    exports.ts           private-prefix, exports-at-bottom, package-exports, export-order
    deptry.ts  import-linter.ts  pip-installs.ts  pydoclint.ts
  swift/
    build-folder.ts      build folder, build plan, prepared build
    build.ts             swift/build, swift/swiftlint-analyze, swift/periphery
  typescript/
    project.ts           runTsc and the copy steps
    tsc.ts               typescript/tsc, javascript/tsc
    tsconfig.ts          typescript/tsconfig
library/
  drizzle.ts  swift-snapshot-testing.ts  translations.ts
platform/
  cloudflare.ts  supabase.ts
infrastructure/
  ansible.ts  docker.ts  github-actions.ts  nginx.ts
  xcode/project.ts  xcode/resources.ts  xcode/settings.ts
testing/
  swift-tests.ts         swift-tests/skip-reasons, swift-tests/sleep, swift-tests/coverage
  coverage.ts            Swift package and Xcode coverage measurement
finding.ts               findingAt, sourcePaths, byLengthThenName (shared by every check)
```

Config and types files of these checks (all under `packages/cli/src/`):

| File                                             | What it holds                                                                                                                                                                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/checks/database.ts`                      | PostgreSQL: constraint suffixes, public schema, `DOWN_MIGRATION_SUFFIX`, the configuration name                                                                                                                                                |
| `config/checks/library.ts`                       | Drizzle source and table-builder patterns, swift-snapshot-testing recording modes and `REFERENCE_FOLDER`, the message file suffix `.json`                                                                                                      |
| `config/checks/testing.ts`                       | swift-tests: sleep calls, skip-reason positions, comment and literal patterns, coverage commands and bundle, the `.app` suffix, `TYPED_TASK_CALL`                                                                                              |
| `config/checks/framework/expo.ts`                | the Expo Doctor command, the expo package path                                                                                                                                                                                                 |
| `config/checks/framework/nextjs.ts`              | route and next.config names, failure-summary marks and line counts, `next typegen` and `next build`, the CI environment, the app folder                                                                                                        |
| `config/checks/framework/svelte.ts`              | the svelte-check command, its tsconfig flag, its output line patterns                                                                                                                                                                          |
| `config/checks/infrastructure/ansible.ts`        | `ANSIBLE_CFG`, the lint line pattern, the skip-list flag and tags, the `.cfg` suffix                                                                                                                                                           |
| `config/checks/infrastructure/docker.ts`         | ignore entries and forms, Trivy exit and `TRIVY_IMAGE_COMMAND`, the Compose override pattern, suffixes, check ID, `-f`, `DOCKER_TOOL`                                                                                                          |
| `config/checks/infrastructure/github-actions.ts` | the `$/` marker pattern and the YAML file pattern; the actionlint command moves into the manifest                                                                                                                                              |
| `config/checks/infrastructure/nginx.ts`          | `NGINX_CONF`, `NGINX_FOLDER = '/etc/nginx'`, `NGINX_MAIN_TARGET`, certificate arguments and files, host patterns, Docker and nginx test arguments, output patterns                                                                             |
| `config/checks/infrastructure/xcode.ts`          | Xcode file suffixes, asset folder names and patterns (`XCASSETS_FOLDER`, `XCSTRINGS_SUFFIX`), xcconfig and plist patterns, the default source language                                                                                         |
| `config/checks/language/bash.ts`                 | shebangs, `STRICT_MODE`, `MAIN_FUNCTION`, script-layout patterns, `BASH_OPTION_COMMANDS`, safety and inline-script tables, wrapper patterns, doc words, `COUNT_LIMITS`, `SHELLCHECK_DIALECT_FLAG`, `SHELLCHECK_TOOL_COMMENT`, `PRIVATE_PREFIX` |
| `config/checks/language/html.ts`                 | script types, URL attributes, placeholder marks, script schemes, `EVENT_ATTRIBUTE`; the parse base is `PLACEHOLDER_ORIGIN` of the site checks                                                                                                  |
| `config/checks/language/markdown.ts`             | the code example check: parsers, ellipsis and placeholder patterns                                                                                                                                                                             |
| `config/checks/language/python.ts`               | the pydoclint, deptry, and lint-imports commands, docstring patterns, `INIT_PY`, `IMPORT_LINTER_FILES`, `PYTHON_PRIVATE_PREFIX`, placeholders                                                                                                  |
| `config/checks/language/sql.ts`                  | `PARSED_DIALECT`, the output parameter modes                                                                                                                                                                                                   |
| `config/checks/language/swift.ts`                | compiler message patterns (`MESSAGE_LINE`, `RESPONSE_FILE`), the macOS path rewrite, build folders and log, `swift` and `xcodebuild` arguments, the SwiftLint and Periphery commands, levels, `XCODE_WORKSPACE_SUFFIX`                         |
| `config/checks/language/typescript.ts`           | tsc commands and flags (`TSBUILDINFO_FLAG`), build-info files (`TSCONFIG_TSBUILDINFO`, `JSCONFIG_TSBUILDINFO`), the tsconfig name pattern, check IDs, the tsc tool name                                                                        |
| `config/checks/platform/cloudflare.ts`           | `WRANGLER_FIELDS`, Wrangler file names, required headers, `_headers`, `_redirects`, the frame-ancestors pattern                                                                                                                                |
| `config/checks/platform/supabase.ts`             | `SUPABASE_CONFIG_TOML`, the migration name pattern, the Deno commands and config files, function entry files, admin keys and tags, `SHARED_PREFIX`                                                                                             |
| `types/checks/database.ts`                       | PostgreSQL migrations and schema state                                                                                                                                                                                                         |
| `types/checks/infrastructure.ts`                 | Compose files and services, nginx mounts and directive scan                                                                                                                                                                                    |
| `types/checks/language.ts`                       | Bash scripts (`ScriptReport`, `ScriptFile`), Markdown fences, `DocstringConfiguration`, SQL (`SqlSource`, `SqlFileInput`, `SqlFunctionFindings`), Swift builds                                                                                 |
| `types/checks/platform.ts`                       | Cloudflare `_headers` blocks, the Supabase settings file, the Deno lint report                                                                                                                                                                 |
| `types/checks/testing.ts`                        | the Swift coverage report                                                                                                                                                                                                                      |

Values these checks share with other areas go to those areas' files: `PYTHON_IMPORT_NODES` and `SWIFT_ENV_READ` to
`config/checks/general/structure.ts`; `PACKAGE_JSON`, `PYPROJECT_TOML`, and `PACKAGE_SWIFT` to
`config/parsers/dependency-files.ts`; `PBXPROJ` to `config/parsers/xcode.ts`; `TSCONFIG_FILE` and `JSCONFIG_FILE`
to `config/parsers/tsconfig.ts`; `SWIFT_EXTENSION` to `config/parsers/swift.ts`; `SCRIPT_TAG`, `TYPESCRIPT_TAG`,
`SWIFT_TEST_TAG`, `BATS_TAG`, and `DEFAULT_DIALECT` to `config/repository/inventory.ts`; `GIT_FOLDER` to
`config/repository/tracked.ts`; `ENV_ROLE = 'environment_readers'` to `config/settings/values.ts`;
`TOOL_FILE_DIRECTORY` is in `config/system/locations.ts`; `compose` uses the existing `FILE_PLACEHOLDER` of
`config/configurations.ts`.
