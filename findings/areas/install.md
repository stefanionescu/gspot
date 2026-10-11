# Installing and running gspot

This part covers how a person gets gspot onto a machine, how gspot starts in a repository (by hand, from Git hooks,
and from CI), what `gspot install` puts where, the file gspot writes for mise, and what is left of the old per-OS
binary build. Target: two install paths, a package manager dev dependency or mise, each written once in the docs.
Hooks start gspot from where the repository pins it, with no `runner` setting. gspot pins its program tools
(standalone programs such as gitleaks, typos, or vale) in `.gspot/mise.toml` and installs them with mise, and generated
CI has one job shape, through mise.

## Findings

### INS-001: The generated mise file demands the newest mise, which breaks every older mise

- Where: `packages/cli/src/generation/mise.ts:34`; `packages/cli/src/config/generation/pins.ts:7`;
  `packages/cli/src/lifecycle/install/public.ts:122-128`; `.github/actions/setup/action.yml:19`;
  `.mise/conf.d/gspot-tools.toml:3`; `tests/tools/lifecycle/mise-execution.test.ts`;
  `docs/src/content/docs/guides/requirements.md:19`; `scripts/plugin.ts:42`
- Kind: fix-bug
- Problem: One number means two things: "the mise version CI installs" and "the oldest mise allowed to read the
  generated file". `miseFile` writes `min_version = "<CLI_PINS.mise.version>"`, and `check:pins` forced that number to
  the newest mise release, so each gspot release locks out every mise a few days old. An older mise then refuses the
  whole folder: hooks fail, so no commit works, and `gspot install` refuses too, with its own `mise --version` check.
  On a machine with mise 2026.9.12, mise refuses: "mise version 2026.10.7 is required, but you are using
  2026.9.12". The docs say 2026.8.8.
- Fix: Step 0 of the order of work, in one commit with GEN-030, so that mise's own error output reaches the user:
  `miseFile` stops writing `min_version`, and `gspot install` drops its `mise --version` check. Then run `gspot apply`
  (in this repository, with the source CLI) to rewrite the generated mise file. `check:pins` goes in the same step
  (SCR-007). No second mise number is kept by hand: the mise version stays only as the version CI installs,
  `CI_PINS.mise` (today `CLI_PINS.mise.version`) for the generated workflows, and the hand-written setup action keeps
  its own `version:` line as this repository's one place for it (RTX-004). Delete
  `tests/tools/lifecycle/mise-execution.test.ts` whole. The integration preload writes its temporary mise file with
  `miseFile` (ROOT-028), so it has no `min_version` either. `.gspot/mise.toml` (INX-001) has none, and no docs page
  names gspot's mise file, so the 2026.8.8 sentence goes with `requirements.md` (INX-009).
- Size: small

### INS-003: Generated CI has two job shapes, and the one without mise fails at `gspot doctor`

- Where: `packages/cli/src/generation/documents/public.ts:60-106,212-213,259-283,334-336`;
  `packages/cli/src/config/generation/pins.ts:7-8,25-29`; `packages/cli/src/types/generation/ci.ts:13`;
  `packages/cli/src/generation/public.ts:54`; `packages/cli/src/commands/init/plan.ts:158-160`;
  `docs/src/content/docs/guides/ci.md:34-61`; `docs/src/content/docs/guides/runners.md:6`;
  `tests/cli/generation/ci.test.ts:39-54`; `.github/workflows/gspot.yml`
- Kind: simplify
- Problem: `buildJob` branches on `pipeline.isMise`. The mise shape depends on the user's mise config pinning gspot.
  The other shape installs Node and a global gspot with npm, ignores the dev dependency, then runs `gspot install` and
  `gspot doctor`. The always-selected configurations need program tools at level `recommended` (gitleaks, trufflehog,
  dotenv-linter, osv-scanner, lychee, typos), and `gspot install` never installs those without mise, so `doctor` exits
  1 and the job stops on a stock CI machine, unless the setup command or the CI image supplies every tool. The tests
  run the non-mise job only with fake `npm` and `gspot` programs. `runners.md` says the runner decides how CI starts
  gspot; CI only knows "mise" or "not mise".
- Fix: One job shape for every repository, through mise. CI is turned on with `ci.enabled` (TML-015), and `set` writes the workflow, with no init question. Every generated workflow has one job, `check` (ROOT-048), with these steps:
    1. checkout;
    2. a cache keyed on the hash of `gspot.toml`, `.gspot/version`, `.gspot/package.json`, `.gspot/*lock*`,
       `.gspot/pyproject.toml`, and `.gspot/mise.toml`;
    3. mise-action at `CI_PINS.mise`;
    4. the `ci.setup_command`, when it is set;
    5. `mise exec node@24 npm:@gspothq/cli@<version> -- gspot install`;
    6. the same start, then `gspot check --changed --base <ref>`;
    7. on pushes to the default branch only, a last step that runs `mise install <manual-stage tools>` in `.gspot/` and
       then the same start with `gspot check --only <manual checks>` (INX-006).

    No `gspot doctor` step, in the generated job or in your own CI: `gspot check` already fails (exit 2) and names each
    missing program, so `doctor` tells CI nothing new; it stays a command for people. When the npm tool project uses
    Bun, pnpm, or Yarn, add `<name>@<version>` to the tool list. gspot writes the version literal, and `gspot apply`
    rewrites it on upgrade. GitLab runs the same lines and needs mise on its image (INS-035). Delete the setup-node step,
    `ciNpmInstall`, `CLI_PINS.node`, `CLI_PINS.actions.node`, `Pipeline.isMise`, the `doctor` step, the second job,
    GitLab's `mise trust .mise/conf.d/...` and `mise install` lines, and the two non-mise tests in
    `tests/cli/generation/ci.test.ts`. The CI page's "Your own pipeline" section says: install mise, then run your start
    command with `install` and `check`. This repository's `gspot.yml` is off from step 0 to step 10 (its `[ci]` table
    goes until the first publish, GEN-002); step 10 turns it back on (`ci.enabled = true`), so it checks with the
    published CLI.

- Size: medium

### INS-006: The "install the pinned version" commands drop the exact flag

- Where: `packages/cli/src/config/lifecycle/version-pin.ts:2-8`; `tests/config/cli/lifecycle/version-pin.ts`
- Kind: fix-bug
- Problem: When `.gspot/version` differs from the running gspot, the error tells the user to run
  `npm install --save-dev @gspothq/cli@X`. npm saves that as `^X` unless `--save-exact` is given, so `npm update` or a
  fresh lockfile can move to a newer gspot, and the same error comes back. Every docs page uses the exact flags.
