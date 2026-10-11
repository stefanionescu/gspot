# Repository root, scripts, mise tasks, and CI

This part holds everything in the repository that is not product code, tests, or docs pages: the root files
(package files, Bun and TypeScript settings, `mise.toml`, the pointer files gspot writes), the `scripts/` folders, the
mise tasks, the composite setup action, and the GitHub Actions workflows. Target: one `scripts/` folder with three
scripts, eight one-line tasks in `mise.toml`, a `ci.yml` of one test matrix and one docs job, one release job, and
this repository running the published gspot like any user once the first release is out (step 11 of the order of
work).

## Findings

### ROOT-001: Every install fails: `package.json` still lists the deleted patches

- Where: `package.json:50-55` (`patchedDependencies`), `bun.lock:207-212`
- Kind: fix-bug
- Problem: The `patches/` folder is gone, but `package.json` and `bun.lock` still tell Bun to apply four patch files.
  Bun stops an install when a listed patch file is missing ("Couldn't find patch file"), so every
  `bun install --frozen-lockfile` fails: `mise run setup`, the setup step of every CI job, `release.yml`, `docs.yml`,
  and `gspot.yml`. A machine with an old `node_modules` keeps working only until its next install.
- Fix: Delete the `patchedDependencies` block and run `bun install` once, so `bun.lock` loses its patch lines. Do not
  restore the folder. Step 0 of the order of work, together with ROOT-004 and ROOT-005, which handle what the patches
  did, so the tests and the docs check pass. RTX-001 edits the same file and lock: do both with one reinstall.
- Size: small

### ROOT-004: The zod patch kept `__proto__` keys that no user writes

- Where: deleted `patches/zod.patch`; `packages/cli/scripts/build.ts:43,52`; `packages/cli/package.json:85`; tests and
  test data with a `__proto__` key: `tests/cli/checks/general/gspot.test.ts:22,53`,
  `tests/cli/checks/general/naming/policy.test.ts:131,142`, `tests/cli/commands/init/templates.test.ts:23,44`,
  `tests/cli/parsers/json.test.ts:6-9`, `tests/cli/parsers/toml.test.ts:65`,
  `tests/cli/policy/read/boundaries.test.ts:33-53`, `tests/cli/policy/read/tools.test.ts:92`,
  `tests/cli/policy/templates/export.test.ts:28`, `tests/config/cli/policy/schema/cases.ts:276`,
  `tests/config/packages/launcher.ts:24-46`, `tests/packages/launcher.test.ts:148-183`; `gspot.toml:236` (`optin`)
- Kind: delete
- Problem: Zod drops object keys named `__proto__` on purpose, as a security guard. The patch removed those guards in
  six zod files so that a `gspot.toml` word, check, or scope named `__proto__` survives: a defensive extra for a state
  no user creates, and a fork of a dependency that upstream will never take. To ship it, the CLI build bundles the
  patched zod (`external` filters out `zod`) and copies `zod.LICENSE`, while npm still installs the real zod as a
  runtime dependency. The packed-CLI test "the packed CLI validates own record keys in Node and Bun without Node on PATH" (`tests/packages/launcher.test.ts:148-183`) first checks that the installed `gspot.js` and `zod.LICENSE` bytes equal the local build, which tests npm, not gspot, then runs three `__proto__` errors twice; what is left only checks exit code 0. The word `optin` in this repository's accepted words exists only for the patch.
- Fix: Keep the patch deleted (step 0, with ROOT-001). Delete the `__proto__` cases from the unit tests listed above, and keep their other own-record keys such as `constructor` and `toString`, which zod keeps without a patch; the unit tests cover key handling. Delete the packed-CLI test whole, with `RECORD_POLICY` and `INVALID_RECORD_POLICIES` (`tests/config/packages/launcher.ts:24-46`). Delete `optin` from `allowed_words`. The CLI bundle step of `scripts/build.ts` (SCR-005) makes every
  runtime dependency external (`external: Object.keys(packageManifest.dependencies)`) and copies no `zod.LICENSE`;
  `zod` stays a runtime dependency.
- Size: medium

### ROOT-005: Three deleted docs patches edited library HTML only to pass gspot's own HTML check

- Where: deleted `patches/expressive-code.patch`, `patches/frames.patch`, `patches/starlight.patch`;
  `package.json:51-53`; `.gspot/config/docs/html-validate-built.json`; `docs/src/theme.css:226,255`
- Kind: fix-bug
- Problem: The patches changed the HTML that Expressive Code 0.44.2 and Starlight 0.42.0 write: `<span>` instead of
  `<div>` lines inside `<pre><code>`, `type="button"` on buttons, an `aria-label` on the copy button, and a separate
  label for the mobile table of contents. They came in the commit that started running html-validate's recommended
  rules on the built site (`1ec77e444`), and their only job was to make that check pass. They were hidden exceptions:
  a fork of two libraries tied to exact versions, so every upgrade needed a new patch. With the patches gone, the docs
  check reports the library markup.
- Fix: Keep the patches deleted. In step 0, with ROOT-001: build the docs and run
  `gspot check --only site/html-validate` once. For each lint rule that fires on library markup (likely
  `element-permitted-content`, `no-implicit-button-type`, `unique-landmark`), add one `[[ignore]]` record to
  `gspot.toml` with `check = "site/html-validate"`, that `rule`, `paths = ["docs/**"]`, and
  `reason = "Starlight and Expressive Code write this markup."` Keep `docs/src/theme.css:226,255`: its
  `.expressive-code .copy button > div` rules match the library markup again. Every Starlight user of gspot gets the
  same findings.
- Size: small

### ROOT-009: The `ci.yml` "check" job is left over from when it ran `gspot check`

- Where: `.github/workflows/ci.yml:19-45`
- Kind: delete
- Problem: Since `f1f6a5325` moved `gspot check` to `gspot.yml`, this job checks nothing its name says. What remains:
  `fetch-depth: 0` and the "Point origin/HEAD" step (both served the commit checks that left), `id: install` (its only
  reader is gone), `install:checks` followed by a second install with `--refresh-lockfiles` and a
  `git diff --exit-code` of the tool lockfiles, `check:pins`, and `build:cli`. The CLI is built three times in this one
  job. Working out every locked version again turns CI red whenever any of about 1,000 locked packages publishes a
  release inside its allowed range.
- Fix: Delete the whole job. Its `check:pins` step goes in step 0 with the task (SCR-007); the rest goes in step 4 of
  the order of work, when the workflows change with the tasks they call (RTX-003). `install:checks` and the two
  lockfile steps go with GEN-002.
- Size: small

### ROOT-012: The CLI bundles `@bacons/xcode` without its license

- Where: `packages/cli/package.json:88`, `packages/cli/src/parsers/tool/public.ts:4`, `packages/cli/scripts/build.ts:43`
- Kind: fix-bug
- Problem: The CLI imports `@bacons/xcode/json` at run time, but the package lists it under `devDependencies`. The
  build makes only `dependencies` external, so Bun copies this parser into `dist/gspot.js`, and its license notice is
  not shipped. The bundling is on purpose (`7e7008abc`): as a runtime dependency, npm would install the whole package
  for every user, with `uuid@^8.3.2` and `@expo/plist` (old `@xmldom/xmldom`), while only the `@bacons/xcode/json`
  parser, which imports neither, ends up in the bundle.
- Fix: Keep it bundled and ship its notice. The CLI step of `scripts/build.ts` (SCR-005) writes
  `dist/THIRD-PARTY-NOTICES.md` with the package name, version, MIT license text, and author (the package has no
  LICENSE file, only `"license": "MIT"`). The notice must be in the package before the first publish (step 10 of the
  order of work).
- Size: small

### ROOT-013: The old `.prettierrc.json` hides gspot's Prettier pointer

- Where: `.prettierrc.json`, `prettier.config.mjs`, `.gspot/config/prettier.json`
- Kind: delete
- Problem: Prettier looks for `.prettierrc.json` before `prettier.config.mjs` in the same folder, so editors and
  Prettier use a hand-made `.prettierrc.json` from 2026-09-18 and never read gspot's pointer. Both hold the same values
  today, so nothing differs yet; when gspot changes its Prettier settings, this repository will not follow. gspot's
  format configuration lists `.prettierrc.json` under `replace`, so gspot should have replaced it. The file is also
  read-only on disk, and no code or test reads it.
- Fix: Delete `.prettierrc.json`.
- Size: small

### ROOT-017: Two scripts folders with no rule for which script goes where

- Where: `scripts/`, `packages/cli/scripts/`, `packages/eslint-plugin/build.ts`; `gspot.toml:157` (module paths of the
  ESLint plugin), `gspot.toml:163` (`scripts = ["packages/*/scripts/**"]`), `gspot.toml:418` (CodeQL ignore path)
- Kind: move
- Problem: The CLI build scripts live in `packages/cli/scripts/`, the plugin build at the plugin root, and the CLI's
  schema writer in the root `scripts/`. The architecture role `scripts` covers only `packages/*/scripts/**`, not the
  folder called `scripts/`. A newcomer cannot guess where a script is.
- Fix: One folder, the root `scripts/` (see "Target mise tasks and scripts"). The three build files become one
  `scripts/build.ts` (SCR-005); `scripts/setting-values.ts` is deleted (ROOT-029); `assertManifests` moves out of the
  shipped source into `scripts/manifests.ts` (LIF-007). Delete `packages/cli/scripts/` and
  `packages/eslint-plugin/build.ts`. In `gspot.toml`: `architecture.roles.scripts = ["scripts/**"]`; drop
  `packages/eslint-plugin/build.ts` from the paths of the `eslint-plugin` module (NMU-048); move the CodeQL ignore
  path from `packages/cli/scripts/grammars.ts` to `scripts/build.ts`.
