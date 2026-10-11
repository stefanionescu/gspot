# General checks

gspot runs most checks by starting an outside tool (ESLint, Ruff, Vale). Some checks are TypeScript code inside
gspot: the built-in checks. This area holds that code for the general configurations (gspot.toml, repository, docs,
prose, duplication, secrets, commits, security, dependencies, licenses, naming, structure), the site checks that sit
under `general/` today, the table that maps each check ID to its function, `checks/finding.ts`, and the matching
`config/` and `types/` files. The target: one file or folder per check, named like the check ID; no check that only
polices this repository's own layout; no second copy of a rule another tool already reports; constants in
`config/` and types in `types/`, grouped by configuration group.

## Findings

### CKG-001: site/sitemap does nothing on Astro sites, including gspot's own docs site

- Where: `packages/cli/src/checks/general/site/public.ts:211-244` (line 214), `packages/cli/src/config/checks/general/site.ts:5`
- Kind: fix-bug
- Problem: The sitemap check looks only for `sitemap.xml`. Astro and many other builders write `sitemap-index.xml`
  and `sitemap-0.xml`. When `sitemap.xml` is missing, the check returns no findings and passes (line 214:
  `if (!files.has('sitemap.xml')) return [];`). So it checks nothing on gspot's own docs site: `gspot.toml` selects
  `site` for the `docs` scope, and `docs/dist` holds only `sitemap-index.xml` and `sitemap-0.xml`. The Linkinator check
  in the same file already knows both names (`SITEMAP_FILES`), so the two checks disagree.
- Fix: In `sitemap()` (`checks/framework/site/built-pages.ts`, CKG-029), read every built file that matches
  `SITEMAP_FILE = /^sitemap.*\.xml$/u` (in `config/checks/framework/site.ts`), follow `<loc>` values that end in
  `.xml` (index files), and collect the page URLs from the rest. Put this in one function, `sitemapUrls(build)`, that
  `sitemap()` and `linkinator()` both call, so the two checks cannot disagree again. Delete `SITEMAP_FILES`. The fix
  ships without a new test.
- Size: small

### CKG-003: structure/folder-names repeats what naming/paths already reports

- Where: `packages/cli/src/checks/general/structure/folder-names.ts:1-37`,
  `packages/cli/src/checks/general/naming/contracts.ts:204`, `packages/cli/src/checks/public.ts:201`
- Kind: merge
- Problem: The `folders` word group is `common, core, helper, helpers, util, utils, support, misc, shared`. Eight of
  these nine words are also in the `containers` and `roles` groups, which naming/paths already checks against every
  folder name. So a folder named `helpers/` gets one finding from naming/paths (`banned-term`) and one from
  structure/folder-names (`container-name`), both at level `all`. Only `shared` is unique to the folders group. The
  naming settings builder filters the folders group out (`naming/contracts.ts:204`,
  `.filter(([group]) => group !== 'folders')`) so that folder-names can report it. folder-names also looks at code
  files that no language configuration covers; naming/paths looks only at covered files, so the merge drops only
  those rare folders.
- Fix: Delete `folder-names.ts`, its line in the check table, and its `[[check]]` block in the structure manifest. In
  `readNamingSettings` (CKG-030), stop filtering out the `folders` group. Give its terms a category limit instead: add
  `categories?: string[]` to `Term` (`types/checks/general.ts`), set it to `['directories']` for the folders group,
  and skip the term in `termFindings` when the category does not match. The folders group stays complete in the
  shipped naming defaults (`naming/defaults.json`, today `policy.json`). The folder-bans test of TCG-012 moves to
  `tests/unit/cli/checks/general/naming/checks/paths.test.ts` and expects `banned-term` on folder names.
- Size: medium

### CKG-004: gspot/suppressions and ESLint both demand a reason on the same comments

- Where: `packages/cli/src/checks/general/structure/public.ts:113-146`,
  `packages/cli/configurations/language/javascript/manifest.toml:292,387-391,436`,
  `packages/cli/configurations/language/javascript/eslint.config.mjs.eta:7-9,277-279`,
  `packages/cli/configurations/language/typescript/eslint.fragment.js.eta:28`
- Kind: merge
- Problem: For `eslint-disable` comments, ESLint's `@eslint-community/eslint-comments/require-description` already
  demands a `-- reason`, and gspot/suppressions demands the same again. For `@ts-expect-error`,
  `@typescript-eslint/ban-ts-comment` demands a 10-character description and gspot/suppressions a two-word reason.
  One missing reason gives two findings under two rules. For `@ts-ignore`, ESLint bans the comment outright while
  gspot/suppressions only asks for a reason, so the two give conflicting advice. `require-description` is the only
  rule of the eslint-comments plugin that gspot turns on.
- Fix: gspot/suppressions covers every tool with one rule, so it is the one check that asks for a reason. Delete
  `@eslint-community/eslint-comments/require-description` from the ESLint lint rule tables
  (`config/generation/eslint-rules.ts`; today `eslint.config.mjs.eta:277-279`). Delete the plugin: its `[[tool]]`
  record in `language/javascript/manifest.toml:387-391` (the builder in `generation/eslint/configuration.ts` then
  writes no import for it), the `commentLevel` field, which is always `'error'`
  (`generation/eslint/configuration.ts:119`, `types/generation/eslint.ts:90`), and the plugin checks in
  `tests/unit/cli/generation/eslint/configuration/suppression-comments.test.ts` (today
  `tests/cli/generation/eslint/policy.test.ts:79-114`). In `TYPESCRIPT_RULES` (`config/generation/eslint-fragments.ts`;
  today `typescript/eslint.fragment.js.eta:28`), set `'ts-expect-error': false` and keep `'ts-ignore': true, 'ts-nocheck': true`, so ESLint only bans those two comments. Leave the tsc suppression syntax as it is: the manifest
  schema allows one suppression syntax per tool (`parsers/schema/public.ts:118-125`).
- Size: small

### CKG-005: naming/policy and gspot/unmatched-paths report the same naming settings twice

- Where: `packages/cli/src/checks/general/naming/identifiers.ts:73-102` (lines 85-90 `dead`),
  `packages/cli/src/checks/general/contracts.ts:28-105,246-259`