- Fix: The `pin` field of `RUNNERS` (INS-014), which replaces `PIN_INSTALL_COMMANDS`, holds the exact forms:
  `npm install --save-dev --save-exact`, `pnpm add --save-dev --save-exact`, `yarn add --dev --exact`,
  `bun add --dev --exact`, and for mise `mise use npm:@gspothq/cli@<version>` (INX-002).
- Size: small

### INS-008: The build copies two runtime `.wasm` files that nothing needs, one of them a dead 1.7 MB file

- Where: `packages/cli/src/config/platform/assets.ts:13-16` (`RUNTIME_WASM`); `packages/cli/scripts/grammars.ts:57`;
  `packages/cli/scripts/build.ts:15`; `packages/cli/src/parsers/source/public.ts:37`;
  `packages/cli/src/platform/root/public.ts:159` (`wasmPath`); `tests/cli/platform/assets.test.ts:53`;
  `tests/config/cli/platform/assets.ts:6-7`
- Kind: delete
- Problem: The build copies `libpg-query/wasm/libpg-query.wasm` (1,717,700 bytes) and `web-tree-sitter.wasm` into
  `grammars/` and refuses to build without them. Nothing reads the `libpg-query` copy: `libpg-query` is a normal
  runtime dependency and reads its own `.wasm` from its own folder. `web-tree-sitter` is a runtime dependency that the
  build keeps outside the bundle, and its JavaScript reads `web-tree-sitter.wasm` next to itself
  (`new URL("web-tree-sitter.wasm", import.meta.url)`); gspot passes the copied bytes in anyway. Both copies are
  leftovers of the deleted single-file per-OS build, which embedded the parser (`58f1fda07`). The docs site does not
  use the parser.
- Fix: Call `Parser.init()` with no arguments. Delete `RUNTIME_WASM` and its uses: the copy and the two license copies
  in the grammar step of `scripts/build.ts` (SCR-006), its lookup in `wasmPath` (which moves to `system/assets.ts` and
  then serves only the grammar files), and the runtime-file parts of the asset test and its data (INS-021).
- Size: small

### INS-009: Text still calls the CLI a "binary" and the manifests "embedded"

- Where: `packages/cli/src/lifecycle/public.ts:291,311`; `tests/cli/lifecycle/version-pin.test.ts:38`;
  `packages/cli/src/configurations/public.ts:52,173`
- Kind: rewrite-text
- Problem: gspot ships only as JavaScript on npm. "This repository pins gspot X and this binary is Y", "the running
  binary", and "Every embedded manifest" describe the banned per-OS build. The manifests are read from the
  `configurations/` folder on disk.
- Fix: The version-pin error says "This repository pins gspot X, and you are running gspot Y."; its doc comment says
  "Throws when the repository pins a different gspot version." and "the running gspot version". Both comments in
  `configurations/public.ts` say "configuration manifest". The test expects the new error text.
- Size: small

### INS-010: An empty `scripts/release/` folder is left from the standalone archive scripts

- Where: `scripts/release/` (on disk, not tracked)
- Kind: delete
- Problem: Commit `c6aa35af7` deleted `scripts/release/artifacts.ts` and moved `scripts/release/version.ts` to
  `scripts/release.ts`. The empty folder stayed.
- Fix: `rmdir scripts/release`. The command of INS-047 removes it too.
- Size: small

### INS-012: "Node 24.2 or Bun 1.4.2" is not true: the checks always need Node

- Where: `docs/src/content/docs/guides/requirements.md:6`; `docs/src/content/docs/guides/runners.md:10`;
  `packages/cli/package.json:37-40`; `packages/cli/configurations/general/gspot/manifest.toml:7-14`;
  `tests/packages/launcher.test.ts:148`
- Kind: rewrite-text
- Problem: The docs say Bun 1.4.2 alone can run gspot. But the always-selected `gspot` configuration declares Node as a
  tool, so `gspot doctor` reports a missing tool when no `node` is on `PATH`, and the npm tools run from
  `.gspot/node_modules/.bin` with a `node` shebang. The only Bun test runs `export`, which needs no tool. Not run here:
  under `bun run` or `bunx`, Bun may put its own `node` alias on `PATH`.
- Fix: The Install page, which takes over `requirements.md` (`runners.md` is deleted, INX-003, INX-009), says: "gspot
  needs Node.js 24.2 or newer. Bun can install and start it, but the checks still need Node." Node is a system tool
  with the floor 24.2.0 (INX-002). Keep `engines` as it is, `bun` included: Bun still starts the CLI.
- Size: small

### INS-014: Two tables and two loose strings say how to get gspot

- Where: `packages/cli/src/config/generation/hooks.ts:11-18` (`HOOK_RUNNERS.*.install`);
  `packages/cli/src/config/lifecycle/version-pin.ts`; `packages/cli/src/lifecycle/public.ts:306-307`;
  `packages/cli/src/generation/documents/public.ts:334-336`
- Kind: merge
- Problem: One concept, "how to start or install gspot in this repository", lives in four places with different
  wording: `HOOK_RUNNERS` (the start command, and the hook message when the program is missing), `PIN_INSTALL_COMMANDS`,
  `ciNpmInstall`, and an inline `'npm install --global'`. The global install line is written twice.
- Fix: One table, `RUNNERS`, in `config/generation/hooks.ts` beside `HOOK_ARGS`, with five rows keyed by
  `RUNNER_NAMES = [...NPM_CLIENTS, 'mise'] as const` (INX-003) and three fields: `command` (the start command),
  `missing` (the hook message when that program is absent), and `pin` (the command that installs an exact gspot
  version, INS-006). Example:
  `npm: { command: 'npm exec --no -- gspot', missing: 'Install Node.js and npm, then run: npm install.', pin: 'npm install --save-dev --save-exact' }`;
  the mise row's `pin` is `mise use npm:@gspothq/cli@<version>` (INX-002). No `none` row and no global install
  (INX-005); `ciNpmInstall` goes (INS-003). Delete `config/lifecycle/version-pin.ts`. As a `config/` value, the table
  is `as const` and imports no type.
- Size: small

### INS-015: `HOOK_RUNNERS` and its neighbors have misleading names

- Where: `packages/cli/src/config/generation/hooks.ts:11`; `packages/cli/src/types/generation/hooks.ts:6`;
  `packages/cli/src/config/generation/pins.ts:31`; `packages/cli/src/types/generation/files.ts:24`;
  `packages/cli/src/generation/documents/public.ts:66,213,260`; `packages/cli/src/commands/init/contracts.ts:272`
