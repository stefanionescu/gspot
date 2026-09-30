# Updates

This file records an audit of the gspot repository, done on September 30, 2026. The standard is strict: keep only
what the product needs to work, to be built, to be published, and to be tested. A thing that is merely defensible
goes. Nothing here is fixed yet. `architecture.png` shows the code today and after the cuts.

The audit read `packages/cli`, `packages/eslint-plugin`, `docs`, `tests`, `.github`, and every root file, and it
measured the import graph of `packages/cli/src` with a script. Today the CLI source holds 409 files and 41,421 lines,
and the tests hold 506 files and 46,920 lines. After the cuts below, the CLI source comes to about 11,000 lines.

## 1. The product that remains

**Commands.** `init`, `apply`, `install`, and `check`. Nothing else is needed to set up a repository, keep its
configuration current, install its tools, and run its checks. Every other command goes (section 4.1).

**What `check` does.** It runs the pinned tools with the generated configuration over the selected files, with
`--fix` for the fixers and `--staged` as a plain filter on the staged file names.

**Agent rules.** The installed Markdown for coding agents, called rules (not guides), and the gspot block in
`AGENTS.md`. This is half of the product description, so it stays; its content is cut to what is not gspot taste.

**Kits.** About 25 of the 51, each a set of real tools with generated configuration (section 4.2).

**Decisions only the owner can make** (each is a product question, not a cleanup):

| Question                                     | Cost today                                     | Recommendation                                                                                                   |
| -------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Keep monorepo scopes?                        | about 700 lines and 800 test lines             | this repository uses three scopes (`docs` needs the Astro kit); keep one flat list of path globs per kit instead |
| Keep Windows support?                        | about 100 lines, 6 CI shards, most CI failures | drop it until someone asks                                                                                       |
| Keep two levels (recommended and all)?       | doubles the configuration surface              | one level                                                                                                        |
| mise only, or also npm, pnpm, Yarn, and Bun? | about 1,100 lines                              | mise installs the native tools; npm installs the private npm tools; drop the other managers                      |
| Keep `uninstall`?                            | 166 lines plus the recovery machinery          | delete; the documentation says which files to remove                                                             |

## 2. Answers to the questions asked

### Linting logic for gspot itself in the product

Yes, in three ways.

**This repository's layout ships to users as defaults.**

| Where                                                                                                                                             | What it forces on users                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `packages/eslint-plugin/src/config/import-direction.ts:3`                                                                                         | roles for `tests/support`, `config`, `src/env`, `types`, and `src`: the folder tree of this repository        |
| `packages/eslint-plugin/src/rules/tests-directory-contents.ts:34`                                                                                 | a `tests/support` folder for any helper next to tests                                                         |
| `packages/eslint-plugin/src/rules/env-access-owner.ts:37`                                                                                         | environment reads only under `src/env` or `config`                                                            |
| `packages/cli/src/config/generation.ts:83`                                                                                                        | the same roles again, already different from the plugin copy                                                  |
| `packages/cli/src/generation/eslint/configuration.ts:27`                                                                                          | a `types` folder role even when the user sets none, against `packages/cli/guides/language/TYPESCRIPT.md:51`   |
| `packages/cli/kits/tool/jest/manifest.toml:82`, `packages/cli/kits/tool/vitest/manifest.toml:88`                                                  | `harness_directory = "tests/support"`, which feeds four other checks                                          |
| `packages/cli/src/config/checks/structure.ts:92`                                                                                                  | bans folder names such as `support` and `shared`; this repository exempts its own folders in `gspot.toml`     |
| `packages/cli/kits/general/naming/policy.json`                                                                                                    | bans `catalog`, `corpus`, `render`, `load`, `fetch`, `resolve`, and puts a two-digit prefix on Markdown files |
| `packages/cli/guides/general/code/TESTING.md:61`, `packages/cli/guides/general/code/NAMING-FILES.md:28`, and the naming guides of three languages | tell agents to use `tests/support`                                                                            |
| the two plugin layout rules, `packages/cli/kits/language/python/ruff.toml.tmpl:20`, `python/export-order`, and Bash `structure/source-order`      | sort imports and exports by length, an order nobody else uses                                                 |

**Things written for gspot code alone ship to users.**

- `packages/cli/kits/language/javascript/eslint.config.js.tmpl:69`: the generated ESLint configuration of every user
  names `GspotError`, the internal error class of gspot.
- `packages/cli/kits/general/prose/styles/gspot/corruption.yml`: a Vale rule that catches damage from an old bulk
  rename in this repository. It runs on user prose at level all.
- `packages/cli/kits/language/javascript/manifest.toml:2`: the knip entry files `src/plugin`, `build.ts`, and
  `publish.ts` describe this repository.
