# The ESLint plugin

gspot ships a second npm package, `@gspothq/eslint-plugin`, with eight ESLint rules: `header-first`,
`import-boundaries`, `no-alias-exports`, `no-client-env`, `no-index-imports`, `no-trivial-files`,
`no-trivial-functions`, and `require-server-only`. gspot's generated ESLint configuration turns them on at level
`recommended` or `all`, and people can also use the plugin without gspot. This file also covers the CLI code that
writes the ESLint configuration (`packages/cli/src/generation/eslint/`) and the script that copies third-party rule
lists into `packages/cli/configurations/`. The target: one ESM build made by `scripts/build.ts`, an entry file
`src/plugin.ts`, constants and types grouped by topic in the plugin's `config/` and `types/`, each rule's helpers in
its rule file, and a CLI that takes the plugin's rule levels at build time instead of keeping a copy.

Where lines give today's paths. Problem and Fix use the target names: `tests/unit/eslint-plugin/` for `tests/plugin/`,
the alias `#eslint-plugin/*` for `#plugin/*`, `src/plugin.ts` for `src/rules/public.ts`, and `src/paths.ts` for
`src/public.ts`.

## Layout

```text
packages/eslint-plugin/
  package.json                    ESM only: exports { types: ./dist/plugin.d.ts, default: ./dist/plugin.js }; no "main", no "imports"
  tsconfig.json                   settings of the declaration build
  README.md
  src/
    plugin.ts                     the entry: rule table and the recommended and all configs
    paths.ts                      normalizePath
    create-rule.ts                createRule, optionsSchema
    syntax.ts                     childNodes, totalStatements, hasConstructorState, unwrap
    rules/                        the 8 rules; each rule file holds its own helpers
    config/
      comments.ts                 TOOL_COMMENT_PREFIXES, TS_COMMENT, LEADING_STAR, BLANK_LINE_DISTANCE, BLANK,
                                  LINE_BREAK_GAP, LEADING_LINE_BREAK
      environment.ts              ENVIRONMENT_HOSTS, ENVIRONMENT_ALLOWED
      imports.ts                  INTERNAL_PREFIXES, RELATIVE_PREFIXES, MODULE_MOCK_METHODS, DEFAULT_FOLDERS
      nextjs.ts                   PUBLIC_PREFIXES, CLIENT_DIRECTIVE, SERVER_DIRECTIVE, SERVER_ONLY_MODULE
      paths.ts                    INDEX_BASENAMES, STDIN_NAMES, TRAILING_SLASH, TRAILING_STAR
      plugin.ts                   RULE_URL, PLUGIN_PREFIX
      syntax.ts                   TYPE_WRAPPERS, WRAPPERS, TRANSPARENT_EXPRESSIONS, FUNCTIONS, TYPE_ONLY,
                                  EXECUTABLE_DECLARATIONS, NON_EXECUTABLE_STATEMENTS, STRUCTURED_EXPRESSIONS,
                                  FORWARDING_NODES, VALUE_PARENTS, EXPORT_REFERENCES, TRIVIAL_STATEMENTS,
                                  MIN_SHARED_READS, IMPORT_SELECTOR, FUNCTION_SELECTOR, SHEBANG
    types/
      rules.ts                    RuleDocs, RuleContext, ClientEnvOptions, ImportBoundariesOptions,
                                  TrivialFilesOptions, TrivialFunctionsOptions
      syntax.ts                   ImplementedFunction, NamedFunction, ImportSource, StatementStart, ContentCheck
scripts/build.ts                  step 4 bundles packages/eslint-plugin/dist/plugin.js (ESM) with declarations
scripts/update-rule-lists.ts      task update:rule-lists
tests/unit/eslint-plugin/
  plugin.test.ts                  the level test and the same-plugin-object test
  rules/<rule>.test.ts            one RuleTester file per rule
tests/config/eslint-plugin.ts     ENVIRONMENT_GLOBALS, IMPORT_ALIASES, CLIENT_ENV_SAMPLE, RULE_TESTER_ROOT,
                                  RULE_TESTER_PARSER_OPTIONS
tests/setup/rule-tester.ts        RuleTester set up for Bun
tests/e2e/eslint-plugin.test.ts   the packed plugin in a new project (its programs in tests/config/e2e.ts)
```

In the plugin, `config/` imports only `config/`, and `types/` imports only `config/` and `types/`. These files go:
`build.ts`, `src/public.ts`, `src/rules/public.ts`, `src/comments.ts`, `src/imports.ts`, `src/layout.ts`,
`src/environment.ts`, `src/config/build.ts`, `src/config/files.ts`, `src/config/layout.ts`, `src/config/no/`, and
every `src/types/` file other than `rules.ts` and `syntax.ts`.

## Findings

### PLG-001: no-client-env misses `process.env` unless `process` is declared as a global

- Where: `packages/eslint-plugin/src/environment.ts:24-30`, `packages/eslint-plugin/README.md:38-49`,
  `tests/config/plugin/environment.ts:1-2`, `tests/plugin/rules/no-client-env.test.ts:7`,
  `tests/plugin/configuration.test.ts:42`, `tests/config/packages/plugin.ts:21`
- Kind: fix-bug
- Problem: The rule finds `process.env`, `Bun.env` and `Deno.env` with ESLint's reference tracker. The tracker skips
  a global that the ESLint configuration does not declare (`isModifiedGlobal` in `@eslint-community/eslint-utils`
  returns true when the variable is missing). So a `"use client"` file with `process.env.SECRET` gets no finding when
  `process` is not declared. This hits standalone users who skip the README step (a TypeScript setup usually declares
  no Node globals), and gspot repositories whose files get only the `browser` runtime (React, Vue, Svelte, or Vite
  without Next.js). gspot's Next.js setup gives every file the Node globals, so it is not hit. Only `import.meta.env`
  works without setup. Every test declares the globals first, so no test lints a client file without them.
- Fix: In `environmentListeners` (`Program:exit`; today `environmentReads`), also walk
  `context.sourceCode.getScope(node).through` (the names the file uses but never declares) and report each one named
  `process`, `Bun` or `Deno` whose parent reads `.env`. An undeclared name cannot be a local variable, so shadowing
  stays safe. Keep the tracker for declared globals: only a declared global can be followed through an alias such as
  `const host = process`. Keep `ENVIRONMENT_GLOBALS` (in `tests/config/eslint-plugin.ts`) only for the two alias
  cases (`no-client-env.test.ts:30, 34`). The other no-client-env cases, the level test, and the e2e program
  (`MODULE_PROGRAM` in `tests/config/e2e.ts`) then lint with no declared globals, so they cover the fix. Shorten the
  README paragraph: declaring the globals is needed only to catch aliases.
- Size: small

### PLG-002: header-first's fix moves tool comments it does not know, which breaks them

