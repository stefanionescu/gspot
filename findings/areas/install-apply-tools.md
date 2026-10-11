# Install, apply, ownership, planning, tools, and rules

This part of the CLI decides which configurations a repository uses, plans which checks run on which files, finds and
installs the tools, writes the generated files and keeps the ownership log (the record of every file gspot wrote, so
it never overwrites a hand edit), and builds the managed block of `AGENTS.md` from the rules. Today it lives in
`src/agent-rules/`, `src/configurations/`, `src/lifecycle/`, `src/planning/`, and `src/tools/`. The target splits
`lifecycle/` into `apply/`, `install/`, and `ownership/`, installs the tools straight into `.gspot/` with no copy,
runs the checks of the shipped manifests at build time instead of on every start, and gives every file a name that
says what it holds.

## Findings

### LIF-001: `gspot install` reads every installed tool file into memory and copies it file by file

- Where: `packages/cli/src/lifecycle/ownership/state/public.ts:52-177` (`installedFile`, `readInstalledTree`, `installTree`), `packages/cli/src/lifecycle/install/public.ts:273-302` (`context.trees`), `packages/cli/src/tools/contracts.ts:313`, `packages/cli/src/lifecycle/install/contracts.ts:150`, `packages/cli/src/types/tools/install.ts:32-39` (`InstalledFile`, `ToolOwner.installTree`), `packages/cli/src/types/lifecycle/ownership.ts:44-45`
- Kind: simplify
- Problem: `gspot install` runs the package manager in an OS temp folder. Then it reads every installed file into
  memory (`readInstalledTree` calls `readFileSync` for each file, `state/public.ts:73`), keeps all of them until every
  install step ends (`context.trees`), writes them into `.gspot/<folder>.next` in groups of 16 with a flush per file,
  and renames the folder. In this repository that is `.gspot/node_modules` (246 MB in 36,521 files) and
  `.gspot/.venv` (567 MB in 13,327 files outside `__pycache__`): about 810 MB held in memory and about 50,000 flushed
  writes, to end with the same folder the package manager already built.
- Fix: Run the package manager, `uv venv` and `uv sync`, and `vale sync` straight in `.gspot/`, so they build
  `.gspot/node_modules`, `.gspot/.venv`, and the Vale styles in place. There is no staging folder, no swap, no crash
  recovery, and no "installing" state: if an install fails, run `gspot install` again. Delete `readInstalledTree`,
  `installedFile`, `linkTarget`, `installTree`, `recoverInstallations`, `sideFolders`, `InstalledFile`,
  `ToolOwner.installTree`, `InstallationContext.trees`, `InstallationFolders`, and the `__pycache__` skip. The
  integration tests that copy cached tool folders with `readInstalledTree` and `installTree` run a real
  `gspot install` in their sandbox instead (TTO-003). Two points the change must cover:
    - The refusal of a Python lockfile that holds the index password runs before the lockfile is written into
      `.gspot/`, or a refused install leaves the password in the committed `uv.lock` (ST5-007).

    - Inside the repository, npm, pnpm, Yarn, Bun, and uv can see the repository's own workspace and settings files (a
      root `package.json` `workspaces` list, `pnpm-workspace.yaml`, `.yarnrc.yml`, a uv workspace in `pyproject.toml`),
      which the OS temp folder hides today. One real run on macOS, Linux, and Windows tries a repository with each.

- Size: large

### LIF-002: The install "inputs changed during installation" guard can never fire

- Where: `packages/cli/src/tools/contracts.ts:287-310` (`inputs` map, `guards.source`), `packages/cli/src/tools/npm/public.ts:128,131`, `packages/cli/src/tools/python/public.ts:162`, `packages/cli/src/lifecycle/install/public.ts:66-67,270-281` (`original` cache and the read loop), `packages/cli/src/types/tools/project.ts:8`, `packages/cli/src/types/lifecycle/install.ts:16`
- Kind: delete
- Problem: `guards.source` reads the tool project files again and compares them with the copy read at the start, to
  catch a user who edits them during the install. In production the reader is `context.inputs.read`, which returns
  the in-memory prepared copy or a cached first read (`install/public.ts:276-281`). It never reads the disk again, so
  the comparison is always "same object equals itself". The one test that asserts the message
  (`tests/tools/npm/refusals.test.ts:114-134`) passes a disk reader that production never uses. The real protection
  exists already: the final write passes the expected old bytes to `files.write`, which refuses a changed file.
- Fix: Delete `guards.source`, the `inputs` map in `installToolProject`, `context.original`, and the loop at
  `install/public.ts:66-67` that reads `gspot.toml` and three other files only to fill that cache. `ToolProjectGuards`
  goes with LIF-021. Delete the test at `tests/tools/npm/refusals.test.ts:114-134`.
- Size: small

### LIF-003: The Python interpreter is copied into the virtual environment

- Where: `packages/cli/src/tools/python/public.ts:79-100` (`relocateInterpreter`)
- Kind: delete
- Problem: uv makes `.venv/bin/python` a link to the system Python. The tool folder copy of LIF-001 refuses any link
  with an absolute target (`platform/root/reads.ts:47`), so gspot deletes the link, copies the 6.2 MB interpreter into
  the virtual environment, and runs Python to check that `ssl` still imports. This exists only to satisfy the copy's
  own link rule.
- Fix: With LIF-001, uv builds `.venv` in place. Keep uv's normal link, and delete `relocateInterpreter` and its check
  run. S05-009 drops the relocation flags.
- Size: small

### LIF-004: Durable writes in groups of 16 serve only the file-by-file copy

- Where: `packages/cli/src/lifecycle/ownership/state/public.ts:110-120`, `packages/cli/src/platform/root/writes.ts:262-271` (`replaceEntries`), `packages/cli/src/config/platform/root.ts` (`FILE_WRITE_BATCH = 16`), `Root.writeAll`
- Kind: delete
- Problem: `writeAll` writes the per-file copy of LIF-001 in groups of 16, with a flush per file. Its one caller is
  `installTree`. It is a speed fix for a design that should not copy at all.
- Fix: Delete `writeAll`, `replaceEntries`, `stageFile`, and `FILE_WRITE_BATCH`, together with LIF-001.
- Size: medium

### LIF-006: Shipped-manifest style checks run on every CLI start

- Where: `packages/cli/src/configurations/public.ts:138,176-188`, `packages/cli/src/configurations/errors/public.ts:23-64` (`CHECK_RULES`), `:79-92` (`manifestTableErrors`), `:100-123` (`manifestErrors`), `packages/cli/src/config/configurations.ts:10,74-90` (`SENTENCE_MIN_CHARS`, `MANIFEST_TABLE_ORDER`), `packages/cli/src/configurations/public.ts:39-46` (`locatedConfiguration` name and group refusal)
- Kind: delete
- Problem: Every command that reads the configurations parses all 60 shipped `manifest.toml` files, then parses each
  one again with a second TOML library (`@decimalturn/toml-patch`, through `manifestTableErrors`) only to check that
  its tables are in a house order. It also checks house rules such as "a manual check must have something that makes
  it slow" and "every tool file needs a reader". These police how gspot's own shipped files are written. The comment
  at `configurations/public.ts:179` says these checks run only at build time and in the tests, which is false for them.