- Size: medium

### ROOT-018: Scripts and tests import each other, and the import aliases do not match folder names

- Where: `scripts/workspace.ts`, `scripts/types/package.ts`, `scripts/parsers/npm.ts:7`, `scripts/plugin.ts:8-18`, 9
  test files that import `#automation/workspace.ts`, `tests/harness/registry.ts:7`, `tests/harness/consumer.ts:11`,
  `tests/packages/tools.test.ts:11`; `package.json:47-49` (`imports`); `tsconfig.json:23-30` (`paths`)
- Kind: move
- Problem: `scripts/workspace.ts` (one line: the repository root) is imported by 9 test files, 7 of them `as root`.
  `PublishedRelease` and `npmPackSchema` sit in `scripts/`, but only tests use them, while `scripts/plugin.ts` imports
  five `tests/harness` modules. The aliases do not match the folders: `#automation/*` points at `scripts/` and is
  declared twice (the root `package.json` `imports` and the `tsconfig.json` `paths`, while every other alias exists
  only in `tsconfig.json`, which Bun reads); `#plugin/*` and `#plugin-package` name the ESLint plugin; and
  `#workspace-package` names the root `package.json`, though "workspace" means npm workspaces elsewhere. `#cli-package`
  is imported as `packageManifest` and as `cliPackage`, and the plugin package under three names.
- Fix: Delete `scripts/workspace.ts`; tests take the repository root from the test setup in `tests/setup/`. The
  packing and registry code and `npmPackSchema` (ROOT-026) stay test setup in `tests/setup/install.ts` (SCR-004);
  `PublishedRelease` is deleted (THR-016). Delete the scripts alias: the `imports` block of the root `package.json` and
  `#automation/*` in `tsconfig.json`; nothing imports `scripts/` once its tests go and `scripts/build.ts` imports
  `./manifests.ts` by path. Rename the other aliases: `#plugin/*` to `#eslint-plugin/*` and `#plugin-package` to
  `#eslint-plugin-package` (NMU-048), imported as `eslintPluginPackage` everywhere; `#workspace-package` to
  `#root-package`. Import `#cli-package` as `cliPackage` everywhere.
- Size: medium

### ROOT-019: Eight tiny files in `scripts/config/`, `scripts/parsers/`, and `scripts/types/`

- Where: `scripts/config/arguments.ts`, `scripts/config/pins.ts`, `scripts/config/plugin.ts`, `scripts/parsers/npm.ts`,
  `scripts/parsers/releases.ts`, `scripts/types/npm.ts`, `scripts/types/package.ts`, `scripts/types/pins.ts`;
  `packages/cli/src/parsers/schema/public.ts:263-327`
- Kind: delete
- Problem: These 99 lines hold constants, schemas, and types that each have one script user (plus a test).
  `types/npm.ts` is a one-line `z.infer` of a schema in `parsers/npm.ts`, which imports it back: a cycle. Four items
  that only the rule-list update uses (`captureEslintPreset`, `eslintRuleModuleSchema`, `eslintModuleSchema`,
  `eslintGlobalsSchema`) sit in the CLI's runtime source.
- Fix: All eight files go:
    - `config/pins.ts`, `parsers/releases.ts`, and `types/pins.ts` with `check:pins` (SCR-007);
    - `config/arguments.ts` (ROOT-020);
    - `config/plugin.ts`: its exit codes 130 and 143 move to `tests/config/integration.ts` (SCR-003), and its Supabase
      path is deleted (ROOT-027);

    - `types/package.ts` (`PublishedRelease`, THR-016) and `types/npm.ts` (`NpmPackageIdentity`: no exported type is a
      `z.infer`);

    - `parsers/npm.ts` splits: `npmPackSchema` goes to `tests/setup/install.ts` (ROOT-026); `readInstalledNpmPackage`
      merges into `installedAtPin` in `scripts/update-rule-lists.ts`, with `npmPackageIdentitySchema`.

    The four CLI items above move into `scripts/update-rule-lists.ts`, their one user, whose `presets` variable becomes
    `ruleNames`; put its top-level work under `if (import.meta.main)` only if a test still imports from it.
    `scripts/parsers/` is deleted. `scripts/config/` and `scripts/types/` stay, with the topic files of "Target mise
    tasks and scripts".

- Size: medium

### ROOT-020: `ARGUMENT_START = 2` exists only to dodge a lint rule

- Where: `scripts/config/arguments.ts:1`, `scripts/plugin.ts:65`, `scripts/release.ts:8`, `scripts/setting-values.ts:11`
- Kind: delete
- Problem: A file with one constant replaces `process.argv.slice(2)`, because the magic-number rule allows only -1, 0,
  and 1. It repeats the CLI's `PROGRAM_ARGUMENT_OFFSET` under a second name.
- Fix: Delete `scripts/config/arguments.ts`. Its three users are deleted: `scripts/plugin.ts` (SCR-003),
  `scripts/release.ts` (SCR-008), and `scripts/setting-values.ts` (ROOT-029). A script that later reads its arguments
  writes `const [_runtime, _script, ...args] = process.argv;` or `process.argv[2]`: the lint config allows both
  (`destructuredArrayIgnorePattern: "^_"`, `ignoreArrayIndexes: true`), and both keep the flags that
  `parseArgs(...).positionals` would drop.
- Size: small

### ROOT-021: Build-only constants sit in the shipped CLI source, and two of them are special 30-second time limits

- Where: `scripts/config/pins.ts:1` (`REGISTRY_TIMEOUT_MS`), `scripts/pins.ts:33`;
  `packages/cli/src/config/platform/assets.ts:2-10,19,21` (`GRAMMAR_PACKAGES`, `SWIFT_GRAMMAR_FILE`,
  `DOWNLOAD_TIMEOUT_MS`); `packages/cli/src/config/generation/pins.ts:35-44` (`swiftGrammar`);
  `packages/cli/src/types/platform/assets.ts` (`PinnedDownload`); `packages/cli/scripts/grammars.ts:25`
- Kind: move
- Problem: Two identical constants add their own time limit to `fetch`, beside the one CI job limit; one setting per
  concern allows no special time limits. The grammar file list, the Swift grammar pin, `DOWNLOAD_TIMEOUT_MS`, and
  `PinnedDownload` sit among the CLI's runtime settings, though only the grammar script reads them, so a reader thinks
  the CLI downloads files at run time.
- Fix: Delete both time limits and their `signal: AbortSignal.timeout(...)` options: `REGISTRY_TIMEOUT_MS` goes with
  `scripts/pins.ts` (SCR-007), and the grammar download in step 1 of `scripts/build.ts` has none (SCR-006). A hung
  download stops at the CI job limit or at Ctrl-C. Move `GRAMMAR_PACKAGES`, `SWIFT_GRAMMAR_FILE`, and the Swift grammar
  pin (`SWIFT_GRAMMAR_PIN`, without its name field) to `scripts/config/grammars.ts`, and delete `PinnedDownload`
  (SCR-006). `config/platform/assets.ts` stays as `config/system/assets.ts` for `GRAMMARS_FOLDER`, which the CLI reads
  and the build writes.
- Size: small

### ROOT-026: A regex guards npm's own pack output against path tricks

- Where: `scripts/parsers/npm.ts:6-7`
- Kind: simplify
- Problem: The schema requires the file name that `npm pack --json` reports to match `^[^/\\]+\.tgz$`, "so a reported
  path must remain a local filename". npm writes this name itself, so the guard covers a state that cannot happen. Its
  only reader joins the name with the folder it passed to npm.
- Fix: In `tests/setup/install.ts` (SCR-004), write `npmPackSchema` as
  `z.tuple([z.object({ filename: z.string() })]).rest(z.unknown())`.
- Size: small

### ROOT-027: The Supabase test that needs Docker has its own path constant, task, and workflow

- Where: `scripts/config/plugin.ts:5` (`SUPABASE_DATABASE_TEST`), `scripts/plugin.ts:77-80`, `mise.toml:72-74`
  (`test:database`), `.github/workflows/database.yml`
- Kind: delete
- Problem: The runner filters one hard-coded test path out of the tool tests, and the task `test:database` writes the
  same path again, so moving or renaming the test breaks both silently. The test needs Docker: it cannot run on macOS
  or Windows CI, and pulling its images hits the image registry rate limit, so it runs only by hand through
  `database.yml`. A unit test with a fake tool already covers its check.
- Fix: Delete the Docker test, `SUPABASE_DATABASE_TEST` and its filter (no runner script is left, SCR-003), the task
  `test:database`, and `.github/workflows/database.yml`. The Supabase cases that need no Docker stay ordinary integration tests in `tests/integration/platform/supabase.test.ts`, and their titles name `supabase/stale-types`, with no "native" or "freshness": today one test has six names (database, supabase, freshness, native, stale-types, platform).
- Size: small

### ROOT-028: The test runner writes its own mise file instead of using gspot's

- Where: `scripts/plugin.ts:28-43`, `packages/cli/src/generation/mise.ts:15-41`
- Kind: merge
- Problem: The runner turns `misePins(manifests)` into mise tool entries with its own code and `smol-toml`. gspot's
  `miseFile` already writes pinned tools for mise. Two pieces of code decide how a pinned tool looks in a mise file.
- Fix: The integration preload `tests/setup/integration.ts` (SCR-003) writes its temporary mise file with `miseFile`
  in `installPinnedTools` (today `installSuiteTools`), so it holds the same lines as `.gspot/mise.toml`: program tools
  only, with no gspot, no Node, no `os` field, and no `min_version` (INX-001, INX-002, INS-001). Delete the local
  mapping and the `smol-toml` import. With no `npm:` tool left, the file needs no `[settings.npm]` block. The mise
  command arguments and the file name (`MISE_TRUST`, `MISE_INSTALL`, `MISE_BIN_PATHS`, `PINNED_TOOLS_FILE`) go to
  `tests/config/integration.ts`. Order: the preload lands in step 4, but `miseFile` stops writing the gspot pin only in
  step 6 (INX-002); until then the preload must leave that pin out, because npm does not have the release yet.
