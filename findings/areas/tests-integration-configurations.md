# Integration tests of the configurations

These tests install the real pinned tools (ESLint, Ruff, Vale, ShellCheck, gitleaks, Semgrep, SwiftLint, Docker
images, and others), build a small sample repository (a sandbox), run `gspot init`, `gspot install` and `gspot check`
there, and check that the real tool reports the expected finding and passes after the fix. Today they live in
`tests/tools/configurations/` (68 test files, one 313-line table runner, 70 data files, 9 type files) and CI splits
them into 87 jobs. The target is one file per configuration, `tests/integration/<group>/<name>.test.ts`, with one
sandbox and one real `gspot install` per file, test data in `tests/config/<topic>.ts`, and one integration job per
operating system with no shards. In Where lines, short paths are under `tests/tools/configurations/`, and `config/...`
means `tests/config/tools/configurations/...`.

## Layout

Target test files (each one replaces the files and cases its placement rows name):

```text
tests/integration/
  check.test.ts                 a check whose tool is not installed (from language/bash/lifecycle.test.ts)
  database/postgres
  framework/astro, nestjs, nextjs, react, site, svelte, vue
  general/commits/{messages,replace}, dependencies, docs, duplication, files, format, gspot, licenses,
          prose/{packages,scopes,styles,vale}, secrets/{env-examples,gitleaks,trufflehog},
          security/{codeql,semgrep,sensitive-data}, spelling, structure
  infrastructure/ansible, docker, github-actions, nginx, openapi, xcode
  language/bash/{shellcheck,size,syntax}, css, javascript/{eslint,jsconfig,projects}, markdown,
           python/{imports,ruff} and one file for the type and docstring checks,
           sql, swift/build and one file for SwiftLint and SwiftFormat,
           typescript/{projects,repository-checks,scopes}
  library/drizzle, trpc, zustand
  platform/cloudflare, supabase
  testing/jest, pytest, swift-tests, vitest
```

Test data goes to topic files: `tests/config/{ansible,astro,cloudflare,commitlint,dependencies,docker,docs,files,
formatting,github-actions,javascript,jest,libraries,licenses,markdown,nestjs,nextjs,nginx,openapi,planning,postgres,
prose,pytest,react,ruff,secrets,security,sensitive-data,site,spelling,sql,structure,stylelint,supabase,svelte,
swift-tests,swift,tsconfig,typescript,vitest,vue,xcode}.ts`, `tests/config/bash/tools.ts` and
`tests/config/python/checks.ts`. Types that two or more files use go to `tests/types/secrets.ts` and
`tests/types/tool-output.ts`. The folders `tests/config/tools/` and `tests/types/tools/` go.

## Findings

### TTC-001: One test file runs 24 sandboxes, and CI splits it with hand-written name patterns

- Where: `cases.test.ts` (313 lines), `config/.../cases.ts:27-74` (`SCENARIOS`), `tests/types/tools/cases.ts`,
  `.github/workflows/ci.yml:96-180`
- Kind: merge
- Problem: All 63 "reports, then passes after the fix" cases of 24 configurations sit in one file. One file is too
  slow for one CI job, so `ci.yml` cuts it apart with 11 regular expressions over describe names (plus 2 for
  `tests/tools/lifecycle/shared-tools.test.ts`), and the 16 file shards leave out the same names with one
  570-character negative regular expression. The scenario names live in three places, so a renamed scenario
  silently runs twice or never. The suite takes 87 CI jobs per push (95 jobs in all).
- Fix: Give each configuration one test file, `tests/integration/<group>/<name>.test.ts`, that holds its cases and its
  other tests on one sandbox (TTC-002). Write each case as a plain `test(...)` or a small `test.each` over its own
  rows. The rows go to the configuration's topic file in `tests/config/` (for example `SQL_CASES` in
  `tests/config/sql.ts`; the Bash size locations become `BASH_SIZE_LOCATIONS` in `tests/config/bash/tools.ts`). Each
  case skips by its check's tool pin (SUP-008). Delete `cases.test.ts`, `SCENARIOS`, `tests/types/tools/cases.ts`,
  the 13 named groups and the exclusion pattern. CI then runs one integration job per operating system, with no
  file shards and no name patterns. If a job is too slow, fix the cause (LIF-001, TTC-002); never add shards. Make
  the CI change after the test-speed fixes (TTC-002, TTO-002, LIF-001).
- Size: large

### TTC-002: Eight sandboxes are installed twice

- Where: `framework/nestjs.test.ts:64`, `framework/svelte.test.ts:13`, `general/files.test.ts:11`,
  `general/markdown-docs-prose.test.ts:10`, `general/secrets/environment.test.ts:10`, `general/site.test.ts:31`,
  `language/swift/checks.test.ts:12`, `language/typescript/checks.test.ts:26-37`; also `test/pytest.test.ts:18-36`
  (rebuilds the pytest sample by hand) and `language/javascript/checks.test.ts:14` (its own sample for one case)