- Kind: rename
- Problem: `HOOK_RUNNERS` is used by CI generation and the init question too, not only by hooks, and the CI generator
  writes `HOOK_RUNNERS[pipeline.isMise ? 'mise' : 'gspot'].command` three times. "runner" also names GitHub machine
  images (`CLI_PINS.runners`) and the mise file's generated-file kind (`kind: 'runner'`).
- Fix: `HOOK_RUNNERS` becomes `RUNNERS`, the start-command table of the hooks (INS-014); the generated CI no longer
  reads it (INS-003). Delete `HookRunner`: a `config/` file may not import a type. `CI_PINS` (EXG-006 splits it out of `CLI_PINS`) has its `runners` field renamed `githubRunners` (GitHub's own word). The kind `'runner'`
  goes: `.gspot/mise.toml` takes the kind of `.gspot/package.json` (INX-001).
- Size: small

### INS-019: `@pgsql/types` is shipped as a runtime dependency but only imported as types

- Where: `packages/cli/package.json:52`
- Kind: move
- Problem: All six imports are `import type`, so runtime code never reads the package. `libpg-query` already depends
  on it (`"@pgsql/types": "^18.0.0"`).
- Fix: Move `@pgsql/types` to `devDependencies`.
- Size: small

### INS-021: `wasmPath` refuses names that no caller can pass

- Where: `packages/cli/src/platform/root/public.ts:158-160`; `tests/cli/platform/assets.test.ts:15-66`;
  `tests/config/cli/platform/assets.ts:8-10`
- Kind: delete
- Problem: A guard throws "No WebAssembly file named X ships with gspot" when the name is not in the tables. Both
  callers (`parsers/source/public.ts:37,39`) pass fixed names. A test case and its test data exist only for this guard.
  The same test also checks every `.wasm` file in `packages/cli/grammars/`, a folder the build writes and Git does not
  track, so it checks that the developer built the package, and it copies that folder into a temporary folder.
- Fix: Delete the guard in `wasmPath` (which moves to `system/assets.ts`), the `undeclared.wasm` test data, and the
  `undeclared` assertion. In the assets test, also drop the `grammars` part of the expected JSON and its copy step;
  keep the real checks: a package folder with `%`, spaces, and Unicode in its path, and `listAssets` with dot files.
- Size: small

### INS-029: The Node version is written in five places

- Where: `packages/cli/src/config/generation/pins.ts:8`; `packages/cli/configurations/general/gspot/manifest.toml:9-10`;
  `packages/cli/package.json:39`; `package.json:12-14`; `docs/src/content/docs/guides/requirements.md:6`;
  `.mise/conf.d/gspot-tools.toml:11`
- Kind: merge
- Problem: The non-mise CI installs "24" (any 24.x), while the mise file pins 24.20.0, and the floor 24.2.0 sits in two
  manifests and the docs.
- Fix: Delete `CLI_PINS.node` with the non-mise CI (INS-003). The gspot manifest keeps only the floor
  `min_version = "24.2.0"`, with Node as a system tool (INX-002). Keep `engines.node` in the package files: detection
  reads `engines` for each scope. The exact version 24.20.0 is written once, in this repository's root `mise.toml`
  (from step 6, SCR-001), and the docs state the floor once, on the Install page (INS-012).
- Size: small

### INS-035: The GitLab job assumes mise is already on the CI image

- Where: `packages/cli/src/generation/documents/public.ts:259-283`; `docs/src/content/docs/guides/ci.md:36`
- Kind: rewrite-text
- Problem: The generated GitLab job sets no image and does not install mise, then calls mise. The docs do not say that
  mise must be on the image.
- Fix: Add to the CI page: "The GitLab job needs mise on its image." The job runs the same lines as the GitHub job
  (INS-003).
- Size: small

### INS-045: The package name is typed by hand in four places

- Where: `packages/cli/src/lifecycle/public.ts:307`; `packages/cli/src/generation/documents/public.ts:335`;
  `packages/cli/src/config/configurations.ts:40`; `packages/cli/src/platform/root/public.ts:59`
- Kind: merge
- Problem: `@gspothq/cli` is spelled out instead of read from `package.json`, so a rename would miss one.
- Fix: Three copies go with their code: `GSPOT_MISE_TOOL` (INX-002), the global line in `assertVersionPin` (INX-005),
  and `ciNpmInstall` (INS-003). The rest read the name from `#cli-package` at the use site, because a `config/` file
  imports only `config/`: `packageFolder` in `system/assets.ts` (today `platform/root/public.ts:59`), the code that
  prints the `RUNNERS` pin texts, and the install line of the generated CI (INS-003).
- Size: small

### INS-047: 62 empty folders sit on disk

- Where: `packages/cli/` (27 folders, for example the twelve source folders `packages/cli/src/{checks/general/gspot,checks/language/javascript,checks/language/python/imports,configurations/selection,execution/snapshot,parsers/configured,parsers/schema/configurations,config/checks/database,config/checks/general/dependencies,types/checks/database,types/checks/library,types/checks/tool}`, `packages/cli/configurations/tool/pytest`, and `packages/cli/configurations/general/site/rules/`), `tests/cli/checks/language/javascript/`, `tests/cli/checks/tool/xctest/`, `tests/config/cli/checks/language/swift/`, `tests/config/cli/checks/tool/xctest/`, `tests/types/cli/checks/{general,library,tool}/`, and the others in `tests/types/` (12), `tests/cli/`
  (9), `tests/config/` (8), `tests/tools/` (2), `docs/public/brand/` (2), `packages/eslint-plugin/scripts/`,
  `scripts/release/` (INS-010)
- Kind: delete
- Problem: Moves and deletions left empty folders behind. Git does not track empty folders, so they exist only on this
  machine, but anyone who opens the tree sees folders such as `packages/cli/configurations/tool/jest` and thinks a configuration lives there, sees a `checks/language/javascript/` folder with no JavaScript check, a `python/imports/` folder next to the real `python/imports.ts`, an `xctest` folder although the configuration is now `swift-tests`, a `general/site/rules/` folder although the Site configuration lives in `framework/site/`, or a third "scripts" folder. They also keep old names alive (`snapshot` is a banned word outside tests). `docs/public/brand/badges` is not ignored, so it is not
  build output.
- Fix: Delete them once on this machine, after GEN-028 removes the old Vale package folders:
  `find . -type d -empty -not -path '*/node_modules/*' -not -path './.git/*' -not -path '*/.venv/*' -not -path './.gspot/*' -not -path './docs/dist/*' -not -path './docs/.wrangler/*' -delete`.
  No repository change is needed.
- Size: small

### INX-001: gspot's mise pins sit in `.mise/conf.d/gspot-tools.toml`, project config for the whole repository

- Where: `packages/cli/src/generation/mise.ts:24-41`; `packages/cli/src/generation/public.ts:198`;
  `packages/cli/src/config/platform/locations.ts:41` (`MISE_CONFIG_PATH`);
  `packages/cli/src/lifecycle/install/public.ts:109-142`; `packages/cli/src/generation/documents/public.ts:66-72,262`;
  `packages/cli/src/commands/init/plan.ts:48-52`; `packages/cli/src/tools/public.ts:305`;
  `packages/cli/src/config/generation/hooks.ts:13`; `.mise/conf.d/gspot-tools.toml`;
  `.github/workflows/gspot.yml:26,71`;
  docs `guides/generated-files.md:21`, `install.md:49-56`, `join.md:22-30`, `quickstart/python.md:29-37`,
  `quickstart/swift.md:50-58`, `remove.md:23`, `requirements.md:19`, `runners.md:10`; tests that name the path:
  `tests/config/samples/quickstart.ts:3`, `tests/config/tools/lifecycle/python-project.ts:13`,
  `tests/cli/commands/doctor.test.ts:124`, `tests/cli/commands/init/refusals.test.ts:218`
- Kind: move
- Problem: Only when the runner is mise does gspot write `.mise/conf.d/gspot-tools.toml`, which pins `min_version`,
  gspot itself, Node, uv, and every program tool. `.mise/conf.d/` is a real mise folder, but it is project config for
  the whole repository: every `mise` command at the root and every terminal with `mise activate` reads it, so the file
  changes the user's tools and Node. mise ranks `mise.toml` above `.mise/conf.d/*.toml`, so a user's own pin silently
  wins, which is why gspot needs duplicate-pin detection (INX-007). The file holds inline tables (`os` lists,
  swiftformat options), so it needs `mise trust`, and the docs repeat trust lines on four pages. It sits outside
  `.gspot/`, so `.gitattributes` (`.gspot/** linguist-generated`) and the rule "never edit files under `.gspot/`" miss
  it (GEN-029). Its name says nothing, and the plain name `gspot.toml` is taken by the settings file, which gspot looks
  for in each parent folder to find the repository root.
- Fix: gspot writes `.gspot/mise.toml` instead: mise's standard file name, in gspot's own folder, beside
  `.gspot/package.json` (npm tools) and `.gspot/pyproject.toml` (Python tools). mise finds it by its normal folder
  lookup when a command runs in `.gspot/`; as the deepest config there, its versions win over the user's root files;
  nothing at the repository root changes; and `mise prune` keeps its tools, because mise records the configs it reads.
  gspot never writes the user's `mise.toml`.
    1. `miseFile` writes `[tools]` and one `name = "version"` line per program tool, with an inline table only where a
       tool needs options (swiftformat). No header (GEN-017), no `min_version` (INS-001), no `os` (INX-006), and no gspot
       or Node (INX-002).
    2. gspot writes it whenever the selected checks need a program tool, in every repository, whatever starts gspot. It
       has the same generated-file kind as `.gspot/package.json`; the kind `'runner'` goes (INS-015).
    3. `MISE_TOOL_PROJECT_FILE = '.gspot/mise.toml'` replaces `MISE_CONFIG_PATH`, beside the other `.gspot/` paths in
       `config/`.
    4. gspot runs `mise trust`, `mise install`, and `mise bin-paths` for its tools with `cwd: .gspot` (INX-006). Users
       never trust or install gspot's mise file by hand, so the hook message for a missing mise needs no `mise trust`
       step.
    5. Delete `.mise/conf.d/gspot-tools.toml` from this repository in step 6 of the order of work. It holds this
       repository's only `node` pin, so the same commit moves `node = "24.20.0"` into the root `mise.toml` (SCR-001). The
       generated CI cache key hashes `.gspot/mise.toml` and `gspot.toml` (INS-003). The integration preload writes its
       temporary mise file with `miseFile` (ROOT-028).
    6. Docs: no page mentions gspot's mise file except the generated-files page ("`.gspot/mise.toml`: the program tools
       gspot installs with mise").

    Verify with one real run on macOS, Linux, and Windows: a mise config in a subfolder, `mise install` and
    `mise bin-paths` with named tools, `mise prune`, and the trust of inline options.

- Size: medium

### INX-002: The mise file pins gspot itself and Node

- Where: `packages/cli/src/generation/mise.ts:37`; `packages/cli/src/config/configurations.ts:39-40`
  (`GSPOT_MISE_TOOL`); `packages/cli/configurations/general/gspot/manifest.toml:7-14` (Node: `version = "24.20.0"`,
  `mise = "node"`); `packages/cli/src/config/lifecycle/version-pin.ts:3` (`mise: 'mise install'`);
  `packages/cli/src/lifecycle/public.ts:305-307`; `.mise/conf.d/gspot-tools.toml:6,11`; `mise.toml:1-3`;
  `docs/src/content/docs/guides/upgrade.md:20-27`; `tests/config/harness/npm.ts:2-8`,
  `tests/config/harness/python-installation.ts:4-11`
- Kind: delete
- Problem: For mise users, gspot pins its own version in a file gspot generates; for npm users, the version lives in
  the user's own `package.json`: two models for one fact. Because init proposes mise whenever mise is on `PATH`, an
  npm-installed repository gets runner mise, and gspot is pinned twice. The Node pin (24.20.0) becomes the Node of the
  whole folder for every mise user without their own node pin. This repository needs
  `disable_tools = ["npm:@gspothq/cli"]` only to undo gspot's self-pin, and two test data files copy that line into
  sandbox `mise.toml` files.
- Fix:
    1. Delete `GSPOT_MISE_TOOL` and its line in `miseFile`.
    2. In `general/gspot/manifest.toml`, make Node a system tool: `system = true`, `min_version = "24.2.0"`; keep `brew`
       and `winget` for the doctor hint; delete `version` and `mise`. The Node that runs gspot also runs the npm tools
       (INS-029).
    3. mise users pin gspot and Node in their own `mise.toml` with mise's own command,
       `mise use node@24 npm:@gspothq/cli@<version>`, exactly as npm users run `npm install --save-dev --save-exact`.
       This repository does the same in step 11 of the order of work (SCR-001).
    4. The version-pin message for mise says `mise use npm:@gspothq/cli@<version>` (the `pin` field of `RUNNERS`,
       INS-014).
    5. Upgrade with mise: `mise use npm:@gspothq/cli@<version>`, then `gspot apply`.
    6. The sandbox test data drops the `disable_tools` line.
- Size: small

### INX-003: The `runner` setting stores again what `package.json` or `mise.toml` already say

- Where: `packages/cli/src/policy/schema/public.ts:169`; `packages/cli/src/parsers/schema/contracts.ts:174-175`
  (`runnerSchema`); `packages/cli/src/config/policy/file.ts:6`;
  `packages/cli/src/commands/init/contracts.ts:186-196,264-276`; `packages/cli/src/config/commands/init.ts:27-34`
  (`RUNNER_CHOICES`); `packages/cli/src/commands/init/public.ts:41-52,202-204,224`;
  `packages/cli/src/config/generation/hooks.ts:10-18`; `packages/cli/src/generation/contracts.ts:22-25,62-63`;
  `packages/cli/src/lifecycle/public.ts:295-317`; `packages/cli/src/tools/npm/public.ts:32-46,143-157`;
  `packages/cli/src/generation/eslint/runtimes.ts:21-24`; `packages/cli/src/generation/public.ts:54,198`;
  `packages/cli/src/repository/discovery/public.ts:41-52,75-82` (`detectRunner`);
  `packages/cli/src/config/parsers/lockfiles.ts:2-60` (the `runner` field of `LOCKFILES`);
  `packages/cli/src/types/repository/inventory.ts` (`Runner`, `Tooling.runner`, `Tooling.runnerFile`);
  `packages/cli/src/checks/general/docs.ts:83`;
  `docs/src/content/docs/guides/runners.md`, `requirements.md:14`, `templates.md:16`, `troubleshooting.md:81-83`;
  `docs/src/config/example.json`; `tests/config/cli/commands/init/questions.ts:34`
- Kind: delete
- Problem: The setting says how hooks start gspot, but that already follows from how the repository installs gspot,
  and the setting appears in 34 source files. Each disagreement is a bug. `init` proposes mise whenever mise is on
  `PATH` (`which.sync('mise') === null ? tooling.runner : 'mise'`), so a repository that installed gspot with
  `npm install --save-dev` and ran `npx gspot init --yes`, as the TypeScript quickstart says, gets runner mise, a
  second gspot pin (INX-002), and mise's Node for the folder; the init header even prints "runner npm" and then
  proposes mise. Global installs get runner npm and broken hooks; templates copy another repository's runner (INX-004).
  The setting also carries hidden jobs: the npm tool project's package manager (the docs say that with no declared
  package manager gspot uses npm, but `detectedInstaller` falls back to the runner:
  `return { name: runner === 'mise' ? 'npm' : runner, version: undefined };`), ESLint's `.mise/tasks/**`
  globs (INX-011), uv's install source (`installUv`), and the CI job shape (`Pipeline.isMise`). `assertVersionPin`
  parses the raw `runner` value a second time, and the setting's description says it "installs and runs gspot". `runner: true` on five `LOCKFILES` entries is read only by `detectRunner`, which reads the root
  `packageManager` field and the lockfile: the same facts `selectPackageInstaller` already reads for the npm tool
  project. The real constraint behind the mise default (without mise, gspot installs no program tools) becomes one stated
  requirement for both install paths: program tools need mise (INX-006).