- Size: small

### ROOT-029: `scripts/setting-values.ts` writes 827 lines of generated schema code from the wrong place

- Where: `scripts/setting-values.ts`, `packages/cli/scripts/build.ts:20-26`,
  `packages/cli/src/config/policy/setting-values.ts:2`, `packages/cli/src/policy/schema/native/`, `gspot.toml:270`,
  `.gspot/config/knip.json:128`
- Kind: delete
- Problem: The name does not say that the script writes `packages/cli/src/policy/schema/native/public.ts` and
  `contracts.ts` (827 generated lines). Only the CLI build calls it, by starting a second Bun process with `--check`.
  Nothing imports it, so knip needs a manual `entry` line. It formats its output twice to work around a Prettier bug,
  and it computes the repository root a third way.
- Fix: Delete the script, the files it writes, `SETTING_VALUES_COMMAND`, the build's `--check` subprocess, and the
  `scripts/setting-values.ts` item of `tools.knip.entry`, with the setting-schema generator (POL-001): each setting is
  declared once in TypeScript beside its zod schema.
- Size: small

### ROOT-033: `generate:docs` is a task with one caller

- Where: `mise.toml:20-23,53-56`
- Kind: merge
- Problem: Only `setup` runs `generate:docs` (`astro sync`). `build:docs` and `serve:docs` run the same step inside
  Astro anyway.
- Fix: `setup` runs `bun install --frozen-lockfile` and then `bun --cwd {{config_root}}/docs --bun astro sync`; delete
  `generate:docs`. Every CI job runs this one `mise run setup` (RTX-002).
- Size: small

### ROOT-044: The docs build artifact is kept for 90 days

- Where: `.github/workflows/docs.yml:62`
- Kind: simplify
- Problem: Only the `deploy` job of the same run downloads `documentation-${{ github.run_id }}`; nothing reads it
  later.
- Fix: `retention-days: 1`.
- Size: small

### ROOT-048: The generated `gspot.yml` repeats six setup steps in two jobs

- Where: `.github/workflows/gspot.yml:13-89`; generator `packages/cli/src/generation/documents/public.ts`
- Kind: merge
- Problem: `check-linux` and `manual-linux` each check out, restore the cache, install mise, run setup,
  `gspot install`, and `gspot doctor`; only the last step differs. "manual" here means "slow network checks", which is
  confusing in CI, and the short job names say little.
- Fix: The CI generator (`generation/ci.ts`, EXG-015) writes one job, `check`, with the steps of INS-003. Its last
  step runs the manual checks only on pushes to the default branch:
  `if: github.event_name == 'push' && github.ref == format('refs/heads/{0}', github.event.repository.default_branch)`.
  One job needs no second name. This repository's `gspot.yml` gets the new job when step 10 turns its CI back on.
- Size: medium

### ROOT-050: The generated `gspot.yml` runs on every branch and every tag push

- Where: `.github/workflows/gspot.yml:3-6`
- Kind: simplify
- Problem: `on: [push, pull_request, merge_group]` with no filter also fires for tag pushes such as `v0.1.0`, which
  repeat the main commit's run.
- Fix: The CI generator writes `push: { branches: ['**'] }` (branches only).
- Size: small

### ROOT-051: Concurrency group names repeat the workflow name

- Where: `.github/workflows/ci.yml:13`, `.github/workflows/gspot.yml:10` (from the CI generator)
- Kind: rename
- Problem: `ci-${{ github.workflow }}` becomes `ci-ci-...`; `gspot-${{ github.workflow }}` becomes `gspot-gspot-...`.
- Fix: Drop only the repeated prefix. `ci.yml`: `group: ${{ github.workflow }}-${{ github.ref }}` ("Target ci.yml").
  The `gspot.yml` generator:
  `group: ${{ github.workflow }}-${{ github.event_name == 'pull_request' && github.ref || github.run_id }}`. Keep the
  `run_id` part there: grouping pushes by `github.ref` would make a push to main wait for the running one and cancel
  any pending push run.
- Size: small

### ROOT-055: Node 22 types for a Node 24 project

- Where: `package.json:18`
- Kind: fix-bug
- Problem: `@types/node` is pinned at 22.18.6, but `engines` require Node 24.2 and mise installs 24.20.0. Type checks
  miss Node 24 functions and allow removed ones.
- Fix: Pin `@types/node` to the newest 24.x release.
- Size: small

### ROOT-056: The docs package hides that it uses the CLI source

- Where: `docs/package.json:6-16`, `.github/workflows/ci.yml:58`, `.github/workflows/docs.yml:50`
- Kind: simplify
- Problem: The docs import `#cli/...` source in 8 files (`docs/src/content/reference/*.ts`), but `docs/package.json`
  does not depend on `@gspothq/cli`, so the workflows install with `--filter '@gspothq/{cli,docs}'` to get its
  packages. The docs package does declare `@gspothq/eslint-plugin` for the same reason; `d4b9f0ea3` removed the CLI
  line with no user need named.
- Fix: Add `"@gspothq/cli": "workspace:*"` to `docs/package.json`, and use `--filter @gspothq/docs` in all three docs
  install lines (the `ci.yml` docs job and both `docs.yml` jobs, RTX-004); confirm with one docs build. Keep `zod` and
  `@commander-js/extra-typings` in the docs package: docs code imports them directly
  (`docs/src/content/reference/policy.ts:3`, `commands.ts:7`), and with Bun's isolated install they are not found from
  the CLI's folder.
- Size: small

### ROOT-057: The private docs package has a version nobody reads

- Where: `docs/package.json:4`
- Kind: delete
- Problem: `"version": "0.1.0"` sits on a private package that is never published; only workflow filters name
  `@gspothq/docs`.
- Fix: Delete the line. `package-json/require-version` does not need it: `tests/package.json` is private, has no
  version, and passes.
- Size: small

### ROOT-058: `sideEffects` in a CLI package

- Where: `packages/cli/package.json:100-102`
- Kind: delete
- Problem: `sideEffects` tells bundlers what they may drop when someone imports the package. The package exports only
  `package.json` (`"exports": { "./package.json": "./package.json" }`); nobody imports its code.
- Fix: Delete the `sideEffects` block.
- Size: small

### ROOT-059: `.prettierignore` lists files that do not exist

- Where: `.prettierignore:61-65`, `.semgrepignore`; tool file source
  `packages/cli/configurations/general/format/prettierignore.eta`
- Kind: simplify
- Problem: It lists `docs/prettier.config.mjs`, `packages/cli/prettier.config.mjs`,
  `packages/eslint-plugin/prettier.config.mjs`, and `tests/prettier.config.mjs`; none exist. It also repeats 11
  lockfile names for each of the five scopes. `.semgrepignore` has the same pattern. Nothing breaks today; it is
  noise.
- Fix: The tool file source lists only the pointer files gspot really writes, and lockfile patterns without a folder
  prefix (they match in every folder). Keep declared generated files such as `docs/worker-configuration.d.ts`, which
  the cloudflare configuration declares and Wrangler writes on demand. Do the same for `.semgrepignore`.
- Size: small

### ROOT-068: The build calls `configurationManifests()` twice and renames its own output

- Where: `packages/cli/scripts/build.ts:29-30,49`
- Kind: simplify
- Problem: Two calls build the same map. The build names the entry `main.ts`, then renames `main.js` to `gspot.js`.
- Fix: In `scripts/build.ts` (SCR-005), call `configurationManifests()` once and set `naming` so the CLI bundle is
  written as `gspot.js` (`CLI_EXECUTABLE` in `scripts/config/build.ts`); delete the rename. `src/main.ts` keeps its
  name.
- Size: small

### SCR-001: `scripts/gspot`, `scripts/gspot.cmd`, and two `mise.toml` settings work around a gspot that is not on npm yet

- Where: `scripts/gspot`, `scripts/gspot.cmd`, `mise.toml:1-3` (`[settings] disable_tools`), `mise.toml:9-11`
  (`[env] _.path`), `mise.toml:13`, `.mise/conf.d/gspot-tools.toml:6,11`; users `.gspot/hooks/pre-commit:4`,
  `pre-push:4`, `commit-msg:7`, `.github/workflows/gspot.yml:40-41,48,54,85-86,89`;
  `.gspot/config/eslint.config.mjs:199,200,218,1439,1447`
- Kind: delete
- Problem: gspot writes `"npm:@gspothq/cli" = "0.1.0"` into `.mise/conf.d/gspot-tools.toml`, so the generated hooks
  (`mise exec -- gspot`) would run that npm release. 0.1.0 is not on npm, so this repository turns the pin off
  (`disable_tools`) and puts a two-line launcher first on `PATH` (`[env] _.path`) that runs the CLI source with Bun:
  three special pieces that fight a file gspot generated. The commit that added them says why: "Repository tasks
  execute the CLI source before a release exists" (`2b9624e2e`). The cause is "no release yet". The ESLint config names
  `scripts/gspot` only because the file exists, and the comment on line 13 describes `gspot-tools.toml`. The conf.d
  file also holds this repository's only `node` pin.
