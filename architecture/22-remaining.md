# Remaining Work

This document is the index of everything that is left, in the order it is done. Nothing below is
built. The evidence of a row is in [18-gaps.md](18-gaps.md). How it is fixed, with the files, the
logic, what goes, and the tests, is in its fix file under [fixes/](fixes/README.md). The tree the
fixes lead to is [16-file-tree.md](16-file-tree.md). A line leaves this document in the commit
that closes its row.

## The order

The order is fixed by D-121. K-298 through K-301 are prerequisites of the affected lifecycle, hook, naming, and adoption steps, not work deferred until after launch. K-302 follows the release and manual.

1. Leave yap-swift-app unchanged while implementing and verifying gspot.
2. Delete what nothing uses: [00-delete-first.md](fixes/00-delete-first.md). A thing with a
   replacement is deleted in the commit that builds the replacement (K-282).
3. Close the other wrong answers of [01-first-fixes.md](fixes/01-first-fixes.md).
4. Do the rows of the Adoption phase in the order of the fix files, from
   [02-takeover.md](fixes/02-takeover.md) to [20-self-check.md](fixes/20-self-check.md), and then
   [23-scenarios.md](fixes/23-scenarios.md).
5. Complete the launch-code and documentation implementation, including the visual assets,
   before the app handoff. Public publication, production deployment, and app-derived evidence
   are later gates, not reasons to defer code fixes. Pass the implementation gate below.
6. Follow the app handoff below: delete only the old local `chore/gspot` branch, create
   `chore/gspot-adoption`, install the packaged candidate from the local registry (D-158), and
   measure it. Push nothing there. Ask the owner before any other real repository.
7. Incorporate the app evidence into the manual and case study. Fix every gspot defect exposed
   by adoption, rerun the affected tests and the complete implementation gate, and repeat the
   app acceptance. Then complete public-release prerequisites in [22-launch.md](fixes/22-launch.md)
   and production deployment in [21-documentation.md](21-documentation.md).

### Implementation gate before touching the app

This is the authoritative handoff gate for D-121. Fix-file numbers are subject grouping, not
permission to postpone dependencies.

Apply K-298 and K-299 before destructive lifecycle work.
Apply K-300 and K-308 before changing schemas and callers. Apply K-301 before accepting
recommended output. Apply K-303 through K-307 before relying on generation, packaging, or harness results.

Integrate
scenario tests from file 23 with their owning features. Complete file 22's code and package
validation before the handoff; only registry ownership, actual public publication, deployment,
and adoption-derived measurements remain external or post-adoption gates.

The implementation turn must supply the concrete per-step patches required by the repository
planning guide before applying each bounded change. These architecture contracts are not a
prewritten patch for the entire codebase. Missing implementation details must be resolved
against the owner contract, not silently treated as permission to choose a different product.

Record the source revision, candidate version, artifact hashes, command exit statuses, and CI
run URL as evidence for this gate. All results must refer to the same candidate revision:

1. Close the applicable fix acceptance criteria, including unit, integration, planted-repository,
   lifecycle recovery, snapshot, hook, documentation, and release-package tests. Run the full
   implemented test suite and its coverage floors. Required tests must not be skipped.
1. Build all supported release targets and validate the launcher, platform packages, plugin,
   embedded resources, notices, schema, and sample install from the local registry. Exercise
   supported-platform checks in CI; a local macOS pass is not Windows or Linux evidence.
1. Run the candidate binary on gspot itself, with `level = "all"`, strict check coverage,
   no ignore entries, no local skip file, and no temporary rule disabling. Run
   `gspot check --no-cache`, `gspot check --stage manual --no-cache`, and `gspot doctor`.
1. Every required check must execute and pass. A missing tool, setup error, or skipped required
   check is not a clean result. Any fixes invalidate the previous result until rerun.
1. Verify apply is idempotent and install preserves tracked content in a disposable clean
   checkout. Build and check the manual there, including samples, links, reference contracts,
   and the asset acceptance requirements. Inspect unexpected tracked or untracked output.
1. Exercise real commit and pre-push hooks in fixture repositories, including rejection cases
   and existing-hook chaining. Do not create a dummy app commit to test the hooks of gspot itself.
1. Read the successful CI jobs for that exact revision, not merely the workflow configuration
   or an older green badge. If CI access or an environment is unavailable, report the gate as
   blocked and keep the app branch intact.
1. Repository pushes and commits still require the authority applicable to that implementation
   turn. This review authorizes neither.
1. As the last check before any authorized gspot commit, run `gspot check --staged`. A staged
   pass complements, and never replaces, the full candidate checks above.

### App handoff and branch replacement

The user authorizes deletion of the old local `chore/gspot` branch only after the gate above.
No second approval for that exact deletion is needed once its identity and gate are verified.
This is not authority to delete other branches, remote refs, uncommitted work, or ignored files.

Read-only inspection on September 20, 2026 found a clean checkout on `chore/gspot`, tip
`ca2594d1f`, and local `master` at `aa4358be4`, with `origin/HEAD` pointing to `origin/master`.
Four commits exist on the old branch beyond local `master`. These are observations, not frozen
execution inputs. Re-read status, branch tips, default-branch tracking, and worktrees when the
handoff begins. Inspect any changed branch history before deletion; do not discard new work
under the old authorization without establishing that it belongs to the obsolete migration.

Run read-only preflight from `/Users/dr_stone/Documents/work/yap-swift-app`:

```shell
git status --short --branch
git branch -vv
git worktree list
git symbolic-ref refs/remotes/origin/HEAD
git rev-parse chore/gspot master
git log --oneline master..chore/gspot
```

Proceed only with a clean tracked and untracked worktree and no other worktree using the old
branch. Do not use reset, clean, stash, or an automatic pull to manufacture that condition.
Record the full old tip and chosen base in the handoff report before deleting the ref. The
chosen base is local `master`, after checking that it is the intended app baseline and recording
its relation to the already available `origin/master`; do not silently change it to another ref.
If `chore/gspot-adoption` already exists, inspect and report it rather than overwriting it.

After these checks and the implementation gate, the exact local branch operations are:

```shell
git switch master
git branch -D chore/gspot
git switch -c chore/gspot-adoption master
```

