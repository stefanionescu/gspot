# The files gspot writes into this repository

gspot runs on its own code, so like any user repository this one holds gspot's output: the `.gspot/` folder (tool
files, rules, hooks, the tool projects and their lockfiles, the version pin), the mise file for the program tools,
pointers and other generated files at the root, and the managed block of `AGENTS.md`. `gspot apply` writes them from
`gspot.toml`; `gspot install` writes the lockfiles and the installed tool folders and points Git's `core.hooksPath` at
`.gspot/hooks`. Today nothing is hand-edited (`gspot apply --dry-run` reproduces every file), but the output carries
copies, dead files, rules that contradict each other, a lock entry nobody can install, and tools a developer never
runs. The target is the layout below.

## Layout

```text
.gspot/                       committed, except the four ignored folders
  version                     the gspot version this repository uses
  mise.toml                   the program tools (no gspot, no Node; only the tools of checks a developer runs)
  config/                     one tool file per tool; a scope gets its own copy only when it differs (GEN-006)
    vale.ini                  one Vale config, at the root
    vale/styles/LICENSES.md   the license notice of the adapted Vale styles (CFG-002)
    vale/styles/gspot/        the gspot style, without the copied and contradicting rules (CFG-005, IGN-002)
  rules/                      the Markdown rules (no Python rules once Python is no longer selected, THR-001)
  hooks/                      pre-commit, pre-push, commit-msg
  package.json, bun.lock      the ESLint plugin comes from npm (GEN-002); basedpyright installs here (GEN-013)
  pyproject.toml, uv.lock     the Python tools, with a pinned Python version (GEN-015)
  node_modules/, .venv/, vale/, state/   ignored; the package managers write them in place
```

No file inside `.gspot/` carries a generated-file header (GEN-017).

## Findings

### GEN-002: The committed `.gspot/bun.lock` locks the in-repository ESLint plugin by the hash of a locally packed file

- Where: `.gspot/bun.lock:196`, `.gspot/package.json:11`, `mise.toml:16-18` (`install:checks`), `scripts/plugin.ts`,
  `.github/workflows/ci.yml:35-41`, `.github/workflows/gspot.yml:40`, `packages/cli/src/tools/npm/lockfiles.ts:105-121`
- Kind: fix-bug
- Problem: `.gspot/package.json` asks for `@gspothq/eslint-plugin` `0.1.0`. This repository fills the lock by packing
  the workspace plugin, serving it from a local registry, and stripping the registry address, so the lock claims "0.1.0
  from the public registry" with the hash of a local file: across the last 40 commits that touched the lock, the entry
  had 25 different `sha512` hashes at the same version. 0.1.0 is not on npm, so the generated `gspot.yml` workflow fails
  at `gspot install` on every push (`GET .../eslint-plugin-0.1.0.tgz - 404`). The CI step "Verify the committed tool
  lockfiles" works out every package version again, so it also fails whenever any of the roughly 1,000 locked packages
  publishes a release inside an allowed range.
- Fix: Until the first publish, turn this repository's generated gspot CI off by removing its `[ci]` table; nothing
  but a publish fixes the 404. At the first publish, publish `@gspothq/cli` and `@gspothq/eslint-plugin` 0.1.0, relock
  `.gspot/bun.lock` against npm, and turn the CI back on with `gspot set ci.enabled true`. Then run this repository on
  the release: pin `node` and `npm:@gspothq/cli@0.1.0` in `mise.toml`; delete the launchers `scripts/gspot` and `scripts/gspot.cmd`, `disable_tools`, `[env] _.path`, the `install:checks` task with the install part of `scripts/plugin.ts` that packs the workspace plugin into a local registry (both stay until this step, step 11 of the order of work, as a workaround for the unpublished plugin; step 4 deletes only the test-runner part of `scripts/plugin.ts`, SCR-003), and the "Install the repository
  checks" and "Verify the committed tool lockfiles" steps of `ci.yml`; run `gspot apply`; commit. This repository then
  lints with the released plugin like any user, and the workspace plugin is tested only by its unit tests. The
  trade-off: a change to a plugin lint rule reaches this repository's own lint only after a plugin release.