- Fix: The launchers and both settings stay through the whole cleanup, so the hooks run the source CLI until the
  release.
    1. Step 6, when INX-001 deletes the conf.d file: add `node = "24.20.0"` to `[tools]` in the root `mise.toml`, beside
       `bun`, in the same commit. Without it nothing pins the Node that CI installs (`install_args: bun node`).
    2. Step 10 publishes `@gspothq/cli@0.1.0` and `@gspothq/eslint-plugin@0.1.0` (GEN-002).
    3. Step 11, in one commit: add `"npm:@gspothq/cli" = "0.1.0"` to `[tools]`; delete `scripts/gspot`,
       `scripts/gspot.cmd`, the `[settings] disable_tools` block, `[env] _.path`, and their comments; run `gspot apply`
       once with the published CLI, so the ESLint config stops naming `scripts/gspot`.
    4. Push steps 10 and 11 together: before step 11, `_.path` puts the launcher ahead of the published CLI on `PATH`,
       so the first run of the generated job must already see step 11.

    The hooks keep `mise exec -- gspot`: the root `package.json` does not list `@gspothq/cli`, so the start command is
    mise (INX-003). From step 11 that runs the release pinned in `mise.toml`, as in any repository on the mise path. To
    try the source by hand, run `bun packages/cli/src/main.ts <command>`. Trade-off: a change to gspot's checks reaches
    this repository's hooks at the next release; the unit, integration, and end-to-end tests check the source before
    that. A later change to the `gspot.toml` format or to the generated files reaches this repository the same way:
    release, raise the pin, then migrate `gspot.toml` and run `gspot apply` in one commit.

- Size: small

### SCR-002: Tests find `gspot` through the repository's launcher folder

- Where: `tests/harness/environment.ts:17` (`sourceLauncherDirectory`), `tests/config/harness/environment.ts:5`,
  `tests/harness/install.ts:172-175,202` (`buildSandboxPath`), `tests/harness/quickstart.ts:41`, `tests/tools/lifecycle/hooks.test.ts:91,149`,
  `tests/tools/lifecycle/mise-execution.test.ts:44,71`
- Kind: move
- Problem: Sandboxes run generated hooks that call `gspot` by name. The tests make that name run the source by putting
  the repository's `scripts/` folder first on `PATH`, and one test links `scripts/gspot` into a fake mise install. So
  a developer file is test setup, and it goes in step 11. Two more uses only need some folder inside the repository as
  `cwd` for `mise where`.
- Fix: In step 4, the integration preload (SCR-003) writes a `gspot` command once per run with the existing `fakeTool`
  (`tests/harness/platforms.ts:129`, which writes the POSIX file and the `.cmd`) that runs `packages/cli/src/main.ts`.
  The sandbox `PATH` (`sandboxPath`, today `buildSandboxPath`) puts that folder first, and the hook tests use it; `mise where` runs from the repository root, and `quickstart.ts:41` uses the repository
  root as `cwd`. Delete `sourceLauncherDirectory` and `MODULE_DIRECTORIES.launchers`. `mise-execution.test.ts` is
  deleted (INS-001).
- Size: small

### SCR-003: No test runner script: `bun test` and one preload do the job

- Where: `scripts/plugin.ts` (178 lines); `scripts/config/plugin.ts`; `mise.toml:16-18`, `:41-51`, `:72-74`;
  `.github/workflows/ci.yml:40`; `package.json` (`testdirs`)
- Kind: delete
- Problem: The file that starts every test suite is called "plugin". Its first word picks one of five modes: `cli`,
  `plugin` (no task uses it), `test` (means the `tools` folder), `package` (means the `packages` folder), and anything
  else (runs the source CLI), so each suite has three names (task, word, folder). The help text joins 104 file paths
  with " and ", two variables are set twice, and in the source-CLI mode `defaults` becomes the unused string
  `tests/undefined`. The runner has three jobs. (1) Unit tests: it adds `--timeout` and forwards to `bun test`; that
  time limit belongs in `tests/setup/preload.ts` (THR-025). (2) Integration and end-to-end tests: before the tests, it
  packs both packages, installs every pinned tool with mise, uses a private Bun cache, and removes the temporary folder
  at the end or on Ctrl-C. That is test setup, and Bun has a standard place for it: a preload file with global
  `beforeAll` and `afterAll`, run with `bun test --preload`. (3) It parses suite words, `--`, paths, and `--help`, which
  `bun test` already takes. The integration tests already start npm registries inside the test process
  (`createInstallationRegistry`, `Bun.serve` at `tests/harness/registry.ts:84`), so no second process is needed, and no
  test code has to move into `scripts/`. The runner also has a fourth job for this repository's own checks: the
  `install:checks` task uses it to pack the workspace ESLint plugin into a local registry, because the plugin is not on
  npm yet (GEN-002).