The old branch's unmerged commits are deliberately discarded from its branch ref. The recorded
tip and local reflog can assist recovery while objects remain, but are not a permanent backup.
No remote deletion or push is part of this procedure. If interrupted, inspect current refs and
resume from the observed state; do not blindly repeat the deletion sequence.

Install the verified candidate launcher, platform package, and plugin through the isolated
local registry of D-158, never `file:../gspot` or a workspace import. Record the registry setup
command and artifact identity in the implementation handoff before using it. Keep credentials
and registry routing local to the process. Verify that generated configs and lockfiles contain
no machine-local dependency path, registry URL, or credential. A fresh install must resolve the
same candidate through the configured registry without changing tracked files.

Run `gspot init` and read the plan before accepting takeover. Read every resulting written or
removed file. Run `gspot check --no-cache`, `gspot check --stage manual --no-cache`, and
`gspot doctor`; record timings, findings, tool versions, retained files, and recovery behavior
in `GSPOT-MIGRATION.md`. Validate the hooks without pushing to the app remote. Keep app source
findings separate from gspot defects. Do not introduce baselines or ignores to manufacture green.

All gspot tests and self-lint must pass before this handoff. The existing app is not promised to
pass without app-source fixes, which remain outside this migration. Report those findings
honestly. A gspot crash, false positive, wrong location, missing required tool, lost policy,
unsafe mutation, or failed recovery blocks adoption completion. Fix it in gspot, rerun the gate,
and retry. Do not declare completion with such a defect merely added to the backlog.

Leave the app diff on `chore/gspot-adoption`, with no push. Commit only when authorized and after
its staged checks pass. Do not bypass hooks to create migration commits. Request direction if
app findings prevent a commit. Keep the validated migration uncommitted and leave its report available.

### Review status

The September 20, 2026 integrity review makes this architecture ready to start implementation
as a target specification. It does not claim that the code is complete or that every future
adoption finding is predictable. The implementation gate and app acceptance above remain
mandatory.

The review verified 100 Markdown documents and their local file links. It checked
coverage of all 328 gap rows in the fix documents and this checklist. It also checked the seven
required fields of each fix section. These checks establish structural consistency, not runtime correctness.

External launch prerequisites remain explicit: registry ownership and publishing credentials,
CI access, supported-platform execution, and site hosting/domain access. An unavailable external
prerequisite blocks its gate, not the unrelated implementation work. No green test, release,
deployment, or app adoption is inferred from this documentation review.

## Every row, by fix file

One line for each row. A script builds this list from the fix files, and a row with no section in
exactly one fix file fails it.

### Delete First

[00-delete-first.md](fixes/00-delete-first.md)

- [ ] D-129: Delete `gspot declare`, six of the seven lists of `gspot allow`, `uninstall --keep-hooks`, and `apply --check`. File explanations are implemented by `explain <path>`.
- [ ] D-100: Delete the twelve lint stubs at the root of this repository.
- [ ] K-47: Delete the nine `copy = true` stubs and `copyStubContent` (D-100).
- [ ] K-99: Delete the five `architecture.*` keys nothing reads, and `[editor] vscode`.
- [ ] K-100: Delete `limits.line_length`, `limits.trivial_ast_nodes` and `tools.trufflehog.verified_only`.
- [ ] K-102: Delete `no-trivial-functions` and its option; `no-call-through` covers every function form (see K-235 for the other languages).
- [ ] K-187: Delete the plugin rules `no-single-file-folders` and `no-prefix-collisions`; the structure engine owns facts about folders.
- [ ] K-188: Delete the five plugin rules a pinned tool covers, and write the rule of that tool in the template.
- [ ] K-104: Delete `Session.problems`, `PlanOptions.fix`, and the manifest key `conflicts`.
- [ ] K-129: Delete `docsBase`, `ExistingTool.owned` and `RunRecord.root`.
- [ ] K-111: Delete the `lint:justify` and `lint:allow-...` markers.
- [ ] K-115: Delete the `finding` key of `[[ignore]]`.
- [ ] K-119: Delete the branch for an engine that is not built, and keep the comment openers and `UNPARSED_LIMIT` once.
- [ ] K-146: Remove the word `corpus` from the 34 places in the source.
- [ ] K-180: Delete the manifest keys `executable` and `ubi`, and the three readers of `ubi`.
- [ ] K-195: Delete the pin of `pyproject-fmt` from the python preset.
- [ ] K-240: Delete the runner value `uv` until a reference repository needs it.
- [ ] K-205: The docs build runs `reference-pages.ts` first, the pages are git-ignored, and the `docs/generated` check goes.
- [ ] K-259: Drop the scratch entry from `.gitignore`, run pytest of the tests in their own folder, and move the managed block to the end of the file.
- [ ] S-10: The Vale half of the rules lint goes, and the rule files are read by `prose/vale` like every other text.
- [ ] K-282: Delete a thing in the commit that builds what replaces it.
- [ ] K-290: Delete the baseline, the first check of `init`, and every run that `add`, `upgrade`, and a level change start (D-165).

### The First Fixes

[01-first-fixes.md](fixes/01-first-fixes.md)