- `packages/cli/src/config/checks/structure.ts:62` to `:263` and the Bash guides: conventions of another project,
  such as `run_ssh` blocks, `nvidia-smi` sweeps, include guards, and a four-line header, at level recommended.
- `packages/cli/kits/language/javascript/eslint.config.js.tmpl:187`: an internal decision number in user output.

**Code that lints this repository lives in the product source.** `packages/cli/src/agents/lint.ts`, `examples.ts`,
`metadata.ts`, and 14 constants in `packages/cli/src/config/agents.ts` exist only for the guide linter of this
repository. They include lists of other projects and companies (Virtua, Pino, Hetzner, Vercel, TensorRT). The build
leaves them out of the bundle, but they sit in `packages/cli/src`.

Action: every default above becomes an explicit setting with no default, or goes. The taste rules go (section 4.3).
The guide linter goes (section 4.4).

### Package names

The rule: `@gspothq/…` is what npm installs, and `gspot` is what you type. The npm scope `@gspot` belongs to someone
else, and npm refused the unscoped name `gspot`, so `@gspothq` is the only scope the project owns.

| Package                                              | Name today                               | Name                                                                              |
| ---------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| the CLI (published)                                  | `@gspothq/cli`, command `gspot`          | unchanged                                                                         |
| the ESLint plugin (published)                        | `@gspothq/eslint-plugin`                 | unchanged; add the namespace "gspot" in `packages/eslint-plugin/src/plugin.ts:57` |
| the workspace root (private)                         | `gspot`, the name npm refused            | `@gspothq/workspace`                                                              |
| the documentation site                               | `gspot-docs`                             | `@gspothq/docs`                                                                   |
| the tests                                            | `gspot-tests`                            | no package (below)                                                                |
| the tool project gspot writes into user repositories | `gspot-tools`                            | unchanged                                                                         |
| the lockfile root                                    | `gspot-workspace` in `bun.lock:6`, stale | regenerate                                                                        |

`tests` does not need to be a package. It exists to give 41 fixture packages their own store and to let knip ignore
them with one entry. Its `package.json` makes the CLI a dependency of the tests, which is the line you saw. Move the
41 packages to the root devDependencies and delete `tests/package.json`. `docs` does need to be a package: its Astro
dependencies resolve only from its own folder.

Wrong or unsafe install commands, all to fix:

| Where                                                                                                      | Problem                                                                                           |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `docs/src/components/home/Hero.astro:18`                                                                   | `npx @gspothq/cli init` never adds the dependency, so every hook fails afterwards                 |
| `docs/src/content/docs/guides/install.md:31`                                                               | `npx gspot --version` offers to download the unrelated unscoped `gspot` when nothing is installed |
| `docs/src/content/docs/guides/without-mise.md:26`                                                          | says gspot adds its launcher to devDependencies, which no code does, and suggests plain `npx`     |
| `docs/src/content/docs/guides/install.md:16`, `packages/cli/README.md:12`, `docs/src/pages/index.astro:50` | install without an exact version, although gspot requires the installed version to match its pin  |
| `packages/cli/src/config/generation.ts:40`                                                                 | the hook message "Install gspot" reads like `npm install gspot`                                   |
| `docs/src/content/docs/guides/build.md:26`, `mise.toml`, `packages/cli/scripts/build.ts:1`, `gspot.toml`   | say "the gspot package" for `@gspothq/cli`                                                        |
| five CLI source files                                                                                      | type `'@gspothq/cli'` by hand instead of reading it from the manifest                             |
| `packages/cli/package.json:43` and `tsconfig.json:28`                                                      | two aliases, `#package` and `#cli-package`, for one file                                          |

### `packages/cli/bin`

Two lines that run the source CLI with Bun. Only this repository uses it: `mise.toml` puts it on `PATH` for the hooks.
It sits beside `dist` and looks like part of the package. Move it out of the package.

### `packages/cli/grammars`

Tree-sitter WebAssembly files for the custom analyses. Once the custom analyses go (section 4.2), nothing parses
source with tree-sitter. The folder, 11 MB of grammars, seven devDependencies, `web-tree-sitter`, and
`packages/cli/scripts/inputs.ts` all go with them.

### The root `dist` folder

1.5 GB of the old per-system binaries and npm stubs that used the `@gspot` scope. Nothing writes it. Delete it and its
line in `.gitignore`.

### Is kits the right name

It is short and used in every command, message, and page. The other names are worse: presets suggests one
configuration, profiles is taken by `gspot export`, and stacks suggests several kits. Keep kits, and remove the old
synonym "configuration" from messages and comments, such as `packages/cli/src/kits/manifests.ts:63`.

### Script names