- Fix: In step 4 of the order of work, delete the test-runner part of `scripts/plugin.ts` and of
  `scripts/config/plugin.ts`; no runner script replaces it. Tasks: `test` runs `bun test tests/unit`;
  `test:integration` and `test:e2e` run
  `bun test --preload ./tests/setup/preload.ts --preload ./tests/setup/integration.ts tests/<folder>`; each task has
  `depends = ["build"]`. Both preloads are named, so the command works whether Bun adds the flag to the `bunfig.toml`
  list or replaces it. The new preload `tests/setup/integration.ts` holds `installPinnedTools` (today
  `installSuiteTools`; its mise file comes from `miseFile`, ROOT-028; no Python install, TTO-003), the packing with
  `packPackages`, `BUN_INSTALL_CACHE_DIR` and the packed-package variable set in `process.env`, the `gspot` command of
  SCR-002, and cleanup in a global `afterAll` and on `SIGINT` and `SIGTERM` with exit 130 and 143 (the Ctrl-C cleanup
  stays, THR-004). Its constants go to `tests/config/integration.ts`. The end-to-end files start their registry with
  `createNpmRegistry` in their own `beforeAll`, as the integration files already do. One file by hand:
  `bun test tests/unit/...`, or `mise run build` and then
  `bun test --preload ./tests/setup/integration.ts tests/integration/...`.

    Do this in step 4 in the same commits as the new `tests/` layout, the 8 tasks, and the workflows, so the integration
    tests always have a way to run and CI never calls a deleted task. In the same commits: the error texts that name
    `mise run test:tools` or `test:package` (`tests/harness/install.ts:68,162`, `registry.ts:75`, `consumer.ts:110`,
    `python-installation.ts:103`) name `test:integration` and `test:e2e`; and `testdirs` moves from the root
    `package.json` to `tests/package.json`, because only test files import it once the runner goes, and each workspace
    lists what it imports (Bun's isolated install). `@types/which` stays at the root: the CLI and the tests both import
    `which`. Verify with one real run that the two preloads stack, and that each Bun test group of step 4 runs only its
    own tests while the shards remain.

    The install part of `scripts/plugin.ts` (pack the workspace plugin into a local registry) and the `install:checks`
    task stay until step 11, as a workaround for the unpublished plugin, like the launchers (SCR-001). Step 11 deletes
    them with the rest of `scripts/plugin.ts` and `scripts/config/plugin.ts` (GEN-002).

- Size: medium

### SCR-004: Packing and the local npm registry belong in test setup, not in `scripts/`

- Where: `tests/harness/registry.ts:20-63` (`packedPackagesSchema`, `packRegistryPackages`), `tests/types/harness/registry.ts:3`, `:19`;
  `tests/harness/python-installation.ts:49-94` (`installSuitePythonTools`); `tests/config/harness/python-installation.ts:2`;
  callers `scripts/plugin.ts:127,143`, `tests/harness/registry.ts:78,140`, `tests/harness/quickstart.ts:21`
- Kind: move
- Problem: The packing (`packRegistryPackages`) and the local registry (`createPackageRegistry`) sit in
  `tests/harness/`. `installSuitePythonTools` and `packRegistryPackages` have one caller each, `scripts/plugin.ts`, so a
  repository script imports tests. The registry type file imports a schema from the helper that imports the type file
  back, a type cycle. Moving the code into a `scripts/npm-registry.ts` would make sense only for a runner script in
  `scripts/`. With no runner (SCR-003), only tests and the test preload use this code; in `scripts/` it would be test
  code outside `tests/`.
- Fix: It stays test setup: `packPackages` (today `packRegistryPackages`), `createNpmRegistry` (today
  `createPackageRegistry`), `createInstallationRegistry`, `packedPackagesSchema`, and `npmPackSchema` (ROOT-026) go to
  `tests/setup/install.ts`. Do not create `scripts/npm-registry.ts`. Delete `installSuitePythonTools` and
  `SUITE_PYTHON_FOLDER`: every sandbox runs the real `gspot install` (TTO-003). Write `PackedPackage`,
  `RegistryPackage`, and `NpmRegistry` by hand in `tests/types/e2e.ts` and check `packedPackagesSchema` against
  `PackedPackage`, which ends the cycle. The registry values (`REGISTRY_HOST`, `UPSTREAM_REGISTRY`,
  `GSPOT_PACKAGE_SCOPE`, `NPM_PACK_FLAGS`, `PACKED_PACKAGES_FILE`) go to `tests/config/integration.ts`.
- Size: medium

### SCR-005: Three build scripts and three entry points for one job

- Where: `packages/cli/scripts/build.ts`, `packages/cli/scripts/grammars.ts`, `packages/eslint-plugin/build.ts`; tasks
  `build:cli`, `build:plugin`, and the grammar line of `setup` (`mise.toml:20-23,33-39`); `release.yml:66-70`
- Kind: merge
- Problem: Every caller that builds one package also builds the other: the release runs the grammar copy,
  `build:plugin`, and `build:cli`, and the package tests need both. `setup` builds the plugin, but nothing needs it
  there: the docs import the plugin source, and from the first publish this repository's lint uses the published
  plugin. The CLI build refuses when the grammar files are missing instead of making them, so the release runs the
  grammar script by hand first ("run setup first to copy the grammars"). The CLI build also rewrites the tracked
  `packages/cli/README.md` from the root README, and the plugin version is typed a second time in the JavaScript
  manifest.
- Fix: One script, `scripts/build.ts`, and one task, `build`, in this order:
    1. write `packages/cli/grammars/` (SCR-006);
    2. check the manifests (`scripts/manifests.ts`, LIF-007) and the rule lists (`validateEslintPresets`);
    3. bundle `packages/cli/dist/gspot.js`, with every runtime dependency external (ROOT-004), the notice file
       (ROOT-012), and `naming` instead of a rename (ROOT-068); write the plugin version from
       `packages/eslint-plugin/package.json` into the CLI's built data (SLF-023);
    4. write `packages/cli/gspot.schema.json` from `buildJsonSchema` (`packages/cli/src/settings/schema/gspot-toml.ts`),
       its `$id` the versioned unpkg URL built from the version in `packages/cli/package.json` (CFR-001); add
       `gspot.schema.json` to `files` in `packages/cli/package.json` and `/packages/cli/gspot.schema.json` to
       `.gitignore` (build output, like `dist/`);
    5. bundle `packages/eslint-plugin/dist/plugin.js` as ESM only, with declarations (PLG-013, PLG-015);
    6. copy `LICENSE.md` into both `dist/` folders.

    About 130 lines. The build writes no `packages/cli/README.md`; that file is written by hand. Delete
    `packages/cli/scripts/`, `packages/eslint-plugin/build.ts`, and the tasks `build:cli` and `build:plugin`. The
    `gspot.toml` edits for the move are in ROOT-017. Order: steps 3 and 4 must be in before the first publish (step 10 of
    the order of work). A published npm version never changes, so a 0.1.0 without the schema file would leave its schema
    link broken for good.

- Size: medium

### SCR-006: The grammar copy is a build step, and `setup` should not run it

- Where: `packages/cli/scripts/grammars.ts` (`copyGrammars`, `:17-46,48-67`); `mise.toml:22`; `release.yml:67`;
  `packages/cli/src/config/platform/assets.ts:13-16`; `packages/cli/src/types/platform/assets.ts`
- Kind: merge
- Problem: The script fills `packages/cli/grammars/` (ignored by Git, shipped through `files`) with 7 grammar files
  from the `tree-sitter-*` dev dependencies, the Swift grammar downloaded from its GitHub release with a pinned SHA-256,
  the license of each, and 2 runtime files. The grammar copy is needed: each `tree-sitter-*` package compiles code on
  install (`"install": "node-gyp-build"`), so it cannot be a runtime dependency, and no npm package ships the Swift
  grammar file. The 2 runtime files are not needed (INS-008). The step runs in `setup`, so the tests and the release depend on someone having run `setup` lately. To download two files, the script reads a cached copy, checks its hash, downloads if missing, checks the hash again with two different error texts, writes to a random temporary name with an exclusive flag, renames, and cleans up in `finally`; the atomic write protects against two setups writing at once, which does not happen. `copyGrammars` has one caller and is defined after that call.
- Fix: The grammar copy becomes step 1 of `scripts/build.ts`, as top-level build steps with no `copyGrammars` function: copy the 7 files and their licenses; for the Swift grammar and its license, skip when the file exists with the pinned hash, else download, check the hash, and `writeFile`, with no temporary-file write (no time limit, ROOT-021). `downloadPinnedFile(path, url, checksum)` takes plain values, so `PinnedDownload`
  goes. Drop the 2 runtime files and their two license copies (`RUNTIME_WASM`, INS-008). Every test task
  depends on `build`, so the files exist before any test. `setup` only installs packages and writes the docs types. A
  Bun `type: "file"` import of each grammar is not used: the docs site bundles the CLI through `#cli/public.ts` with
  Astro and Vite, which do not know that form, and the Swift download and the licenses would stay.
- Size: small

### SCR-007: `check:pins` turns CI red on any upstream release and repeats checks that already run

- Where: `scripts/pins.ts`, `scripts/config/pins.ts`, `scripts/parsers/releases.ts`, `scripts/types/pins.ts`, `tests/cli/scripts/pins.test.ts`, `tests/config/cli/scripts/pins.ts`,
  `mise.toml:29-31`, `.github/workflows/ci.yml:42-43`
- Kind: delete
- Problem: The check job runs `mise run check:pins` on every push. The script reports an error, not a note, when
  actions/checkout, actions/cache, actions/setup-node, jdx/mise-action, jdx/mise, or the Swift grammar has a newer
  release, or when Node has a newer LTS major (`pins.ts:57-59,138-140`). So CI turns red for reasons that have nothing
  to do with the commit, and a red CI blocks a release. This check forced the mise bump that locks out older mise
  (INS-001). The rest repeats checks that already run: the integration tests install every mise pin and, through
  `gspot install` in sandboxes, the npm and Python pins of each configuration; a plugin that rejects the ESLint pin
  fails the integration test that runs it; the build checks the Swift grammar against its checksum; pinact
  (`pinact run --verify-comment --check`) checks the action pins in this repository's workflows; mise-action fails on
  a missing mise version; and `actions.node`, the one action pin in no workflow here, goes (INS-003). The script also
  scrapes the runner-images README, repeats the build's `validateEslintPresets`, skips the unpublished
  plugin by name, and exports three functions only for its test. That test mocks `fetch` in three of its six tests, two only check that zod rejects bad input or that a regex rejects `../outside.tgz` in npm's own output, and the sixth (`releasedPins`) checks real logic of the script that goes; it sits in `tests/cli/`, though it is not a CLI test.
- Fix: Delete the four files, the task, and the CI step in one commit in step 0 of the order of work, and delete `tests/cli/scripts/pins.test.ts` with its data. With `release.test.ts` (TCM-010) and `plugin.test.ts` (THR-004) gone too, no test of `scripts/` remains and none is planned, so `tests/cli/scripts/` and `tests/config/cli/scripts/` go. `validateEslintPresets` runs only in `scripts/build.ts`.
  `SWIFT_GRAMMAR_PIN` goes to `scripts/config/grammars.ts` (ROOT-021).
- Size: small

### SCR-008: `check:release` is one comparison

- Where: `scripts/release.ts`, `mise.toml:68-70`, `release.yml:22-32`
- Kind: delete
- Problem: The script has three checks. The plugin-pin check is not needed once the build writes the plugin version
  (SLF-023). The "no prerelease" checks repeat npm: npm 11 refuses to publish a prerelease version without `--tag`,
  and Node 24.20.0 ships npm 11. What is left is "the tag is `v` plus the CLI version". For that, a job installs
  packages, and a task and a script exist.
- Fix: Replace the two steps with `run: test "${TAG}" = "v$(jq -r .version packages/cli/package.json)"` (the job
  already uses `jq`). It runs in the one `publish` job (RTX-005), right after the checkout and the setup action, before
  the CI-run check, `mise run setup`, and `mise run build`. Delete `scripts/release.ts`, the task `check:release`, and
  `tests/cli/scripts/release.test.ts` (TCM-010).
- Size: small

### SCR-009: `deploy:docs` has one caller

- Where: `mise.toml:76-79`, `docs.yml:83-84`
- Kind: delete
- Problem: The task forwards to `bun run wrangler deploy` in `docs/`. Only the docs workflow runs it, and nobody
  deploys by hand.
- Fix: In `docs.yml`, the deploy job runs `bun install --frozen-lockfile --filter @gspothq/docs` after the setup action
  (which has no `setup` input, RTX-004), then `bun run wrangler deploy` with `working-directory: docs`. Delete the
  task.
- Size: small

### SCR-010: Build and test items that were to move into scripts the target does not have need their final files

- Where: `packages/eslint-plugin/build.ts` (build values), `packages/cli/src/config/generation/pins.ts`
  (`swiftGrammar`), `packages/cli/src/generation/eslint/public.ts` (`validateEslintPresets`),
  `packages/cli/src/types/platform/assets.ts` (`PinnedDownload`), `tests/harness/registry.ts`,
  `tests/types/harness/registry.ts`, `tests/harness/environment.ts:17` (`sourceLauncherDirectory`)
- Kind: move
- Problem: These items were to move into `scripts/build-eslint-plugin.ts`, `scripts/build-cli.ts`,
  `scripts/config/pins.ts`, `scripts/types/grammars.ts`, and `scripts/npm-registry.ts`. None of these files exists in
  the target, so the moves have no destination.
- Fix: The plugin build values go to `scripts/build.ts` as `pluginFolder`, `pluginDistribution`, and `declarations`;
  `SWIFT_GRAMMAR_PIN` goes to `scripts/config/grammars.ts`; `validateEslintPresets` goes to `scripts/build.ts`;
  `PinnedDownload` is deleted (SCR-006); the packing and registry code goes to `tests/setup/install.ts` (SCR-004);
  `sourceLauncherDirectory` is deleted (SCR-002).
- Size: small

### SCR-011: The `mise.toml` comments give the wrong reasons

- Where: `mise.toml:2,5,9,13`
- Kind: rewrite-text
- Problem: Line 5 says what `run_auto_install = false` does, not why. The reason is CI: the jobs install only Bun and
  Node, and without the setting every `mise run` would first install every other tool that `mise.toml` pins; from
  step 11 that is the published gspot (`npm:@gspothq/cli`). Lines 2 and 9 explain the launchers (SCR-001), and line 13
  says "test suites install the remaining pins" (the preload does, SCR-003).
- Fix: Keep the setting with one comment: "CI jobs install only Bun and Node; `mise run` must not install the
  published gspot." Delete the comment of line 13 with the conf.d file (step 6), and the comments of lines 2 and 9 with
  the launchers (step 11).
- Size: small

### RTX-001: Eight of the fifteen dependency overrides already meet their own removal rule

- Where: `package.json:28-44` (`overrides`); `AGENTS.md` "Dependency overrides" table; `bun.lock:213-245`
- Kind: delete
- Problem: `AGENTS.md` says to keep each override until its callers get a fixed version without it. Eight already do.
  `qs` has no caller at all: no package in `bun.lock` depends on it (it came with Verdaccio, which `c6aa35af7`
  removed). Seven more have callers whose `^` ranges already allow the fixed version, so Bun picks it without being
  forced, and `ip-address` is even held back (forced to 10.7.1, while a lock without overrides picks 10.7.3).
  `.gspot/bun.lock`, which has no overrides, picks `brace-expansion` 1.1.21 and 5.0.12, `fast-uri` 3.1.8, `ip-address`
  10.7.3, and `source-map-js` 1.2.2 on its own. The other seven overrides are needed, because a caller pins an exact
  old version or asks for an older major: `@xmldom/xmldom`, `handlebars`, `js-yaml@3`, `postcss-selector-parser`,
  `sharp`, `undici@7`, and `uuid@8`.
- Fix: Delete `qs`, `brace-expansion@1`, `brace-expansion@2`, `brace-expansion@5`, `fast-uri@3`, `ip-address`,
  `minimatch@9`, and `source-map-js` from `overrides`, and their eight rows from the `AGENTS.md` table. Run
  `bun install` once, with ROOT-001 (same file and lock). Check that `bun.lock` still picks each of these packages at
  or above the old forced version, then run `gspot check --only dependencies/osv`. Keep the other seven rows.
- Size: small

### RTX-002: `ci.yml` should be one test matrix and one docs job

- Where: `.github/workflows/ci.yml:1-179`
- Kind: simplify
- Problem: `ci.yml` runs 95 jobs per push. Once the check job goes (ROOT-009) and the integration tests run unsharded
  (TTC-001), the three test jobs differ only in the suite they run, yet each is written out by hand. The file also
  carries entries nothing uses: `on.workflow_dispatch` (the release needs a successful `push` run, so a manual run
  counts for nothing, and a failed job is re-run with the "Re-run" button), `defaults.run.shell: bash` (needed only for
  the quoted name patterns that go), `fetch-depth: 0` (THR-039), and `GITHUB_TOKEN` for every job, so every step, including third-party tool installs and test code, gets the token, although only the tests that run `mise install` of tools hosted on GitHub need it (without it they hit unauthenticated 403 answers). `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` cancels only pull request runs, but this repository pushes straight to main, often one commit per stage, so runs pile up. Its
  header ("split heavy tool files by their registered test names") is jargon.
- Fix: Write `ci.yml` as in "Target ci.yml", in step 9 of the order of work (RTX-003). It has 10 jobs: 9 test jobs
  named `unit (ubuntu-24.04)`, `integration (macos-26)`, and so on, plus `docs`. Each test job runs `mise run setup`,
  then the suite's task (`test`, `test:integration`, or `test:e2e`); each task depends on `build`, so every test job
  builds both packages first, and no job calls a script directly. `pull_request` stays: it costs one line and gives outside contributors CI. The read-only `GITHUB_TOKEN` is set only on the test step of each suite, and `cancel-in-progress: true` cancels the jobs of the previous push; the release still needs a green run on its own commit, which is the newest commit when you release. The docs install line assumes ROOT-056; until then it is
  `--filter '@gspothq/{cli,docs}'`. IGN-012 changes the form of the `uses: ./.github/actions/setup` lines. Verify with
  one run that the integration and end-to-end preload needs nothing from the action beyond Bun and Node.
- Size: medium

### RTX-003: Without shards, the 60-minute job limit will cancel the Windows integration job until the tests get faster

- Where: `.github/workflows/ci.yml:159` and the other `timeout-minutes: 60` lines of the hand-written workflows
- Kind: simplify
- Problem: Every job has the same 60-minute limit, which is right: one limit for one concern. But the shards exist
  because whole tool-test runs did not fit in it: three Windows jobs were canceled at 60 minutes, and one test file
  alone takes at least 2,393 seconds on four shards. Collapsing 29 tool jobs per system into one integration job
  before the tests get faster turns CI red by timeout, and the easy wrong fixes ("raise the limit", "bring shards
  back") are banned.
- Fix: Keep `timeout-minutes: 60` as the one job limit. Do the collapse of RTX-002 in step 9 of the order of work,
  after the fixes of the same step that remove the cause: one test file per configuration (TTC-001), one install per
  test file (TTC-002), deleting the cache tests (TTO-002), and the faster installer (LIF-001). Then run the integration
  job once per system. If it still does not fit, the next fix is in the tests, never in the limit or the job count.

    Until step 9 the shards stay, but the workflows change with the tasks they call in step 4 (with the new `tests/`
    layout, the Bun preload, and the 8 tasks), so CI never calls a deleted task or script:
    - `ci.yml`: the check job goes (ROOT-009). The `test` job runs `mise run test`, the package job
      `mise run test:e2e`, and each tool job `mise run test:integration -- <its shard or name arguments>`, with paths
      under `tests/integration/`. The setup action becomes RTX-004 in the same step, so each job adds `mise run setup`
      (the docs job its install line), and the tool jobs take over the two `if:` steps for the Linux and macOS packages
      (RTX-004).

    - `release.yml` becomes RTX-005, and `docs.yml` gets SCR-009 and the install lines of RTX-004.
    - Confirm with the first CI run of step 4 that each named group still runs only its own tests: the task already
      names `tests/integration`, and Bun adds a second path filter to it rather than narrowing it.

- Size: small

### RTX-004: The setup action becomes two fixed steps with no inputs

- Where: `.github/actions/setup/action.yml:1-42`; callers `docs.yml:50,77`, `release.yml:26,65-68`, `ci.yml:58`, `ci.yml:168-169`
- Kind: simplify
- Problem: The action has three inputs, and no caller needs any of them: every caller wants `bun node` (THR-039), the `setup` command input hides the job's commands, and `native-tests` serves one job. Callers pass commands as text (`setup: bun install --frozen-lockfile --filter ...`), and the action runs them with `bash --noprofile --norc -e -o pipefail -c "$SETUP_COMMAND"`, which hides the real commands from the workflow and needs an environment variable to stay safe. `native-tests` installs xmllint, zsh, and Bash 5 for the tool-test jobs only, and its name and description are jargon. The description ("Install pinned tools and dependencies and build the parsers and plugin") is wrong: "parsers" means the grammar files, and once the `setup` input goes, the action builds nothing. What must stay is the mise version and the Bun and uv caches, written once for every hand-written job.
- Fix: Write the action as:

    ```yaml
    name: Set up mise and caches
    description: Install mise, Bun, and Node, and restore the Bun and uv download caches.
    runs:
        using: composite
        steps:
            - uses: jdx/mise-action@2d8d4cafcbd33be2ea37d2b6f5ad595363d1f1ca # v5.1.1
              with:
                  version: '2026.10.7'
                  install_args: bun node
            - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
              with:
                  path: |
                      ~/.bun/install/cache
                      ~/.cache/uv
                      ~/AppData/Local/uv/cache
                  key: packages-${{ runner.os }}-${{ hashFiles('bun.lock', '.gspot/bun.lock', '.gspot/uv.lock') }}
                  restore-keys: packages-${{ runner.os }}-
    ```

    Keep the `version:` line: it is this repository's one place for its CI mise version (the generated workflows use
    `CI_PINS.mise`), and without it mise-action installs the newest mise on each run, so an upstream release could turn
    CI red. Keep mise-action's own cache: the generator's seven-path `actions/cache` list serves users' npm, pnpm, and
    Yarn caches, which this repository does not use. `bun` and `node` are the root `mise.toml` pins (`node` from step 6,
    SCR-001), so the action never installs an unpinned Node, and `run_auto_install = false` keeps later `mise run` calls
    from installing the other pins. Every caller writes its own install step after the action: the test jobs
    and the release job run `mise run setup`; the `ci.yml` docs job and the `docs.yml` build job run
    `bun install --frozen-lockfile --filter @gspothq/docs` and then `mise run build:docs` (until ROOT-056 lands, the
    filter is `'@gspothq/{cli,docs}'`); the `docs.yml` deploy job runs the same install line, then
    `bun run wrangler deploy` in `docs/` (SCR-009). The two steps of `native-tests` move into the integration jobs as `if:` steps: on Linux `sudo apt-get update && sudo apt-get install --yes libxml2-utils zsh`, on macOS `brew install bash`. In step 4 they go into the sharded tool jobs (RTX-003); from step 9 they are the two `if:` steps of "Target ci.yml". Land it in step 4 of the order of work, with the tasks: every caller changes then anyway.

- Size: small

### RTX-005: `release.yml` runs two jobs and two setups where one job does the work, and its publish loop guards what npm already refuses

- Where: `.github/workflows/release.yml:11-95`
- Kind: merge
- Problem: The `version` job checks out, sets up, and installs a filtered workspace only to run two checks; then
  `publish` checks out, sets up, and installs again with a different `--filter` list. Splitting them does not narrow
  the publish job's rights: `publish` runs `bun install` and the builds with `id-token: write` anyway. The publish loop
  (`:73-90`) reads npm's answer into a temporary file, checks the version a second time with `jq`, and stops unless
  npm's error is `E404`; but `npm publish` itself refuses a version that already exists, so a wrong "not published"
  answer can never overwrite anything. The `publish` job repeats part of `mise run setup` with filters (install, grammar copy, plugin build), then runs `build:cli` as a separate step. The first job is named `version`, but it checks the tag and the CI runs. The comment in the publish job tells someone to "publish ... manually with a short-lived granular token", while the step uses no token: it relies on npm trusted publishing (`id-token: write`, no `NODE_AUTH_TOKEN`).
- Fix: One job, `publish`, as in "Target release.yml"; the `docs` job stays. Its steps call only the target tasks (`mise run setup`, then `mise run build`), so both packages are built, the CLI with its grammar files and `gspot.schema.json` (SCR-005); no hand-written install, grammar, or plugin lines, and the extra install time on a rare job is accepted. Replace the two comment lines and the header with: "Start this workflow by hand on a version tag, such as v0.1.0. npm accepts the publish through trusted publishing (OIDC: GitHub proves to npm which workflow runs). Publish the first version by hand, then add this workflow as a trusted publisher on npmjs.com." The first release through this workflow comes after the first publish by hand (step 10 of the
  order of work); before step 10 `gspot.yml` is off, so the "Require both CI runs" loop could not pass. Verify with one
  release run.
- Size: small

### RTX-006: The CLI's `package.json` `imports` map repeats the TypeScript paths and ships a map into files npm never receives

- Where: `packages/cli/package.json:41-44`
- Kind: delete
- Problem: `"#cli/*": "./src/*"` and `"#cli-package": "./package.json"` repeat `tsconfig.json:23,27`. Every reader of
  the `#cli` names already uses the TypeScript paths: Bun running the source, `tsc`, ESLint's TypeScript import
  lookup, Vite in the docs (`docs/astro.config.ts:15`), and the tests (501 test files import `#cli/`, and
  `tests/package.json` has no `imports`). The published package does not contain `src/` (`"files": ["dist", "configurations", "grammars"]`), so for users the map points at nothing, and the bundle already holds every import.
  No source file imports a `#cli` name dynamically, and `n/no-missing-import` is off.
- Fix: Delete the `imports` block from `packages/cli/package.json`. Verify with
  `gspot check --only typescript/tsc javascript/eslint javascript/knip`, `mise run build`, and `mise run build:docs`.
- Size: small

### RTX-007: TypeScript settings restate defaults, and the root project lists folders it no longer needs

- Where: `tsconfig.json:6,17,33-34`; `docs/tsconfig.json:5-8`
- Kind: simplify
- Problem: Two root options are TypeScript's defaults: `forceConsistentCasingInFileNames` is on by default, and
  `module: "Preserve"` already means `moduleResolution: "bundler"`. The root `include` lists `packages/**/*.ts`, but
  each package has its own project, and the only package files that need the root project are the build scripts,
  which move to `scripts/`. With packages gone from `include`, the `exclude` list matches nothing: `packages/*/dist` is
  outside the include, and TypeScript's `**` never enters `node_modules`. `docs/tsconfig.json` repeats the root's
  `types: ["bun"]`, swaps the root's module pair for an equal one, and sets `jsx` though the docs have no JSX or TSX
  file.
- Fix: In `tsconfig.json`, delete `moduleResolution` and `forceConsistentCasingInFileNames`; once the build sits in
  `scripts/build.ts` (SCR-005), set `"include": ["scripts/**/*.ts", "tests/**/*.ts"]` and delete `exclude`. In
  `docs/tsconfig.json`, delete `types`, `module`, `moduleResolution`, and `jsx`, in the same change as DOC-032. Verify
  with `gspot check --only typescript/tsc` and `mise run build:docs`.
- Size: small

### RTX-008: Three lines in root-level files say nothing that any tool reads

- Where: `package.json:3` (`"license"`); `packages/eslint-plugin/package.json:44` (`"sideEffects": false`);
  `.gitignore:15` (`!.env.example`)
- Kind: delete
- Problem: The root package is private and never published. Its `license` is not required by the lint rule
  (`package-json/require-license` skips private packages) and is not read by the license check (it runs with
  `--excludePrivatePackages`); GitHub and both builds use `LICENSE.md`. `sideEffects` tells a bundler which files it may
  drop; nobody bundles an ESLint plugin, ESLint imports it. `!.env.example` re-includes a file that does not exist.
- Fix: Delete the three lines.
- Size: small

### RTX-009: The commit scope `hooks` appears in 2 of 1,441 commits with a scope

- Where: `gspot.toml` `[tools.commitlint] scopes`
- Kind: delete
- Problem: The allowed scopes are `cli`, `eslint-plugin`, `docs`, `root`, `hooks`, and `deps`. Hook code lives in the
  CLI and in its generated output, so `cli` already names it. A scope nobody uses is one more choice per commit: `root`
  has 728 commits, `cli` 645, and `hooks` 2, none since 2026-10-01.
- Fix: Remove `hooks` from `tools.commitlint.scopes`: `gspot unset tools.commitlint.scopes hooks`.
- Size: small

## Target mise tasks and scripts

One place for tasks (`[tasks]` in `mise.toml`), one place for scripts (`scripts/`), and no `package.json` scripts.
Every task is one line; longer code is TypeScript in `scripts/`.

### `mise.toml` (8 tasks)

This is `mise.toml` after step 11 of the order of work. `node` comes in at step 6, when the conf.d file that pins it
today goes (INX-001); `npm:@gspothq/cli` comes in at step 11, after the first publish (SCR-001). Until step 11 the file
also keeps `[settings] disable_tools` and `[env] _.path` for the launchers, so the hooks run the source CLI.

```toml
# CI jobs install only Bun and Node; `mise run` must not install the published gspot.
[settings.task]
run_auto_install = false

[tools]
bun = "1.4.2"
node = "24.20.0"
"npm:@gspothq/cli" = "0.1.0"

[tasks.setup]
description = "Install the locked packages and write the docs site types."
run = ["bun install --frozen-lockfile", "bun --cwd {{config_root}}/docs --bun astro sync"]

[tasks.build]
description = "Build both npm packages: the CLI with its grammar files, and the ESLint plugin."
run = "bun scripts/build.ts"

[tasks.test]
description = "Run the unit tests."
depends = ["build"]
run = "bun test tests/unit"

[tasks."test:integration"]
description = "Run gspot with the pinned tools installed, on sample repositories."
depends = ["build"]
run = "bun test --preload ./tests/setup/preload.ts --preload ./tests/setup/integration.ts tests/integration"

[tasks."test:e2e"]
description = "Install both packed npm packages in a new project and test them there."
depends = ["build"]
run = "bun test --preload ./tests/setup/preload.ts --preload ./tests/setup/integration.ts tests/e2e"

[tasks."update:rule-lists"]
description = "Copy the rule lists of the pinned linter packages into packages/cli/configurations. Run after changing a linter version."
run = "bun scripts/update-rule-lists.ts"

[tasks."build:docs"]
description = "Build the docs site."
dir = "{{config_root}}/docs"
run = "bun --bun astro build"

[tasks."serve:docs"]
description = "Serve the docs site on your computer."
dir = "{{config_root}}/docs"
run = "bun --bun astro dev"
```

`bun --cwd` takes an absolute path, so the `setup` task uses the template `{{config_root}}`.

### Script files (3 scripts, 3 config files, 2 type files)

| File                           | Job                                                                                                                                                                                                                                                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/build.ts`             | Builds both npm packages: writes `packages/cli/grammars/`, checks the manifests and rule lists, bundles `packages/cli/dist/`, writes `packages/cli/gspot.schema.json` (before the first publish), bundles `packages/eslint-plugin/dist/` with declarations, and copies `LICENSE.md` into both. Task `build` (SCR-005). |
| `scripts/manifests.ts`         | The build-time checks of the shipped configuration manifests (LIF-007). Imported by `scripts/build.ts`; no task and no tests.                                                                                                                                                                                          |
| `scripts/update-rule-lists.ts` | Rewrites the shipped ESLint, `globals`, and Stylelint rule lists from the packages installed in `tests/`, and writes the manifest pins into `tests/package.json` (THR-008). Task `update:rule-lists` (PLG-007).                                                                                                        |
| `scripts/config/build.ts`      | Static values of the two package builds: `CLI_ENTRY_POINTS`, `CLI_BANNER`, `CLI_EXECUTABLE`, `DIST_FOLDER`, `LICENSE_FILE`, and the plugin build values.                                                                                                                                                               |
| `scripts/config/grammars.ts`   | The 7 grammar packages (`GRAMMAR_PACKAGES`), the Swift grammar file name and pin (`SWIFT_GRAMMAR_FILE`, `SWIFT_GRAMMAR_PIN`), the license file names, and the hash name. It holds the Swift pin itself: a `config/` file imports only `config/` of its own package.                                                    |
| `scripts/config/rule-lists.ts` | Package and file names the rule-list update uses.                                                                                                                                                                                                                                                                      |
| `scripts/types/manifests.ts`   | `CheckContradiction` (today the CLI's `CheckRule`), the type of the manifest checks.                                                                                                                                                                                                                                   |
| `scripts/types/rule-lists.ts`  | `StylelintModule`, the type the rule-list update reads.                                                                                                                                                                                                                                                                |

No `scripts/parsers/`, no launchers, and no one-line files. The two `scripts/types/` files are hand-written types that
import only `scripts/config/` and `scripts/types/`.

### Test setup that replaces the runner

- `tests/setup/integration.ts`: the preload of `test:integration` and `test:e2e` (SCR-003).
- `tests/config/integration.ts`: its exit codes (`INTERRUPTED_EXIT`, `TERMINATED_EXIT`), the pinned-tools file name,
  and the mise command arguments.
- The packing and the local npm registry stay in `tests/setup/install.ts` (SCR-004).

### Callers

- `.gspot/hooks/*` run `mise exec -- gspot ...`. Until step 11 that finds the launcher on `[env] _.path` and runs the
  source CLI; from step 11 it runs the npm release pinned in the root `mise.toml` (SCR-001).
- `.github/workflows/gspot.yml` is off from step 0 to step 10 (this repository's `[ci]` table goes until the first
  publish). From step 10 it is the generated job of INS-003: one job that runs
  `mise exec node@24 npm:@gspothq/cli@0.1.0 -- gspot install` and `... gspot check`, with no `doctor` step.
- `ci.yml`: from step 4 every step calls a task that exists, and the shard jobs stay until step 9 (RTX-003). From
  step 9 it is "Target ci.yml".
- `release.yml` is "Target release.yml".
- `docs.yml`: the build job runs `bun install --frozen-lockfile --filter @gspothq/docs`, then `mise run build:docs`;
  the deploy job runs the same install line, then `bun run wrangler deploy` in `docs/` (SCR-009, RTX-004). Until
  ROOT-056 lands, the build job's filter is `'@gspothq/{cli,docs}'`.
- `database.yml` is deleted (ROOT-027).
- The root `package.json` has no `scripts` and no `imports` block, and `tsconfig.json` has no scripts alias
  (ROOT-018).

### Deleted

`scripts/gspot` and `scripts/gspot.cmd` (step 11), `scripts/plugin.ts`, `scripts/pins.ts`, `scripts/release.ts`,
`scripts/setting-values.ts`, `scripts/workspace.ts`, `scripts/eslint-presets.ts` (renamed to
`scripts/update-rule-lists.ts`), `scripts/config/arguments.ts`, `scripts/config/pins.ts`, `scripts/config/plugin.ts`,
`scripts/parsers/`, today's `scripts/types/` files, the empty `scripts/release/` (INS-010), `packages/cli/scripts/`,
`packages/eslint-plugin/build.ts`, and the empty `packages/eslint-plugin/scripts/` (INS-047). Tasks: `install:checks`
(GEN-002), `pin:eslint-presets` (renamed to `update:rule-lists`), `check:pins`, `build:cli`, `build:plugin`,
`test:tools` and `test:package` (renamed to `test:integration` and `test:e2e`), `generate:docs`, `check:release`,
`test:database`, and `deploy:docs`. Settings: `disable_tools` and `[env] _.path` (step 11). The scripts alias
`#automation/*`.

## Target ci.yml

From step 9 of the order of work (RTX-002, RTX-003):

```yaml
name: ci
# Run the unit, integration, and end-to-end tests on Linux, macOS, and Windows, and build the docs site.
on:
    push:
        branches: [main]
    pull_request:
permissions:
    contents: read
concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true
jobs:
    test:
        name: ${{ matrix.suite }} (${{ matrix.os }})
        strategy:
            fail-fast: false
            matrix:
                os: [ubuntu-24.04, macos-26, windows-2025]
                suite: [unit, integration, e2e]
        runs-on: ${{ matrix.os }}
        timeout-minutes: 60
        steps:
            - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
              with:
                  persist-credentials: false
            - uses: ./.github/actions/setup
            - if: matrix.suite == 'integration' && runner.os == 'Linux'
              run: sudo apt-get update && sudo apt-get install --yes libxml2-utils zsh
            - if: matrix.suite == 'integration' && runner.os == 'macOS'
              run: brew install bash
            - run: mise run setup
            - run: mise run ${{ matrix.suite == 'unit' && 'test' || format('test:{0}', matrix.suite) }}
              env:
                  GITHUB_TOKEN: ${{ github.token }}
    docs:
        runs-on: ubuntu-24.04
        timeout-minutes: 60
        steps:
            - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
              with:
                  persist-credentials: false
            - uses: ./.github/actions/setup
            - run: bun install --frozen-lockfile --filter @gspothq/docs
            - run: mise run build:docs
```

## Target release.yml

One job, `publish`, and the `docs` job, which stays as it is (RTX-005, SCR-008).

- Header comment: "Start this workflow by hand on a version tag, such as v0.1.0. npm accepts the publish through
  trusted publishing (OIDC: GitHub proves to npm which workflow runs). Publish the first version by hand, then add this
  workflow as a trusted publisher on npmjs.com."
- No `defaults.run.shell: bash`: Linux jobs already use Bash.
- `publish` has `permissions: { actions: read, contents: write, id-token: write }` and these steps:
    1. checkout;
    2. `./.github/actions/setup`;
    3. `run: test "${TAG}" = "v$(jq -r .version packages/cli/package.json)"`;
    4. the existing "Require both CI runs" loop;
    5. `mise run setup`;
    6. `mise run build` (both packages: the CLI with its grammar files and `gspot.schema.json`, and the plugin);
    7. publish:

        ```bash
        for package in packages/eslint-plugin packages/cli; do
            spec=$(jq -r '.name + "@" + .version' "${package}/package.json")
            if npm view "${spec}" version > /dev/null 2>&1; then
                echo "${spec} is already on npm."
            else
                npm publish "./${package}"
            fi
        done
        ```

    8. `gh release create`.

## Target root

Every root file and folder that remains, with its one job:

| Path                               | Job                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.editorconfig`                    | Editor indentation and line endings, written by gspot. It keeps `[Makefile] indent_style = tab`: `[*]` sets spaces, and Make needs tabs.                                                                                                                                                                                                                          |
| `.gitattributes`                   | LF line endings in every checkout; marks `.gspot/` as generated.                                                                                                                                                                                                                                                                                                  |
| `.github/actions/setup/action.yml` | Installs mise, Bun, and Node, and restores the Bun and uv caches (RTX-004).                                                                                                                                                                                                                                                                                       |
| `.github/workflows/ci.yml`         | Unit, integration, and end-to-end tests on three systems, and the docs build: 10 jobs.                                                                                                                                                                                                                                                                            |
| `.github/workflows/gspot.yml`      | Runs `gspot check` on this repository with the published CLI; written by gspot, on from step 10.                                                                                                                                                                                                                                                                  |
| `.github/workflows/docs.yml`       | Builds the docs site, then deploys it to Cloudflare. Two jobs: `build` runs Astro and its plugins with no secret; `deploy` runs only Wrangler with the Cloudflare secrets, so a bad build package cannot plant code beside the token. A run started by hand checks that its tag is a published stable release; the build artifact is kept for one day (ROOT-044). |
| `.github/workflows/release.yml`    | One `publish` job checks the tag and CI, builds and publishes both packages to npm, and makes the GitHub release; the `docs` job deploys the docs.                                                                                                                                                                                                                |
| `.gitignore`                       | Keeps installs, builds (including `/packages/cli/gspot.schema.json`), local secrets (`.env`, `.env.*`), and editor files out of Git.                                                                                                                                                                                                                              |
| `.gspot/`                          | gspot's committed output: tool settings, rules, hooks, the three tool projects (`package.json`, `pyproject.toml`, `mise.toml`), and their lockfiles.                                                                                                                                                                                                              |
| `.markdownlint-cli2.mjs`           | Points markdownlint at gspot's settings.                                                                                                                                                                                                                                                                                                                          |
| `.prettierignore`                  | Files Prettier skips, written by gspot.                                                                                                                                                                                                                                                                                                                           |
| `.semgrepignore`                   | Files Semgrep skips, written by gspot.                                                                                                                                                                                                                                                                                                                            |
| `AGENTS.md`                        | gspot's managed block and the repository rules that no check enforces.                                                                                                                                                                                                                                                                                            |
| `LICENSE.md`                       | The Apache-2.0 license; both builds copy it into `dist/`.                                                                                                                                                                                                                                                                                                         |
| `README.md`                        | GitHub's front page.                                                                                                                                                                                                                                                                                                                                              |
| `bun.lock`                         | Exact installed versions for the five workspaces.                                                                                                                                                                                                                                                                                                                 |
| `bunfig.toml`                      | Bun install safety (release age, exact versions, the Socket scanner) and the test preload `./tests/setup/preload.ts`.                                                                                                                                                                                                                                             |
| `docs/`                            | The docs site (Astro), its package, TypeScript settings, and Cloudflare settings.                                                                                                                                                                                                                                                                                 |
| `eslint.config.mjs`                | Points ESLint at gspot's settings.                                                                                                                                                                                                                                                                                                                                |
| `gspot.toml`                       | This repository's gspot settings.                                                                                                                                                                                                                                                                                                                                 |
| `mise.toml`                        | The Bun, Node, and gspot pins, and the 8 repository tasks.                                                                                                                                                                                                                                                                                                        |
| `package.json`                     | The workspace list, root dev packages, and the seven needed overrides.                                                                                                                                                                                                                                                                                            |
| `packages/cli/`                    | The CLI package: source, shipped configurations, `package.json`, `tsconfig.json`, and a hand-written `README.md`.                                                                                                                                                                                                                                                 |
| `packages/eslint-plugin/`          | The ESLint plugin package: source, `package.json`, `tsconfig.json`, and `README.md`.                                                                                                                                                                                                                                                                              |
| `prettier.config.mjs`              | Points Prettier at gspot's settings.                                                                                                                                                                                                                                                                                                                              |
| `scripts/`                         | The build, its manifest checks, and the rule-list update: 3 scripts, with `config/` and `types/`.                                                                                                                                                                                                                                                                 |
| `tests/`                           | The test suites and their `package.json`.                                                                                                                                                                                                                                                                                                                         |
| `tsconfig.json`                    | TypeScript settings and import names for `scripts/` and `tests/`.                                                                                                                                                                                                                                                                                                 |

Leaves: `.prettierrc.json` (ROOT-013); `.github/workflows/database.yml` (ROOT-027); the `patchedDependencies` lines
(ROOT-001); `tests/pyrightconfig.json` and `tests/ruff.toml` (THR-001), with the local `.ruff_cache/`; `.mise/` with
`gspot-tools.toml` (INX-001, step 6); `scripts/gspot` and `scripts/gspot.cmd` (SCR-001, step 11); the empty local
`docs/.wrangler/`; and `findings/` when the work is done, with its glossary moving into `AGENTS.md`.