- [ ] K-36: Take `setup.cfg` and `tox.ini` off the sqlfluff path list, and never delete a file more than one tool reads (D-109).
- [ ] K-156: Run `drizzle-kit generate` over a copy in the cache and compare; never write into the tree, never run `git clean`.
- [ ] K-159: Make `express/openapi-fresh` write back the text it read, and never run `git checkout`.
- [ ] K-257: Write every file through a temporary file and a rename, and let a failed cache write be one line on stderr.
- [ ] K-252: Report a run whose report cannot be written in one line on stderr, and keep its findings and its exit code.
- [ ] K-140: Report `missing` when ast-grep is absent, and batch its file list.
- [ ] K-157: Let a check declare the setting it waits for, and report `skipped` with that name when it is unset.
- [ ] K-254: Run `bash -n` over Bash files alone, `zsh -n` over `.zsh` files, and `bats --count` over `.bats` files.
- [ ] K-258: Make `perFileCommands` put the file where `{file}` stands, pass `--no-env-resolution` to Compose, and test the check on a file with an `env_file`.
- [ ] K-37: Take the bare name `hooks` out of `HOOK_DIRECTORIES`.
- [ ] K-45: Write no report for a run of the `message` stage (D-105).
- [ ] K-61: Rename `packages/cli/rules-lint` to `packages/cli/rules` and the alias to `#rules/*`.
- [ ] K-108: Make a missing `[hooks]` table mean gspot does nothing there, as `[ci]` and `[runner]` do (D-130).
- [ ] K-109: Never inject a lifecycle script; replace an existing lint task only with explicit acceptance and recoverable originals.
- [ ] K-114: Let a `gspot-ignore` comment work for every check an engine runs. The test reads the engine of the check, not its name.
- [ ] K-134: Require `inherit_errexit` only where the header declares Bash 4.4, and list it among the Bash 4 features.
- [ ] K-147: Run `check` with the rest of the config when one line is wrong, and report that line as a finding.
- [ ] K-172: A route counts as tested when a test file of the same scope imports it.
- [ ] K-178: Report a SQL statement at its own line when a block comment stands above it (K-161).
- [ ] K-181: The loader passes the parsed config on whole, as it does for a check, so no key can be left out again.
- [ ] K-186: The rule skips the entry files the repository names in `tools.knip.entry`, which is the one list of entries gspot already keeps.
- [ ] K-189: The rule reports an import whose target leaves the top-level folder of the importer, which is what its summary says.
- [ ] K-192: A name the repository cannot change is exempt from every name check, in `nameProblems`, once.
- [ ] K-206: An installer that numbers differently carries its own version beside its name, and a release test asks each registry for every pin.
- [ ] K-226: The check builds the references (`tsc -b --noEmit`) where the file holds any.
- [ ] K-229: The items are restored from the reference repositories. The lint of the rule files reports a list item that stops with no sentence end.
- [ ] K-234: Let each manifest declare the suppression comment of its tool, and read that list for every comment style. Delete the table in `config/integrity.ts` (K-110).
- [ ] K-110: Keep one list of suppression forms (K-234).
- [ ] K-238: Validate semantic values and serialize strings, keys, paths, and comments for each destination format; test printable quotes and backslashes as well as forbidden controls.
- [ ] K-241: Settle each of the nine contradictions in the rule file, on the side of the decision or the check. Test the rule names a rule file names against the templates.
- [ ] K-246: Ship `integrity/generated-drift` in the structure preset. Build `integrity/generated-fresh` with `[[generated]]`, or take its name out of every document.
- [ ] K-250: Make the two SPDX packages and the Markdown parser dependencies that do their job. Use or drop each other library the two documents name.
- [ ] K-251: Drop `--skip-updates` from the dotenv fixer, give v8r its config through `V8R_CONFIG_FILE`, and fail the contract test on a flag the pinned tool lacks.
- [ ] K-253: Make the workflow gspot writes follow `GITHUB-ACTIONS.md`: a pinned runner image, a timeout, and a concurrency group. Name the tasks as D-116 decides.
- [ ] K-261: Correct every good example that fails a check, and make `rules/lint` run the linter of the preset over each fenced good example.

### Takeover and Detection

[02-takeover.md](fixes/02-takeover.md)

- [ ] K-193: Resolve every governed file, preserve path-specific rules through overrides and ignores, and retain original configuration whenever behavior cannot be carried without loss.
- [ ] K-41: Read disabled ESLint rules from the rules table of the old config alone (K-193).
- [ ] K-182: A language that has a project file is proposed from that file, as D-108 proposes a scope: `pyproject.toml`, `package.json`, or `Package.swift`.
- [ ] K-214: Init says that the folder is no git repository, and a preset whose checks all need git is not proposed there.
- [ ] K-247: Recommend a tool preset only where the repository holds that tool, and write a stub only where D-100 allows one. Read a declared workspace from `package.json` with no lockfile.
- [ ] K-120: Read the format of a repository from every Prettier form, `.editorconfig` and Biome before proposing one.
- [ ] K-126: Read dependencies from `requirements.txt`, Poetry tables and `Pipfile` too.
- [ ] K-128: D-140 adds the two component endings.
- [ ] K-42: Send fixer files through `fileBatches`, and report a fixer that exits nonzero.
- [ ] K-158: Closes with K-42: batch the pages and stylesheets.
- [ ] K-76: Read mise tasks from `.mise/tasks/` files too.
- [ ] K-78: Check the gspot line of the hooks for every value of `hooks.tool`.
- [ ] K-237: The list holds the packages of tools a preset pins, read from the manifests, and nothing else.

### Hooks, Explicit Setup, and Shared Manifests

[03-hooks.md](fixes/03-hooks.md)

- [ ] K-56: Make init read what a hook calls, and put the gspot line in that task (D-114).
- [ ] K-57: Never set `core.hooksPath` where a tracked file sets it, and say when a clone runs no hooks (D-115).
- [ ] K-58: Propose new bodies for the `lint` and `format` names a repository has, and write `gspot:*` only where none exists (D-116).
- [ ] K-59: Read lint tables of `pyproject.toml` and lint keys of `package.json`, carry them, and list them under remove by hand (D-117).
- [ ] K-60: End a failing hook run with `git commit --no-verify` and the command that reproduces it.
- [ ] K-292: Never set `core.hooksPath`; compose hooks with reachable dispatch, argument forwarding, independent stdin replay, failure propagation, and ownership-aware restoration (D-167).

### Slow Checks and the Cache

[04-speed.md](fixes/04-speed.md)

- [ ] K-43: Hash `.gspot/` once for a run, key each check on the config files it names, and hash files without base64 (D-102).
- [ ] K-44: Drop cache entries older than 30 days, and move the Swift build folder to the cache folder of the platform (D-102).
- [ ] K-71: Closes with K-44.
- [ ] K-53: Make init open one session, apply once, install the tools, and run no check (D-165).
- [ ] K-127: Make `upgrade` run no check, and print an image finding as one line.
- [ ] K-125: Read the first bytes of a file, not the whole file, for `head`, the binary sniff, and the banner.
- [ ] K-138: Parse each source file once for both naming checks.
- [ ] K-148: One parsed set for a scope and a run, shared the way the shell index is.
- [ ] K-143: Build Swift incrementally for `swift/build`, and keep the clean build for the analyzer at the `manual` stage (D-122).
- [ ] K-162: Read migration history with one `git ls-tree` and one `git diff`.
- [ ] K-176: Map the borrowed extensions under `[formats]` in `vale.ini`, so every file goes by path in one run for each extension.
- [ ] K-196: D-102 gets its measure. The timed test of the tools table runs each check on the planted repository of its preset, and a check over the ceiling is at `push`.