- Size: medium

### GEN-006: 22 per-scope tool files are byte-identical copies of the root file

- Where: `.gspot/config/{docs,packages/cli,packages/eslint-plugin,tests}/` (`typos.toml` x4, `semgrep/javascript.yml`
  x4, `vale/styles/gspot/banned-headings.yml` x4, `lychee.toml` x3, `markdownlint.jsonc` x3, `markdownlint-cli2.mjs` x3,
  `yamllint.yml` x1); pointers `docs/.markdownlint-cli2.mjs`, `packages/cli/.markdownlint-cli2.mjs`,
  `packages/eslint-plugin/.markdownlint-cli2.mjs`; `packages/cli/src/generation/tool-files.ts:57-100`,
  `packages/cli/src/repository/paths/public.ts:195-200`
- Kind: merge
- Problem: A tool file marked `per_scope` is written once for every scope, even when its content is the same as the
  root file. No scope here changes any of these settings, so the copies only add files, diffs and review noise; the
  allowed words alone are written into 9 files. The generator already skips an identical copy for one file only
  (`.semgrepignore`, `tool-files.ts:85-89`).
- Fix: In `emitToolFile`, skip a per-scope file whose content equals the root file (and its pointer), for every tool,
  and delete the `.semgrepignore` special case. Skip files that read each other only as a group:
  `markdownlint-cli2.mjs` reads `./markdownlint.jsonc` beside itself, so it is skipped only when the scope's
  `markdownlint.jsonc` is skipped too. `targetInScope` is a pure path function with about 10 callers, so the "use the
  root file" rule lives in it (it returns the root target when the scope copy is not in the generated list). The Vale
  scope config and its style copy go whole (CFG-003).
- Size: medium

### GEN-008: The `.gitignore` block still lists the old Vale package folders, including two packages gspot no longer ships

- Where: `.gitignore:32-40`, `packages/cli/configurations/general/prose/manifest.toml:2-12` (`ignored`),
  `packages/cli/src/parsers/schema/configurations.ts:218,255`, `packages/cli/src/generation/public.ts:149-156`,
  `packages/cli/src/repository/public.ts:179-189`, `packages/cli/src/config/repository/inventory.ts:52-53`,
  `tests/cli/generation/managed-ignores.test.ts:53-94`
- Kind: delete
- Problem: Vale packages install into `.gspot/vale/`, but the prose manifest still asks Git to ignore nine paths under
  `.gspot/config/vale/styles/`, among them `Microsoft/` and `RedHat/`, which gspot stopped shipping in the same commit.
  The code that treats files under the old folder as packages is a leftover too, and the `ignored` manifest field
  exists only for this list.
- Fix: First delete the old local folders (GEN-028): once the nine lines go, Git would show their 740 files as new
  files. Then delete the `ignored` list from the prose manifest, the `ignored` schema field and `isIgnoredPath`, the
  manifest part of `gitignoreBlock` (keep the four installed tool folders and `.gspot/state/`), the second branch of
  `isValePackageFile`, `VALE_OWN_PREFIXES`, and the test "manifest-owned tool directories are ignored ...". Run
  `gspot apply` to drop the nine lines.
- Size: small

### GEN-009: `.gspot/config/prettierignore` is a byte-identical copy of `.prettierignore`

- Where: `.gspot/config/prettierignore`, `.prettierignore`, `packages/cli/configurations/general/format/manifest.toml:50-58,67-70`
- Kind: merge
- Problem: The format manifest writes the same source twice when JavaScript is selected. The check reads one copy;
  editors read the other.
- Fix: Write one file, `.prettierignore`, whenever Prettier is used: delete the `.gspot/config/prettierignore`
  `[[tool_file]]` and the `when = { configuration = "javascript" }` line of the `.prettierignore` entry, and point
  `ignore_file`, `command` and `fix` at the literal `.prettierignore` (a `{tool_file:...}` placeholder cannot name a
  dot file outside `.gspot/config/`). Update `tests/cli/generation/formatting.test.ts:256-266`,
  `tests/cli/planning/format-inputs.test.ts:41-55` and `tests/cli/planning/selection.test.ts:121-127`. The trade-off: a
  repository without JavaScript also gets a root `.prettierignore`, which its editor reads too.