- Fix: Step 6 of the order of work.
    1. One function in `generation/hooks.ts` returns the start command from the root `package.json`. When it lists
       `@gspothq/cli` in `devDependencies` or `dependencies`, the start command uses the package manager that
       `selectNpmClient` finds: `npm exec --no -- gspot`, `pnpm exec gspot`, `yarn exec gspot`, or
       `bun run --no-install gspot`. Otherwise it is `mise exec -- gspot`. It reads no `mise.toml`. `selectNpmClient` (today
       `selectPackageInstaller`, in `tools/npm/project.ts`) is the one package-manager detection. The hooks and the `AGENTS.md` managed block
       (DCX-018: `<start command> check --staged`) print the same start command.
    2. Delete the `runner` key with its schema entry and description; `runnerSchema`; `RUNNER_CHOICES`; the "Runner?" question; the runner field of `PolicyDraft` and `templateAnswers`; `detectRunner`, `Runner`, `RunnerSelection`, the
       `Tooling.runner` and `Tooling.runnerFile` fields, and the `runner` field of `LOCKFILES`; the `runner` parameter of
       `detectedInstaller` and `selectNpmClient`, so that with no declared package manager gspot uses npm, which comes
       with the Node that gspot needs; and the raw-value parsing in `assertVersionPin`, which reads the start command
       from the repository instead.
    3. `RUNNERS` (INS-014) keeps five rows (npm, pnpm, yarn, bun, mise), keyed by
       `RUNNER_NAMES = [...NPM_CLIENTS, 'mise'] as const` in `config/repository/tooling.ts`, the one list. Its other users
       read it too: `isLintCommand` (a CI line such as `npm run lint`) and the run-token pattern of the docs check
       (`checks/general/docs.ts:83`, today `runnerSchema.options`). No `Runner` type: where a type is needed, write
       `(typeof RUNNER_NAMES)[number]` in `types/`.
    4. A `gspot.toml` that still has `runner` gets the normal unknown-key error. No migration: no published version has
       the key, because the first publish (step 10) comes after this change.
    5. Delete `runners.md` and the `requirements.md` line about the fallback. The Install page gets a short section "How hooks start gspot" with the sentence of fix 1, and
       the section "Private registries" moves there whole.