### The Files gspot Writes

[05-written-files.md](fixes/05-written-files.md)

- [ ] A-5: End `init` by naming the fix run, and delete `gspot.local.toml` with everything that reads it (D-173).
- [ ] K-72: Add one managed block to `.gitattributes`: `.gspot/** linguist-generated`.
- [ ] K-118: Apply one ownership contract across apply, remove, and uninstall; preserve unmarked files and modified managed outputs, including the hand-made gitleaks baseline.
- [ ] K-296: Build the `.gitignore` block from the manifests, and create the file where none exists (D-170).

### The Config Text and Scopes

[06-config.md](fixes/06-config.md)

- [ ] K-51: Write scope settings as sub-tables, and fix the writer so both forms load (D-106).
- [ ] K-88: Accept `src` as `src/**`, and allow a scope inside a scope.
- [ ] K-89: Rename `PolicyScopeLayer`, and keep `slot`, `surface`, `direction` and `exposes` out of text a person reads.
- [ ] K-116: Accept the `json` output format in a `[[check]]` of the repository.
- [ ] K-215: D-144, with the table in [19-names.md](19-names.md) and a test over the manifests.
- [ ] K-224: Each changes in the commit of its rename.
- [ ] K-228: The two switches go, and the name becomes `xcode/asset-catalogs`.
- [ ] K-222: The YAML block leaves the EditorConfig template, so one value holds for every tool.
- [ ] K-48: Propose a scope for every folder with a project file, and keep scope files under `.gspot/<scope>/` (D-108).

### Levels

[07-levels.md](fixes/07-levels.md)

- [ ] K-198: Each template renders by level. `recommended` holds the recommended set of each tool and the rules that find a defect, and `all` holds the rest (D-119, D-126).
- [ ] K-52: Mark each opt-in SwiftLint rule `recommended` or `all`, and render by level (D-110).
- [ ] K-221: With K-198, each template renders by level.
- [ ] K-101: Keep in `recommended` of the plugin the rules that find a defect, and add an `all` config for the rest.
- [ ] K-135: Split `structure/shell-interpreter` so strict mode and the `mktemp` trap are checks of their own at `recommended`.
- [ ] K-141: Move the default-owner, underscore, doc-section and ordering rules of shell to the `all` level.
- [ ] K-142: Keep the shell defect checks at `recommended`: discarded failures, unchecked `cd`, recursive remove, broad `pkill`, `mktemp` with no trap, unread arguments, and duplicate or unused functions.
- [ ] K-123: Delete the `run_ssh`, `_CFG_<NAME>_READY`, `nvidia-smi` and `/root/.cache` checks from the bash preset.
- [ ] K-152: Move the seven Python style checks to the `all` level.
- [ ] K-151: Run `integrity/dependency-ownership` only where the scope holds a Python lockfile (`uv.lock`, `poetry.lock`, `pdm.lock`).
- [ ] K-227: The docstring style is read from the `[tool.pydoclint]` or `[tool.ruff.lint.pydocstyle]` table of the project, and both checks belong to the `all` level. The pytest preset names `pytest-cov` as a tool.
- [ ] K-174: The check belongs to the `all` level.
- [ ] K-161: Move `sql/block-comments` to the `all` level, and teach the SQL reader block comments once (K-178).
- [ ] K-167: The postgres preset ships `client_schemas = []`, and the supabase preset sets `["public"]`, which a platform preset may do.
- [ ] K-112: Keep one README contents rule, at the `all` level, that does not clash with the banned heading.
- [ ] K-200: The preset is `proposed`, as `security` and `licenses` are, and the scope list holds what `tools.commitlint.scopes` names and nothing else.
- [ ] K-175: `recommended` runs the `gspot` style alone, which is what `WRITING.md` tells an agent. The `all` level adds the packages. The off list and the vocabulary move into the prose preset.
- [ ] K-201: The base holds the flags that only add errors, and every option that changes emit or resolution stays in the `tsconfig.json` of the repository.
- [ ] K-218: A shipped pack names the API of its framework and nothing else. A rule that names a function of one repository moves into that repository, under `tools.semgrep.rules`, in its migration.
- [ ] K-93: Detect the build command, the output folder, the assets folder and the Swift destination, or ask.
- [ ] K-230: A section of a rule file carries the level of the checks it describes, and the assembler leaves out a section above the level of the repository. `REACT.md` names the file after its component.

### Frameworks, Naming, and Lint Tools

[08-frameworks.md](fixes/08-frameworks.md)