- Size: small

### GEN-011: The managed block in `AGENTS.md` carries product text, a wrong label and duplicate entries

- Where: `AGENTS.md:3-12`, `packages/cli/src/agent-rules/contracts.ts:9-56` (`managedBlock`, `rulesByArea`),
  `packages/cli/src/config/configurations.ts:25` (`CONFIGURATION_LABELS`), `packages/cli/src/config/policy/settings.ts:77-83`
- Kind: rewrite-text
- Problem: An agent reads this block first. It holds two sentences about the levels (`LEVEL_SUMMARY`,
  `ALL_LEVEL_SUMMARY`, the schema text for `level`) that an agent cannot act on, labels the `general/` rules
  "Repository:", lists `WORKING.md` and `WRITING.md` twice (once in "Read ... first", once in the list), and says "These
  rules apply only at level `all`" about lint rules while the rest of the block uses "rules" for the Markdown files.
- Fix: In `managedBlock`, replace the two level sentences with one line, ``Level: `all`.``, and say "lint rules" where
  linters are meant. Change the label to `General`. Skip the `FIRST_READ` files in `rulesByArea`. Keep `LEVEL_SUMMARY` for the settings schema only (LIF-046).
- Size: small

### GEN-013: basedpyright from PyPI installs a second, older Node.js (199 MB)

- Where: `.gspot/pyproject.toml:5`, `packages/cli/configurations/language/python/manifest.toml:50-56`
- Kind: simplify
- Problem: The PyPI package of basedpyright depends on `nodejs-wheel-binaries`, a full Node.js (199 MB here, version
  24.19.0). Every repository that uses gspot already has Node and an npm tool project, and basedpyright is published
  on npm too.
- Fix: In the Python manifest, install basedpyright from npm (`npm = "basedpyright"`, version `1.40.1`) and delete
  `pypi = "basedpyright"` and `mise = "pipx:basedpyright"`. It then lives in `.gspot/package.json`. Check first that npm
  has basedpyright 1.40.1.
- Size: small

### GEN-015: The Python tools run on whatever Python the machine has

- Where: `packages/cli/src/config/tools/python.ts:3` (`UV_VENV_ARGUMENTS`), `.gspot/.venv/pyvenv.cfg`,
  `.gspot/pyproject.toml:4`, `packages/cli/src/tools/python/public.ts:67` (`--no-python-downloads`)
- Kind: fix-bug
- Problem: Every Python tool is pinned to an exact version, but the interpreter is not: `uv venv` runs without
  `--python`, so each machine builds `.venv` on its own Python (here `/opt/miniconda3/bin`, Python 3.12.2), and
  `requires-python = ">=3.11"` is only a floor. gspot's own dependency rule says the runtime is pinned once.
- Fix: Pin the exact Python version in the Python tool project and let uv install it, like every other pinned tool:
  pass `--python <version>` to `uv venv` and drop `--no-python-downloads`.
- Size: small

### GEN-016: Word lists in the Vale rules are unreadable and partly duplicated

- Where: `.gspot/config/vale/styles/gspot/heading-case.yml`, `title-case.yml`, `possessives.yml`, `banned-headings.yml`;
  their sources `heading-case.yml.eta:89-91`, `title-case.yml.eta:10-12`, `possessives.yml.eta:6`,
  `banned-headings.yml.eta:8`
- Kind: simplify
- Problem: The sources pass each word through `RegExp.escape`, which turns the first letter into a hex code: a reader
  sees `\x41SCII` for `ASCII` and `\x70roject\x20structure` for "project structure". `heading-case.yml` lists 12 words
  twice (plain and escaped), and `possessives.yml` holds one 2,474-character line of hex escapes.
- Fix: In the Vale style builder, escape only regular-expression symbols
  (`word.replaceAll(/[.*+?^${}()|[\]\\/-]/g, '\\$&')`; Go regular expressions accept a backslash before any
  punctuation), and drop words that are already in the built-in exception list. Allowed words are plain words
  (IGN-034).
- Size: small

### GEN-017: The gspot version is written into every generated file, and twice more besides