| Script                                | Does                                     | Action                                                      |
| ------------------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `packages/cli/scripts/inputs.ts`      | prepares the grammar files               | delete with tree-sitter                                     |
| `packages/cli/scripts/test-tools.ts`  | writes the tool pins that the tests need | move to a root scripts folder; name it after what it writes |
| `packages/cli/scripts/guides-lint.ts` | lints the agent rules of this repository | delete with the guide linter                                |
| `packages/cli/scripts/build.ts`       | builds the package                       | keep                                                        |

### Config files with no blank lines

17 of the 32 files in `packages/cli/src/config` have no blank line between groups. The real problem is the folder:
588 of its 663 exports have exactly one importer, and 215 of the 402 types in `packages/cli/src/types` have exactly
one user. Both folders exist because `gspot.toml` sets `types_directory` and `config_directory`, against the rule in
`packages/cli/guides/general/code/NAMING-FILES.md:154`. Delete the two settings, then move every constant and type
next to its user. Keep one small module each for file modes, `.gspot` paths, and exit codes.

### `packages/cli/src/execution/broken-tool.ts`

It decides whether a tool that exited with an error crashed or found something. The decision stays; merge it into
`packages/cli/src/execution/tool/findings.ts`. The TruffleHog branch goes with TruffleHog (section 4.2).

### `.gspot` in this repository

gspot runs on its own repository. Tracked: generated configuration, installed agent rules, hooks, tool manifests and
locks, and the version pin. Ignored: installed tools, cache, reports, state, and Vale styles. 24 files under
`.gspot/config/docs`, `.gspot/config/packages/cli`, and `.gspot/config/packages/eslint-plugin` repeat the root files
byte for byte, because the scopes `packages/cli` and `packages/eslint-plugin` select no kits. Delete those two scopes.

### `.ansible`

Three empty folders that ansible-lint creates in its working folder. `tests/integration/tools/flags.test.ts:56` runs
every tool with `--help` in the repository root. Delete the folder; the test goes in section 6.

### The `architecture` folder

Delete all of it: 11 documents (2,530 lines) and 2 tables (4,166 lines, 1.1 MB). The generated reference pages, the
guides, `CONTRIBUTING.md`, and the code hold every contract in it. Three documents break their own 300-line limit, and
`architecture/12-repository-layout.md` still describes the per-system launcher. Nothing reads the two tables. One
generated page links `architecture/04-kits.md` as its source (`docs/src/content/reference/collection.ts:55`); point it
at the kit schema.

## 3. Bugs in code that stays

| Where                                                                                                                                                                                 | Problem                                                                                                                 | Action                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `packages/cli/src/config/agents.ts:30`                                                                                                                                                | tells users to edit `[rules]` in `gspot.toml`; the table is `[guides]` today                                            | correct after the rename to rules |
| `packages/cli/guides/templates/docs`                                                                                                                                                  | 8 files ship but never install; `packages/cli/guides/general/prose/DOCS-REVIEW.md:178` promises them                    | delete both                       |
| `packages/cli/src/platform/assets.ts:58`, `packages/cli/scripts/build.ts:15`                                                                                                          | tell users to run a task that exists only in this repository                                                            | goes with tree-sitter             |
| `packages/cli/package.json`                                                                                                                                                           | `prettier` is a runtime dependency that `packages/cli/src` never loads                                                  | remove it                         |
| `mise.toml` (`guides:lint`)                                                                                                                                                           | runs test files that moved to `tests/integration/tools/guides`, and one that is gone                                    | goes with the guide linter        |
| `gspot.toml`                                                                                                                                                                          | entries for a deleted hook test and a `fail_fast` property; the typos words `virtua` and `referers` appear in no source | delete                            |
| `tests/support/package/run.ts:43`                                                                                                                                                     | `process.removeListener` receives new arrow functions and removes nothing                                               | keep the handlers in variables    |
| `tests/timings/windows.json`                                                                                                                                                          | a copy of the Linux file; Bun reports Windows paths with backslashes, so no key matches                                 | goes with Windows, or regenerate  |
| `packages/cli/src/commands/ignore.ts:51`, `packages/cli/src/generation/eslint/blocks.ts:133`, `packages/cli/src/policy/write.ts:187`, `packages/cli/src/policy/setting-surface.ts:14` | compare with `JSON.stringify`, which depends on key order                                                               | `isDeepStrictEqual`               |
| `packages/cli/src/execution/fixers.ts:215`                                                                                                                                            | diff headers use backslashes on Windows                                                                                 | forward slashes                   |
| `packages/cli/src/config/kits.ts:65`                                                                                                                                                  | the word "length-guidenames", left by a bulk rename                                                                     | fix                               |
| `docs/scripts/links.ts`                                                                                                                                                               | its last step compares the schema with the function that wrote it, so it always passes                                  | delete that step                  |
| `docs/src/components/starlight/SiteTitle.astro:13`                                                                                                                                    | repeats the background image of line 12                                                                                 | delete the line                   |