- [ ] K-217: D-145.
- [ ] K-239: Closes with D-145: stop writing `prepare` and the pins into `package.json`.
- [ ] K-207: D-142. The pin is the newest ESLint every shipped plugin supports, and the registry test of K-206 reads each range.
- [ ] K-213: On ESLint 9 (D-142) the setting is `detect`, and `installedReact` goes.
- [ ] K-208: D-137. The list of code files holds the endings a framework claims, and one ESLint check reads it.
- [ ] K-209: D-138. The list stands in the manifest with its reasons, and a test compares the final config of a component file with that of a plain `ts` file.
- [ ] K-210: D-140, through `takes_over`, `claims`, and the plugins of each tool.
- [ ] K-211: D-141, and each rule file grows to what its linters enforce.
- [ ] K-212: The `jest` preset of D-141, with the same ten rules.
- [ ] K-50: Move framework names out of the shared naming policy into `[[naming.rules]]` of each framework preset (D-112).
- [ ] K-133: Move the `handle` exception out of the naming engine into the react preset (D-112).
- [ ] K-136: Accept PascalCase for component functions and files through `[[naming.rules]]` of each framework preset, and test react with naming on.
- [ ] K-49: Split the prefix with `naming/split.ts`, count source files alone as peers, and delete the copy in the plugin (D-111).
- [ ] K-137: Skip only a dynamic `import()` in the TypeScript extractor, not every awaited value.
- [ ] K-233: The preset claims `.css` alone, and a `scss` preset that pins `stylelint-config-standard-scss` arrives when the owner or a reference repository asks for it (D-136).
- [ ] K-236: `licenses/npm` becomes one check that runs the scanner gspot already pins, and the supabase preset gains the lint at the `manual` stage.
- [ ] K-80: Closes with K-236.
- [ ] K-248: Carry the iOS and the Python Semgrep packs first. Build each other ledger row that names an unbuilt check, or mark it cut with its reason.
- [ ] K-249: Raise the eight pins that sit below what a reference repository runs, and fail the release test on a pin below the floor the ledger records.
- [ ] K-256: Write a nested SwiftLint file over the test folders the xctest preset claims, with the three rules off.
- [ ] K-264: Build `gspot install`, call it from `init`, `upgrade`, and both CI jobs, and name it in every message about a missing tool (D-156).
- [ ] K-265: Serve the launcher and the plugin from the registry of the harness, reached through `GSPOT_REGISTRY` (D-158).
- [ ] K-266: Install the Python tools from a generated `.gspot/pyproject.toml` into `.gspot/.venv` with uv (D-157).
- [ ] K-283: Count in the plan the binaries that need mise, and show the one line that installs mise and then all of them.
- [ ] K-267: Pass the registry settings of the root to the install under `.gspot/`, and keep it a project of its own under each package manager.
- [ ] K-268: Print one ignore hint for each tool of the developer that reads `.gspot/`, and report advisories in the lockfiles of gspot apart.
- [ ] K-297: Never block the setup on a missing tool, and install the npm tools with bun where no JavaScript exists (D-171, D-172).

### The Manifest Owns What the Preset Knows

[09-manifests.md](fixes/09-manifests.md)

- [ ] K-79: Register each analysis from the manifest of its preset, name it after its check name, and split `integrity/` by what it holds.
- [ ] K-39: Replace `OWNER_PRESET`, `CHECK_BY_TOOL` and the nine tool tables of `propose.ts` with keys the manifests hold.
- [ ] K-14: Move every owner row and check row of takeover into the manifest of its preset (K-39).
- [ ] K-107: Replace the hand-written fields of `CarriedLists` with a map keyed by tool, filled from the manifests (K-39).
- [ ] K-13: Delete `gspot allow gitleaks`, `osv` and `licenses` with the trim of D-131.
- [ ] K-38: Move each tool name, flag, banner and check name the core holds into the manifest of its preset.
- [ ] K-17: Take the preset names `swift`, `prose`, `typescript` and `commits` out of the core; a manifest key says what the core inferred from the name.
- [ ] K-85: Move the four version flags into `version_command` of their manifests, and hint the install of the runner the repository uses.
- [ ] K-113: Give a manifest a key for the page of a rule, and delete `TOOL_RULE_SOURCES`.
- [ ] K-177: The message comes from the install hint.
- [ ] K-203: The word list comes from the manifests.
- [ ] K-197: A fragment exports its selectors, and the template joins the selectors of every selected fragment into the one rule. The javascript template then names no library (D-139).
- [ ] K-223: D-139 covers them, and its test reads every template for a call of `has(`.
- [ ] K-199: No template holds a default.
- [ ] K-220: The entry list holds the entries the detected framework has, and what this repository needs stands in its own `tools.knip.entry`.
- [ ] K-105: Infer the config types from the zod schema, and keep each list of hook tools, runners, and CI providers once.
- [ ] K-183: The zod schema is the one owner, and the types are inferred from it.
- [ ] K-106: Move test-only types out of the types of the binary, and delete the two stale doc comments.
- [ ] K-55: Keep the default hooks folder name in one constant.
- [ ] K-77: Keep the path of the mise file and of `.gspot/hooks` in one constant each.
- [ ] K-124: Keep one `HOOK_DIRECTORIES` list.
- [ ] K-131: Keep `JSON_INDENT` and the mise file path once each.
- [ ] K-165: Keep the five release targets in one list, and stop embedding the `schema/` folder nobody reads.
- [ ] K-94: Closes with K-169.
- [ ] K-169: It moves to `profile/schema.ts`.
- [ ] K-24: Rename `bashText`, `bashList` and `bashSetting` of the structure context after what they read, for every language.
- [ ] K-139: Share one `add` function and one label table across the extractors, and pick a grammar from a table.
- [ ] K-171: Every check gspot owns counts code lines through `structure/code-lines.ts`, the summary says which languages a tool counts, and the pair of constants goes.
- [ ] K-190: One helper in `files.ts` takes the check and returns the listeners.
- [ ] K-40: Propose the types folder and the commit scopes from what the repository holds; write no `api/types`, `root`, `hooks` or `deps` by default.
- [ ] K-179: A general file that a preset lists installs with that preset, and the general files no preset lists install always. The core names no folder.
- [ ] K-232: The nextjs preset lists its second file. The swift preset lists the two framework files where the project imports that framework. A file with no preset to carry it is deleted (D-134) until a preset asks for it.
- [ ] K-231: With K-203, a language or framework file says what holds for every project of that kind. The rest moves into the repository it came from, during its migration.
- [ ] K-260: Cut each of the nine guides down to the rules of its library, and take every passage about one product out.
- [ ] K-242: Move the working habits of the owner out of the general rule files into a profile, and add `quality/` to the words the rules lint refuses.
- [ ] K-262: Write the six cut items of `DOCKER.md` and the broken sentences whole, and take each habit of the owner out of the twelve guides.
- [ ] K-255: Ship `integrity/locales` and its one setting from the i18n preset alone, and make the nextjs preset recommend i18n.
- [ ] G-13: Keep the constants of the plugin in one `config/` folder, as the CLI does.

### Tests

[10-tests.md](fixes/10-tests.md)