- Where: 49 generated files under `.gspot/` with `Generated by gspot 0.1.0 from gspot.toml. Regenerate: gspot apply.`,
  the pointers outside `.gspot/`, `.gspot/version`, `packages/cli/src/config/generation/headers.ts:7`,
  `packages/cli/src/generation/documents/contracts.ts:236` (`_gspot` JSON key),
  `packages/cli/src/config/parsers/generated-header.ts:3` (`GENERATED_HEADER_LINE`)
- Kind: simplify
- Problem: A gspot upgrade rewrites every generated file only to change `0.1.0` in its header, and the version also
  sits in `.gspot/version`. Inside `.gspot/` the header proves nothing: the folder and the `gspot/generated-files`
  check already mark the files as generated, and 78 of the 127 tracked non-rule files have no header anyway (Vale
  rules, JSON files; `tsconfig.json` uses a fake `_gspot` key).
- Fix: Write no header inside `.gspot/` (`.gspot/mise.toml` included), and delete the `_gspot` key and the
  `generated_header` setting. Outside `.gspot/`, write the header without a version: `Generated by gspot from gspot.toml. To change it, edit gspot.toml and run gspot apply.` Change `GENERATED_HEADER_LINE` in the same change to
  match that text: it matches only `Generated by gspot <digit>` today, and `hasHeader` and `gspot doctor` use it to
  class files as generated.
- Size: medium

### GEN-018: The generated `tsconfig.json` files repeat options the `typescript/tsconfig` check already requires

- Where: `.gspot/config/tsconfig.json` and 4 scope copies, `packages/cli/src/generation/tsconfig.ts:16-62`,
  `packages/cli/configurations/language/typescript/manifest.toml:60-89`
- Kind: simplify
- Problem: When a project has its own `tsconfig.json`, gspot writes an overlay that extends it and sets seven strict
  options, which the `typescript/tsconfig` check already requires in your own file. So either the overlay adds nothing
  or the check fails anyway. And `tsc` never reads the committed overlays: `runTsc` builds its own file at run time in a
  scratch folder and runs `tsc -p` on that. Only `svelte-check --tsconfig` reads the committed file.
- Fix: Delete the `.gspot/config/tsconfig.json` `[[tool_file]]` (and its five files here) and the tests that pin it
  (`tests/cli/generation/typescript.test.ts:43`; TPR-026 deletes `tests/cli/repository/aliases.test.ts:82-102`). Give
  `svelte-check` the same run-time file that `runTsc` builds. Keep that run-time file: besides the strict options, it
  adds `typeRoots` when gspot checks a scratch copy of staged files, and lists the source files of a scope that has no
  `tsconfig.json`.
- Size: medium

### GEN-019: The generated ESLint config repeats the same blocks per scope and names a missing file

- Where: `.gspot/config/eslint.config.mjs` (1,521 lines, 248 KB; architecture blocks at `:300, 497, 694, 891, 1088`,
  file extensions `:204-272`, environment `:1440-1460`, gspot structural rules `:1474-1497`); sources
  `packages/cli/src/generation/eslint/boundaries.ts:93-135`, `packages/cli/src/generation/eslint/contracts.ts:91-138, 238-264`,
  `packages/cli/configurations/language/javascript/eslint.config.mjs.eta:1,338,359`,
  `packages/cli/configurations/language/typescript/eslint.fragment.js.eta:5`
- Kind: simplify
- Problem: The file is 248 KB because most blocks are written once per scope: the 195-line `boundaries` settings block
  appears 5 times and differs only in the scope folder of two patterns (`**/*` against `docs/**/*`), and the
  `n/file-extension-in-import`, environment, and typescript-eslint blocks appear 5 times each. About 900 of the 1,521
  lines repeat, although every scope here takes the root settings unchanged. 18 blocks have empty `rules` and change
  nothing. The TypeScript import settings list `tests/tsconfig.json`, which does not exist, because the list is built
  as `${scope.path}/tsconfig.json` for every scope. Globs are written as compiled regular expressions (353 fragments)
  that no reader can check.