## 4. Delete

### 4.1 Commands and features

| Item                                                                                                                           | Lines             | Test lines  | Action                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `set`, `ignore`, `add`, `remove`, and the policy writer they share                                                             | about 950         | about 540   | delete; users edit `gspot.toml`                                                                |
| `explain`                                                                                                                      | 541               | 208         | delete; the reference pages explain each check                                                 |
| `doctor`                                                                                                                       | 356               | about 250   | delete; `check` reports a missing tool with its install hint                                   |
| `list`                                                                                                                         | 166               | 77          | delete; the kit index page lists the kits                                                      |
| `export` and profiles (`init --from`)                                                                                          | about 460         | 504         | delete; copy a `gspot.toml`                                                                    |
| `completion`, with `@bomb.sh/tab`                                                                                              | 18                | 56          | delete                                                                                         |
| `uninstall`                                                                                                                    | 166               | 212         | delete (section 1)                                                                             |
| the version pin `.gspot/version`                                                                                               | 48, in 7 commands | 22          | delete; the package manager or mise pins the version                                           |
| interactive questions, with `@clack/prompts`                                                                                   | 94                | 124         | delete; `init` takes flags                                                                     |
| init extras: `--from`, `--ci`, `--runner`, `--scope`, `--without`, `--allow-dirty`, detected settings, Xcode and bunfig import | about 1,150       | about 800   | delete; `init` shrinks to about 250 lines                                                      |
| report files: JSON, SARIF, and GitLab Code Quality, with `node-sarif-builder`                                                  | 162               | 499         | delete; `check --json` prints the report                                                       |
| result cache and `--no-cache`                                                                                                  | about 330         | 611         | delete; the tools cache their own work                                                         |
| `--fix --dry-run` in a scratch copy, `fix_order`, `fix_findings_exit_codes`                                                    | about 230         | about 700   | delete; keep a plain `--fix` of about 50 lines                                                 |
| revision snapshots for `--staged` and `--changed`                                                                              | about 660         | 926         | replace with a filter on `git diff --cached --name-only`, about 20 lines                       |
| pre-push checks per pushed commit, with the hidden `--push`                                                                    | about 525         | 532         | delete; the pre-push hook runs `gspot check --stage push`                                      |
| takeover of existing tool configuration                                                                                        | about 840         | 584         | delete; `init` refuses and lists the files in the way                                          |
| managed blocks in `.gitignore`, `.gitattributes`, and the Cursor rule                                                          | about 60          | part of 147 | delete; keep the `AGENTS.md` block, and write a gitignore file inside `.gspot` instead         |
| ownership log, backups, crash recovery, field merges                                                                           | about 1,800       | 1,977       | replace with about 100 lines: overwrite a file that carries the gspot header, refuse any other |
| the ESLint preview process in `packages/cli/src/native` and the rule differences                                               | about 905         | 664         | delete; `apply --dry-run` shows a byte diff, which `packages/cli/src/lifecycle/drift.ts` does  |
| CI workflow generation                                                                                                         | about 280         | 261         | delete; the docs show a five-line job                                                          |
| file coverage report, with `linguist-languages`                                                                                | about 150         | 262         | delete                                                                                         |
| inline `gspot-ignore` comments and the suppression count, with a 2.1 MB Ruby grammar and no Ruby kit                           | about 400         | 471         | delete; keep `[[ignore]]` in `gspot.toml`                                                      |
| required reasons and setting directions                                                                                        | about 250         | 248         | delete                                                                                         |
| policy error niceties: source locations, suggestions, a JSON schema of known keys                                              | about 300         | 436         | delete; plain zod errors; keep the published schema file                                       |
| four package managers for the private tool project                                                                             | about 850         | 543         | npm only, about 150 lines                                                                      |
| the runtime check of the 51 shipped manifests on every start                                                                   | 266               | part        | run it in a test                                                                               |

### 4.2 Custom analyses and kits

The custom gspot analyses in `packages/cli/src/checks` are 147 files and 12,352 lines. Almost all of them repeat a
real tool or enforce gspot taste. Keep only the framework (dispatch and result, 117 lines), the TypeScript wrapper
(142), `integrity/generated-drift` (19), and the small checks of kits that stay (Svelte 73, GitHub Actions 90).