- Where: `packages/eslint-plugin/src/config/comments.ts:2-16`, `packages/eslint-plugin/src/comments.ts:10-14`,
  `packages/eslint-plugin/src/rules/header-first.ts:120-142`
- Kind: fix-bug
- Problem: The rule skips tool comments from a fixed list (eslint, ts-, biome-ignore, c8, istanbul, ...). The list
  misses `prettier-ignore`, `nosemgrep`, `dprint-ignore` and `deno-lint-ignore`, and gspot itself runs Prettier and
  Semgrep. A line such as `import { exec } from 'node:child_process'; // nosemgrep` is reported, and `eslint --fix`
  moves `// nosemgrep` above the first import, so the suppression silently stops working. A `// prettier-ignore` line
  between two imports moves onto the first import. The rule's own tests show both moves
  (`tests/plugin/rules/header-first.test.ts:70-73, 76-78, 81-83`).
- Fix: Add `'prettier-ignore'`, `'nosemgrep'`, `'dprint-ignore'` and `'deno-lint-ignore'` to `TOOL_COMMENT_PREFIXES`
  (today `DIRECTIVE_PREFIXES`) in `src/config/comments.ts`. Trailing comments stay reported: never reporting a
  comment that shares its line with code would reverse three tested cases. Two valid cases (a trailing
  `// nosemgrep` on the second import, a `// prettier-ignore` line between two imports) are inputs to the README's
  untested-logic rule after the code is cut; no test is planned now.
- Size: small

### PLG-003: no-trivial-functions tells AI coding tools to add a lint suppression

- Where: `packages/eslint-plugin/src/rules/no-trivial-functions.ts:187` (docs `fix`), `:200` (message)
- Kind: rewrite-text
- Problem: The message says "Inline it into its callers, or explain the API it serves in a narrow suppression." The
  docs text says "A required external API keeps the function under a narrow suppression with a reason." AI coding
  tools read this message and act on it, so it invites them to add `eslint-disable` comments. The docs `fix` text also
  feeds the docs site page.
- Fix: Message: "This function has {{statements}}. Inline it into its callers and delete it." Docs `fix`: "Inline the
  function at its call sites and delete it." Drop the suppression advice.
- Size: small

### PLG-005: Four helper files are leftovers from deleted rules, and each has one user

- Where: `packages/eslint-plugin/src/comments.ts`, `src/imports.ts`, `src/layout.ts` (only `rules/header-first.ts`
  uses them), `src/environment.ts` (only `rules/no-client-env.ts` uses it), `src/rules/header-first.ts:117, 134`
- Kind: merge
- Problem: These helpers served `sort-imports`, `sort-exports` and `env-owner`, rules that no longer exist. Each now
  has one user in another file. `isRequireCall` is exported but used only inside `imports.ts`. Two guards for states
  that cannot happen came along: `header-first.ts:117` (`first === undefined || last === undefined`; a run is never
  empty) and `:134` (`?.[0] ?? ''` on `/^\s*/u`, which always matches). They exist because TypeScript sees "possibly
  missing": the repository turns on `noUncheckedIndexedAccess` and `@typescript-eslint/no-non-null-assertion`.
- Fix: Move `isDirective` (as `isToolComment`), `isOwnLine`, `runsOf`, `isImportLike` and `isRequireCall` (not
  exported) into `rules/header-first.ts`. Move `environmentReads` (as `environmentListeners`: it returns listeners)
  and `environmentNames` into `rules/no-client-env.ts`. Delete the four helper files. Their constants stay in
  `config/comments.ts` and `config/environment.ts`, and their types go to `types/rules.ts` (`ClientEnvOptions`) and
  `types/syntax.ts` (`StatementStart`), as DEC-022 lays out. Remove the two guards with a small type change: `runsOf`
  returns non-empty runs (type `[TSESTree.Statement, ...TSESTree.Statement[]][]`), and the leading spaces are
  measured as `rest.length - rest.trimStart().length`. Without that change TypeScript needs the guards.
- Size: small

### PLG-006: `src/public.ts` and `src/rules/public.ts` have names that say nothing

- Where: `packages/eslint-plugin/src/public.ts`, `packages/eslint-plugin/src/rules/public.ts`,
  `packages/eslint-plugin/package.json:16,18`, `packages/eslint-plugin/build.ts:15`,
  `packages/cli/src/config/generation/eslint.ts:66-72`, `gspot.toml:162`
- Kind: rename
- Problem: `src/public.ts` holds file-path helpers, not a public API. `src/rules/public.ts` is the plugin's entry
  point (it builds `dist/plugin.js`). Both are named `public.ts` only because the generated ESLint configuration lets
  a test import a runtime file only when the file is named `public.*` or `contracts.*` (the third entry of
  `ROLE_IMPORT_POLICIES`). Of the 5 exports in `src/public.ts`, `lintedPath`, `relativeImportPath` and
  `isAnyGlobMatch` serve only `import-boundaries`, `isIndexFile` serves only `no-trivial-files`, and `normalizePath`
  serves both.
- Fix: Do after TML-001, which deletes the test-import rule for every user. Rename `src/rules/public.ts` to
  `src/plugin.ts`, to match `dist/plugin.js`, with `"types": "./dist/plugin.d.ts"` in `exports`. Rename
  `src/public.ts` to `src/paths.ts`; it keeps `normalizePath` only. `INDEX_BASENAMES` goes to `config/paths.ts`.
  `lintedPath`, `relativeImportPath`, `isGlobMatch` and `globCache` move into `rules/import-boundaries.ts` (PLG-020,
  PLG-021), and the index check is written inline in `no-trivial-files` (PLG-020). The 9 plugin test files and the
  docs page code (`docs/src/reference/eslint-plugin.ts`) import `#eslint-plugin/plugin.ts`.
- Size: medium

### PLG-007: `scripts/eslint-presets.ts` and its task `pin:eslint-presets` have misleading names

- Where: `scripts/eslint-presets.ts:1-119`, `mise.toml:25-27`
- Kind: rename
- Problem: gspot writes every rule of every ESLint preset it uses (for example `eslint-plugin-react`'s
  "recommended" set) into the generated configuration, and records the rules for `explain`, `set` and `ignore`,
  without installing those plugins. So it ships a copy of each preset's rule list, and this script makes that copy
  from the packages installed in `tests/`. It also writes the Stylelint and `globals` lists, so "eslint" is wrong. It
  pins nothing (the pins live in `manifest.toml`), so "pin:" is wrong. The first comment, "Explicitly refresh shipped
  preset data from the installed test packages", does not say what or why.
- Fix: Rename the script to `scripts/update-rule-lists.ts` and the task to `update:rule-lists`, with the description
  "Copy the rule lists of the pinned linter packages into packages/cli/configurations. Run after changing a linter
  version." Replace the first comment with the same sentence. Keep the script: the CLI needs these lists.