- Fix: Write the `boundaries` block once, with patterns that cover every scope, and check that
  eslint-plugin-boundaries still sorts files into the right elements. In `importStyleBlocks` and
  `structuralRuleBlocks`, emit a block for a nested scope only when its settings differ from its parent scope;
  otherwise the root block (files `**/*`) covers it. Skip a block whose `rules` object is empty. Build the TypeScript
  project list from the `tsconfig.json` files the repository has. Write globs as globs, not compiled regular
  expressions.
- Size: medium

### GEN-021: The tool-project files carry an invented version format and fields nobody reads

- Where: `.gspot/package.json:5`, `.gspot/pyproject.toml:7`, `packages/cli/src/generation/public.ts:262`,
  `packages/cli/src/parsers/packages/contracts.ts:63-69,156-158`, `packages/cli/src/tools/npm/contracts.ts:73`,
  `packages/cli/src/tools/npm/public.ts:166-168`
- Kind: simplify
- Problem: `.gspot/package.json` says `"packageManager": "bun@1.x"`. The standard field takes an exact version, gspot
  itself tells users that the tool project needs an exact version, and gspot's own Vale rule `version-range.yml` bans
  `1.x`. The format needs its own parser branch (`/^\d+\.x$/`) and a `replace('.x', '.0.0')`. Also, `"type": "module"`
  has no effect (no `.js` file in `.gspot/config/`), and `pyproject.toml` has an empty `[tool]` table. The root
  `package.json` already declares `"packageManager": "bun@1.4.2"`, and the lockfile name says which package manager
  made it.
- Fix: Drop `packageManager` from the generated `package.json` and read the package manager from the lockfile name and
  the root declaration. Delete the `N.x` branch in `installerVersion`, the replace in `getPackageInstallerMajor` (use
  the real version of the package manager), and `recordedInstaller` with its use; a repository whose root declares no
  package manager then detects it again on each run, and the major-version check compares with the installed package
  manager. Drop `"type": "module"`. Write `[tool.uv]` without the empty `[tool]` header.
- Size: small

### GEN-022: The docs do not say why the generated files under `.gspot/` are committed

- Where: `.gspot/config/` (119 files), `.gspot/hooks/`, `.gspot/package.json`, `.gspot/pyproject.toml`,
  `.gspot/version`; `docs/src/content/docs/guides/generated-files.md` ("What to commit")
- Kind: rewrite-text
- Problem: These files are rebuilt exactly from `gspot.toml`, the gspot version and the repository's own files, so
  committing them costs churn (70 of the 329 Codex commits touched `.gspot/`, about 18,000 changed lines). They stay
  committed, but the docs page does not give the reason.
- Fix: Keep committing them, and say why on the "What to commit" page: editors and coding agents need the tool files
  and rules right after a clone, before anyone runs `gspot install`.
- Size: small

### GEN-023: Some generated files hold only default values or template leftovers

- Where: `.gspot/config/gitleaks.toml` (`[extend] useDefault = true`), `.gspot/config/lychee.toml` and 3 scope copies
  (`exclude = []`), `.gspot/config/docs/purgecss.config.mjs:4` (`...[]`), `.gspot/config/docs/stylelint.json`
  (`"overrides": []`), `.gspot/config/eslint.config.mjs:7-19` (blank import lines), `.gspot/config/prettierignore` (two
  blank lines)
- Kind: simplify
- Problem: A file with only defaults tells the tool nothing it did not already do, and loops in the sources leave empty
  spreads and blank lines that a reader has to skip.
- Fix: In the tool file sources, omit empty lists and spreads and trim the blank lines of conditional imports. Keep
  `gitleaks.toml`: the gitleaks check passes `{tool_file:gitleaks}`, and the file stops gitleaks from reading a stray
  `.gitleaks.toml` of the user. Write `lychee.toml` only when it holds entries, unless the check needs its path.
- Size: small

### GEN-024: Vale settings mix two path bases without saying why

- Where: `.gspot/config/vale.ini:2-3`, `packages/cli/configurations/general/prose/vale.ini.eta:50-56`,
  `tests/cli/generation/vale.test.ts:144-145`