| Family                                                                                       | Lines       | Covered by                                                                               |
| -------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| `packages/cli/src/checks/bash`                                                               | 1,489       | ShellCheck, jscpd; the rest is taste                                                     |
| `packages/cli/src/checks/naming`                                                             | 1,124       | ESLint `naming-convention` and `id-denylist`, Ruff N8, SwiftLint, all configured already |
| `packages/cli/src/checks/python`                                                             | 869         | basedpyright `reportImportCycles`, Ruff ASYNC and PLR0915, pydoclint                     |
| `packages/cli/src/checks/swift`                                                              | 754         | SwiftLint `type_contents_order`, jscpd                                                   |
| `packages/cli/src/checks/structure`                                                          | 687         | taste                                                                                    |
| postgres and the SQL parser                                                                  | 948         | squawk, sqlfluff                                                                         |
| xcode and xctest                                                                             | 908         | SwiftLint custom rules; the rest is niche                                                |
| static site                                                                                  | 563         | linkinator, html-validate, svgo                                                          |
| docs                                                                                         | 542         | markdownlint, jscpd                                                                      |
| repository                                                                                   | 483         | keep `integrity/generated-drift`                                                         |
| security: CodeQL and its SARIF parser                                                        | 448         | Semgrep                                                                                  |
| dependencies and licenses                                                                    | 457         | the native allow-list flags of the license tools, lockfile-lint                          |
| the rest: sql, html, cloudflare, css, nginx, nextjs, jest, prose, docker, trpc, commit range | about 2,400 | the underlying tools, the Next.js build, commitlint, eslint-plugin-boundaries            |

Kits, 51 today. Keep the tools, not the custom analyses:

| Keep                                                                                                                                                                                                                                           | Delete                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| javascript (with TypeScript ESLint merged in), typescript (tsc), python (Ruff, basedpyright), bash (syntax, ShellCheck, shfmt), swift (SwiftLint, SwiftFormat), sql (sqlfluff), css (stylelint), html (html-validate), markdown (markdownlint) | naming, prose (Vale), structure, duplication, licenses, static-site    |
| formatting (Prettier), secrets (gitleaks), spelling (typos), files (yamllint, Taplo, actionlint, zizmor), dependencies (osv-scanner), docs (lychee), security (Semgrep), commits (commitlint only)                                             | express, fastapi (it repeats Ruff ASYNC exactly), nestjs, react-native |
| react, nextjs (the plugin only), vue, svelte, astro, with one ESLint check for all five                                                                                                                                                        | react-hook-form, zustand, zod, tanstack-query, trpc, i18n, drizzle     |
| docker (hadolint, trivy config, compose config), jest (native coverage threshold), vitest, pytest                                                                                                                                              | cloudflare, supabase, postgres, ansible, nginx, openapi, xcode, xctest |

Inside the kits that stay, delete these checks as well:

- `editorconfig-checker`, which Prettier covers.
- TruffleHog, the gitleaks baseline, `v8r`, and `env-example`.
- The duplicate `plutil` check and CodeQL.
- The placeholder checks `files/json`, `markdown/prettier`, `prose/messages`, and `prose/doc-tags`.
- Three of the four ways of finding copied code; keep jscpd.

Five ESLint checks (JavaScript, TypeScript, Vue, Svelte, Astro) start ESLint five times; make one.

With the custom analyses gone, these dependencies go too: `web-tree-sitter` and seven grammar packages, `libpg-query`,
`postcss`, `postcss-selector-parser`, `entities`, `@formatjs/icu-messageformat-parser`, `spdx-expression-parse`,
`spdx-satisfies`, `scule`, and `linguist-languages`.

### 4.3 Plugin rules that enforce gspot taste

`packages/eslint-plugin` has 25 rules. Keep the four that help a typical user: `no-client-environment`,
`no-duplicate-barrel-exports`, `import-path-style`, and `no-cross-project-imports`. Keep `require-server-only` for
the Next.js kit. Delete these:

| Rule                                                                                                                                                                                                                            | Why                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `import-direction`, `tests-directory-contents`, `env-access-owner`, `types-placement`                                                                                                                                           | encode the folder tree of this repository                                                             |
| `import-layout`, `export-layout`                                                                                                                                                                                                | length sorting                                                                                        |
| `header-comments-before-imports`, `no-import-comments`, `no-index-imports`, `no-exported-alias-constants`, `no-cross-folder-imports`, `registry-instance-only`, `private-before-public`, `no-reexports`, `max-barrel-reexports` | style preferences of gspot                                                                            |
| `no-trivial-functions`, `no-trivial-files`                                                                                                                                                                                      | gspot suppresses the first 192 times in its own code; users need suppressions for React and Nest code |
| `no-export-only-files`                                                                                                                                                                                                          | `no-reexports` already covers it                                                                      |
| `no-reexports-outside-index`                                                                                                                                                                                                    | nothing ever turns it on                                                                              |
| `no-harness-barrel-imports`                                                                                                                                                                                                     | inert in every generated configuration                                                                |