- Kind: merge
- Problem: Each of these files runs `gspot init` and installs tools for the same sample repository that
  `cases.test.ts` already installs. The install is the slowest step of the suite, so it is paid twice, and in CI the
  two copies run in different jobs. The TypeScript `prepare` callback is copied almost word for word
  (`cases.test.ts:185-198` and `typescript/checks.test.ts:29-35`), and so is the NestJS dependency list
  (`cases.test.ts:129-136` and `nestjs.test.ts:66-75`).
- Fix: With TTC-001, each configuration file owns exactly one sandbox: its `beforeAll` runs `gspot init` and one real
  `gspot install` (TTO-003), and the file's cases and other tests run on it. The sandbox is the topic file's
  `<TOPIC>_SANDBOX` (for example `NESTJS_SANDBOX`, or `TYPESCRIPT_SANDBOX` with its `jsconfig.json` file and prepare
  step). Fold the JavaScript `no-debugger` test and the pytest tests into the same pattern.
- Size: medium

### TTC-004: Case data that lies: the real broken file is patched in later by the runner

- Where: `cases.test.ts:255-274`; data `config/.../framework/nestjs.ts:33` (`files: {}`),
  `config/.../language/swift/checks.ts:15` (`files: {}`), `config/.../language/typescript/checks.ts:110` (the clean
  `DOUBLE_JS` as both the broken and the fixed file), `config/.../test/pytest.ts:20,23` (the clean
  `ARITHMETIC_TESTS` as both), `config/.../test/vitest.ts:36` (the fix is overwritten at run time)
- Kind: simplify
- Problem: A reader of the data sees a "broken" case whose file is empty or already correct. The real sample is made
  by five `if (declared.repository === X) entry.files[...] = Y.replace(...)` branches in the runner, because the
  `structure/config-logic` check forbids calls such as `.replace()` in files under `tests/config/**`.
- Fix: Write each broken sample and its fixed version in the case row in `tests/config/<topic>.ts` (for example the
  NestJS case writes its own broken controller, and the SQL case its own fixed file). Delete the five branches and
  the `structuredClone` at `cases.test.ts:255`. Do with TTC-001.
- Size: small

### TTC-005: A 120-line callback map keyed by object identity holds each scenario's setup far from its data

- Where: `cases.test.ts:42-136` (Bash size sample generator, `defaultLimit`, `nestedConditions`, `vitestPackage`,
  `nestDependencies`), `cases.test.ts:137-246` (`CALLBACKS`), `cases.test.ts:276`, `tests/types/tools/cases.ts:14`
- Kind: simplify
- Problem: The Vue, Svelte, Vitest and NestJS versions, the OpenAPI writer script, the SQL ignore, the TypeScript
  `prepare` step, the Python, SQL, Swift, Bash and Markdown fixes, and 80 lines of generated Bash size samples all
  live in one map in the runner, looked up by `===` on imported objects. The reflect-metadata version is read
  through product code (`installedPackage(undefined, testModules, ...)`, `cases.test.ts:133`, `nestjs.test.ts:69`)
  although `tests/package.json` lists it.
- Fix: With TTC-001, each setup step moves into its configuration's test file, and its static parts into the topic
  file: the OpenAPI writer script joins the files of `OPENAPI_SANDBOX`, the SQL ignore becomes an `[[ignore]]` record
  in the gspot.toml text of `SQL_SANDBOX`, the Bash size samples go to `tests/config/bash/tools.ts`, and
  `defaultLimit` moves to `tests/integration/language/bash/size.test.ts`. Sandboxes in `tests/config/` carry no
  versions: each test adds them from `#tests/package.json` where it uses them (ST5-015). Delete `CALLBACKS` and
  `ConfigurationCallbacks`.
- Size: medium

### TTC-006: The Ruff lint rule test pins rule counts and SHA-256 hashes

- Where: `language/python/ruff/settings.test.ts:150-192`; `config/.../language/python/ruff.ts:80-97`
  (`RULE_SELECTIONS`, `DOCSTRING_CONVENTIONS`, `ENABLED_RULES`, `RULE_CODES`)
- Kind: delete
- Problem: The test asserts that Ruff enables exactly 519, 540, 726 and 757 lint rules and compares a hash of the
  rule list. When it fails, nobody can tell which rule changed, and every Ruff upgrade breaks it. It is a snapshot
  of counts.
- Fix: Delete the test and the four constants.
- Size: small

### TTC-007: Tests and assertions that repeat other tests