- [ ] T-27: `install()` expects exit 0 when every tool of the install is on the `PATH` it was given, and `plant()` fails when its pattern is absent.
- [ ] T-4: Use `install()` in the seven tests that run `init` through `run()`.
- [ ] T-8: Fail with a message about the machine when `toolsPath` cannot find a tool.
- [ ] T-21: The harness owns one builder of a whole `EngineInput`, and the four tests use it.
- [ ] T-9: Keep the init command line, the `package.json` literal and the tool lists in `tests/config/`.
- [ ] T-24: The planted installs of D-113 cover each value of `--runner`, `--hooks`, and `--ci` once, and one of them starts from a repository that has hooks and mise tasks.
- [ ] T-1: Add a planted install with the mise runner.
- [ ] T-2: Add a planted default `init` that runs in every test run, and drop `--without` where a preset is tested.
- [ ] T-32: In the release test of K-206, install the pins of every npm preset into an empty folder with each package manager, and run one check there.
- [ ] T-3: Plant two scopes of different languages, a nested scope, and a scope outside a workspace.
- [ ] T-6: Plant snake_case and PascalCase siblings for the prefix rule.
- [ ] T-7: Plant `setup.cfg`, a `hooks/` folder of source files, `.mise/tasks/`, and hooks that must keep running.
- [ ] T-13: Plant a hook that calls a task, a setup task that sets the hooks path, a fresh clone, a `[tool.ruff]` table, and a `lint` script.
- [ ] T-28: One planted defect for each, and the ones that need the network or Docker run in the `manual` job of CI.
- [ ] T-17: Closes with T-28.
- [ ] T-14: Make the guard test pass only for a check name inside a planted case that expects exit 1.
- [ ] T-30: One case for each preset, which expects the message of its own selector and exit 1.
- [ ] G-2: Give every check a planted defect and every engine folder a unit test, and delete the empty test folders.
- [ ] T-29: Each expects the rule name or the sentence of its finding.
- [ ] T-26: Each expects the rule or the sentence of its finding, as the other cases do.
- [ ] T-5: Closes with T-29.
- [ ] T-18: Expect a status or a finding, not the check name, in the two expectations.
- [ ] T-23: Give each analysis that reads text a unit test on a text, with no tool, and no repository.
- [ ] T-10: Closes with T-23.
- [ ] T-15: Add cases to `require-server-only` and `tests-directory-contents`.
- [ ] T-16: Add edge cases to the 18 unit test files that hold one input each.
- [ ] T-19: One test for each language runs the shipped policy over a short file written the way that language and its frameworks are written, and expects no finding.
- [ ] T-33: Generated and established reference projects get a usefulness review of each recommended finding before message/count snapshots; no unexplained house-style finding is accepted (K-301).
- [ ] K-28: Test the ESLint template by resolving the config for one file of each file class and comparing rule lists.
- [ ] T-36: Add one test for each preset that compares every generated file of a fixed policy with a tracked copy.
- [ ] T-12: Add a timed test with a ceiling over a planted repository of 5,000 files.
- [ ] T-22: The test reads the commands from the program, and looks for each in both scripts.
- [ ] T-25: Read the version from the one version source in the two release tests.
- [ ] T-31: With D-128 each test file carries the name of the preset it tests.
- [ ] T-11: Rename `repository-check.test.ts` and `scope-languages.test.ts` (T-31).
- [ ] T-34: The fixture is a project Xcode generated.
- [ ] T-20: Change the four tests that expect a defect, each in the commit that fixes its defect.
- [ ] T-35: Each of these changes in the commit that changes its subject (D-129 to D-133, D-144, D-165).

### Checks That Assume One Layout

[11-layouts.md](fixes/11-layouts.md)

- [ ] K-149: Hand a check the files of its scope in the engine input, and let only a `runs = "once"` check reach the whole repository.
- [ ] K-155: Closes with K-149; move the svgo byte check to `all`.
- [ ] K-163: Find `supabase/config.toml` inside the scope the check runs in.
- [ ] K-144: Compare Swift files by path in `xcode/orphan-sources`, move `xcode/test-plan` to `all`, and give reference images a layout setting.
- [ ] K-90: Check the reference image layout against the real test files in the redo of the app.
- [ ] K-150: Find Swift tests by their imports and attributes, and read the reason of a skipped test as text.
- [ ] K-153: Name modules from the package roots the project declares (`[tool.setuptools]`, `[tool.hatch]`, a `src/` folder, the scope), and plant a cycle under `src/` in the test.
- [ ] K-154: Build the site into a folder of the cache, with the command of the package manager the repository uses, parsed the way a shell parses it.
- [ ] K-160: The check runs only where the dialect is `postgres`, and init proposes the dialect from what it finds (a `supabase/` folder, `pg` in the dependencies, a `mysql2` dependency).
- [ ] K-184: The check accepts the places Docker reads, which are the folder of the Dockerfile, the file named after it, and the root of the scope.
- [ ] K-191: A default names no folder. The template passes what the config of the repository says, and a rule with nothing passed reports nothing.

### The Menu, the Questions, and the Agent Block

[12-menu.md](fixes/12-menu.md)

- [ ] K-62: Build `gspot list` (D-118).
- [ ] K-63: Give every check and every opt-in rule a `level`, and delete `[inspection] strict` as the switch (D-119).
- [ ] K-64: Ask the preset question in three groups (D-120).
- [ ] K-65: Write the managed block as a plain list of the selected presets (A-25).

### Plain Words and Renames

[13-words.md](fixes/13-words.md)

- [ ] K-54: Rename `render` to `emit` and `synced` to `applied` in all 123 places.
- [ ] K-66: Replace the made-up words a person reads with the words of 19-names.md.
- [ ] K-67: Delete the `layer:` key from every rule file; the folder says it.

### Cache Keys and the Push

[14-push.md](fixes/14-push.md)

- [ ] K-69: Cache a `[[check]]` only on the inputs it names, or never.
- [ ] K-70: Make the pre-push hook check the commits being pushed, not the working tree.
- [ ] K-293: Select affected projects from changed, deleted, and renamed paths; preserve all their findings and tool failures (D-168).
- [ ] K-294: Pass the base commit as `--changed=<commit>` in both CI jobs, and name the package manager the install under `.gspot/` takes.
- [ ] K-295: Give `--changed` an optional ref, and delete `--since` (D-169).