- Size: small

### PLG-008: gspot copies its own plugin's rule levels into a JSON file and then tests that the copy matches

- Where: `packages/cli/configurations/language/javascript/eslint-presets.json:997-1021` (`gspot`, `gspotAll`),
  `packages/cli/configurations/language/javascript/manifest.toml:6` (two `eslint_presets` entries),
  `packages/cli/configurations/language/javascript/eslint.config.mjs.eta:155`, `tests/plugin/configuration.test.ts:9-16`
- Kind: delete
- Problem: The plugin lives in this repository and ships at the same version as the CLI. Yet the rule-list update
  copies `configs.recommended` and `configs.all` into JSON, and a test checks that the copy still equals the plugin:
  a copy plus a test that polices it. The ESLint configuration code reads only
  `presets[IS_ALL ? 'gspotAll' : 'gspot'].blocks[0].rules` from it.
- Fix: `scripts/build.ts` reads the plugin's rule levels (from `meta.docs.level`, as the plugin's own configs do) and
  writes them into the CLI's built data; the ESLint tool file source (CFL-001) reads them from there. A build script
  may read both packages, so the rule that the plugin and the CLI never import each other still holds. Delete the
  `gspot` and `gspotAll` entries from `manifest.toml` and `eslint-presets.json`, and delete the first test in
  `configuration.test.ts`.
- Size: medium

### PLG-010: The "installed version must equal the pin" check is written five times

- Where: `scripts/eslint-presets.ts:39-40, 58-62, 74-77, 91-94`, `packages/cli/src/generation/eslint/public.ts:241-266`
- Kind: merge
- Problem: The script repeats the same step four times with four messages: find the package, read its version,
  compare it with the manifest pin, throw. The four blocks differ only in the package name and the message.
  `validateEslintPresets` does a near copy at build time; it compares the shipped lists with the pins, not the
  installed packages.
- Fix: One helper in `scripts/update-rule-lists.ts`, `installedAtPin(name: string): { entry: string; version: string }`,
  that finds the installed package, reads its version, compares it with the pin, and throws
  `Install ${name}@${pin} first.` Use it for eslint, each preset package, globals, stylelint, and
  stylelint-config-standard.
- Size: small

### PLG-011: The script renames `serviceworker` to `service-worker`, and three other places undo or repeat that

- Where: `scripts/eslint-presets.ts:82-85`, `packages/cli/configurations/language/javascript/eslint.config.mjs.eta:343`,
  `packages/cli/configurations/language/javascript/manifest.toml:256,265,544`,
  `packages/cli/configurations/language/javascript/runtime-names.json:49`,
  `tests/cli/generation/eslint/runtimes.test.ts:138-147`, `tests/cli/generation/serialization/javascript.test.ts:65`,
  `tests/config/cli/generation/eslint/runtimes.ts:14`
- Kind: simplify
- Problem: The `globals` package calls the runtime `serviceworker`. The script renames it to `service-worker`, the
  ESLint configuration code maps it back (`runtime === 'service-worker' ? 'serviceworker'`), and a test repeats the
  rename to check the file. One concept, two names, three places to keep in step. Official names of external tools
  keep their own spelling.