- Size: medium

### INX-004: `gspot init --from <template>` sets the template's runner, or no runner

- Where: `packages/cli/src/commands/init/public.ts:41-52` (`runner: tables.runner ?? 'none'`);
  `packages/cli/src/policy/document/contracts.ts:76-87` (export copies every root key);
  `docs/src/content/docs/guides/templates.md:16`
- Kind: fix-bug
- Problem: A template exported from an npm repository carries `runner = "npm"`. Applied to a Python repository set up
  with mise, its hooks run `npm exec --no -- gspot` and fail. A template without `runner` forces "none" even where
  gspot is a dev dependency, so the hooks call `gspot` on `PATH`, where a dev dependency is not. The templates page
  says that a template carries the runner setting.
- Fix: INX-003 deletes the setting in step 6, so a template carries nothing about how gspot starts. In the same step,
  delete the `runner` line in `templateAnswers` and the word "runner" on the templates page.
- Size: small

### INX-005: The global npm install, hooks that call bare `gspot`, and one-off inits leave repositories without a working pin

- Where: `docs/src/content/docs/guides/install.md:58-67`; `join.md:32-43`; `ci.md:52-61`; `README.md:21-25` (row 3);
  `docs/src/components/home/Hero.astro:35-39`; `packages/cli/src/config/generation/hooks.ts:12` (`gspot` row);
  `packages/cli/src/lifecycle/public.ts:305-307` (`'npm install --global'`);
  `packages/cli/src/generation/documents/public.ts:91-94,262,334-336` (`ciNpmInstall`);
  `packages/cli/src/commands/init/plan.ts:158-160`; `packages/cli/src/config/commands/init.ts:17-19` (`CI_SETUP`);
  `docs/src/content/docs/guides/runners.md:30-32`; `troubleshooting.md:81-83`; `quickstart/python.md:23-27`,
  `quickstart/swift.md:44-48`; `tests/config/tools/commands/python-quickstart.ts`,
  `tests/config/tools/commands/swift-quickstart.ts`