- Where and what they repeat:
    - `language/bash/syntax.test.ts:206` (a nested unknown setting) and `:220` (a loosening without a reason) repeat
      `tests/cli/policy/read/recovery.test.ts:47` and `tests/cli/commands/check/policy-errors.test.ts:63`;
      `syntax.test.ts:175` (placeholder reasons are refused) repeats `tests/cli/commands/set/exceptions.test.ts:72` and
      `tests/cli/commands/set/reasons.test.ts:9`.

    - `framework/nextjs.test.ts:166-183` re-runs the single `nextjs/tsc` TS2322 case, which the delegation test and the
      reference test (`:186`) already cover.

    - `general/commits/hooks.test.ts:184` (the message-file check) repeats the eleven message-file checks of `:56`.
    - `platform/cloudflare.test.ts:62` (Wrangler schema in root and child scopes, two runs) repeats `:95` in the same
      file.

    - The assertion `infra/ansible.test.ts:89-103` (the exact ansible-lint arguments through a spy) repeats
      `tests/cli/execution/command/placeholders.test.ts:39`.

    - `language/bash/lifecycle.test.ts:63` (an ignore with no paths stops a check and its fixer) and `:94` (an ignored
      folder covers its subfolders) are not copies, but they test gspot's ignore logic with `bash -c` commands.
      Commit `8f4909236` moved them out of `tests/cli/commands/ignore/command.test.ts` only because they run Bash.

    - `language/markdown.test.ts:171` (Bash code fences) is not a copy either: no unit test checks a Bash fence. It was
      moved out of the unit suite because the fence check runs `bash -n`.

- Kind: delete
- Problem: The same behavior is tested twice, once in the slow suite.
- Fix: Delete `syntax.test.ts:175`, `:206` and `:220`, `nextjs.test.ts:166-183` with its helper `skippedReplacement`,
  `hooks.test.ts:184`, `cloudflare.test.ts:62`, and the ansible-lint spy assertion. Move the two ignore tests to
  `tests/unit/cli/commands/ignore.test.ts`, with the Node `QUALITY_COMMAND` the unit file already uses instead of
  `bash -c`. Move the Bash fence test to `tests/unit/cli/checks/language/markdown.test.ts` (TTO-005).
- Size: small

### TTC-008: Tests that need no real linter sit in the slow suite

- Where: `language/bash/syntax.test.ts:62,79,126,156` (only the system `bash -n` and code in the test process),
  `language/javascript/compiler-ownership.test.ts:75,120` (call `inspectTool` in the test process on a copied
  TypeScript folder), `general/secrets/pushed.test.ts` (the malformed and crashed rows, where a fake `trufflehog`
  script prints tokens), `general/secrets/gitleaks-output.test.ts:212` (ignore expiry dates)
- Kind: move
- Problem: These tests check gspot's own logic (gspot.toml reading, ignores, tool inspection, redaction, expiry) and
  need no pinned tool, so they pay for the slow suite and skip where it skips.