- Kind: merge
- Problem: Two checks that run once look for unused naming settings. (1) A naming override whose `paths` match
  nothing is reported by naming/policy ("matches no file") and again by gspot/unmatched-paths ("matches no tracked
  file or folder"), because the override `paths` field has a path role (`parsers/schema/naming.ts:15`), so the path
  walk visits it. (2) Unused allowed names are split: naming/policy checks `naming.allowed`, gspot/unmatched-paths
  checks the `allowed` field of the overrides. Both call `declaredNames()`, which reads every name out of every source
  file, so a normal run does that work twice.
- Fix: Allowed names live only in the root `[[naming.override]]` records, field `allowed_names` (TMF, CFR-004). Move
  the unused-name report (`unusedNames()`) into the naming/settings check (`namingSettings` in `naming/checks.ts`,
  CKG-030) and call `declaredNames()` once there, over the root record list. Paths are relative to the repository
  root (CFR-003), so no scope prefix is added. Delete the `dead` block (`identifiers.ts:85-90`): gspot/unused-entries
  already reports override paths that match nothing, and it then checks only the paths written in gspot.toml. Move
  the three naming rows of `NATIVE_EXCEPTION_CASES` (`tests/config/cli/checks/general/gspot.ts:88-157`) to
  `UNUSED_NAME_CASES` in `tests/config/naming/settings.ts`, which
  `tests/unit/cli/checks/general/naming/checks/settings.test.ts` reads. POL-059 gives these reports one rule name.
- Size: medium

### CKG-006: The "unused ignore" report reruns every structure check a second time, and only structure checks

- Where: `packages/cli/src/checks/general/contracts.ts:107-149`, `packages/cli/src/checks/public.ts:232-239`
- Kind: delete
- Problem: `unusedIgnores()` reruns each `structure/*` check without one `[[ignore]]` record to see whether the
  record hides anything. It skips every other check (line 117,
  `if (!name.startsWith('structure/') || implementation === undefined) continue;`), a hidden special case. It is also
  the only reason gspot/unmatched-paths needs the whole session and the full check list, which forces the inline
  wrapper function in `checks/public.ts:232-239`.
- Fix: Delete `unusedIgnores()` and its report (rule `unused-ignore`). Make `unusedEntries(input)`
  (`checks/general/gspot/unused-entries.ts`, CKG-028) a plain check with one argument: it reads
  `input.repositoryFiles` instead of `session.repository.files` (the same list for a check that runs once,
  `execution/contracts.ts:296`). List it as `'gspot/unused-entries': unusedEntries` in `CHECK_FUNCTIONS`
  (`checks/built-in.ts`, ARC-003) and delete the wrapper. Delete the `unusedIgnores` field, the ignore rows of
  `NATIVE_EXCEPTION_CASES` (`tests/config/cli/checks/general/gspot.ts`), and the `unused-ignore` assertion in
  `tests/cli/checks/general/gspot.test.ts:110`. Do not rebuild the report from the count of findings each ignore
  matched (`execution/public.ts:308`): an `[[ignore]]` with `paths` and no `rule` removes those files before the
  check runs (`planning/files.ts:61-75`), so its count is 0 even when it hides real findings.
- Size: medium

### CKG-007: A lint suppression hides that a "map" function is used as a "walk"

- Where: `packages/cli/src/checks/general/contracts.ts:36-58`, `packages/cli/src/policy/paths.ts:47`
- Kind: simplify
- Problem: `// eslint-disable-next-line sonarjs/no-invariant-returns` exists because `mapPolicyPaths` expects a
  callback that returns a new path, but `unmatchedPatterns` only looks at each path. The callback returns its input
  unchanged on every branch, which the lint rule correctly reports. It is the only suppression in this area.
- Fix: In `unusedEntries` (CKG-028), write `visit` with a single `return pattern;` at its end, and wrap the finding
  code in one `if` (the path role is not `destination` and the pattern matches nothing; the module-name test goes
  with TML-001). The rule reports only a function with two or more `return` statements (`eslint-plugin-sonarjs`
  S3516, `rule.js:197`), so the suppression goes without a second path walker in `policy/paths.ts`.
- Size: small

### CKG-008: linkinator.ts copies Linkinator's own command-line option parsing for a file that is never there

- Where: `packages/cli/src/checks/general/site/linkinator.ts:10-13,19-57`,
  `packages/cli/src/types/checks/general/site.ts:13-36,56-57`, `packages/cli/src/config/checks/general/site.ts:7`
- Kind: delete
- Problem: The program calls Linkinator's `getConfig({})`, which reads `linkinator.config.json` from the current
  folder, then parses `header`, `statusCode`, `skipFragment`, and the rewrite flags again. These 40 lines are copied
  from `linkinator/build/src/cli.js` (the same error messages word for word). The current folder is the built site
  output (`cwd: build.folder`, `site/public.ts:55`), and the site configuration replaces a user's
  `linkinator.config.json`. So the read finds nothing in practice, and no test covers it. With no config file,
  `timeout: Number(flags.timeout)` and `concurrency: Number(flags.concurrency)` pass `NaN`, and Linkinator falls back
  to its defaults.
- Fix: Delete `getConfig`, lines 19-57, and the `flags.*` options in the `check()` call; keep `path`, `serverRoot`,
  `recurse`, `checkFragments`, `urlRewriteExpressions`, and `linksToSkip`. Delete the `getConfig` field of
  `apiSchema` (CKG-017 deletes the rest of it), `LinkinatorFlags`, `LinkinatorOptionsReader`, and
  `LINKINATOR_STATUS_ACTIONS`. The program becomes `checks/framework/site/linkinator-program.ts` (CKG-029); S01-009
  keeps its small type.
- Size: small

### CKG-010: structure/config-logic exists to police this repository's own config/ folder rule

- Where: `packages/cli/src/checks/general/structure/config-logic.ts:1-101`,
  `packages/cli/src/config/checks/general/structure.ts:33-59`, `packages/cli/src/checks/public.ts:110`, structure
  manifest check `config-logic`, `tests/cli/checks/general/structure/config-logic.test.ts`
- Kind: delete
- Problem: The check says every file in the `config` role may hold only plain values: no functions, no calls except
  `new Set/Map/RegExp`, no `await`, no imports from outside config. That is this repository's own AGENTS.md rule for
  `config/` folders, which AGENTS.md calls "specific to this repository and not required of consumer repositories".
  It ships to users anyway. It does nothing unless a repository sets `architecture.roles.config` (default `{}`); only
  this repository does (`gspot.toml:160`), and no shipped configuration does. So it costs code and tests and gives
  users nothing.
- Fix: Delete the check (`config-logic.ts`), `CONFIG_STATEMENTS`, `CONFIG_LOGIC_NODES`, `CONFIG_CALL_ALLOWED`, its
  line in the check table, its `[[check]]` block in the structure manifest, its test, and its row in
  `docs/src/config/example.json`. The `config` role, `ROLE_ORDER`, and `roleDescriptors` go with TML-001.
- Size: small

### CKG-011: structure/test-placement exists to police this repository's test layout

- Where: `packages/cli/src/checks/general/structure/test-placement.ts:1-88`,
  `packages/cli/src/config/checks/general/structure.ts:77-84`, `packages/cli/src/checks/public.ts:202`,
  `tests/cli/checks/general/structure/test-placement.test.ts`
- Kind: delete
- Problem: It reports any JS/TS file in a test folder that is not a test and has no `expect` import, unless it sits
  in the folder named by `architecture.roles.test_harness`. That is this repository's own test layout, turned into a
  shipped check. It builds a full TypeScript program to find `expect` imports, and it finds the test folder with its
  own code instead of `harnessFolders()` (CKG-051). Only this repository sets the role (`gspot.toml:164`), so it does
  nothing anywhere else.
- Fix: Delete the check, `TEST_PATTERN`, `ASSERTION_MODULES`, `TEST_DIRECTORIES`, its line in the check table, its
  `[[check]]` block in the structure manifest, and its test. The `test_harness` role goes with TML-001.
- Size: small

### CKG-012: dependencies/package-json says it checks exact versions; it does not

- Where: `packages/cli/configurations/general/dependencies/manifest.toml` (check `package-json`: `summary`, and
  `example`, `why`, `help` at lines 74, 80, 81), `packages/cli/src/checks/general/dependencies/manifests.ts`
- Kind: rewrite-text
- Problem: The summary says "Checks every package.json: exact versions, one packageManager ...", and the `example`,
  `why`, and `help` also talk about exact versions. The exact-version code was removed on 2026-10-08 (commit
  ca2975ca5); ESLint `package-json/restrict-dependency-ranges` now pins versions (set to `pin`). Users read a promise
  the check does not keep.
- Fix: Summary: "Checks every package.json: the root names a packageManager, every package names the same one, a
  workspace root is private, and only one kind of lockfile exists." Example: "A repository with both `bun.lock` and
  `package-lock.json` reports a second lockfile. Delete the lockfile of the package manager the repository does not
  use." Why: "Two package managers install two different trees." Help: "Name one packageManager in the root
  package.json, use it in every package, mark a workspace root private, and delete the other lockfile."
- Size: small

### CKG-014: Facts about each lockfile live in three tables that must agree

- Where: `packages/cli/src/config/checks/general/dependencies.ts:2,10-16`,
  `packages/cli/src/config/parsers/lockfiles.ts:2-60`,
  `packages/cli/src/checks/general/dependencies/lockfile/fresh.ts:13-33`
- Kind: merge
- Problem: The frozen-install command is in `LOCKFILES`, the "lockfile is out of date" message pattern is in
  `STALE_LOCKFILE_DIAGNOSTICS`, and the list of JavaScript package managers is `JAVASCRIPT_CLIENTS`
  (`new Set(['bun','npm','pnpm','yarn'])`), which repeats the `client` values of the `LOCKFILES` rows with
  `configuration: 'javascript'`. Because the tables can drift apart, `fresh.ts:26-27` needs a guard ("No stale
  lockfile diagnostic is known for ...").
- Fix: Add a `stale` pattern field to each `LOCKFILES` row that has `frozen` (`LOCKFILES` stays in
  `config/parsers/lockfiles.ts`). Delete `STALE_LOCKFILE_DIAGNOSTICS`, `JAVASCRIPT_CLIENTS` (`lockfileHosts` and
  `lockfileFindings` filter `LOCKFILES` by `configuration === 'javascript'`), and the guard in `lockfileRefusal`.
- Size: small

### CKG-015: The settings-format fix reads gspot.toml twice to catch a change "while it runs"

- Where: `packages/cli/src/checks/general/contracts.ts:215-237` (lines 217-221)
- Kind: simplify
- Problem: `fixPolicyLayout` reads the file through the ownership log, reads it again with `readPolicyFile`, and
  throws if the two reads differ. The reads are back to back, so the guard protects against almost nothing. The write
  step already refuses to write if the file changed (`planReplacement(..., expected)`).
- Fix: In `fixSettingsFormat` (`checks/general/gspot/settings-format.ts`, CKG-028), read once:
  `const original = log.files.read(SETTINGS_FILE)`; if it is undefined, throw the same "There is no gspot.toml"
  error; else `const previous = decodeSettingsText(original.bytes)`. Delete the comparison and its error.
- Size: small

### CKG-016: Guards that check the shipped manifests again at run time

- Where: `packages/cli/src/checks/general/repository.ts:18-21`, `packages/cli/src/checks/general/docs.ts:26-29`,
  `packages/cli/src/checks/general/contracts.ts:158-161`, `packages/cli/src/checks/general/security.ts:105-106`,
  `packages/cli/src/checks/general/public.ts:43`, `packages/cli/src/checks/general/site/public.ts:101,149`
- Kind: delete
- Problem: These throw if the check's own shipped manifest is written wrong ("Its manifest must say runs = 'once'",
  "The Semgrep check has no declared command", a missing per-scope Vale tool file, "has no declared HTML
  configuration"). A user cannot cause these states; only a gspot developer who edits a manifest can, and the
  manifest tests catch that. Each manifest declares exactly what its guard checks (`runs = "once"` for large-files,
  stale-paths, and drift; `command = [...]` for semgrep).
- Fix: Always set `repositoryFiles` in `checkInput()` (`execution/contracts.ts:295-297`; it is only a reference) and
  make it required in `CheckInput`; then the three run-once guards go. Read the Semgrep command with a type that says
  it is present. The html-validate and purgecss guards go with the shared tool file lookup (CKG-022). The Vale guard
  goes with the per-scope Vale config (CFG-003).
- Size: small

### CKG-017: More guards for states that do not happen

- Where: `packages/cli/src/checks/general/dependencies/manifests.ts:84-85`,
  `packages/cli/src/checks/general/structure/public.ts:83-84`, `packages/cli/src/checks/general/site/contracts.ts:122-124`,
  `packages/cli/src/checks/general/repository.ts:15-16`, `packages/cli/src/checks/general/structure/trivial-functions.ts:32-33`,
  `packages/cli/src/checks/general/generated-code.ts:94`, `packages/cli/src/checks/general/public.ts:206-209`,
  `packages/cli/src/checks/general/site/linkinator.ts:14-15`, `packages/cli/src/checks/general/site/purgecss.ts:9-13`,
  `packages/cli/src/checks/general/site/public.ts:158`
- Kind: delete
- Problem: Each guards something that cannot be missing: a tracked package.json that "is missing"; a scope with no
  selection right after `scopeOf` picked it from the same list; `input.resources` (always set by `executeRun`,
  `execution/public.ts:247`; only tests leave it out); `limits.file_kb` and `limits.min_function_statements` (both
  have shipped defaults); a cancel check at the start of `generatedCode` that `runCheckTool` does again
  (`execution/command/public.ts:276`); a `stat` before a read that would throw anyway; the tool path that gspot always
  passes when it starts the program; a zod check that a pinned package exports functions; PurgeCSS returning one
  result per file.
- Fix: Delete each guard, except the jscpd `stat` (`general/public.ts:206-209`): it turns a missing report into "The
  jscpd command wrote no report" with the tool's output, and `tests/unit/cli/checks/general/duplication.test.ts`
  checks that message. Read package.json the way `versionPairs` does (one JSON read with `packageJsonSchema`,
  PAR-040). Build `selections` as a `Map` keyed by scope path. Make `view.limit` return a number (CKG-042), so the two
  limit guards go. Make the tests set `resources`.
- Size: small

### CKG-018: Python name case is checked twice at level all

- Where: `packages/cli/src/checks/general/naming/public.ts:61-75`,
  `packages/cli/configurations/language/python/manifest.toml:533` (`[ruff_rules] all` contains `"N"`),
  `packages/cli/configurations/language/python/ruff.toml.eta:23`
- Kind: merge
- Problem: At level `all`, Ruff's pep8-naming rules and naming/identifiers both check the case of Python variables,
  class attributes, and module file names (Ruff `N806`, `N815`, `N816`, `N999`), so a wrong name gives two findings.
  `policy.json` sets Python `variables` and `attributes` to `snake`/`upper-snake` and `files` to `snake`. Functions and
  parameters are not doubled: `policy.json` gives them no case, and the `naming.case` summary says Ruff checks the
  case of Python classes, functions, and parameters.
- Fix: Keep `"N"`: it also holds rules gspot has no copy of (`N802` to `N805`, `N807`, `N811` to `N814`, `N817`,
  `N818`). Add `N806`, `N815`, `N816`, and `N999` to the Ruff ignore list (`RUFF_IGNORED_RULES` in
  `config/generation/python.ts`, which the Ruff tool file source `generation/tool-file-sources/ruff.ts` writes).
  Ruff then checks classes, functions, and parameters, and naming/identifiers checks the rest, as the `naming.cases`
  summary says. `ruleLimits` stays (CKG-019).
- Size: small

### CKG-019: ruleLimits hides per-language special cases in code

- Where: `packages/cli/src/checks/general/naming/public.ts:277-287`
- Kind: simplify
- Problem: `ruleLimits` turns off the case and length rules for Swift types and variables and for Python classes and
  exception classes (lines 280-284), with no code comment. The `naming.case` summary (`general/naming/manifest.toml`)
  explains the case part (Ruff checks Python classes; SwiftLint checks Swift types and variables), but nothing
  explains the length part, and a reader of `policy.json` sees a Python `types` case that classes never get. The
  override schema (`parsers/schema/naming.ts:14-25`) has a case field but no length field, so the length part cannot
  move into the naming defaults without a new field.
- Fix: Keep the rule in code (`ruleLimits` in `naming/names.ts`, CKG-030). Move its two category lists into
  `config/checks/general/naming.ts` as `SWIFTLINT_PARENTS = ['types', 'variables']` and
  `RUFF_CATEGORIES = ['classes', 'exceptions']`. Add one comment above the `if`: "Ruff checks Python class and
  exception names and SwiftLint checks Swift type and variable names, so gspot checks neither their case nor their
  length." Delete the Python `types` row from `naming/defaults.json` if no Python identifier uses the `types`
  category directly (classes and exception classes are cut off here; type aliases have their own row). Stop exporting
  `ruleLimits` (CKG-038).
- Size: small

### CKG-022: Three home-made lookups of a check's tool file

- Where: `packages/cli/src/checks/general/public.ts:37-47`, `packages/cli/src/checks/general/site/public.ts:97-102,145-150`,
  `packages/cli/src/execution/command/arguments/public.ts:77-84`
- Kind: merge
- Problem: html-validate and purgecss repeat the same five lines to find their per-scope tool file
  (`site/public.ts:97-101` and `145-149`). Vale finds its file by the file name `'vale.ini.eta'`, so a rename breaks
  the check. gspot already has `toolFilePath()`, which finds `{tool_file:name}` for every manifest command.
- Fix: Export `toolFilePath()` (it moves to `execution/command/placeholders.ts`, EXG-002) and call it in
  `htmlValidate` and `purgecss` with the tool file names `html-validate-built` and `purgecss.config`. Delete the two
  lookups and their guards. The Vale lookup and its guard go with the per-scope Vale config (CFG-003).
- Size: small

### CKG-023: The suppression finding shows users a raw regular expression

- Where: `packages/cli/src/checks/general/structure/public.ts:101,142`
- Kind: rewrite-text
- Problem: The message is "This eslint suppression needs a meaningful reason matching `-- (?<reason>\S.*)`".
  `reasonForm` is the regular expression source from the manifest (`reasonForm: form.reason.source`, line 101). Users
  must read a regular expression to learn the syntax.
- Fix: Print "This eslint suppression has no reason of two or more words." The check's `help` text says how to write
  one. Delete `reasonForm` (`structure/public.ts:101`, `types/execution/check.ts:17`) and its checks in
  `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts` (today
  `tests/cli/checks/general/structure/suppressions.test.ts:167-184`). No manifest field is added.
- Size: small

### CKG-024: The word "native" is used as filler in 38 comment lines

- Where: for example `general/contracts.ts:107,210,243`, `generated-code.ts:41,89`,
  `structure/conventions.ts:10,17,32,34,59`, `structure/env-owner.ts:34,52,94,101,112`,
  `structure/import-comments.ts:12,40`, `structure/trivial-functions.ts:11`, `security.ts:99,102`, `secrets.ts:150`,
  `checks/public.ts:97`, `config/checks/general/structure.ts:4,30`, `types/checks/general/*.ts` (7 places),
  `types/checks/docker.ts:4` (all under `packages/cli/src/checks/` or `packages/cli/src/`)
- Kind: rewrite-text
- Problem: "native" means nothing here. Examples: "Same-check records share one raw native pass", "Publish the
  policy's canonical layout under its native claim and captured-file comparison", "Native captures remain within the
  shared parsed-source ownership lifetime", "the final file owned by native output attribution". A newcomer cannot
  tell what any of these say. 42 lines in this area contain the word; 38 are comments. The other 4 are code
  (`realpathSync.native` twice, `openRoot(..., 'native')`, and the `policy/schema/native` import path).
- Fix: Rewrite each comment in plain words or delete it. Examples: "Run the generator in a scratch copy and compare
  the files it writes." "Each Bash, Python and Swift file is parsed once; the checks share the result." Comments in
  files that other findings delete need nothing.
- Size: medium

### CKG-025: Error and finding messages with jargon or wrong words

- Where: `site/contracts.ts:34` ("Unsafe lifecycle destination"), `:86` ("Source link leaves the repository", it is
  the build folder), `:88` ("Unsafe lifecycle directory"), `:124` ("needs temporary directories that are disposed
  after the run"), `naming/public.ts:162` ("callback position"), `structure/env-owner.ts:151` ("environment owner"),
  `structure/trivial-functions.ts:65` ("Move them to their owner"), `general/contracts.ts:196` ("canonical layout"),
  `secrets.ts:37,39,49,61` ("history object", "history blob", "history change list") (all under
  `packages/cli/src/checks/general/`)
- Kind: rewrite-text
- Problem: Users read these. "Lifecycle", "callback position", "owner", "canonical", and "history object" are
  internal words, and one message names the wrong folder.
- Fix: Rewrite each in plain words. Examples: "The build output links outside the build folder: X." / "'handle'
  starts a name only for event handlers. Name what this function does." / "Read environment variables only in the
  files that `architecture.roles.environment_readers` lists, and pass the value in." / "gspot.toml is not in the
  order gspot writes. Run gspot check --fix." / "Git listed a changed file in an unexpected format."
- Size: small

### CKG-027: general/public.ts holds two unrelated checks

- Where: `packages/cli/src/checks/general/public.ts:1-217`
- Kind: move
- Problem: Vale (configuration `prose`) and jscpd (configuration `duplication`) share a file named `public.ts`. It
  exports `vale`, `routeFor`, `routeGroups` (prose) and `cloneFindings`, `jscpd` (duplication). AGENTS.md says a check
  that runs a tool uses the tool name, and the code is grouped by configuration.
- Fix: Split it into `checks/general/prose.ts` (lines 29-141) and `checks/general/duplication.ts` (lines 143-217).
  Delete `general/public.ts`.
- Size: small

### CKG-028: The gspot checks are spread over a file named contracts.ts and the structure folder

- Where: `packages/cli/src/checks/general/contracts.ts`, `packages/cli/src/checks/general/structure/public.ts`
- Kind: move
- Problem: gspot/drift, gspot/policy-layout, and gspot/unmatched-paths live in `contracts.ts`, a name that says
  nothing. gspot/suppressions lives in `structure/public.ts`, inside the structure folder, though the gspot
  configuration manifest (`general/gspot/manifest.toml`) declares all four.
- Fix: Move the four checks into `checks/general/gspot/`: `generated-files.ts` (`generatedFiles`, check
  gspot/generated-files), `settings-format.ts` (`settingsFormat` and `fixSettingsFormat`, check
  gspot/settings-format), `unused-entries.ts` (`unusedEntries`, check gspot/unused-entries), and `suppressions.ts`
  (`suppressions`, `reasonAbove`, `suppressionSyntaxes`, check gspot/suppressions). One file would go over the 300-line
  limit (the two files hold 405 lines). Delete both old files.
- Size: small

### CKG-029: The site checks sit under "general" though the site configuration is a framework

- Where: `packages/cli/src/checks/general/site/` (4 files), `packages/cli/src/config/checks/general/site.ts`,
  `packages/cli/src/types/checks/general/site.ts`, `packages/cli/configurations/framework/site/`
- Kind: move
- Problem: The configuration lives at `configurations/framework/site` and declares all 11 `site/*` checks, but its
  code is under `checks/general/site`. Inside, `contracts.ts` and `public.ts` are both lists of checks, split for no
  reason.
- Fix: Move the code to `checks/framework/site/`: `build.ts` (`BUILD_MEMO`, `runBuild`, `buildDigests`, `cachedBuild`,
  `requireBuild`, `filesUnder`, `repositoryPath`, `siteBuild`, `buildReproducible`), `built-pages.ts` (`pageOf`,
  `linkinator`, `htmlValidate`, `purgecss`, `siteSize`, `sitemap`), `source-files.ts` (`unusedAssets` for check
  site/unused-assets, today `deadAssets`; `svgo`, `svgFinding`, `webManifest`), and the two programs as
  `linkinator-program.ts` and `purgecss-program.ts`, so their role is clear. The constants go to
  `config/checks/framework/site.ts` and the types to `types/checks/framework.ts`.
- Size: medium

### CKG-030: The naming folder's file names say nothing

- Where: `packages/cli/src/checks/general/naming/contracts.ts`, `public.ts`, `identifiers.ts`
- Kind: rename
- Problem: `public.ts` holds the rules for one name, `contracts.ts` holds the settings builder and the code that
  reads names, and `identifiers.ts` holds all three checks (identifiers, paths, policy).
- Fix: Rename `public.ts` to `naming/names.ts` (the findings for one name). Split `contracts.ts` into
  `naming/settings.ts` (`readNamingSettings`, `compileTerms`, `compileOverride` (today `compileRule`), `buildLimitsFor`,
  `splitParts`, `toSet`) and `naming/identifiers.ts` (`identifiersOf`, `fileIdentifier`, `directoryIdentifiers`,
  `segmentName`). Rename `identifiers.ts` to `naming/checks.ts` (`namingIdentifiers`, `namingPaths`,
  `namingSettings`, `declaredNames`, `sourceFiles`, `findingsFor`, `pathIdentifiers`).
- Size: small

### CKG-031: dependencies/ file names do not match the check names, and lockfile/ is a two-file folder

- Where: `packages/cli/src/checks/general/dependencies/manifests.ts`, `public.ts`, `lockfile/fresh.ts`,
  `lockfile/hosts.ts`
- Kind: rename
- Problem: `manifests.ts` runs `dependencies/package-json`; `lockfile/fresh.ts` (function `lockfileFresh`) runs
  `dependencies/stale-lockfile`, so the file says "fresh" and the check says "stale"; `public.ts` holds
  `versionPairs` for two framework checks.
- Fix: `manifests.ts` becomes `dependencies/package-json.ts` (function `packageJson`), `lockfile/fresh.ts` becomes
  `dependencies/stale-lockfile.ts` (function `staleLockfile`), and `lockfile/hosts.ts` becomes
  `dependencies/lockfile-hosts.ts`; delete the `lockfile/` folder. `public.ts` moves with CKG-033.
- Size: small

### CKG-032: The "generated file is out of date" check is filed as general and listed four times

- Where: `packages/cli/src/checks/general/generated-code.ts`, `packages/cli/src/checks/public.ts:129,138,180,187`,
  `packages/cli/src/types/checks/general/generated-code.ts`
- Kind: move
- Problem: `generatedCode` serves drizzle (library), cloudflare (platform), openapi (infrastructure), and supabase
  (platform). None is general. The check table lists it four times by hand.
- Fix: Move it to `checks/stale-generated-files.ts` with the function `staleGeneratedFiles`, and point the four lines
  of the check table at it. Keep the four lines: every check finds its code the same explicit way. `GeneratedPath`
  moves to `types/configurations.ts` (S01-006).
- Size: small

### CKG-033: Framework version pairs live in the general dependencies constants

- Where: `packages/cli/src/checks/general/dependencies/public.ts`,
  `packages/cli/src/config/checks/general/dependencies.ts:23-28`, `packages/cli/src/checks/public.ts:133-134`
- Kind: move
- Problem: `NEXT_VERSION_PAIRS` and `REACT_VERSION_PAIRS` are framework facts stored in the general dependencies
  constants, and the check table wires them with two small inline wrapper functions. `versionPairs` also finds every
  package.json differently from `manifests.ts:81-87` (`dependencies/public.ts:16` against `manifests.ts:83`).
- Fix: Move the code to `checks/framework/version-pairs.ts` and the two constants to
  `config/checks/framework/version-pairs.ts`. Keep the two lines of the check table. Share one
  `packageJsonFiles(input)` function with `dependencies/package-json.ts`.
- Size: medium

### CKG-035: Top-level config and types files sit in the wrong place

- Where: `packages/cli/src/config/checks/postgres.ts`, `config/checks/swift-snapshot-testing.ts`,
  `types/checks/postgres.ts`, `types/checks/cloudflare.ts`, `types/checks/docker.ts`, `types/checks/nginx.ts`
- Kind: move
- Problem: Their checks live in `checks/database/postgres/`, `checks/library/`, `checks/platform/`, and
  `checks/tool/`. `config/checks/tool/docker.ts`, `config/checks/tool/nginx.ts`, and
  `config/checks/platform/cloudflare.ts` already exist in subfolders, so the constants of one check sit in a subfolder
  and its types at the top.
- Fix: Move them into the group files (LAY-005): `config/checks/postgres.ts` to `config/checks/database.ts`,
  `config/checks/swift-snapshot-testing.ts` to `config/checks/library.ts`, `types/checks/postgres.ts` to
  `types/checks/database.ts`, and `types/checks/docker.ts` and `types/checks/nginx.ts` to
  `types/checks/infrastructure.ts`. `types/checks/cloudflare.ts` holds only `SchemaCompiler`, which goes with DEC-021.
- Size: small

### CKG-037: Two names for the same regular expression

- Where: `packages/cli/src/config/checks/general/naming.ts:28,65`
- Kind: merge
- Problem: `TIMESTAMP = /^\d+$/u` and `NUMBER_PART = /^\d+$/u` are the same pattern.
- Fix: Keep one, `DIGITS_ONLY = /^\d+$/u`, in `config/checks/general/naming.ts`, and use it in both places in
  `naming/names.ts`.
- Size: small

### CKG-038: Exports nobody outside the file uses

- Where: `packages/cli/src/config/checks/general/gspot.ts:3-8` (`CONFLICT_HELP`, `APPLY_HELP`, `STRAY_HELP`),
  `packages/cli/src/checks/general/naming/public.ts:277` (`ruleLimits`), `types/checks/general/licenses.ts:10`
  (`LicenseAllowlist`), `types/checks/general/site.ts:14` (`LinkinatorFlags`), `types/checks/postgres.ts:19`
  (`ForeignKey`), `types/checks/docker.ts:8` (`ComposeDeclaration`)
- Kind: simplify
- Problem: These are exported but used only inside their own file. knip does not report them because
  `ignoreExportsUsedInFile` is on.
- Fix: Stop exporting `ruleLimits`. Write the texts of `CONFLICT_HELP` and `STRAY_HELP` directly in their rows of
  `GENERATED_FILE_HELP` (today `DRIFT_HELP`), and keep `APPLY_HELP` as a constant that only this file reads:
  `GENERATED_FILE_HELP` uses it twice. `LicenseAllowlist` goes with S01-004 and `LinkinatorFlags` with CKG-008.
  `ForeignKey` and `ComposeDeclaration` stay exported from `types/checks/database.ts` and
  `types/checks/infrastructure.ts`, because a `types/` file exports its types.
- Size: small

### CKG-039: Vale routing data is split across two config files and two type files

- Where: `packages/cli/src/config/checks/general/prose.ts:2`, `packages/cli/src/config/generation/prose.ts:7-27`,
  `packages/cli/src/types/checks/general/prose.ts`, `packages/cli/src/types/generation/prose.ts`
- Kind: move
- Problem: `SCRIPT_GRAMMAR` (scripts with no extension) is the one missing row of `PROSE_GRAMMARS`, but it lives in
  another file. `ProseRoute` (`{ path; mode; extension }`) repeats `ProseGrammar` (`{ mode; extension; format? }`)
  plus a path.
- Fix: Move `SCRIPT_GRAMMAR` into `config/generation/prose.ts` beside `PROSE_GRAMMARS`.
  `config/checks/general/prose.ts` keeps the Vale arguments and its error-line pattern (`VALE_ARGUMENTS`,
  `VALE_ERROR_LINE`). `ProseGrammar` is deleted (S04-007), so `ProseRoute` and `ProseRouteGroup` stay written by hand
  in `types/checks/general.ts`, with `ProseRoute` as `{ path: string; mode: 'path' | 'stdin'; extension: string }`.
- Size: small

### CKG-042: Two ways to read a limit

- Where: `checks/general/repository.ts:15`, `structure/file-lines.ts:19`, `structure/trivial-functions.ts:32`
  (`input.view.limit(key, language)`), against `structure/prefix-collisions.ts:35`, `docs.ts:207`,
  `general/public.ts:210` (`input.view.options('limits').x`)
- Kind: simplify
- Problem: `view.limit` takes any string and may return `undefined`
  (`types/policy/settings.ts:56`: `limit: (key: string, language?: string) => number | undefined`), which forces the
  guards of CKG-017. `view.options('limits')` is typed and always defined.
- Fix: Keep `view.limit`: it holds the per-language fallback (`<language>.<key>`, then `.<key>`,
  `policy/settings/public.ts:182`) that 13 callers use, and `options('limits')` would make each caller repeat it.
  Make `limit` return `number` and throw one clear error inside it for a key with no value (every limit has a shipped
  default). Then delete the `=== undefined` guards in `repository.ts:16`, `file-lines.ts:19-20`,
  `trivial-functions.ts:33`, and in the callers outside this area.
- Size: small

### CKG-043: file-lines keeps the same extension list twice and fakes a file name

- Where: `packages/cli/src/checks/general/structure/file-lines.ts:16-25`,
  `packages/cli/src/config/checks/general/structure.ts:63-75`, `types/checks/general/structure.ts:32`, structure
  manifest check `file-lines` (`files`)
- Kind: simplify
- Problem: The manifest lists the nine extensions the check receives; `COMMENT_STYLE_BY_EXTENSION` lists the same
  nine plus a fake `''` key for Bash scripts with no extension. The check also filters `kind !== 'source'`, which the
  manifest already does. To parse a Bash file it appends `.sh` to the path
  (`parseComments(\`${file.path}.sh\`, ...)`). The comment on`CommentStyle` says "and language-specific file
  ceiling", but the tuple holds no limit.
- Fix: Pick the language from the file's language tags, which the inventory already sets. `COMMENT_MARKERS` (today
  `COMMENT_STYLE_BY_EXTENSION`, in `config/checks/general/structure.ts`) becomes a three-row map
  `{ bash: '#', python: '#', sql: '--' }`. Drop the `''` key and the `kind` filter. Pass the grammar name to the
  parser instead of a fake path; `parseComments` picks its reader by file extension (`parsers/source/public.ts:362-365`),
  so its signature changes a little. Delete `CommentStyle`.
- Size: small

### CKG-044: Stale counts in comments

- Where: `packages/cli/src/checks/general/structure/source-files.ts:8`
- Kind: rewrite-text
- Problem: The comment says "Read authored code for the four folder checks", but five checks use the function today
  (folder-names, lone-files, prefix-collisions, stem-collisions, test-placement), and three remain after the
  deletions.
- Fix: "The code files the folder checks look at: no Markdown and nothing under .gspot." No count.
- Size: small

### CKG-045: The three "pushed commits" checks each pick and loop over commits their own way

- Where: `packages/cli/src/checks/general/secrets.ts:112-147`, `packages/cli/src/checks/general/commits.ts:19-61`,
  `packages/cli/src/repository/revisions/public.ts:203-215`
- Kind: simplify
- Problem: commitlint-pushed and trufflehog use `pushedCommits()`. gitleaks-pushed has its own three-way branch
  (`getPushBase..HEAD`, batches, none). commitlint-pushed and gitleaks-pushed repeat the same loop: run several
  times, keep findings, stop on a missing tool or an error, remember failures. Both also write the tool command in
  TypeScript, though `commits/commitlint` and `secrets/gitleaks-staged` declare the same command in their manifests
  (`commits.ts:46`; `secrets.ts:116-130` is `gitleaks-staged` without `--staged`).
- Fix: Use `pushedCommits()` in gitleaks-pushed and batch the list with `fileBatches`. Add one function,
  `mergeRuns(results)`, for both loops. Take the tool command from the manifest, declared once, and append only the
  commit selection in code.
- Size: medium

### CKG-046: CodeQL errors are wrapped twice

- Where: `packages/cli/src/checks/general/security.ts:18-25,85-94`
- Kind: simplify
- Problem: `runCodeql` already throws "codeql database create failed: ...". The loop catches it and throws "CodeQL
  analysis of javascript failed: codeql database create failed: ...".
- Fix: Pass the language into `runCodeql` for its message and delete the try/catch.
- Size: small

### CKG-047: unmatched-paths asks Git for the file list again

- Where: `packages/cli/src/checks/general/contracts.ts:30`
- Kind: simplify
- Problem: `trackedEntries(input.root, [], input.index)` runs `git ls-files --others` again
  (`repository/contracts.ts:208`), though a check that runs once already receives the file list in
  `input.repositoryFiles`. The second listing exists only because `input.repositoryFiles` leaves out the paths of the
  root `exclude` setting, which the path walk visits.
- Fix: Use `expandPaths(input.repositoryFiles.map((file) => file.path))` and delete the `trackedEntries` call. With the
  root `exclude` setting deleted (TMF-003), the two lists are the same. Do after TMF-003.
- Size: small

### CKG-048: Two copies of "which language covers this file and what are its names"

- Where: `packages/cli/src/checks/general/naming/contracts.ts:237-271` (`declaredNames`),
  `packages/cli/src/checks/general/naming/identifiers.ts:21-30,53-70` (`sourceFiles`, `pathIdentifiers`)
- Kind: merge
- Problem: Both find the covering language configuration with `isOwned`, collect `path_containers`, and build file
  and folder identifiers. `declaredNames` does it per scope; `sourceFiles` for one scope.
- Fix: Make `declaredNames` call `sourceFiles` for each scope's selection and reuse `pathIdentifiers` for the `names`
  field (all three in `naming/checks.ts`, CKG-030).
- Size: small

### CKG-049: The naming settings builder copies a table and then overwrites every field it reads

- Where: `packages/cli/src/checks/general/naming/contracts.ts:191-201`
- Kind: simplify
- Problem: `{ ...policy.naming, banned, allowed, reserved, overrides }` copies the per-language tables too, but only
  those four fields are read afterwards.
- Fix: Do not build the merged object. `readNamingSettings` merges only `banned_words` over the scope's tables and
  reads the root `[[naming.override]]` list (CFR-004). `naming.allowed` becomes the `allowed_names` field of
  `[[naming.override]]` (TMF) and `naming.reserved` is deleted (TML-005), so their merges go too. Read the two
  remaining values directly.
- Size: small

### CKG-050: licenses/allowed fails on a project with no dependencies

- Where: `packages/cli/src/checks/general/licenses.ts:43-48,114-118`
- Kind: fix-bug
- Problem: A package.json that declares no dependencies always fails. Usually it has no `node_modules` folder, so
  `assertInstalled` throws "Install the project dependencies first". If it has one, the scan returns no packages
  (`--excludePrivatePackages` drops the private root itself) and the zero-packages throw fires. Every package.json
  that the licenses configuration covers becomes a project (`planning/public.ts:227-259`). Python is not affected:
  `pip-licenses --with-system` always lists the system packages.
- Fix: In `scanLicenses`, skip a JavaScript project whose package.json declares no `dependencies`,
  `devDependencies`, or `optionalDependencies`, before `assertInstalled`. Keep the zero-packages throw for projects
  that do declare dependencies (it then means "not installed"); the `empty installed report` row of
  `SCANNER_FAILURES` (`tests/config/licenses.ts`) stays. Confirm with one real run.
- Size: small

### CKG-051: The test folder role gets special treatment in three checks, computed two ways

- Where: `checks/general/naming/identifiers.ts:54,63`, `checks/general/structure/folder-names.ts:16,24`,
  `checks/general/structure/test-placement.ts:46-47`, `packages/cli/src/policy/settings/contracts.ts:286-290`
- Kind: simplify
- Problem: naming/paths and folder-names silently skip the `test_harness` folder, so `tests/support` is not reported
  for "support". test-placement finds the same folder with its own code, then uses only the first one in its
  message.
- Fix: The folder-names and test-placement uses go with CKG-003 and CKG-011. In naming/paths (`pathIdentifiers`),
  drop the exemption. A repository that wants such a folder name writes one root `[[naming.override]]` record with
  `paths`, `allowed_names`, and a `reason`, as for any other allowed name. The `test_harness` role and
  `harnessFolders()` go with TML-001.
- Size: small

### CKG-052: A NestJS-only name inside a general check

- Where: `packages/cli/src/checks/general/structure/prefix-collisions.ts:12-22`
- Kind: rename
- Problem: `isNestjsName` handles `<feature>.<kind>.ts` names whose kinds come from any selected manifest's
  `prefix_collisions.kinds` (line 37). The code is general; the name and comments tie it to one framework.
- Fix: Rename it to `hasDeclaredKindSuffix` (in `structure/shared-prefixes.ts`) and reword both comments to "A
  selected configuration declares `<name>.<kind>.<ext>` file names (for example NestJS), so these do not count as a
  shared prefix."
- Size: small

### CKG-053: Small repeated checks written inline

- Where: `checks/general/dependencies/bun-release-age.ts:58`, `checks/general/structure/conventions.ts:14`,
  `checks/general/structure/file-lines.ts:18`, `checks/general/public.ts:119`
- Kind: simplify
- Problem: `bun-release-age.ts` writes `!file.path.split('/').includes(DOT_GSPOT)` instead of calling
  `isToolProjectPath()`. A Bash script is named three ways: a string literal, the constant `SCRIPT_TAG` (the same
  string), and a `shebang:` tag. The `shebang:` form differs only for files with an extension, which file-lines does
  not use it for.
- Fix: Call `isInGspotFolder()` (`repository/selectors.ts`, today `isToolProjectPath`). Use `SCRIPT_TAG` in all three
  places.
- Size: small

### CKG-054: Internal functions are exported only so tests can call them

- Where: `naming/public.ts` (`bannedTerm`, `hasCase`, `repeatedPart`, `rulesFor`), `naming/contracts.ts`
  (`compileTerms`), `general/public.ts` (`routeFor`, `routeGroups`, `cloneFindings`), `site/contracts.ts`
  (`cachedBuild`), `structure/public.ts` (`suppressionComments`)
- Kind: simplify
- Problem: Ten functions have no user outside their file except tests. Tests that call them break on every
  refactor and repeat what the check-level tests already cover. `bannedTerm` is one line around `terms.find`.
- Fix: Test through the check functions (`nameFindings`, `vale`, `jscpd`, `suppressions`, `siteBuild`,
  `buildReproducible`, `requireBuild`) and drop the extra exports. Inline `bannedTerm` into `termFindings`, `hasCase`
  into `caseFinding`, `cloneFindings` into `jscpd` (`CloneScope` and `CloneReport` go), and `suppressionComments` into
  `suppressions`. `rulesFor` becomes the file-local `overridesFor`. The integration test
  `tests/integration/general/structure.test.ts` (today `tests/tools/configurations/general/structure.test.ts:28`)
  compares the rule and line of the `suppressions` findings with Vale. The rule-order test (today
  `naming/manifest-rules.test.ts`, merged into `tests/unit/cli/checks/general/naming/settings.test.ts`) checks
  outcomes through `nameFindings`: for example, `handleLogin` in `src/routes/` gets `callback-verb`. TCG-056 merges
  the `identifier()` test function.
- Size: medium

### CKG-055: Two house-style rules ship as product checks

- Where: `checks/general/structure/private-before-public.ts`, `checks/general/structure/import-comments.ts`
- Kind: delete
- Problem: "Private functions first" and "no comments inside import blocks" are this repository's own style (the
  AGENTS.md "declaration order" rule). No outside linter treats them as defects. They ship to every repository at
  level `all`, with placeholder manifest text. Both came from merging per-language rules on 2026-10-08 (commit
  0a7108489).
- Fix: Delete both checks, their `CONVENTION_QUERIES` captures (`entrypoint`, `declaration`, `comment`),
  `HouseDeclaration`, their lines in the check table, their `[[check]]` blocks in the structure manifest, and their
  tests.
- Size: small

### CKG-056: findingAt has a needlessly clever return type, and some checks skip it

- Where: `packages/cli/src/checks/finding.ts:14-21`, findings built by hand at `general/public.ts:165-172` and
  `general/contracts.ts:163-170,192-199`
- Kind: simplify
- Problem: The generic return type `Finding & Pick<Place, keyof FindingPlace & keyof Place>` exists so that one
  caller can sort by `line`; only `config-logic.ts:76` relies on it, and CKG-010 deletes that check. Three places
  build findings by hand instead of calling it. The file comment "The builder checks use to report their identity and
  source location" is hard to parse.
- Fix: Return `Finding`. Add an optional argument `{ help, fixable }` and use `findingAt` in the three places that
  build findings by hand. Rename the parameter `diagnostic` to `message`. Comment: "Builds one finding for a check
  gspot runs itself."
- Size: small

### CKG-057: secrets.ts and security.ts pass values through one-use types and chains of small functions

- Where: `checks/general/secrets.ts:33-104`, `types/checks/general/secrets.ts`, `types/checks/general/security.ts`
- Kind: simplify
- Problem: `scanCommits -> appendBlobs -> changedObjects -> changeFields` and `appendMetadata` are steps with one
  caller each, tied together by `SecretScan`, a type that only bundles two values. `CodeqlLanguage` and
  `CodeqlAnalysis` exist only to group the arguments of one function.
- Fix: Pass `session` and `file` as plain arguments and delete `SecretScan`; merge `changeFields` into
  `changedObjects`. Give `analyzeLanguage` plain arguments and delete `CodeqlLanguage` and `CodeqlAnalysis`.
- Size: small

### CKG-058: The generated-file check guesses a setting name by cutting a string

- Where: `packages/cli/src/checks/general/generated-code.ts:37-38,139`
- Kind: simplify
- Problem: `entry.original.slice('{setting:'.length, -1)` assumes every `path` record is a `{setting:...}`
  placeholder. Today that holds (the only `path` record is openapi's `{setting:openapi.document}`), but a literal path
  in a manifest would give a garbled message. The "stale" message prints the command with `JSON.stringify`, which
  shows placeholder objects, while the "missing" message joins only the strings.
- Fix: Say "The file <path> does not exist; run <command> and commit what it writes" for both kinds, with the same
  string-joined command. Drop the slice and the `original` field. A missing openapi document then becomes a finding
  instead of a check error.
- Size: small

### S01-001: `namingCheck` wraps the naming checks and builds settings that naming/policy never reads

- Where: `packages/cli/src/checks/general/naming/identifiers.ts:43-51,73-125` (`identifierFindings`,
  `policyFindings`, `namingCheck`, `namingIdentifiers`, `namingPaths`, `namingPolicy`),
  `packages/cli/src/checks/general/naming/contracts.ts:183-230`
- Kind: simplify
- Problem: `namingCheck(analysis)` returns a function that pulls four fields out of the check input
  (`input.selection.view`, `input.policyFiles.policy`, `input.scope`, `input.selection.selected`), passes them to
  `effectivePolicy`, and forwards to the check. For naming/policy the built settings are thrown away:
  `namingPolicy = namingCheck(policyFindings)`, but `policyFindings(input)` takes one argument. The five-line call
  exists because `effectivePolicy` takes four loose values that all come from the same input. `identifierFindings` has
  one user (`namingIdentifiers`, through `namingCheck`).
- Fix: Name the builder `readNamingSettings` (today `effectivePolicy`), in `naming/settings.ts`: it reads the shipped naming defaults, the naming records of the selected configurations, and the naming settings in gspot.toml, and a name such as `namingSettingsFor` would differ by three letters from the check function `namingSettings` (PLR-014). Give it one argument: the check input. Delete `namingCheck`. In
  `naming/checks.ts` (CKG-030), `namingSettings` (today `policyFindings`) is the check itself, and the check table
  names it directly; the alias `namingPolicy` goes. `namingIdentifiers(input)` is a plain async function that calls
  `readNamingSettings(input)` and holds the loop of `identifierFindings`, which is inlined. `namingPaths(input)` is
  `findingsFor(input, readNamingSettings(input), pathIdentifiers(input))`. The tests build a small input object
  instead of four arguments.
- Size: small

### S01-003: `LicenseScanner` only annotates one inline object

- Where: `packages/cli/src/types/checks/general/licenses.ts:21-24`, `packages/cli/src/checks/general/licenses.ts:101-104`
- Kind: delete
- Problem: The type exists only to annotate `const scanner: LicenseScanner = ... ? {...} : {...}`. TypeScript infers
  the union of the two object literals. The only thing the annotation adds is the parameter type of the identity
  function `(name) => name`. `git grep LicenseScanner` finds the definition and this one use.
- Fix: Delete the type. Write `(name: string) => name`.
- Size: small

### S01-004: `LicenseAllowlist` types a field with a schema type that `types/` may not import

- Where: `packages/cli/src/types/checks/general/licenses.ts:7-18`
- Kind: delete
- Problem: `ProjectLicenses.configuration` is typed as `z.infer<typeof allowlistSchema>` through `LicenseAllowlist`,
  and `LicenseException` is a `z.infer` type too. `types/` may not import a schema. The value is
  `selected.view.options('licenses')`.
- Fix: Type `ProjectLicenses.configuration` with the hand-written `[licenses]` table interface that LAY-004 puts in
  `types/checks/general.ts`, and delete `LicenseAllowlist`. Do not use the gspot.toml table type (`TableSettings` in
  `types/settings/tables.ts`): the two types files would then import each other. `LicenseException` becomes
  `AllowedPackage`, written by hand in `types/checks/general.ts` as `{ name, version, reason }` (TML-009); its schema
  is checked against it.
- Size: small

### S01-005: `isSkipped` is a two-line function with one caller

- Where: `packages/cli/src/checks/general/structure/prefix-collisions.ts:24-27,45-52`
- Kind: simplify
- Problem: `isSkipped(directory, scope)` returns `HOOK_DIRECTORIES.some(...) || isDependencyFolder(directory)`. Its
  one caller already lists five skip conditions in one `if`; the name says nothing about why a folder is skipped.
  `git grep -w isSkipped` finds only this file.
- Fix: Put the two conditions into the existing `if` of `sharedPrefixes` (`structure/shared-prefixes.ts`) and delete
  the function.
- Size: small

### S01-006: `GeneratedPath` is the manifest record type once CKG-058 lands

- Where: `packages/cli/src/types/checks/general/generated-code.ts:4`,
  `packages/cli/src/checks/general/generated-code.ts:37,72-75`
- Kind: move
- Problem: `GeneratedPath` adds one field, `original`, to a `generated_paths` record. The only reader of `original` is
  the `{setting:` slice that CKG-058 deletes (`generated-code.ts:37`). After that, the type equals one record of the
  manifest schema (`{ kind: 'path' | 'pattern', path }`, `parsers/schema/configurations.ts:128-134`).
- Fix: Write `GeneratedPath` by hand in `types/configurations.ts` as the type of one `generated_paths` record; the
  manifest schema is checked against it. Delete `types/checks/general/generated-code.ts`. `generatedInputs` stops
  copying `original`. Do after CKG-058.
- Size: small

### S01-007: Tool names and the package.json file name belong in config/

- Where: `packages/cli/src/config/checks/general/{duplication,licenses,security}.ts`,
  `packages/cli/src/config/checks/general/dependencies.ts:18`
- Kind: move
- Problem: `JSCPD`, `LICENSE_CHECKER`, and `CODEQL` each sit alone in a config file, and the checks write their
  arguments and file names in place. `NPM_MANIFEST` (`'package.json'`) sits in the dependencies check constants under
  a name that calls a dependency file a manifest, while many other files write the literal `'package.json'`. Tool
  names, file names, and command arguments are static values, so they belong in `config/`.
- Fix: Keep `JSCPD`, `LICENSE_CHECKER`, and `CODEQL` in their config files, which also take each tool's arguments and
  file names (`JSCPD_ARGUMENTS`, `JSCPD_CONFIG_FILE`, `JSCPD_REPORT_FILE`; `LICENSE_CHECKER_ARGUMENTS`,
  `PIP_LICENSES_COMMAND`; `CODEQL_LANGUAGES_COMMAND`, `CODEQL_ANALYZE_FLAGS`), so no file holds one item. `codeql`
  reads ``options(`tools.${CODEQL}`)``. Move `NPM_MANIFEST` to `config/parsers/dependency-files.ts` as
  `PACKAGE_JSON` (LAY-002), the one constant for the `'package.json'` literals (glossary: dependency file).
- Size: small

### S01-008: `PUBLIC_SCHEMA` is a named static value with two users

- Where: `packages/cli/src/config/checks/postgres.ts:9`
- Kind: move
- Problem: `PUBLIC_SCHEMA` (`'public'`) is used by two functions, `qualifyRelation` and `qualifyParts`. A named value
  used in two places is a constant in `config/`, not a literal written in each function.
- Fix: Keep `PUBLIC_SCHEMA` and move it to `config/checks/database.ts` with the other Postgres values (CKG-035).
- Size: small

### S01-009: The Linkinator and PurgeCSS programs need small local types

- Where: `packages/cli/src/types/checks/general/site.ts:38-62`, `packages/cli/src/checks/general/site/linkinator.ts:10-17`,
  `packages/cli/src/checks/general/site/purgecss.ts:11-13`, `packages/cli/src/types/checks/cloudflare.ts`,
  `packages/cli/src/types/checks/general/spdx.d.ts`
- Kind: move
- Problem: The two programs import the tool package at run time (`await import(url)`), which is `any` without a type.
  `LinkinatorConstructor` and `PurgecssConstructor` copy parts of the packages' own types, and `SchemaCompiler` copies
  Ajv's. linkinator and purgecss are not dependencies of `packages/cli` (only of `tests/package.json` and
  `.gspot/package.json`), and gspot adds no devDependency for their types. `spdx.d.ts` hand-declares two modules; the
  `@types/spdx-*` packages describe older major versions than the installed `spdx-expression-parse` and
  `spdx-satisfies`, which ship no types.
- Fix: Keep two small hand-written types in `types/checks/framework.ts`: `LinkinatorConstructor` with
  `on('pagestart')` and `check()` taking the six options CKG-008 keeps and returning `Promise<{ passed: boolean }>`
  (no schema import), and `PurgecssConstructor` as it is. `LinkinatorFlags` and `LinkinatorOptionsReader` go with
  CKG-008. `SchemaCompiler` and `types/checks/cloudflare.ts` go with DEC-021. The two SPDX module declarations move
  into `types/global.d.ts` (PLR-050).
- Size: small

### S01-010: `CASE_NAMES` is read from a table of functions; make it the literal list in config/

- Where: `packages/cli/src/checks/general/naming/public.ts:37-45,167`
- Kind: move
- Problem: `CASE_NAMES = [...CASE_TESTS.keys()]` reads the keys of a map of functions. The naming schemas need it
  for `z.enum` (POL-021). A list of seven names is a static value; a table of functions is code.
- Fix: Write `CASE_NAMES` as the literal list (`as const`) in `config/checks/general/naming.ts`. Add
  `CaseName = (typeof CASE_NAMES)[number]` to `types/checks/general.ts`. Write `CASE_TESTS` in `naming/names.ts` as an
  object that satisfies `Record<CaseName, (name: string) => boolean>`, so a missing or extra case is a type error. The
  schemas import `CASE_NAMES` from config.
- Size: small

### S01-011: Two placeholder origins for parsing relative links

- Where: `checks/general/site/contracts.ts:267` (`'https://example.invalid/'`), `site/public.ts:26`
  (`'https://site.invalid'`), `checks/language/html.ts:48`
- Kind: merge
- Problem: Each place invents its own fake origin to parse a relative URL. They mean the same thing.
- Fix: One `PLACEHOLDER_ORIGIN = 'https://site.invalid/'` in `config/checks/framework/site.ts`, used by
  `webManifest` and `pageOf`. The HTML check (`checks/language/html.ts`) imports the same constant.
- Size: small

### S01-012: The same fallback text is passed to `toolOutputDetail` eight times

- Where: `generated-code.ts:116`, `licenses.ts:54`, `general/public.ts:204,208`, `security.ts:22`, and
  `language/python/imports.ts:59`, `tool/ansible.ts:34`, `tool/public.ts:199` (under `packages/cli/src/checks/`)
- Kind: simplify
- Problem: Eight callers pass the same text, `'The tool printed no diagnostic.'`.
- Fix: Make it the default of the `placeholder` parameter of `toolOutputDetail` (`execution/command/output.ts`, today
  `execution/command/contracts.ts:262`) and drop the argument at the eight calls. Callers with their own text keep it.
- Size: small

### S01-013: Thirteen scratch-folder prefixes that nothing reads

- Where: `packages/cli/src/platform/scratch.ts:13`; in this area `commits.ts:25`, `licenses.ts:76`,
  `general/public.ts:183`, `secrets.ts:84`, `security.ts:80`, `site/public.ts:103`
- Kind: simplify
- Problem: Every caller of `scratchFolder` invents a prefix (`'gspot-jscpd-'`, `'gspot-codeql-'`, ...). The prefix
  only names a temporary folder that is deleted after use, and no test or tool reads it. Moving 13 such strings to
  `config/` would add 13 constants that do nothing.
- Fix: `scratchFolder()` (`system/files.ts`) takes no argument and always uses `gspot-`. Drop the prefix at every
  call. No value moves.
- Size: small

## Target checks

The built-in checks of this area after the cleanup, by final check ID.

| Check                                                                                                                                                                                       | What it finds                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| gspot/generated-files                                                                                                                                                                       | A file gspot wrote is changed, missing, left over, or has merge conflict marks.                                                                                                             |
| gspot/settings-format                                                                                                                                                                       | gspot.toml is not in the order and format gspot writes (it has a fix).                                                                                                                      |
| gspot/unused-entries                                                                                                                                                                        | A path written in gspot.toml matches no file.                                                                                                                                               |
| gspot/suppressions                                                                                                                                                                          | A comment that silences a finding has no reason, or is a kind that is not allowed.                                                                                                          |
| repository/large-files                                                                                                                                                                      | A tracked file is bigger than the limit and not in Git LFS.                                                                                                                                 |
| repository/tracked-files                                                                                                                                                                    | Git tracks a file that should not be tracked, such as `node_modules` or `.env`.                                                                                                             |
| docs/missing-paths                                                                                                                                                                          | A path or `run` command written in Markdown names nothing that exists.                                                                                                                      |
| docs/required-files                                                                                                                                                                         | A scope has no README.md, or the root has no LICENSE.                                                                                                                                       |
| docs/readme-shape                                                                                                                                                                           | A README lacks an opening paragraph, a Contents list when long, or a getting-started section.                                                                                               |
| duplication/jscpd                                                                                                                                                                           | Code copied between files, once the copied share passes the limit.                                                                                                                          |
| prose/vale                                                                                                                                                                                  | Vale's writing alerts.                                                                                                                                                                      |
| secrets/env-examples                                                                                                                                                                        | Code reads an environment variable that no env example lists.                                                                                                                               |
| secrets/gitleaks-pushed, secrets/trufflehog                                                                                                                                                 | Secrets in the commits about to be pushed.                                                                                                                                                  |
| commits/commitlint-pushed                                                                                                                                                                   | Bad commit messages in the commits about to be pushed.                                                                                                                                      |
| security/codeql, security/semgrep                                                                                                                                                           | Security problems that CodeQL and Semgrep find.                                                                                                                                             |
| dependencies/package-json                                                                                                                                                                   | The root package.json names no packageManager, packages name different ones, a workspace root is not private, or lockfiles of two package managers exist.                                   |
| dependencies/stale-lockfile                                                                                                                                                                 | The lockfile no longer matches package.json.                                                                                                                                                |
| dependencies/bun-release-age                                                                                                                                                                | bunfig.toml does not wait the set number of days before it installs a new release, or names no scanner.                                                                                     |
| dependencies/lockfile-hosts                                                                                                                                                                 | A lockfile downloads from a host that is not HTTPS or not allowed.                                                                                                                          |
| nextjs/version-pairs, react/version-pairs                                                                                                                                                   | Two packages that must match (react, react-dom) are installed at different versions.                                                                                                        |
| licenses/allowed                                                                                                                                                                            | An installed dependency has a license that is not allowed.                                                                                                                                  |
| drizzle/stale-migrations, cloudflare/stale-types, openapi/stale-document, supabase/stale-types                                                                                              | A committed generated file differs from what its generator writes now.                                                                                                                      |
| site/build, site/build-reproducible, site/html-validate, site/purgecss, site/linkinator, site/linkinator-external, site/size, site/sitemap, site/unused-assets, site/svgo, site/webmanifest | The site does not build, builds differently twice, has invalid HTML, unused CSS, broken links, is too heavy, has a wrong sitemap, unused assets, unoptimized SVG, or a broken web manifest. |
| naming/identifiers                                                                                                                                                                          | A name in code has the wrong case, is too long, has too many words, or uses a banned word.                                                                                                  |
| naming/paths                                                                                                                                                                                | A file or folder name has the wrong case or a banned word, the banned folder words included.                                                                                                |
| naming/settings                                                                                                                                                                             | An allowed name in a `[[naming.override]]` record that no code in its paths uses.                                                                                                           |
| structure/lone-files                                                                                                                                                                        | A folder holds one code file and nothing else.                                                                                                                                              |
| structure/shared-prefixes                                                                                                                                                                   | Sibling files share a name prefix (asset-card, asset-list).                                                                                                                                 |
| structure/file-folder-clashes                                                                                                                                                               | A file and a folder have the same name (turn.ts beside turn/).                                                                                                                              |
| structure/file-lines                                                                                                                                                                        | A Bash, Python, or SQL file has too many code lines.                                                                                                                                        |
| structure/trivial-functions                                                                                                                                                                 | A Bash, Python, or Swift function is too small to be worth a function, or a file only forwards.                                                                                             |
| structure/env-reads                                                                                                                                                                         | Bash, Python, or Swift code reads an environment variable outside the files that `architecture.roles.environment_readers` lists.                                                            |

Deleted: docs/headings (CFG-003), structure/folder-names (CKG-003), structure/config-logic (CKG-010),
structure/test-placement (CKG-011), structure/private-before-public and structure/import-comments (CKG-055).

## Layout

All paths are under `packages/cli/src/`.

```text
checks/
  built-in.ts                  CHECK_FUNCTIONS and BUILT_IN_CHECKS (was public.ts, ARC-003)
  finding.ts                   findingAt
  stale-generated-files.ts     the four */stale-* checks (was general/generated-code.ts)
  framework/
    version-pairs.ts           nextjs/version-pairs, react/version-pairs (was general/dependencies/public.ts)
    site/
      build.ts                 site/build, site/build-reproducible, the shared build
      built-pages.ts           site/linkinator(-external), site/html-validate, site/purgecss, site/size, site/sitemap
      source-files.ts          site/unused-assets, site/svgo, site/webmanifest
      linkinator-program.ts    the program gspot starts to run Linkinator
      purgecss-program.ts      the program gspot starts to run PurgeCSS
  general/
    commits.ts                 commits/commitlint-pushed
    docs.ts                    docs/missing-paths, docs/required-files, docs/readme-shape
    duplication.ts             duplication/jscpd (from general/public.ts)
    licenses.ts                licenses/allowed
    prose.ts                   prose/vale (from general/public.ts)
    repository.ts              repository/large-files, repository/tracked-files
    secrets.ts                 secrets/gitleaks-pushed, secrets/trufflehog, secrets/env-examples
    security.ts                security/codeql, security/semgrep
    dependencies/
      bun-release-age.ts
      lockfile-hosts.ts        (was lockfile/hosts.ts)
      package-json.ts          (was manifests.ts)
      stale-lockfile.ts        (was lockfile/fresh.ts)
    gspot/
      generated-files.ts       (from general/contracts.ts)
      settings-format.ts       (from general/contracts.ts)
      unused-entries.ts        (from general/contracts.ts)
      suppressions.ts          (was structure/public.ts)
    naming/
      checks.ts                naming/identifiers, naming/paths, naming/settings (was identifiers.ts)
      identifiers.ts           reads names out of paths and sources (from contracts.ts)
      names.ts                 the findings for one name (was public.ts)
      settings.ts              readNamingSettings and the compiled terms and overrides (from contracts.ts)
    structure/
      conventions.ts           parses Bash, Python, and Swift once for env-reads and trivial-functions
      env-reads.ts             (was env-owner.ts)
      file-folder-clashes.ts   (was stem-collisions.ts)
      file-lines.ts
      lone-files.ts
      shared-prefixes.ts       (was prefix-collisions.ts)
      source-files.ts          the file filter of the folder checks
      trivial-functions.ts
config/checks/general/         one file per configuration (see "Config and types files")
config/checks/framework/       site.ts, version-pairs.ts
config/checks/database.ts, config/checks/library.ts
types/checks/general.ts, types/checks/framework.ts, types/checks/database.ts, types/checks/infrastructure.ts
types/configurations.ts        GeneratedPath
types/global.d.ts              the SPDX module declarations
```

Deleted: `checks/general/structure/{config-logic,folder-names,import-comments,private-before-public,test-placement}.ts`,
`checks/general/{contracts,public}.ts`, `checks/general/site/`, `checks/general/naming/contracts.ts`,
`checks/general/dependencies/{manifests,public}.ts`, `checks/general/dependencies/lockfile/`,
`config/checks/general/site.ts`, `config/checks/{postgres,swift-snapshot-testing}.ts`, the folder
`types/checks/general/` (`spdx.d.ts` included), and `types/checks/{cloudflare,docker,nginx,postgres}.ts`.

## Config and types files

All paths are under `packages/cli/src/`. Each `config/` file is written `as const` with no type annotation, so
`config/` imports only `config/`.

| File                                       | Holds                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/checks/general/commits.ts`         | `COMMIT_MESSAGE_ARGUMENTS`, `MESSAGE_FILE` (new file)                                                                                                                                                                                                                                                                                                                                                                                               |
| `config/checks/general/dependencies.ts`    | `LOCKFILE_URL`, `NPM_DOWNLOAD`, `LOCKFILE_DIAGNOSTIC_LINES`, `YARN_BERRY_LOCKFILE`, `YARN_BERRY_FROZEN`, `YARN_SCRIPTS_OFF`, `BINARY_BUN_LOCKFILE`                                                                                                                                                                                                                                                                                                  |
| `config/checks/general/docs.ts`            | `FILE_EXTENSION`, `START_WORDS`, `CONTENTS_TITLE`, `SECTION_DEPTH`, `README_FILE`, `LICENSE_PATH`, `MISE_RUN`, `MISE_CONF_FILES`                                                                                                                                                                                                                                                                                                                    |
| `config/checks/general/duplication.ts`     | `JSCPD`, `JSCPD_ARGUMENTS`, `JSCPD_CONFIG_FILE`, `JSCPD_REPORT_FILE`                                                                                                                                                                                                                                                                                                                                                                                |
| `config/checks/general/gspot.ts`           | `GENERATED_FILE_MESSAGES`, `GENERATED_FILE_HELP`, `APPLY_HELP`, `REASON_ABOVE`, `NEGATED_PATTERN`                                                                                                                                                                                                                                                                                                                                                   |
| `config/checks/general/licenses.ts`        | `LICENSE_CHECKER`, `LICENSE_CHECKER_ARGUMENTS`, `PIP_LICENSES_COMMAND`, `UNKNOWN_LICENSE`, `LICENSE_CHOICE`                                                                                                                                                                                                                                                                                                                                         |
| `config/checks/general/naming.ts`          | `CASE_NAMES`; the word and digit patterns (`DIGIT`, `DIGITS_ONLY`, `DIGIT_RUNS`, `DIGIT_BOUNDARY`, `LOWER_WORD`, `CAMEL_WORD`, `PASCAL_WORD`, `UPPER_WORD`, `MIGRATION_DIGITS`, `NUMERIC_WORDS`, `SEPARATORS`, `LAST_EXTENSION`, `REST_SEGMENT`); `CATEGORY_PARENTS`, `VERB_CATEGORIES`, `TEST_TERM_GROUP`, `SWIFTLINT_PARENTS`, `RUFF_CATEGORIES`                                                                                                  |
| `config/checks/general/prose.ts`           | `VALE_ARGUMENTS`, `VALE_ERROR_LINE`                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `config/checks/general/secrets.ts`         | `CHANGE_LINE`, `DIFF_TREE`, `COMMIT_METADATA`, `GITLEAKS_LOG_OPTIONS`, `GITLEAKS_LOG_FLAG`, `RAW_CHANGE_FIELDS`, `ENV_READ_PATTERNS`, `ENV_READ_LANGUAGES`, `ENV_KEY_LINE`, `ENUMERATOR_FILE`, `TRUFFLEHOG_ENUMERATOR`, `TRUFFLEHOG_FLAGS`                                                                                                                                                                                                          |
| `config/checks/general/security.ts`        | `CODEQL`, `CODEQL_LANGUAGES_COMMAND`, `CODEQL_ANALYZE_FLAGS`, `CODEQL_SUITES`                                                                                                                                                                                                                                                                                                                                                                       |
| `config/checks/general/structure.ts`       | `CONVENTION_QUERIES`, `COMMENT_MARKERS`, `INDEX_STEMS`, `OS_ENVIRONMENT_MEMBERS`, `OS_MODULE`, `ENV_NAME`, `PYTHON_SCOPE_NODES`, `LANGUAGE_BY_EXTENSION`, `SPEC_SUFFIX`                                                                                                                                                                                                                                                                             |
| `config/checks/framework/site.ts`          | the site build, page, link, sitemap, svgo, and PurgeCSS values (from `config/checks/general/site.ts`), among them `SITEMAP_FILE`, `SITEMAP_LOCATION`, `PLACEHOLDER_ORIGIN`, `LINKINATOR`, `PURGECSS`, `HTML_VALIDATE`, `SVGO_COMMAND`, `PURGECSS_CONTENT`                                                                                                                                                                                           |
| `config/checks/framework/version-pairs.ts` | `NEXT_VERSION_PAIRS`, `REACT_VERSION_PAIRS`                                                                                                                                                                                                                                                                                                                                                                                                         |
| `config/checks/database.ts`                | `CONSTRAINT_SUFFIXES`, `PUBLIC_SCHEMA`, `MIGRATION_DOWN`, `SCHEMA_PART_INDEX` (from `config/checks/postgres.ts`)                                                                                                                                                                                                                                                                                                                                    |
| `config/checks/library.ts`                 | `RECORDING_MODES`, `RECORDING_NAMES` (from `config/checks/swift-snapshot-testing.ts`)                                                                                                                                                                                                                                                                                                                                                               |
| `config/generation/prose.ts`               | adds `SCRIPT_GRAMMAR` beside `PROSE_GRAMMARS`                                                                                                                                                                                                                                                                                                                                                                                                       |
| `config/generation/file-edits.ts`          | `BUNFIG_FILE` (today `BUNFIG`)                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `config/parsers/lockfiles.ts`              | `LOCKFILES` with its new `stale` field, `YARN_LOCKFILE`                                                                                                                                                                                                                                                                                                                                                                                             |
| `config/parsers/dependency-files.ts`       | `PACKAGE_JSON`                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `config/repository/inventory.ts`           | `LFS_FILTER`, `TOOL_VERSIONS_FILE`, `MARKDOWN_EXTENSION`, `SQL_EXTENSION`                                                                                                                                                                                                                                                                                                                                                                           |
| `config/repository/tracked.ts`             | `GITIGNORE_FILE`, `NODE_MODULES`                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `config/tools/python.ts`                   | `PYTHON_ENVIRONMENT_FOLDER`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `config/tools/vale.ts`                     | `VALE_TOOL`                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `types/checks/general.ts`                  | `PathIndex`, `TaskSources` (docs/missing-paths); `LicensedPackage`, `ProjectLicenses`, `AllowedPackage`, the `[licenses]` table interface (LAY-004); `NamingSettings`, `CompiledOverride`, `CategoryLimits`, `Term`, `NamingInputs`, `NamingContext`, `NamingSource`, `FileNames`, `PathContainer`, `CaseName`; `ProseRoute`, `ProseRouteGroup`; `ConventionSource`, `EnvironmentKind`, `EnvironmentScope`, `EnvironmentNames`; `SuppressionSyntax` |
| `types/checks/framework.ts`                | `SiteBuild`, `LinkinatorConstructor`, `PurgecssConstructor`                                                                                                                                                                                                                                                                                                                                                                                         |
| `types/checks/infrastructure.ts`           | `ComposeFiles`, `ComposeDeclaration`, `ComposeDocuments`, `Mount`, `NginxMounts`                                                                                                                                                                                                                                                                                                                                                                    |
| `types/checks/database.ts`                 | `StatementReader`, `SchemaAlterations`, `Declared`, `ForeignKey`, `Migration`, `Schema`, `SchemaState`, `Location`                                                                                                                                                                                                                                                                                                                                  |
| `types/configurations.ts`                  | `GeneratedPath`                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `types/global.d.ts`                        | the two SPDX module declarations, with the `RegExp.escape` global (PLR-050)                                                                                                                                                                                                                                                                                                                                                                         |

Values that stay in code: `CASE_TESTS` (a table of functions), `BUILD_MEMO` (it holds a factory function),
`CHECK_FUNCTIONS` and `BUILT_IN_CHECKS` (tables of check functions; `config/` may not import code), the check
functions `namingIdentifiers` and `namingPaths`, and the run-time values of the two program scripts (`executable`,
`api`, `request`, `checker`, `result`, `report`). Also in code: user-facing messages; rule IDs (`'missing-path'`,
`'stale'`); property names of parsed objects and gspot.toml keys read through `options()`; single tree-sitter
node-type comparisons; the gitleaks and commitlint commands, which come from the manifest (CKG-045); obvious
literals; and values built at run time: the `run` pattern of the docs check, built from `RUNNER_NAMES` in
`config/repository/tooling.ts`, and the CodeQL query-pack path. The scratch-folder prefixes go (S01-013).

## Import fixes

Today these `config/` and `types/` files import what the rule does not allow (`config/` imports only `config/`;
`types/` imports only `config/` and `types/`). Every exported type is written by hand in `types/`, and its schema is
checked against it.

| File                                  | Import that goes                                                                  | Fix                                                                                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config/checks/general/gspot.ts`      | `type { Drift }` from `types/lifecycle/apply.ts`                                  | Write `GENERATED_FILE_MESSAGES` and `GENERATED_FILE_HELP` `as const` with no annotation. In `types/`, the kind is `keyof typeof GENERATED_FILE_MESSAGES`.                                                    |
| `config/checks/general/structure.ts`  | `type { CountedLanguage }` from `types/parsers/statements.ts`                     | Drop the `Record<CountedLanguage, string>` annotation of `CONVENTION_QUERIES`; the index `CONVENTION_QUERIES[source.language]` in `captureSource` still fails to compile if a language is missing.           |
| `config/checks/general/structure.ts`  | `type { CommentStyle, EnvironmentKind }` from `types/checks/general/structure.ts` | `CommentStyle` goes (CKG-043). Write `OS_ENVIRONMENT_MEMBERS` `as const`; `EnvironmentKind` in `types/` becomes `'os' \| (typeof OS_ENVIRONMENT_MEMBERS)[keyof typeof OS_ENVIRONMENT_MEMBERS] \| undefined`. |
| `config/checks/postgres.ts`           | `type { MigrationStatement }` from `types/checks/postgres.ts`                     | Goes with `MIGRATION_STATEMENTS` (CKO-041).                                                                                                                                                                  |
| `types/checks/general/duplication.ts` | `cloneReportSchema` from `parsers/schema/duplication.ts`                          | The file goes; `CloneReport` and `CloneScope` go with CKG-054.                                                                                                                                               |
| `types/checks/general/licenses.ts`    | `allowlistSchema` from `parsers/schema/licenses.ts`                               | S01-004.                                                                                                                                                                                                     |
| `types/checks/general/naming.ts`      | `pathContainerSchema` from `parsers/schema/naming.ts`                             | `PathContainer` is written by hand in `types/checks/general.ts`; its schema is checked against it.                                                                                                           |
| `types/checks/general/site.ts`        | `linkinatorReportSchema` from `parsers/schema/site.ts`                            | The trimmed `LinkinatorConstructor` returns `Promise<{ passed: boolean }>` (S01-009).                                                                                                                        |

Allowed and kept: `import type` from `web-tree-sitter` (`Node`, `Tree`) and `@pgsql/types` (`AlterTableCmd`), which
the types build on, and `config/checks/general/secrets.ts` importing `HASH_SOURCE` from `config/parsers/git.ts`.
Outside this area, about 20 more `config/` files import a type from `types/`, and `config/platform/runtime.ts` imports
the CLI's `package.json`; the same fix applies to each.

## Names

The glossary decides every name; these are the ones this area uses.

- A check that gspot runs in its own code: built-in check (`BuiltInCheck`, `CHECK_FUNCTIONS`, `BUILT_IN_CHECKS` in
  `checks/built-in.ts`). Not "calculation", "native registry", or "implementation".
- Parsed source for the convention checks: convention source (`ConventionSource`, `CONVENTION_QUERIES`,
  `readConventionSources`). Not "house".
- package.json, pyproject.toml, and similar files: dependency file (`PACKAGE_JSON`, `packageJson`). "Manifest" means
  only a configuration's `manifest.toml`.
- Committed output that no longer matches its source: stale (`staleLockfile`, `staleGeneratedFiles`,
  `*/stale-*`). Not "fresh" or "drift"; gspot/drift is gspot/generated-files.
- Something nothing uses: unused (gspot/unused-entries, site/unused-assets). Not "dead" or "unmatched".
- A number that bounds a check: limit. Not "ceiling", "threshold", "floor", or "maximum".
- One tool's comment syntax for silencing a finding: suppression syntax (`SuppressionSyntax`,
  `suppressionSyntaxes`). Not "form" or "marker".
- What gspot.toml holds about naming: naming settings (`NamingSettings`, `readNamingSettings`, `naming/settings.ts`);
  the shipped data is the naming defaults (`naming/defaults.json`). Not "naming policy" or "effective policy".
- The files that may read environment variables: environment readers (`architecture.roles.environment_readers`,
  check structure/env-reads). Not "env owner".
- An example env file: env example (secrets/env-examples). Not "env template".
- Shared test code: test setup (`tests/setup/`), with no architecture role. Not "harness".
- The argument every check gets: check input. Not "check context".