- Kind: delete
- Problem: A global install gives one gspot per machine, while every repository pins its own version in
  `.gspot/version` and refuses any other (`assertVersionPin`): two repositories at different versions cannot both
  work. A global user gets hooks that call a gspot that is not a dependency, and no test installs globally. Its only
  other use, a hand-written CI, works with the local commands (INS-003). Without a CI provider, the init plan's
  "CI setup (no workflow generated)" block always suggests `npm install --global ...`, even for mise, and wraps its
  one list in an object (`CI_SETUP = { commands: [...] }`). The one-off inits (`npx @gspothq/cli init`, `bunx`,
  `pnpm dlx`, `yarn dlx`, `mise exec npm:@gspothq/cli@<version> -- gspot init`) leave the repository without a pin.
  The Python and Swift quickstarts use the mise one-off init and tell the reader to choose mise in a prompt, while
  their tests run other commands.
- Fix: Delete the docs sections, the Hero "Global" tab, the README row, the `gspot` row of the hooks table, the global
  fallback in `assertVersionPin`, `ciNpmInstall` and its callers, `CI_SETUP`, and the init plan's "CI setup (no workflow
  generated)" block (the CI page has the commands). Rewrite the troubleshooting entry "npm exec cannot find gspot" as
  "Run your package manager's install, then `gspot install`." Do not document the one-off inits. The Python and Swift
  quickstarts use the mise path: `mise use node@24 npm:@gspothq/cli@<version>`, commit, then
  `mise exec -- gspot init --yes --configurations python` (or `swift`); the quickstart test data runs the same lines.
- Size: small

### INX-006: `gspot install` installs program tools only when the runner is mise

- Where: `packages/cli/src/lifecycle/install/public.ts:109-142`;
  `packages/cli/src/tools/python/public.ts:116-120,167-200` (`installUv`);
  `packages/cli/src/commands/public.ts:182-187`;
  `packages/cli/src/tools/contracts.ts:80-95` (`hostCandidates`), `114-129` (`installHint`);
  `packages/cli/src/configurations/contracts.ts:20-28` (`miseOs`), `80-85` (`pinOf`);
  `packages/cli/src/tools/npm/contracts.ts:192-217` (`registryEnvironment`); `packages/cli/configurations/general/security/manifest.toml:23-31,70-81` (CodeQL)