- Kind: rewrite-text
- Problem: `StylesPath = ../vale` is relative to the settings file, while `StylesPath = .gspot/config/vale/styles` is
  relative to the repository root (Vale runs with the root as working folder). At level `recommended` the source uses
  `vale/styles` instead. A reader cannot tell which base each line uses, and a test pins both forms.
- Fix: Use one base for every `StylesPath` line (relative to the file, built with `relative(dirname(targetPath), ...)`) and add one comment that Vale reads several `StylesPath` lines in order. Do after CFG-003, which leaves only
  the root `vale.ini`.
- Size: small

### GEN-026: The local ownership log is 5 MB, half of it a copy of every ESLint lint rule

- Where: `.gspot/state/ownership.json` (ignored), `packages/cli/src/lifecycle/public.ts:250-257`
- Kind: delete
- Problem: After each apply, gspot saves the value of every captured lint rule so that `apply --dry-run` can list rule
  changes. For ESLint that is 2.58 MB of the 2.6 MB `rules` table; the file is 5 MB.
- Fix: Delete the per-rule copy in the ownership log and the rule-level dry-run report; `apply --dry-run` shows the
  file diff.
- Size: small

### GEN-028: Old Vale package folders and empty configuration folders remain on this machine

- Where: `.gspot/config/vale/styles/{Google,Harper,Microsoft,RedHat,alex,proselint,write-good,.vale-config}`,
  `.gspot/config/vale/styles/config/dictionaries`, 12 empty folders under `packages/cli/configurations/tool/` (with 9
  empty `rules/` folders inside), `packages/cli/configurations/library/i18n/rules`,
  `packages/cli/configurations/general/site/rules`
- Kind: delete
- Problem: These are not tracked, so Git does not show them, but they confuse anyone who looks at the folders. The old
  Vale folders are 5.3 MB (740 files, dated 2026-09-30) and are still treated as packages by the leftover code of
  GEN-008.
- Fix: Delete them locally once (`rm -rf` of the listed paths), before GEN-008 drops the `.gitignore` lines. INS-047
  lists the other empty folders of the repository.
- Size: small

### GEN-029: "Never edit files under `.gspot/`" misses the generated files outside `.gspot/`

- Where: `AGENTS.md:78`, `packages/cli/src/config/agent-rules.ts:4-5` (`CHECKS_INSTALLED`)
- Kind: rewrite-text
- Problem: gspot also writes `eslint.config.mjs`, `prettier.config.mjs`, `.prettierignore`, `.semgrepignore`,
  `.editorconfig`, the `.markdownlint-cli2.mjs` pointers, `tests/ruff.toml`, `tests/pyrightconfig.json`,
  `docs/.stylelintrc.json` and `.github/workflows/gspot.yml`, and it writes keys into `bunfig.toml`. The instruction
  names only `.gspot/`, so an agent may edit those files. Four of them carry no generated-file header, so a rule based
  on the header line would miss them.
- Fix: Let `managedBlock` name the generated files outside `.gspot/`, from the list the generator already has, for
  example: "Never edit files under `.gspot/`, or these generated files: `eslint.config.mjs`, `prettier.config.mjs`,
  ... Change `gspot.toml` and run `gspot apply` instead."
- Size: small

### GEN-030: A failed `mise trust` or `mise install` hides mise's own error and blames the package manager

- Where: `packages/cli/src/lifecycle/install/public.ts:131-139` (the mise step), `packages/cli/src/tools/contracts.ts:392`
  (`installationDiagnostics`)
- Kind: fix-bug
- Problem: When `gspot install` runs `mise trust` or `mise install` and the command fails, gspot prints only "The
  installation command mise install failed (exit N): check the package manager and registry settings." mise's own
  output is dropped, and the hint names the wrong tool, so a user whose mise is too old or whose mise file has a bad
  line never sees mise's real message. The Vale and package-manager steps already add the output through
  `installationDiagnostics(result, credentials)`, which also hides secrets.
- Fix: Add `installationDiagnostics(result, [])` to the message and name mise: "The command mise install failed (exit
  N):\n<mise output>". Do it in the same commit in which the generator stops writing `min_version` and the install
  check stops refusing an older mise (INS-001).
- Size: small