### The Top Level of This Repository

[15-top-level.md](fixes/15-top-level.md)

- [ ] K-73: Move `prose/` into its preset, and add `examples/`, `CONTRIBUTING.md`, `CHANGELOG.md` and `SECURITY.md`.
- [ ] K-68: Keep one `gspot.schema.json` at the root, and let the site copy it at build.

### What Runs Where, and What It Prints

[16-output.md](fixes/16-output.md)

- [ ] K-81: Print a line as each check ends, leave passed checks out of the end list, and give counts and times in the summary (D-124).
- [ ] K-84: Reword the `direction` column and the `not a slot` section, and print `unchanged` for a cached pass.
- [ ] K-117: Print the findings in the CI log, and write the JSON report beside them.
- [ ] K-82: Ask git whether the hooks run in this clone.
- [ ] K-83: Count as unchecked only files that a linter reads, and use the same count in `check` and `doctor` (S-6).
- [ ] S-6: Closes with K-83.
- [ ] K-166: Make `doctor` and `gspot list` report which looks each file ending gets, and name an ending that gets only the general ones.
- [ ] K-122: Word the init questions in plain terms (19-names.md).
- [ ] K-132: Say so when the preset question takes its default list without a terminal.
- [ ] K-130: Read the rule lists of every tool template in the upgrade report, not only lines shaped like ESLint.
- [ ] K-185: Explain looks in every scope, and prints the value of each scope that holds the key.
- [ ] K-243: Report a config that does not load with its file, its line, and a plain sentence. Print the hooks line of the uninstall plan only when the path will be unset.

### The Recommended Level

[17-recommended.md](fixes/17-recommended.md)

- [ ] K-74: Put no `extends` into the `tsconfig.json` of the developer at `recommended`, and require no compiler option there (D-126).
- [ ] K-75: Move exact versions, `packageManager`, the release age, README rules, banned headings and the Contents rule to the `all` level.
- [ ] K-91: Move the shell header rules, `types-placement` and `no-single-file-folders` to the `all` level.

### One Copy of Each Rule

[18-one-copy.md](fixes/18-one-copy.md)

- [ ] K-87: Write trivial-function, call-through and duplicate-function once over the syntax tree, with one set of limits.
- [ ] K-235: With K-87, an idea that stays is written once over the syntax tree and listed in the manifest of each language. An idea of taste moves to `all` in every language in one commit.
- [ ] K-86: Allow `swift` and `python` as folder names here by `structure.folder_name_allowed`, and move the list out of the shell file (D-128, D-135).

### The Command Surface and GitLab

[19-gitlab.md](fixes/19-gitlab.md)

- [ ] K-95: Build the command surface of 02-cli.md: delete the unused flags, and keep one name for one idea (D-129 to D-133).
- [ ] K-98: Read the global flags in one function that every command calls.
- [ ] K-96: Add `--ci gitlab`, and look for `.gitlab-ci.yml` beside `.github` (D-133).
- [ ] K-284: Delete `tools.<name>.enabled` and `gspot allow`, add `extra_checks`, and install no tool whose every check is ignored (D-160).
- [ ] K-285: Rename `profile save` to `gspot export`, and carry an `[[ignore]]` with no path in a profile (D-161).
- [ ] K-287: Say name for a check, a preset, a rule, and a setting, and rename the manifest key `id` to `name` (D-163).
- [ ] K-288: Add `--dry-run` to `install`, `apply`, `add`, and `remove` (D-163).
- [ ] K-289: Make a reason optional, with `require_reasons` for a repository that wants it (D-164).
- [ ] K-291: Make `check` take paths, add `--only` and `exclude`, and take `--scope` off `check` (D-166).

### gspot Checks Itself

[20-self-check.md](fixes/20-self-check.md)

- [ ] S-1: Add one check that writes every template of every preset into the cache and runs the parser and formatter of each kind over it.
- [ ] S-2: Closes with S-1.
- [ ] S-3: Run `bun test` with a coverage floor as a `[[check]]` of this repository at the push stage.
- [ ] S-7: Make the documents test fetch what it needs or fail; no test skips itself because something is absent.
- [ ] S-8: Turn the test rules on through `eslint-plugin-jest` for every test runner the template knows.
- [ ] S-9: Turn `[inspection] strict` on in this repository until D-119 replaces it.
- [ ] S-12: The work of a change ends when its run on GitHub is green, and the steps in [12-repository-layout.md](12-repository-layout.md) say so.
- [ ] S-4: Delete the three folder exemptions of stale-paths, and name the other repositories this folder writes about in one setting.
- [ ] S-5: Run the build of the manual as a `[[check]]` at the manual stage, and delete the link exemption.
- [ ] S-11: Load every `toml` block of the manual through the config reader, and parse every `gspot` line of a `bash` block with the program.
- [ ] S-13: Change each document in the commit that builds its decision, and write `17-migration.md` again from the redo of the app.
- [ ] S-14: Generate implemented reference facts once in the manual; do not add `architecture/presets.ts`. Keep target architecture authored, distinguish planned names through tracked gaps, and remove duplicate current-state inventories (K-304).
- [ ] S-16: Correct the false sentences of `02`, `03`, `11`, and `19` with S-13, fix the empty list in the unexposed-setting message, and load every example config through the reader (S-11).
- [ ] S-17: Change each false sentence of `04` to `12` in the commit that builds or drops what it says.
- [ ] S-18: Write each preset page and the file tree from the manifests and the disk with S-14, and change the other sentences with S-13.
- [ ] K-225: Each text changes in the commit of its subject, and the check of S-11 also parses every `gspot` command inside a `summary`, `why`, and `help`.
- [ ] S-15: Write `01-product.md` again after the Adoption phase, from what the product does, with the test that holds each promise.

### The README, the Manual, and the Site

[21-manual.md](fixes/21-manual.md)

- [ ] G-10: Implement the README brief, task-based manual navigation, and playful terminal field notebook design in 21-documentation.md. Include image-generated Spot concepts and shared website/README assets. Verify release-matched examples, responsive and accessible rendering, and reader-task acceptance checks.
- [ ] K-202: Rewrite guides from verified fixtures before the app handoff and add app-derived evidence after adoption ([21-documentation.md](21-documentation.md)), and S-11 keeps them true.
- [ ] S-19: Write the six guides a stranger needs, each from a run in `examples/`.