The ESM build is enough for a plugin that needs ESLint 9.38 or newer; delete the CommonJS build `plugin.cjs`.

### 4.4 Machinery that lints this repository

| What                                                                                                                                                                                                | Action                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| the guide linter: `packages/cli/src/agents/lint.ts`, `examples.ts`, `metadata.ts`, 14 constants, `packages/cli/scripts/guides-lint.ts`, and its tests in `tests/unit/cli/agents`                    | delete                             |
| tests that run the guide examples through the generated configuration, such as `tests/integration/tools/guides/bash.test.ts` and `tests/integration/tools/bash/example.test.ts`                     | delete                             |
| the `guides/lint` and `tests/unit` checks in `gspot.toml`                                                                                                                                           | delete; CI runs the tests directly |
| the `[architecture]` table, 19 `naming.contract_properties`, the `[structure]` exemptions, and the `[[ignore]]` entries for `jest/coverage`, `no-trivial-functions`, `require-exports`, and the CSV | delete with the checks they serve  |
| the `jest` kit in the kit list of this repository, which runs Bun tests                                                                                                                             | delete                             |
| `testToolsText` in `packages/cli/src/generation/tools/mise.ts`                                                                                                                                      | move to the tool pin script        |
| the tasks `gspot`, `check`, `doctor`, and `guides:lint`                                                                                                                                             | one `gspot` task                   |

### 4.5 Dead code, migrations, and suppressions in code that stays

- 36 exports used only inside their own file; drop `export`. Knip misses them because of `ignoreExportsUsedInFile`.
- 49 exports used only by tests. `setEnvironmentVariable` in `packages/cli/src/platform/environment.ts` and
  `appendEntry` in `packages/cli/src/policy/write.ts` are called nowhere.
- `packages/cli/src/execution/report.ts`: zod schemas that never parse.
- Migration code, which an unreleased product does not need: `packages/cli/src/lifecycle/ownership/log.ts:183`,
  `LIFECYCLE_PRIVATE_PATH` in `packages/cli/src/config/platform.ts`, npm lockfile version 1, and pnpm version 5 and 6
  keys in `packages/cli/src/repository/locked-packages.ts`, binary `bun.lockb`, `CACHE_FORMAT = 5`, and the policy
  version gate in `packages/cli/src/policy/read.ts`.
- Ticket numbers such as K-93 in comments, for example `packages/cli/src/kits/schema.ts:164`.
- 122 `gspot/no-trivial-functions` suppressions in `packages/cli` go with the rule; inline the wrappers they hide.

### 4.6 Repository files

| What                                                                                                                                                | Action                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `architecture`                                                                                                                                      | delete (section 2)                             |
| root `dist`, `.ansible`, `.ruff_cache`, and 19 empty folders under `tests`                                                                          | delete                                         |
| `CLAUDE.md`, identical to `AGENTS.md`                                                                                                               | delete if every agent in use reads `AGENTS.md` |
| `docs/src/content/docs/guides/build.md`, contributor content in the user site                                                                       | move into `CONTRIBUTING.md`                    |
| `docs/README.md` beyond the asset license notices                                                                                                   | delete                                         |
| 23 unused files in `docs/public` (about 2.3 MB), such as `docs/public/brand/home/hero.png` and the twelve files in `docs/public/brand/readme/tools` | delete                                         |
| the generated configuration page (a 260 KB schema dump), the engines page, and the 210 pages with one check each                                    | delete; the kit pages list the checks          |
| the custom homepage with the example twice, and the Starlight overrides for header, footer, theme, and search                                       | a Starlight splash page; show the example once |
| `docs/src/route-metadata.ts`, `docs/scripts/verify-release.ts`, `docs/src/content/revision.ts`, and `docs/src/components/home/bash-syntax.json`     | delete                                         |
| the `[test]` section of `bunfig.toml`, which `tests/bunfig.toml` repeats                                                                            | delete                                         |
| pins in `.mise/conf.d/test-tools.toml` that repeat `.mise/conf.d/gspot-tools.toml`                                                                  | keep only the 8 extra pins                     |
| stale `.gitignore` lines for the root `dist` and the generated reference folder of the docs                                                         | delete                                         |

## 5. What stays, cleaned

### 5.1 Layers and folder cycles

No file imports itself through a chain of value imports, and the base layer imports nothing above it. Nine folder pairs
import each other today. The deletions remove five of them: agents with policy (the guide linter), kits with
repository (takeover), lifecycle with repository and repository with tools (snapshots), and checks with policy
(naming). Fix the four that remain:

| Pair                     | Fix                                                                                                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| checks and execution     | move the finding model out of `packages/cli/src/checks/result.ts`; one registry of analyses instead of `packages/cli/src/checks/dispatch.ts`, 16 `analyses.ts` files, and two maps in `packages/cli/src/execution/engines.ts` |
| kits and policy          | move the shared schemas below both                                                                                                                                                                                            |
| lifecycle and tools      | move the `gspot install` steps from `packages/cli/src/tools/installation.ts` to the install command                                                                                                                           |
| generation and lifecycle | move `packages/cli/src/lifecycle/managed-blocks.ts` below both                                                                                                                                                                |

Also split `packages/cli/src/repository/tracked.ts` (71 importers, of which 52 want only `readSource`), move the
commander helpers out of `packages/cli/src/platform/arguments.ts`, and merge `packages/cli/src/repository/hooks.ts`
and `packages/cli/src/policy/runner.ts` into `packages/cli/src/policy/schema.ts`.

### 5.2 Duplicates to merge

| What                                                                                          | Copies   | Merge into                                               |
| --------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------- |
| open a root, try, close                                                                       | 58       | `Symbol.dispose` on `Root`, `using`, and `readText`      |
| check that bytes are UTF-8                                                                    | 13       | `isUtf8` from `node:buffer`                              |
| parse JSON with comments                                                                      | 5        | `packages/cli/src/repository/jsonc.ts`                   |
| get a value by dotted path                                                                    | 6        | one helper                                               |
| is it a plain object                                                                          | 7        | one helper                                               |
| forward slashes, basename, inside a root, inside a scope                                      | about 60 | `toPosix`, `posix.basename`, one `isInside`, `isInScope` |
| directory walkers                                                                             | 8        | one walker                                               |
| run git                                                                                       | about 10 | one git module with one timeout                          |
| `run` and `runBinary` in `packages/cli/src/platform/spawn.ts`                                 | 2        | one function with an encoding option                     |
| sha256 hex                                                                                    | 12       | one helper                                               |
| temporary folder and cleanup                                                                  | 17       | one disposable helper                                    |
| lockfile tables, extension tables, and test-file definitions (which disagree today)           | about 17 | one table each                                           |
| exit code 2 under six names, the `.gspot` literal about 86 times, 1000, 1024, 100, file modes | many     | one constant each                                        |

### 5.3 Libraries for hand-written code that stays

| Hand-written                                                              | Replacement                                  |
| ------------------------------------------------------------------------- | -------------------------------------------- |
| the glob walker `globPaths` in `packages/cli/src/platform/paths.ts`       | `tinyglobby`                                 |
| the JSON layout in `packages/cli/src/generation/json-format.ts`           | Prettier, already a tool                     |
| cache home and CI detection in `packages/cli/src/platform/environment.ts` | `env-paths`, `std-env`                       |
| typed commander flags in `packages/cli/src/platform/arguments.ts`         | `@commander-js/extra-typings`                |
| `packages/cli/src/platform/code-points.ts`                                | `Array.from`                                 |
| smol-toml beside toml-patch                                               | smol-toml alone, once the policy writer goes |

The TOML layout code in `packages/cli/src/policy/toml` and the string-built GitHub workflow need no library: they go
with `set` and with CI generation.

### 5.4 Naming

- **Agent rules.** One name, rules: the folder, the policy table, the flag, the installed folder, the source folder
  `packages/cli/src/agents`, and the identifiers.
- **Other meanings of rules.** The rule differences in `packages/cli/src/lifecycle/rules` go with the preview
  process, and the Bash ast-grep folder goes with the Bash analyses.
- **Verbs.** `packages/cli/guides/general/code/NAMING.md` says `get`, `parse`, `build`, `assert`, and `is` or `has`.
  The code has 33 `read*` functions, 51 ending in `Of`, and 34 ending in `For`. Rename the code to the guide.
- **One word per concept.** Directory, not folder (38 against 60). `paths` for strings, `trackedFiles` for tracked
  files, and a separate name for the root handle, which is `files` in 107 places today.
- **Misleading names.** `buildFolder` is the Swift cache, `afterWrite` is an atomic write, `privateTarget` and
  `mutationTarget` are assertions, `head` reads a prefix, and `o` means options in 10 command functions.
- **Repeated names.** `hooks.ts` 3 times, `log.ts` twice, `report.ts` 3 times; `directoryOf`, `kindOf`, `isOwned`,
  `styleFiles`, and `readProject` each mean two different things.

## 6. Tests

With the deletions above, about a third of the test lines go with the code they test. Of the rest:

| Test or folder                                                                                                                                                   | Problem                                                                            | Action                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `tests/integration/repository`                                                                                                                                   | tests the test harness, the grammar script, and a generated file                   | delete the folder                                                      |
| `tests/integration/docs`                                                                                                                                         | checks page text, the link script, and the release script; runs 4 times per CI run | delete; keep the docs build in CI                                      |
| `tests/inputs` (37 files)                                                                                                                                        | a second copy of the test tree; 18 files have one importer                         | put values back into their tests, and shared ones into `tests/support` |
| `tests/types` (12 files)                                                                                                                                         | exists only because of `types_directory`                                           | put each type next to its user                                         |
| `tests/unit/cli/policy/messages.test.ts`                                                                                                                         | checks the wording of every message builder                                        | delete                                                                 |
| `tests/integration/cli/completion.test.ts`                                                                                                                       | lists every command and flag, which commander builds                               | goes with `completion`                                                 |
| `tests/integration/tools/flags.test.ts`                                                                                                                          | matches every manifest flag against help text, in the repository root              | delete; it creates `.ansible`                                          |
| `tests/acceptance/package/pins.test.ts`                                                                                                                          | one network call per pin                                                           | a scheduled job, or delete                                             |
| `tests/acceptance/source/cli/lifecycle/performance.test.ts`                                                                                                      | wall-clock limits on shared runners; it failed in CI                               | a manual benchmark                                                     |
| `tests/acceptance/source/kits/static-site.test.ts` (494 s) and `tests/acceptance/source/kits/codeql.test.ts` (279 s)                                             | their kits go                                                                      | delete                                                                 |
| `tests/acceptance/source/kits/nextjs/selection.test.ts` (271 s), `tests/acceptance/source/kits/react.test.ts`, `tests/acceptance/source/kits/components.test.ts` | one planted defect per third-party rule                                            | one case per framework                                                 |
| `tests/acceptance/source/kits/python/docstrings.test.ts` (105 s)                                                                                                 | repeats `tests/unit/cli/checks/python/docstrings.test.ts`                          | one case                                                               |
| `tests/acceptance/source/cli/uninstall.test.ts`                                                                                                                  | goes with `uninstall`                                                              | delete                                                                 |
| the two `parameter-limits.test.ts` files                                                                                                                         | the same test in two tiers                                                         | one                                                                    |
| init arguments written four ways, timeouts in 8 files, the repository root computed 12 times, and `run` clashing with the CLI `run`                              | sprawl in `tests/support`                                                          | one of each; rename the test `run` to `runGspot`                       |
| the scripts `tests/support/acceptance.ts`, `tests/support/package/run.ts`, `tests/support/registry/workspace-command.ts`, and `tests/support/cli/swiftformat.ts` | tasks, not helpers                                                                 | a root scripts folder                                                  |

## 7. CI and tasks

| What                                                                                                                                           | Action                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| the `docs` job runs `test:docs`, which `test` already runs on 3 systems                                                                        | keep only `docs:build`           |
| the release runs `test:package` again after CI ran it                                                                                          | delete the second run            |
| `actions/cache` copied into 4 jobs                                                                                                             | one composite step               |
| the Windows unit job and 6 Windows shards                                                                                                      | delete with Windows support      |
| the `check` job lints commit messages back to the first commit, 4 times, 6 to 8 minutes each                                                   | goes with the commit range check |
| `site.yml`: the `source_ref` input, `site:verify-release`, `site:record-source`, the extra artifact, and a concurrency group that never queues | delete; build the tag and deploy |
| the tasks `test:unit`, `test:integration`, `test:docs`, and `test:bash-example`                                                                | delete                           |
| the task `docs:check-links`                                                                                                                    | fold into `docs:build`           |
| the task `repo:setup` runs the grammar script inline                                                                                           | goes with tree-sitter            |

## 8. Order of work

| Stage | What                                                                                               | Size                              |
| ----- | -------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1     | The owner answers the five questions in section 1                                                  | none                              |
| 2     | Delete commands and features (4.1), the custom analyses and kits (4.2), and their tests            | about 25,000 source lines         |
| 3     | Delete the taste rules and defaults (2 and 4.3) and the machinery that lints this repository (4.4) | about 3,000 lines                 |
| 4     | Delete repository files, docs extras, and CI parts (4.6 and 7)                                     | about 1.5 GB on disk, 9,000 lines |
| 5     | Rename: rules, package names, verbs, one word per concept (2 and 5.4)                              | hundreds of files                 |
| 6     | Move constants and types to their users; fix the four remaining folder cycles (5.1)                | about 60 files moved              |
| 7     | Merge duplicates and adopt libraries (5.2 and 5.3); fix the bugs (3)                               | about 1,000 lines saved           |
| 8     | Clean the remaining tests (6)                                                                      | about 3,000 test lines            |