- Fix: Keep the `globals` name `serviceworker` everywhere. Delete the rename in the update script, the mapping in the
  ESLint tool file source, and the test "the shipped runtime names match the pinned globals data". Use `serviceworker`
  in the two other tests, in `eslint-runtime-names.json` (CFL-040's name), and in the setting text for the runtime.
  Users write `runtime = "serviceworker"` in a `[[tools.eslint.override]]` record, and the gspot.toml reference
  example for that field says `serviceworker`. A value of `service-worker` is refused; there is no release yet, so no
  user file has it.
- Size: small

### PLG-012: Three tests only check that copied data is not stale

- Where: `tests/plugin/configuration.test.ts:9-16`, `tests/cli/generation/eslint/runtimes.test.ts:138-147`,
  `tests/cli/generation/eslint/required-rules.test.ts:54-91`
- Kind: delete
- Problem: These are checks of copied files, not tests of behavior. The first compares the plugin with its JSON copy.
  The second repeats the update script's rename. The third tests `validateEslintPresets`, which itself only checks
  that the shipped lists match the manifest pins.
- Fix: Delete the first with PLG-008 and the second with PLG-011. Delete the third test and keep the check:
  `validateEslintPresets` moves to `scripts/build.ts`, which runs it on the real manifests in its rule-list step
  (SCR-005).
- Size: small

### PLG-013: The CommonJS build adds nothing; CommonJS users still have to use `.default`

- Where: `packages/eslint-plugin/build.ts:13-25`, `packages/eslint-plugin/src/config/build.ts:1-4`,
  `packages/eslint-plugin/package.json:15,21`, `packages/eslint-plugin/README.md:6,106-107`,
  `tests/config/packages/plugin.ts:18-19`
- Kind: delete
- Problem: The build makes `dist/plugin.cjs` next to `dist/plugin.js`. But the CommonJS file exports
  `{ default: plugin }`, so `require('@gspothq/eslint-plugin')` gives the same shape that Node's own `require()` of an
  ES module gives. The test hedges with `commonjs.default ?? commonjs`. Node 22.12 and later can `require()` an ES
  module without a flag.
- Fix: Build only ESM, in step 4 of `scripts/build.ts` (SCR-005), which replaces `packages/eslint-plugin/build.ts`:
  one `Bun.build` call with `naming: 'plugin.js'`. In `package.json` delete `"main"`, set
  `"exports": { ".": { "types": "./dist/plugin.d.ts", "default": "./dist/plugin.js" } }` and
  `"engines": { "node": ">=22.12" }`. The README says "Node.js 22.12 or newer" (`:6`) and drops "and CommonJS"
  (`:106`). The e2e program (`MODULE_PROGRAM` in `tests/config/e2e.ts`) reads the CommonJS form as
  `require(...).default`.
- Size: small

### PLG-014: A build-only constant lives in the shipped plugin source

- Where: `packages/eslint-plugin/src/config/build.ts:1-4`, `packages/eslint-plugin/build.ts:6`
- Kind: delete
- Problem: `BUILD_FORMATS` is used only by `build.ts`, but it sits in `src/`, so `tsc` writes `dist/config/build.d.ts`
  into the published package.
- Fix: Delete `src/config/build.ts` with the CommonJS build (PLG-013). The build values live in
  `scripts/config/build.ts`.
- Size: small

### PLG-015: The published package ships 34 internal `.d.ts` files, 7 with broken imports, and the whole package.json

- Where: `packages/eslint-plugin/build.ts:26-38`, `packages/eslint-plugin/package.json:24-30`,
  `packages/eslint-plugin/src/rules/public.ts:7,36`
- Kind: fix-bug
- Problem: `tsc` writes a `.d.ts` for every source file, 35 in all. The entry declaration needs only 5 of them (under
  `dist/types/`, reached through relative imports). Seven others keep `#plugin/...` imports (for example
  `dist/rules/no-client-env.d.ts:1`). In an installed package `#plugin/*` points to `./src/*`, which is not published
  (`"files": ["dist"]`). Nothing breaks yet only because the entry declaration never reaches those 7 files; the first
  type that needs one breaks. Also, `import packageManifest from '#plugin-package'` makes Bun paste the whole
  `package.json` (devDependencies, repository, imports) into `dist/plugin.js` to read two fields.
- Fix: Must land before the first publish. Use relative imports inside the plugin (`./create-rule.ts`;
  `gspot/import-boundaries` allows them inside one package) so the written `.d.ts` files work, and delete the
  `imports` field from `package.json`. Give the name and version with
  `Bun.build({ define: { PLUGIN_NAME: ..., PLUGIN_VERSION: ... } })` in `scripts/build.ts`, or import only
  `{ name, version }`. Tests and docs keep the root alias `#eslint-plugin/*`.
- Size: small

### PLG-016: Every rule sets a `docs.title` that nothing reads

- Where: `packages/eslint-plugin/src/types/create-rule.ts:2`, and `title:` in all 8 files under
  `packages/eslint-plugin/src/rules/`
- Kind: delete
- Problem: `title` is not an ESLint field. The docs site builds page titles from the rule name, and gspot's
  `explain` uses the manifest URL. Nothing reads `title`.
- Fix: Delete `title` from `RuleDocs` (in `types/rules.ts`) and from the 8 rules.
- Size: small

### PLG-017: `requiresOptions` is an unused field with an unused docs branch and a stale README sentence

- Where: `packages/eslint-plugin/src/types/create-rule.ts:8`, `docs/src/content/reference/plugin.ts:48`,
  `packages/eslint-plugin/README.md:70-72`
- Kind: delete
- Problem: No rule sets `requiresOptions`. The docs page code still checks it, and the README still says the
  reference "identifies rules that need project options before they report findings". It served rules that no longer
  exist.
- Fix: Delete the field, the docs branch (`required`) in `docs/src/reference/eslint-plugin.ts`, and the README
  sentence.
- Size: small

### PLG-018: Two comments describe rules that no longer exist

- Where: `packages/eslint-plugin/src/config/environment.ts:3`, `packages/eslint-plugin/src/rules/public.ts:40`
- Kind: rewrite-text
- Problem: "Runtime mode is public configuration in both environment rules": there is one environment rule. "All
  adds naming, import order, layout, and complexity conventions": no rule orders imports or checks naming.
- Fix: Delete the first comment. Replace the second, in `src/plugin.ts`, with "`all` adds the house-style rules:
  comment placement, import paths, aliases, and trivial code."
- Size: small

### PLG-019: `normalizePath` guards against file URLs that never arrive and cuts real paths at `#` or `?`

- Where: `packages/eslint-plugin/src/public.ts:47-53`, `packages/eslint-plugin/src/config/files.ts:15`,
  `tests/plugin/files.test.ts:8-18`
- Kind: fix-bug
- Problem: `normalizePath` strips everything after the first `?` or `#` and decodes `file://` URLs. ESLint always
  gives file paths, and the generated configuration builds `root` with `fileURLToPath`, so the URL branch handles a
  state that cannot happen. The cut also hits plain paths: a file in a folder named `C#` gets the wrong relative path,
  so `import-boundaries` picks the wrong boundary.
- Fix: In `src/paths.ts`, `normalizePath = (value) => value.replaceAll('\\', '/').replace(/^[a-z]:/u, (d) => d.toUpperCase())`. Strip a `?query` only from import specifiers, inside `relativeImportPath`. Delete `FILE_SCHEME`
  and the URL test (PLG-028).
- Size: small

### PLG-020: Path code carries unused fields, a one-line wrapper, and guards for impossible inputs

- Where: `packages/eslint-plugin/src/types/files.ts:4`, `packages/eslint-plugin/src/public.ts:29-39, 72-74, 93-100`,
  `packages/eslint-plugin/src/config/files.ts:13`, `packages/eslint-plugin/src/rules/no-trivial-files.ts:145-146`,
  `packages/eslint-plugin/src/rules/import-boundaries.ts:67-69`
- Kind: simplify
- Problem: `lintedPath` returns `{ absolute, relative, root }`. `import-boundaries` reads only `relative`
  (`const { relative } = file;`), and nothing reads `root`. `no-trivial-files` calls `lintedPath` (which reads and
  type-checks `settings.gspot`, and may throw) only to look at a base name, through `isIndexFile`, a one-statement
  helper over `INDEX_BASENAMES`. `lintedRoot` throws two hand-written `TypeError`s for wrong setting types.
  `STDIN_NAMES` includes `''`, and `lintedPath` handles an empty `physicalFilename`; ESLint 9 gives neither.
- Fix: In `no-trivial-files`, write `INDEX_BASENAMES.has(posix.basename(normalizePath(context.physicalFilename)))`
  and delete `isIndexFile`. Move `lintedPath` into `rules/import-boundaries.ts`, its one user; it returns the
  root-relative path as a string, or `undefined` for standard input. Delete the `LintedPath` type. Replace
  `lintedRoot` with `const root = (context.settings.gspot as { root?: string } | undefined)?.root ?? context.cwd`.
  Read `context.physicalFilename` only, and set `STDIN_NAMES = new Set(['<input>', '<text>'])` in `config/paths.ts`.
  Do not switch to `context.filename`: with a processor (Astro, Markdown) it is a made-up name such as
  `page.astro/0_0.ts`, and relative imports must start from the real file.
- Size: small

### PLG-021: Glob matching supports `!` exclusions that nothing uses or documents

- Where: `packages/eslint-plugin/src/public.ts:82-86`, `packages/eslint-plugin/src/rules/import-boundaries.ts:28`
- Kind: simplify
- Problem: `isAnyGlobMatch` splits globs into `!`-prefixed exclusions and inclusions. Its only caller is `boundaryOf`
  in `import-boundaries`, whose `folders` option is documented as "Boundary folders or folder globs". The CLI builds
  `folders` from `*/*` and scope paths only (`packages/cli/src/generation/eslint/configuration.ts:36-39, 61-63`), and
  no test uses `!`.
- Fix: Drop the `!` branch. What is left, `globs.some((glob) => isGlobMatch(path, glob))`, goes inline in
  `boundaryOf`; delete `isAnyGlobMatch`.
- Size: small

### PLG-022: The same node-type lists are written three times

- Where: `packages/eslint-plugin/src/config/syntax.ts:1,5-12`, `packages/eslint-plugin/src/config/no/trivial/functions.ts:9-17`,
  `packages/eslint-plugin/src/types/syntax.ts:3-18`, `packages/eslint-plugin/src/rules/no-trivial-files.ts:159`,
  `packages/eslint-plugin/src/rules/no-trivial-functions.ts:206`
- Kind: merge
- Problem: The wrapper expressions that keep a value (`TSAsExpression`, `TSSatisfiesExpression`,
  `TSNonNullExpression`, `TSTypeAssertion`, `TSInstantiationExpression`) appear in `WRAPPERS`, again in
  `TRANSPARENT_EXPRESSIONS`, and again as the type `ValueOperand`. The three function node types appear as
  `FUNCTIONS`, as the type `ImplementedFunction`, and as two `:matches(...)` selector strings.
- Fix: In `config/syntax.ts`: `TYPE_WRAPPERS = [...the 5 names] as const`, `WRAPPERS = ['ChainExpression', ...TYPE_WRAPPERS]`, `TRANSPARENT_EXPRESSIONS = ['ConditionalExpression', 'LogicalExpression', ...TYPE_WRAPPERS]`,
  and one `FUNCTION_SELECTOR` that both trivial-code rules read. Use `ASTUtils.isNodeOfTypes` for the type guard and
  delete `ValueOperand`.
- Size: small

### PLG-023: Small exported-but-internal symbols and duplicated config building in the plugin entry

- Where: `packages/eslint-plugin/src/types/imports.ts:3`, `packages/eslint-plugin/src/types/plugin.ts`,
  `packages/eslint-plugin/src/rules/public.ts:23-33`, `packages/eslint-plugin/src/types/files.ts:6`
- Kind: simplify
- Problem: `ImportNode` is exported but used only to build `ImportSource`. The `Plugin` type exists for one
  `satisfies`. `allRules` and `recommendedRules` repeat the same filter-map code. The type `RuleContext` is defined in
  `types/files.ts`, but `environment.ts` and `imports.ts` spell it out longhand again.
- Fix: Inline `ImportNode` into `ImportSource` (in `types/syntax.ts`). Delete `Plugin` and the `satisfies`. Write
  `const rulesAt = (levels: string[]) => Object.fromEntries(...)` once in `src/plugin.ts`. Use the one `RuleContext`
  alias in `types/rules.ts` everywhere.
- Size: small

### PLG-024: no-trivial-functions carries code and tests for contrived patterns nobody writes

- Where: `packages/eslint-plugin/src/rules/no-trivial-functions.ts:19` (the `ArrayExpression` entry), `:43-54`
  (`isArrayElementCall`), `:57-66` (`aliases`), `:77-79` (the two breaks in `functionValue`);
  `tests/plugin/rules/no-trivial-functions.test.ts:111-118`
- Kind: simplify
- Problem: `isArrayElementCall` exists only for `[() => work()][0]()`. `functionValue` has special branches for a
  function used as the test of a ternary (`(() => work()) ? a : b`) or as the left side of `&&`. Real code never does
  this; the branches exist to make contrived test cases succeed. That is about 25 lines of rule and 12 invalid test
  cases. Two names also hide what the functions return: `aliases` returns the variables a function is called through,
  and `functionValue` returns the outermost expression.
- Fix: Delete `isArrayElementCall` and the `ArrayExpression` entry of `VALUE_HOLDERS` (any array element counts as an
  inline value). Delete the two `break` branches. Delete the matching invalid cases at `:111-118`; the valid cases at
  `:22-31` are normal code and stay. Rename `aliases` to `callableVariables` and `functionValue` to `outermostValue`.
- Size: small

### PLG-025: no-index-imports reports only paths that spell `index`, and its docs do not say so

- Where: `packages/eslint-plugin/src/rules/no-index-imports.ts:28-38`, `packages/eslint-plugin/src/config/files.ts:17`
- Kind: rewrite-text
- Problem: The rule reports only import paths that name an `index` file (`./index.js`, `@/x/index`). A folder import
  such as `import { a } from './lib'` (which reads `lib/index.ts`) and `import x from '.'` are not reported. It also
  knows only the `@/` and `#` aliases, not `~/` or configured aliases. A reader of the docs expects it to catch every
  import of an index file.
- Fix: Keep the rule; the plugin is also used without gspot. Say plainly in the rule's docs text and on its docs page
  that only import paths that name an `index` file are reported, and that a folder import such as `./lib` is not.
- Size: small

### PLG-026: Two rules report the same finding as rules gspot already turns on

- Where: `tests/plugin/rules/no-trivial-files.test.ts:82` (`';'`), `tests/plugin/rules/no-trivial-functions.test.ts:134-135`
  (empty constructors), `packages/eslint-plugin/src/rules/no-trivial-files.ts:174`,
  `packages/eslint-plugin/src/rules/no-alias-exports.ts`
- Kind: simplify
- Problem: A file that is only `;` is also reported by `unicorn/no-empty-file`. An empty constructor is also
  reported by `@typescript-eslint/no-useless-constructor`. `export const a = importedB` is what
  `unicorn/prefer-export-from` reports (gspot turns that one off at level `all` so the two do not fight). Two rules,
  one finding.
- Fix: Leave those cases to the rules that already report them. In `no-trivial-files`, skip a file whose statements
  are all empty statements (a truly empty file is already skipped by `node.body.length > 0`). In
  `no-trivial-functions`, skip only the constructors that `no-useless-constructor` reports: an empty body, or a body
  that only calls `super` with the same arguments. Keep reporting other small constructors such as
  `constructor() { setup(); }`, which no other rule reports. Delete the matching test cases
  (`no-trivial-files.test.ts:82`, `no-trivial-functions.test.ts:134-135`).
- Size: small

### PLG-027: configuration.test.ts has tests that repeat each other

- Where: `tests/plugin/configuration.test.ts:18-72`
- Kind: delete
- Problem: Test 2 checks that `no-trivial-functions` is on at `all` and off at `recommended`. Test 3 checks the same
  for `no-alias-exports`, and that `no-client-env` reports at both levels. Both check one fact: which rules each level
  turns on. Test 2 alone sits in a `describe` with one test. The same-plugin-object test runs once per level, but its
  check does not depend on the level.
- Fix: Delete test 2 and its `describe`. Test 3 is the one level test in `tests/unit/eslint-plugin/plugin.test.ts`:
  for each level it checks an `all`-only rule (`no-alias-exports`) and a `recommended` rule (`no-client-env`). Keep
  the same-plugin-object test, which guards a real ESLint error, with one row (`all`).
- Size: small

### PLG-028: files.test.ts writes a file to disk to test a string function

- Where: `tests/plugin/files.test.ts:8-23`
- Kind: delete
- Problem: The first test creates a temporary folder and a file, turns the path into a URL, normalizes it, compares
  strings, then reads the file back. The read proves nothing about `normalizePath`, and the branch it tests goes with
  PLG-019. The second test (Windows paths) repeats the "import-boundaries on Windows paths" run, which lints a file
  under `C:` with a root under `c:` and backslashes, so it fails unless `normalizePath` works.
- Fix: Delete `tests/plugin/files.test.ts`.
- Size: small

### PLG-029: The inherited-method exemption of no-trivial-functions is tested only through a full generated configuration

- Where: `packages/eslint-plugin/src/rules/no-trivial-functions.ts:146-162`,
  `tests/cli/generation/eslint/functions.test.ts:7-29`
- Kind: move
- Problem: `hasInheritedContract` (methods required by an interface or a base class) has no case in the plugin's own
  tests; the RuleTester sets no `projectService`. It is tested only by a CLI test that writes a gspot.toml, generates
  the whole ESLint configuration, and runs typed ESLint. "Contract" is also a filler word.
- Fix: Rename `hasInheritedContract` to `isInheritedMethod`. Move the `Runner`/`Base` case into
  `tests/unit/eslint-plugin/rules/no-trivial-functions.test.ts` as a second RuleTester run with
  `parserOptions: { projectService: { allowDefaultProject: ['*.ts'] }, tsconfigRootDir }`. The CLI test keeps one
  check: the generated TypeScript configuration gives lint rules type information
  (`tests/unit/cli/generation/eslint/fragments/typescript.test.ts`).
- Size: small

### PLG-030: import-boundaries tests repeat a case, carry unused data, and repeat a long type 4 times

- Where: `tests/plugin/rules/import-boundaries.test.ts:6-9, 34-39, 74-79, 83-86, 159-162, 178-181`,
  `tests/config/plugin/rules/boundaries.ts:1`
- Kind: simplify
- Problem: The cases `'../a.js'` from `scripts/inner/b.ts` and from `lib/inner/b.ts` (both with aliases, both
  `escape`) test the same thing. No case matches the `'@tests/': 'tests/'` alias. Each of the 4 runs repeats
  `run<keyof (typeof plugin.rules)['import-boundaries']['meta']['messages'], [Partial<ImportBoundariesOptions[0]>]>`.
- Fix: Delete the `lib/inner` case and the `@tests/` alias from `IMPORT_ALIASES`. Merge the runs into two (the
  Windows run needs its own root). Write the type once as `type Options = [Partial<ImportBoundariesOptions[0]>]`.
- Size: small

### PLG-031: tests/config/plugin copies the test tree for three tiny data files

- Where: `tests/config/plugin/rules/no-client-env.ts`, `tests/config/plugin/rules/boundaries.ts`,
  `tests/config/plugin/environment.ts`, `gspot.toml:458-461`
- Kind: move
- Problem: Three files of one or two values each sit in a folder that copies the test tree. `boundaries.ts` holds
  the data of `import-boundaries` without its name, and `EXAMPLE` says nothing. The folder is also the reason
  `tests/config/plugin/rules/**` is in the `structure/prefix-collisions` ignore.
- Fix: Move `ENVIRONMENT_GLOBALS`, `ALIASES` (as `IMPORT_ALIASES`) and `EXAMPLE` (as `CLIENT_ENV_SAMPLE`) into
  `tests/config/eslint-plugin.ts`. Write `FOLDERS`, a two-item list, inside `import-boundaries.test.ts`. Delete
  `tests/config/plugin/`. The `structure/prefix-collisions` ignore in `gspot.toml` then lists
  `["packages/eslint-plugin/src/rules/**", "tests/unit/eslint-plugin/rules/**"]`: ESLint rule names share their first
  word by convention.
- Size: small

### PLG-032: The rule-tester setup has an unused option, a self-policing throw, and a comment that needs two Vale ignores

- Where: `tests/harness/rule-tester.ts:11-15, 22-23, 33-34`, `gspot.toml:346, 364`
- Kind: simplify
- Problem: `tsconfigRootDir` matters only for typed linting, and the shared setup enables none. Its comment ("...which
  a leading slash is not on Windows; the rules keep the posix root.") is the reason the file is in two Vale ignores
  (`Google.Semicolons`, `gspot.case-sensitive-terms`). `RuleTester.itOnly` throws "Focused rule tests are not
  permitted", a check nobody asked for. A blank line separates a JSDoc comment from its function.
- Fix: The file moves to `tests/setup/rule-tester.ts` (THR-036). Delete the `tsconfigRootDir` line and its comment;
  the typed run of PLG-029 sets its own `tsconfigRootDir`, with a comment that has no semicolon. Every path-sensitive
  case already uses an absolute file name and `settings.gspot.root`. Set `RuleTester.itOnly = it.only` like the other hooks: forbidding focused tests polices how developers write tests, which nobody asked for. Remove the file from both Vale ignore lists, and remove the blank line.
- Size: small

### PLG-033: The plugin README repeats itself and uses unclear words

- Where: `packages/eslint-plugin/README.md:35-36, 70-72, 74-81, 105-107`
- Kind: rewrite-text
- Problem: "The rule reference lists every rule with its options and examples" is said twice. "`gspot.configs.all`
  also turns on the rules selected at level `all`" is circular. The `settings.gspot.root` section does not say which
  rule reads it (only `import-boundaries`).
- Fix: Delete the repeated sentence at `:105`. Keep the next sentence (what the package ships, and that `gspot.rules`
  holds each rule) without "and CommonJS" (PLG-013). Replace `:35` with "`gspot.configs.all` also turns on the
  house-style rules: header-first, import-boundaries, no-alias-exports, no-index-imports, no-trivial-files and
  no-trivial-functions." Start the root section with "`import-boundaries` reads folder paths from the repository
  root." PLG-017 deletes the sentence at `:70-72`.
- Size: small

### PLG-034: Rule descriptions use jargon

- Where: `packages/eslint-plugin/src/rules/import-boundaries.ts:43`,
  `packages/eslint-plugin/src/rules/no-trivial-functions.ts:185`,
  `packages/eslint-plugin/src/rules/no-trivial-files.ts:121,133`
- Kind: rewrite-text
- Problem: "The default `*/*` selects each top-level folder under each root"; "helpers with two or more lexical reads
  remain shared implementations"; "Allow an index file when it serves the configured library export contract". These
  texts become the public docs pages.
- Fix: import-boundaries: "By default every second-level folder, such as `src/cart` or `packages/shop`, is a
  boundary." no-trivial-functions: "A function used in two or more places, or exported, is not reported."
  no-trivial-files `allowIndex`: "Allow a file named index that only re-exports."
- Size: small

### PLG-035: package.json leftovers

- Where: `packages/eslint-plugin/package.json:15-16, 24-27, 35-43`
- Kind: simplify
- Problem: The published file carries an `imports` field that points into `src/`, which is not published. `"main"`
  and the top-level `"types"` repeat `exports`. The `typescript` devDependency repeats the root one. TypeScript is a
  required peer, so JavaScript-only users must install it.
- Fix: Delete `imports` (PLG-015), `main` and the top-level `types` (PLG-013). Keep the `eslint` devDependency: the
  e2e test reads its version. `scripts/build.ts` runs the declaration build from the repository root, so delete the
  plugin's `typescript` devDependency if `mise run build` still finds `tsc` from the root `typescript` package. Add
  `"peerDependenciesMeta": { "typescript": { "optional": true } }` only after checking that `@typescript-eslint/utils`
  works without TypeScript for the rules used.
- Size: small

### PLG-037: The knip entry for the plugin exists only because the entry file name differs from its build name

- Where: `gspot.toml:270`, `.gspot/config/knip.json:127, 180`
- Kind: delete
- Problem: `packages/eslint-plugin/src/rules/public.ts` is listed as a knip entry by hand. knip maps
  `dist/<name>.js` back to `src/<name>.ts` through the tsconfig `outDir` and `rootDir`, but `dist/plugin.js` has no
  `src/plugin.ts`.
- Fix: Do after PLG-006. Remove the path from `tools.knip.entry` and run `gspot apply`.
- Size: small

### PLG-040: Generated tool files ignore files that do not exist

- Where: `.gspot/config/eslint.config.mjs:182-191`, `.gspot/config/knip.json:13-26`
- Kind: simplify
- Problem: The ESLint ignores list `docs/prettier.config.mjs`, `packages/cli/prettier.config.mjs`,
  `packages/eslint-plugin/prettier.config.mjs` and `tests/prettier.config.mjs`. knip ignores `ruff.toml`,
  `pyrightconfig.json`, `docs/ruff.toml`, `docs/pyrightconfig.json`, `packages/cli/ruff.toml`,
  `packages/cli/pyrightconfig.json`, `packages/eslint-plugin/ruff.toml`, `packages/eslint-plugin/pyrightconfig.json`
  and `tests/.markdownlint-cli2.mjs`. None of these 13 files exist. The ignores change no result, but they are noise.
- Fix: In generation, ignore only the pointer files gspot writes for each scope. Do not edit files under `.gspot/` by
  hand.
- Size: small

### PLG-043: gspot structural rule blocks restate the plugin defaults 10 times

- Where: `packages/cli/src/generation/eslint/contracts.ts:114-136`, `.gspot/config/eslint.config.mjs:1474-1497`
- Kind: simplify
- Problem: For each scope, and for JavaScript and TypeScript apart, the CLI writes
  `gspot/no-trivial-files: ['error', { maxStatements: 2, allowIndex: false }]` and
  `gspot/no-trivial-functions: ['error', { maxStatements: 2 }]`. Those are the plugin defaults, and the main block
  already turns both rules on. The generated file has 10 identical blocks.
- Fix: Do after POL-015. `structure.reexports` is root only (POL-015), so `allowIndex` is one root value. Emit one
  block for JavaScript and TypeScript together when their limits are equal, a scope block only when the scope's limit
  differs from the root (GEN-019), and no block when the options equal the plugin defaults. In this repository that
  leaves no block.
- Size: small

### PLG-045: `gspotRules` holds rules that are not gspot rules, next to a second list for the same purpose

- Where: `packages/cli/src/generation/eslint/configuration.ts:57-74, 112-118`
- Kind: merge
- Problem: `gspotRules` returns `gspot/import-boundaries` plus `import-x/exports-last` and
  `barrel-files/avoid-barrel-files`. `importLayoutRules` is a second level-`all` list with `import-x/first` and
  `import-x/newline-after-import`. Two lists do one job, and one name is wrong.
- Fix: One field, `allLevelRules`, holds all five. The ESLint tool file source spreads it once.
- Size: small

### PLG-048: Every function in `generation/eslint/` repeats "eslint" in its name

- Where: `packages/cli/src/generation/eslint/public.ts` (`eslintFilePatterns`, `eslintModule`, `eslintErrorRules`,
  `eslintRuleSettings`, `eslintSourcePattern`, `eslintNodePatterns`, `readEslintPresets`, `readEslintRuleNames`,
  `validateEslintPresets`, `serializeEslintBlock`), `contracts.ts` (`eslintRuleOptions`, `eslintIgnoreBlocks`)
- Kind: rename
- Problem: The folder already says `eslint`. The prefix is filler and makes call sites long.
- Fix: In the files EXG-002 names: `eslintFilePatterns` to `filePatterns`, `eslintSourcePattern` to `sourcePattern`,
  `eslintNodePatterns` to `nodePatterns`, `serializeEslintBlock` to `serializeBlock`, `readEslintPresets` to
  `readPresets`, `eslintRuleOptions` to `ruleOptions`, `eslintIgnoreBlocks` to `ignoreBlocks`. Keep `eslint` on the
  names the ESLint tool file sources use beside other tools' values: `eslintModule`, `eslintErrorRules`,
  `eslintRuleSettings`, `eslintInputs`. `readEslintRuleNames` goes (PLG-049), and `validateEslintPresets` moves to
  `scripts/build.ts` (PLG-012).
- Size: medium

### PLG-049: Rule-list files are read two different ways

- Where: `packages/cli/src/generation/eslint/public.ts:229-235`, `packages/cli/src/policy/schema/tools.ts:4`,
  `packages/cli/src/generation/compilation/public.ts:34`
- Kind: simplify
- Problem: `eslint-rule-names.json` is read at run time with `readAsset` and a zod schema. `runtime-names.json` and
  `css/rule-names.json`, written by the same script, are imported as JSON modules. Same kind of data, two ways.
- Fix: Import `eslint-rule-names.json` as a JSON module, like `eslint-runtime-names.json` and
  `stylelint-rule-names.json` (CFL-040's names). Delete `readEslintRuleNames` and `ESLINT_RULE_NAMES_FILE` from the
  CLI; `explain` reads the imported list. The schema `eslintRuleNamesSchema` moves into
  `scripts/update-rule-lists.ts`, which checks each list when it writes it, and the script names the file in
  `scripts/config/rule-lists.ts`.
- Size: small

### PLG-051: The rule URL and the default boundary folders are written inline, and the URL uses the old docs path

- Where: `packages/eslint-plugin/src/create-rule.ts:7`, `packages/eslint-plugin/src/rules/import-boundaries.ts:34, 43`,
  `packages/cli/configurations/language/javascript/manifest.toml:315` (`rule_url`),
  `packages/cli/src/config/generation/eslint.ts:34` (`ESLINT_BOUNDARY_FOLDERS`)
- Kind: move
- Problem: `createRule` builds the rule docs URL `https://generativespotting.com/reference/plugin/{name}/` inline, and
  `import-boundaries` writes its default `['*/*']` inline. The CLI writes the same two values (`rule_url` and
  `ESLINT_BOUNDARY_FOLDERS`). The rule pages live under `/reference/eslint-plugin/` (DCP-015), so both URL copies
  point at the old path. The plugin and the CLI may not import each other, so each package keeps its own copy.
- Fix: In the plugin, `RULE_URL = 'https://generativespotting.com/reference/eslint-plugin/{name}/'` goes to
  `config/plugin.ts` and `DEFAULT_FOLDERS = ['*/*']` to `config/imports.ts`. The CLI keeps `ESLINT_BOUNDARY_FOLDERS`
  in `config/generation/eslint.ts`, and its `rule_url` becomes
  `https://generativespotting.com/reference/eslint-plugin/{rule}/`. Change both URL copies in the same commit.
- Size: small

### PLG-052: One number has two names that point opposite ways

- Where: `packages/cli/configurations/general/structure/manifest.toml:232-238` (`limits.min_function_statements`),
  `packages/cli/src/generation/eslint/contracts.ts:119-132`, `packages/eslint-plugin/src/rules/no-trivial-files.ts:127`,
  `packages/eslint-plugin/src/rules/no-trivial-functions.ts:191`
- Kind: rename
- Problem: The CLI setting `limits.min_function_statements` sends its number to the plugin option `maxStatements`.
  With the default 2, a function with 2 statements is reported, so `maxStatements` reads as the largest allowed size,
  which it is not.
- Fix: Rename the plugin option to `trivialStatements` in both trivial-code rules, with the docs text "Functions with
  this many statements or fewer are reported." The CLI setting keeps the name `limits.min_function_statements`, and
  its reference text says the same sentence.
- Size: small

### PLG-054: The update script has hidden side effects and one-caller helpers

- Where: `scripts/eslint-presets.ts:32-33, 97-100, 114-119`, `scripts/parsers/npm.ts:17-30`
- Kind: simplify
- Problem: `process.chdir(project)` changes the working folder of the whole process only so that
  `join(process.cwd(), 'capture.css')` points into `tests/`. `readInstalledNpmPackage` lives in a shared parser file,
  but only this script uses it. `writeFormattedJson` has one caller.
- Fix: Build the sample path from the tests folder (`join(project, ...)`, with the file name in
  `scripts/config/rule-lists.ts`) and drop `chdir`. `readInstalledNpmPackage` moves into
  `scripts/update-rule-lists.ts` (ROOT-019) and becomes part of `installedAtPin` (PLG-010). Write `writeFormattedJson`
  inline in the final loop.
- Size: small

### S03-011: Two plugin rules write the same selector and the same framework names twice

- Where: `packages/eslint-plugin/src/rules/import-boundaries.ts:100`, `packages/eslint-plugin/src/rules/no-index-imports.ts:40, 51`,
  `packages/eslint-plugin/src/config/no/index-imports.ts:2-5`
- Kind: merge
- Problem: The selector `'ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression'` is typed
  in two rules. `no-index-imports` tests `framework !== 'vi' && framework !== 'jest'`, which are the keys of
  `MODULE_MOCK_METHODS` one line below.
- Fix: One `IMPORT_SELECTOR` in `src/config/syntax.ts`, read by both rules. Test
  `Object.hasOwn(MODULE_MOCK_METHODS, framework)`.
- Size: small

### DEC-022: The plugin's `config/` and `types/` mirror the rules, with three-level folders for one-caller constants

- Where: `packages/eslint-plugin/src/config/` (9 files), `packages/eslint-plugin/src/types/` (10 files), including
  `config/no/index-imports.ts`, `config/no/trivial/files.ts`, `config/no/trivial/functions.ts`,
  `types/no/trivial/files.ts`, and `types/no/trivial/functions.ts`
- Kind: move
- Problem: The 19 files hold 163 lines. Several hold one line (`types/environment.ts`, `types/import-boundaries.ts`,
  `config/layout.ts`), most have one user, and the `no/` and `no/trivial/` folders exist only to get past the
  `structure/prefix-collisions` check. A reader of `no-trivial-files.ts` opens four more files to see its constants and
  types. Fixed values are also still written inline in rule bodies.
- Fix: Group by topic, as the Layout above shows. Seven config files: `comments`, `environment`, `imports`, `nextjs`,
  `paths`, `plugin`, `syntax`. Two types files: `rules`, `syntax`. `MODULE_MOCK_METHODS` goes to `config/imports.ts`;
  the node-type lists of both trivial-code rules (`STRUCTURED_EXPRESSIONS`, `FORWARDING_NODES`, `VALUE_PARENTS`,
  `MIN_SHARED_READS`, `EXPORT_REFERENCES`, `TRANSPARENT_EXPRESSIONS`) go to `config/syntax.ts`; the option types
  `TrivialFilesOptions` and `TrivialFunctionsOptions` go to `types/rules.ts`, and `ContentCheck` to `types/syntax.ts`.
  The inline values move there too: `DEFAULT_FOLDERS` and `RELATIVE_PREFIXES` to `config/imports.ts`;
  `PUBLIC_PREFIXES`, `CLIENT_DIRECTIVE`, `SERVER_DIRECTIVE` and `SERVER_ONLY_MODULE` to `config/nextjs.ts`;
  `TRAILING_SLASH` and `TRAILING_STAR` to `config/paths.ts`; `RULE_URL` and `PLUGIN_PREFIX` to `config/plugin.ts`;
  `LINE_BREAK_GAP` and `LEADING_LINE_BREAK` to `config/comments.ts`; `IMPORT_SELECTOR`, `FUNCTION_SELECTOR` and
  `SHEBANG` to `config/syntax.ts`. Name the values for what they are: `DIRECTIVE_PREFIXES` becomes
  `TOOL_COMMENT_PREFIXES`, `TS_DIRECTIVE` becomes `TS_COMMENT`, `SHARED_READS` becomes `MIN_SHARED_READS` (a minimum),
  and the type `FunctionBinding` becomes `NamedFunction`. Delete `config/build.ts`, `config/files.ts`,
  `config/layout.ts`, `config/no/`, `types/no/`, `types/create-rule.ts`, `types/environment.ts`, `types/files.ts`,
  `types/import-boundaries.ts`, `types/imports.ts`, `types/layout.ts` and `types/plugin.ts`. No two of the new names
  share a prefix, so the prefix-collision check stays quiet without an ignore. In `gspot.toml`, the plugin gets the
  same two `[[architecture.module]]` records as every package: `packages/eslint-plugin/src/config/**` may import
  nothing, and `packages/eslint-plugin/src/types/**` may import only that config module.
- Size: medium