- Fix:
    - Move `syntax.test.ts:62` (findings in folders with colon names) and `:156` (a command check at the root) to
      `tests/unit/cli/execution/command/check.test.ts`. Drop the newline folder name and keep the colon name with its
      Windows filter. The unit suite allows `git`, `bash` and `sh` and skips when `bash` is not on `PATH` (TTO-005).

    - Delete `syntax.test.ts:79` (switching levels; other kept tests cover level selection) and `:126` (every case sets
      and removes a `gspot.toml` key that the target format deletes).

    - Move `compiler-ownership.test.ts:75` to `tests/unit/cli/tools/find/programs.test.ts` ("inspectTool finds the
      project compiler"), without its pending-install part. Delete `:120`: it tests the "installing" state, which goes
      when packages install straight into `.gspot/`.

    - Delete the malformed and crashed rows of `pushed.test.ts` (weak: they run a fake TruffleHog). The real TruffleHog
      row stays as a plain test.

    - Delete `gitleaks-output.test.ts:212`: `tests/cli/policy/settings/view.test.ts:113` covers ignore expiry, and
      `gspot ignore --until` stays.

- Size: medium

### TTC-010: 18 Windows skips come from a test shortcut, not from the tool

- Where: `language/javascript/compiler-ownership.test.ts:21,75,120`, `language/javascript/jsconfig.test.ts:21` (10
  runs), `language/typescript/standalone.test.ts:28,197`
- Kind: simplify
- Problem: These tests copy TypeScript into `.gspot/node_modules` and make `.bin/tsc` a POSIX symbolic link to a
  JavaScript file. Windows needs a `.cmd` launcher there, so the tests skip on Windows with `isPosix`. TypeScript
  runs on Windows, and other tests in the same files that link TypeScript into `node_modules` run there
  (`standalone.test.ts:92,133`, `typescript/checks.test.ts`, `typescript/copy.test.ts`). The tests also assert the
  literal path `.bin/tsc`, which differs on Windows.
- Fix: Link TypeScript and its launcher with the one helper `installCompiler` in `tests/setup/install.ts` (TTC-011),
  compare launcher paths with `Bun.which('tsc', { PATH })` instead of the literal `.bin/tsc`, and delete the
  `isPosix` skips. If the Windows runner then shows a product failure, fix the product.
- Size: small

### TTC-011: The "copy TypeScript and link tsc" block is written out 11 times

- Where: `language/javascript/compiler-ownership.test.ts:30-35,85-96,124-129`, `jsconfig.test.ts:30-35`,
  `language/typescript/standalone.test.ts:37-42,102-104,147-149,207-212`, `typescript/checks.test.ts:87-91,180-181`,
  `typescript/copy.test.ts:27-29`
- Kind: merge
- Problem: The same 3 to 6 lines appear in 11 places, in two variants (copy into `.gspot/node_modules`, or link into
  `node_modules`).
- Fix: Move `linkCompiler` (`typescript/checks.test.ts:87-91`, which already links TypeScript and `.bin/tsc` from the
  root `node_modules`) to `tests/setup/install.ts` as `installCompiler`, and use it in every place.
- Size: small

### TTC-014: Many tests run the raw tool with a command or a tool file the test typed, not the one gspot runs

- Where: `infra/docker/generation.test.ts:70-81,111-125` (own `hadolint` and 13-argument `trivy` commands),
  `language/python/ruff/rules.test.ts:58,93`, `ruff/settings.test.ts:36`, `language/sql.test.ts` (all 8 runs),
  `general/spelling.test.ts` (all 10 runs), `general/prose/styles.test.ts:98,115,164` and `vocabulary.test.ts:27`
  (hand-written `.vale.ini` files)
- Kind: fix-bug
- Problem: These tests prove that the shipped tool files work with the tool, but with flags and settings the test
  chose. If gspot runs the tool another way, they still pass. The Trivy test copies gspot's argument list by hand
  and runs `--format json` with no ignore file, while gspot runs `trivy config ... --ignorefile {tool_file:trivyignore} ... --format template` (`packages/cli/configurations/infra/docker/manifest.toml:105`); the
  Vale style tests write `[formats] sh = py` themselves instead of using the generated `.gspot/config/vale.ini`.
- Fix: Run `gspot check --only <check> --json` with the generated tool files in these tests. Delete the raw Trivy test
  (`docker/generation.test.ts:96-140`): the kept Trivy scope test already runs `docker/trivy-config` through gspot.
  Keep a raw tool run only where the point is "an editor finds the tool file by itself" (`css.test.ts:80`,
  `markdown.test.ts:62`, `ruff/settings.test.ts:49`, `test/swift-tests.test.ts:188`) and in
  `general/structure.test.ts`, which compares gspot's parser with the tool on purpose. The Squawk test is ST5-001.
- Size: medium

### TTC-016: A comment and an empty argument left over from a removed time limit

- Where: `framework/nextjs.test.ts:33-43`
- Kind: delete
- Problem: The comment says "The Next.js type check ... is slow on Windows", and the call passes `{}` as options.
  Commit `ca2975ca5` removed `{ timeoutMs: NATIVE_TEST_TIMEOUT_MS }`; the comment and the `{}` stayed.
- Fix: Delete the comment and the `{}` argument.
- Size: small

### TTC-018: The prose scope tests copy one setup and install Vale packages by hand

- Where: `general/prose/headings.test.ts:19-49`, `general/prose/rules.test.ts:20-52`
- Kind: merge
- Problem: The two `beforeAll` blocks are the same except two lines. Each one installs the Vale packages in the test
  process with `installValePackages` and a hand-built owner object around `installTree`, instead of running
  `gspot install`.
- Fix: Merge `headings.test.ts`, `rules.test.ts` and `ignores.test.ts` into
  `tests/integration/general/prose/scopes.test.ts` with one setup that writes gspot.toml and runs
  `installToolProjects` (one real `gspot install`, TTO-003). The per-scope heading table goes (ST5-005).
- Size: small

### TTC-019: The Next.js sandbox is created outside the repository

- Where: `framework/nextjs.test.ts:148-151`
- Kind: fix-bug
- Problem: `testdir({}, { dirname: join(installedModules, '../..', 'gspot-test-<uuid>') })` creates the folder next to
  the repository, in the user's own work folder, because webpack needs the sandbox on the same drive as
  `node_modules`. A killed run leaves `gspot-test-*` folders there.
- Fix: Create the sandbox in a Git-ignored folder inside the repository and outside `node_modules` (`.sandboxes/`,
  added to `.gitignore`): Next.js does not compile sources whose path contains `node_modules`. Run the Next.js tests
  on the Windows CI once to confirm.
- Size: small

### TTC-021: Two replace test files install a whole sandbox only to get a PATH, and repeat one case shape 11 times

- Where: `general/commits/takeover.test.ts:19-50`, `config/.../general/commits/takeover.ts:4-20`;
  `general/dependencies/syncpack.test.ts:13-57`, `config/.../general/dependencies/syncpack.ts:4-22`
- Kind: simplify
- Problem: `COMMITLINT_REPOSITORY = { configurations: ['none'], dependencies: {}, files: {} }` and the Syncpack
  sandbox run `gspot init` and a tool install only so the tests can read `.environment.PATH` to find `commitlint` and
  `syncpack`. The 6 commitlint and 5 Syncpack cases have only 2 different file bodies each.
- Fix: Take commitlint and Syncpack from the pinned tools on the integration `PATH` (`sandboxPath()`), not from an
  installed sandbox; first check that the `.ts`, `.cts` and `.mts` configs still work with that commitlint. Build the
  rows from the file names (`.cts` and `.cjs` get the CommonJS body): `COMMITLINT_FILES` in
  `tests/config/commitlint.ts` and `SYNCPACK_FILES` in `tests/config/dependencies.ts`. Delete
  `COMMITLINT_REPOSITORY` and the Syncpack sandbox. The tests become
  `tests/integration/general/commits/replace.test.ts` and part of `tests/integration/general/dependencies.test.ts`.
- Size: small

### TTC-022: Base64 Zip archive as test data

- Where: `config/.../general/prose/packages.ts:3` (one 2 KB line), used by `general/prose/packages.test.ts:88`
- Kind: rewrite-text
- Problem: Nobody can read or change the 8 files inside without decoding it.
- Fix: Write the eight files as a plain record, `VALE_PACKAGE_FILES` in `tests/config/prose.ts`, and let the test
  build the Zip in its scratch folder. No binary file is committed.
- Size: small

### TTC-023: A fake assertion and a stale comment in the GitHub Actions test

- Where: `infra/github-actions.test.ts:20`, `:37-38`
- Kind: delete
- Problem: Line 38 checks that `createFileTree` wrote the bytes it was given; that tests the test setup, not gspot.
  Line 20 describes cases that live in `cases.test.ts`, not in this file.
- Fix: Delete line 38 and the comment.
- Size: small

### TTC-024: Literal bloat: long variants spelled out in full

- Where: `config/.../language/python/ruff.ts:5-51` (40 identical `value += 1` lines),
  `config/.../infra/openapi.ts:45-46` (the whole `DOCUMENT` copied minus one line),
  `config/.../language/python/checks.ts:24-49` (three near copies of `CLEAN_MODULE`) and `:73-79` (`setup.cfg` and
  `.importlinter` with the same text), `config/.../test/pytest.ts:27-32` and `config/.../test/vitest.ts:40-45` (the
  same `PROVIDER_FLOORS`), `config/.../platform/cloudflare.ts:18-34`
- Kind: simplify
- Problem: Each variant is spelled out in full, so a reader has to compare long strings by eye to find the one change.
- Fix: Derive or write each variant once in its topic file: the 40 lines with `Array.from` in `tests/config/ruff.ts`,
  the broken OpenAPI document from `OPENAPI_DOCUMENT` in `tests/config/openapi.ts`, the Python module variants from
  one module in `tests/config/python/checks.ts`. `PROVIDER_FLOORS` becomes the one-line `test.each([80, 0])` in each
  of the two tests.
- Size: small

### TTC-025: The Xcode tool project is built by 12 chained `.replace()` calls

- Where: `language/swift/build.test.ts:52-65`
- Kind: rewrite-text
- Problem: The test turns the unit-test-bundle project in `tests/config/samples/swift/xcode.ts` into a command-line
  tool project with 12 string replacements. Nobody can see the resulting project without running it.
- Fix: Write the tool project as its own literal, `XCODE_TOOL_PROJECT` in `tests/config/xcode.ts`, beside
  `XCODE_TOOL_SCHEME` and `XCODE_BUILD_SETTINGS`.
- Size: small

### TTC-026: Files named after a tool, a made-up word, or the wrong configuration

- Where and the final name:
    - `general/secrets/semgrep.test.ts` (tests `security/semgrep`) → `general/security/sensitive-data.test.ts`;
      `general/codeql.test.ts` → `general/security/codeql.test.ts`; `general/security.test.ts` →
      `general/security/semgrep.test.ts`.

    - `general/lychee.test.ts` (tests the `docs` configuration) → `general/docs.test.ts`.
    - `general/yaml.test.ts` (tests `files/yamllint`) → merged into `general/files.test.ts`.
    - `database.test.ts` (top level; tests the postgres Squawk settings) → `database/postgres.test.ts`, with the
      postgres cases.

    - `infra/docker/generation.test.ts` (tests the Trivy and Hadolint scopes, not generation) and
      `infra/docker/image.test.ts` → one `infrastructure/docker.test.ts`; `infra/` becomes `infrastructure/` and `test/`
      becomes `testing/` (the configuration group names).

    - `general/secrets/gitleaks-output.test.ts` and `secrets/files.test.ts` → `general/secrets/gitleaks.test.ts`;
      `secrets/pushed.test.ts` → `secrets/trufflehog.test.ts`; `secrets/environment.test.ts` →
      `secrets/env-examples.test.ts`.

    - `language/bash/lifecycle.test.ts` → its missing-tool test goes to `tests/integration/check.test.ts`, its two
      ignore tests to the unit suite (TTC-007); `bash/loops.test.ts` → merged into `bash/size.test.ts`;
      `bash/bats.test.ts` → merged into `bash/syntax.test.ts`.

    - `language/javascript/compiler-ownership.test.ts` → the rest after TTC-008 merges into
      `javascript/jsconfig.test.ts`; `javascript/checks.test.ts` → `javascript/eslint.test.ts`.

    - `language/typescript/standalone.test.ts` → `typescript/scopes.test.ts`; `typescript/copy.test.ts` → merged into
      `typescript/projects.test.ts`; `typescript/checks.test.ts` → split into `typescript/repository-checks.test.ts` and
      `typescript/projects.test.ts`.

    - `language/python/ruff/{rules,settings}.test.ts` → one `python/ruff.test.ts`; `python/checks.test.ts` → split into
      `python/imports.test.ts` and one file for the type and docstring checks.

    - `language/swift/{checks,docs,scopes}.test.ts` → one file for SwiftLint and SwiftFormat.
    - `general/commits/hooks.test.ts` → `general/commits/messages.test.ts`; `commits/takeover.test.ts` →
      `commits/replace.test.ts`; `general/dependencies/{lockfiles,syncpack}.test.ts` → `general/dependencies.test.ts`.

    - `general/site.test.ts` → `framework/site.test.ts`; `general/markdown-docs-prose.test.ts` → its Vale dictionary
      test joins `general/prose/packages.test.ts`, and its cases go to their configuration files.

    - The data file `config/.../general/prose/emission.ts` matches no test; its Vale samples join `tests/config/prose.ts`.

- Kind: rename
- Problem: A newcomer cannot guess where a configuration's tests are. The product folders are named by configuration
  (`packages/cli/configurations/<group>/<name>`); the tests mix configuration names, tool names, and words such as
  lifecycle, emission, generation, ownership, standalone, copy and output.
- Fix: One test file per configuration, named after it, under `tests/integration/<group>/`; a configuration over 300
  test lines splits into a folder by behavior (the names above). Do not use "and" in a file name: the two files that
  join several Python or Swift tests need names without it.
- Size: medium

### TTC-031: Stale, false, or jargon comments

- Where and fix:
    - `config/.../general/commits/hooks.ts:19` "shared by the four installed commit scenarios" (true, but jargon): "Setup
      commands for the four commit-hook tests."

    - `test/pytest.test.ts:1` "Sandbox for the pytest configuration: coverage under the floor.": "The pytest
      configuration: clean tests pass, and a coverage limit without pytest-cov reports a missing tool."

    - `config/.../general/commits/takeover.ts:6` and `config/.../general/dependencies/syncpack.ts:6` "filenames that
      were absent from the takeover declarations" (history): delete.

    - `config/.../general/dependencies/syncpack.ts:3` "Native installation is separate from the authored pre-init
      configuration under test.": "Installs Syncpack for the tests."

    - `general/markdown-docs-prose.test.ts:1` "Public CLI journeys for document findings and tool failure recovery." and
      `language/javascript/checks.test.ts:1` "Source CLI journey": say what the file tests.

    - `config/.../framework/nestjs.ts:5` "Declared Swagger use selects its lint contracts without importing the SDK in
      this source.": "A Swagger dependency turns on the Swagger lint rules."

    - `config/.../general/spelling.ts:1` "... exclusion. both emitted ...": a capital letter and a plain sentence.

- Kind: rewrite-text
- Problem: Comments describe history, use house jargon, or say something false about the file.
- Fix: As listed. Comments that move with their data keep the new text in the topic file.
- Size: small

### TTC-033: Shared sandboxes whose tests depend on order

- Where: `general/format.test.ts:113-145` (overwrites the `gspot.toml` written for the first test),
  `general/site.test.ts:52-57` (overwrites the sandbox's `gspot.toml` and `build.js` and never restores them),
  `general/prose/headings.test.ts` and `rules.test.ts` (rewrite one folder between tests)
- Kind: fix-bug
- Problem: A test passes or fails depending on which test ran before it in the same file. Bun runs them in order
  today, so it works by luck. In each file only the first test needs the untouched setup, so the risk is small but
  real.
- Fix: In `format.test.ts`, leave the first test's `gspot.toml` as it is. In `site.test.ts`, restore `gspot.toml` and
  `build.js` after each test. In the merged prose scope file, give each test the state it needs (or its own small
  folder when the setup is cheap).
- Size: small

### TTC-034: Tests written as callbacks inside a data array

- Where: `test/swift-tests.test.ts:82-169` (`configurationCases`, four `{ name, check: async (...) => {...} }`
  entries run for two scopes)
- Kind: rewrite-text
- Problem: Four tests hide inside an array of objects; the reader must follow two loops to see what runs.
- Fix: Write four `test.each(XCTEST_SCOPES)` blocks, one per behavior, and delete `configurationCases`.
- Size: small

### TTC-035: Defensive code and repeated lines in tests

- Where and fix:
    - `cases.test.ts:51` `if (typeof value !== 'number') throw new TypeError(...)` for a shipped manifest default:
      delete it, and read the value with `Number(...)` in `defaultLimit`.

    - `general/gspot.test.ts:26` `{ ...GENERATED_DRIFT_OPTIONS, checks: BUILT_IN_CHECKS }`: `buildRunOptions` already
      sets `checks`; inline the one remaining use.

    - `general/format.test.ts:51,72` re-asserts `applied.code`, which `beforeAll` already threw on: delete.
    - `general/commits/hooks.test.ts:104` adds `NO_COLOR: '1'`, which `spawnGspot` already sets: keep it, because the
      same object goes to `git commit`, whose hook runs gspot, and `git` does not set it.

    - `general/secrets/files.test.ts:21` `const options: RunOptions = buildRunOptions()`: drop the type and the
      variable.

    - `test/vitest.test.ts:46,56` and `typescript/copy.test.ts:37,44` `if (x === undefined) throw new Error(...)`: use
      `!` or `expect(...).toBeDefined()`.

    - `general/licenses.test.ts:31` and `platform/cloudflare.test.ts:32` "declares no package" throws: they go with the
      hand-made installs (ST5-003).

- Kind: simplify
- Problem: Guards for states that cannot happen and lines that repeat a default make the tests longer and harder to
  read.
- Fix: As listed.
- Size: small

### TTC-036: The SQL sample excludes one file twice

- Where: `config/.../language/sql.ts:18` (`db/.sqlfluffignore` listing `report.sql`) and `cases.test.ts:170-178`
  (`gspot ignore sql/sqlfluff --paths db/report.sql`)
- Kind: simplify
- Problem: `gspot init` replaces `.sqlfluffignore` files
  (`packages/cli/configurations/language/sql/manifest.toml:20`), so the file in the sample is probably removed and
  only the `gspot ignore` matters. Nothing asserts either.
- Fix: Delete the `db/.sqlfluffignore` file from the sample, and write the ignore as an `[[ignore]]` record in the
  gspot.toml text of `SQL_SANDBOX` (TTC-005).
- Size: small

### TTC-038: Blank lines left behind by a removed field

- Where: 18 sample objects, for example `config/.../database.ts:21`, `general/files.ts:6`, `infra/docker.ts:13`,
  `language/sql.ts:13`, `language/typescript/checks.ts:24`
- Kind: delete
- Problem: A blank line follows `configurations: [...]` in each; it marks where `modules: false` was deleted.
- Fix: Delete the blank lines when the sandboxes move to their topic files.
- Size: small

### TTC-040: One name with two meanings, and two names for one sample

- Where: `SWIFT_PACKAGE` is a 5.9 library manifest in `config/.../language/swift/package.ts:4` and a 6.0 manifest in
  `tests/config/samples/swift/source.ts:24`; `PYPROJECT` differs between `tests/config/samples/python.ts:7` and
  `config/.../language/python/checks.ts:6`, and `python/checks.test.ts:119,120,159` rebuilds the sample one with
  `PYPROJECT.split('[tool.pydoclint]', 1)[0]`; `CLEAN_MODULE` is JavaScript in
  `config/.../language/javascript/checks.ts:3` and Python in `tests/config/samples/python.ts:2`; `CLEAN`, `COUNT`,
  `PACKAGE`, `FILES`, `TABLES`, `COMMAND` name unrelated things in 2 to 4 files
- Kind: rename
- Problem: A reader cannot tell from an import which sample they get.
- Fix: Use one shared sample where the content is the same (`PYPROJECT` in `tests/config/python/checks.ts`, plus a
  `PYDOCLINT_GOOGLE` table). Give the others a specific name: `JAVASCRIPT_MODULE` in `tests/config/javascript.ts`,
  `SVG_CHECK_COMMAND` in `tests/integration/framework/site.test.ts`; inline the one-use `SWIFT_PACKAGE` into
  `SWIFT_PACKAGE_SANDBOX`. Topic files use topic prefixes (ST5-014).
- Size: small

### ST5-001: The Squawk test keeps a raw-command helper that has no caller once it runs through gspot

- Where: `database.test.ts:16-22` (`squawk`), `:38-47`
- Kind: delete
- Problem: `squawk()` only builds `['squawk', '--reporter', 'json', '--config', config, path]` with a hand-picked
  config path. Once the test runs `gspot check --only postgres/squawk` (TTC-014), gspot picks each file's scope and its
  generated `squawk.toml`, so no caller is left. The test also asserts the three emitted `squawk.toml` values through
  `emitAll`, which the per-scope check results prove again.
- Fix: Delete `squawk` and the `emitAll` assertion. Check the root and `transactional/child` migrations through gspot.
  Move the gspot.toml text and the migration sample to `tests/config/postgres.ts` (`SQUAWK_SCOPE_SETTINGS`,
  `UNWRAPPED_MIGRATION`). The file becomes `tests/integration/database/postgres.test.ts`.
- Size: small

### ST5-003: The license and Cloudflare tests install a package by hand and copy it in with `installTree`

- Where: `general/licenses.test.ts:25-37,67-70,150-153`; `platform/cloudflare.test.ts:23-41`
- Kind: simplify
- Problem: The license `beforeAll` runs its own `npm install license-checker-rseidelsohn@5.0.1`, and two tests copy
  that tree into each sandbox with gspot's internal `installTree`. The Cloudflare setup does the same with
  `npm install ajv@8.20.0`. Both versions are already pinned for the tools, and each run downloads them again from
  the network.
- Fix: Delete `resources`, `installation` and the `beforeAll` in `licenses.test.ts`; tests 1 and 3 call
  `installToolProjects`, as the Python license test already does. The Cloudflare sandbox runs `gspot install` too.
  Move the hand-written `node_modules` package records to `tests/config/licenses.ts` (`LICENSED_PACKAGES`). One real
  run must confirm that `gspot install` in these sandboxes brings the scanner and Ajv.
- Size: small

### ST5-005: The banned-heading scope table repeats the child-only test

- Where: `general/prose/headings.test.ts:51-100`; `config/.../general/prose/headings.ts:1-6` (`HEADING_SCOPES`)
- Kind: delete
- Problem: The table ran one test for four scopes and two levels, to prove that each scope used its own heading list
  (`[scope.child.docs] banned_headings`) and that `vale-scoped.ini` matched `vale.ini`. `docs.banned_headings` is a
  root-only setting and the per-scope Vale config goes, so all four scopes run one `vale.ini` and expect the same
  findings. The kept child-only test already asserts the shipped banned heading at level `all`, none at
  `recommended`, and the link-text rule.
- Fix: Delete the two `test.each` tests and their tables, `checkHeadings`, `HEADING_SCOPES` and its data file.
- Size: small

### ST5-006: The "cloned Vale package" test repeats the "edited package" test

- Where: `general/prose/packages.test.ts:35-48,65-72`
- Kind: delete
- Problem: The cloned case plants different bytes as an owned install with `installTree`, then expects install to
  restore the published bytes. With packages installed straight into `.gspot/`, `installTree` goes, and the only way
  left to plant the bytes is to write them into `.gspot/vale`, which is what the edited-package case does. Both end
  with `readFile(INSTALLED)` equal to the published bytes.
- Fix: Split the `test.each` into two tests (the pruned package and the edited package) and delete the cloned case
  and `expectPublishedRules`.
- Size: small

### ST5-014: Names that only worked inside a one-file data module

- Where: about 90 data rows of these tests: `REPOSITORY`, `CASES`, `CLEAN`, `FILES`, `TABLES`, `SAMPLE`, `TEST`,
  `PAIR`, `COMMAND`
- Kind: rename
- Problem: In a per-test data file these names were clear from the file name. In a topic file such as
  `tests/config/bash/tools.ts` several of them meet (two sandboxes and three tables), and the import line no longer
  says what they hold.
- Fix: Use topic prefixes and plain names: `<TOPIC>_SANDBOX`, `<TOPIC>_CASES`, `ASTRO_PAGE`, `ANSIBLE_PLAYBOOK`,
  `CLEAN_NGINX_CONFIG`, `PAIR_SIZE_SOURCE`, `UNTESTED_SOURCE`, `LOCAL_NPM_PROJECT`. gspot.toml text is `*_SETTINGS`,
  not `*_TABLES` or `*_POLICY`. The shared case runner is `runCheckSample` in `tests/setup/`.
- Size: small

### ST5-016: Three tests carry their own copy of "every coverage limit at 0, with reasons"

- Where: `test/jest.test.ts:127-128`, `test/pytest.test.ts:67`, `test/vitest.test.ts:76`
- Kind: merge
- Problem: The Jest, pytest and Vitest tests each write a `[coverage]` table with every limit at 0 and four
  `[reasons]` entries with their own reason text, to prove that a zero limit runs without the coverage package. One
  value has three spellings.
- Fix: One `COVERAGE_ZERO_LIMITS` in `tests/config/planning.ts`, beside the coverage limit rows, written in the reason
  form (`lines = { value = 0, reason = "..." }`); the rows with a limit of 80 set `lines = 80` where they are used.
- Size: small