### Before Launch

[22-launch.md](fixes/22-launch.md)

- [ ] K-263: Run the unit tests, the planted repositories, and `gspot check` in the Windows job, and record each failure as a row.
- [ ] K-164: Both scripts stop at the first missing file, and the publish step verifies every package before it publishes the first.
- [ ] K-145: Ship `LICENSE.md` in the `files` of the launcher, the plugin, and each platform package.
- [ ] K-121: Confirm this project owns the npm name `gspot` before any command asks the registry about it.
- [ ] K-244: Name Homebrew in an install hint only for a tool with no pin, give a `github` installer its tag form, and ask all four registries in the release test.
- [ ] K-245: Write one notice file at build from the license of every bundled dependency and grammar, and embed it. Give the Swift grammar a build script that names its source commit.
- [ ] K-280: Add the two musl targets, sign the macOS binaries, and say in the install guide what each system shows.
- [ ] K-281: Migrate old TOML before validating the target schema, preserve recovery, and update the pin last (D-159).

### Every Place a Developer Comes From

[23-scenarios.md](fixes/23-scenarios.md)

- [ ] K-269: Hold a `pointer` form for each tool in its manifest, and write the table of root pointers.
- [ ] K-270: Preserve EditorConfig sections and Prettier overrides in format overrides; retain files with behavior that cannot be carried.
- [ ] K-271: State what each git flag answers with no git, add a `gitleaks dir` check, and name other version control as this same mode.
- [ ] K-272: Give each of the eight git cases one stated behavior and one planted case.
- [ ] K-273: Add `.gspot/** text eol=lf` to the managed `.gitattributes` block.
- [ ] K-274: Report a conflict marker under `.gspot/` as one finding that names `gspot apply` and `gspot install`.
- [ ] K-275: Add the pre-commit framework, lint-staged, and `simple-git-hooks` as hook forms.
- [ ] K-276: Give the GitHub job least permissions, a SARIF upload that can work, the merge queue event, and a cache.
- [ ] K-277: Write the CodeClimate report, set the clone depth, and find GitLab by its file.
- [ ] K-278: Print the three CI lines under `--no-ci`, and show them for four systems in one guide.
- [ ] K-279: Write the index of rule files into every agent file the repository holds (`[rules] agents`).

### Cross-cutting Contracts

[24-contracts.md](fixes/24-contracts.md)

- [ ] K-298: Managed paths can escape their root.
- [ ] K-299: Recovery and uninstall disagree about ownership.
- [ ] K-300: Target documents give incompatible instructions.
- [ ] K-301: Recommended adoption findings need usefulness tests.
- [ ] K-302: The website has source but no deployment contract.

### Scripts, Names, and Failure Handling

[25-simplification.md](fixes/25-simplification.md). Integrate these with K-205, K-164,
K-263, and takeover work; do not defer their safety fixes until after release.

- [ ] K-303: The reference generator deletes more than it owns.
- [ ] K-304: Generated reference pages are not automatically correct.
- [ ] K-305: Permissive script arguments can select a destructive action.
- [ ] K-306: File URLs are used as filesystem paths.
- [ ] K-307: Failure-to-empty helpers hide incomplete checks.
- [ ] K-308: Apply the canonical field, parameter, action, and coverage vocabulary; remove contradictory naming requirements.

## Names, workarounds, and leftovers to clean

Counted in `packages/` on September 19, 2026. Each line names the row that owns it.

- [ ] The word `render` stands in 108 places, `synced` in 15, and `corpus` in 34 (K-54, K-146).
- [ ] The word `surface` stands in 179 places, `layer` in 71, and `inspection` in 25 (K-66, K-89).
- [ ] The source holds 44 type casts and four `eslint-disable` comments. Four integrity tests build
      their input by a cast (T-21).
- [ ] The habits of one deploy repository stand in the shell checks: `run_ssh`, `_CFG_<NAME>_READY`
      and a sweep of `nvidia-smi` (K-123). `rules-lint/terms.ts` names `slopshop`.
- [ ] The list of lint packages holds `supabase`, `concurrently`, `globals` and `husky`, which are
      no linters (K-237).
- [ ] Test files are named around the banned folder words: `handheld`, `components`, `libraries`
      and `pyproject/` (T-31). The source folders `apple/` and `pyproject/` wait for D-128.
- [ ] One check name uses the British spelling: `xcode/asset-catalogues` (K-228).
- [ ] Seven tests skip themselves (S-7, T-8).
- [ ] Three branches of work are parked: the stash `hooks-existing`, the second `vale.ini` under
      `prose/`, and the twelve lint stubs at the root of this repository.

## What is still unchecked

By the order of the owner, nothing below is touched before its step.

- A real install in yap-swift-app, with every written file read, and the time of every check
  there. That is step 9.
- Any other reference repository.

Not read, by the choice of the owner: 33 rule files outside the framework, library, and tool layers.

Windows is not checked, because no machine here can run it (K-263).

Nothing else is owed. Every file of code, every test, every template, every manifest, and every
document of this folder is read.

Checked on September 19, 2026, with the row that holds what was found:

- The `why` text of the 205 checks: sound.
- Every pin on npm, PyPI, crates.io, GitHub, and Homebrew (K-206, K-207, K-244).
- A tool that crashes, a config cut in half, two runs at once, and `apply` killed midway (K-243).
- The licenses of the 34 bundled dependencies and the nine grammars (K-245).
- The build of the docs site: 301 pages, every internal link valid.
- Every check name, flag, config key, manifest key, and path the documents name (S-14, K-246).
- The 48 preset pages and `16-file-tree.md`, by eye (S-18, K-254 to K-256, T-36).
- The flags each manifest passes, against the help text of the pinned tool (K-251).
- A full disk, on a 12 MB disk image: the policy file is cut in half (K-257).
- The Compose check, run with Docker Compose 5.5.1: it fails on every file (K-258).
- The `.gitignore` of this repository against what git tracks and what sits on disk (K-259).
- The 12 rule files the owner chose, read whole (K-260 to K-262).