- Fix: Delete `manifestTableErrors`, `MANIFEST_TABLE_ORDER`, the sixth `CHECK_RULES` entry ("is manual with nothing
  that makes it slow"), `SENTENCE_MIN_CHARS` (use `z.string().min(1)`), `toolFileReaders` (the "no check reads it and
  no pointer" check), and the name and group refusal: `parseManifest` sets both from the folder, and
  `locatedConfiguration` inlines into it. The other `CHECK_RULES` entries, renamed `CHECK_CONTRADICTIONS` (LIF-010),
  join `assertManifests` in `scripts/manifests.ts` (LIF-007), so they run only at build time.
- Size: medium

### LIF-007: Build-only manifest checks live in shipped source and run twice per build

- Where: `packages/cli/src/configurations/errors/contracts.ts:21-187,216-241` (`assertManifests` and its helpers), `packages/cli/scripts/build.ts:20-29`, `scripts/setting-values.ts:7,15`
- Kind: move
- Problem: About 200 lines of checks run only at build time and in tests, but ship inside the CLI. The build calls
  `assertManifests` itself and also starts `scripts/setting-values.ts --check`, which calls it again.
- Fix: Move `assertManifests` and its helpers, with their placeholder check and the `CHECK_CONTRADICTIONS` entries of
  LIF-006, to `scripts/manifests.ts` in the one root `scripts/` folder (ROOT-017). The build (`scripts/build.ts`,
  SCR-005) calls it once; it has no task. Keep `manifestError` and `declaredTools` in
  `src/configurations/manifests.ts`. The second call goes with `scripts/setting-values.ts`, which is deleted
  (POL-001).
- Size: medium

### LIF-008: `public.ts` and `contracts.ts` say nothing about what the files in this area hold

- Where: every `public.ts`/`contracts.ts` pair in `lifecycle/`, `lifecycle/install/`, `lifecycle/merge/`, `lifecycle/ownership/`, `lifecycle/ownership/state/`, `lifecycle/selection/`, `planning/`, `tools/`, `tools/npm/`, `tools/python/`, `agent-rules/`, `configurations/`, `configurations/errors/`
- Kind: rename
- Problem: The two names do not mark "public" and "private": both are imported from outside, and the import
  direction flips from folder to folder. In `tools/` and `merge/`, `public.ts` imports `contracts.ts`; in
  `lifecycle/ownership/` and `lifecycle/selection/`, `contracts.ts` imports `public.ts`. The `contracts.ts` files hold
  plans, schemas, hooks, skip reasons, and tool pins, and none of them holds a "contract". For example, `hookStatus` and
  `hasValePackages` in `install/contracts.ts` are imported by `commands/check/tree.ts`, `commands/doctor/public.ts`, and
  `checks/general/public.ts`.
- Fix: Name each file after what it holds (see "Target layout"): `ownership/contracts.ts` becomes
  `ownership/plans.ts`, `ownership/state/contracts.ts` becomes `ownership/log-schema.ts`, `install/contracts.ts`
  becomes `install/hooks.ts` and `install/vale.ts`, `planning/contracts.ts` becomes `planning/skips.ts`, and
  `configurations/contracts.ts` becomes `configurations/tool-pins.ts`. ARC-002 renames the same pair across the whole
  tree. Update `AGENTS.md:92`, which names `lifecycle/ownership/state/contracts.ts`.
- Size: large

### LIF-009: `lifecycle/` is a vague bucket, and `lifecycle/selection/` belongs to commands

- Where: `packages/cli/src/lifecycle/**`, `gspot.toml:102-105` (module `lifecycle`)
- Kind: move
- Problem: "lifecycle" hides three clear jobs: writing the generated files, installing the tools and hooks, and the
  ownership log. The selection files are not part of any of them: only commands import them
  (`reconcileConfigurations` from `commands/public.ts:36` and `commands/doctor/public.ts:22`, `selectForInit` from
  `commands/init/public.ts:22`).
- Fix: Split into `src/apply/`, `src/install/`, and `src/ownership/`; one `[[architecture.module]]` record in
  `gspot.toml` lists the three folders. Move `lifecycle/selection/public.ts` to `commands/init/selection.ts` and
  `lifecycle/selection/contracts.ts` to `commands/reconcile.ts`. Their types in `types/lifecycle/selection.ts` go to
  `types/commands/init.ts` and `types/repository/selection.ts`.
- Size: large

### LIF-010: One word, "rule", names Markdown rules, lint rules, and manifest checks

- Where: `packages/cli/src/agent-rules/*`, `packages/cli/src/types/agent-rules.ts` (`RuleFile`), `packages/cli/src/types/configurations.ts:117` (`RuleSource`), `packages/cli/src/config/configurations.ts:5` (`CONFIGURATION_RULES_FOLDER`), `packages/cli/src/config/agent-rules.ts:7` (`RULES_ALONE`), `packages/cli/src/configurations/errors/contracts.ts:177` (`assertRuleFiles`), `packages/cli/src/agent-rules/contracts.ts:9` (`rulesByArea`), `packages/cli/src/configurations/errors/public.ts:23` and `types/configurations.ts:24` (`CHECK_RULES`, `CheckRule`), `packages/cli/src/policy/schema/agent-rules.ts`; `parsers/schema/contracts.ts:241` (`ruleSettingsSchema`), `types/generation/rules.ts` (`CapturedRules`), `lifecycle/ownership/state/contracts.ts:78` (the log field `rules`); 319 lines with "rule" in 107 files
- Kind: rename
- Problem: This code handles three kinds of "rule". A rule is a Markdown file that tells coding agents how to work
  (`.gspot/rules/**`). A lint rule is one rule of a linter, such as ESLint `no-console` or Ruff `E501`, and the same
  code stores those too: `ruleData`, `CapturedRules`, `compareRules`, the `rules` key of `ownership.json`, `rule_keys`,
  `required_eslint_rules`, `ruff_rules`, the `rule` field of an `[[ignore]]` record, and `semgrepRuleFiles`. And
  `CheckRule`/`CHECK_RULES` is a consistency check on a manifest. In `generation/public.ts:201`, `rules` means rule
  files; in `lifecycle/public.ts:250`, it means lint rule values. Across the source, "rule" also names a finding's rule ID (`Finding.rule`), naming overrides (`PathRule`), gspot's own Bash pattern tables (`SAFETY_LINE_RULES`, `SAFETY_OWNER_RULES`), Semgrep rule files, and Git attributes (`attributeRules`). The ownership log records the written rules files as well, so its `rules` field for lint rule values gives one word two meanings in one file. The folder, the setting, and an init flag also say "agent rules" (`src/agent-rules/`, `[agent_rules]`, `--no-agent-rules`), a name the glossary retires; the folder holds two files of 144 lines in all.
- Fix: Use the glossary names. The Markdown files are "rules"; a linter's rule is a "lint rule" in gspot's own code and
  text; tool words such as `--rule` and the ESLint `rules` key stay as the tools spell them.
    - `src/agent-rules/` (two files) becomes the one file `src/rules.ts`, and `ruleSections` moves there from
      `parsers/public.ts`. `types/agent-rules.ts` becomes `types/rules.ts` (`RuleFile`, `RuleSource`), `config/agent-rules.ts` becomes `config/rules.ts`, and `policy/schema/agent-rules.ts` becomes `settings/schema/rules.ts`. Do after TML-001, which deletes the import rule that forced the two file names.

    - The setting `[agent_rules]` becomes `[rules]` (TML-003), and the `AGENTS.md` heading is `# Rules`.
      `configurationFiles` and `agentRuleFiles` become `ruleFiles`, and `CONFIGURATION_RULES_FOLDER` becomes `RULES_FOLDER`.
      `selectRuleFiles`, `rulesByArea`, and `assertRuleFiles` keep their names.

    - Lint rules: in the ownership log, `ruleSettingsSchema` becomes `capturedLintRulesSchema` (in `ownership/log-schema.ts`), `CapturedRules` becomes `CapturedLintRules` (in `types/ownership.ts`), the log field `rules` becomes `lintRules`, `collectRules` becomes `collectLintRules`, and `compareRules` becomes `compareLintRules`. The log is local state (`.gitignore:31`) and gspot is not on npm yet, so no old log needs reading.
    - gspot's own tables say what they hold: `SAFETY_LINE_RULES` becomes `ALL_LEVEL_SAFETY_PATTERNS`, `SAFETY_OWNER_RULES` becomes `SAFETY_PATTERNS`, and `PathRule` becomes `CompiledOverride` (`NamingOverride` already names the parsed record); the naming rules become the naming settings (`NamingSettings`, `checks/general/naming/settings.ts`).
    - Manifest checks: `CheckRule` becomes `CheckContradiction` and `CHECK_RULES` becomes `CHECK_CONTRADICTIONS`, beside
      `assertManifests` (`scripts/types/manifests.ts`, `scripts/manifests.ts`).

    - CMD-084 renames the two closing paragraphs `RULES_ALONE` and `CHECKS_INSTALLED`. `--no-agent-rules` goes with
      init's other flags (CLX-001).

    - The paths `.gspot/rules/` and `configurations/*/*/rules/` stay.

- Size: medium

### LIF-012: The "interrupted mutation" check in `entryFor` cannot be reached

- Where: `packages/cli/src/lifecycle/ownership/public.ts:88-95`
- Kind: delete
- Problem: `openLog` always settles and clears `pending` when it opens the log, and `writeBatch` clears it in
  `finish()` right after its writes. No code plans a write between those two points: `pending` is set only in
  `writeBatch` (`ownership/public.ts:125`) and cleared at `:80,98`, and `entryFor` is not called inside `writeBatch`.
  The message is also jargon ("Reopen the lifecycle owner").
- Fix: Delete the `if (state.pending !== undefined) throw ...` lines.
- Size: small

### LIF-013: Write plans validate paths twice, and `plannedFiles` is never passed

- Where: `packages/cli/src/lifecycle/ownership/contracts.ts:185-187`, `packages/cli/src/types/lifecycle/ownership.ts:20`, `packages/cli/src/lifecycle/ownership/public.ts:105-113,204-210`
- Kind: simplify
- Problem: `planReplacement` calls `log.files.validate(path, next, plannedFiles)`, and `applyPlans` validates every
  plan again. No caller passes `plannedFiles` to `planReplacement`: `git grep plannedFiles` shows only the
  destructuring in `planReplacement` and the map built in `applyPlans`.
- Fix: Delete `ReplacementRequest.plannedFiles` and the `validate` call in `planReplacement`. `applyPlans` already
  validates.
- Size: small

### LIF-014: `applyPlans` returns the statuses it receives

- Where: `packages/cli/src/lifecycle/ownership/public.ts:203,219`, `packages/cli/src/types/lifecycle/ownership.ts:8` (`Outcome`)
- Kind: simplify
- Problem: The return value is `plans.map((plan) => plan.status)`, the input. No production caller uses it; tests use
  it to read back `plan.status` (for example `tests/cli/lifecycle/ownership/json.test.ts:21`).
- Fix: Return `void`. Tests read `plan.status` from the plan.
- Size: small

### LIF-015: `WriteRequest.root` is set and never read

- Where: `packages/cli/src/types/lifecycle/apply.ts:7`, `packages/cli/src/lifecycle/public.ts:229`
- Kind: delete
- Problem: Dead field. `writeGenerated` destructures `generated`, `report`, `retained`, `reviewedOriginals`, and
  `conflictedOutputs`, and reads `agentRulesEnabled`; nothing reads `root`.
- Fix: Delete the field and the assignment, together with `agentRulesEnabled` (S05-006).
- Size: small

### LIF-016: Deleting the Vale folder first reads every Vale file into memory

- Where: `packages/cli/src/lifecycle/ownership/state/public.ts:136-137`
- Kind: delete
- Problem: `deleteInstallation('vale')` calls `readInstalledTree`, which reads all bytes, and throws the result away,
  only so that a link inside would throw before deletion. `rmSync(..., { recursive: true })` removes links without
  following them (`platform/root/public.ts:95-100`).
- Fix: Delete the two lines.
- Size: small

### LIF-017: Vale packages are checked for links three times

- Where: `packages/cli/src/lifecycle/install/contracts.ts:143-148`, `packages/cli/src/lifecycle/ownership/state/public.ts:68-71,167-168`
- Kind: delete
- Problem: After `vale sync`, gspot refuses a link at the package folder, refuses any link inside it, and refuses any
  file with more than one hard link, each with the jargon message "Unsafe lifecycle destination". Vale reads these
  files; gspot never writes through them. This guards against a threat that does not exist here.
- Fix: Delete all three. With LIF-001, `vale sync` writes the styles straight into `.gspot/`, and nothing copies them.
- Size: small

### LIF-018: Vale install does work before it checks the level, and returns error strings

- Where: `packages/cli/src/lifecycle/install/contracts.ts:125-152,45-53`, `packages/cli/src/lifecycle/install/public.ts:168-181`
- Kind: simplify
- Problem: `installValePackages` copies the Vale config and styles into a scratch folder (`stageInputs`) and only then
  returns early at level `recommended` (`install/contracts.ts:131-132`). It returns error text instead of throwing,
  unlike every other install step, and `install/public.ts:178-180` turns that text back into an error.
- Fix: Check the level first. `stageInputs` goes with LIF-001: `vale sync` runs on the generated `vale.ini` straight
  into `.gspot/`. Throw `GspotError('installation', ...)` directly from `installValePackages`, and delete the
  string-to-error conversion at `install/public.ts:178-180`.
- Size: small

### LIF-020: The uv lockfile is checked up to four times, and uv error messages are written twice

- Where: `packages/cli/src/tools/python/public.ts:58-77,129-164`
- Kind: simplify
- Problem: `runUv` validates `uv.lock` after every uv command (line 75), `createLockfile` validates it again (line
  143), and `install` runs `runUv` twice (`uv venv` and `uv sync`). The "uv is unavailable" and "UV ... failed ... Python 3.x
  must be installed" messages are written out in both `createLockfile` and `install`.
- Fix: Remove the lockfile read from `runUv`, and validate once at the end of lockfile creation
  (`preparePythonLockfile`). Move the "failed" error into `runUv`. A missing uv gets the ordinary missing-tool hint
  (LIF-052).
- Size: small

### LIF-021: The "scratch" guard repeats what frozen installs already guarantee

- Where: `packages/cli/src/tools/contracts.ts:299-305`, `packages/cli/src/tools/npm/public.ts:130`, `packages/cli/src/tools/python/public.ts:160`
- Kind: delete
- Problem: After installing, gspot checks that the package manager did not change `package.json` or the lockfile.
  Every command it uses is a frozen install that refuses to change the lockfile: `npm ci`,
  `bun install --frozen-lockfile`, `pnpm install --frozen-lockfile`, `yarn install --immutable` or
  `--frozen-lockfile`, and `uv sync --locked` (`config/tools/npm.ts:71-81`, `config/tools/python.ts:4`).
- Fix: Delete `guards.scratch`. With LIF-002, delete `ToolProjectGuards` and the `guards` parameter of
  `ToolProject.install` (LIF-030 replaces the interface).
- Size: small

### LIF-024: The Bun lockfile is parsed twice to prove a one-field edit changed nothing else

- Where: `packages/cli/src/tools/npm/lockfiles.ts:26-53,73-121`, `packages/cli/src/tools/npm/public.ts:61-69`
- Kind: simplify
- Problem: gspot rewrites registry URLs out of Bun and Yarn 1 lockfiles, so a committed lockfile does not depend on one
  developer's private registry. That is a real need. But `stripBunRegistryUrls` and `stripYarnRegistryUrls` each parse
  the whole lockfile before and after the edit and compare. The Bun edit changes one field through
  `jsonc-parser.modify`, so its comparison proves nothing. The Yarn 1 edit is a plain text replace (`replaceAll` of the
  quoted URL, `lockfiles.ts:88`) that could also change other text, and its comparison catches that. Both throw a
  plain `Error`.
- Fix: Keep the rewrite. Drop the before-and-after comparison for Bun only, and keep it for Yarn 1. Throw
  `GspotError('installation', ...)` instead of a plain `Error`.
- Size: small

### LIF-025: The "GitHub refused a tool download" hint is a guess

- Where: `packages/cli/src/tools/npm/contracts.ts:176-185,246-247`, `packages/cli/src/config/tools/npm.ts:17-21`
- Kind: delete
- Problem: When a package install fails, gspot scans the output for a GitHub URL and "403" to suggest setting
  `GITHUB_TOKEN`. The full package manager output is shown right after it anyway.
- Fix: Delete `githubRefusalNote`, `GITHUB_DOWNLOAD_URL`, and `GITHUB_REFUSAL`.
- Size: small

### LIF-028: The full check plan is computed again and again to list the needed tools

- Where: `packages/cli/src/lifecycle/install/public.ts:204,206,236`, `packages/cli/src/planning/public.ts:295-348`, `packages/cli/src/commands/public.ts:205`
- Kind: simplify
- Problem: `applicableManifests` plans every check in every scope. `install` calls it twice (`runInstallationPhases`
  and `installationPlan` inside it), and `openSession` calls it once only to decide whether an npm tool project exists.
- Fix: Compute it once per session and pass the result. Rename it `neededToolManifests`: it returns the selected
  configurations cut down to the tools that active checks need.
- Size: small

### LIF-029: The install step framework is over-built

- Where: `packages/cli/src/lifecycle/install/public.ts:42-250`, `packages/cli/src/types/lifecycle/install.ts:11-49`, `packages/cli/src/tools/contracts.ts:218-236`
- Kind: simplify
- Problem: Install is an array of six objects, each with a `preview` and a `run` function, a tuple type that makes the
  first step special, run functions with unused parameters (`_manifests`, `_context`), and an `InstallationPlan` that
  nests `preparation` and `phases` and copies `hooks` out of them. Most `run` functions compute again what `preview`
  computed (`toolInstallationPlan` four times), and only the mise step uses its preview. `gspot install` has no dry run
  (CLX-004): the only other reader of the step lines is the `steps` field of the install JSON.
- Fix: Write `installTools` as one plain async function that runs the steps in order and returns the commands it ran,
  for the `steps` field of the install JSON. `installations`, `runInstallationPhases`, and `installationPlan` merge
  into it. Delete `InstallationStep`, `InstallationPlan`, `InstallationContext`, `projectPreview`,
  `toolInstallationPlan`, and the `refreshLockfiles` fields of `types/lifecycle/install.ts:20,29`. Do after INS-001
  (it deletes the `mise --version` check) and CMD-015 (it deletes the `refreshLockfiles` plumbing).
- Size: medium

### LIF-030: The generic `ToolProject` interface has 12 members and 3 type parameters for 2 users

- Where: `packages/cli/src/types/tools/project.ts:11-35`, `packages/cli/src/tools/npm/public.ts:72-134`, `packages/cli/src/tools/python/public.ts:103-165`, `packages/cli/src/tools/contracts.ts:208-315`, `packages/cli/src/tools/python/contracts.ts:83-101`
- Kind: simplify
- Problem: `ToolProject<Parsed, Preparation, Installation>` exists for exactly two tool projects, npm and Python.
  Members such as `current` hide side effects (the npm `current` throws when `node` is missing,
  `npm/public.ts:89-93`), and `lockfilePrefix` and `installPrefix` are fixed strings. Python's `parse` validates the
  project and returns the raw text (`python/public.ts:109-112`), so `pythonLockfileMatches` parses the same TOML again
  on every call.
- Fix: After LIF-001, LIF-002, and LIF-021, replace the interface with two plain modules: `tools/npm/project.ts`
  (`prepareNpmLockfile`, `installNpmTools`) and `tools/python/project.ts` (`preparePythonLockfile`,
  `installPythonTools`). They share no staging helper, because the tools install straight into `.gspot/` (LIF-001).
  Rename `current` to `reusableLockfile` if it stays, and move the `node` check into lockfile creation. As the first
  small step, let the Python `parse` return the parsed object and let `pythonLockfileMatches` take it. Do after
  CMD-015, which deletes the `refreshLockfiles` plumbing in `tools/contracts.ts:223-258` and `LockfilePreparation`.
- Size: medium

### LIF-032: Four messages for "gspot did not overwrite your edited file", and one path set built twice

- Where: `packages/cli/src/lifecycle/public.ts:88,96-98,113-116,327`, `packages/cli/src/lifecycle/ownership/public.ts:212-215`, `packages/cli/src/lifecycle/install/public.ts:87-90`
- Kind: merge
- Problem: Four sentences say the same thing: "These files were not overwritten by gspot ... Existing tool files are
  unchanged", "These edited files were not overwritten ... The version pin is unchanged", "The file X was not
  overwritten by gspot ... retry the command", and "Tool inputs were edited ...". The set of expected paths is built
  twice, in `writeGenerated` (`lifecycle/public.ts:88`) and in `computeDrift` (`:327`).
- Fix: One helper `notOverwrittenError(paths, command)` used by all four. One `expectedPaths(generated)` helper beside
  `isStray` in `apply/stale.ts`, used by `writeGenerated` and `findStaleFiles` (the new name of `computeDrift`).
- Size: small

### LIF-034: Two regular expressions for Git conflict markers

- Where: `packages/cli/src/config/parsers/git.ts:24-26`, `packages/cli/src/tools/npm/lockfiles.ts:64`, `packages/cli/src/lifecycle/public.ts:124,149`
- Kind: merge
- Problem: `CONFLICT_MARKER_PREFIX` and `CONFLICT_MARKERS` differ only in strictness, and each has one user file. In
  `lockfileMatches` the marker check is also redundant: a lockfile with markers fails to parse, and the `catch` returns
  false.
- Fix: Delete `CONFLICT_MARKER_PREFIX` and its check in `lockfileMatches`. `CONFLICT_MARKERS` moves to
  `config/apply.ts`. Do after SLF-030: its narrower `catch` must still treat a lockfile parse failure as "no match", so
  a lockfile with merge markers is still rebuilt.
- Size: small

### LIF-035: Generic planning code hard-codes single checks and tools

- Where: `packages/cli/src/planning/contracts.ts:101-108` (`'security/semgrep'`), `packages/cli/src/planning/files.ts:42-49` (`'postgres/squawk'`), `packages/cli/src/planning/public.ts:244` (`'licenses'`), `:308-338` (`'eslint'`, `'eslint-config-prettier'`, `'prettier'`), `packages/cli/src/configurations/public.ts:104` (`when: { configuration: 'security' }`)
- Kind: simplify
- Problem: The planner, which should only read manifests, special-cases named checks and tools. A reader of a manifest
  cannot see these rules.
- Fix: Express each in data. The Semgrep check skips itself in its own run code when it has no rule files. The Squawk
  check declares its files with a `{setting:postgres.migrations_folder}` file pattern, as `test_files` already does.
  The ESLint plugin libraries and `eslint-config-prettier` become `required_tools` of the ESLint tool file. The
  `'licenses'` name and the Semgrep tool file become named values in `config/planning.ts` and
  `config/configurations.ts` (`SEMGREP_TOOL_FILE`); the Semgrep folder rule stays (CFL-052).
- Size: medium

### LIF-036: `selectionStatus` is computed twice per check, and its name clashes

- Where: `packages/cli/src/planning/public.ts:103-105`, `packages/cli/src/planning/contracts.ts:92-113,133`, `packages/cli/src/commands/list.ts:51`
- Kind: rename
- Problem: `planScope` calls it to filter checks that the level turns off, then `skipFor` calls it again for the same
  check. "Selection" already means "which configurations a scope uses".
- Fix: Rename it `settingsSkip`: it answers "does gspot.toml turn this check off, and why". Call it once in `planOne`,
  and let `planScope` drop the entries whose result is `level`.
- Size: small

### LIF-037: `missingBuild` answers a question about a tool from inside `planning/`

- Where: `packages/cli/src/planning/contracts.ts:158-172` (`missingBuild`), `packages/cli/src/configurations/contracts.ts:19-28` (`miseOs`)
- Kind: move
- Problem: `missingBuild` turns a tool's build list (`linux-x64`, `macos`, ...) into yes or no. It is about a tool, not
  about planning, yet doctor and tests import it from `planning`. `miseOs` parses the same list in another folder, with
  its own CPU suffix pattern (`ARCHITECTURE_SUFFIX`, `/-(?:x64|arm64)$/u`).
- Fix: Move `missingBuild` into `configurations/tool-pins.ts`. It compares `platform` and `platform-arch` with no
  suffix pattern, and it also decides which program tools the `mise install` call names (INX-006). `miseOs` and
  `ARCHITECTURE_SUFFIX` are deleted with INX-006, so nothing is left to share.
- Size: small

### LIF-038: `planning/public.ts` holds two jobs, and `planning/contracts.ts` holds three

- Where: `packages/cli/src/planning/public.ts`, `packages/cli/src/planning/contracts.ts`
- Kind: move
- Problem: `public.ts` plans checks and also works out the needed tools (`requiredToolNames`, `checkCompanions`,
  `licenseProjects`, `applicableManifests`). `contracts.ts` holds skip reasons, coverage flag removal, and the build
  check of a tool.
- Fix: `planning/checks.ts` (`planRun`, `configuredChecks`, `isActive`, `coveredInputs`, and `coverageArguments`),
  `planning/needed-tools.ts` (`neededToolManifests`, `requiredToolNames`, `checkCompanions`, `licenseProjects`), and
  `planning/skips.ts` (the skip reasons). `coverageArguments` stays in planning: `checkCompanions` calls it, and
  `gspot.toml` does not let planning import from `execution`. `ownedInputs` becomes `coveredInputs` (glossary:
  covers), and `missingBuild` moves out (LIF-037).
- Size: medium

### LIF-039: A flag parameter and a long parameter list in planning

- Where: `packages/cli/src/planning/public.ts:154` (`configuredChecks(session, includeUnsupported = false)`), `packages/cli/src/planning/contracts.ts:125-132` (`skipFor` with 6 positional parameters)
- Kind: simplify
- Problem: A boolean switch changes what `configuredChecks` returns (`configuredChecks(session, true)` in
  `applicableManifests` and `generation/public.ts:174`). `skipFor` receives six values that its caller already holds in
  one `PlanInputs`.
- Fix: Replace the boolean with two functions, `configuredChecks(session)` and `configuredChecksOnAnySystem(session)`.
  Give `skipFor` the `PlanInputs` it already has.
- Size: small

### LIF-042: Exports used only inside their own file or only by tests

- Where: `packages/cli/src/lifecycle/ownership/contracts.ts:173` (`getOnDisk`), `:278` (`recordedBlockStart`), `packages/cli/src/types/tools/install.ts:6` (`ToolState`), `types/configurations.ts:29` (`ExecutionFields`), `types/tools/project.ts:8` (`ToolProjectGuards`); test-only exports `compareRules`, `isStray`, `writeVersionPin` (`lifecycle/public.ts`), `packageVersion` (`tools/contracts.ts`), `textAtLevel` (`agent-rules/public.ts`), `linkManifestTools`, `parseManifest` (`configurations/public.ts`)
- Kind: simplify
- Problem: Exports widen the module surface with no production caller. The first five have no source user outside
  their own file; the test-only ones have one test file each, except the manifest helpers.
- Fix: Stop exporting `getOnDisk` (renamed `readOnDisk`) and `recordedBlockStart`. `ExecutionFields` folds into
  `CheckDeclaration`, `ToolProjectGuards` goes with LIF-021, and `ToolState` moves to `types/tools/find.ts` like every
  other type. Stop exporting `compareLintRules`, `packageVersion`, `textAtLevel`, and `linkManifestTools`, and test
  them through the public function that calls them (`findStaleFiles`, `inspectTool`, `selectRuleFiles`,
  `configurationManifests`). `isStray` and `writeVersionPin` stay exported: after the split of LIF-009, `apply/write.ts`
  and `apply/stale.ts` both use `isStray`, and `writeGeneratedFiles` calls `writeVersionPin`. `parseManifest` stays
  exported: it is the real entry point for parsing a manifest, and tests build manifests through it.
- Size: small

### LIF-044: A hard-coded table of install hints duplicates tool declarations

- Where: `packages/cli/src/config/tools/install.ts:5-18` (`HOST_HINTS`), `packages/cli/src/tools/contracts.ts:124`
- Kind: move
- Problem: Twelve tool names with install hints live in TypeScript, while every tool is declared in a `manifest.toml`
  (for example `configurations/language/bash/manifest.toml:41`). One of the twelve, `xcstringstool`, has no tool
  declaration and no user anywhere, so its hint is dead.
- Fix: Add an optional `install_hint` field to the tool declaration schema, move each hint into its manifest, and
  delete `HOST_HINTS`. Delete the `xcstringstool` entry instead of moving it.
- Size: small

### LIF-045: The rules comments are copied and wrong, and one type assertion

- Where: `packages/cli/src/agent-rules/public.ts:1`, `packages/cli/src/agent-rules/contracts.ts:1,9-20,46`
- Kind: rewrite-text
- Problem: Both files open with the same comment, "Select agent rules from configuration assets and write them to the
  configured rules folder". Neither writes anything, and `contracts.ts` builds the managed block of `AGENTS.md`.
  `rulesByArea` recovers the configuration group by splitting the path and casting it
  (`file.path.split('/', 1)[0] as Manifest['configuration']['kind']`).
- Fix: The two files merge into `src/rules.ts` (LIF-010) with one true header: "Choose the rule files for the selected
  configurations and level, and build the managed block gspot writes into AGENTS.md." `managedBlock` keeps its name
  (glossary: managed block). Carry the configuration group in `RuleSource` and drop the cast.
- Size: small

### LIF-046: The AGENTS.md text mixes rules and lint rules, and uses jargon

- Where: `packages/cli/src/config/policy/settings.ts:79-83` (`LEVEL_SUMMARY`, `ALL_LEVEL_SUMMARY`), `packages/cli/src/config/agent-rules.ts:10`
- Kind: rewrite-text
- Problem: Every generated `AGENTS.md` says: "These rules apply only at level `all`: word choice, architecture ...
  Neither level enables experimental or preview lint rules." The first "rules" means rule sections and lint rules
  together; the second means lint rules. "declared project contracts" means nothing to a reader. The doc comment
  "Shared introduction and enforcement contract in each managed instruction index" is jargon.
- Fix: GEN-011 takes the two level lines out of the managed block, and `set --help` no longer prints them (CLX-010), so
  `LEVEL_SUMMARY` and `ALL_LEVEL_SUMMARY` stay only in the settings schema values (`config/settings/schema.ts`).
  Rewrite them there: "Level `all` adds checks and rules for word choice, architecture, naming, doc comments,
  declaration order, API style, and complexity. No level turns on experimental or preview lint rules." Replace
  "declared project contracts" with "the project's own declared checks". Comment: "The heading of the managed block
  gspot writes into AGENTS.md." Do after GEN-011.
- Size: small

### LIF-047: Filler and jargon words in comments and messages

- Where: all files in this area; examples `packages/cli/src/tools/contracts.ts:211-245` ("the project's native behavior", "the native resolution inputs"), `packages/cli/src/types/agent-rules.ts:5` ("after native execution defaults are resolved"), `packages/cli/src/lifecycle/public.ts:200` ("the repository's lifecycle owner"), 12 error messages "Unsafe lifecycle destination" or "Lifecycle destination changed"
- Kind: rewrite-text
- Problem: "native" appears 66 times in these 55 files and adds nothing (the glossary retires "native tool"). "owner"
  appears 214 times with at least five meanings. "lifecycle destination" is shown to users.
- Fix: Delete "native" where it is filler ("native configuration" becomes "configuration", "native version" becomes
  "version"). Replace "lifecycle owner" and "ownership context" with "ownership log", and say "covers" where a
  configuration's patterns match a file (glossary). The error messages are rewritten by TCM-030.
- Size: medium

### LIF-048: File header comments describe the wrong file

- Where: `packages/cli/src/lifecycle/public.ts:1`, `packages/cli/src/lifecycle/install/public.ts:1-2`, `packages/cli/src/configurations/contracts.ts:1`
- Kind: rewrite-text
- Problem: `lifecycle/public.ts` says "Compares generated files with the files on disk", but it mainly writes them.
  `install/public.ts` describes Git hooks, which live in `install/contracts.ts`. `configurations/contracts.ts` says
  "Validated file declarations", but it holds tool pin helpers.
- Fix: Write one true sentence per file, or let the file name say it (LIF-008).
- Size: small

### LIF-049: Detached and doubled comments

- Where: `packages/cli/src/lifecycle/install/contracts.ts:55-57`, `packages/cli/src/lifecycle/ownership/state/public.ts:26-28`, `packages/cli/src/tools/public.ts:104-106`, `packages/cli/src/configurations/public.ts:61-63`, `packages/cli/src/tools/contracts.ts:131-137`, `packages/cli/src/configurations/contracts.ts:218-224`
- Kind: rewrite-text
- Problem: Four comments are separated from their function by a blank line, and two functions have a `//` comment and
  a JSDoc comment that say the same thing.
- Fix: Remove the blank lines, and keep one comment each.
- Size: small

### LIF-052: uv has three names

- Where: `packages/cli/src/types/tools/python.ts:9` (`pythonInstaller`), `packages/cli/src/tools/python/public.ts:174` (`installUv`), `packages/cli/src/configurations/public.ts:228` (`pythonInstallerPin`, "the bundled Python bootstrap pin"), `packages/cli/src/tools/python/public.ts:133-153`
- Kind: rename
- Problem: The same program, uv, is called "Python installer", "uv", and "Python bootstrap". uv also has its own
  install path (`installUv`: `mise install uv@<version>` and `mise which uv --tool`), and the uv tool project prints
  "Run: python -m pip install uv==<version>" when uv is missing.
- Fix: uv has one name. `pythonInstallerPin` becomes `uvPin`; it feeds `misePins`, because uv is a program tool in
  `.gspot/mise.toml`. `installUv` is deleted with its `mise which` lookup, and uv is found through the one
  `mise bin-paths` call like any program tool (INX-006). The session's `pythonInstaller` field and the runner check
  behind it go, and `PythonPreparation.pythonInstaller` becomes `uvPath`. The pip messages go: a missing uv gets the
  ordinary missing-tool hint of `installHint`.
- Size: small

### LIF-053: The ownership log has six names

- Where: `packages/cli/src/types/lifecycle/ownership.ts` (`Log`, `Ownership`, `OwnershipEntry`), `packages/cli/src/types/lifecycle/apply.ts:3` (`OwnershipEntry as OwnedFile`), `openOwnership`, `getOwnership`, comments "ownership context", "lifecycle owner", "state", "record"
- Kind: rename
- Problem: One file, `.gspot/state/ownership.json`, is called log, ownership, state, record, ownership context, and
  lifecycle owner (`Log` 35 uses, `Ownership` 10, `OwnershipEntry` 21, `OwnedFile` 3). `OwnershipEntry` is imported
  again under a second name.
- Fix: Use the glossary names. `Log` becomes `OwnershipLog`, `Ownership` becomes `OwnershipState`, `OwnershipEntry`
  becomes `OwnedFile` (delete the alias), `PendingOwnership` becomes `PendingWrite`, `ownershipSchema` becomes
  `ownershipStateSchema`, `openOwnership` becomes `openOwnershipLog`, `getOwnership` becomes `readOwnershipLog`, and
  `getEntry` becomes `findOwnedFile`. Comments say "ownership log".
- Size: medium

### LIF-054: The record of keys gspot adds to a user's file reuses the word "configuration"

- Where: `packages/cli/src/lifecycle/ownership/state/contracts.ts:52-60` (field `configuration`), `packages/cli/src/config/lifecycle/ownership.ts:5,19` (kind `'merge'`, `MERGED_CONFIGURATION_FORMATS`), `packages/cli/src/types/lifecycle/apply.ts:24` (`MergeRecord`), `lifecycle/merge/`
- Kind: rename
- Problem: The record of the keys gspot added to a user's file is stored under `configuration`, the main word for a
  selectable configuration. The folder and the owned kind say "merge", which also means Git merges (handled in
  `lifecycle/public.ts`) and list merges (`mergeConfigurationChoices`).
- Fix: Call the feature "managed keys", beside "managed block". `lifecycle/merge/` becomes
  `ownership/managed-keys.ts`; `planMerge` becomes `planManagedKeys`, `planDocumentMerge` becomes `planKeyChanges`,
  `MergeRecord` becomes `ManagedKeys`, and `MERGED_CONFIGURATION_FORMATS` becomes `MANAGED_KEYS_FORMATS`. The owned
  kind `'merge'` becomes `'keys'` (`OWNED_KINDS` is `['tool_file', 'block', 'keys', 'settings', 'pin', 'hook', 'lock']`), and the field `configuration` becomes `keys`. The version is 0.1.0, so `ownership.json` changes without
  a migration.
- Size: medium

### LIF-055: `ToolOwner` is neither a tool nor an owner

- Where: `packages/cli/src/types/tools/install.ts:35-39`, uses in `tools/contracts.ts`, `tools/public.ts`, `lifecycle/install/*`
- Kind: rename
- Problem: It is "a way to read repository files and hand over a finished installed folder" (11 uses). The name says
  nothing of that, and `ValeInstallation.owner` repeats it.
- Fix: After LIF-001 and LIF-002 it is only `{ read(path) }`. Replace it with `SafeFolder['read']` (the glossary name
  of `Root`), delete `ToolOwner`, and give `ValeInstallation.owner` the same reader type.
- Size: small

### LIF-056: A one-caller parameter on `toolPin`

- Where: `packages/cli/src/configurations/contracts.ts:138-139`, `packages/cli/src/execution/contracts.ts:122`
- Kind: simplify
- Problem: The `preferred` parameter is used by one caller to say "use this pin if the name matches"; only
  `execution/contracts.ts:122` passes a fourth argument.
- Fix: Delete `preferred`. At the caller, write `planned.tool?.name === name ? planned.tool : toolDeclaration(...)`
  (`toolPin` is renamed `toolDeclaration`, because it returns the whole tool declaration).
- Size: small

### LIF-057: A check of shipped tool pins runs in every `collectPins` call

- Where: `packages/cli/src/configurations/contracts.ts:30-46,116-128` (`recordPinVersions` in `collectPins`)
- Kind: move
- Problem: `collectPins`, called many times per command, checks again that two shipped configurations do not pin one
  package at two versions, and reports it with the code `'installation'`. It is a check of shipped
  manifests, so it belongs to the build.
- Fix: Move the check to the build: `recordPinVersions` becomes `assertPinsAgree` in `scripts/manifests.ts`, called by
  `assertManifests` (LIF-007). `collectPins` keeps only the pin collection.
- Size: small

### LIF-058: Helpers with one caller sit in a shared module

- Where: `packages/cli/src/configurations/public.ts:257-270` (`requireChain`, used only by `commands/remove.ts`), `packages/cli/src/configurations/public.ts:291-302` (`isSourceKind` and `sourceConfigurations`)
- Kind: move
- Problem: `requireChain` only serves the message of the `remove` command (`commands/remove.ts:16,42`). `isSourceKind`
  is a one-line helper for `sourceConfigurations`.
- Fix: Move `requireChain` into `commands/remove.ts`. Inline `isSourceKind` into `sourceConfigurations`.
- Size: small

### LIF-059: Runtime checks of gspot's own records

- Where: `packages/cli/src/lifecycle/ownership/state/contracts.ts:33-44,91-122` (`superRefine` overlap, duplicate, and pending-mismatch checks), `packages/cli/src/lifecycle/merge/public.ts:154-156` (`fieldsSchema.parse` of generated changes), `packages/cli/src/lifecycle/merge/contracts.ts:32-33` (recorded format check), `packages/cli/src/lifecycle/ownership/public.ts:104-113` (duplicate plan check)
- Kind: delete
- Problem: These check invariants of data gspot itself produces: the plans it builds, the log it writes, and the
  changes it generates. They can fail only if gspot has a bug or someone edits a private file by hand. The plans and
  changes come from code in the same command, and the format is derived from the same file extension both times.
- Fix: Keep the zod shape of `ownership.json`, because it is read from disk. Delete the `superRefine` invariants, the
  `fieldsSchema.parse` of generated changes (and `fieldsSchema`), the recorded-format comparison, and the
  duplicate-destination check.
- Size: small

### LIF-063: `setKind` is a flag-driven helper that saves the log three times per install

- Where: `packages/cli/src/lifecycle/ownership/state/public.ts:33-39,107,125-126,139`
- Kind: simplify
- Problem: One function takes a field name and a boolean to add or remove a kind, and saves the log each time;
  `installTree` saves three times.
- Fix: With LIF-001 there is no "installing" mark and no recovery. Delete `setKind`, set the installed kinds with a
  plain assignment, and save the log once after the install.
- Size: small

### LIF-064: Nine tool inspection helpers repeat the same lines

- Where: `packages/cli/src/tools/public.ts:40-198`
- Kind: simplify
- Problem: `libraryInspection`, `inspectLibraryCommand`, `inspectHostLibrary`, `inspectLibrary`, `missingInspection`,
  `executableInspection`, `inspectProjectExecutable`, `inspectExecutable`, and `pendingInspection` repeat
  `context.installedRoot ?? context.root` (3 times), `installHint(tool)` (5 times), and the building of `want` (3
  times).
- Fix: Compute `root`, `hint`, and `want` once in `inspectTool` and pass them in. Merge `inspectHostLibrary` into
  `inspectLibrary`. `pendingInspection` goes with LIF-001, because there is no "installing" state.
- Size: medium

### LIF-069: The install-time version run of editorconfig-checker silently does a second job

- Where: `packages/cli/src/tools/npm/contracts.ts:81-102,146-160` (`needsVersionCheck`, `assertNativeVersion`, `assertPackageVersions`), `packages/cli/configurations/general/format/manifest.toml:30-36`
- Kind: rewrite-text
- Problem: The comment says this run checks that an npm wrapper reports the right program version. It also does a
  second job that no comment states. editorconfig-checker is the only tool, across all 60 manifests, whose npm version
  (7.0.0) differs from its program version (3.4.0). Its npm package downloads the real program from GitHub the first
  time it runs (the version comes from `EC_VERSION`), and this run is what makes that download happen inside
  `gspot install`. A reader who deletes the "check" moves a network download into `gspot check` and breaks offline
  checks.
- Fix: Say it in the code. Rename `assertPackageVersions` to `runNpmWrappersOnce` and `assertNativeVersion` to
  `assertWrapperVersion`, stop exporting `runNpmWrappersOnce` (its one user is `installNpmTools`), and write one
  comment: "An npm wrapper such as editorconfig-checker downloads its program the first time it runs. Run it here, so
  the download happens during install, and check the version it reports."
- Size: small

### S05-001: The duplicate configuration name check runs on every start

- Where: `packages/cli/src/configurations/public.ts:53-59` (`registerManifest`)
- Kind: move
- Problem: `registerManifest` refuses two configurations with the same folder name. Configurations come only from the
  shipped `configurations/` folder, so this checks gspot's own shipped data on every command. Without the check,
  `registerManifest` is two lines with one caller (`configurationManifests`, `configurations/public.ts:181`).
- Fix: Inline `registerManifest` into `configurationManifests` (`configurations/manifests.ts`). Add the check to
  `assertManifests` in `scripts/manifests.ts` (LIF-007). It lists the manifest folders itself, because a map keyed by
  name already hides a duplicate.
- Size: small

### S05-002: The requirement-cycle check runs on every start

- Where: `packages/cli/src/configurations/public.ts:63-84` (`visit`), `packages/cli/src/types/configurations.ts` (`SelectionWalk.visiting`)
- Kind: move
- Problem: `visit` keeps a `visiting` stack only to report "The configurations require each other in a circle ... This
  is a bug in a configuration manifest." The `requires` lists come only from shipped manifests, and the names a user
  writes in `gspot.toml` are leaves that cannot form a cycle, so this is a check of shipped data. The build checks that
  each required configuration exists, but not cycles.
- Fix: Add a requirement-cycle check to `assertManifests` in `scripts/manifests.ts`, beside
  `assertNoReplacementCycle`, which does the same kind of walk for check replacements. In `visit`, add the name to
  `seen` before it walks the requirements (the order stays the same), and delete the `visiting` stack, the circle
  message, and `SelectionWalk.visiting`. The unknown-name message stays, because a user can write any name.
- Size: small

### S05-003: `deleteInstallation` would be a three-line helper with one caller

- Where: `tests/cli/lifecycle/ownership/installations.test.ts:11-27`, `tests/config/cli/lifecycle/ownership/installations.ts`; `packages/cli/src/lifecycle/ownership/state/public.ts:134-140` (`deleteInstallation`), `packages/cli/src/lifecycle/public.ts:41-45` (`pruneInstallations`)
- Kind: simplify
- Problem: After LIF-001 and LIF-016, `deleteInstallation` is three lines: skip a kind gspot did not install, remove the
  folder, and drop the kind from `installed`. Its one caller is `pruneInstallations`, which calls it three times. A
  file of its own would add an import and a module for it.
- Fix: Inline it into `pruneToolFolders` in `apply/write.ts` (the new name of `pruneInstallations`), as one loop over
  the kinds that are not kept; no separate tool-folder file is made. Its test (`installations.test.ts:11-27`) has no source file left to sit beside, so it joins `tests/unit/cli/apply/write.test.ts` as "writing generated files deletes the $kind tool folder and its record when no configuration needs it": it writes the folder and its installed record, then calls `writeGeneratedFiles` with a session that needs no tools of that kind. Its rows (`TOOL_FOLDERS`, today `INSTALLATIONS`) go to `tests/config/tools.ts`.
- Size: small

### S05-004: `listStyleFiles` sits in install code, but its user is in execution

- Where: `packages/cli/src/lifecycle/install/contracts.ts:110-118`
- Kind: move
- Problem: `listStyleFiles` has two callers: `stageInputs`, which goes with LIF-001, and `copyValePackages`
  (`execution/copy/contracts.ts:210`), which moves to `execution/copy/revision.ts`.
- Fix: Move it to `packages/cli/src/execution/copy/revision.ts`, and stop exporting it.
- Size: small

### S05-005: Init selection keeps the code of the deleted `--scope-configurations` flag

- Where: `packages/cli/src/lifecycle/selection/public.ts:21-35,63-80,91-100,140-173`
- Kind: delete
- Problem: CMD-092 deletes `init --scope-configurations`, the only source of `InitOptions.scopes`
  (`commands/init/public.ts:221`). Without it, `initScopes` returns the root scope plus the workspace scopes, the
  "Scope directory does not exist" refusal cannot happen, the `flagged` value of `scopeSelection` is always undefined,
  and `assertKnown` and `sets.named` read scope flags that are always empty.
- Fix: Inline `initScopes` into `selectForInit`. Delete `scopeFlags`, the `flagged` parameter, the scope part of
  `assertKnown`, and the refusal. `named` comes from `options.configurations` only.
- Size: small

### S05-006: `WriteRequest.agentRulesEnabled` exists only for the `CLAUDE.md` move, which goes

- Where: `packages/cli/src/types/lifecycle/apply.ts:6`, `packages/cli/src/lifecycle/public.ts:103,228`
- Kind: delete
- Problem: gspot never touches `CLAUDE.md` (DOC-011). The field exists only to decide whether to run
  `moveClaudeFile`: `git grep -n agentRulesEnabled` gives the type, the one assignment, and the one read before
  `moveClaudeFile`.
- Fix: Delete the field and its assignment, together with `root` (LIF-015). DOC-011 deletes the `CLAUDE.md` move
  itself: `moveClaudeFile`, `lifecycle/ownership/claude-file.ts`, `MOVED_HEADING`, and every `'CLAUDE.md'` string in
  this area, including the extra entry in the expected-path sets (`lifecycle/public.ts:88,327`). No constant for the
  file name is needed.
- Size: small

### S05-007: `VERSION_TIMEOUT_MS` is a second time limit for tool runs

- Where: `packages/cli/src/config/tools/install.ts:3`; uses at `packages/cli/src/tools/contracts.ts:92,425` and `packages/cli/src/tools/npm/public.ts:181`
- Kind: delete
- Problem: The `--version` runs, `mise which`, and the package manager version read use a fixed 15 seconds through
  three `runBlocking(..., { timeoutMs: VERSION_TIMEOUT_MS })` calls. Every other tool run uses `tool_timeout_seconds`.
  The owner allows one time limit per concern; ROOT-021 deletes `DOWNLOAD_TIMEOUT_MS` for the same reason.
- Fix: Delete the constant. These three runs take the one tool timeout, as `runTool` does (EXG-030). The synchronous
  callers get the value from the session (`ToolSearch`).
- Size: small

### S05-008: `npm_config_` is written by hand six times beside `NPM_SETTING_PREFIX`

- Where: `packages/cli/src/config/tools/npm.ts:11`; `packages/cli/src/tools/npm/contracts.ts:208,211,238`; `packages/cli/src/tools/npm/lockfiles.ts:29,30`; `packages/cli/src/tools/npm/public.ts:66`; `packages/cli/src/tools/npm/yarn.ts:35`
- Kind: simplify
- Problem: `registryEnvironment` writes `npm_config_<key>` from `NPM_SETTING_PREFIX`, but five more places read
  `npm_config_registry` or `npm_config_userconfig` as literals (`git grep -n "npm_config_" -- packages/cli/src`).
- Fix: Keep `NPM_SETTING_PREFIX` in `config/tools/npm.ts`, and build every one of these keys from it.
- Size: small

### S05-009: The uv relocation flags serve a move that no longer happens

- Where: `packages/cli/src/config/tools/python.ts:3` (`--relocatable`), `packages/cli/src/tools/python/public.ts:71` (`UV_VENV_RELOCATABLE`, `UV_LINK_MODE: 'copy'`)
- Kind: delete
- Problem: The virtual environment is built in a scratch folder and then copied into `.gspot/.venv`. `--relocatable`
  and `UV_VENV_RELOCATABLE` keep it working after the move, and `UV_LINK_MODE=copy` avoids hard links into the uv cache
  across folders. With LIF-001, uv builds `.venv` in place, and checks in a scratch copy run the tools from the working
  tree (`installedRoot`, through `searchDirectories`), so nothing moves it.
- Fix: Drop `--relocatable` from `UV_VENV_ARGUMENTS`, and `UV_VENV_RELOCATABLE` and `UV_LINK_MODE` from `runUv`. Keep
  `UV_PROJECT_ENVIRONMENT`, pointed at `.gspot/.venv`. One real install on each operating system confirms it.
- Size: small

### S05-010: `readToolVersion` writes its own tool environment

- Where: `packages/cli/src/tools/contracts.ts:426`, `packages/cli/src/config/tools/install.ts:20`
- Kind: simplify
- Problem: `runTool` passes `TOOL_ENV` (`NO_COLOR`, `FORCE_COLOR`). `readToolVersion` writes `{ NO_COLOR: '1' }` by
  hand, so version reads get a different environment.
- Fix: `readToolVersion` spreads `TOOL_ENV` (in `config/tools/run.ts`) before `tool.env`.
- Size: small

### S05-011: The `config/tools/!(vale).ts` glob in `gspot.toml` has no job left

- Where: `packages/cli/src/config/tools/vale.ts`, `gspot.toml:120,135`
- Kind: simplify
- Problem: `gspot.toml` lists `config/tools/!(vale).ts` so that `config/tools/vale.ts` falls under another
  architecture module, which lets generation and install both import `VALE_PACKAGES` and `VALE_PACKAGE_FOLDERS`. Under
  the import rule every module may import `config/`, so the glob has no job. `PACKAGE_FOLDERS` has no user outside the
  file.
- Fix: Keep `config/tools/vale.ts` with `VALE_PACKAGES` and `VALE_PACKAGE_FOLDERS`. Inline `PACKAGE_FOLDERS` into
  `VALE_PACKAGE_FOLDERS`, and delete the glob from `gspot.toml`.
- Size: small

### S05-012: Registry settings for an install in `.gspot/` can leak a token or overwrite a generated file

- Where: `packages/cli/src/tools/npm/contracts.ts:42-69`, `packages/cli/src/tools/npm/yarn.ts`, `packages/cli/src/tools/python/public.ts:28-36`
- Kind: move
- Problem: With LIF-001 the tools install straight into `.gspot/`, a tracked folder. Today `writeNpmrc` and
  `yarnSettings` write the registry settings for one run into a scratch folder outside the repository, with
  `${GSPOT_..._n}` references instead of the values ("so the temporary .npmrc contains no credentials",
  `tools/npm/contracts.ts:60-69`). Copying the repository's own settings into `.gspot/` instead would do harm:
    - a copied `.yarnrc.yml` overwrites the `.gspot/.yarnrc.yml` that gspot generates for Yarn Berry
      (`generation/public.ts:271-275`);

    - a copied `.npmrc` can hold a literal token, and the gitignore block lists only `node_modules/`, `.venv/`, `vale/`,
      `state/`, and the style folders, so `git add .` would commit it;

    - `writePythonSettings` writes the index URLs with their values filled in, which can hold a password.

- Fix: Copy nothing into `.gspot/`. Keep the helpers that write only references:
    - `writeNpmrc` writes `.gspot/.npmrc` for one package manager run and removes it in a `finally`; the gitignore block
      lists it.

    - `yarnSettings` writes the generated settings plus the connection references to `.gspot/.yarnrc-install.yml`, which
      Yarn reads through `YARN_RC_FILENAME`, so the generated `.gspot/.yarnrc.yml` stays as written. It is removed in a
      `finally`, and the gitignore block lists it.

    - `writePythonSettings` writes `uv.toml` into a scratch folder outside the repository, and uv gets `--config-file`.

    Rename `credentialsOf` to `registryCredentials`, and keep it and `addEnvironmentReference` in `tools/npm/project.ts`.
    The three Yarn schemas (`yarnConnectionSettingsSchema`, `yarnConfigEntrySchema`, `yarnSettingSchema`) stay, in
    `tools/npm/yarn.ts` beside `yarnSettings`, their one reader. One real run confirms the Yarn and uv flags.

- Size: medium

## The mise tool project

`miseFile` in `packages/cli/src/generation/mise.ts` writes `.gspot/mise.toml` (`MISE_TOOL_PROJECT_FILE`) with only the
program tools (gitleaks, typos, uv, and others): no gspot pin, no Node pin, no `min_version` line, and no header
(INX-001, GEN-017). It is a generated file, written through the ownership log by `writeGeneratedFiles`
(`apply/write.ts`) in every repository. From this area, `misePins`, `pinOf`, `misePin`, and `uvPin` compute its pins,
and `gspot install` runs `mise trust` and `mise install <tool names>` on it in `.gspot/` (INX-006). The check for
tools pinned twice (`duplicateMisePins`, `TOOL_PROJECT_FILES`, `DuplicateMisePin`) is deleted (INX-007).

## Target layout

Each file says its job. `placement/` has the row for every function, constant, and type.

```text
packages/cli/src/
  rules.ts                     choose the rule files for the level; build the managed block of AGENTS.md
  configurations/
    manifests.ts               read the shipped manifest.toml files (no style checks)
    select.ts                  requirement closure, everyManifest, isConfigurationSelected
    tool-pins.ts               tool pins, misePins, uvPin, missingBuild
    unknown-names.ts           "there is no configuration or check called X" messages
  apply/
    write.ts                   writeGeneratedFiles, pruneToolFolders
    stale.ts                   findStaleFiles, compareLintRules, isStray, expectedPaths
    version-pin.ts             read, write, and assert the version pin
  install/
    install.ts                 installTools, one function
    hooks.ts                   planHooks, installHooks, hookStatus, otherHooks
    vale.ts                    installValePackages, hasValePackages
  ownership/
    log.ts                     openOwnershipLog, readOwnershipLog, applyPlans, identify, isRecorded
    log-schema.ts              zod schema of ownership.json
    plans.ts                   planReplacement, planBlock, planManagedKeys, planDeletion, planRestoration
    managed-keys.ts            gspot's keys inside a user's JSON or TOML file
  commands/
    init/selection.ts          selectForInit
    reconcile.ts               reconcileConfigurations
    remove.ts                  gains requireChain
  planning/
    checks.ts                  planRun, configuredChecks, isActive, coveredInputs, coverageArguments
    files.ts                   which files a check runs on
    skips.ts                   why a check is skipped (settingsSkip, systemSkip, toolIgnore, skipFor)
    needed-tools.ts            neededToolManifests, requiredToolNames, checkCompanions, licenseProjects
  tools/
    find.ts                    inspectTool, locate programs, installHint
    versions.ts                readToolVersion, toolVersionState, packageVersion, isBelowFloor
    run.ts                     runTool
    lockfiles.ts               staleLockfiles, recordLockfile, prepareLockfiles
    diagnostics.ts             installationDiagnostics with password redaction
    npm/project.ts             npm, pnpm, Yarn, and Bun lockfile and install; registry settings
    npm/lockfiles.ts           lockfile match, registry URL removal
    npm/yarn.ts                yarnSettings and the three Yarn schemas
    python/project.ts          uv lockfile and install
    python/settings.ts         uv index settings
```

## config/ and types/ files

Values written inside function bodies in this area (Git arguments, file names, tool names, patterns) move to these
files with plain UPPER_CASE names.

| File                                 | What it holds                                                                                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config/apply.ts`                    | `DIFF_CONTEXT_LINES`, `RETAINED_PATHS`, `CONFLICT_MARKERS`                                                                                                                                                                                                               |
| `config/ownership.ts`                | `OWNED_KINDS`, `ADOPTED_KINDS`, `OWNERSHIP_JSON_INDENT`, `MANAGED_KEYS_FORMATS`, `OWNERSHIP_LOG_FILE`, `WRITER_LOCK_FILE`, the log version, the hash pattern, the managed-key file extensions                                                                            |
| `config/install.ts`                  | `HOOK_COMMAND` (`gspot check --hook`), `SET_HOOKS_PATH` and `UNSET_HOOKS_PATH` (built from `HOOKS_PATH_SETTING` in `config/repository/hooks.ts`), the `mise trust` and `mise install` steps, `VALE_INSTALL_ARGUMENTS`                                                    |
| `config/rules.ts`                    | the two closing paragraphs of the managed block (CMD-084)                                                                                                                                                                                                                |
| `config/commands/init.ts`            | `NO_CONFIGURATIONS`                                                                                                                                                                                                                                                      |
| `config/generation/hooks.ts`         | `RUNNERS`, keyed by `RUNNER_NAMES`, with the pin install command of each start command                                                                                                                                                                                   |
| `config/configurations.ts`           | `RULES_FOLDER`, `MANIFEST_FILE`, the configuration and Semgrep folders, `SEMGREP_TOOL_FILE`, `SOURCE_GROUPS`, the Python configuration name                                                                                                                              |
| `config/planning.ts`                 | `FLAG_VALUE`, `LICENSES_CONFIGURATION`                                                                                                                                                                                                                                   |
| `config/parsers/dependency-files.ts` | `PACKAGE_JSON`, `PYPROJECT_TOML`                                                                                                                                                                                                                                         |
| `config/parsers/lockfiles.ts`        | the lockfile names, read from its existing table                                                                                                                                                                                                                         |
| `config/tools/diagnostics.ts`        | `REINSTALL_HINT`, `INSTALL_OUTPUT_LIMIT`, `HTTP_URL`, `URL_CREDENTIALS`, the redaction mark                                                                                                                                                                              |
| `config/tools/run.ts`                | `TOOL_ENV`, `VERSION_FLAG`                                                                                                                                                                                                                                               |
| `config/tools/find.ts`               | the search folders, `NPM_BIN_FOLDER`, the mise program and shims, `AVAILABLE_TOOL_STATES` (`['ok', 'system', 'newer']`)                                                                                                                                                  |
| `config/tools/npm.ts`                | the npm tool project: arguments, `NPM_SETTING_PREFIX` and the other setting prefixes, connection and credential keys, `NPM_SCOPE_REGISTRY_KEY`, `REGISTRY_AUTH_KEY`, `NPMRC_FILE`, `YARN_INSTALL_SETTINGS_FILE`, the Yarn settings                                       |
| `config/tools/python.ts`             | the uv arguments, index settings, URL scheme, uv tool name, `UV_SETTINGS_FILE`                                                                                                                                                                                           |
| `config/tools/vale.ts`               | `VALE_PACKAGES`, `VALE_PACKAGE_FOLDERS`, the Vale tool name                                                                                                                                                                                                              |
| `types/apply.ts`                     | `WriteRequest`, `ApplyReport`, `StaleFile`                                                                                                                                                                                                                               |
| `types/install.ts`                   | `InstallationResult`, `HookContext`, `HookStatus`, `HookPlan`, `ValeInstallation`                                                                                                                                                                                        |
| `types/ownership.ts`                 | `OwnershipLog`, `OwnershipState`, `OwnedFile`, `OwnedKind`, `PendingWrite`, `Identity`, `WritePlan`, `Outcome`, `OwnedBlock`, `PlannedBlock`, `ReplacementRequest`, `Restoration`, `ManagedKeys`, `ManagedKey`, `KeyChangeRequest`, `KeyChangePlan`, `KeyChangeContents` |
| `types/rules.ts`                     | `RuleFile`, `RuleSource`                                                                                                                                                                                                                                                 |
| `types/commands/init.ts`             | `InitOptions`, `InitDetection`, `InitSelection`, `InitInputs`, `ConfigurationReason`, `ConfigurationChoices`, `CiChoice`                                                                                                                                                 |
| `types/repository/selection.ts`      | `ConfigurationReconciliation`, `ConfigurationLists`                                                                                                                                                                                                                      |
| `types/planning.ts`                  | `Session` (one type; `ToolSession` merges into it)                                                                                                                                                                                                                       |
| `types/tools/find.ts`                | `ToolState`, `Inspected`, `ToolInspection`, `AvailableToolInspection`, `ToolSearch`, `LocateOptions`                                                                                                                                                                     |
| `types/tools/run.ts`                 | `ToolRunOptions`, `ToolAvailability`, `ExecutionFailure`                                                                                                                                                                                                                 |
| `types/tools/project.ts`             | `StaleLockfile`, `NpmClientRun`, `NpmClientCommands`, `PythonPreparation`, `PythonToolLockfile`, `PythonRequirement`, `PythonSettingsSources`, `PythonIndexSettings`                                                                                                     |

`types/tools/{install,npm,python,session}.ts`, `types/lifecycle/*`, `config/lifecycle/*`, and `config/tools/mise.ts`
end empty and go.

## Type rule

These files break the import rule today (`config/` imports only `config/`; `types/` imports only `config/` and
`types/`), and this is the fix for each:

- `config/lifecycle/ownership.ts` imports the type `OwnedKind`. Write `OWNED_KINDS` `as const` in
  `config/ownership.ts` and build `ADOPTED_KINDS` from it in the same file; `OwnedKind` is
  `(typeof OWNED_KINDS)[number]` in `types/ownership.ts`.
- `config/tools/mise.ts` imports `ToolProjectPackage`. The file goes with `TOOL_PROJECT_FILES` and its one user,
  `duplicateMisePins` (INX-007).
- `config/tools/npm.ts` imports `PackageInstaller`. Write `LOCKFILE_ARGUMENTS` and `INSTALL_ARGUMENTS` `as const`; the
  caller indexes them by client name.
- `types/lifecycle/ownership.ts`, `types/lifecycle/merge.ts`, and `types/tools/python.ts` import zod and schemas.
  `OwnershipState`, `OwnedFile`, `Identity`, `PendingWrite`, `OwnedBlock`, `ManagedKey`, and the key change types are
  written by hand in `types/ownership.ts`, and `PythonToolLockfile` and `PythonRequirement` in `types/tools/project.ts`.
  Each schema is checked against its type: `SchemaShape<T>` on object literals, `satisfies z.ZodType<T>` on the rest.
- Every other exported type of this area is written by hand in `types/` too, also the ones that name a schema type
  (`HookContext`, `ValeInstallation`, `Inspected`, `ToolSearch`, `InitOptions`, `WritePlan`, `OwnershipLog`,
  `Session`).
- The installed tool folders are the `as const` list `INSTALLED_TOOL_FOLDERS` in `config/`; `InstalledToolFolder` in
  `types/configurations.ts` is built from it.