- Kind: simplify
- Problem: Program tools are installed only when the runner is mise, by `mise trust` and `mise install` of the
  folder-wide file, and found through `PATH`, mise shims, and one `mise which` per shim. uv has a second, separate path
  (`installUv`: `mise install uv@<v>` and `mise which uv --tool`), also only for runner mise. Every other repository
  gets no program tools, so the always-on checks fail until the user installs each program by hand. The mise step
  passes npm registry settings to mise only because the file pinned `npm:@gspothq/cli`. The `os` lists drop the CPU (`miseOs` drops the `-x64` part, so CodeQL's "not on arm64 Linux" becomes no platform limit at all) and force `mise trust`. Every tool of every selected check is pinned and installed, so each clone downloads the CodeQL bundle (4.4 GB), although the CodeQL check has `stage = "manual"` and runs only in CI.
- Fix:
    1. When mise is on `PATH`, `gspot install` runs `mise trust .gspot/mise.toml` (for swiftformat's options) and
       `mise install <tool names>` with `cwd: .gspot`, naming only the tools of active checks at the `commit` and `push` stages that have a build for this OS and CPU (`missingBuild`, LIF-037): one condition on the list of tool names in `.gspot/mise.toml`. On failure it prints mise's output (GEN-030).
    2. When mise is absent, `gspot install` installs the npm tools, and the Python tools only when uv is on `PATH`. It
       prints one line that names every missing program, uv included: "Install mise, or install these programs
       yourself: gitleaks 8.30.1, uv 0.12.13, ...". It exits 0: it installed all it can without mise, and the missing
       programs are reported where they matter. Each check whose program is missing reports it and fails (exit 2) until
       the program is installed, on both install paths, and `gspot doctor` names them with brew or winget commands. The
       Install page says so (INX-009).
    3. Once per session, gspot runs `mise bin-paths <tool names>` with `cwd: .gspot` and searches those folders first
       for these tools. uv is found the same way; without mise, gspot looks for uv on `PATH`.
    4. Delete `installUv`, the runner check behind `ToolSession.pythonInstaller`, the `installer` row of
       `pythonToolProject.commands`, the `os` field and `miseOs`, the `mise --version` check (INS-001), and the
       `registryEnvironment` call in the mise step. Keep the shim lookup of `hostCandidates` only for system tools.
    5. The last step of the one generated CI job (INS-003) names the manual-stage tools (such as CodeQL) in its own `mise install` line.

    Verify with one real run per OS (INX-001).

- Size: medium

### INX-007: Duplicate-pin detection ("pinned twice") gives wrong advice

- Where: `packages/cli/src/tools/public.ts:265-310` (`duplicateMisePins`); `packages/cli/src/types/tools/install.ts`
  (`DuplicateMisePin`); `packages/cli/src/config/tools/mise.ts` (`TOOL_PROJECT_FILES`);
  `packages/cli/src/parsers/mise.ts:4-13` (`parseMiseToolKeys`); `packages/cli/src/parsers/schema/mise.ts:3`
  (`miseToolsSchema`); `packages/cli/src/commands/doctor/contracts.ts:166-171`;
  `packages/cli/src/commands/doctor/public.ts:60-64`; `packages/cli/src/commands/init/plan.ts:57-70,183`;
  `tests/cli/tools/mise-pins.test.ts`; `tests/config/cli/tools/mise-pins.ts`
- Kind: delete
- Problem: `gspot doctor` and `gspot init` tell users to "delete the mise.toml line" for every tool gspot also pins.
  For npm and Python tools that advice is wrong: gspot runs them only from `.gspot/node_modules/.bin` and
  `.gspot/.venv` (`tools/contracts.ts:47-48,187`), so the user's pin never reaches gspot, and it may serve the user's
  own scripts or editor. For program tools the clash exists only because the conf.d file ranks below `mise.toml`; in
  `.gspot/`, gspot's file ranks first (INX-001). The detection also reads only `mise.toml` of the nine mise file names
  mise knows.
- Fix: Delete the function, the type, `config/tools/mise.ts`, the parser and its schema (no other user), the doctor
  "pinned twice" section, the init plan row, and both test files. `gspot doctor` says nothing about tools pinned twice.
- Size: small

### INX-009: The install steps exist in six places, with three paths and wrong lines

- Where: `README.md:15-37`; `packages/cli/README.md`; `packages/cli/scripts/build.ts:53-63` (the README slicing); `docs/src/components/home/Hero.astro:21-40`;
  `docs/src/content/docs/guides/install.md`, `join.md`, `upgrade.md`, `remove.md`, `requirements.md:6,12-19`,
  `runners.md`, `quickstart/python.md:8,21-44`, `quickstart/swift.md:8,42-67`, `quickstart/typescript.md:111-126`,
  `generated-files.md:15-21`, `troubleshooting.md:24-25,35,75-83`, `templates.md:16`, `hooks.md:22-33`, `ci.md`;
  `docs/src/config/example.json:4-5`
- Kind: rewrite-text
- Problem: The install steps exist in six places (the root README, `packages/cli/README.md`, the Hero, the Install
  page, the TypeScript quickstart, and `docs/src/config/example.json`), with three paths, trust lines, and a wrong mise
  version (the requirements page says 2026.8.8). After `init`, the pages tell the user to run `mise trust`,
  `mise install`, and `mise exec -- gspot install` again. Four pages say "Replace `<version>` with the exact version from the npm package page", though the site already knows the version and the npm page does not exist yet. The same "which install method, which command prefix" table is written by hand in `README.md` and `guides/install.md`, in slightly different words, and `build.ts` cuts the root README into sections, keeps three by heading name, rewrites links with a regular expression, and commits the result as `packages/cli/README.md`; a renamed heading silently drops a section.
- Fix: Use the blocks of "Target install". The Install page has two sections (package manager, mise), then "How hooks
  start gspot" and "Private registries" (INX-003), and one paragraph on what happens without mise (INX-006). It takes
  over the requirements page, with the Node sentence of INS-012, and ends with a link to Join a repository. Join a
  repository keeps its own page with the "After you clone" lines. Upgrade and Remove keep one page each, and Python
  and Swift keep one quickstart each. `runners.md` is deleted (INX-003). Yarn examples use `yarn exec gspot`, the form the hooks run. The full install table is only on the Install page; Join keeps only its own table (the clean install of each package manager). The root README shows the npm block and one line: "[Install gspot](https://generativespotting.com/guides/install/) covers pnpm, Yarn, Bun, and mise." The homepage shows the npm block and a link (DOC-037). Delete the README slicing in `build.ts` with its `readFile` and `writeFile` imports, and write `packages/cli/README.md` by hand with an opening paragraph and an Install section (text in "Changes by file" of `docs.md`): `packages/cli` is a scope, so `docs/required-files` and `docs/readme-shape` need both. No
  page tells users to trust or install gspot's mise file, and no page names it except the generated-files page
  (INX-001). `<version>` appears only in the mise and upgrade lines, with one sentence: "Replace `<version>` with the
  release you install." Every page teaches only the final CLI, the final `gspot.toml` keys, and these two install
  paths.
- Size: medium

### INX-010: The tool projects are named `gspot-tools`

- Where: `packages/cli/src/config/platform/locations.ts:1-2` (`TOOLS_PROJECT`);
  `packages/cli/src/config/parsers/packages.ts:7-17`; `packages/cli/src/parsers/packages/contracts.ts:99-101`;
  `packages/cli/src/parsers/schema/public.ts:216-219`; `.gspot/package.json:2`; `.gspot/pyproject.toml:2`;
  `.gspot/bun.lock:6`; `.gspot/uv.lock:620`
- Kind: rename
- Problem: Both tool projects carry the invented name `gspot-tools`. npm, pnpm, Yarn, and Bun need no `name` in a
  private package that is never published. The parsers then check that gspot's own generated files carry this literal
  (`z.literal(NPM_TOOL_PROJECT.name)`, `z.literal(PYTHON_TOOL_PROJECT.name)`): a self-check of gspot's output.
- Fix: Drop `name` from the generated `.gspot/package.json`. Name the Python project `tools` (PEP 621 requires a name;
  uv never builds it, because `package = false`). Delete `TOOLS_PROJECT` and the two name checks. Let `gspot install`
  rewrite both lockfiles. Verify one frozen install per package manager (LIF-001 asks for this anyway).
- Size: small

### INX-011: ESLint script globs depend on the runner

- Where: `packages/cli/src/generation/eslint/runtimes.ts:14-24`; `packages/cli/src/config/generation/eslint.ts:4`
- Kind: simplify
- Problem: Files under `.mise/tasks/` get the script lint rules only when the runner is mise. A repository whose hooks
  start gspot through npm can have mise task files too. It is a hidden second job of the setting.
- Fix: Always add `.mise/tasks/**` to the script paths: a glob that matches nothing changes nothing. Delete the
  settings parameter of `scriptPaths`.
- Size: small

### INX-012: Dependency bots will edit the generated tool projects

- Where: `docs/src/content/docs/guides/generated-files.md`; `.gspot/package.json`, `.gspot/pyproject.toml`,
  `.gspot/mise.toml`
- Kind: rewrite-text
- Problem: Renovate looks for `package.json`, `pyproject.toml`, and `mise.toml` at any depth. A bump of a gspot pin
  makes the file differ from gspot's output (the stale-files check fails), and the next `gspot apply` undoes it. The
  docs say nothing about bots. Not run here: Renovate's scan of `.gspot/`.
- Fix: One sentence on the generated-files page: "gspot updates the files in `.gspot/` when you upgrade gspot. Tell
  dependency bots to skip that folder; for Renovate: `"ignorePaths": [".gspot/**"]`."
- Size: small

## Target install

Replace `<version>` with the release you install. What gspot writes is the same on every path: `init` writes
`gspot.toml`, `.gspot/` (`version`, `config/`, `rules/`, `hooks/`, and the tool project files `package.json`,
`pyproject.toml`, and `mise.toml` that the selected checks need), the managed blocks in `AGENTS.md`, `.gitignore`, and
`.gitattributes`, the pointer files, and the CI workflow when `ci.enabled` is true. `install` writes the lockfiles in
`.gspot/`, installs into `.gspot/node_modules/`, `.gspot/.venv/`, and `.gspot/vale/`, writes `.gspot/state/`, sets the
local Git setting `core.hooksPath`, and installs program tools into mise's store outside the repository.

| Path                                         | Commands                                                                                                                                                                                                                                                                                                | Files written                                                                                                                                                                                                                                                                                                | Must have first                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm dev dependency                           | `npm install --save-dev --save-exact @gspothq/cli`<br>`git add package.json package-lock.json`<br>`git commit -m "build: Add gspot"`<br>`npx gspot init`<br>`npx gspot install`<br>`npx gspot check`                                                                                                    | npm: `package.json`, `package-lock.json`; then init's and install's files                                                                                                                                                                                                                                    | Git, Node.js 24.2+, npm, and mise (or each program tool installed by hand; until then the checks that need one fail with exit 2)                  |
| pnpm, Yarn, Bun dev dependency               | pnpm: `pnpm add --save-dev --save-exact @gspothq/cli`, then `pnpm exec gspot init`, `install`, `check`<br>Yarn: `yarn add --dev --exact @gspothq/cli`, then `yarn exec gspot ...`<br>Bun: `bun add --dev --exact @gspothq/cli`, then `bunx gspot ...`<br>Commit the manifest and lockfile before `init` | the package manager's manifest and lockfile; then init's and install's files                                                                                                                                                                                                                                 | Git, Node.js 24.2+, that package manager, and mise (or each program tool installed by hand; until then the checks that need one fail with exit 2) |
| mise                                         | `mise use node@24 npm:@gspothq/cli@<version>`<br>`git add mise.toml`<br>`git commit -m "build: Add gspot"`<br>`mise exec -- gspot init`<br>`mise exec -- gspot install`<br>`mise exec -- gspot check`                                                                                                   | mise: `mise.toml` (your file); then init's and install's files                                                                                                                                                                                                                                               | Git, mise                                                                                                                                         |
| After you clone (the Join a repository page) | npm: `npm ci`, `npx gspot install`, `npx gspot check` (pnpm, Yarn, Bun: their frozen install, then the same with their exec command)<br>mise: `mise exec -- gspot install`, `mise exec -- gspot check`                                                                                                  | install's files                                                                                                                                                                                                                                                                                              | as the path the repository uses                                                                                                                   |
| Upgrade                                      | npm: `npm install --save-dev --save-exact @gspothq/cli@<version>`; mise: `mise use npm:@gspothq/cli@<version>`<br>then `gspot apply`, `gspot install`, and `gspot check` with your start command, and commit                                                                                            | your manifest and lockfile, or `mise.toml`; `.gspot/version`; changed generated files and lockfiles                                                                                                                                                                                                          | a clean working tree                                                                                                                              |
| Remove                                       | `git config --unset core.hooksPath` (when it is `.gspot/hooks`)<br>delete `gspot.toml`, `.gspot/`, the gspot CI file, the pointer files, and the managed blocks<br>npm: `npm uninstall @gspothq/cli`; mise: `mise unuse npm:@gspothq/cli`<br>commit                                                     | none                                                                                                                                                                                                                                                                                                         | none                                                                                                                                              |
| Generated CI                                 | `gspot set ci.enabled true` (GitLab: also `gspot set ci.provider gitlab`); `set` writes the workflow, with no separate `gspot apply`                                                                                                                                                                    | `.github/workflows/gspot.yml` or `.gitlab/ci/gspot.yml`: one job that runs mise-action, the `ci.setup_command` when set, then `mise exec node@24 npm:@gspothq/cli@<version> -- gspot install` and `... gspot check`; on default-branch pushes a last step runs the manual checks. No `doctor` step (INS-003) | GitHub Actions, or a GitLab image with mise                                                                                                       |
| Your own CI                                  | install mise, then your start command with `install` and `check`                                                                                                                                                                                                                                        | none                                                                                                                                                                                                                                                                                                         | mise, the project's runtime                                                                                                                       |

Hooks start gspot from where the repository pins it: when the root `package.json` lists `@gspothq/cli`, the package
manager that `selectNpmClient` finds gives `npm exec --no -- gspot`, `pnpm exec gspot`, `yarn exec gspot`, or
`bun run --no-install gspot`; otherwise the start command is `mise exec -- gspot`. The `AGENTS.md` managed block prints
the same start command.

Without mise: `gspot install` installs the npm tools, and the Python tools only when uv is on `PATH`, prints one line
that names every missing program (uv included), and exits 0. The checks that need a missing program fail (exit 2)
until it is installed, and `gspot doctor` names them.

Deleted: the global npm install, hooks that call bare `gspot`, the one-off `npx`, `bunx`, `dlx`, and `mise exec` inits,
the `runner` setting, `.mise/conf.d/gspot-tools.toml`, the non-mise CI shape, and the `doctor` step in CI.

### Where `gspot install` puts each tool

It installs straight into `.gspot/`, with no staging folder; `init` installs nothing.

| Tools                                                                                                                                            | Pinned in (committed)                                            | Lockfile (committed)                                                        | Installed into                                 | Installed by                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| npm tools: ESLint and its plugins, Prettier, Stylelint, markdownlint, knip, ...                                                                  | `.gspot/package.json`                                            | `.gspot/` `bun.lock`, `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock` | `.gspot/node_modules/`                         | the repository's package manager, a frozen install run in `.gspot/` |
| Python tools: Ruff, basedpyright, semgrep, yamllint, zizmor, ...                                                                                 | `.gspot/pyproject.toml`, with the exact Python version (GEN-015) | `.gspot/uv.lock`                                                            | `.gspot/.venv/`; the interpreter in uv's cache | `uv sync --locked`, run on `.gspot/`                                |
| Vale packages                                                                                                                                    | `Packages` in `.gspot/config/vale.ini`                           | none                                                                        | `.gspot/vale/`                                 | `vale sync`                                                         |
| Program tools: gitleaks, trufflehog, typos, lychee, osv-scanner, shellcheck, actionlint, taplo, vale, uv, swiftlint, swiftformat, periphery, ... | `.gspot/mise.toml`                                               | none (one exact version each, no dependencies)                              | mise's store, shared by all repositories       | `mise install <names>` run in `.gspot/`                             |
| System tools: swift, xcodebuild, docker, the project's jest, vitest, and tsc; Node                                                               | not pinned; floors in the manifests                              | none                                                                        | the machine or the project                     | the user                                                            |
| gspot itself                                                                                                                                     | the user's `package.json` or `mise.toml`; `.gspot/version`       | the user's lockfile                                                         | `node_modules/` or mise's store                | the user                                                            |

`init` writes the three tool project files and no lockfile. `install` writes the lockfiles when they are missing, then
installs. Program tools need mise on both install paths.
