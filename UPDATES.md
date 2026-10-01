# Updates

This file records an audit of the gspot repository, done on September 30, 2026, and the decisions the owner made that
day. Nothing here is fixed yet. `architecture.png` shows the source folders and their imports today and after the work.
`folder-structure.png` shows the folder tree before and after, and `tests-structure.png` does the same for the tests.
Appendices A to F list every finding: names, files, tiny functions, tests, documentation, and the agent rules.

The audit read every file in `packages/cli`, `packages/eslint-plugin`, `docs`, `tests`, `.github`, and the root. It
measured the import graph with a script and compared the layout with eight established command-line tools. Today the
CLI source holds 409 TypeScript files and 41,421 lines, and the tests hold 506 files and 46,920 lines. After the work,
the CLI source comes to about 320 files and 38,000 lines. About 3,500 lines are deleted; the rest of the work moves code
to the module that uses it.

## Implementation status

The next agent reads this first, then `AGENTS.md`. The stage plan below replaces section 12, and the owner
approved it on October 1, 2026.

### Where things stand on October 1, 2026

- `main` is at `94c41578`. Stages 1 to 10 are merged as pull requests #2 to #8 and #10 to #12. Stage 7 also deleted
  the `architecture` folder, a part of stage 15.
- Pull request #9 updated `devalue` to 5.9.4 for seven advisories that `dependencies/osv` reported on October 1.
- Stage 11 is pull request #13, branch `refactor/cut-kit-acceptance-tests`.
- The next stage to start is stage 12.

### Stages

One pull request per stage, in this order. Each merges with a merge commit only after every CI job passes.

| Stage | Title                                                  | Scope                                                                                                   | Status                 |
| ----- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1     | Make CI green on main                                  | section 11; a tagged Windows quarantine list in the acceptance runner                                   | merged, #2             |
| 2     | Delete uninstall and the byte backups                  | 5.1 uninstall, 5.2, one hook header, the ownership tests                                                | merged, #3             |
| 3     | Delete completion and the report files                 | 5.1; tests parse `--json`                                                                               | merged, #4             |
| 4     | Delete the result cache and inline ignores             | 5.1; the Ruby grammar; `--no-cache` in the tests                                                        | merged, #5             |
| 5     | Delete the init extras and the startup manifest check  | adaptations 2 and 4                                                                                     | merged, #6             |
| 6     | Delete source positions, coverage, and fix settings    | adaptations 3 and 5; `fix_order` and `fix_findings_exit_codes`                                          | merged, #7             |
| 7     | Write the agent block only into `AGENTS.md`            | the `CLAUDE.md` decision; the Cursor rule                                                               | merged, #8             |
| 8     | Cut unit and CLI integration tests                     | D.2 rows that delete, trim, and merge within one tier                                                   | merged, #10            |
| 9     | Cut tool, docs, and repository tests                   | D.3 rows; drop `test:docs` and those folders from `test`                                                | merged, #11            |
| 10    | Cut command acceptance and package tests               | D.4 rows; pins move to a scheduled `pins.yml`                                                           | merged, #12            |
| 11    | Cut kit acceptance tests                               | D.4 kit rows; find why `documents.test.ts` does not run on Linux                                        | pull request #13       |
| 12    | Delete repeated checks, dead rules, and dead code      | 5.3, 5.4, 5.7, including `version = 1` and its gate                                                     | not started            |
| 13    | Ship no defaults written for this repository           | 5.5; `architecture.roles.harness` with no default; this repository sets its own roles                   | not started            |
| 14    | Remove the self-lint code from the product             | 5.6; one `gspot` task; `testToolsText` to the pin script                                                | not started            |
| 15    | Delete stale files                                     | 5.8 and B.7, apart from the `architecture` folder                                                       | `architecture` deleted |
| 16    | Move shared code to platform and split repository      | B.1 platform, repository, survey, takeover, `execution/checkout`                                        | not started            |
| 17    | Move lifecycle, generation, tools, and command files   | B.1 markers, edit, add, remove, install steps, preview, the rules folder, `applyAll`                    | not started            |
| 18    | Rename execution, policy, and kit files                | the rest of B.1                                                                                         | not started            |
| 19    | Group checks by kit behind one registry                | B.2; no `engine` or `analysis` fields; no engines page                                                  | not started            |
| 20    | Organize config and types by folder; add layers        | adaptation 1; `[[architecture.elements]]` and `edges_allowed` from section 3                            | not started            |
| 21    | Move the launcher and runners to a root scripts folder | `scripts/gspot` and the four runners, with `mise.toml` in the same commit                               | not started            |
| 22    | Arrange tests by tier and mirror the source            | D.1: five tiers, `harness`, `config`, `samples`                                                         | not started            |
| 23    | Run CLI tests in-process with shared builders          | D.2 moves and rewrites; `contract` from 122 cases to 16                                                 | not started            |
| 24    | Move acceptance cases to faster tiers                  | D.4 moves; Windows fixes; the quarantine list emptied and deleted                                       | not started            |
| 25    | Dispose roots and share text, object, and git helpers  | the first half of 6.2                                                                                   | not started            |
| 26    | Keep one table and one constant per fact               | the second half of 6.2                                                                                  | not started            |
| 27    | Adopt libraries and fix the audited bugs               | 6.3; section 4 rows without a D.5 test; the bugs listed below; constraints for transitive tool packages | not started            |
| 28    | Settle each exempted tiny function                     | appendix C; tiny rules off for React components and NestJS modules                                      | not started            |
| 29    | Rename the `gspot.toml` keys                           | A.3 without `[guides]`                                                                                  | not started            |
| 30    | Rename the kit manifest fields                         | A.4                                                                                                     | not started            |
| 31    | Name checks after their kit and tool                   | A.5 and A.6; a `format` kit; an `actions` kit; one `javascript/eslint`                                  | not started            |
| 32    | Rename guides to rules                                 | B.3; `[rules]`, `.gspot/rules`, `--no-rules`; `TALKING.md` stays a base rule                            | not started            |
| 33    | Rename flags, output words, and JSON fields            | A.2, A.7, A.8; `--hook`; manual checks run with `--only`                                                | not started            |
| 34    | Rename identifiers in commands and policy              | the first half of A.10                                                                                  | not started            |
| 35    | Rename identifiers in repository and lifecycle         | the second half of A.10                                                                                 | not started            |
| 36    | Rename identifiers in checks and parsers               | A.11                                                                                                    | not started            |
| 37    | Rename plugin rules and options                        | A.12                                                                                                    | not started            |
| 38    | Add the missing scenario tests, part one               | D.5 rows 1 to 17, with fixes for the bugs they confirm                                                  | not started            |
| 39    | Add the missing scenario tests, part two               | D.5 rows 18 to 34                                                                                       | not started            |
| 40    | Rename the packages, tasks, and CI jobs                | A.9; `grammars.ts`; `docs.yml` without the deploy plumbing                                              | not started            |
| 41    | Trim the guides, READMEs, and CONTRIBUTING             | E.1 to E.4; `--save-exact`; `GSPOT_JOBS` documented                                                     | not started            |
| 42    | Trim the reference pages and the homepage              | the E reference rows; `/reference/checks/`; new recorded transcripts                                    | not started            |
| 43    | Fix the rules the shipped linters reject               | F.3 and F.4; the level paragraph in 65 files; empty files; the no-subagents rule deleted                | not started            |
| 44    | Shorten the base rules                                 | the general rows of F.1                                                                                 | not started            |
| 45    | Shorten the kit rules                                  | the other rows of F.1, and F.2                                                                          | not started            |
| 46    | Finish the audit and check release readiness           | delete this file and the three images, with their ignore; the final verification below                  | not started            |

### Decisions

The owner decided on October 1, 2026:

- Follow every recommendation of the open-questions table in section 1.
- Keep the custom docs site, and trim only duplication and stale text (appendix E). Delete the deploy plumbing:
  `source_ref`, the release check, the source record, and the extra artifact.
- Keep `config` and `types`, organized per source folder that reads them. Groups get blank lines between them, and
  unused entries go. `types_directory` and `config_directory` stay. Tests get `tests/config` and keep `tests/types`.
- `TALKING.md` ships in every installation as a base rule. The no-subagents rule goes.
- No relock flag. The dependency scan skips the private tool locks under `.gspot`, and kit manifests can carry
  constraints on transitive packages that gspot maintainers raise.
- The agent may delete the ignored `.gspot/state` folder and rerun `mise run apply` when a stage changes its schema.

The plan adapted the audit in seven ways:

1. Constants read in `src/<a>/<b>` go to `config/<a>/<b>.ts`, and constants read in a folder with subfolders go to
   `config/<a>/<a>.ts`. A config folder exists only with two files or more, and `types` follows the same rule.
2. Init loses `--without`, `--allow-dirty`, `--runner`, detected settings, and the Xcode and bunfig import. It keeps
   `--scope`, `--ci`, `--no-runner`, the runner question, and the refusal of a dirty tree.
3. The "schema of known keys" is the known-key list in policy errors. The published `gspot.schema.json` stays.
4. Manifest validation runs in a unit test and in `packages/cli/scripts/build.ts`, not at startup.
5. The coverage report goes with the `[coverage]` table, the coverage lines in manifests, and `linguist-languages`.
6. `checks/general/files.ts` is a file, not a folder with one file. `applyAll` moves into `lifecycle`, so no command
   imports another.
7. Deleting the two empty scopes also sets `tools.commitlint.scopes` in the same commit.

The owner and the work settled these while implementing:

- `CLAUDE.md` is never kept. `init` and `apply` delete it, a link included. Its own text, without the gspot block,
  moves to the end of `AGENTS.md` under `## Other instructions`, unless `AGENTS.md` already holds it. gspot writes
  its block only into `AGENTS.md` and the files `guides.agents` lists.
- The `.gitattributes` block stays, against the section 1 recommendation: it keeps the files under `.gspot/` on line
  feeds in a Windows checkout, which the hook scripts and the clone tests need. gspot also marks every file under
  `.gspot/` as generated itself, apart from the Vale packages.
- Without `fix_order`, `--fix` reruns the fixers over the files a pass changed, up to three passes. A correction may
  exit with a code its check declares for findings; any other nonzero exit fails it.
- Policy errors name the key path, such as `gspot.toml: ignore.0.reason: ...`. Policy findings carry no line.
- Tests that need Docker run where a Docker daemon answers and runs Linux containers (`hasLinuxDocker`).
- Code, configuration, and tests never cite this file, the stage plan, or a stage number. Write each reason so it
  stays true after this file is gone.

### Rules for every pull request

- Branch from the current `origin/main`. Keep at most one branch stacked ahead of the open pull request.
- Every commit passes the commit hook on its own. Never pass `--no-verify`.
- Never edit tracked files under `.gspot` by hand. Change the policy with `gspot set`, `gspot ignore`, or
  `gspot.toml`, then run `mise run apply`.
- Commit headers read `type(scope): Subject` in at most 72 characters, and body lines stay within 72 characters.
  The scopes are `root`, `cli`, `eslint-plugin`, `docs`, `hooks`, and `deps`.
- The pull request body names the stage, the rows of this file it carries out, the changed tests, the quarantine
  list, and the commands that passed locally.
- Verify in this order. Run `mise run check:types`. Run `mise run apply` when the policy, a manifest, a template, or a
  rule changes; `git status` then shows only the intended generated changes. Run `mise run gspot -- check`, then the
  extra suites of the stage, then a `git grep` for every name and path the stage retires.
- Moves use `git mv`, a codemod for the imports, `--fix` for import order, and a search for the old path in
  `gspot.toml`, `mise.toml`, the workflows, `tsconfig.json`, `package.json`, `build.ts`, and the docs.
- New folders hold two files or more, avoid stem and prefix collisions, and use no banned word. `policy.json` lists
  them, such as fixture, snapshot, shell, sync, support, helpers, utils, and tmp. Names carry no filler words.
- Mechanical stages (17 to 20, 22, 25, the moves of 32, and 34 to 36) may use one helper agent at a time in its own
  worktree. The main agent reviews the diff and runs the checks.

### Working in this repository

- Tools come from mise, with Bun 1.4.2. A fresh clone runs `mise trust`, `mise run repo:setup`, `mise run apply`, and
  `mise run repo:install-checks`.
- Run one heavy job at a time: the machine slows down under parallel suites.
- Acceptance tests need `GITHUB_TOKEN="$(gh auth token)"` and Docker Desktop running (`open -a Docker`). Run them in
  chunks that finish within ten minutes:
  `GITHUB_TOKEN="$(gh auth token)" mise run test:acceptance -- ./acceptance/source/cli/agents.test.ts`. Paths are
  relative to `tests`.
- Other suites: `mise run test` for the unit and integration tests, `mise run test:tools`, `mise run test:package`,
  and `mise run docs:build`.
- CI runs four shards on Linux, macOS, and Windows. A shard that fails on a network error reruns with
  `gh run rerun <run> --failed`.
- After a stage changes the ownership schema, delete `.gspot/state` and rerun `mise run apply`. Before switching to a
  branch with another schema, copy the folder aside, delete it, and apply on the other branch.
- Never print the npm token, and never publish to npm without the owner.

### Open items

- Stage 8 cut the D.2 rows whose reason holds while the code stays. A test leaves with the code it tests, so these
  D.2 rows wait for the stage that deletes that code:
    - stage 12: the tests of the three dead plugin rules, `checks/async-functions`, the import-cycle case in
      `checks/python/imports`, the dead rule in `generation/framework-rules`, and the `appendEntry` cases in
      `policy/write`.
    - stage 13: the rewrites of `env-access-owner`, `import-direction`, and `tests-directory-contents`, the harness
      rows of `execution/structure`, and the shipped banned-word loop in `checks/naming/validate-name`.
    - stage 14: `agents/examples`, `agents/front-matter`, `agents/lint`, and the linter case in `agents/sections`.
    - stage 23: every "move" and "rewrite" verdict, the CLI spawns that become in-process calls, and the process case
      in `sql-parser`.
    - stage 27: the cache-home case in `checks/swift/cache`.
- Stage 9 deleted the tests that run the rule examples of the guides. Stage 14 deletes only the guide linter, its unit
  tests, and the `guides:lint` task.
- Stage 9 cut the D.3 rows that delete, trim, or merge within the tools tier. These D.3 rows wait:
    - stage 23: the rewrites of `tools/flags` and `parse-output/actionlint`, and one helper for the emit-and-write block
      the tools tests repeat.
    - stage 24: the cases that move to the CLI tier: `checks/site-output`, `generation/toml`, the empty-scope case in
      `generation/javascript`, and the ESLint and Stylelint cases in `execution/fixers`.
    - stage 25: the shared Swift helpers in `swift-build`.
- Stage 10 cut the D.4 command and package rows that delete, trim, or merge within acceptance. Stages 2 to 6 had
  already deleted the cache, performance, uninstall, and report-storage files.
- A weekly `pins` workflow runs `repo:pins` (`packages/cli/scripts/pins.ts`) in place of the pins test.
- These D.4 command rows wait for stage 24:
    - every "move to the CLI tier" row, `checks/declared` into the declared-check parse test, the split of
      `ignored-execution`, and `nested-scopes` into the CLI scopes test.
    - the cases of `format-overrides` and `scopes` that belong to generation, unit, or init tests, and the per-tool
      rows of `reasons` that become one unit table.
    - the merge of `hooks/push/revisions` into `hooks/push/refs`, with the helper for its pasted assertion blocks; the
      merged file is over 300 lines until then.
- `package/lifecycle` tests the package runner script and moves with it in stage 21.
- Stage 11 cut the D.4 kit rows that delete, trim, or merge within acceptance. `svg` merged into `static-site`, and
  `swift/security` was deleted. `swift/package` and the plist case of `xcode` run on macOS only. These kit rows wait
  for stage 24:
    - the files with one install that become CLI-tier tests: `react`, `bash/checks`, `libraries`, `naming`,
      `platforms`, `structure`, `vite`, and the ESLint and project cases of `typescript`.
    - the merges of `component-files` into `components`, of the Next.js files, and of `nginx`, which is over the
      function limit until its cases move.
    - the docstring and structure cases of `python`, and the cases of `xctest`.
- `documents.test.ts` does run on Linux: its 11 cases pass in main run 36896154813. The audit's timing came from the
  stale timings file that stage 1 deleted.
- Stage 9 moved the one real guard of the deleted reference tests, conflicting setting definitions, into manifest
  validation. A CI step replaces the test of the tool pins: it runs `repo:tools` and `git diff --exit-code`.
- Stages 2 to 7 already removed the D.2 cases about the cache status, the census, inline ignores, reports, uninstall,
  and byte backups. `output/progress`, `output/reporter`, `comment-syntax`, `suppression-comments`, `hooks`, `kinds`,
  `gitlinks`, `bun`, and most ownership files needed no further cut.
- After a checkout rewrites a read-only generated file with mode 0644, `apply` refuses it as edited although the bytes
  match. Until stage 27 fixes that, `chmod 0444` the files it names and rerun `mise run apply`.
- Stage 1 left the two empty scopes, `packages/cli` and `packages/eslint-plugin`, in `gspot.toml`. Delete them with
  adaptation 7 in the next stage that touches the policy.
- Bugs for stage 27:
    - knip takes its workspaces from the gspot scopes instead of the package workspaces.
    - A prune, such as `gspot set guides.install false`, leaves empty folders behind.
    - A checkout writes a read-only generated file with mode 0644, and `apply` refuses it as edited although its bytes
      match the record.
    - `--only <checks...>` keeps reading after a global `--json`, so `check --only X --json file` takes the file as a
      check name.
- The stdin case of `acceptance/source/cli/cancellation` writes its ready marker before the SIGTERM handler is
  attached, so a slow runner can kill the process with 143. Fix the test in stage 24.
- The pyjwt advisory ignores expire on October 13 and 15, 2026. Renew them with `gspot ignore` in the open pull
  request, or replace them with the transitive constraints of stage 27 once semgrep allows a fixed pyjwt.
- The quarantine list: 51 acceptance files skip on Windows (`WINDOWS_PENDING` in `tests/support/acceptance.ts`) until
  stage 24. The help-flag tool tests run on POSIX systems only until stage 23. The Supabase database journey runs in
  CI only in the weekly `database` workflow, which sets `DATABASE_JOURNEYS`.

### Owner actions

- When stage 40 lands, rename the GitHub repository variable `GSPOT_PAGES_ENABLED` to `PAGES_ENABLED`. Keep the file
  name `release.yml`, which the npm trusted publisher names.
- New libraries must be older than 7 days, the `minimumReleaseAge` of Bun.

### Final verification in stage 46

- `git grep` finds no retired name or path, and no quarantine marker remains. Windows acceptance blocks merges.
- Knip is clean, the boundaries rule reports no violations, and `mise run doctor` is clean.
- `mise run gspot -- check`, `mise run test`, and the full tool, acceptance, and package suites pass, one at a time.
  `mise run docs:build` passes.
- `npm pack --dry-run` for both packages shows `rules`, `kits`, `grammars` without Ruby, and `dist`.
- A packed-package journey runs `init --yes` in a repository with `AGENTS.md` and `CLAUDE.md`, then `check`.
  `CLAUDE.md` is gone, and `AGENTS.md` holds the block and the moved text.
- CI on `main` passes on Linux, macOS, and Windows.

## 1. Decisions

**Stays**, decided by the owner:

- Monorepo scopes and Windows.
- The two levels: recommended and all.
- Every package manager (npm, pnpm, Yarn, and Bun) as well as mise.
- Profiles: `gspot export` and `init --from`.
- The commands `init`, `apply`, `install`, `check`, `set`, `ignore`, `add`, `remove`, `explain`, `list`, `doctor`, and
  `export`.
- The custom gspot analyses and the rules of the ESLint plugin, including `no-trivial-functions` and the import and
  export order sorted by length.
- Exact staged and push checks through revision snapshots, takeover of existing tool configuration, CI workflow
  generation, and the rule preview of `apply --dry-run`.
- All 51 kits.

**Goes**, decided by the owner: `uninstall`, `completion`, the CI report files (Static Analysis Results Interchange
Format, or SARIF, and GitLab Code Quality; `--json` stays), the result cache, and inline `gspot-ignore` comments.

**Goes by the standard of this audit**, with no product decision needed. That covers checks that repeat a real tool
exactly, dead plugin rules, and code written for this repository that ships to users. It also covers the code that lints
this repository, dead code, and migration code for a product that has no release yet.

**Open questions for the owner.** Each is a product question. The owner kept the features around them but did not rule
on these parts.

| Question                                                                                                                                    | Cost today                                            | Recommendation                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| Keep the byte backups of replaced files in the recovery folder under the `state` folder of `.gspot`?                                        | about 400 lines                                       | delete (section 5.2)                                                    |
| Keep the version pin in `.gspot/version`?                                                                                                   | 48 lines, read by 7 commands                          | keep; `doctor` and the hooks use it                                     |
| Keep the interactive questions of `init`, with `@clack/prompts`?                                                                            | 94 lines                                              | keep; `init` without flags needs them                                   |
| Keep the `init` extras: `--without`, `--scope`, `--allow-dirty`, `--ci`, `--runner`, detected settings, the Xcode and bunfig import?        | about 1,150 lines                                     | keep `--scope` and `--ci`, which serve kept features; delete the rest   |
| Keep the policy error extras: source positions, name suggestions, and the JSON schema of known keys?                                        | about 300 lines                                       | keep the suggestions; delete the positions and the schema of known keys |
| Keep required reasons and setting directions?                                                                                               | about 250 lines                                       | keep; `set` and `ignore` refuse a looser setting without a reason       |
| Keep the managed blocks in `.gitignore`, `.gitattributes`, and the Cursor rule?                                                             | about 60 lines                                        | keep the `.gitignore` block; delete the other two                       |
| Keep the file coverage report, with `linguist-languages`?                                                                                   | about 150 lines                                       | delete                                                                  |
| Keep `--fix --dry-run` in a scratch copy, `fix_order`, and `fix_findings_exit_codes`?                                                       | about 230 lines                                       | keep the scratch copy; delete the two settings                          |
| Keep the check of all 51 shipped manifests at every start?                                                                                  | 266 lines                                             | run it in a test instead                                                |
| Keep the scopes `packages/cli` and `packages/eslint-plugin` in the `gspot.toml` of this repository?                                         | 24 generated files that repeat the root byte for byte | delete both scopes                                                      |
| Keep the docs extras: the custom homepage, the Starlight overrides, the page of generated configuration, and the release check of the site? | about 1,000 lines                                     | a Starlight splash page and plain Starlight                             |
| Keep `CLAUDE.md`, identical to `AGENTS.md`?                                                                                                 | one file                                              | delete if every agent in use reads `AGENTS.md`                          |
| Keep a `config` folder for constants, as the owner decided on September 28, 2026?                                                           | 32 files; 588 of 663 exports have one importer        | keep it, organized by the folders that read it (section 6.1)            |
| How do manual checks run once `--stage` becomes `--hook`?                                                                                   | a flag                                                | `--only <ids>`, which already selects checks of every stage             |
| Keep the preferences of this repository in the shipped rules: ASD-STE100 for talking, no subagents, the plan format?                        | three rule files                                      | move them to the local rules of this repository                         |

## 2. Answers to the questions asked

### Linting logic for gspot itself in the product

Yes, in three ways, and all three go (sections 5.5 and 5.6).

- **The layout of this repository ships as defaults.** The plugin gives `tests/support`, `config`, `src/env`, and
  `types` a role in every repository. The Jest and Vitest kits set `harness_directory = "tests/support"`, and the rules
  tell agents to use `tests/support`. Each becomes a setting with no default.
- **Code written for gspot ships to users.** The generated ESLint configuration names `GspotError`. A Vale rule catches
  damage from an old bulk rename in this repository. The knip entry files of the JavaScript kit describe this
  repository, and the output shows an internal decision number.
- **The linter of the rules corpus of this repository sits in the product source.** It is 318 lines in
  `packages/cli/src/agents` plus 14 constants, and it lists other projects and companies.

The import and export order sorted by length stays: the owner asked for it.

### Package names

`@gspothq/…` is what npm installs, and `gspot` is what people type. The npm scope `@gspot` belongs to someone else,
and npm refused the unscoped name `gspot`.

| Package                                              | Name today                               | Name                                                                              |
| ---------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| the CLI (published)                                  | `@gspothq/cli`, command `gspot`          | unchanged                                                                         |
| the ESLint plugin (published)                        | `@gspothq/eslint-plugin`                 | unchanged; add the namespace "gspot" in `packages/eslint-plugin/src/plugin.ts:57` |
| the workspace root (private)                         | `gspot`, the name npm refused            | `@gspothq/workspace`                                                              |
| the documentation site                               | `gspot-docs`                             | `@gspothq/docs`                                                                   |
| the tests                                            | `gspot-tests`                            | `@gspothq/tests`                                                                  |
| the tool project gspot writes into user repositories | `gspot-tools`                            | unchanged: the Python project shares the name, and PyPI has no scopes             |
| the lockfile root                                    | `gspot-workspace` in `bun.lock:6`, stale | regenerate                                                                        |

Every workspace package sits under the one scope. `tests` stays a package: it holds the 41 packages that the
test sandboxes link in. Its `package.json` lists the docs package, which it never uses; drop that line. `docs` stays a
package as well: its Astro dependencies resolve only from its own folder.

Wrong or unsafe install commands, all to fix:

| Where                                                                                                      | Problem                                                                                           |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `docs/src/components/home/Hero.astro:18`                                                                   | `npx @gspothq/cli init` never adds the dependency, so every hook fails afterwards                 |
| `docs/src/content/docs/guides/install.md:31`                                                               | `npx gspot --version` offers to download the unrelated unscoped `gspot` when nothing is installed |
| `docs/src/content/docs/guides/without-mise.md:26`                                                          | says gspot adds its launcher to the dev dependencies, which no code does                          |
| `docs/src/content/docs/guides/install.md:16`, `packages/cli/README.md:12`, `docs/src/pages/index.astro:50` | install without an exact version, although gspot requires the installed version to match its pin  |
| `packages/cli/src/config/generation.ts:40`                                                                 | the hook message "Install gspot" reads like `npm install gspot`                                   |
| `docs/src/content/docs/guides/build.md:26`, `mise.toml`, `packages/cli/scripts/build.ts:1`, `gspot.toml`   | say "the gspot package" for `@gspothq/cli`                                                        |
| five CLI source files                                                                                      | type `'@gspothq/cli'` by hand instead of reading it from the manifest                             |
| `packages/cli/package.json:43` and `tsconfig.json:28`                                                      | two aliases, `#package` and `#cli-package`, for one file                                          |

### `packages/cli/bin`

Two lines that run the source CLI with Bun. Only this repository uses it: `mise.toml` puts it on the path for the
hooks. It sits beside `dist` and looks like part of the package. Move it to a root `scripts` folder.

### The grammars folder of the CLI package

Tree-sitter WebAssembly files for the custom analyses, which stay. `packages/cli/scripts/inputs.ts` copies them from the
dev dependencies so that the published package carries them. Rename the script `grammars.ts`, read the grammars from
`node_modules` when running from source, and copy them only at build. The 2.1 MB Ruby grammar reads comments in `.rb` files
for the inline `gspot-ignore` comments and the suppression count. Both go, and no kit covers Ruby, so it goes too.

### The root `dist` folder

1.5 GB of the old per-system binaries and npm stubs that used the `@gspot` scope. Nothing writes it. Delete it and its
line in `.gitignore`.

### Is kits the right name

Yes. It is short and used in every command, message, and page. Presets suggests one configuration, profiles is taken
by `gspot export`, and stacks suggests several kits. Remove the old synonym "configuration" from messages and code,
such as `packages/cli/src/kits/manifests.ts:63`.

### Script names

| Script                                | Does                                      | Action                                                |
| ------------------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| `packages/cli/scripts/inputs.ts`      | prepares the grammar files                | rename `grammars.ts`                                  |
| `packages/cli/scripts/test-tools.ts`  | writes the tool pins that the tests need  | move to a root `scripts` folder, with `testToolsText` |
| `packages/cli/scripts/guides-lint.ts` | lints the rules corpus of this repository | delete with the guide linter                          |
| `packages/cli/scripts/build.ts`       | builds the package                        | keep                                                  |

### Config files with no blank lines

17 of the 32 files in `packages/cli/src/config` have no blank line between groups. Beyond the blank lines, the files
are organized by theme while their users are spread out: 588 of the 663 exports have exactly one importer. The owner
keeps `config` as the home of constants, so section 6.1 reorganizes it by the folders that read it. 215 of the 402 types
in `packages/cli/src/types` have one user; `types` is the second open part of section 6.1.

### `packages/cli/src/execution/broken-tool.ts`

It decides whether a tool that exited with an error crashed or found something. The decision stays; merge it into
`packages/cli/src/execution/tool/findings.ts`. The TruffleHog branch moves to the TruffleHog check.

### `.gspot` in this repository

gspot runs on its own repository. Tracked: generated configuration, installed rules, hooks, tool manifests and locks,
and the version pin. Ignored: installed tools, cache, reports, state, and Vale styles. 24 files under
`.gspot/config/packages/cli` and `.gspot/config/packages/eslint-plugin` repeat the root files byte for byte, because
those two scopes select no kits (section 1).

### `.ansible`

Three empty folders that ansible-lint creates in its working folder. `tests/integration/tools/flags.test.ts:56` runs
every tool with `--help` in the repository root. Delete the folder, and run that test in a temporary folder.

### The `architecture` folder

Delete all of it: 11 documents (2,530 lines) and 2 tables (4,166 lines, 1.1 MB). The generated reference pages, the
rules, `CONTRIBUTING.md`, and the code hold every contract in it. Three documents break their own 300-line limit, and
`architecture/12-repository-layout.md` still describes the per-system launcher. Nothing reads the two tables. One
generated page links `architecture/04-kits.md` as its source (`docs/src/content/reference/collection.ts:55`); point it
at the kit schema.

## 3. How the code is organized

### What established tools do

| Tool       | Layout                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint     | `lib` with a thin `cli.js`, one folder per domain (`config`, `linter`, `rules`, `shared`), one file per rule behind a lazy map, tests that mirror `lib` |
| Prettier   | `cli` reaches the core through one file; each language folder is a plugin with its own options and parsers                                              |
| npm        | one class per command with its flags and usage, a command list, the core in separate workspace packages                                                 |
| pnpm       | one package per concern, each domain with its own commands package; the package graph is the import direction                                           |
| knip       | `cli.ts` calls `run.ts`; one folder per plugin behind a generated registry; central types only for cross-cutting contracts                              |
| Changesets | one small package per concern (config, parse, read, write, git, errors) and thin command folders                                                        |
| Astro      | `cli/<command>`, the engine in `core/<domain>`; its types guide says types live beside their feature                                                    |
| Nx         | a thin command object per command that loads its handler; a lint rule enforces the module boundaries                                                    |

The same principles hold across them:

1. A command parses flags, calls one library function, and prints the result. Commands never import each other.
2. One folder per domain, named after the noun it owns, over a bottom layer that imports nothing above it.
3. One registry per extension point. Each extension gets one file or folder.
4. Loading, schema, and defaults of a configuration sit together.
5. Types and constants sit beside their owner; a central place holds only shared contracts.
6. Output is its own layer.
7. Tests mirror the source in a tree of their own, or sit beside the code.
8. Structure or a lint rule enforces the import direction.

### The verdict

The files are clean; the layering is not.

**What already matches.** Files are small: the median is 87 lines and the largest 378. `packages/cli/src/commands/program.ts` registers
every command in one list, and `main.ts` sets the exit code without exiting. Kits live at `kits/<category>/<kit>`, the
plugin has one file per rule, and zod schemas sit beside their logic. `platform`, `parsers`, and `output` import
nothing above them. No file imports itself through a chain of value imports, and the unit tests mirror the source.

**What does not.**

- **One large cycle.** Ten of the 16 folders can reach each other through imports: `agents`, `checks`, `execution`,
  `generation`, `kits`, `lifecycle`, `native`, `policy`, `repository`, and `tools`. Nine pairs import each other
  directly, and about 20 imports cause it all. Nothing checks the direction, although gspot ships that check.
- **Two bucket folders.** `config` and `types` hold 52 files that mirror the whole tree. `types` imports runtime
  schemas from eight folders, and `config` and `types` import each other.
- **Workflows inside commands.** `init` and the policy commands import the apply workflow, `set`, `ignore`, `add`, and
  `remove` import `packages/cli/src/commands/policy.ts`, and the staged and push runs live in
  `packages/cli/src/commands/check`.
- **Two registries of analyses.** `packages/cli/src/checks/dispatch.ts` spreads 16 `analyses.ts` maps, and
  `packages/cli/src/execution/engines.ts` keeps a second map that imports 13 check modules.
- **Generic helpers in a domain folder.** `compact` in `packages/cli/src/policy/normalize.ts` has 12 importers;
  `packages/cli/src/policy/similar.ts` serves kits, agents, and commands.
- **Folders with two jobs.** `execution` holds both the tool runner and the run. `lifecycle` holds the ownership log,
  the apply workflow, drift, the rule preview readers, policy writes, the version pin, and hook installation.
- **Names that say nothing.** `native` is the ESLint process of the rule preview. `agents` holds the rules.
  "Configuration" means five things across file names, and `hooks.ts`, `log.ts`, `policy.ts`, and `selection.ts`
  each appear two or three times.
- **Deleted features spread across folders.** Uninstall, completion, the report files, the cache, and inline ignores
  touch about 20 files in 9 folders.

### The target

Every folder may import only from the rows below it, type imports included. `main.ts` imports `commands` and
`platform`.

| Layer | Folder       | Job                                                                                                                               | May import                                                        |
| ----- | ------------ | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 12    | `commands`   | the commander program; one file or folder per command; the shared edit step of `set`, `ignore`, `add`, and `remove`               | every row below                                                   |
| 11    | `checks`     | the custom analyses, one file or folder per kit under the kit category, and one registry keyed by check ID                        | every row below                                                   |
| 11    | `output`     | terminal text and `--json`                                                                                                        | `execution`, `generation`, `platform`                             |
| 10    | `execution`  | plan, run tools, read their output, snapshots of the index and of pushed commits, fixers, the finding model, the run report       | `lifecycle` and every row below it                                |
| 9     | `lifecycle`  | writes through the ownership log, merged fields, drift, the rule preview with its ESLint process, the hooks path, the version pin | `generation`, `tools`, `policy`, `kits`, `repository`, `platform` |
| 8     | `generation` | every generated file as text, with the markers of managed blocks                                                                  | `tools`, `policy`, `rules`, `kits`, `repository`, `platform`      |
| 7     | `tools`      | find, inspect, install, and run tools for every package manager, mise, and uv                                                     | `policy`, `kits`, `repository`, `platform`                        |
| 6     | `policy`     | `gspot.toml`: schema, read, validate, merge per scope, settings, mutations, profiles                                              | `rules`, `kits`, `repository`, `platform`                         |
| 5     | `rules`      | the agent rules, selected and assembled, and the `AGENTS.md` block                                                                | `kits`, `repository`, `platform`                                  |
| 4     | `kits`       | the manifest schema, loading, detection, selection, targets, and takeover of existing configuration                               | `repository`, `platform`                                          |
| 3     | `repository` | tracked files, kinds, tags, scopes, workspaces, package manifests, revisions, and the survey of existing tooling                  | `parsers`, `platform`                                             |
| 2     | `parsers`    | tree-sitter, SQL, and path references in prose                                                                                    | `platform`                                                        |
| 1     | `platform`   | files, atomic writes, processes, git, paths, errors, modes, `.gspot` locations, text and object helpers                           | Node and npm packages only                                        |

Write these layers into `[architecture]` in the `gspot.toml` of this repository, replacing `types_directory` and
`config_directory`, so the check that users get also guards gspot. How each mutual import breaks:

| Pair                     | Import removed            | How                                                                                                                                                         |
| ------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| checks and execution     | execution into checks     | the registry moves to `checks` and the check command passes it to the run; the finding model moves to `execution`; the census, cache, and report schemas go |
| checks and policy        | policy into checks        | the Jest coverage schema moves into the policy tool schema; the shipped naming policy moves into the policy audit                                           |
| kits and policy          | kits into policy          | `similar` and `compact` move to `platform`; the kit messages move to `kits`; a narrow type replaces the policy type                                         |
| kits and repository      | repository into kits      | takeover moves to `kits`; scope proposals take file patterns instead of kit manifests                                                                       |
| lifecycle and repository | repository into lifecycle | snapshots move to `execution`; hook detection moves to the survey                                                                                           |
| lifecycle and tools      | tools into lifecycle      | the install steps move to the install command; pending installs arrive as a parameter; tool projects receive the owner                                      |
| repository and tools     | repository into tools     | snapshots move to `execution`                                                                                                                               |
| generation and lifecycle | generation into lifecycle | the managed-block markers move to `generation`                                                                                                              |
| agents and policy        | rules into policy         | the rules take a narrow settings type; `similar` moves to `platform`                                                                                        |

Two more imports break the order today: `generation` reads the TypeScript compiler options from `checks`, and several
type-only chains run through `types`. The compiler options move to `generation`, and the types move to their owners.

Custom analyses follow the kits. A kit at `kits/<category>/<kit>` has its analyses in one file of that name under
`checks/<category>`, or in a folder when it needs two files or more. Code that several kits share goes to the lowest
kit they all require. Tests group by tier (`unit`, `integration`, `tools`, `acceptance`, `package`), then package,
then a mirror of the source path. Appendix B maps every file.

## 4. Bugs in code that stays

| Where                                                                                                                                                                                 | Problem                                                                                                                                                                                                                               | Action                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `packages/cli/src/config/agents.ts:30`                                                                                                                                                | tells users to edit `[rules]` in `gspot.toml`; the table is `[guides]` today                                                                                                                                                          | correct with the rename to rules            |
| `packages/cli/guides/templates/docs`                                                                                                                                                  | 8 files ship but never install; `packages/cli/guides/general/prose/DOCS-REVIEW.md:178` promises them                                                                                                                                  | delete both                                 |
| `packages/cli/guides/framework/fastapi/FASTAPI.md`, `RUNTIME.md`, and `packages/cli/guides/framework/nextjs/SECURITY.md`                                                              | never installed: no manifest names them                                                                                                                                                                                               | name them in their kits                     |
| `packages/cli/guides/language/YAML.md`, `packages/cli/guides/tool/tasks/TASKS.md`, `packages/cli/guides/tool/github-actions/GITHUB-ACTIONS.md`                                        | the front matter names a `configs` kit, which does not exist, and cloudflare                                                                                                                                                          | name the kit that installs them             |
| 26 kit manifest entries                                                                                                                                                               | name rules that every repository gets anyway, such as `TESTING.md`                                                                                                                                                                    | delete them                                 |
| `packages/cli/src/platform/assets.ts:58`, `packages/cli/scripts/build.ts:15`                                                                                                          | tell users to run a task that exists only in this repository                                                                                                                                                                          | name the package to reinstall               |
| `packages/cli/package.json`                                                                                                                                                           | `prettier` is a runtime dependency that `packages/cli/src` never loads                                                                                                                                                                | use it for the JSON layout, or remove it    |
| `mise.toml` (`guides:lint`)                                                                                                                                                           | runs test files that moved to `tests/integration/tools/guides`, and one that is gone                                                                                                                                                  | goes with the guide linter                  |
| `gspot.toml`                                                                                                                                                                          | entries for a deleted hook test and a `fail_fast` property; two typos words appear in no source                                                                                                                                       | delete                                      |
| `tests/support/package/run.ts:43`                                                                                                                                                     | `process.removeListener` receives new arrow functions and removes nothing                                                                                                                                                             | keep the handlers in variables              |
| `tests/timings/windows.json`                                                                                                                                                          | a copy of the Linux file; Bun reports Windows paths with backslashes, so no key matches                                                                                                                                               | regenerate it on Windows                    |
| `packages/cli/src/commands/ignore.ts:51`, `packages/cli/src/generation/eslint/blocks.ts:133`, `packages/cli/src/policy/write.ts:187`, `packages/cli/src/policy/setting-surface.ts:14` | compare with `JSON.stringify`, which depends on key order                                                                                                                                                                             | `isDeepStrictEqual`                         |
| `packages/cli/src/execution/fixers.ts:215`                                                                                                                                            | diff headers use backslashes on Windows                                                                                                                                                                                               | forward slashes                             |
| `packages/cli/src/config/kits.ts:65`                                                                                                                                                  | the word "length-guidenames", left by a bulk rename                                                                                                                                                                                   | fix                                         |
| `packages/cli/src/repository/existing-tooling.ts:181`                                                                                                                                 | `declaredKits` compares kit names with tool names, and its one caller never passes `selected`                                                                                                                                         | fix the comparison                          |
| `packages/cli/src/checks/structure/directories.ts:22`, `packages/cli/src/checks/structure/single-file-folder.ts:33`                                                                   | count only `.d.ts` files as declaration files                                                                                                                                                                                         | check with the shared extension table       |
| `.github/workflows/ci.yml:229`                                                                                                                                                        | the tool step rewrites `tests/timings` under `--shard` before the acceptance step reads it, so acceptance is never balanced by time                                                                                                   | delete the timings (appendix D.1)           |
| `tests/acceptance/source/kits/documents.test.ts`                                                                                                                                      | records 5 milliseconds on Linux: its 11 cases do not run there                                                                                                                                                                        | find out why                                |
| `packages/cli/src/repository/revisions/contents.ts:41`                                                                                                                                | likely: a tracked link to a folder, to an absolute path, outside the repository, or to a missing file makes every staged and push check exit 2                                                                                        | confirm with D.5 row 1                      |
| `packages/cli/src/lifecycle/ownership/installs.ts:36`                                                                                                                                 | likely: an install killed after the folder swap leaves a folder that the next install refuses                                                                                                                                         | confirm with D.5 row 2                      |
| `packages/cli/src/platform/root/writes.ts:104`                                                                                                                                        | likely: a stale writer lock with the ID of an unrelated process refuses forever, or throws for process 1                                                                                                                              | confirm with D.5 row 3                      |
| `packages/cli/src/commands/print-result.ts:27`                                                                                                                                        | likely: with `--json`, a plain error prints nothing on standard output                                                                                                                                                                | confirm with D.5 row 6                      |
| `packages/cli/src/checks/dependencies/lockfile/hosts.ts:35`                                                                                                                           | likely: `npm-shrinkwrap.json` is never read, although its parser exists                                                                                                                                                               | confirm with D.5 row 30                     |
| `packages/cli/src/policy/merge.ts:30`                                                                                                                                                 | possible: the root wins over a nested scope for tool settings                                                                                                                                                                         | confirm with D.5 row 25                     |
| the agent rules                                                                                                                                                                       | teach code that the shipped ESLint, SwiftLint, and Stylelint configurations reject                                                                                                                                                    | appendix F.3                                |
| `packages/cli/src/tools/python-project.ts:180`                                                                                                                                        | the tool lock is rebuilt only when it no longer matches the tool project, so no command upgrades a transitive package; on October 1, 2026, an advisory against `pyjwt`, which Semgrep pulls in, blocked every push of this repository | a command that relocks within the pins      |
| `packages/cli/src/commands/set.ts:162`                                                                                                                                                | adding to a list prints `key = [the added item]`, which reads as if `set` replaced the list                                                                                                                                           | print the whole list, or say what was added |
| `docs/scripts/links.ts`                                                                                                                                                               | its last step compares the schema with the function that wrote it, so it always passes                                                                                                                                                | delete that step                            |
| `docs/src/components/starlight/SiteTitle.astro:13`                                                                                                                                    | repeats the background image of line 12                                                                                                                                                                                               | delete the line                             |

## 5. Delete

### 5.1 Features the owner removed

| Feature                        | Code                                                                                                                                                                                                                            | Lines     | Test lines |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| `uninstall`                    | `packages/cli/src/commands/uninstall.ts`, `uninstallHooks` in `packages/cli/src/lifecycle/hooks.ts`, `Owner.restore`, the uninstall types, and the docs page with its diagram                                                   | about 250 | about 400  |
| `completion`                   | `packages/cli/src/commands/completion.ts` and the dependency `@bomb.sh/tab`                                                                                                                                                     | 18        | 56         |
| the report files               | `packages/cli/src/output/report.ts`, `packages/cli/src/execution/report.ts`, `writeReport` in the check command, the upload steps in the CI generator, `ci.sarif` in the policy schema, and the dependency `node-sarif-builder` | about 260 | about 500  |
| the result cache               | `packages/cli/src/execution/cache.ts`, `packages/cli/src/execution/result-cache.ts`, `--no-cache`, the `cached` manifest field, and the wiring in `packages/cli/src/execution/execute.ts`                                       | about 330 | about 610  |
| inline `gspot-ignore` comments | the inline parser in `packages/cli/src/execution/ignores.ts`, its patterns, the suppression count in the run report, and the Ruby grammar                                                                                       | about 400 | about 470  |

The `[[ignore]]` table in `gspot.toml` stays. `packages/cli/src/checks/security/sarif.ts` stays: it reads the output
of CodeQL, not a report file of gspot.

### 5.2 Byte backups of replaced files

With `uninstall` gone, nothing puts a replaced file back. The one remaining reader is the prune after `gspot remove`,
which brings back a configuration the user replaced long ago. Git keeps those bytes.

- **Delete:** the recovery folder under the `state` folder of `.gspot`, the `backup` field, the backup writer and its pruning,
  `restoreFromBackup`, `originalRead`, `RECOVERY_OWNER`, the `beforeBackup` of pending writes, and the note about a
  retained original. `init` deletes the files it takes over.
- **Keep:** the ownership entries with their identity, which drift, stray detection, prune, and the refusal to
  overwrite edited files need.
- **Keep:** the field-level originals of merged configuration, because git cannot remove gspot keys from a
  `package.json` the user kept editing.
- **Keep:** the block originals, the pending before-and-after identities, and the marker of the crash-safe tool folder
  swap.
- **Change:** `original: { hash, mode, isLink, backup }` becomes `adopted: true`. Its one remaining use is to leave a
  file in place on prune when it already held the exact bytes gspot writes.

### 5.3 Checks that repeat a real tool

| Check                                                                 | Repeats                                                                                                                      | Lines            |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `fastapi/no-blocking-io-in-async`                                     | Ruff `ASYNC210` to `ASYNC251`, which `packages/cli/kits/language/python/ruff.toml.tmpl:1` always selects                     | 62               |
| `python/import-cycles`                                                | basedpyright `reportImportCycles`, which `packages/cli/kits/language/python/basedpyrightconfig.json.tmpl:18` always turns on | 36               |
| `xcode/plist`                                                         | `files/plist` runs the same `plutil -lint`, and the xcode kit requires the files kit                                         | a manifest entry |
| `files/json`, `markdown/prettier`, `prose/messages`, `prose/doc-tags` | nothing: each only points at another check through `reported_by`                                                             | manifest entries |

No other check repeats a pinned tool exactly.

### 5.4 Dead plugin rules

| Rule                         | Why                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `no-reexports-outside-index` | nothing turns it on                                                                                                      |
| `no-harness-barrel-imports`  | inert in every generated configuration; `packages/cli/src/generation/eslint/configuration.ts:143` to `:149` goes with it |
| `no-export-only-files`       | `no-reexports` covers it                                                                                                 |

The other 22 rules stay.

### 5.5 Code written for this repository that ships to users

| Where                                                                                                                                                           | What it forces on users                                                                                                                                 | Action                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/eslint-plugin/src/config/import-direction.ts:3`                                                                                                       | roles for `tests/support`, `config`, `src/env`, `types`, and `src`                                                                                      | no default roles                                           |
| `packages/cli/src/config/generation.ts:83`                                                                                                                      | the same roles again, already different from the plugin copy                                                                                            | delete                                                     |
| `packages/cli/src/generation/eslint/configuration.ts:27`                                                                                                        | a `types` role even when the user sets none                                                                                                             | delete                                                     |
| `packages/eslint-plugin/src/rules/tests-directory-contents.ts:34`                                                                                               | a `tests/support` folder for any helper beside tests                                                                                                    | the harness folder becomes a required option               |
| `packages/eslint-plugin/src/rules/env-access-owner.ts:37`                                                                                                       | environment reads only under `src/env` or `config`                                                                                                      | no default owners                                          |
| `packages/cli/kits/tool/jest/manifest.toml:82`, `packages/cli/kits/tool/vitest/manifest.toml:88`                                                                | `harness_directory = "tests/support"`, which feeds four other checks                                                                                    | no default                                                 |
| `packages/cli/guides/general/code/TESTING.md:62`, `packages/cli/guides/general/code/NAMING-FILES.md:28`, and `packages/cli/guides/language/naming/PYTHON.md:33` | tell agents to use `tests/support`                                                                                                                      | name the harness setting instead                           |
| `packages/cli/kits/language/javascript/eslint.config.js.tmpl:69`                                                                                                | the internal error class `GspotError`                                                                                                                   | delete                                                     |
| `packages/cli/kits/language/javascript/eslint.config.js.tmpl:187`                                                                                               | an internal decision number                                                                                                                             | delete                                                     |
| `packages/cli/kits/general/prose/styles/gspot/corruption.yml`                                                                                                   | a Vale rule for damage from an old bulk rename in this repository                                                                                       | delete                                                     |
| `packages/cli/kits/language/javascript/manifest.toml:2`                                                                                                         | the knip entry files `src/plugin`, `build.ts`, and `publish.ts`                                                                                         | delete                                                     |
| `packages/cli/kits/general/naming/policy.json`                                                                                                                  | bans `catalog`, `corpus`, `render`, `load`, `fetch`, and `resolve`, words this repository chose to avoid, and puts a two-digit prefix on Markdown files | move to the `gspot.toml` of this repository                |
| `packages/cli/src/config/checks/structure.ts:62` to `:263`                                                                                                      | the Bash conventions of another project: `run_ssh` blocks, `nvidia-smi` sweeps, include guards, a four-line header                                      | the project-specific names become settings with no default |

### 5.6 Code that lints this repository

| What                                                                                                                                                                                      | Action                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| the guide linter: `packages/cli/src/agents/lint.ts`, `examples.ts`, `metadata.ts`, 14 constants, `packages/cli/scripts/guides-lint.ts`, and three of the tests in `tests/unit/cli/agents` | delete                                        |
| the tests that run rule examples through the generated configuration: `tests/integration/tools/guides` and `tests/integration/tools/bash/example.test.ts`                                 | delete                                        |
| the `guides/lint` and `tests/unit` checks in `gspot.toml`                                                                                                                                 | delete; CI runs the tests directly            |
| `types_directory`, `config_directory`, 19 `naming.contract_properties`, the `[structure]` exemptions, and the `[[ignore]]` entries for this repository                                    | delete with the folders and checks they serve |
| the jest kit in the kit list of this repository, which runs Bun tests                                                                                                                     | delete                                        |
| `testToolsText` in `packages/cli/src/generation/tools/mise.ts`                                                                                                                            | move to the test pin script                   |
| the tasks `gspot`, `check`, `doctor`, and `guides:lint`                                                                                                                                   | one `gspot` task                              |

### 5.7 Dead code and migrations

- 36 exports used only inside their own file; drop `export`. Knip misses them because of `ignoreExportsUsedInFile`.
- 49 exports used only by tests. `setEnvironmentVariable` in `packages/cli/src/platform/environment.ts` and
  `appendEntry` in `packages/cli/src/policy/write.ts` are called nowhere.
- Types used nowhere: `Declared`, `ForeignKey`, `ParsedModules`, `ParsedSwift`, `ProjectRoot`, `SettingRow`,
  `LimitTable`, `ArchitectureAllow`, `StructureSettings`, `PolicyScope`, and `RefMapping`.
- Constants imported nowhere: `CONFLICT_HELP`, `MOVE_HELP`, and `STRAY_HELP` in
  `packages/cli/src/config/checks/repository.ts`, and `GRAMMAR_NAMES` in `packages/cli/src/platform/assets.ts`.
- Migration code, which a product with no release does not need: the pruning of retired `.gspot` entries at
  `packages/cli/src/lifecycle/ownership/log.ts:183`, the old layouts in `LIFECYCLE_PRIVATE_PATH`, and the policy
  version gate in `packages/cli/src/policy/read.ts`.
- The parsing of npm lockfile version 1, binary `bun.lockb`, and old pnpm keys stays: it reads the lockfiles of users,
  not gspot state.
- Ticket numbers such as K-93 in comments, for example `packages/cli/src/kits/schema.ts:164`.

### 5.8 Repository and docs files

| What                                                                                                                                      | Action                      |
| ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `architecture` and, once the work lands, `architecture.png`, `folder-structure.png`, and this file                                        | delete                      |
| root `dist`, `.ansible`, `.ruff_cache`, and 19 empty folders under `tests`                                                                | delete                      |
| `docs/src/content/docs/guides/build.md`, contributor content in the user site                                                             | move into `CONTRIBUTING.md` |
| `docs/README.md` beyond the asset license notices                                                                                         | delete                      |
| 17 files in `docs/public` that nothing references, such as `docs/public/brand/readme/tools` and `docs/public/brand/diagrams/recovery.svg` | delete                      |
| the page of engines, a concept the registry removes                                                                                       | delete                      |
| the `[test]` section of `bunfig.toml`, which `tests/bunfig.toml` repeats                                                                  | delete                      |
| pins in `.mise/conf.d/test-tools.toml` that repeat `.mise/conf.d/gspot-tools.toml`                                                        | keep only the extra pins    |
| stale `.gitignore` lines for the root `dist` and the generated reference folder of the docs                                               | delete                      |

## 6. Move, merge, and replace

### 6.1 `config` and `types`

The owner keeps constants in a folder named `config`, decided on September 28, 2026. The folder has three problems: 588
of its 663 exports have exactly one importer, 17 of its 32 files have no blank line between groups, and `config` and
`types` import each other. With the folder kept:

- One `config` file per folder that reads it, named after that folder, with groups separated by blank lines.
- Values that several folders share go to one file each: git, file modes, `.gspot` locations, and exit codes.
- Constants that nothing imports go.
- `config` imports nothing but `platform`, and no type imports `config`.

If the owner dissolves the folder instead, every constant moves to the module that reads it, as appendix B.1 maps.
`types` holds 402 types, 215 of them with one user. A type beside its zod schema can be `z.infer`. Fifteen test files and
`docs/src/content/reference/definitions.ts` import from `types` and change with it. In the plugin, each rule holds its
own option types. Helpers for text, objects, and shell quoting move to `platform` either way.

### 6.2 Duplicates to merge

| What                                                                                          | Copies      | Merge into                                                 |
| --------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------- |
| open a root, try, close                                                                       | 58          | `Symbol.dispose` on `Root`, `using`, and `readText`        |
| temporary folder and cleanup                                                                  | 17          | one disposable helper on `Root`                            |
| check that bytes are UTF-8                                                                    | about 13    | `isUtf8` from `node:buffer`, in one decode helper          |
| sha256 hex                                                                                    | 12          | one helper                                                 |
| run git                                                                                       | about 10    | one git module with one timeout                            |
| is it a plain object                                                                          | 7           | one helper; the copies disagree about arrays               |
| get a value by dotted path                                                                    | 6           | one helper                                                 |
| parse JSON with comments                                                                      | 5           | `packages/cli/src/repository/jsonc.ts`                     |
| directory walkers                                                                             | 8           | one walker                                                 |
| forward slashes, base name, inside a root, inside a scope                                     | about 60    | `toPosix`, `posix.basename`, one `isInside`, `isInScope`   |
| `run` and `runBinary` in `packages/cli/src/platform/spawn.ts`                                 | 2           | one function with an encoding option                       |
| five ESLint checks for JavaScript, TypeScript, Vue, Svelte, and Astro                         | 5 processes | one ESLint check                                           |
| lockfile tables, extension tables, and test-file definitions, which disagree today            | about 17    | one table each                                             |
| exit code 2 under six names, the `.gspot` literal about 86 times, 1000, 1024, 100, file modes | many        | one constant each                                          |
| the "is it a `require` call" test in the plugin                                               | 3           | `isRequireCall` in `packages/eslint-plugin/src/imports.ts` |
| the git helper in the tests                                                                   | 5           | `gitOutput` and `commitAll` in `tests/support/cli/git.ts`  |

### 6.3 Libraries for hand-written code

| Hand-written                                                                        | Replacement                                                                      |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| the glob walker `globPaths` in `packages/cli/src/platform/paths.ts`                 | `tinyglobby`                                                                     |
| the JSON layout in `packages/cli/src/generation/json-format.ts`                     | Prettier, which is a runtime dependency already                                  |
| the GitHub workflow built from strings in `packages/cli/src/generation/workflow.ts` | `yaml`, which is a dependency already                                            |
| cache home and CI detection in `packages/cli/src/platform/environment.ts`           | `env-paths` and `std-env`                                                        |
| typed commander flags in `packages/cli/src/platform/arguments.ts`                   | `@commander-js/extra-typings`                                                    |
| `packages/cli/src/platform/code-points.ts`                                          | `Array.from`                                                                     |
| the edit distance in `packages/cli/src/policy/similar.ts`                           | `fastest-levenshtein`                                                            |
| hand-escaped regular expressions                                                    | `RegExp.escape`, once `packages/cli/package.json` asks for Node 24 like the root |

## 7. Names

Three sweeps read every name in the code that stays and found about 1,200 names to change. Appendix A lists each one.
The patterns behind most of them:

- **Two flags one letter apart.** `check --stage` picks which checks run, and `check --staged` picks which files. The
  hook flag becomes `--hook`.
- **Engine names in check IDs.** 37 checks start with `integrity/` or `structure/` instead of their kit; all 19 checks
  of the bash kit are `structure/*`. Each custom check also carries a second name in `analysis` and a third as its
  function.
- **Rules.** It becomes the one word for the agent rules. A lint rule of a tool is a tool rule, the preview readers in
  `packages/cli/src/lifecycle/rules` move to a preview folder, and the ast-grep folder of the bash kit becomes
  `ast-grep`.
- **Kits.** `formatting` becomes `format`, like its `[format]` table. The GitHub Actions tools leave the files kit for a
  new `actions` kit.
- **Verbs.** The naming guide asks for `get`, `parse`, `build`, `assert`, `is`, and `has`. The code has 33 `read*`
  functions, 51 ending in `Of`, 34 ending in `For`, and about 110 named with a bare noun or adjective.
- **One word per concept.** Directory, not folder. `files` means a list of tracked files, never the root handle, which
  carries that name in 107 places. Each of these pairs becomes one word:
  installs and installations; location and position; config and configuration.
- **Filler.** `DEFAULT_` on 21 constants, `existing`, `current`, `raw`, `entry`, and `spec` in hundreds of places, and
  the folder name repeated inside file and function names.

## 8. Functions exempted from the tiny-function rule

The repository suppresses `gspot/no-trivial-functions` 191 times, plus one file-wide exemption. Every one was read with
its callers. 132 of them earn their name and stay. 25 are inlined, and 22 merge into a neighbor. Seven become a
standard function or a shared helper, one is deleted, and four go with deleted features.

22 of the written reasons are false. They cite tests as callers, claim one owner for code written elsewhere too, or
count callers that do not exist. Appendix C gives the verdict for each function.

The rule stays, but its own test cases show a cost to users: a clean React component and a clean Nest module need
suppressions to pass (`tests/acceptance/source/kits/react.test.ts:26` and
`tests/inputs/acceptance/source/kits/kits.ts:154`). Turn both tiny rules off for components in the React kit and for
modules in the NestJS kit, as the Astro kit does for `.astro` files.

## 9. Tests

Appendix D judges all 514 test files. The summary:

- **About 1,140 cases go or shrink.** They check wording, pin the content of gspot, restate a schema, repeat another
  test, test the test harness, or test removed features. About 9,700 test lines go.
- **About 300 acceptance cases move to faster tiers,** because most need no native tool. One case per kit that proves
  the wiring stays; one planted defect per third-party rule goes. Each Linux CI run saves about 2,500 seconds.
- **Five tiers named by what a test needs:** `unit`, `integration`, `tools`, `acceptance`, and `package` (D.1).
- **`tests/timings` goes.** A CI bug means it never balanced acceptance, and it saves little after the cuts.
- **`tests/inputs` becomes two folders, `config` and `samples`.** The config folder holds the hard-coded parameters,
  such as timeouts; the samples folder holds planted content that several tests share. The rest goes inline.
- **`tests/support` becomes a `harness` folder,** and four runners move to a root `scripts` folder.
- **34 tests for real scenarios are missing** (D.5). Six of them confirm or clear likely bugs (section 4).
- **The planted test packages lack the `description`** that the linted `package.json` rules require; that caused 10 CI
  failures.

## 10. Documentation and the rules

Appendix E covers the docs site and every Markdown file outside the rules; appendix F covers the 99 files of agent
rules.

- **Docs:** 58 findings of bloat, 86 places that go stale once this audit lands, and 8 claims that are false today.
  Two pages go, 17 shorten, and 7 get rewritten.
- **The worst false claim:** the install commands lack an exact version, so a newer gspot than the pin makes six
  commands refuse.
- **Rules:** 11,662 lines become about 7,100. The paragraph about levels repeats in 65 files, although assembly applies
  levels. Eleven files install empty at level recommended, and one rule appears in up to eight files.
- **Rules that mislead:** several teach code that the shipped linters reject (F.3), and some carry the preferences of
  this repository or of other projects.

## 11. CI and tasks

CI run 36765405183 failed in 16 of 21 jobs. The causes, none of them fixed yet:

| Cause                                                                                                               | Jobs                        | Fix                                                                              |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------- |
| planted test packages lack the `description` that the linted `package.json` rules require                           | 7 shards on Linux and macOS | add descriptions (section 9)                                                     |
| the 5,000-file staged run takes 5.3 s against a 5 s limit                                                           | 3 shards                    | a manual benchmark (section 9)                                                   |
| `commits/range` lints every commit back to the first, once per scope: 264 findings, 4 times, 6 to 8 minutes each    | check                       | lint only the commits of the pull request or push, once                          |
| gitleaks flags three secret-shaped test values                                                                      | check                       | an allow list for those test files                                               |
| Vale has no styles, because CI runs `install` and only `apply` downloads them                                       | check                       | download the styles in `install`                                                 |
| `doctor` finds `plutil`, `xmllint`, and `zsh` missing                                                               | check                       | install them in the check job as the other jobs do                               |
| Windows: timeouts, backslash paths, line endings on checkout, exit code 130 after a signal where 2 is expected      | 7 jobs                      | forward slashes in output, `eol=lf` for test files, map signals, longer timeouts |
| `tests/timings` is rewritten by the tool step before acceptance reads it, and the Windows file copies the Linux one | 17 shards                   | delete the timings and shard by file count (appendix D.1)                        |
| macOS runners have no Docker                                                                                        | 1 shard                     | skip the Docker cases on macOS                                                   |

The rest of CI and the tasks:

| What                                                                                                                                           | Action                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| the `docs` job runs `test:docs`, which `test` already runs on 3 systems                                                                        | keep only `docs:build`                |
| the release runs `test:package` again after CI ran it                                                                                          | delete the second run                 |
| `actions/cache` copied into 4 jobs                                                                                                             | one composite step                    |
| `site.yml`: the `source_ref` input, `site:verify-release`, `site:record-source`, the extra artifact, and a concurrency group that never queues | delete; build the tag and deploy      |
| the tasks `test:unit`, `test:integration`, `test:docs`, and `test:bash-example`                                                                | delete                                |
| the task `docs:check-links`                                                                                                                    | fold into `docs:build`                |
| the tasks `repo:setup` and `prepare:grammar`, which run the same script                                                                        | one task                              |
| 17 shards of uneven length; each pays for its own setup                                                                                        | 12 shards of equal size, 4 per system |
| task and job names                                                                                                                             | appendix A.9                          |

## 12. Order of work

| Stage | What                                                                                                                   | Size                              |
| ----- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1     | The owner answers the open questions (section 1)                                                                       | none                              |
| 2     | Delete the removed features, the byte backups, and their tests (5.1 and 5.2)                                           | about 1,600 source lines          |
| 3     | Delete duplicates, dead rules, repository defaults, the self-lint code, dead code, and files (5.3 to 5.8)              | about 1,900 lines, 1.5 GB on disk |
| 4     | Settle `config` and `types`, move every file to its place, and write the layers into `gspot.toml` (3, 6.1, appendix B) | about 400 files touched           |
| 5     | Rename: rules, packages, check IDs, settings, and identifiers (7, appendix A)                                          | about 1,200 names                 |
| 6     | Merge duplicates, adopt libraries, and fix the bugs (4, 6.2, 6.3)                                                      | about 1,000 lines saved           |
| 7     | Settle each tiny function (8, appendix C)                                                                              | 56 suppressions                   |
| 8     | Restructure and clean the tests, then add the missing ones (9, appendix D)                                             | about 500 files moved             |
| 9     | Shorten the docs and the rules (10, appendices E and F)                                                                | about 6,000 lines                 |
| 10    | Fix CI (11)                                                                                                            | 16 failing jobs                   |

## Appendix A: names to change

Three sweeps read every name in the code that stays. The first read the names users type or read, the second the names
in the kept features, and the third the names in the checks, kits, and plugin. File and folder renames are in appendix B, not here. Nothing is released,
so a rename that changes `gspot.toml`, `--json`, or the ownership file costs only edits in this repository.

### A.1 The rules behind every proposal

- **One name per concept, one concept per name.** Directory, not folder, in code. `rules` means the agent rules alone;
  a lint rule of a tool is a tool rule.
- **The verbs of the naming guide.** `packages/cli/guides/general/code/NAMING.md` says `get`, `parse`, `build`,
  `assert`, `is` and `has`, `add` and `remove` for memory, `delete` for files. The code has 33 `read*` functions, 51
  ending in `Of`, 34 ending in `For`, and about 110 functions named with a bare noun or adjective.
- **No filler.** Drop the folder or file name repeated inside a name.
- **No filler words** unless the word is the meaning: data, info, value, entry, spec, config, options, helper, util,
  existing, current, default, raw, all, and every.
- **Check IDs are `<kit>/<tool>`.** A second check of the same tool adds one mode word. A custom analysis is named by
  what it finds, never with `no-`.
- **No engine names in check IDs,** such as `integrity/` or `structure/`. The two checks that belong to no kit start
  with `gspot/`.
- **Settings.** `exclude` holds paths a tool never reads, `ignore` holds accepted findings. Regular expressions end in
  `_pattern`. Lists are plural. `tools.<name>` holds only real tools. One `when` field for every condition.
- **Tasks put the verb first.**

### A.2 Command line

| Where                                                                                            | Now                                   | Proposed                         | Why                                                   |
| ------------------------------------------------------------------------------------------------ | ------------------------------------- | -------------------------------- | ----------------------------------------------------- |
| `packages/cli/src/commands/init/command.ts:143`                                                  | `--no-guides`                         | `--no-rules`                     | guides become rules                                   |
| `packages/cli/src/commands/check/command.ts:148`                                                 | `--stage <stage>` beside `--staged`   | `--hook <commit\|push\|message>` | two flags one letter apart that mean unrelated things |
| `packages/cli/src/commands/check/command.ts:153`                                                 | `--stage message --message-file "$1"` | `--message-file` alone           | two flags state one fact                              |
| `packages/cli/src/commands/init/command.ts:127` and three more                                   | help heading `Effects:`               | fold it into the description     | it repeats `.description()`                           |
| `packages/cli/src/commands/init/command.ts:127`, `packages/cli/src/commands/apply/command.ts:80` | "guides for coding agents"            | "rules for coding agents"        | the program description already says rules            |
| `packages/cli/src/commands/program.ts:66`, `packages/cli/src/commands/check/command.ts:133`      | "folder"                              | "directory"                      | one word                                              |

### A.3 `gspot.toml` keys

| Where                                                                                                                                                                    | Now                                                                            | Proposed                                                | Why                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/cli/src/policy/schema.ts:188`                                                                                                                                  | `[guides]`                                                                     | `[rules]`                                               | decided                                                                   |
| `packages/cli/src/policy/schema.ts:190`                                                                                                                                  | `guides.directory = ".gspot/guides"`                                           | `rules.path`, set to a `rules` folder in `.gspot`       | one location is `path` elsewhere                                          |
| `packages/cli/src/policy/schema.ts:189`                                                                                                                                  | `[hooks]` on when present, beside `[guides] install = true`                    | one style for both                                      | opposite on-and-off styles                                                |
| `packages/cli/src/policy/schema.ts:193`                                                                                                                                  | `guides.project`                                                               | `rules.local`                                           | the value is the repository's own rules folder                            |
| `packages/cli/src/policy/schema.ts:195`                                                                                                                                  | `guides.agents`                                                                | `rules.instructions`                                    | it lists instruction files, not agents                                    |
| `packages/cli/src/policy/schema.ts:285`                                                                                                                                  | `[runner] tool = "mise"`                                                       | `runner = "mise"`                                       | a table with one key                                                      |
| `packages/cli/src/policy/schema.ts:273`                                                                                                                                  | `version = 1`                                                                  | delete                                                  | the version gate is migration code                                        |
| `packages/cli/src/policy/schema.ts:265`                                                                                                                                  | `extra_checks`                                                                 | `enable`                                                | pairs with `[[ignore]]`; "extra" adds nothing                             |
| `packages/cli/src/policy/schema.ts:133`                                                                                                                                  | `[[generated]] produced_by`                                                    | `generator`                                             | one noun                                                                  |
| `packages/cli/src/policy/schema.ts:153`, `packages/cli/src/kits/schema.ts:89`                                                                                            | `fix_command`                                                                  | `fix`                                                   | beside `command`, the suffix repeats                                      |
| `packages/cli/src/policy/schema.ts:155`, `packages/cli/src/kits/schema.ts:92`                                                                                            | `findings_exit_codes`                                                          | `exit_codes`                                            | any other nonzero exit is a crash                                         |
| `packages/cli/src/policy/schema.ts:165`                                                                                                                                  | `count_regex`                                                                  | `count_pattern`                                         | the siblings end in `_pattern`                                            |
| `packages/cli/src/policy/schema.ts:166`, `packages/cli/src/kits/tools.ts:53`                                                                                             | `tool_errors` and `crash_pattern`                                              | `crash_pattern`                                         | one concept: `packages/cli/src/execution/broken-tool.ts:115` reads either |
| `packages/cli/src/policy/schema.ts:172`                                                                                                                                  | `platform` holding a list                                                      | `platforms`                                             | a list; the tool field is already plural                                  |
| `packages/cli/src/policy/schema.ts:171`                                                                                                                                  | `requires` (build, docker, network)                                            | `needs`                                                 | `[kit] requires` means kits                                               |
| `packages/cli/src/policy/schema.ts:110`                                                                                                                                  | `format.trailing_comma`                                                        | `format.trailing_commas`                                | the siblings are plural                                                   |
| `packages/cli/src/policy/schema.ts:108`                                                                                                                                  | `format.newline_at_end`                                                        | `format.final_newline`                                  | the EditorConfig term                                                     |
| `packages/cli/src/policy/tools.ts:95`                                                                                                                                    | `tools.prettier.ignore_patterns`                                               | `tools.prettier.exclude`                                | paths a tool never reads                                                  |
| `packages/cli/kits/general/docs/manifest.toml:150`                                                                                                                       | `tools.lychee.exclude` (URL patterns) beside `exclude_paths`                   | `tools.lychee.exclude_urls`                             | neither key says what it leaves out                                       |
| `packages/cli/kits/general/security/manifest.toml:145`                                                                                                                   | `tools.semgrep.ignore` (paths)                                                 | `tools.semgrep.exclude`                                 | paths, not findings                                                       |
| `packages/cli/kits/general/security/manifest.toml:131`                                                                                                                   | `tools.semgrep.rules` (rule files)                                             | `tools.semgrep.configs`                                 | Semgrep's word; `rules` holds per-rule options everywhere else            |
| `packages/cli/kits/general/security/manifest.toml:124`                                                                                                                   | `tools.codeql.false_positives`                                                 | `tools.codeql.ignore`                                   | accepted findings, like `tools.trivy.ignore` and `tools.osv.ignore`       |
| `packages/cli/kits/general/dependencies/osv-scanner.toml.tmpl:4`                                                                                                         | `[[tools.osv.ignore]] review_by`                                               | `until`                                                 | the word osv uses                                                         |
| `packages/cli/src/policy/tools.ts:87`                                                                                                                                    | `coverage_lines`, `_branches`, `_functions`, `_statements`                     | `coverage = { lines, branches, functions, statements }` | the prefix repeats four times per tool                                    |
| `packages/cli/kits/tool/pytest/manifest.toml:37`                                                                                                                         | `tools.pytest.coverage` (lines only)                                           | `coverage.lines`                                        | like its siblings                                                         |
| `packages/cli/kits/tool/vitest/manifest.toml:49`                                                                                                                         | `tools.vitest.coverage_file`                                                   | `tools.vitest.config`                                   | it is the Vitest configuration file                                       |
| `packages/cli/kits/tool/jest/manifest.toml:90`                                                                                                                           | `tools.jest.global_package`                                                    | `tools.jest.test_module`                                | `bun:test` is not a package                                               |
| `packages/cli/kits/tool/jest/manifest.toml:82`, `packages/cli/kits/tool/vitest/manifest.toml:88`                                                                         | `harness_directory` per runner                                                 | `architecture.roles.harness`, with no default           | three settings for one folder                                             |
| `packages/cli/kits/language/javascript/manifest.toml:259`                                                                                                                | `tools.eslint.script_languages`                                                | `tools.eslint.component_languages`                      | "script" also means build scripts in `script_files`                       |
| `packages/cli/kits/language/javascript/manifest.toml:301`                                                                                                                | `tools.eslint.globals`                                                         | `tools.eslint.runtimes`                                 | the values are node, browser, worker, and commonjs                        |
| `packages/cli/kits/general/files/manifest.toml:305`                                                                                                                      | `tools.taplo.rules`                                                            | `tools.taplo.formatting`                                | Taplo's own table name; these are not lint rules                          |
| `packages/cli/kits/general/dependencies/manifest.toml:154`, `packages/cli/kits/general/structure/manifest.toml:400`                                                      | `tools.install.min_release_age_days` and `limits.install.min_release_age_days` | `[install] min_release_age_days`                        | declared twice; `install` is not a tool                                   |
| `packages/cli/kits/general/dependencies/manifest.toml:161`                                                                                                               | `tools.install.security_scanner`                                               | `install.scanner`                                       | Bun's term                                                                |
| `packages/cli/src/config/kits.ts:20`, `packages/cli/kits/tool/docker/manifest.toml:168`                                                                                  | `limits.tool_seconds` (a number) and `tools.trivy.timeout = "10m"`             | one top-level `timeout`, one format                     | not a limit on code shape; two formats                                    |
| `packages/cli/kits/general/secrets/gitleaks.toml.tmpl:7`                                                                                                                 | entry keys `regexes` and `patterns`                                            | `patterns`                                              | two words for regular expression lists                                    |
| `packages/cli/kits/general/structure/manifest.toml:207`, `:270`, `:337`                                                                                                  | `nested_blocks`, `nested_callbacks`, `bash.function_nesting`                   | `nesting`, `callback_nesting`, `bash.nesting`           | three phrasings of one idea                                               |
| `packages/cli/kits/general/structure/manifest.toml:278`, `:351`, `packages/cli/kits/language/swift/manifest.toml:258`                                                    | `identical_functions`, `bash.duplicate_min_lines`, `swift.duplicate_min_lines` | `duplicate_lines`                                       | one limit, three names; `identical_functions` holds a line count          |
| `packages/cli/kits/general/structure/manifest.toml:254`                                                                                                                  | `limits.boolean_expressions`                                                   | `limits.boolean_operators`                              | its summary counts operators                                              |
| `packages/cli/kits/general/structure/manifest.toml:309`                                                                                                                  | `limits.file_size_kb`                                                          | `limits.file_kb`                                        | the unit says size                                                        |
| `packages/cli/kits/general/structure/manifest.toml:330`                                                                                                                  | `limits.bash.function_branches`                                                | `limits.bash.branches`                                  | the general key is `limits.branches`                                      |
| `packages/cli/kits/general/structure/manifest.toml:344`                                                                                                                  | `limits.bash.mutable_assignments`                                              | `limits.bash.assignments`                               | three names for one limit                                                 |
| `packages/cli/kits/general/structure/manifest.toml:365`, `:372`                                                                                                          | `swift.type_body_length`, `swift.closure_body_length`                          | `swift.type_lines`, `swift.closure_lines`               | the siblings end in `_lines`                                              |
| `packages/cli/kits/general/structure/manifest.toml:415`                                                                                                                  | `structure.single_file_folder_allowed`                                         | `structure.lone_files_allowed`                          | four words; the finding is `lone-file`                                    |
| `packages/cli/kits/general/structure/manifest.toml:422`                                                                                                                  | `structure.prefix_collision_allowed`                                           | `structure.prefix_collisions_allowed`                   | the limit is plural                                                       |
| `packages/cli/kits/general/structure/manifest.toml:429`                                                                                                                  | `structure.folder_name_allowed`                                                | `structure.folder_names_allowed`                        | the check is `folder-names`                                               |
| `packages/cli/kits/general/naming/manifest.toml:53`                                                                                                                      | `naming.banned_terms`                                                          | `naming.banned`                                         | the siblings are one word                                                 |
| `packages/cli/kits/general/naming/manifest.toml:81`                                                                                                                      | `naming.remove_groups`                                                         | `naming.dropped_groups`                                 | a verb as a key                                                           |
| `packages/cli/kits/general/naming/manifest.toml:88`                                                                                                                      | `naming.contract_properties`                                                   | `naming.protocol_keys`                                  | the summary says keys a protocol fixes                                    |
| `packages/cli/kits/language/python/manifest.toml:471`                                                                                                                    | `structure.python.max_package_exports`                                         | `limits.python.package_exports`                         | a limit outside `limits`                                                  |
| `packages/cli/kits/language/python/manifest.toml:478`                                                                                                                    | `tools.dependencies.pip_install_allowed`                                       | `tools.pip.installs_allowed`                            | the python kit writes into the dependencies kit                           |
| `packages/cli/kits/language/bash/manifest.toml:440`                                                                                                                      | `tools.bash.safety.owners`                                                     | `tools.bash.safety_owners`                              | its sibling `config_owners` is flat                                       |
| `packages/cli/kits/language/bash/manifest.toml:433`                                                                                                                      | `tools.bash.architecture_roots`                                                | `tools.bash.boundary_roots`                             | the roots of the boundary header                                          |
| `packages/cli/kits/language/bash/manifest.toml:447`                                                                                                                      | `tools.bash.default_fragments_allowed`                                         | `tools.bash.defaults_allowed`                           | four words                                                                |
| `packages/cli/kits/language/bash/manifest.toml:454`                                                                                                                      | `tools.bash.runtime_header`                                                    | `tools.bash.platforms`                                  | it holds the platform list                                                |
| `packages/cli/kits/general/docs/manifest.toml:136`                                                                                                                       | `tools.docs.require_license`                                                   | `tools.docs.license`                                    | a verb on a boolean                                                       |
| `packages/cli/kits/general/docs/manifest.toml:143`                                                                                                                       | `tools.docs.contents_threshold`                                                | `limits.docs.contents_headings`                         | a limit outside `limits`                                                  |
| `packages/cli/kits/general/docs/manifest.toml:122`                                                                                                                       | `tools.docs.paths_allowed` with `patterns` entries                             | `tools.docs.exclude` with `paths`                       | every other path list says `paths`                                        |
| `packages/cli/kits/general/duplication/manifest.toml:56`                                                                                                                 | `limits.duplication.threshold_percent`                                         | `limits.duplication.percent`                            | "threshold" repeats `limits`                                              |
| `packages/cli/kits/general/licenses/manifest.toml:53`                                                                                                                    | `tools.licenses.licenses_allowed`                                              | `tools.licenses.allowed`                                | the kit word twice                                                        |
| `packages/cli/kits/general/licenses/manifest.toml:61`                                                                                                                    | `tools.licenses.packages_allowed`                                              | `tools.licenses.exceptions`                             | the code calls them exceptions                                            |
| `packages/cli/kits/general/static-site/manifest.toml:216`                                                                                                                | `tools.site.*`                                                                 | `tools.static-site.*`, or rename the kit `site`         | the kit and its settings use two names                                    |
| `packages/cli/kits/general/static-site/manifest.toml:230`                                                                                                                | `tools.site.size_limits`                                                       | `tools.site.sizes`                                      | collides with `limits`                                                    |
| `packages/cli/kits/general/static-site/manifest.toml:237`                                                                                                                | `tools.site.sitemap_allowed`                                                   | `tools.site.sitemap_exclude`                            | the pages are left out on purpose                                         |
| `packages/cli/kits/language/html/manifest.toml:84`                                                                                                                       | `tools.html.template_files`                                                    | `tools.html.templates`                                  | "files" adds nothing                                                      |
| `packages/cli/kits/language/html/manifest.toml:91`                                                                                                                       | `tools.html.copy_allowed`                                                      | `tools.html.literals_allowed`                           | the findings say literal                                                  |
| `packages/cli/kits/tool/openapi/manifest.toml:66`                                                                                                                        | `tools.openapi.produced_by`                                                    | `tools.openapi.generate`                                | its sibling `tools.site.build` names the command by verb                  |
| `packages/cli/kits/framework/nextjs/manifest.toml:106`                                                                                                                   | `tools.next.build_in_gate`                                                     | `tools.next.build_on_push`                              | "gate" is a second name for the push stage                                |
| `packages/cli/kits/library/i18n/manifest.toml:38`                                                                                                                        | `tools.i18n.translations`                                                      | `tools.i18n.locales`                                    | the check is `i18n/locales`                                               |
| `packages/cli/kits/database/postgres/manifest.toml:176`                                                                                                                  | `tools.postgres.migration_docs`                                                | `tools.postgres.docs`                                   | "migration" is implied                                                    |
| `packages/cli/kits/language/swift/manifest.toml:279`                                                                                                                     | `tools.xcode.project`, `scheme`, `destination` in the swift kit                | declare them in the xcode kit                           | the swift kit writes into the xcode namespace                             |
| cross-kit                                                                                                                                                                | `exclude`, `ignore`, and `*_allowed` for skip lists                            | the rule in A.1                                         | three verbs for one idea                                                  |
| `packages/cli/kits/framework/express/manifest.toml:41`, `packages/cli/kits/language/javascript/manifest.toml:287`, `packages/cli/kits/language/python/manifest.toml:498` | three `test_files` settings                                                    | one shared test glob                                    | three settings for one idea                                               |

### A.4 Kit manifest fields

| Where                                       | Now                                                                                      | Proposed                                                    | Why                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/cli/src/kits/schema.ts:236`       | `[kit] name`, `[kit] kind`                                                               | derive both from the folder, or rename `kind` to `category` | they repeat the path                                            |
| `packages/cli/src/kits/schema.ts:188`       | setting `kind` (number, string, and so on)                                               | `type`                                                      | `kind` means three things: kit, tool, and setting               |
| `packages/cli/src/kits/tools.ts:46`         | `provider = "host"`                                                                      | `host = true`                                               | an enum with one value                                          |
| `packages/cli/src/kits/tools.ts:51`         | `version_regex`                                                                          | `version_pattern`                                           | the siblings end in `_pattern`                                  |
| `packages/cli/src/kits/tools.ts:14`         | npm installer `version_exit_code`                                                        | the tool-level field only                                   | a duplicate                                                     |
| `packages/cli/src/kits/tools.ts:55`         | `rule_page`                                                                              | `rule_url`                                                  | the value is a URL template                                     |
| `packages/cli/src/kits/schema.ts:79`        | check `name = "kit/check"`                                                               | `name = "check"`; the ID becomes `<kit>/<name>`             | the prefix let engine names creep into IDs                      |
| `packages/cli/src/kits/schema.ts:82`        | `runs = per-file-list \| per-scope \| once`                                              | `files \| scope \| once`                                    | "per-" and "-list" add nothing                                  |
| `packages/cli/src/kits/schema.ts:62`        | `per_scope = true`                                                                       | `scoped = true`                                             | `runs` spells the same idea `per-scope`                         |
| `packages/cli/src/kits/schema.ts:93`        | `engine`                                                                                 | delete                                                      | the registry is keyed by check ID                               |
| `packages/cli/src/kits/schema.ts:97`        | check `needs`, config `needs`, `waits_for`, `rules_off.when`, `guides.when`, `needs_git` | one `when = { kit, setting, dependencies, git }`            | six ways to say "only if"; `needs_git = false` hides a negation |
| `packages/cli/src/kits/schema.ts:103`       | `requires` (a capability) and `requires_tools`                                           | `needs = ["build"]`; `tool` accepts a list                  | `[kit] requires` means kits                                     |
| `packages/cli/src/kits/schema.ts:9`         | `owners`, `from_languages`, `from_prettier_plugins`                                      | `files`, `languages`, `prettier_plugins`                    | it lists covered files; "from" adds nothing                     |
| `packages/cli/src/kits/schema.ts:116`       | `exclude_setting`                                                                        | delete; derive `tools.<tool>.exclude`                       | possible once `exclude` means paths everywhere                  |
| `packages/cli/src/kits/schema.ts:56`        | `template`                                                                               | optional when the template is the target name plus `.tmpl`  | the four exceptions get renamed (B.3)                           |
| `packages/cli/src/kits/schema.ts:65`        | `code_files`                                                                             | `components`                                                | the values are `*.vue` and `*.svelte`                           |
| `packages/cli/src/kits/schema.ts:258`       | `[[tools]]`, `[[configs]]`, `[[checks]]`, `[[settings]]`                                 | singular                                                    | `gspot.toml` uses `[[check]]`                                   |
| `packages/cli/src/kits/schema.ts:268`       | `entry_files`                                                                            | `entry`                                                     | knip's word                                                     |
| `packages/cli/src/kits/schema.ts:270`       | `guides`                                                                                 | `rules`                                                     | decided                                                         |
| `packages/cli/src/kits/schema.ts:234`       | `untracked`                                                                              | `ignored`                                                   | the lines of the gitignore block                                |
| `packages/cli/src/kits/schema.ts:242`       | `kit.default` (chosen without detection)                                                 | `auto`                                                      | a setting `default` is a value                                  |
| `packages/cli/src/kits/schema.ts:86`        | `cached`                                                                                 | delete                                                      | the result cache goes                                           |
| `packages/cli/src/kits/output-format.ts:8`  | `eslint-json`, `typos-json`, `markdownlint-json`                                         | `eslint`, `typos`, `markdownlint`                           | "-json" repeats the format                                      |
| `packages/cli/src/kits/output-format.ts:20` | `file_is`                                                                                | `file_type`                                                 | reads oddly                                                     |

### A.5 Kits and check IDs

| Where                                                                                        | Now                                                 | Proposed                                            | Why                                                                |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/cli/kits/general/formatting/manifest.toml:2`                                       | kit `formatting` with a `[format]` table            | `format` for both                                   | two words for one concept                                          |
| `packages/cli/kits/general/files/manifest.toml:2`                                            | `files` holds actionlint, zizmor, and pinact        | a new `actions` kit                                 | they check workflows; the rules already have a GitHub Actions page |
| `packages/cli/kits/general/structure/manifest.toml:111`                                      | `integrity/generated-drift`                         | `gspot/drift`                                       | a built-in check; `integrity` is an engine; "generated" repeats    |
| `packages/cli/src/config/execution/execution.ts:65`                                          | `integrity/policy`                                  | `gspot/policy`                                      | the same                                                           |
| `packages/cli/kits/language/typescript/manifest.toml:66` and the vue, svelte, and astro kits | four `*/eslint` checks                              | one `javascript/eslint`                             | one ESLint process instead of five                                 |
| `packages/cli/kits/language/javascript/manifest.toml:227`                                    | `javascript/checkjs`                                | `javascript/tsc`                                    | named by tool                                                      |
| `packages/cli/kits/framework/vue/manifest.toml:74`                                           | `vue/typecheck`                                     | `vue/tsc`                                           | named by tool                                                      |
| `packages/cli/kits/framework/nextjs/manifest.toml:33`                                        | `nextjs/typecheck`                                  | `nextjs/tsc`                                        | named by tool                                                      |
| `packages/cli/kits/framework/nextjs/manifest.toml:64`                                        | `integrity/route-segments`                          | `nextjs/route-segments`                             | engine prefix                                                      |
| `packages/cli/kits/framework/nextjs/manifest.toml:78`                                        | `integrity/next-config`                             | `nextjs/config`                                     | engine prefix                                                      |
| `packages/cli/kits/framework/nextjs/manifest.toml:92`                                        | `integrity/dependency-alignment`                    | `nextjs/version-pairs`                              | engine prefix; the finding is `version-pair`                       |
| `packages/cli/kits/language/html/manifest.toml:45`                                           | `html/html-validate`                                | `html/validate`                                     | the kit word twice                                                 |
| `packages/cli/kits/language/html/manifest.toml:71`                                           | `html/text`                                         | `html/literals`                                     | the findings say literal                                           |
| `packages/cli/kits/language/css/manifest.toml:89`                                            | `integrity/css-usage`                               | `css/module-classes`                                | engine prefix                                                      |
| `packages/cli/kits/language/javascript/manifest.toml:349`                                    | `integrity/required-rules`                          | `javascript/rules-off`                              | engine prefix; the finding is `rule-off`                           |
| `packages/cli/kits/language/typescript/manifest.toml:85`                                     | `integrity/tsconfig-options`                        | `typescript/tsconfig`                               | engine prefix                                                      |
| `packages/cli/kits/general/files/manifest.toml:124`                                          | `files/toml`, `files/toml-format`                   | `files/taplo`, `files/taplo-format`                 | named by tool                                                      |
| `packages/cli/kits/general/files/manifest.toml:156`                                          | `files/yaml`                                        | `files/yamllint`                                    | named by tool                                                      |
| `packages/cli/kits/general/files/manifest.toml:171`                                          | `files/schema`                                      | `files/v8r`                                         | named by tool                                                      |
| `packages/cli/kits/general/files/manifest.toml:188`                                          | `files/actions`                                     | `actions/actionlint`                                | named by tool, in the actions kit                                  |
| `packages/cli/kits/general/files/manifest.toml:205`                                          | `files/actions-pins`                                | `actions/pinact`                                    | the same                                                           |
| `packages/cli/kits/general/files/manifest.toml:221`                                          | `files/actions-security`                            | `actions/zizmor`                                    | the same                                                           |
| `packages/cli/kits/general/files/manifest.toml:237`                                          | `files/dotenv`                                      | `files/dotenv-linter`                               | named by tool                                                      |
| `packages/cli/kits/general/files/manifest.toml:268`                                          | `files/plist`                                       | `files/plutil`                                      | named by tool; `xcode/plist` repeats it and goes                   |
| `packages/cli/kits/general/files/manifest.toml:284`                                          | `files/xml`                                         | `files/xmllint`                                     | named by tool                                                      |
| `packages/cli/kits/general/formatting/manifest.toml:114`                                     | `formatting/prettier`                               | `format/prettier`                                   | follows the kit                                                    |
| `packages/cli/kits/general/docs/manifest.toml:31`                                            | `docs/links`, `docs/links-external`                 | `lychee`, `lychee-external`, in docs                | named by tool                                                      |
| `packages/cli/kits/general/docs/manifest.toml:62`                                            | `integrity/docs-headings`                           | `headings`, in docs                                 | engine prefix                                                      |
| `packages/cli/kits/general/docs/manifest.toml:75`                                            | `integrity/stale-paths`                             | `stale-paths`, in docs                              | engine prefix                                                      |
| `packages/cli/kits/general/dependencies/manifest.toml:96`                                    | `integrity/manifest-policy`                         | `dependencies/manifests`                            | engine prefix; "policy" names nothing                              |
| `packages/cli/kits/general/dependencies/manifest.toml:111`                                   | `integrity/lockfile-fresh`                          | `dependencies/lockfile-fresh`                       | engine prefix                                                      |
| `packages/cli/kits/general/dependencies/manifest.toml:125`                                   | `integrity/install-policy`                          | `dependencies/install`                              | engine prefix                                                      |
| `packages/cli/kits/general/dependencies/manifest.toml:140`                                   | `integrity/lockfile-hosts`                          | `dependencies/lockfile-hosts`                       | engine prefix                                                      |
| `packages/cli/kits/general/commits/manifest.toml:70`                                         | `commits/range`                                     | `commits/commitlint-range`                          | a second commitlint check: tool plus mode                          |
| `packages/cli/kits/general/naming/manifest.toml:39`                                          | `naming/policy-schema`                              | `naming/policy`                                     | not schema validation                                              |
| `packages/cli/kits/general/prose/manifest.toml:62`                                           | `prose/banned`                                      | `prose/hidden`                                      | it finds prose that Vale cannot see                                |
| `packages/cli/kits/general/secrets/manifest.toml:57`                                         | `secrets/gitleaks` (history)                        | `secrets/gitleaks-history`                          | its siblings carry a mode word                                     |
| `packages/cli/kits/general/secrets/manifest.toml:105`                                        | `integrity/env-files`                               | `secrets/env-files`                                 | engine prefix                                                      |
| `packages/cli/kits/general/secrets/manifest.toml:119`                                        | `integrity/gitleaks-baseline`                       | `secrets/gitleaks-baseline`                         | engine prefix                                                      |
| `packages/cli/kits/general/static-site/manifest.toml:65`                                     | `static-site/html-validate-built`                   | `static-site/html-validate`                         | "built" is implied in this kit                                     |
| `packages/cli/kits/general/static-site/manifest.toml:80`                                     | `css/dead-selectors`                                | `static-site/purgecss`                              | the wrong kit prefix; named by tool                                |
| `packages/cli/kits/general/static-site/manifest.toml:95`                                     | `static-site/links-internal`, `links-external`      | `static-site/linkinator`, `linkinator-external`     | named by tool                                                      |
| `packages/cli/kits/general/static-site/manifest.toml:171`                                    | `static-site/svg-optimized`                         | `static-site/svgo`                                  | three names today                                                  |
| `packages/cli/kits/general/static-site/manifest.toml:202`                                    | `integrity/security-headers`                        | `static-site/security-headers`                      | engine prefix                                                      |
| `packages/cli/kits/general/structure/manifest.toml:23`                                       | `structure/single-file-folder`                      | `structure/lone-files`                              | the finding is `lone-file`                                         |
| `packages/cli/kits/general/structure/manifest.toml:54`                                       | `structure/file-directory-collision`                | `structure/stem-collisions`                         | the finding is `stem-collision`                                    |
| `packages/cli/kits/general/structure/manifest.toml:83`                                       | `integrity/files`                                   | `structure/config-logic`                            | "files" says nothing                                               |
| `packages/cli/kits/general/structure/manifest.toml:97`                                       | `integrity/suppressions`                            | `structure/suppressions`                            | engine prefix                                                      |
| `packages/cli/kits/general/structure/manifest.toml:125`                                      | `integrity/allowlists-match`                        | `structure/stale-allowlists`                        | named by what it finds                                             |
| `packages/cli/kits/general/structure/manifest.toml:139`                                      | `integrity/large-files`                             | `structure/large-files`                             | engine prefix                                                      |
| `packages/cli/kits/general/structure/manifest.toml:153`                                      | `integrity/tracked-dependencies`                    | `structure/tracked-dependencies`                    | engine prefix                                                      |
| `packages/cli/kits/language/bash/manifest.toml:85`                                           | `bash/zsh-syntax`, `bash/bats-syntax`               | `bash/zsh`, `bash/bats`                             | syntax is the only mode                                            |
| `packages/cli/kits/language/bash/manifest.toml:150`                                          | `structure/bash-interpreter`                        | `bash/contract`                                     | engine prefix; it checks the header, strict mode, and `main`       |
| `packages/cli/kits/language/bash/manifest.toml:164`                                          | `structure/doc-comment`                             | `bash/doc-comments`                                 | engine prefix                                                      |
| `packages/cli/kits/language/bash/manifest.toml:178`                                          | `structure/duplicate-functions`                     | `bash/duplicate-functions`                          | engine prefix                                                      |
| `packages/cli/kits/language/bash/manifest.toml:193`                                          | `structure/unused-functions`                        | `bash/unused-functions`                             | engine prefix                                                      |
| `packages/cli/kits/language/bash/manifest.toml:207`                                          | `structure/dead-parameters`                         | `bash/unread-arguments`                             | engine prefix; the finding says arguments                          |
| `packages/cli/kits/language/bash/manifest.toml:221`                                          | `structure/source-comments`, `source-order`         | `bash/source-comments`, `bash/source-order`         | engine prefix                                                      |
| `packages/cli/kits/language/bash/manifest.toml:249`                                          | `structure/private-prefix`, `private-before-public` | `bash/private-prefix`, `bash/private-before-public` | engine prefix                                                      |
| `packages/cli/kits/language/bash/manifest.toml:277`                                          | `structure/trivial-function`                        | `bash/trivial-functions`                            | engine prefix; plural like the ESLint rule                         |
| `packages/cli/kits/language/bash/manifest.toml:293`                                          | `structure/bash-limits`                             | `bash/limits`                                       | engine prefix; "bash" twice                                        |
| `packages/cli/kits/language/bash/manifest.toml:307`                                          | `structure/bash-script-policy`                      | `bash/wrappers`                                     | it finds wrappers and aliases                                      |
| `packages/cli/kits/language/bash/manifest.toml:321`                                          | `structure/inline`                                  | `bash/embeds`                                       | the finding is `runtime-embed`                                     |
| `packages/cli/kits/language/bash/manifest.toml:335`                                          | `structure/remote`                                  | `bash/ssh-blocks`                                   | it finds SSH blocks                                                |
| `packages/cli/kits/language/bash/manifest.toml:349`                                          | `structure/bash-config-defaults`                    | `bash/defaults`                                     | engine prefix                                                      |
| `packages/cli/kits/language/bash/manifest.toml:363`                                          | `structure/guards`                                  | `bash/guards`                                       | engine prefix                                                      |
| `packages/cli/kits/language/bash/manifest.toml:377`                                          | `structure/bash-boundaries`                         | `bash/boundaries`                                   | engine prefix                                                      |
| `packages/cli/kits/language/bash/manifest.toml:391`                                          | `structure/env-access-owner`                        | `bash/env-owner`                                    | engine prefix; "access" adds nothing                               |
| `packages/cli/kits/language/bash/manifest.toml:405`                                          | `structure/bash-safety`                             | `bash/safety`                                       | engine prefix                                                      |
| `packages/cli/kits/language/python/manifest.toml:238`                                        | `integrity/dependency-ownership`                    | `python/pip-installs`                               | engine prefix; it finds requirements files and `pip install`       |
| `packages/cli/kits/language/python/manifest.toml:253`                                        | `integrity/typecheck-membership`                    | `python/stale-exclusions`                           | engine prefix; the finding is `stale-exclusion`                    |
| `packages/cli/kits/language/python/manifest.toml:267`                                        | `python/file-length`, `python/function-length`      | `python/file-lines`, `python/function-lines`        | the limits say lines                                               |
| `packages/cli/kits/language/python/manifest.toml:297`                                        | `python/trivial-function`, `placeholder-docstring`  | plural                                              | the siblings are plural                                            |
| `packages/cli/kits/language/python/manifest.toml:373`                                        | `python/no-lazy-exports`, `python/no-singletons`    | `python/lazy-exports`, `python/singletons`          | named by what it finds                                             |
| `packages/cli/kits/language/sql/manifest.toml:94`                                            | `sql/file-length`                                   | `sql/file-lines`                                    | the limit is `file_lines`                                          |
| `packages/cli/kits/language/swift/manifest.toml:182`                                         | `swift/trivial-function`                            | `swift/trivial-functions`                           | plural                                                             |
| `packages/cli/kits/language/swift/manifest.toml:242`                                         | `swift/env-access-owner`                            | `swift/env-owner`                                   | "access" adds nothing                                              |
| `packages/cli/kits/database/postgres/manifest.toml:77`                                       | `postgres/rls-present`                              | `postgres/rls`                                      | "present" is implied                                               |
| `packages/cli/kits/database/postgres/manifest.toml:91`                                       | `postgres/explicit-grants`                          | `postgres/grants`                                   | "explicit" is implied                                              |
| `packages/cli/kits/database/postgres/manifest.toml:105`                                      | `postgres/security-definer-search-path`             | `postgres/definer-search-path`                      | four words                                                         |
| `packages/cli/kits/database/postgres/manifest.toml:119`                                      | `postgres/index-covers-foreign-key`                 | `postgres/foreign-key-indexes`                      | four words; the finding is `foreign-key-index`                     |
| `packages/cli/kits/framework/express/manifest.toml:20`                                       | `express/routes-tested`                             | `express/untested-routes`                           | named by what it finds                                             |
| `packages/cli/kits/library/drizzle/manifest.toml:35`                                         | `drizzle/relations-complete`                        | `drizzle/relations`                                 | "complete" is implied                                              |
| `packages/cli/kits/library/trpc/manifest.toml:22`                                            | `trpc/router-boundaries`                            | `trpc/boundaries`                                   | "router" is implied                                                |
| `packages/cli/kits/platform/cloudflare/manifest.toml:30`                                     | `cloudflare/wrangler-config`                        | `cloudflare/wrangler`                               | "config" is filler                                                 |
| `packages/cli/kits/platform/cloudflare/manifest.toml:44`                                     | `cloudflare/headers-syntax`, `redirects-syntax`     | `cloudflare/headers`, `cloudflare/redirects`        | "syntax" is implied                                                |
| `packages/cli/kits/platform/cloudflare/manifest.toml:72`                                     | `cloudflare/env-types-fresh`                        | `cloudflare/types-fresh`                            | the sibling of `supabase/types-fresh`                              |
| `packages/cli/kits/platform/supabase/manifest.toml:85`                                       | `supabase/admin-key-containment`                    | `supabase/admin-key`                                | "containment" is filler                                            |
| `packages/cli/kits/tool/docker/manifest.toml:84`                                             | `docker/compose-config`                             | `docker/compose`                                    | "config" is only the subcommand                                    |
| `packages/cli/kits/tool/nginx/manifest.toml:50`                                              | `nginx/config-test`                                 | `nginx/test`                                        | "config" is filler                                                 |
| `packages/cli/kits/tool/openapi/manifest.toml:29`                                            | `openapi/lint`                                      | `openapi/spectral`                                  | named by tool                                                      |
| `packages/cli/kits/tool/xcode/manifest.toml:69`                                              | `xcode/asset-catalogs`                              | `xcode/assets`                                      | "catalogs" is implied                                              |
| `packages/cli/kits/tool/xcode/manifest.toml:84`                                              | `xcode/test-plan`                                   | `xcode/test-plans`                                  | the analysis is plural                                             |
| `packages/cli/kits/tool/xcode/manifest.toml:127`                                             | `xcode/entitlements-policy`                         | `xcode/entitlements`                                | "policy" is filler                                                 |
| `packages/cli/kits/tool/xctest/manifest.toml:40`                                             | `xctest/no-sleep`                                   | `xctest/sleep`                                      | named by what it finds                                             |
| `packages/cli/kits/tool/xctest/manifest.toml:70`                                             | `xctest/reference-images`                           | `xctest/references`                                 | three names today                                                  |
| `packages/cli/kits/language/typescript/manifest.toml:51` and others                          | check titles mix tool names and verb phrases        | one style                                           | the kit pages show them                                            |

The `analysis` field of 96 checks is a second name for the check ID, such as `postgres-rls` for `postgres/rls-present`,
`site-svg` for `static-site/svg-optimized`, and `python-blocking-calls` for a fastapi check. With a registry keyed by
check ID, the field goes, except for the three checks that share `tsc.ts`.

### A.6 Finding rule IDs that checks emit

| Where                                                                                                  | Now                                                                    | Proposed                           | Why                                               |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------- |
| `packages/cli/src/checks/bash/visibility.ts:65`, `packages/cli/src/checks/swift/order.ts:28`           | `private-below-public`, `private-below-shared`                         | `private-before-public`            | three names for one finding; python uses this one |
| `packages/cli/src/checks/python/analyses.ts:108`                                                       | `no-lazy-exports`                                                      | `lazy-export`                      | name the thing found                              |
| `packages/cli/src/checks/python/imports.ts:135`                                                        | `no-singletons`                                                        | `singleton`                        | the same                                          |
| `packages/cli/src/checks/nginx/config-test.ts:52`                                                      | `nginx-t`                                                              | `syntax`                           | a command, not a finding                          |
| `packages/cli/src/checks/react-native.ts:45`                                                           | `expo-doctor`                                                          | `failed-check`                     | repeats the check ID                              |
| `packages/cli/src/checks/cloudflare.ts:125`                                                            | `headers-syntax`, `redirects-syntax`                                   | `syntax`                           | repeats the check ID                              |
| `packages/cli/src/checks/supabase/deno.ts:62`                                                          | `deno-check`                                                           | `type-error`                       | repeats the check ID                              |
| six checks, such as `packages/cli/src/checks/cloudflare.ts:152`                                        | `parse` beside `syntax`                                                | `syntax`                           | two names                                         |
| six checks, such as `packages/cli/src/checks/openapi/openapi.ts:79`                                    | `stale`, `stale-types`, `types`, `stale-lockfile`, `missing-migration` | `stale`                            | five names for "a generated file is out of date"  |
| `packages/cli/src/checks/bash/doc-comment.ts:47`, `packages/cli/src/checks/docker/ignore-file.ts:23`   | `missing`, `entries`                                                   | `missing-comment`, `missing-entry` | bare or vague                                     |
| `packages/cli/src/checks/repository/large-files.ts:31`                                                 | `over-limit`                                                           | `size`                             | the static-site sibling says `size`               |
| `packages/cli/src/checks/security/env/files.ts:19`                                                     | `tracked-environment-file`                                             | `tracked-env`                      | three words                                       |
| `packages/cli/src/checks/repository/files.ts:80`                                                       | `logic-in-config`                                                      | `config-logic`                     |                                                   |
| `packages/cli/src/checks/bash/visibility.ts:29`                                                        | `private-called-outside`                                               | `called-outside`                   | three words                                       |
| `packages/cli/src/checks/bash/remote.ts:71`                                                            | `undocumented-heredoc`                                                 | `undocumented-block`               | its sibling says `unnamed-block`                  |
| `packages/cli/src/checks/bash/visibility.ts:38`                                                        | `file-local`                                                           | `unprefixed`                       | vague                                             |
| `packages/cli/src/checks/cloudflare.ts:156`, `packages/cli/src/checks/static-site/source-checks.ts:93` | `name`                                                                 | `missing-name`                     | vague                                             |
| `packages/cli/src/checks/naming/engine.ts:144`                                                         | `configuration`                                                        | `stale-entry`                      | filler                                            |
| `packages/cli/src/checks/licenses.ts:164`                                                              | `license`                                                              | `disallowed-license`               | vague                                             |
| `packages/cli/src/checks/dependencies/lockfile/hosts.ts:24`                                            | `registry`                                                             | `host`                             | the check is about hosts                          |
| `packages/cli/src/checks/nextjs/source.ts:54`                                                          | `build-check-off`, `secret-in-env`                                     | `checks-off`, `env-secret`         |                                                   |
| `packages/cli/src/checks/xcode/project/checks.ts:53`                                                   | `no-target`                                                            | `untargeted`                       |                                                   |
| `packages/cli/src/checks/security/gitleaks-baseline.ts:31`                                             | `no-reason`                                                            | `missing-reason`                   |                                                   |
| `packages/cli/src/checks/docs/copied-blocks.ts:59`                                                     | `copied-block`                                                         | `clone`                            | the jscpd word                                    |
| `packages/cli/src/checks/static-site/source-checks.ts:21`                                              | `svg`                                                                  | `unoptimized`                      | says nothing                                      |
| `packages/cli/src/checks/docker/image-scan.ts:111`                                                     | `image`                                                                | `vulnerability`                    | says nothing                                      |

### A.7 Templates, generated files, and other names users see

| Where                                                             | Now                                                                   | Proposed                               | Why                                                                     |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| `packages/cli/src/policy/schema.ts:191`                           | `.gspot/guides`                                                       | a `rules` folder in `.gspot`           | decided                                                                 |
| `packages/cli/kits/language/typescript/manifest.toml:46`          | `tsconfig.check.json`                                                 | `tsconfig.json` inside `.gspot/config` | its sibling `jsconfig.json` has no `.check`                             |
| `packages/cli/kits/tool/docker/manifest.toml:49`                  | `hadolint.yaml`, `trivy.yaml`                                         | `.yml`                                 | every other file uses `.yml`                                            |
| `packages/cli/src/config/generation.ts:38`                        | "Written by gspot. Run `gspot uninstall`" beside "Generated by gspot" | one header                             | `uninstall` goes                                                        |
| four files, such as `packages/cli/src/tools/python-project.ts:31` | `'gspot-tools'` written four times                                    | one constant                           | the name stays unscoped: PyPI has no scopes                             |
| `packages/cli/src/execution/execute.ts:123`                       | `GSPOT_JOBS`, undocumented                                            | document it                            | users can set it                                                        |
| `.github/workflows/site.yml:63`                                   | `GSPOT_PAGES_ENABLED`                                                 | `PAGES_ENABLED`                        | the prefix adds nothing inside this repository                          |
| `packages/cli/kits/general/prose/styles/gspot/corruption.yml`     | `corruption`                                                          | delete (section 5.5)                   | it serves this repository                                               |
| `packages/cli/kits/general/prose/styles/gspot/heading-names.yml`  | `heading-names`                                                       | `banned-headings`                      | the setting is `tools.docs.banned_headings`                             |
| `packages/cli/kits/general/prose/styles/gspot/headings.yml`       | `headings`                                                            | `heading-case`                         | it only checks sentence case                                            |
| `packages/cli/kits/general/prose/styles/gspot/title.yml`          | `title`                                                               | `title-case`                           | the sibling of `heading-case`                                           |
| `packages/cli/kits/general/prose/styles/gspot/present-state.yml`  | `present-state`                                                       | `history`                              | it finds history in prose                                               |
| `packages/cli/kits/general/prose/styles/gspot/step-length.yml`    | `step-length`                                                         | `item-length`                          | the limit is `limits.docs.list_item_words`                              |
| `packages/cli/kits/language/bash/rules/mutable-assignments.yml`   | `mutable-assignments`                                                 | `assignments`                          | matches the limit                                                       |
| `packages/cli/kits/general/naming/policy.json:8`                  | `banDuplicateWords`                                                   | `banRepeats`                           | one idea under four names today                                         |
| `packages/cli/kits/general/naming/policy.json:135`                | `groups.terminology`, `groups.test`                                   | `groups.jargon`, `groups.tests`        | vague; the siblings are plural                                          |
| `packages/cli/kits/general/naming/policy.json:157`                | `reserved[].allowedFor`                                               | `uses`                                 | the code calls them uses                                                |
| `packages/cli/kits/general/naming/policy.json:304`                | `maxChars`, `maxWords`, `structuralPrefix`, `allowDigits`             | snake case                             | each key has a camel case spelling in JSON and a snake case one in TOML |

### A.8 Exit codes and `--json` fields

| Where                                                                                               | Now                                                                                                                             | Proposed                                             | Why                                                    |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| `packages/cli/src/config/commands/commands.ts:15` and five more                                     | exit code 2 as `ERROR_EXIT`, `CANCELED_EXIT`, `INVALID_INPUT_EXIT`, `INCOMPLETE_INSTALL_EXIT`, `UNREADABLE_EXIT`, `UNABLE_EXIT` | `EXIT_ERROR`                                         | one value, six names                                   |
| `packages/cli/src/execution/run-report.ts:83`, `packages/cli/src/config/checks/platforms.ts:4`      | exit code 1 as a bare literal, while `FINDINGS_EXIT = 10` is the Trivy code                                                     | `EXIT_FINDINGS = 1`; `TRIVY_EXIT` for the other      | the public code has no name                            |
| `packages/cli/src/config/kits.ts:5`                                                                 | `MAX_EXIT_CODE` and `LAST_EXIT_CODE`, both 255                                                                                  | one constant                                         | a duplicate                                            |
| `packages/cli/src/types/commands.ts:33`                                                             | `isDryRun`                                                                                                                      | `dryRun`                                             | the code prefix leaks into the output                  |
| `packages/cli/src/checks/result.ts:20`, `packages/cli/src/output/reporter.ts:40`                    | statuses `ok\|fail\|cache\|skipped` in JSON, `ok\|unchanged\|fail\|skip` in text, and passed, failed, skipped in the summary    | `passed`, `failed`, `skipped`, `missing`, `error`    | three sets of words for one set of states              |
| `packages/cli/src/checks/result.ts:21`                                                              | `files` (a count) and `checkedFiles` (a list)                                                                                   | `fileCount` and `files`                              | a plural noun that holds a number                      |
| `packages/cli/src/execution/report.ts:33`                                                           | `narrowed`, `unstaged` (a count), `failed`                                                                                      | `partial`, `unstagedChanges`, delete `failed`        | vague, unclear, and a duplicate of the check statuses  |
| `packages/cli/src/execution/report.ts:12`                                                           | `skips[].source` with the value `rules`                                                                                         | `cause` with the value `replaced`                    | "rules" means another check runs it                    |
| `packages/cli/src/types/lifecycle/lifecycle.ts:24`, `packages/cli/src/commands/apply/command.ts:64` | JSON `packages`, text `scripts`; labels `wrote`, `block`, `scripts`, `removed`, `note`                                          | one word each; `wrote`, `updated`, `removed`, `note` | the JSON and the text disagree; verbs mixed with nouns |
| `packages/cli/src/types/commands.ts:213`                                                            | init `install` holding a note                                                                                                   | `note`                                               | reads like a boolean                                   |
| `packages/cli/src/commands/init/command.ts:92`                                                      | `already-installed`, `unread-configuration`                                                                                     | `already-initialized`, `unreadable-config`           | "installed" belongs to `gspot install`                 |
| `packages/cli/src/types/platform.ts:6`                                                              | error codes mix nouns and phrases                                                                                               | one style                                            |                                                        |
| `packages/cli/src/commands/install.ts:105`                                                          | `error` holding the message                                                                                                     | `error` the code, `message` the text                 | the failure JSON already works this way                |
| `packages/cli/src/types/commands.ts:110`                                                            | `detectedNotSelected`, `recommendedNotSelected`, `configurationNotOwned`, `changedOutsideGspot`                                 | `detected`, `recommended`, `unowned`, `authored`     | negative compounds, and gspot inside gspot             |
| `packages/cli/src/types/repository/revisions.ts:13`                                                 | `notApplicable`                                                                                                                 | `skipped`                                            | the push report already says skipped                   |
| `packages/cli/src/commands/explain/file.ts:50`                                                      | `file` holding a kind; `fileSource`                                                                                             | `kind`; `kindSource`                                 | the tracked file calls it `kindSource`                 |
| `packages/cli/src/commands/list.ts:57`                                                              | `installed`                                                                                                                     | `selectedKits`                                       | these kits are selected, not installed                 |

### A.9 The repository: packages, tasks, and CI

| Where                                              | Now                                               | Proposed                               | Why                                               |
| -------------------------------------------------- | ------------------------------------------------- | -------------------------------------- | ------------------------------------------------- |
| `package.json:2`                                   | `gspot`                                           | `@gspothq/workspace`                   | npm refused the name; one scope for every package |
| `docs/package.json:2`                              | `gspot-docs`                                      | `@gspothq/docs`                        | one scope                                         |
| `tests/package.json:2`                             | `gspot-tests`                                     | `@gspothq/tests`                       | one scope; drop its unused docs dependency        |
| `bun.lock:6`                                       | `gspot-workspace`                                 | regenerate                             | stale                                             |
| `packages/cli/package.json:43`, `tsconfig.json:28` | `#package` and `#cli-package`                     | `#cli-package`, like `#plugin-package` | two aliases for one file                          |
| `mise.toml:63`                                     | `build`, `build:plugin`                           | `build:cli`, `build:plugin`            | siblings                                          |
| `mise.toml:54`                                     | `repo:setup`                                      | `setup`                                | every task is a repository task                   |
| `mise.toml:50`                                     | `repo:tools`                                      | `pin:test-tools`                       | named after what it writes                        |
| `mise.toml:59`                                     | `repo:install-checks`                             | `install`                              | the sibling of `apply`                            |
| `mise.toml:122`                                    | `docs:sync`, `docs:build`                         | `generate:docs`, `build:docs`          | the verb first; `sync` is a word gspot bans       |
| `mise.toml:151`                                    | `release:verify-version`                          | `check:release`                        | verify, validate, and check are one act           |
| `.github/workflows/ci.yml:125`                     | job `unit`, which runs unit and integration tests | `test`                                 | match the task                                    |
| `.github/workflows/ci.yml:165`                     | job `suite`                                       | `tools` and `acceptance`               | "suite" says nothing                              |
| `.github/workflows/ci.yml:171`                     | matrix key `system`                               | `platform`                             | gspot's word; it also names the timing files      |
| `.github/workflows/ci.yml:48`                      | step ID `normal`                                  | `check`                                | not a stage name                                  |
| `.github/workflows/ci.yml` throughout              | a few named steps among unnamed ones              | name all or none                       | mixed                                             |
| `.github/workflows/release.yml:11`                 | job `acceptance`, which calls all of CI           | `ci`                                   | misleading                                        |
| `.github/workflows/release.yml:34`                 | "Validate the release version"                    | "Check the release version"            | one verb                                          |
| `.github/workflows/site.yml:1`                     | workflow `site`                                   | `docs`                                 | everything else says docs                         |

### A.10 Identifiers in the commands, policy, repository, and lifecycle code

Each table lists one folder; the File column gives the file and line inside it. Names inside the byte backups (section
5.2) are left out, because they go.

**`packages/cli/src/commands`**

| File                 | Now                               | Proposed                    | Why                                                 |
| -------------------- | --------------------------------- | --------------------------- | --------------------------------------------------- |
| `set.ts:37`          | `parseValue`                      | `parseItem`                 | "Value" is filler; it parses one item               |
| `set.ts:45`          | `unknownSetting`                  | `buildSettingError`         | a noun for a function                               |
| `set.ts:47`, `:132`  | `entry`                           | `selection`                 | the same value is `selection` elsewhere in the file |
| `set.ts:51`          | `all`                             | `keys`                      | filler                                              |
| `set.ts:58`          | `shaped`                          | `unwrap`                    | an adjective for a function                         |
| `set.ts:58`, `:172`  | `parsed`                          | `values`                    | filler                                              |
| `set.ts:65`          | `declarationPaths`                | `isPathList`                | a type predicate named as a noun                    |
| `set.ts:74`          | `reasonsFilled`                   | `fillReasons`               | an adjective for a function                         |
| `set.ts:96`          | `setMutation`                     | `buildMutation`             | reads as "set the mutation"                         |
| `set.ts:99`          | `holder`                          | `table`                     | vague                                               |
| `set.ts:115`         | `shown`                           | `label`                     | the key as printed                                  |
| `set.ts:118`         | `current`                         | `previous`                  | the value before the change                         |
| `set.ts:124`         | `refuseRuleOff`                   | `assertRuleNotOff`          | the guide verb for stop-on-failure                  |
| `set.ts:131`         | `selectionFor`                    | `getSelection`              | a `For` suffix                                      |
| `set.ts:138`         | `setReasonCommand`                | `buildReasonHint`           | the same concept as `ignoreCommandLine`; share one  |
| `set.ts:147`         | `validateSetReason`               | `assertReason`              | it throws                                           |
| `set.ts:162`         | `writeValue`                      | `commitSetting`             | it commits                                          |
| `ignore.ts:16`       | `knownCheck`                      | `assertKnownCheck`          | it throws                                           |
| `ignore.ts:25`       | `ignoreCommandLine`               | `buildReasonHint`           | see `set.ts`                                        |
| `ignore.ts:31`       | `ignoreEntry`                     | `buildIgnore`               | a noun for a function                               |
| `ignore.ts:49`       | `removeIgnore`                    | `deleteIgnore`              | the guide keeps `remove` for memory                 |
| `ignore.ts:52`       | `result`                          | `committed`                 | filler                                              |
| `kits.ts:18`         | `installChangedSelection`         | `installSelection`          | "Changed" adds nothing                              |
| `kits.ts:45`, `:65`  | `holder`; `list`, `rootList`      | `table`; `kits`, `rootKits` | vague; named after the type                         |
| `kits.ts:94`, `:124` | `configurations`, `configuration` | `kits`, `kit`               | the old word for kit                                |
| `policy.ts:25`       | `describe`                        | `summary`                   | a string named as a verb                            |
| `policy.ts:59`       | `requireReason`                   | `assertReason`              | it throws                                           |
| `export.ts:23`       | `policy`                          | `policyFile`                | it holds the file                                   |
| `export.ts:24`       | `saved`                           | `profile`                   | nothing is saved yet                                |
| `export.ts:32`       | `existing`, `entry`               | `owned`, `file`             | filler                                              |
| `export.ts:35`       | `current`                         | `onDisk`                    | filler                                              |
| `list.ts:23`         | `extrasFor`                       | `getExtras`                 | a `For` suffix                                      |
| `list.ts:37`         | `settingsText`                    | `buildSettingsResult`       | it returns a command result                         |
| `list.ts:54`         | `kitsResult`                      | `buildKitsResult`           | a noun for a function                               |
| `list.ts:61`         | `spec`                            | `check`                     | filler                                              |
| `list.ts:69`         | `fields`                          | `packages`                  | they are package manifests                          |
| `list.ts:71`         | `plan`                            | `detection`                 | plan is a lifecycle word                            |
| `list.ts:84`         | `configuration`                   | `kit`                       | the old word                                        |
| `list.ts:105`        | `settingRows`                     | `buildSettingRows`          | a noun for a function                               |
| `list.ts:106`        | `fromScopes`                      | `scopeExtras`               | a `From` prefix                                     |
| `prompts.ts:74`      | `askMany`                         | `askChoices`                | pairs with `askChoice`                              |
| every command file   | `o` for options                   | `options`                   | a single letter in 13 functions                     |

**`packages/cli/src/commands/explain`**

| File                  | Now                               | Proposed                        | Why                                                |
| --------------------- | --------------------------------- | ------------------------------- | -------------------------------------------------- |
| `checks.ts:13`        | `TOOL_RULE_SOURCES`               | `RULE_SUMMARIZERS`              | it holds functions                                 |
| `checks.ts:15`, `:28` | `result`                          | `run`                           | filler                                             |
| `checks.ts:21`        | `parsed`                          | `rule`                          | filler                                             |
| `checks.ts:33`        | `pinNamed`                        | `getPin`                        | a suffix that works like `For`                     |
| `checks.ts:42`        | `rulePage`                        | `getRulePage`                   | a noun for a function                              |
| `checks.ts:57`        | `toolOf`                          | `getTool`                       | an `Of` suffix                                     |
| `checks.ts:62`        | `checkFacts`                      | `getFacts`                      | reads as "check the facts"                         |
| `checks.ts:75`        | `own`                             | `declared`                      | vague                                              |
| `checks.ts:91`        | `checkText`                       | `describeCheck`                 | "check" reads as a verb                            |
| `checks.ts:161`       | `toolSummary`                     | `getRuleSummary`                | it summarizes a tool rule                          |
| `checks.ts:162`       | `source`                          | `summarize`                     | it holds a function                                |
| `checks.ts:170`       | `ruleMeaning`                     | `describeRule`                  | a noun for a function                              |
| `checks.ts:181`       | `checkExplanation`                | `explainCheck`                  | the siblings say `explainX`                        |
| `checks.ts:198`       | `toolRuleExplanation`             | `explainToolRule`               | the same                                           |
| `checks.ts:205`       | `optionKey`                       | `key`                           |                                                    |
| `command.ts:10`       | `explainResult`                   | `explainCommand`                | the siblings say `xCommand`                        |
| `file.ts:19`          | `ignoreLine`                      | `formatIgnore`                  | reads as "ignore the line"                         |
| `file.ts:25`          | `annotated`                       | `annotate`                      | an adjective for a function that changes its input |
| `file.ts:41`          | `pathReport`                      | `buildReport`                   | report and explanation name one value              |
| `file.ts:77`          | `pathText`                        | `formatReport`                  | a noun for a function                              |
| `subjects.ts:16`      | `listLine`                        | `formatList`                    | reads as the verb "list"                           |
| `subjects.ts:20`      | `kitExplanation(kitName)`         | `explainKit(name)`              |                                                    |
| `subjects.ts:26`      | `row`                             | `kit`                           | it is not a row                                    |
| `subjects.ts:71`      | `current`                         | `effective`                     | the value in force, beside `shipped`               |
| `subjects.ts:86`      | `settingExplanation`              | `explainSetting`                |                                                    |
| `subjects.ts:128`     | `explainSlashed`, `explainDotted` | `explainToolRule`, `explainKey` | named after punctuation                            |
| `subjects.ts:154`     | `named`                           | `explanation`                   | vague                                              |

**`packages/cli/src/commands/doctor`, `init`, and `check`**

| File                           | Now                                 | Proposed                          | Why                                                   |
| ------------------------------ | ----------------------------------- | --------------------------------- | ----------------------------------------------------- |
| doctor `changes.ts:19`         | `recommendedNotSelected`            | `getRecommended`                  | a function named like a field, with a negative        |
| doctor `changes.ts:32`         | `configurationRow(config)`          | `buildConfigRow(file)`            | two spellings in one line                             |
| doctor `changes.ts:49`         | `configurationNotOwned`             | `getUnownedConfigs`               | a noun with a negative                                |
| doctor `changes.ts:63`         | `unownedGeneratedFiles`             | `getUnownedOutputs`               | three words                                           |
| doctor `changes.ts:79`         | `changeReport`                      | `getChanges`                      | the file is `changes.ts`                              |
| doctor `changes.ts:83`         | `rendered`                          | `outputs`                         | emit, render, and generate are one act                |
| doctor `changes.ts:87`         | `generated`                         | `workflows`                       | it holds only workflow paths                          |
| doctor `report.ts:115`, `:152` | `doctorReport`, `doctorText`        | `buildReport`, `formatReport`     | "doctor" repeats the folder                           |
| init `questions.ts:20`         | `existingCi`                        | `detectCi`                        | filler                                                |
| init `questions.ts:33`         | `ciDefault`                         | `proposeCi`                       | a noun for a function                                 |
| init `questions.ts:54`         | `askRuleFiles`                      | `askRules`                        | the flag is `--no-rules`                              |
| init `questions.ts:80`         | `how`                               | `reason`                          | it holds a kit reason                                 |
| init `questions.ts:85`         | `selection.selectedIds`             | `selection.ids`                   | "selected" repeats "selection"                        |
| init `questions.ts:98`         | `askInitQuestions`                  | `askQuestions`                    | "Init" repeats the folder                             |
| init `questions.ts:105`        | `isRules`                           | `hasRules`                        | a boolean named for a noun                            |
| init `settings.ts:6`           | `folderNames`                       | `getDirectories`                  | it holds paths                                        |
| init `settings.ts:21`, `:37`   | `detectedValue`, `detectedSettings` | `detectSetting`, `detectSettings` | adjectives for functions                              |
| init `settings.ts:37`          | `fields`, `fact`                    | `packages`, `package`             | three names for one value                             |
| init `xcode.ts:12`             | `schemeOf`                          | `getScheme`                       | an `Of` suffix                                        |
| init `xcode.ts:31`             | `xcodePlan`                         | `detectXcode`                     | plan means something else                             |
| init `replaced.ts:8`           | `readOwned`                         | `captureOwned`                    | its own comment says captures                         |
| init `replaced.ts:40`          | `replacedConfiguration`             | `getReplaced`                     |                                                       |
| check `push.ts:14`             | `hasConflictingOptions`             | `hasConflict`                     | "Options" is filler                                   |
| check `push.ts:37`             | `revisionRoot`                      | `checkout`                        | git's word for a written-out tree; snapshot is banned |
| check `push.ts:55`             | `pushReport`                        | `buildReport`                     | a noun for a function                                 |
| check `push.ts:79`             | `checkPushed`                       | `checkPush`                       | an adjective                                          |
| check `push.ts:82`             | `input.input`                       | `input.lines`                     | the word twice                                        |

**`packages/cli/src/policy`**

| File                            | Now                                | Proposed                                 | Why                                                         |
| ------------------------------- | ---------------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `write.ts:28`                   | `tableAt`                          | `getTable`                               | an `At` suffix; a different `tableAt` exists in the preview |
| `write.ts`, 10 sites            | `raw` for a parsed document        | `document`                               | its own comment says parsed document                        |
| `write.ts:50`                   | `mutate`                           | `mutation`                               | the same value is `mutation` in the command                 |
| `write.ts:89`                   | `appendIgnore`                     | `addIgnore`                              | the guide pairs add with remove                             |
| `write.ts:92`                   | `same`, `existing`                 | `match`, `ignore`                        | vague                                                       |
| `write.ts:117`                  | `removeEntries`                    | `removeMatching`                         |                                                             |
| `write.ts:179`                  | `appendList`, `entries`            | `addToList`, `items`                     | pairs with `removeFromList`                                 |
| `write.ts:207`                  | `key`                              | `identity`                               | shadows the dotted key                                      |
| `write.ts:219`                  | `scopeHolder`, `holder`            | `getScopeTable`, `table`                 | vague                                                       |
| `similar.ts:4`                  | `a`, `b`                           | `left`, `right`                          | single letters                                              |
| `similar.ts:29`                 | `similar`                          | `getSimilar`                             | an adjective for a function                                 |
| `similar.ts:31`                 | `limit`                            | `maxDistance`                            | vague                                                       |
| `json-schema.ts:6`, `:74`       | `childrenAt`, `knownKeysAt`        | `getChildren`, `getKnownKeys`            | `At` suffixes                                               |
| `json-schema.ts:7`              | `options`                          | `variants`                               | these are `anyOf` branches                                  |
| `json-schema.ts:28`             | `toolSettings`                     | `closeToolTables`                        | a noun for a function that changes its input                |
| `json-schema.ts:54`             | `policyJsonSchema`                 | `buildJsonSchema`                        | "policy" repeats the folder                                 |
| `source-locations.ts:13`, `:25` | `valueLocations`, `keyLocations`   | `walkValue`, `walkKey`                   | nouns for walkers                                           |
| `source-locations.ts:45`        | `sourceLocations`                  | `getPositions`                           | location and position are one concept                       |
| `source-locations.ts:78`, `:89` | `policyLocation`, `policyPosition` | `formatPosition`, `getPosition`          | "policy" repeats the folder                                 |
| `weaker.ts:28`                  | `isWeaker`                         | `isLoosening`                            | the domain word                                             |
| `written-keys.ts:41`            | `policy` (a parameter)             | `table`                                  | it holds a root or scope table                              |
| toml `nodes.ts:23`              | `kindOf`                           | `getKind`                                | three different `kindOf` functions exist                    |
| toml `nodes.ts:34`              | `isTomlValue`                      | `isValue`                                | "Toml" repeats the folder                                   |
| toml `tables.ts:5`              | `tableItems`                       | `getInlineTables`                        |                                                             |
| toml `tables.ts:12`             | `needsBlocks`                      | `isTooWide`                              | a predicate without is or has                               |
| toml `tables.ts:17`             | `range`, `comments`, `blocks`      | `getRange`, `getComments`, `buildBlocks` | nouns for functions                                         |
| toml `tables.ts:22`             | `fields`                           | `flatten`                                |                                                             |
| toml `width.ts:9`               | `keyAssignments`                   | `getPairs`                               | three names for a key and its value                         |
| toml `width.ts:17`              | `wrapped`                          | `wrapArray`                              |                                                             |
| toml `width.ts:57`              | `policyIndent(raw)`                | `getIndent(document)`                    |                                                             |
| profiles `export.ts:20`         | `withoutPaths`                     | `stripPaths`                             | no verb                                                     |
| profiles `export.ts:56`         | `exportedProfile`                  | `exportProfile`                          |                                                             |
| profiles `read.ts:14`           | `githubUrl`, `reference`           | `buildGithubUrl`, `source`               | `reference` sits beside `ref`, a git ref                    |
| profiles `read.ts:21`           | `fetched`                          | `download`                               | the naming guide bans fetch                                 |
| profiles `read.ts:42`           | `pathProblems`                     | `getPathProblems`                        | the same name as an export elsewhere                        |
| profiles `read.ts:75`           | `configurations`                   | `unknownKits`                            | the old word; it holds messages                             |
| profiles `read.ts:90`           | `readProfile`                      | `getProfile`                             | the guide verb                                              |

**`packages/cli/src/repository`**

| File                                        | Now                                                              | Proposed                                               | Why                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| revisions `contents.ts:26`                  | `gitOutput`                                                      | `gitText`                                              | a duplicate of `gitText`                                                 |
| revisions `contents.ts:41`, `:148`          | `objects` for bytes and for IDs                                  | `blobs` and `hashes`                                   | one name, two meanings in one file                                       |
| revisions `contents.ts:54`                  | `revisionRoot`                                                   | `checkout`                                             | git's word                                                               |
| revisions `contents.ts:78`                  | `blobFrame`                                                      | `parseFrame`                                           |                                                                          |
| revisions `contents.ts:78`                  | `gitHash`                                                        | `hash`                                                 | the field is already `hash`                                              |
| revisions `contents.ts:114`                 | `readEntries`                                                    | `getEntries`                                           |                                                                          |
| revisions `contents.ts:143`, `:183`, `:210` | `gitBlobs`, `gitEntries`, `committedEntries`                     | `getBlobs`, `getCachedEntries`, `getHeadEntries`       | nouns for functions                                                      |
| revisions `contents.ts:187`                 | `reads`                                                          | `cache`                                                |                                                                          |
| revisions `contents.ts:233`                 | `useRevision`                                                    | `checkOutRevision`                                     | "use" says nothing                                                       |
| revisions `contents.ts:239`                 | `printedRoot`, `gitRoot`                                         | `toplevel`                                             | git's own term; two names for one value                                  |
| revisions `contents.ts:241`                 | `directory`                                                      | `prefix`                                               | git's term                                                               |
| revisions `dependencies.ts:16`              | `MANIFESTS`                                                      | `INPUTS`                                               | it also holds lockfiles                                                  |
| revisions `dependencies.ts:21`, `:37`       | `checkCopiedLink`, `validateCopiedLinks`                         | `assertLink`, `assertLinks`                            | they throw                                                               |
| revisions `dependencies.ts:65`              | `assertSameValeConfiguration`                                    | `assertValeMatches`                                    | four words                                                               |
| revisions `dependencies.ts:85`              | `dependencyDirectories`                                          | `getDependencies`                                      |                                                                          |
| revisions `dependencies.ts:138`             | `copy` (a limiter)                                               | `limit`                                                | a limiter named as a verb                                                |
| revisions `dependencies.ts:164`, `:189`     | `copyDirectory`, `copyProsePackages`                             | `copyDependency`, `copyValePackages`                   | the file says Vale elsewhere                                             |
| revisions `push-selection.ts:18`            | `parsePushLine`                                                  | `parseLine`                                            | "Push" repeats the file                                                  |
| revisions `push-selection.ts:29`            | `commitOf`                                                       | `peelCommit`                                           | an `Of` suffix                                                           |
| revisions `push-selection.ts`, 6 sites      | `context`                                                        | `search`                                               | the type is `PushSearch`                                                 |
| revisions `push-selection.ts:40`, `:47`     | `shallowBoundaries`, `fetchedCommits`                            | `getShallowBoundaries`, `getFetchedCommits`            |                                                                          |
| revisions `push-selection.ts:57`, `:72`     | `comparison`, `revisionOf`                                       | `compare`, `buildRevision`                             |                                                                          |
| revisions `push-selection.ts:126`           | `pushedRevisions`                                                | `selectPush`                                           |                                                                          |
| revisions `refspecs.ts:12`, `:22`           | `capturedRef`, `splitMapping`                                    | `captureRef`, `parseRefspec`                           | mapping and refspec are one thing                                        |
| revisions `refspecs.ts`, 4 sites            | `raw`                                                            | `refspec`                                              | filler                                                                   |
| revisions `refspecs.ts:60`, `:87`           | `remoteRefRules`, `remoteRefEntries`                             | `getRules`, `getRefspecs`                              |                                                                          |
| revisions `refspecs.ts:110`                 | `fetchedRevisions`                                               | `getFetchedObjects`                                    | it returns objects                                                       |
| revisions `refspecs.ts:122`                 | `revisionId`                                                     | `object`                                               | one of five names for one git ID                                         |
| revisions `git-queries.ts:34`               | `gitValue`                                                       | `gitTrimmed`                                           |                                                                          |
| revisions `selection.ts:10`, `:24`, `:35`   | `remoteHeads`, `defaultReference`, `mergeBase`                   | `getRemoteHeads`, `getDefaultRef`, `getMergeBase`      | reference beside ref                                                     |
| revisions `selection.ts:52`, `:70`, `:90`   | `stagedFiles`, `changedFiles`, `pushBase`                        | `getStaged`, `getChanged`, `getPushBase`               |                                                                          |
| revisions `selection.ts:53`                 | `cached`                                                         | `paths`                                                | "cached" suggests the result cache                                       |
| `existing-tooling.ts:16`                    | `AGENT_FILE_NAMES`, `LINT_FOLDER_NAMES`, `RULES_DIRECTORY_NAMES` | `AGENT_FILES`, `LINT_DIRECTORIES`, `RULES_DIRECTORIES` | "NAMES" is filler; folder and directory in one import                    |
| `existing-tooling.ts:25`                    | `FOREIGN_HOOK_DIRECTORIES as HOOK_DIRECTORIES`                   | no alias                                               | the guide forbids renaming through an alias                              |
| `existing-tooling.ts:24`                    | `OTHER_CI_FILES`                                                 | `FOREIGN_CI_FILES`                                     |                                                                          |
| `existing-tooling.ts:32`                    | `runsLint`                                                       | `isLintCommand`                                        |                                                                          |
| `existing-tooling.ts:45`                    | `listDir(root, rel)`                                             | `getFiles(root, directory)`                            | contractions                                                             |
| `existing-tooling.ts:63`                    | `runnerFound`                                                    | `detectRunner`                                         |                                                                          |
| `existing-tooling.ts:83`                    | `hasConfigurationSection`                                        | `hasSection`                                           |                                                                          |
| `existing-tooling.ts:121`                   | `replaceTools`                                                   | `getReplacedConfigs`                                   | it finds configurations                                                  |
| `existing-tooling.ts:127`                   | `matches`                                                        | `isMatch`                                              |                                                                          |
| `existing-tooling.ts:148`, `:219`           | `existingHooks`, `existingTooling`                               | `getHooks`, `getTooling`                               | filler                                                                   |
| `existing-tooling.ts:181`                   | `declaredKits`                                                   | `getToolConfigs`                                       | it returns tool configurations; its `selected` parameter is never passed |
| `existing-tooling.ts:205`                   | `isOwned`                                                        | `isReplaced`                                           | another `isOwned` means something else                                   |
| `existing-tooling.ts:264`                   | `ciLintJobs`                                                     | `getLintJobs`                                          |                                                                          |
| `configuration-section.ts:15`               | `selectedValue`                                                  | `select`                                               |                                                                          |
| `configuration-section.ts:25`, `:43`, `:65` | `sectionName`, `kitSection`, `iniSection`                        | `parseHeader`, `getSection`, `getIniSection`           |                                                                          |

**`packages/cli/src/lifecycle`, `generation`, and `native`**

| File                                                 | Now                                                                        | Proposed                                                                            | Why                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| ownership `owner.ts:21`                              | `activeMutation`                                                           | `activeOwners`                                                                      | it holds owners                                             |
| ownership `owner.ts:23`                              | `lifecycleOwner`                                                           | `buildOwner`                                                                        | "lifecycle" repeats the folder                              |
| ownership `owner.ts:79`                              | `written`                                                                  | `preserveMode`                                                                      | its own comment says preserve                               |
| ownership `owner.ts:82`                              | `checkout`                                                                 | `isCheckout`                                                                        | a boolean named as a noun                                   |
| ownership `owner.ts:114`                             | `runOwnedLifecycle`                                                        | `withOwner`                                                                         | a generic `run` and three words                             |
| ownership `owner.ts:140`                             | `readOwnership`                                                            | `getOwnership`                                                                      |                                                             |
| ownership `apply.ts:10`, plans `:136`                | `foundRead`, `currentRead`                                                 | `getOnDisk`                                                                         | two names for one helper                                    |
| ownership `apply.ts:17`                              | `assertPlanCurrent`                                                        | `assertPlanFresh`                                                                   | "Current" collides with the `current` field                 |
| ownership `apply.ts:62`                              | `prepareRecord`                                                            | `prepareWrite`                                                                      | it returns a prepared write                                 |
| ownership `log.ts:79`                                | `readState`                                                                | `parseState`                                                                        |                                                             |
| ownership `log.ts:85`                                | `recoverAll`                                                               | `recover`                                                                           | "All" is filler                                             |
| ownership `log.ts:98`                                | `recordedEntry`                                                            | `getEntry`                                                                          |                                                             |
| ownership `log.ts:133`                               | `identity`                                                                 | `identify`                                                                          | another `identity` is a pattern                             |
| ownership `log.ts:147`                               | `matches`                                                                  | `isMatch`                                                                           |                                                             |
| ownership `log.ts:161`                               | `record`                                                                   | `logPath`                                                                           | it holds a path; `OWNERSHIP_FILE` already exists for it     |
| ownership `installs.ts:14`                           | `state.installations` and `state.installs`                                 | `inProgress` and `installed`                                                        | two near-identical words with different meanings            |
| ownership `installs.ts:78`                           | `removeInstallation`                                                       | `deleteInstallation`                                                                | the guide verb for files                                    |
| ownership `plans.ts`, 7 sites                        | `existing`, `current`                                                      | `recorded`, `onDisk`                                                                | filler                                                      |
| ownership `plans.ts:37`, `:72`, `:87`                | `changedReplacement`, `updatedBlock`, `insertedBlock`                      | `planChange`, `planUpdate`, `planInsert`                                            | adjectives for functions                                    |
| ownership `plans.ts:64`                              | `blockText`                                                                | `decodeText`                                                                        | the merge plan does the same job                            |
| ownership `plans.ts:103`, `:118`                     | `blockPlan`, `retirementPlan`                                              | `planBlock`, `planRetirement`                                                       |                                                             |
| ownership `plans.ts:201`                             | `proposeConfiguration`                                                     | `proposeMerge`                                                                      | the entry kind is `merge`                                   |
| ownership `plans.ts:217`                             | `matchesInstalled`                                                         | `isInstalled`                                                                       | the local variable is already `isInstalled`                 |
| ownership `restoration.ts:19`, `:25`                 | `fieldRestoration`, `applies`                                              | `getMergedFields`, `isApplicable`                                                   |                                                             |
| ownership `restoration.ts:30`                        | `restoreConfiguration`                                                     | `restoreFields`                                                                     |                                                             |
| ownership `restoration.ts:81`                        | `restorationFor`                                                           | `getRestoration`                                                                    | a `For` suffix                                              |
| `log.ts:16`, `:17`                                   | `configurationPathSchema`, `configurationFieldsSchema`                     | `keyPathSchema`, `fieldsSchema`                                                     | the types are `KeyPath` and `Field`                         |
| `log.ts:68`                                          | `entrySchema`                                                              | `fileSchema`                                                                        | the state stores these under `files`                        |
| `log.ts:74`                                          | `configuration` (a field)                                                  | `merge`                                                                             | the entry kind is `merge`                                   |
| configuration `document.ts:6`                        | `KitDocument`                                                              | `Document`                                                                          | nothing about it is about kits                              |
| configuration `document.ts:9`                        | `jsonDocument`                                                             | `parseJsonTree`                                                                     | the same name exists in the preview                         |
| configuration `document.ts:18`                       | `valueAt`, `root`                                                          | `getValue`, `object`                                                                | root means the repository root elsewhere                    |
| configuration `document.ts:33`                       | `tomlTable(create)`                                                        | `getTomlTable(canCreate)`                                                           | the policy writer spells the flag `canCreate`               |
| configuration `document.ts:124`, `:139`              | `configurationDocument`, `hasConfiguration`                                | `openDocument`, `hasFields`                                                         |                                                             |
| configuration `plan.ts:26`                           | `sourceText`                                                               | `decodeText`                                                                        |                                                             |
| configuration `plan.ts:54`, `:102`, `:120`           | `plannedField`, `nextRecord`, `planned`                                    | `planField`, `buildRecord`, `buildPlan`                                             | adjectives for functions                                    |
| configuration `plan.ts:142`, `:145`                  | `pruneConfigurationParents`, `protectedFields`                             | `pruneParents`, `keptPaths`                                                         |                                                             |
| configuration `plan.ts:164`                          | `planConfiguration`                                                        | `planMerge`                                                                         |                                                             |
| rules `diff.ts:16`                                   | `jsonDocument`                                                             | `parseJsonc`                                                                        | two different `jsonDocument` functions                      |
| rules `diff.ts:23`, `:33`                            | `NAMED_READERS`, `FORMAT_READERS`                                          | `PARSERS_BY_NAME`, `PARSERS_BY_EXTENSION`                                           | they are parsers                                            |
| rules `diff.ts:41`, `:46`                            | `document`, `reader`                                                       | `parseDocument`, `parser`                                                           |                                                             |
| rules `diff.ts:59`                                   | `tableAt`                                                                  | `getValue`                                                                          | the policy writer has another `tableAt`                     |
| rules `diff.ts:69`, `:80`, `:119`                    | `ruleList`, `rulesAt`, `ruleDiff`                                          | `mapRules`, `getRules`, `diffRules`                                                 |                                                             |
| rules `diff.ts:98`                                   | `previousRules`, `next`                                                    | `previous`, `proposed`                                                              | the before-and-after pair has three schemes                 |
| rules `eslint-diff.ts:17`                            | `eslintRuleDiff`                                                           | `diffEslintRules`                                                                   |                                                             |
| rules `eslint-diff.ts:21`, `:24`, `:33`              | `plan`, `selected`, `current`                                              | `generated`, `targets`, `before`                                                    |                                                             |
| rules `javascript.ts:27`, `:43`, `:61`               | `scalarValue`, `literalValue`, `javascriptRules`                           | `parseScalar`, `parseLiteral`, `parseJavascript`                                    | the functions parse                                         |
| rules `gixy.ts:2`, `:21`                             | `option`, `gixyRules`                                                      | `parseOption`, `parseGixy`                                                          |                                                             |
| rules `shellcheck.ts:21`, `:33`, `:49`, `:63`        | `valueSpan`, `readDirective`, `ruleEntries`, `shellcheckRules`             | `parseValue`, `parseDirective`, `parseRuleList`, `parseShellcheck`                  |                                                             |
| rules `sqlfluff.ts:3`, `:61`, `:81`                  | `value`, `sqlfluffConfiguration`, `sqlfluffRules`                          | `parseScalar`, `parseIni`, `parseSqlfluff`                                          | `sqlfluffConfiguration` has no importer                     |
| rules `swiftformat.ts:1`, `:14`, `:29`, `:39`, `:58` | `content`, `configurationLines`, `option`, `ruleNames`, `swiftformatRules` | `stripComment`, `logicalLines`, `parseOption`, `parseRuleNames`, `parseSwiftformat` |                                                             |
| rules `swiftformat.ts:2`                             | `quoted`, `escaped`                                                        | `isQuoted`, `isEscaped`                                                             | booleans                                                    |
| rules `vale.ts:5`, `:21`, `:64`, `:76`, `:94`        | `plainEntry`, `unquoted`, `readOption`, `sectionSummary`, `valeRules`      | `splitPlain`, `unquote`, `parseOption`, `summarizeSection`, `parseVale`             |                                                             |
| `version-pin.ts:8`                                   | `GSPOT_VERSION`                                                            | `RUNNING_VERSION`                                                                   | gspot inside gspot; doctor calls it running                 |
| `version-pin.ts:15`, `:27`                           | `pinnedVersion`, `writePin`                                                | `getPin`, `setPin`                                                                  | the guide verbs                                             |
| generation `workflow.ts:5`                           | `MISE`, `NODE`, `CACHE`, `CHECKOUT`, `DOWNLOAD`                            | `*_ACTION`                                                                          | bare nouns for pinned actions; `NODE` beside `NODE_VERSION` |
| generation `workflow.ts:27`, `:44`                   | `comparisonCheck`, `checkJob`                                              | `buildCheckScript`, `buildJob`                                                      | "check" reads as a verb                                     |
| generation `workflow.ts:106`                         | `workflowFile`                                                             | `githubFile`                                                                        | pairs with `gitlabFile`                                     |
| native `configuration.ts:19`                         | `runConfiguration`                                                         | `evaluate`                                                                          | a generic `run` and filler                                  |
| native `eslint-preview.ts:11`, `:49`                 | `moduleSource`, `ruleTable`                                                | `rewriteImports`, `collectRules`                                                    | nouns for functions                                         |
| native `eslint-preview.ts:80`                        | `runEslintPreview`                                                         | `previewRules`                                                                      |                                                             |
| native `process.ts:22`, `:43`                        | `output`, `runRuleCoverage`                                                | `resultPath`, `getActiveRules`                                                      |                                                             |
| native `process.ts:50`, `:60`                        | `eslintClass`, `level`                                                     | `ESLint`, `severity`                                                                | ESLint's words; level is gspot's recommended or all         |
| native `protocol.ts:6`                               | `eslintPreviewRequest` and four more                                       | `previewRequestSchema` and so on                                                    | the other zod schemas end in `Schema`                       |

**`packages/cli/src/types` and `packages/cli/src/config`** (these names move with their owners, section 6.1)

| File                                                   | Now                                                                                             | Proposed                                                      | Why                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| types `commands.ts:9`                                  | `KitEvidence as Plan`                                                                           | `KitEvidence`                                                 | an alias that collides with lifecycle plans                       |
| types `commands.ts:29`                                 | `toDefault`                                                                                     | `reset`                                                       | the guide verb                                                    |
| types `commands.ts:71`                                 | `PushedRevision`                                                                                | `PushRevision`                                                | an alias: two names for one type                                  |
| types `commands.ts:72`, `:154`, `:155`, `:186`         | `Checked`, `Found`, `OwnCheck`, `Detect`                                                        | `CheckedRevision`, `CheckMatch`, `DeclaredCheck`, `Detection` | adjectives and a verb as type names                               |
| types `commands.ts:80`                                 | `Revision.content` beside `RevisionSource.kind`                                                 | one field                                                     | the same union under two names                                    |
| types `commands.ts:109`                                | `ChangeReport`                                                                                  | `Changes`                                                     | "Report" is filler                                                |
| types `commands.ts:135`                                | `SettingScope.current`                                                                          | `effective`                                                   |                                                                   |
| types `commands.ts:140`                                | `Explanation.data`                                                                              | `json`                                                        | the command result already says `json`                            |
| types `commands.ts:156`                                | `ExplainFields`                                                                                 | `CheckFacts`                                                  | filler                                                            |
| types `commands.ts:169`                                | `Replaced.read`                                                                                 | `originals`                                                   | a verb as a field                                                 |
| types revisions `revisions.ts:2`                       | `RevisionSource`                                                                                | `Revision`                                                    | "Source" is filler                                                |
| types revisions `revisions.ts:16`                      | `Directory { folder, dependency }`                                                              | `Dependency { project, directory }`                           | vague; folder beside directory                                    |
| types revisions `revisions.ts:17`                      | `ChangedSet`, `StagedSet`, `reference`                                                          | `ChangedPaths`, `StagedPaths`, `ref`                          | they are not sets                                                 |
| types revisions `revisions.ts:31`                      | `ParsedMapping`                                                                                 | `Refspec`                                                     |                                                                   |
| types repository `repository.ts:16`                    | `SourceReads`                                                                                   | `ReadCache`                                                   |                                                                   |
| types repository `repository.ts:21`                    | `Reader`, `Section`, `Rules`                                                                    | `LineCursor`, `ValeSection`, `ShellcheckRules`                | generic names for one-tool types                                  |
| types repository `repository.ts:39`                    | `ExistingTool`, `ExistingTooling`                                                               | `ToolConfig`, `Tooling`                                       | filler                                                            |
| types repository `repository.ts:64`                    | `Fields`                                                                                        | `PackageManifest`                                             | vague                                                             |
| types policy `policy.ts:26`, `:29`                     | `Value`, `Kinded`                                                                               | `ValueNode`, `SyntaxNode`                                     | generic; an adjective                                             |
| types policy `policy.ts:57`                            | `ExposedSettings`                                                                               | `SettingSurface`                                              | the parameters are all `surface`                                  |
| types policy `policy.ts:103`                           | `NamingCategoryTable`                                                                           | `NamingTable`                                                 | it is used for language tables too                                |
| types policy `policy.ts:190`                           | `WriteResult`                                                                                   | `Proposal`                                                    | nothing is written                                                |
| types policy `policy.ts:83`                            | `PathSegment[]`, `KeyPath`, and an inline union                                                 | `KeyPath`                                                     | three spellings of one type                                       |
| types lifecycle `lifecycle.ts:8`                       | `ConfigurationWriteRequest`                                                                     | `MergeRequest`                                                | filler                                                            |
| types lifecycle `lifecycle.ts:15`                      | `replace` (a boolean)                                                                           | `canReplace`                                                  | reads as a verb; `Owner.replace` takes it too                     |
| types lifecycle `lifecycle.ts:29`, `:30`               | `ConfigurationOwnership`, `KitPlan`                                                             | `MergeRecord`, `MergePlan`                                    |                                                                   |
| types lifecycle `lifecycle.ts:44`, `:56`, `:57`, `:74` | `DriftEntry`, `OwnershipState`, `OwnershipEntry`, `Planned`                                     | `Drift`, `Ownership`, `OwnedFile`, `Plan`                     | filler and an adjective                                           |
| types lifecycle `lifecycle.ts:76`                      | `current` and `next` beside `previous` and `entry`                                              | `before` and `after`                                          | the pending record already says before and after                  |
| types lifecycle `lifecycle.ts:70`, `:106`              | `Log.entryFor`, `Owner.read`                                                                    | `getEntry`, `get`                                             |                                                                   |
| types lifecycle `lifecycle.ts:115`                     | `ConfigurationFormat`                                                                           | `Format`                                                      |                                                                   |
| types lifecycle `lifecycle.ts:118`                     | `KitDocument.value()`                                                                           | `get()`                                                       |                                                                   |
| types `generation.ts:11`, `:70`                        | `WorkflowShape`, `rulesPath`                                                                    | `Pipeline`, `rulePaths`                                       | vague; a singular name for a list                                 |
| config commands `commands.ts:4`                        | `SET_NEAR_LIMIT`                                                                                | `KEY_SUGGESTION_LIMIT`                                        | "near" is vague                                                   |
| config commands `doctor.ts:16`                         | `CHANGE_HEAD_BYTES`                                                                             | `HEADER_BYTES`                                                |                                                                   |
| config commands `explain.ts:4`, `:13`                  | `DIRECTIONS`, `SWIFTLINT_LINES`                                                                 | `DIRECTION_TEXTS`, `SWIFTLINT_LINE_LIMIT`                     |                                                                   |
| config commands `init.ts:19`                           | `PERIPHERY_FILE`                                                                                | `PERIPHERY_YML`                                               |                                                                   |
| config repository `revisions.ts:3`                     | `MATERIALIZATION_BATCH_SIZE`                                                                    | `WRITE_BATCH`                                                 | three words                                                       |
| config repository `revisions.ts:5`                     | `EXECUTABLE_MODE`, `FILE_MODE`                                                                  | the platform modes                                            | duplicates                                                        |
| config repository `revisions.ts:15`                    | `VALE_CONFIGURATION`                                                                            | `VALE_INI`                                                    | a path                                                            |
| config repository `revisions.ts:16`                    | `CHANGED_PATHS`, `DIFF_PATHS`, `LOG_PATHS`                                                      | `WORKTREE_DIFF_ARGV`, `COMMIT_DIFF_ARGV`, `LOG_ARGV`          | they hold git arguments                                           |
| config repository `revisions.ts:17`                    | `GIT_HASH`                                                                                      | `HASH_PATTERN`                                                | a pattern named like a value                                      |
| config `native.ts:7`                                   | `ACTIVE_LEVELS`                                                                                 | `ACTIVE_SEVERITIES`                                           | ESLint's word                                                     |
| config policy `policy.ts:8`                            | `NEAR_DISTANCE_LIMIT`                                                                           | `SUGGESTION_LIMIT`                                            | used as a count                                                   |
| config policy `policy.ts:12`, `:44`                    | `DEFAULT_INDENT_WIDTH`, `MINIMUM_REASON_WORDS`                                                  | `INDENT_WIDTH`, `REASON_WORDS_MIN`                            | filler; min spelled two ways                                      |
| config `platform.ts:4`                                 | `READ_ONLY_FILE`, `OWNER_WRITABLE_FILE`, `EXECUTABLE_FILE`, `PRIVATE_FILE`, `PRIVATE_DIRECTORY` | `*_MODE`                                                      | modes named like paths; `EXECUTABLE_FILE` is used for directories |
| config `platform.ts:57`, `:66`                         | `GSPOT_FOLDER`, `INSTALLATION_FOLDERS`                                                          | `DOT_GSPOT`, `INSTALLATION_DIRECTORIES`                       | gspot inside gspot; folder beside directory                       |
| config repository `repository.ts:37`                   | `DIRECTIVE`, `RULE_NAME`, `RULE_CODE`                                                           | `SHELLCHECK_*`                                                | generic names for ShellCheck patterns                             |

#### Patterns across files

| Pattern                                                                           | Where                                                                                                                                | Proposed                                                         |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| a `Root` handle named `files`, while `files` elsewhere is a list of tracked files | 107 places, such as the init questions, the survey, the snapshots, and the owner                                                     | role names, such as `installed` and `destination`; else `handle` |
| `cancelSignal` beside `signal`                                                    | about 120 uses in the snapshots and the preview                                                                                      | `signal`                                                         |
| `existing` and `current` for "the recorded entry" and "the bytes on disk"         | ownership, merge plans, export, snapshots                                                                                            | `recorded` and `onDisk`                                          |
| `raw` for a parsed document                                                       | the policy writer, width, profiles, set, kits                                                                                        | `document`                                                       |
| "configuration" for a kit                                                         | the kit commands, list, profiles                                                                                                     | `kit`                                                            |
| one git object ID under five names                                                | `object`, `hash`, `gitHash`, `revisionId`, `stored`                                                                                  | `hash`                                                           |
| folder beside directory                                                           | init settings, snapshots, survey, installations, ownership, config                                                                   | `directory`                                                      |
| `xCommand` exports, with `explainResult` as the odd one                           | every command                                                                                                                        | `explainCommand`                                                 |
| names from outside these files that break the same rules                          | `readPolicy`, `readManifests`, `readGitSetting`, `listSettings`, `everyManifest`, `headerFor`, `specFor`, `CheckSpec`, `SettingSpec` | the guide verbs; no `Spec`                                       |
| one concept under three names in manifests and explain                            | `tool_errors`, `crash_pattern`, `crashPattern`                                                                                       | `crash_pattern`                                                  |

### A.11 Identifiers in the checks, the parsers, and their constants

Across the checks, 37 check IDs carry an engine name instead of their kit, and about 150 names repeat their kit or
folder. About 95 groups give one thing several names, and about 120 names carry `DEFAULT_` or other filler. With the file map
in appendix B.2, most names that repeat their folder lose the repetition when they move.

**`packages/cli/src/checks`, the top-level files**

| File                                               | Now                                                                 | Proposed                                            | Why                                              |
| -------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| `dispatch.ts:33`                                   | `checks`                                                            | `analyses`                                          | it holds analyses                                |
| `dispatch.ts:68`                                   | `spec`                                                              | `check`                                             | filler; also in the naming and structure engines |
| `result.ts:17`                                     | `checkResultSchema`                                                 | `resultSchema`                                      | "check" repeats the folder                       |
| `actions.ts:69`                                    | `checkActions`                                                      | `actionlint`                                        | a `check*` prefix inside `checks`                |
| `commit-messages.ts:28`                            | `checkCommitMessages`                                               | `commitlintRange`                                   | the same                                         |
| `commit-messages.ts:10`                            | `selectedCommits`, and another in the TruffleHog check              | `pushedCommits`, `scannedCommits`                   | one name, two return shapes                      |
| `ansible.ts:35`                                    | `ansibleLint`                                                       | `lint`                                              | the file word                                    |
| `cloudflare.ts:65`                                 | `isTypesFileStale`                                                  | `isStale`                                           | four words                                       |
| `cloudflare.ts:122`, `:135`, `:148`, `:178`        | `headersSyntax`, `redirectsSyntax`, `wranglerFile`, `envTypesFresh` | `headers`, `redirects`, `wrangler`, `typesFresh`    | the check IDs after A.5                          |
| `cloudflare.ts`, `drizzle.ts`, `html.ts`, `sql.ts` | `CLOUDFLARE_ANALYSES` and three more                                | `ANALYSES`, then the registry                       | the file word                                    |
| `css.ts:137`                                       | `cssModuleUsage`                                                    | `moduleClasses`                                     | three names today                                |
| `drizzle.ts:21`, `:58`                             | `drizzleRelations`, `drizzleMigrations`                             | `relations`, `migrations`                           | the file word                                    |
| `drizzle.ts:28`                                    | `everything`                                                        | `schemaText`                                        | vague                                            |
| `html.ts:147`                                      | `findings`                                                          | `markupFindings`                                    | 39 locals share the name                         |
| `html.ts:126`, `:182`, `:192`                      | `copyProblems`, `htmlScripts`, `htmlText`                           | `literalProblems`, `scripts`, `literals`            | copy beside literal; the file word               |
| `licenses.ts:133`                                  | `licensesPackages`                                                  | `packages`                                          | "licenses" twice                                 |
| `licenses.ts:38`, `:121`                           | `readConfiguration`, `configurationSchema`                          | `readAllowlist`, `allowlistSchema`                  | filler                                           |
| `locales.ts:38`, `:46`, `:49`                      | `localeFiles`, `raw`, `held`                                        | `locales`, `documents`, `messages`                  | filler and vague                                 |
| `sql.ts:141`                                       | `sqlSyntax`, `sqlBlockComments`, `sqlFileLength`, `sqlFunctions`    | `syntax`, `blockComments`, `fileLines`, `functions` | the file word; length beside lines               |
| `sql.ts:114`                                       | `fileFunctionFindings`                                              | `fileFindings`                                      | three words                                      |
| `sql.ts:60`, `:69`                                 | `sqlBodyStatements` beside `bodyStatements`                         | `sqlBody`                                           | near-identical siblings                          |
| `svelte.ts:23`, `:53`                              | `svelteFindings`, `svelteCheck`                                     | `findings`, `check`                                 | the file word                                    |
| `trpc.ts:12`                                       | `trpcBoundaries`                                                    | `boundaries`                                        | the file word                                    |
| 16 files                                           | `said` for tool output and for finding text                         | `output` or `message`                               | one name, two meanings                           |
| 9 files                                            | `held` for attributes, headers, and cached values                   | name the value                                      | one name, four meanings                          |
| 44 sites                                           | `result`                                                            | name the run, such as `scan`                        | filler                                           |
| 18 sites                                           | `parsed`                                                            | name the thing: `table`, `tree`, `document`         | filler                                           |
| 14 sites                                           | `config` beside `configuration`                                     | one spelling                                        |                                                  |
| 24 sites                                           | `entry`, `entries`                                                  | name the item                                       | filler                                           |

**`packages/cli/src/checks/bash`**

| File                                         | Now                                                                                                                                                                                          | Proposed                                                                                                                     | Why                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 18 files                                     | `StructureAnalysis as Analysis`                                                                                                                                                              | `StructureAnalysis`                                                                                                          | an alias gives the type a second name |
| every analysis                               | the parameter `scripts`, which is a function that loads the index                                                                                                                            | `index`                                                                                                                      | reads as a list                       |
| every analysis                               | the parameter `context` holding `context.input`                                                                                                                                              | one name                                                                                                                     | context beside input                  |
| ten files, such as `inline.ts:11`            | `scriptBoundaries`, `scriptConfigDefaults`, `scriptGuards`, `scriptInline`, `scriptInterpreter`, `scriptPolicy`, `scriptRemote`, `scriptSafety`, `scriptSourceComments`, `scriptSourceOrder` | `boundaries`, `defaults`, `guards`, `embeds`, `contract`, `wrappers`, `sshBlocks`, `safety`, `sourceComments`, `sourceOrder` | the siblings have no `script` prefix  |
| `boundaries.ts:20`                           | `resolvedSource`                                                                                                                                                                             | `sourcedPath`                                                                                                                | "resolved" is filler                  |
| `counts.ts:7`, `:29`                         | `scoreFor`, the parameter `analysis`                                                                                                                                                         | `score`, `rule`                                                                                                              | a `For` suffix; it is a rule key      |
| `cross-file-index.ts:36`                     | `readScriptFile`                                                                                                                                                                             | `readScript`                                                                                                                 |                                       |
| `dead-parameters.ts:60`                      | `deadParameters`                                                                                                                                                                             | `unreadArguments`                                                                                                            | the finding says arguments            |
| `env-access-owner.ts:18`                     | `envAccessOwner`                                                                                                                                                                             | `envOwner`                                                                                                                   |                                       |
| `file-length.ts:12`, `function-length.ts:11` | `fileLength`, `functionLength`                                                                                                                                                               | `fileLines`, `functionLines`                                                                                                 | the limits say lines                  |
| `interpreter.ts:132`                         | `libraryLineProblem`                                                                                                                                                                         | `libraryProblem`                                                                                                             | three words                           |
| `trivial-function.ts:13`                     | `trivialFunction`                                                                                                                                                                            | `trivialFunctions`                                                                                                           | python and swift use the plural       |
| `visibility.ts:11`                           | `privatePrefix`, beside `privatePrefixes` in the python exports                                                                                                                              | one                                                                                                                          |                                       |
| `remote.ts:7`                                | `PAIR`, three times across the checks, and `ESCAPE_PAIR`                                                                                                                                     | one shared constant                                                                                                          | two names for 2                       |
| `doc-comment.ts:13`                          | `LINE_ABOVE`, also in the postgres migration docs                                                                                                                                            | one shared constant                                                                                                          | a duplicate                           |

**Other folders in `packages/cli/src/checks`**

| File                                                                              | Now                                                                     | Proposed                                                   | Why                                                        |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| dependencies `install-policy.ts:52`                                               | `installPolicy`, `manifestPolicy`                                       | `install`, `manifests`                                     | "policy" is filler                                         |
| dependencies lockfile `fresh.ts:38`                                               | `lockfileFresh`, `lockfileHosts`                                        | `fresh`, `hosts`                                           | the folder word                                            |
| docs `copied-blocks.ts:72`                                                        | `copiedBlocks`, beside `clonePlaceSchema` and `cloneFindings`           | `jscpd`; keep `clone*`                                     | four names for one idea: clone, copied, duplication, jscpd |
| docs `headings.ts:14`                                                             | `docsHeadings`                                                          | `headings`                                                 | the folder word                                            |
| docs `stale-paths.ts:71`                                                          | `withoutTrailingPunctuation`                                            | `withoutPunctuation`                                       | three words                                                |
| express `routes.ts:11`                                                            | `routesTested`                                                          | `untestedRoutes`                                           | named by what it finds                                     |
| jest `run.ts:149`, `:23`                                                          | `jestCoverage`, `readTestReport`                                        | `coverage`, `readReport`                                   | the folder word                                            |
| jest `schema.ts:4`, `:7`                                                          | `jestPercentage`, `jestCoverageSettings`                                | `percentage`, `thresholdsSchema`                           | the folder word; "Settings" is filler                      |
| naming `cases.ts:18`                                                              | `CHECKS`                                                                | `CASE_TESTS`                                               | "checks" means a third thing here                          |
| naming `engine.ts:67`, `:110`                                                     | `all`, `schemaFindings`                                                 | `pathNames`, `policyFindings`                              | filler; it is not a schema                                 |
| naming `python.ts:44` in extractors, `paths.ts:11`                                | `unwrapped` twice                                                       | keep one; `segmentName` for the other                      | one name, two meanings                                     |
| naming `paths.ts:4`, and structure `directories.ts:20`                            | `stemOf` twice                                                          | keep one; `baseStem` for the other                         | one name, two inputs                                       |
| naming `match.ts:44`                                                              | `isReservedUseAllowed`                                                  | `isUseAllowed`                                             | four words                                                 |
| naming `policy.ts:20`, and the two parsers                                        | `state` for a cache                                                     | `cache`                                                    | filler                                                     |
| naming `policy.ts:28`, `:44`                                                      | `compileRule` beside `writtenRule`                                      | `shippedRule`, `writtenRule`                               | a verb beside an adjective                                 |
| naming `policy.ts:31`                                                             | `isPath` (a matcher), `isDuplicatesAllowed`, `isExcluding`              | `matches`, `allowsRepeats`, `excludes`                     | `isPath` reads as a boolean                                |
| naming `policy.ts:67`, `:72`, `:195`                                              | `numberSetting`, `limitsReader`, `limitsUnderRules`                     | `numberAt`, `limits`, `ruleLimits`                         | filler                                                     |
| naming `split.ts:24`, `validate-name.ts:55`                                       | `repeatedPart`, `repeatProblem`                                         | one word, repeat, with the finding and key                 | four names for one idea                                    |
| naming `validate-name.ts:61`                                                      | the parameter `context`                                                 | `inputs`                                                   | filler                                                     |
| nextjs `build.ts:22`, `:60`, `:86`                                                | `writeNextjsTypes`, `nextjsTypes`, `nextjsBuild`                        | `typegen`, `types`, `build`                                | the folder word                                            |
| nextjs `source.ts:43`, `:79`, `:6`                                                | `nextjsConfiguration`, `dependencyAlignment`, `paths`                   | `nextConfig`, `versionPairs`, `routeFiles`                 | the folder word; vague                                     |
| nginx `config-test.ts:91` and `directives.ts:63`                                  | `nginxTest`, `nginxTokens`, `nginxDirectives`, `nginxTestArguments`     | `test`, `tokens`, `directives`, `testArguments`            | the folder word                                            |
| nginx `config-test.ts:14`                                                         | `includedConfigurations`, `configurationCopies`, `configurationFailure` | `includes`, `copies`, `failure`                            | filler                                                     |
| openapi `openapi.ts:18`, `:56`                                                    | `openapiLint`, `openapiFresh`                                           | `spectral`, `fresh`                                        | the folder word                                            |
| postgres `history.ts:7`                                                           | `history`, a cache                                                      | `committed`                                                | the cache shares the file name                             |
| postgres schema `checks.ts:49`, `:92`                                             | `rlsPresent`, `explicitGrants`                                          | `rls`, `grants`                                            | filler                                                     |
| postgres schema `fields.ts`                                                       | the parameter `fields` holding the schema state                         | `state`                                                    | two names for one type                                     |
| prose `banned.ts:37`, `vale.ts:88`                                                | `banned`, `valeFindings`                                                | `hidden`, `vale`                                           | says nothing; "Findings" is implied                        |
| python `analyses.ts:25`, and swift                                                | `analysis`                                                              | `sourceEngine`                                             | a noun for a function                                      |
| python `analyses.ts:40`, and swift                                                | `PYTHON_STRUCTURE`, `SWIFT_STRUCTURE`                                   | the registry                                               | they run under the integrity engine                        |
| python `blocking-calls.ts:21`                                                     | `pythonBlockingCalls`                                                   | goes                                                       | the check is deleted                                       |
| python `docstrings.ts:46`                                                         | `checkDocstrings`                                                       | `pydoclint`                                                | a `check*` prefix; named by tool                           |
| python `modules.ts:23`                                                            | `pythonModules`                                                         | `modules`                                                  | the folder word                                            |
| python `project.ts:23`, `:26`, `:39`                                              | `importConfiguration`, `dependencyConfiguration`, `checkDependencies`   | `importLinterSchema`, `deptrySchema`, `deptry`             | filler; reads like the dependencies kit                    |
| python `project.ts:89`, `:141`                                                    | `dependencyOwnership`, `typecheckMembership`                            | `pipInstalls`, `staleExclusions`                           | named by what they find                                    |
| python `imports.ts:30`                                                            | `resolved`                                                              | `resolve`                                                  | a participle for a function                                |
| python `docstrings.ts:10`, supabase `project.ts:9`, xcode project `reader.ts:215` | `projectSchema` three times                                             | `pyprojectSchema`, `supabaseSchema`, `pbxprojSchema`       | one name, three schemas                                    |
| repository `files.ts:94`, `:17`, `:24`                                            | `fileIntegrity`, `configurationRolePaths`, `isValueImportOutside`       | `configLogic`, `configPaths`, `isOutsideImport`            | says nothing; filler; four words                           |
| repository `allowlists-match.ts:120`                                              | `allowlistsMatch`                                                       | `staleAllowlists`                                          | named by what it finds                                     |
| repository `generated-drift.ts:9`                                                 | `generatedDrift`                                                        | `drift`                                                    |                                                            |
| secrets `history.ts:13`, `verified.ts:121`                                        | `checkSecretHistory`, `checkVerifiedSecrets`                            | `gitleaksHistory`, `trufflehog`                            | `check*` prefixes; third names                             |
| security `sarif.ts:7`                                                             | `artifactLocation`, `sarifResult`, `sarifRun`, `sarifLog`               | `locationSchema`, `resultSchema`, `runSchema`, `logSchema` | every other zod schema ends in `Schema`                    |
| static-site `build.ts:18`, `:77`, `:91`, `:102`                                   | `built`, `siteBuild`, `requireSiteBuild`, `siteBuilds`                  | `runBuild`, `cachedBuild`, `requireBuild`, `build`         | four near-identical names                                  |
| static-site `output-checks.ts:78`, `:183`, `:211`                                 | `builtMarkup`, `sizeLimits`, `sitemapMatches`                           | `htmlValidate`, `sizes`, `sitemap`                         | named by tool; filler                                      |
| static-site `source-checks.ts:56`, `:112`                                         | `svgCompressed`, `siteWideHeaders`                                      | `svgo`, `sharedHeaders`                                    | a third name; three words                                  |
| structure `engine.ts:60`                                                          | `contextFor`, which returns an input                                    | `inputFor`                                                 | context beside input                                       |
| structure `engine.ts:72`                                                          | `bashText`, `bashList`, `bashSetting`, the parameter `slot`             | `text`, `list`, `value`, `key`                             | the prefix; filler                                         |
| structure `engine.ts:89`                                                          | `scriptFiles`, with the tag `'shell'`                                   | keep; the tag becomes `'script'`                           | script beside shell                                        |
| structure `file-layout.ts:10`, `single-file-folder.ts:18`                         | `fileDirectoryCollision`, `singleFileFolder`                            | `stemCollisions`, `loneFiles`                              | three words                                                |
| structure `prefix-collisions.ts:20`                                               | `isNestName`                                                            | `isNestjsName`                                             | reads as nesting                                           |
| structure `statements.ts:149`                                                     | `trivialFunctionText`                                                   | `trivialText`                                              | three words                                                |
| structure `imports.ts:15`                                                         | `projectOptions`                                                        | `compilerOptions`                                          | options of what                                            |
| supabase `config-checks.ts:13`                                                    | `projectValid`                                                          | `config`                                                   | a third name                                               |
| supabase `deno.ts:80`, `:91`, `:25`, `:13`                                        | `denoLint`, `denoCheck`, `denoFileArguments`, `lintReport`              | `lint`, `check`, `fileArguments`, `lintSchema`             | the file word; the schema suffix                           |
| supabase `project.ts:19`, xcode project `reader.ts:223`                           | `readProject` twice                                                     | `readConfig`, `readPbxproj`                                | one name, unrelated things                                 |
| swift `build.ts:95`, `:111`, `:131`, `:14`                                        | `swiftBuild`, `swiftAnalyze`, `swiftPeriphery`, the parameter `named`   | `build`, `analyze`, `periphery`, `check`                   | the folder word; vague                                     |
| swift `lint.ts:67`, `:38`                                                         | `checkSwiftlint`, `restoreInlineFindings`                               | `swiftlint`, `restoreInline`                               | a `check*` prefix; three words                             |
| swift `order.ts:42`                                                               | `environmentReads`                                                      | `envOwner`                                                 | three names for one check                                  |
| swift `plan.ts:19`, `sources.ts:25`                                               | `swiftBuildPlan`, `swiftSources`                                        | `buildPlan`, `sources`                                     | the folder word                                            |
| typescript `compiler-options.ts:3`                                                | `ALL_COMPILER_OPTIONS`                                                  | `COMPILER_OPTIONS`                                         | filler                                                     |
| typescript `required-rules.ts:9`, xcode project `checks.ts:135`                   | `requiredByEnding`, `trackedEnding`                                     | `…ByExtension`                                             | ending, extension, and suffix are one idea                 |
| typescript `required-rules.ts:31`                                                 | `requiredRules`                                                         | `rulesOff`                                                 | named by what it finds                                     |
| typescript `tsc.ts:86`, `:115`                                                    | `checkTypescript`, `checkJavascript`                                    | `tsc`, `checkjs`                                           | `check*` prefixes                                          |
| typescript `tsconfig-options.ts:13`                                               | `tsconfigOptions`                                                       | `tsconfig`                                                 | filler                                                     |
| xcode project `checks.ts:102`                                                     | `projectSymlinks`                                                       | `symlinks`                                                 |                                                            |
| xcode project `reader.ts:6`, `:142`, `:251`, `:92`                                | `entrySchema`, `projectEntry`, `projectTestTargets`, `is`               | `objectSchema`, `projectObject`, `testTargets`, `isToken`  | the pbxproj word is object; a one-word name                |
| xcode `resources.ts:10`, `:83`, `:92`                                             | `parsed`, `stringFiles`, `assetFolders`                                 | `readJson`, `xcstrings`, `assets`                          | a participle for a function; second names                  |
| xcode `settings-files.ts:12`, `:42`, `:67`, `:22`                                 | `xcconfigLines`, `entitlementsPolicy`, `transportSecurity`, `isFine`    | `xcconfig`, `entitlements`, `ats`, `isValid`               | filler; a second name; vague                               |
| xctest `coverage.ts:80`, `:11`                                                    | `testCoverage`, `coverageReportSchema`                                  | `coverage`, `xccovSchema`                                  | filler                                                     |
| xctest `line-checks.ts:45`, `:102`, `:121`                                        | `disabledTests`, `noSleep`, `recordingMode`                             | `disabled`, `sleeps`, `recording`                          | "no" in a name; filler                                     |
| xctest `references.ts:14`                                                         | `referenceOwners`                                                       | `references`                                               | a third name                                               |

**`packages/cli/src/config/checks`** (these constants move into the kit files)

| File                                             | Now                                                                                   | Proposed                                                                      | Why                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------- |
| `structure.ts:3`                                 | `RULES` with keys `bash-branches`, `bash-nesting`, `bash-mutable-assignments`         | `BASH_COUNTS` with `branches`, `nesting`, `assignments`                       | generic; "bash-" repeats                           |
| `structure.ts:52`                                | `COUNT_ANALYSES`                                                                      | delete                                                                        | the keys of `RULES` again                          |
| `structure.ts:48`, and the swift file            | `DEFAULT_MIN_LINES` (3), `DEFAULT_DUPLICATE_LINES` (4)                                | `DUPLICATE_LINES`                                                             | two names and two values for one limit             |
| `structure.ts:50`, `:273`                        | `SHELLCHECK_COMMENT`, `SHELLCHECK_DIRECTIVE`                                          | `SHELLCHECK_DIRECTIVE`                                                        | one pattern under two names                        |
| `structure.ts:53`                                | `SCRIPT_TAG = 'shell'`                                                                | `SCRIPT_TAG = 'script'`                                                       | the name contradicts the value                     |
| `structure.ts:55`, `:141`, and two more files    | `SOURCE`, `SCRIPT_ENDING`, `CODE_SUFFIX`, `CODE_EXTENSIONS`                           | `…_EXTENSION` and `…_EXTENSIONS`                                              | three words for one idea                           |
| `structure.ts:14`                                | `FUNCTIONS`, `CONTAINERS`, `NAMES`                                                    | `FUNCTION_NODES`, `CONTAINER_NODES`, `NAME_NODES`                             | the naming file uses `*_NODES`                     |
| `structure.ts:59`                                | `DIRECTORY_CONSTANT_START`, `_SIGNS`, `_PIECES`                                       | `DIRECTORY_START`, `_SIGNS`, `_PIECES`                                        | three words                                        |
| `structure.ts:64`                                | `VAGUE_SUMMARY_WORDS`                                                                 | `VAGUE_WORDS`                                                                 |                                                    |
| `structure.ts:84`                                | `ALL_PARAMETERS`                                                                      | `SPREAD_READ`                                                                 | filler; the sibling is `POSITIONAL_READ`           |
| `structure.ts:92`                                | `BANNED_FOLDER_NAMES`                                                                 | `BANNED_FOLDERS`                                                              |                                                    |
| `structure.ts:114`                               | `STRUCTURE_HOOK_DIRECTORIES`                                                          | `HOOK_DIRECTORIES`                                                            | the file word                                      |
| `structure.ts:117`, and the docs file            | `DOCUMENT_EXTENSIONS`, `MARKDOWN`                                                     | one name                                                                      | the same set                                       |
| `structure.ts:122`                               | `DEFAULT_THRESHOLD`                                                                   | `PREFIX_COLLISIONS`                                                           | vague                                              |
| `structure.ts:123`                               | `NEST_KINDS`                                                                          | `NESTJS_KINDS`                                                                | reads as nesting                                   |
| `structure.ts:156`                               | `DEFAULT_TRIVIAL_STATEMENTS`                                                          | `TRIVIAL_STATEMENTS`                                                          | filler; the plugin has its own copy                |
| `structure.ts:198`                               | `FORWARDER_STEM`, `FORWARDING_INTERPRETER`, `FORWARDING_MAX_LINES`                    | `FORWARDER_*`                                                                 | two word forms                                     |
| `structure.ts:219`, `:275`                       | `OTHER_INTERPRETER_SHEBANG`, `SSH_BLOCK_MIN_LINES`                                    | `OTHER_SHEBANG`, `SSH_BLOCK_LINES`                                            |                                                    |
| `naming.ts:38`, `:40`, and the platforms file    | `MIGRATION_TIMESTAMP_DIGITS`, `MIGRATION_DIRECTORY`, `MIGRATION_NAME`                 | `MIGRATION_DIGITS`, `MIGRATION_PREFIX`                                        | "DIRECTORY" holds a name pattern                   |
| `naming.ts:98`                                   | `PYTHON_UPPER_SHAPE`                                                                  | `PYTHON_CONSTANT`                                                             | vague                                              |
| `naming.ts:100`                                  | `TYPE_NODES` (Swift only), `METHOD_NODES` (TypeScript only)                           | `SWIFT_TYPE_NODES`, `TYPESCRIPT_METHOD_NODES`                                 | the siblings carry a language                      |
| `python.ts:7`                                    | `INSTALL_HOLDERS`                                                                     | `INSTALL_EXTENSIONS`                                                          | vague                                              |
| `python.ts:8`                                    | `DEFAULT_FILE_LINES`, `DEFAULT_FUNCTION_LINES`, `DEFAULT_PACKAGE_EXPORTS`             | no `DEFAULT_`                                                                 | filler; a second source for the manifest defaults  |
| `python.ts:11`                                   | `SINGLETONS_ALLOWED`                                                                  | `SINGLETON_NAMES`                                                             | the same name as a setting that holds another list |
| `python.ts:13`, `:29`                            | `BLOCKING_NAMES`, `DOCSTRING_COMMAND`                                                 | `BLOCKING_CALLS`, `PYDOCLINT_COMMAND`                                         |                                                    |
| `swift.ts:27`, `:31`, `:39`, `:48`               | `DEFAULT_DESTINATION`, `PRIVATE_PREFIX`, `BUILD_SETTING`, `SWIFT_COMMENT_LINE`        | `XCODE_DESTINATION`, `PRIVATE_TMP`, `SETTING_REFERENCE`, `COMMENT_LINE`       | filler; a collision; vague                         |
| `swift.ts:59`, and the typescript file           | `PERCENT`, `FULL_PERCENTAGE`                                                          | one name                                                                      | two names for 100                                  |
| `docs.ts:3`, `security.ts:3`, `repository.ts:96` | `JSCPD_TOOL`, `CODEQL_TOOL`, `LICENSE_CHECKER_TOOL`                                   | no `_TOOL`                                                                    |                                                    |
| `docs.ts:11`, `:45`, `:46`                       | `DEFAULT_CEILING`, `START_SECTION_WORDS`, `CONTENTS_THRESHOLD`                        | `DUPLICATION_PERCENT`, `START_WORDS`, `CONTENTS_HEADINGS`                     | vague, and a jscpd value in the docs file          |
| `docs.ts:53`, and the repository file            | `SQL_BLOCK_COMMENT`, `BLOCK_COMMENT`                                                  | one name                                                                      | the same text                                      |
| `platforms.ts` and `repository.ts`               | whole files                                                                           | split by kit                                                                  | they hold values for about ten kits                |
| `platforms.ts:4`, `:17`, `:18`                   | `FINDINGS_EXIT`, `MAIN_FILE`, `DEFAULT_IMAGE`                                         | `TRIVY_EXIT`, `NGINX_MAIN`, `NGINX_IMAGE`                                     | vague and filler                                   |
| `platforms.ts:37`, `:49`, `:53`, `:56`           | `DEFAULT_BUILD_OUTPUT`, `DEFAULT_BUILD`, `CONFIG_FILE`, `PAIRS`                       | `SITE_OUTPUT`, `SITE_BUILD`, `NEXT_CONFIG`, `VERSION_PAIRS`                   |                                                    |
| `platforms.ts:38`, and the repository file       | `BYTES_PER_KB`, `KILOBYTE`                                                            | one name                                                                      | two names for 1024                                 |
| `platforms.ts:41`, `:50`                         | `REPORTED_SAVINGS_SHARE`, `SHOWN_DIFFERENCES`                                         | `SVGO_SAVING`, `SHOWN_LINES`                                                  | three words; `SHOWN_LINES` already exists          |
| `platforms.ts:67`, `:70`, `:72`                  | `DEFAULT_FUNCTIONS`, `CHECK_LOCATION`, `DEFAULT_PATHS`                                | `FUNCTIONS_DIRECTORY`, `DENO_LOCATION`, `ADMIN_KEY_PATHS`                     | vague                                              |
| `platforms.ts:83`, `:91`, `:114`                 | `MIGRATION_DOC_SECTIONS`, `MIGRATION_DOC_LABELS`, `DEFAULT_SCHEMA`                    | `DOC_SECTIONS`, `DOC_LABELS`, `PUBLIC_SCHEMA`                                 |                                                    |
| `repository.ts:41`, `:48`                        | `MESSAGES`, `MOVE_HELP`                                                               | `DRIFT_MESSAGES`, `APPLY_HELP`                                                | the sibling is `DRIFT_HELP`; the text says apply   |
| `repository.ts:63`, `:89`                        | `DEFAULT_AGE_DAYS`, `SHIPPED_PARAMETER_LIMIT`                                         | `RELEASE_AGE_DAYS`, `FUNCTION_PARAMETERS`                                     | `SHIPPED_` beside `DEFAULT_` for one idea          |
| `repository.ts:98` to `:132`                     | `FAILED_CHECK`, `DIAGNOSTIC_LINE`, `FAILURE_LINE`, `TYPES_FILE`, `LINT_LINE`, `TABLE` | the kit name first, such as `SVELTE_FAILURE`, `ANSIBLE_LINE`, `DRIZZLE_TABLE` | vague                                              |
| `security.ts:4`                                  | `BASELINE`, `DEFAULT_SUITE`, `KEY_GROUP`                                              | `GITLEAKS_BASELINE`, `CODEQL_SUITE`, `ENV_KEY_GROUP`                          |                                                    |
| `typescript.ts:6`                                | `RECOMMENDED_COMPILER_OPTIONS`                                                        | `RECOMMENDED_OPTIONS`                                                         |                                                    |
| `typescript.ts:21`                               | `ESLINT_RULE_LEVELS`, the file `eslint-levels.json`, the import `ruleLevels`          | one name                                                                      | three names for one table                          |
| `eslint-levels.json:2`                           | the `gspot/*` keys                                                                    | read the level from each rule                                                 | a second source for each rule level                |

**`packages/cli/src/parsers`**

| File                                      | Now                                                             | Proposed                        | Why                     |
| ----------------------------------------- | --------------------------------------------------------------- | ------------------------------- | ----------------------- |
| sql `parser.ts:37`, `:15`                 | `parseSql`, `readResult`                                        | `parse`, `readParse`            | the folder word; filler |
| sql `source.ts:152`, `:112`               | `sqlSource`, `lexemeSpanEnd`                                    | `withoutVariables`, `lexemeEnd` | says nothing; filler    |
| sql `statements.ts:59`                    | `sqlFile`                                                       | `file`                          | the folder word         |
| sql `statements.ts:8`, `tree-sitter.ts:9` | `reads` for a cache                                             | `cache`                         | reads like input        |
| `tree-sitter.ts:46`                       | the parameter `context`                                         | `reads`                         | filler                  |
| `comments.ts:58`, `:49`                   | `commentStart`, twice; `quotedEnd`, three times across the code | one each                        | duplicates              |
| `comments.ts:149`                         | `COMMENT_READERS`                                               | `READERS`                       | the file word           |

### A.12 The ESLint plugin

Rule file names equal the rule IDs, so each rename covers both.

| Where                                                                         | Now                                                                                                               | Proposed                                   | Why                                                 |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------- |
| `packages/eslint-plugin/src/rules/env-access-owner.ts:22`                     | `env-access-owner`                                                                                                | `env-owner`                                | "access" adds nothing                               |
| `packages/eslint-plugin/src/rules/header-comments-before-imports.ts:92`       | `header-comments-before-imports`                                                                                  | `header-first`                             | four words; the message ID is already `headerFirst` |
| `packages/eslint-plugin/src/rules/import-path-style.ts:16`                    | `import-path-style`                                                                                               | `import-style`                             | matches its setting `tools.eslint.import_style`     |
| `packages/eslint-plugin/src/rules/no-client-environment.ts:16`                | `no-client-environment`                                                                                           | `no-client-env`                            | the sibling says env                                |
| `packages/eslint-plugin/src/rules/no-cross-project-imports.ts:22`             | `no-cross-project-imports`                                                                                        | `no-cross-scope-imports`                   | its options and messages say scope                  |
| `packages/eslint-plugin/src/rules/no-duplicate-barrel-exports.ts:83`          | `no-duplicate-barrel-exports`                                                                                     | `no-duplicate-exports`                     | it only runs on index files                         |
| `packages/eslint-plugin/src/rules/no-exported-alias-constants.ts:16`          | `no-exported-alias-constants`                                                                                     | `no-alias-exports`                         | four words                                          |
| `packages/eslint-plugin/src/rules/registry-instance-only.ts:15`               | `registry-instance-only`                                                                                          | `registry-instances`                       | "only" is filler                                    |
| `packages/eslint-plugin/src/rules/tests-directory-contents.ts:8`              | `tests-directory-contents`                                                                                        | `test-folders`                             | "contents" is filler                                |
| `packages/eslint-plugin/src/rules/import-direction.ts:90` and two more        | `scope` (a string), `scope` (a list of roots), `scopes`                                                           | `roots` for the cross-folder rule          | one name, two meanings                              |
| `packages/eslint-plugin/src/rules/no-client-environment.ts:30`                | `clientModule`                                                                                                    | `isClient`                                 | a boolean named like a noun                         |
| four rules, such as `packages/eslint-plugin/src/rules/no-index-imports.ts:23` | `allowed`, `allow`, `excluded`, `exempt`                                                                          | `allowed`                                  | four spellings for a skip list                      |
| `packages/eslint-plugin/src/rules/registry-instance-only.ts:27`               | `registryFiles`                                                                                                   | `files`                                    | the rule ID says registry                           |
| `packages/eslint-plugin/src/rules/tests-directory-contents.ts:22`             | `testPattern`, `testDirectories`, `harnessDirectory`                                                              | `pattern`, `directories`, `harness`        | the rule ID says tests; the message says support    |
| `packages/eslint-plugin/src/rules/types-placement.ts:143`                     | `typesDirectory`                                                                                                  | `directory`                                | the rule ID says types                              |
| `packages/eslint-plugin/src/rules/import-direction.ts:94`                     | message `typesOnlyTypes`                                                                                          | `typesToRuntime`                           | the siblings follow `<from>To<to>`                  |
| `packages/eslint-plugin/src/rules/no-cross-folder-imports.ts:44`              | messages `cross`, `crossNoAlias`                                                                                  | `alias`, `escape`                          | "cross" repeats the rule ID                         |
| `packages/eslint-plugin/src/rules/types-placement.ts:155`                     | message `valueImportInside`                                                                                       | `valueImport`                              | three words                                         |
| `packages/eslint-plugin/src/rules/import-direction.ts:111`                    | `relativeOf`, `rootOfScope`                                                                                       | `relative`, `scopeRoot`                    | the CLI says `scopeRoot`                            |
| `packages/eslint-plugin/src/rules/types-placement.ts:18`                      | `isEnumValueReference`                                                                                            | `isEnumReference`                          | four words                                          |
| `packages/eslint-plugin/src/rules/types-placement.ts:68`                      | `isTypeOnlyImport` beside `isTypeOnly` in the import-direction rule                                               | `isTypeOnly`                               | two names for one helper                            |
| `packages/eslint-plugin/src/rules/header-comments-before-imports.ts:9`        | `commentBlocks` beside `blocksOf` in the import-comments rule                                                     | one name                                   | one concept                                         |
| `packages/eslint-plugin/src/rules/env-access-owner.ts:8`                      | `isEnvironmentRead`                                                                                               | `isEnvRead`                                |                                                     |
| `packages/eslint-plugin/src/types/rules.ts:14`                                | `HeaderCommentsOptions`, `ImportLayoutOptions`                                                                    | one type                                   | the same shape for three rules                      |
| `packages/eslint-plugin/src/types/rules.ts:11`                                | `HarnessBarrelImportsOptions`, `TestsDirectoryContentsOptions`                                                    | shorter, with the rule IDs                 | four words and more                                 |
| `packages/eslint-plugin/src/types/rules.ts:29`                                | some option types drop the "No" of their rule, others keep it                                                     | pick one                                   |                                                     |
| `packages/eslint-plugin/src/types/rules.ts:33`                                | `ImportLayoutEntry`                                                                                               | `LayoutLine`                               | "Entry" is filler                                   |
| `packages/eslint-plugin/src/config/rules.ts`                                  | `DEFAULT_MAX`, `DEFAULT_TEST`, `DEFAULT_PATTERNS`, `DEFAULT_PREFIXES`, and a copy of `DEFAULT_TRIVIAL_STATEMENTS` | no `DEFAULT_`; one trivial-statement count | filler; a duplicate of the CLI value                |
| `packages/eslint-plugin/src/plugin.ts:83`                                     | the configurations `gspot/recommended` and `gspot/all`                                                            | keep                                       | the two levels stay                                 |

## Appendix B: every file before and after

"Folder after" is relative to `packages/cli/src`; "same" means the file stays where it is. A file that keeps its place
still receives the constants and types that `config` and `types` held for it (section 6.1).

### B.1 `packages/cli/src`, outside `checks` and `parsers`

**New shared modules.** Each one collects code that is written several times today.

| Folder after | File after     | Lines | What goes into it                                                                                                                                                                                                                                                     |
| ------------ | -------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `platform`   | `git.ts`       | ~110  | one git runner with one timeout: `packages/cli/src/repository/git-config.ts`, `packages/cli/src/repository/hook-location.ts`, `packages/cli/src/repository/revisions/git-queries.ts`, the git calls in `packages/cli/src/repository/tracked.ts`, and `GIT_TIMEOUT_MS` |
| `platform`   | `text.ts`      | ~50   | `similar` from `packages/cli/src/policy/similar.ts`, one `sha256` (written 8 times today), one UTF-8 decode on `isUtf8` (about 10 times), and the JSON indent                                                                                                         |
| `platform`   | `objects.ts`   | ~40   | `compact` from `packages/cli/src/policy/normalize.ts`, one plain-object test (5 copies today), the dotted-path getter, and `Defined<T>`                                                                                                                               |
| `platform`   | `quoting.ts`   | ~35   | `quoteArgument` and `commandArguments` from `packages/cli/src/platform/arguments.ts`                                                                                                                                                                                  |
| `platform`   | `modes.ts`     | ~20   | the file modes from `packages/cli/src/config/platform.ts`, named `*_MODE`                                                                                                                                                                                             |
| `platform`   | `locations.ts` | ~30   | every `.gspot` path, written as a literal about 86 times today                                                                                                                                                                                                        |
| `repository` | `sources.ts`   | ~70   | `readSource` and `readPrefix` from `packages/cli/src/repository/tracked.ts`; 52 of its 70 importers want only these                                                                                                                                                   |
| `repository` | `survey.ts`    | ~200  | the parts of `packages/cli/src/repository/existing-tooling.ts` that do not need kits: hook managers, CI files, agent files, rules folders, lint folders, the task runner                                                                                              |
| `kits`       | `takeover.ts`  | ~200  | the kit-dependent parts of `packages/cli/src/repository/existing-tooling.ts` and all of `packages/cli/src/repository/configuration-section.ts`                                                                                                                        |
| `generation` | `markers.ts`   | ~80   | `packages/cli/src/lifecycle/managed-blocks.ts` and its constants                                                                                                                                                                                                      |
| `execution`  | `finding.ts`   | ~60   | the finding model from `packages/cli/src/checks/result.ts` and the two status sets                                                                                                                                                                                    |
| `execution`  | `engine.ts`    | ~170  | the engine contract and the half of `packages/cli/src/execution/engines.ts` that runs an engine                                                                                                                                                                       |
| `checks`     | `registry.ts`  | ~150  | the maps of `packages/cli/src/checks/dispatch.ts`, the 16 `analyses.ts` files, and `packages/cli/src/execution/engines.ts`, keyed by check ID                                                                                                                         |
| `commands`   | `flags.ts`     | ~45   | `textFlag`, `listFlag`, `directoryOf`, and `textEntry` from `packages/cli/src/platform/arguments.ts`                                                                                                                                                                  |
| `commands`   | `edit.ts`      | ~115  | `packages/cli/src/commands/policy.ts` and `packages/cli/src/lifecycle/policy.ts`, the shared step of `set`, `ignore`, `add`, and `remove`                                                                                                                             |

`Root` in `packages/cli/src/platform/filesystem.ts` gains `Symbol.dispose`, `readText`, and a disposable temporary
folder. They replace 58 open-try-close blocks and 17 hand-made temporary folders.

**`main.ts` and `agents`**

| Now                                       | Lines | Action | Folder after | File after        | Why                                                                             |
| ----------------------------------------- | ----- | ------ | ------------ | ----------------- | ------------------------------------------------------------------------------- |
| `packages/cli/src/main.ts`                | 4     | keep   | same         |                   |                                                                                 |
| `packages/cli/src/agents/assemble.ts`     | 126   | move   | `rules`      | `assemble.ts`     | guides become rules; it takes a narrow settings type instead of the policy type |
| `packages/cli/src/agents/examples.ts`     | 48    | delete |              |                   | the guide linter                                                                |
| `packages/cli/src/agents/instructions.ts` | 78    | move   | `rules`      | `instructions.ts` | the move also fixes the `[rules]` wording bug                                   |
| `packages/cli/src/agents/lint.ts`         | 192   | delete |              |                   | the guide linter                                                                |
| `packages/cli/src/agents/metadata.ts`     | 78    | delete |              |                   | the guide linter                                                                |
| `packages/cli/src/agents/sections.ts`     | 43    | move   | `rules`      | `sections.ts`     |                                                                                 |

**`commands`**

| Now                                             | Lines | Action | Folder after       | File after               | Why                                                                               |
| ----------------------------------------------- | ----- | ------ | ------------------ | ------------------------ | --------------------------------------------------------------------------------- |
| `packages/cli/src/commands/apply/command.ts`    | 110   | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/apply/workflow.ts`   | 95    | rename | `commands/apply`   | `write.ts`               | "workflow" clashes with the CI workflow; `applyAll` becomes `writeOutputs`        |
| `packages/cli/src/commands/check/command.ts`    | 158   | keep   | same               |                          | drop `--no-cache`                                                                 |
| `packages/cli/src/commands/check/content.ts`    | 177   | keep   | same               |                          | drop `writeReport`; pass the registry to the run                                  |
| `packages/cli/src/commands/check/push.ts`       | 110   | keep   | same               |                          | drop `writeReport`; the push report becomes a plain type                          |
| `packages/cli/src/commands/check/run.ts`        | 51    | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/check/selection.ts`  | 112   | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/completion.ts`       | 18    | delete |                    |                          | owner decision; `@bomb.sh/tab` goes                                               |
| `packages/cli/src/commands/doctor/changes.ts`   | 127   | keep   | same               |                          | reads the survey and the takeover modules                                         |
| `packages/cli/src/commands/doctor/command.ts`   | 45    | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/doctor/report.ts`    | 168   | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/explain/checks.ts`   | 221   | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/explain/command.ts`  | 35    | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/explain/file.ts`     | 112   | rename | `commands/explain` | `path.ts`                | it exports `explainPath`; the subject kind is `path`                              |
| `packages/cli/src/commands/explain/subjects.ts` | 160   | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/export.ts`           | 64    | keep   | same               |                          | profiles stay                                                                     |
| `packages/cli/src/commands/ignore.ts`           | 125   | keep   | same               |                          | `isDeepStrictEqual` instead of comparing JSON strings                             |
| `packages/cli/src/commands/init/command.ts`     | 153   | keep   | same               |                          | `--no-guides` becomes `--no-rules`                                                |
| `packages/cli/src/commands/init/detection.ts`   | 83    | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/init/plan/build.ts`  | 245   | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/init/plan/text.ts`   | 55    | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/init/prepare.ts`     | 112   | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/init/propose.ts`     | 134   | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/init/questions.ts`   | 108   | keep   | same               |                          | git reads through the git module                                                  |
| `packages/cli/src/commands/init/replaced.ts`    | 46    | keep   | same               |                          | takeover stays                                                                    |
| `packages/cli/src/commands/init/selection.ts`   | 215   | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/init/settings.ts`    | 52    | keep   | same               |                          | drop the ticket number                                                            |
| `packages/cli/src/commands/init/write.ts`       | 126   | keep   | same               |                          | a replaced file is deleted, with no backup; git has it                            |
| `packages/cli/src/commands/init/xcode.ts`       | 49    | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/install.ts`          | 107   | move   | `commands/install` | `command.ts`             | it gains the install steps from `tools`                                           |
| `packages/cli/src/commands/kits.ts`             | 137   | split  | `commands`         | `add.ts` and `remove.ts` | every other command file is named after its command; the shared step is `edit.ts` |
| `packages/cli/src/commands/list.ts`             | 145   | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/policy.ts`           | 62    | merge  | `commands`         | `edit.ts`                | a third `policy.ts`; no `policy` command exists                                   |
| `packages/cli/src/commands/print-result.ts`     | 38    | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/program.ts`          | 97    | keep   | same               |                          | drop the completion and uninstall registrations                                   |
| `packages/cli/src/commands/prompts.ts`          | 94    | keep   | same               |                          | open question in section 1                                                        |
| `packages/cli/src/commands/set.ts`              | 245   | keep   | same               |                          |                                                                                   |
| `packages/cli/src/commands/uninstall.ts`        | 166   | delete |                    |                          | owner decision, with `uninstallHooks` and `Owner.restore`                         |

**`config` and `types`.** Where each group goes if the owner dissolves the folders (section 6.1). If `config` stays,
the same column names the folder whose `config` file holds it. The groups that do not go to a single obvious owner:

| Now                                              | Lines | Where it goes                                                                                                                                                                      |
| ------------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/cli/src/config/agents.ts`              | 139   | six constants to the rules folder; the 14 constants of the guide linter are deleted                                                                                                |
| `packages/cli/src/config/checks`                 | 2,578 | the kit files in `checks` (B.2); `eslint-levels.json` becomes `levels.json` in `generation/eslint`                                                                                 |
| `packages/cli/src/config/commands`               | 97    | each command file; the exit codes to `packages/cli/src/platform/errors.ts`                                                                                                         |
| `packages/cli/src/config/execution/execution.ts` | 85    | the execution files; the placeholder patterns to the kit command schema; the cache and inline-ignore constants are deleted                                                         |
| `packages/cli/src/config/execution/output.ts`    | 12    | the tool output parsers                                                                                                                                                            |
| `packages/cli/src/config/generation.ts`          | 91    | the generation files; the SARIF and upload pins are deleted with the report files                                                                                                  |
| `packages/cli/src/config/kits.ts`                | 101   | the kit files; the Vale constants to the Vale style generator                                                                                                                      |
| `packages/cli/src/config/lifecycle.ts`           | 14    | drift, the ownership plans, and the new markers module; `RECOVERY_OWNER` is deleted with the byte backups                                                                          |
| `packages/cli/src/config/native.ts`              | 7     | the ESLint levels to the policy tool schema; the rest to the preview                                                                                                               |
| `packages/cli/src/config/output.ts`              | 11    | the reporter; the JSON indent to the text module; `MS_PER_SECOND` merges with `MILLISECONDS`                                                                                       |
| `packages/cli/src/config/parsers`                | 26    | the parsers                                                                                                                                                                        |
| `packages/cli/src/config/platform.ts`            | 86    | the modes and locations modules, `safe-paths.ts`, `spawn.ts`, `assets.ts`; `REPORT_DIRECTORY`, `CACHE_DIRECTORY`, and the old `.gspot` layouts are deleted                         |
| `packages/cli/src/config/policy`                 | 71    | each policy file; the similarity constants to the text module                                                                                                                      |
| `packages/cli/src/config/repository`             | 345   | the repository files and the survey; `LOCKS` and `VALE_CONFIGURATION` repeat existing constants and are deleted                                                                    |
| `packages/cli/src/config/tools`                  | 110   | the tool files; `MISE_CONFIG_PATH` and the tool project names to the locations module                                                                                              |
| `packages/cli/src/types/agents.ts`               | 19    | `RuleFile` to the rules folder; five linter types are deleted                                                                                                                      |
| `packages/cli/src/types/checks.ts`               | 378   | the finding and engine modules in `execution`; about 90 types to the kit files; `Declared`, `ForeignKey`, `ParsedModules`, `ParsedSwift`, and `ProjectRoot` are unused and deleted |
| `packages/cli/src/types/commands.ts`             | 288   | each command file; the uninstall and cache types are deleted                                                                                                                       |
| `packages/cli/src/types/execution`               | 181   | the execution files; the cache and inline-ignore types are deleted                                                                                                                 |
| `packages/cli/src/types/generation.ts`           | 170   | the generation files                                                                                                                                                               |
| `packages/cli/src/types/kits.ts`                 | 93    | the kit files, and three types to `tools`, `execution`, and `explain`                                                                                                              |
| `packages/cli/src/types/lifecycle`               | 142   | the ownership, merge, and drift files; `Original` shrinks to an `adopted` flag                                                                                                     |
| `packages/cli/src/types/output.ts`               | 5     | the output files                                                                                                                                                                   |
| `packages/cli/src/types/parsers`                 | 49    | the parsers                                                                                                                                                                        |
| `packages/cli/src/types/platform.ts`             | 92    | `errors.ts`, `paths.ts`, `filesystem.ts`, `spawn.ts`                                                                                                                               |
| `packages/cli/src/types/policy`                  | 215   | the policy files; `SettingRow`, `LimitTable`, `ArchitectureAllow`, `StructureSettings`, and `PolicyScope` are unused and deleted                                                   |
| `packages/cli/src/types/repository`              | 131   | the repository files, the snapshot files, and the preview; `RefMapping` is unused and deleted                                                                                      |
| `packages/cli/src/types/tools`                   | 59    | the tool files and the install steps                                                                                                                                               |

**`execution`**

| Now                                                     | Lines | Action | Folder after             | File after                    | Why                                                                                 |
| ------------------------------------------------------- | ----- | ------ | ------------------------ | ----------------------------- | ----------------------------------------------------------------------------------- |
| `packages/cli/src/execution/broken-tool.ts`             | 150   | merge  | `execution/tool`         | `findings.ts`                 | crash or finding is part of reading one tool run                                    |
| `packages/cli/src/execution/cache.ts`                   | 156   | delete |                          |                               | the result cache                                                                    |
| `packages/cli/src/execution/command-expansion.ts`       | 202   | move   | `execution/tool`         | `placeholders.ts`             | it sits with the runner that uses it                                                |
| `packages/cli/src/execution/coverage.ts`                | 88    | keep   | same                     |                               |                                                                                     |
| `packages/cli/src/execution/engines.ts`                 | 210   | split  | `execution` and `checks` | `engine.ts` and `registry.ts` | cuts the import from `execution` into `checks`                                      |
| `packages/cli/src/execution/execute.ts`                 | 212   | keep   | same                     |                               | takes the registry as a parameter; drops the cache; absorbs the `[[ignore]]` filter |
| `packages/cli/src/execution/files/batches.ts`           | 43    | move   | `execution/tool`         | `batches.ts`                  |                                                                                     |
| `packages/cli/src/execution/files/workspace.ts`         | 205   | move   | `execution/tool`         | `workspace.ts`                |                                                                                     |
| `packages/cli/src/execution/fixers.ts`                  | 229   | keep   | same                     |                               | diff headers with forward slashes                                                   |
| `packages/cli/src/execution/ignores.ts`                 | 93    | split  | `execution`              | `execute.ts`                  | the `[[ignore]]` filter stays; the inline comments go                               |
| `packages/cli/src/execution/output/json.ts`             | 83    | move   | `execution/tool`         | `json.ts`                     | an `output` folder inside `execution` beside the top `output` folder                |
| `packages/cli/src/execution/output/parse.ts`            | 209   | move   | `execution/tool`         | `formats.ts`                  | one parser per output format                                                        |
| `packages/cli/src/execution/output/tool-formats.ts`     | 219   | move   | `execution/tool`         | `reports.ts`                  | the markdownlint, typos, and TruffleHog reports                                     |
| `packages/cli/src/execution/planning/files.ts`          | 145   | keep   | same                     |                               |                                                                                     |
| `packages/cli/src/execution/planning/plan.ts`           | 256   | keep   | same                     |                               |                                                                                     |
| `packages/cli/src/execution/planning/skips.ts`          | 103   | keep   | same                     |                               |                                                                                     |
| `packages/cli/src/execution/report.ts`                  | 54    | delete |                          |                               | schemas that never parse; the reports become plain types                            |
| `packages/cli/src/execution/reproduce.ts`               | 32    | keep   | same                     |                               |                                                                                     |
| `packages/cli/src/execution/result-cache.ts`            | 162   | delete |                          |                               | the result cache                                                                    |
| `packages/cli/src/execution/run-report.ts`              | 130   | keep   | same                     |                               | drops `writeReport` and the suppression count                                       |
| `packages/cli/src/execution/session.ts`                 | 69    | keep   | same                     |                               | reads pending installs once and passes them to `tools`                              |
| `packages/cli/src/execution/tool/findings.ts`           | 112   | keep   | same                     |                               | absorbs the broken-tool rules                                                       |
| `packages/cli/src/execution/tool/runner.ts`             | 308   | keep   | same                     |                               |                                                                                     |
| `packages/cli/src/repository/revisions/contents.ts`     | 275   | move   | `execution/checkout`     | `revision.ts`                 | a snapshot is part of a run; cuts `repository` into `lifecycle` and `tools`         |
| `packages/cli/src/repository/revisions/dependencies.ts` | 240   | move   | `execution/checkout`     | `installed.ts`                | the same                                                                            |

**`generation`**

| Now                                                   | Lines | Action | Folder after | File after     | Why                                                                                                       |
| ----------------------------------------------------- | ----- | ------ | ------------ | -------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/cli/src/generation/bunfig.ts`               | 45    | keep   | same         |                |                                                                                                           |
| `packages/cli/src/generation/eslint/blocks.ts`        | 145   | keep   | same         |                | `isDeepStrictEqual`                                                                                       |
| `packages/cli/src/generation/eslint/configuration.ts` | 215   | keep   | same         |                | reads `levels.json` beside it; no default `types` role                                                    |
| `packages/cli/src/generation/formatting/selectors.ts` | 123   | keep   | same         |                |                                                                                                           |
| `packages/cli/src/generation/formatting/settings.ts`  | 141   | keep   | same         |                |                                                                                                           |
| `packages/cli/src/generation/fragments.ts`            | 110   | keep   | same         |                |                                                                                                           |
| `packages/cli/src/generation/headers.ts`              | 72    | keep   | same         |                |                                                                                                           |
| `packages/cli/src/generation/hooks.ts`                | 72    | keep   | same         |                |                                                                                                           |
| `packages/cli/src/generation/ignore-patterns.ts`      | 88    | keep   | same         |                |                                                                                                           |
| `packages/cli/src/generation/javascript.ts`           | 102   | keep   | same         |                | takes the compiler option lists; cuts `generation` into `checks`                                          |
| `packages/cli/src/generation/json-format.ts`          | 70    | keep   | same         |                |                                                                                                           |
| `packages/cli/src/generation/kits.ts`                 | 156   | keep   | same         |                |                                                                                                           |
| `packages/cli/src/generation/outputs.ts`              | 129   | keep   | same         |                | `emitAll` becomes `generate`                                                                              |
| `packages/cli/src/generation/pointers.ts`             | 83    | keep   | same         |                |                                                                                                           |
| `packages/cli/src/generation/registry.ts`             | 5     | merge  | `generation` | `templates.ts` | five lines; "registry" names nothing here                                                                 |
| `packages/cli/src/generation/templates.ts`            | 228   | keep   | same         |                |                                                                                                           |
| `packages/cli/src/generation/tools/environment.ts`    | 25    | keep   | same         |                |                                                                                                           |
| `packages/cli/src/generation/tools/mise.ts`           | 57    | keep   | same         |                | `testToolsText` moves to the test pin script                                                              |
| `packages/cli/src/generation/tools/packages.ts`       | 48    | keep   | same         |                |                                                                                                           |
| `packages/cli/src/generation/vale-styles.ts`          | 62    | keep   | same         |                |                                                                                                           |
| `packages/cli/src/generation/workflow.ts`             | 203   | rename | `generation` | `ci.ts`        | it writes the GitLab include too; clashes with the apply workflow; drop the SARIF and report upload steps |
| `packages/cli/src/lifecycle/managed-blocks.ts`        | 64    | move   | `generation` | `markers.ts`   | cuts the cycle between `generation` and `lifecycle`                                                       |

**`kits`**

| Now                                          | Lines | Action | Folder after | File after    | Why                                       |
| -------------------------------------------- | ----- | ------ | ------------ | ------------- | ----------------------------------------- |
| `packages/cli/src/kits/command-schema.ts`    | 11    | rename | `kits`       | `command.ts`  | it takes the command placeholder patterns |
| `packages/cli/src/kits/detect.ts`            | 216   | keep   | same         |               |                                           |
| `packages/cli/src/kits/listing.ts`           | 32    | keep   | same         |               |                                           |
| `packages/cli/src/kits/manifest-problems.ts` | 266   | rename | `kits`       | `problems.ts` | open question in section 1                |
| `packages/cli/src/kits/manifests.ts`         | 145   | keep   | same         |               | cuts `kits` into `policy`                 |
| `packages/cli/src/kits/output-format.ts`     | 34    | rename | `kits`       | `output.ts`   |                                           |
| `packages/cli/src/kits/owners.ts`            | 72    | keep   | same         |               |                                           |
| `packages/cli/src/kits/schema.ts`            | 295   | keep   | same         |               | drop the ticket number                    |
| `packages/cli/src/kits/select.ts`            | 122   | keep   | same         |               | takes the kit messages from `policy`      |
| `packages/cli/src/kits/targets.ts`           | 38    | keep   | same         |               |                                           |
| `packages/cli/src/kits/tools.ts`             | 102   | keep   | same         |               |                                           |

**`lifecycle` and `native`**

| Now                                                    | Lines | Action | Folder after               | File after         | Why                                                                        |
| ------------------------------------------------------ | ----- | ------ | -------------------------- | ------------------ | -------------------------------------------------------------------------- |
| `packages/cli/src/lifecycle/apply.ts`                  | 91    | keep   | same                       |                    | drops the note about a retained original                                   |
| `packages/cli/src/lifecycle/configuration/document.ts` | 156   | move   | `lifecycle/merge`          | `document.ts`      | the folder plans merged fields; its entry kind is `merge`                  |
| `packages/cli/src/lifecycle/configuration/plan.ts`     | 182   | move   | `lifecycle/merge`          | `plan.ts`          |                                                                            |
| `packages/cli/src/lifecycle/drift.ts`                  | 118   | keep   | same                       |                    |                                                                            |
| `packages/cli/src/lifecycle/hooks.ts`                  | 104   | rename | `lifecycle`                | `hooks-path.ts`    | the third `hooks.ts`; it sets and reads `core.hooksPath`                   |
| `packages/cli/src/lifecycle/log.ts`                    | 158   | move   | `lifecycle/ownership`      | `schema.ts`        | the second `log.ts`; it holds the schema of the ownership file             |
| `packages/cli/src/lifecycle/ownership/apply.ts`        | 130   | keep   | same                       |                    | drops the byte backups                                                     |
| `packages/cli/src/lifecycle/ownership/installs.ts`     | 82    | rename | `lifecycle/ownership`      | `installations.ts` | one word for one concept                                                   |
| `packages/cli/src/lifecycle/ownership/log.ts`          | 212   | keep   | same                       |                    | drops the byte backups, the recovery pruning, and the old-layout migration |
| `packages/cli/src/lifecycle/ownership/owner.ts`        | 150   | keep   | same                       |                    | drops `restore`                                                            |
| `packages/cli/src/lifecycle/ownership/plans.ts`        | 248   | keep   | same                       |                    | retiring a replaced file becomes a plain delete                            |
| `packages/cli/src/lifecycle/ownership/restoration.ts`  | 112   | keep   | same                       |                    | restores merged fields and blocks only                                     |
| `packages/cli/src/lifecycle/policy.ts`                 | 46    | merge  | `commands`                 | `edit.ts`          | its only user                                                              |
| `packages/cli/src/lifecycle/rules/diff.ts`             | 131   | move   | `lifecycle/preview`        | `compare.ts`       | rules means agent rules; the folder holds the dry-run rule preview         |
| `packages/cli/src/lifecycle/rules/eslint-diff.ts`      | 60    | move   | `lifecycle/preview/eslint` | `diff.ts`          | beside the ESLint process it drives                                        |
| `packages/cli/src/lifecycle/rules/gixy.ts`             | 42    | move   | `lifecycle/preview`        | `gixy.ts`          |                                                                            |
| `packages/cli/src/lifecycle/rules/javascript.ts`       | 72    | move   | `lifecycle/preview`        | `javascript.ts`    |                                                                            |
| `packages/cli/src/lifecycle/rules/shellcheck.ts`       | 75    | move   | `lifecycle/preview`        | `shellcheck.ts`    |                                                                            |
| `packages/cli/src/lifecycle/rules/sqlfluff.ts`         | 112   | move   | `lifecycle/preview`        | `sqlfluff.ts`      |                                                                            |
| `packages/cli/src/lifecycle/rules/swiftformat.ts`      | 67    | move   | `lifecycle/preview`        | `swiftformat.ts`   |                                                                            |
| `packages/cli/src/lifecycle/rules/vale.ts`             | 109   | move   | `lifecycle/preview`        | `vale.ts`          |                                                                            |
| `packages/cli/src/lifecycle/version-pin.ts`            | 48    | keep   | same                       |                    | open question in section 1                                                 |
| `packages/cli/src/native/configuration.ts`             | 53    | move   | `lifecycle/preview/eslint` | `client.ts`        | "native" says nothing; this starts the child process                       |
| `packages/cli/src/native/eslint-preview.ts`            | 97    | move   | `lifecycle/preview/eslint` | `declarations.ts`  | it collects the rule declarations                                          |
| `packages/cli/src/native/process.ts`                   | 65    | move   | `lifecycle/preview/eslint` | `worker.ts`        | the child process; its build output is named `configuration.js` today      |
| `packages/cli/src/native/protocol.ts`                  | 22    | move   | `lifecycle/preview/eslint` | `protocol.ts`      |                                                                            |

**`output` and `platform`**

| Now                                        | Lines | Action | Folder after              | File after                  | Why                                                   |
| ------------------------------------------ | ----- | ------ | ------------------------- | --------------------------- | ----------------------------------------------------- |
| `packages/cli/src/output/coverage.ts`      | 21    | merge  | `output`                  | `reporter.ts`               | the second `coverage.ts`                              |
| `packages/cli/src/output/messages.ts`      | 76    | keep   | same                      |                             | drops `reportStorageFailure`                          |
| `packages/cli/src/output/report.ts`        | 162   | delete |                           |                             | owner decision; `node-sarif-builder` goes             |
| `packages/cli/src/output/reporter.ts`      | 215   | keep   | same                      |                             |                                                       |
| `packages/cli/src/platform/arguments.ts`   | 86    | split  | `platform` and `commands` | `quoting.ts` and `flags.ts` | flag helpers belong to the commands                   |
| `packages/cli/src/platform/assets.ts`      | 73    | keep   | same                      |                             | the unused `GRAMMAR_NAMES` goes                       |
| `packages/cli/src/platform/code-points.ts` | 12    | delete |                           |                             | `Array.from`                                          |
| `packages/cli/src/platform/environment.ts` | 59    | keep   | same                      |                             | the uncalled `setEnvironmentVariable` goes            |
| `packages/cli/src/platform/errors.ts`      | 22    | keep   | same                      |                             | gains one constant per exit code                      |
| `packages/cli/src/platform/filesystem.ts`  | 138   | keep   | same                      |                             | gains dispose, `readText`, and a temporary folder     |
| `packages/cli/src/platform/modules.d.ts`   | 15    | move   | `parsers/sql`             | `modules.d.ts`              | its only user                                         |
| `packages/cli/src/platform/paths.ts`       | 182   | keep   | same                      |                             | `buildFolder` moves to its caller in the swift checks |
| `packages/cli/src/platform/root/reads.ts`  | 127   | keep   | same                      |                             |                                                       |
| `packages/cli/src/platform/root/writes.ts` | 167   | keep   | same                      |                             | `afterWrite` becomes `writeAtomically`                |
| `packages/cli/src/platform/safe-paths.ts`  | 89    | keep   | same                      |                             | the old `.gspot` spellings go                         |
| `packages/cli/src/platform/spawn.ts`       | 248   | keep   | same                      |                             | `run` and `runBinary` become one function             |

**`policy`**

| Now                                           | Lines | Action | Folder after      | File after     | Why                                                                     |
| --------------------------------------------- | ----- | ------ | ----------------- | -------------- | ----------------------------------------------------------------------- |
| `packages/cli/src/policy/audit.ts`            | 205   | keep   | same              |                | `shippedPolicy` moves in; cuts `policy` into `checks`                   |
| `packages/cli/src/policy/check-state.ts`      | 65    | keep   | same              |                |                                                                         |
| `packages/cli/src/policy/fields.ts`           | 20    | keep   | same              |                |                                                                         |
| `packages/cli/src/policy/json-schema.ts`      | 79    | keep   | same              |                | open question in section 1                                              |
| `packages/cli/src/policy/merge.ts`            | 126   | keep   | same              |                |                                                                         |
| `packages/cli/src/policy/messages.ts`         | 280   | keep   | same              |                | the kit messages move to `kits`; 16 builders inline (appendix C)        |
| `packages/cli/src/policy/normalize.ts`        | 222   | keep   | same              |                | `compact` moves to the objects module                                   |
| `packages/cli/src/policy/path-problems.ts`    | 53    | merge  | `policy`          | `problems.ts`  | two problem files                                                       |
| `packages/cli/src/policy/problems.ts`         | 154   | keep   | same              |                |                                                                         |
| `packages/cli/src/policy/profiles/export.ts`  | 69    | keep   | same              |                |                                                                         |
| `packages/cli/src/policy/profiles/read.ts`    | 92    | rename | `policy/profiles` | `parse.ts`     | the naming guide has no `read` verb                                     |
| `packages/cli/src/policy/profiles/schema.ts`  | 25    | keep   | same              |                |                                                                         |
| `packages/cli/src/policy/read.ts`             | 232   | keep   | same              |                | the version gate goes                                                   |
| `packages/cli/src/policy/runner.ts`           | 5     | merge  | `policy`          | `schema.ts`    | five lines                                                              |
| `packages/cli/src/policy/schema.ts`           | 286   | keep   | same              |                | absorbs the runner and hooks schemas; `[guides]` becomes `[rules]`      |
| `packages/cli/src/policy/setting-surface.ts`  | 91    | keep   | same              |                | `isDeepStrictEqual`                                                     |
| `packages/cli/src/policy/settings.ts`         | 300   | keep   | same              |                | the plain-object test moves to the objects module                       |
| `packages/cli/src/policy/similar.ts`          | 41    | move   | `platform`        | `text.ts`      | kits and rules below `policy` use it                                    |
| `packages/cli/src/policy/source-locations.ts` | 99    | rename | `policy`          | `positions.ts` | location and position are one concept; open question in section 1       |
| `packages/cli/src/policy/toml/nodes.ts`       | 81    | keep   | same              |                |                                                                         |
| `packages/cli/src/policy/toml/tables.ts`      | 109   | keep   | same              |                |                                                                         |
| `packages/cli/src/policy/toml/width.ts`       | 64    | keep   | same              |                |                                                                         |
| `packages/cli/src/policy/tools.ts`            | 97    | keep   | same              |                | absorbs the Jest coverage schema; cuts `policy` into `checks`           |
| `packages/cli/src/policy/validate.ts`         | 116   | keep   | same              |                |                                                                         |
| `packages/cli/src/policy/weaker.ts`           | 33    | rename | `policy`          | `loosening.ts` | the domain word; open question in section 1                             |
| `packages/cli/src/policy/write.ts`            | 225   | rename | `policy`          | `mutations.ts` | it writes nothing; it builds mutations; the uncalled `appendEntry` goes |
| `packages/cli/src/policy/written-keys.ts`     | 55    | keep   | same              |                |                                                                         |

**`repository`**

| Now                                                       | Lines | Action | Folder after               | File after                    | Why                                                                               |
| --------------------------------------------------------- | ----- | ------ | -------------------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| `packages/cli/src/repository/configuration-section.ts`    | 78    | merge  | `kits`                     | `takeover.ts`                 | only takeover uses it                                                             |
| `packages/cli/src/repository/existing-tooling.ts`         | 284   | split  | `repository` and `kits`    | `survey.ts` and `takeover.ts` | cuts `repository` into `kits` and `lifecycle`; "existing" is filler               |
| `packages/cli/src/repository/git-config.ts`               | 16    | merge  | `platform`                 | `git.ts`                      | one git module                                                                    |
| `packages/cli/src/repository/hook-location.ts`            | 14    | merge  | `platform`                 | `git.ts`                      | the same                                                                          |
| `packages/cli/src/repository/hooks.ts`                    | 8     | merge  | `policy`                   | `schema.ts`                   | eight lines of policy schema                                                      |
| `packages/cli/src/repository/jsonc.ts`                    | 13    | keep   | same                       |                               | the one JSON-with-comments parser; five copies today                              |
| `packages/cli/src/repository/kind.ts`                     | 138   | keep   | same                       |                               | `kindOf` becomes `fileKind`                                                       |
| `packages/cli/src/repository/locked-packages.ts`          | 136   | move   | `checks/general/structure` | `lockfiles.ts`                | its only user is the stale allow-list check                                       |
| `packages/cli/src/repository/manifests.ts`                | 262   | rename | `repository`               | `packages.ts`                 | clashes with the kit manifests                                                    |
| `packages/cli/src/repository/paths.ts`                    | 62    | rename | `repository`               | `selectors.ts`                | clashes with the platform paths                                                   |
| `packages/cli/src/repository/revisions/git-queries.ts`    | 73    | merge  | `platform`                 | `git.ts`                      | one git module                                                                    |
| `packages/cli/src/repository/revisions/push-selection.ts` | 146   | rename | `repository/revisions`     | `push.ts`                     | "selection" adds nothing                                                          |
| `packages/cli/src/repository/revisions/refspecs.ts`       | 126   | keep   | same                       |                               |                                                                                   |
| `packages/cli/src/repository/revisions/selection.ts`      | 97    | rename | `repository/revisions`     | `changes.ts`                  | the staged, changed, and push-base queries; clashes with two other `selection.ts` |
| `packages/cli/src/repository/scopes.ts`                   | 269   | keep   | same                       |                               | takes project-file patterns instead of kit manifests                              |
| `packages/cli/src/repository/tags.ts`                     | 92    | keep   | same                       |                               |                                                                                   |
| `packages/cli/src/repository/tracked.ts`                  | 307   | split  | `repository`               | `tracked.ts` and `sources.ts` | 52 of 70 importers want only the reading half                                     |
| `packages/cli/src/repository/tree.ts`                     | 113   | keep   | same                       |                               |                                                                                   |
| `packages/cli/src/repository/tsconfig.ts`                 | 60    | keep   | same                       |                               |                                                                                   |

**`tools`**

| Now                                              | Lines | Action | Folder after       | File after  | Why                                                                          |
| ------------------------------------------------ | ----- | ------ | ------------------ | ----------- | ---------------------------------------------------------------------------- |
| `packages/cli/src/tools/command.ts`              | 45    | keep   | same               |             |                                                                              |
| `packages/cli/src/tools/inspect.ts`              | 257   | keep   | same               |             | takes pending installs from its caller; cuts `tools` into `lifecycle`        |
| `packages/cli/src/tools/installation.ts`         | 104   | move   | `commands/install` | `steps.ts`  | the install command owns the orchestration                                   |
| `packages/cli/src/tools/installed-files.ts`      | 87    | keep   | same               |             | owns the installed-output types that `lifecycle` imports                     |
| `packages/cli/src/tools/locate.ts`               | 158   | keep   | same               |             |                                                                              |
| `packages/cli/src/tools/mise.ts`                 | 92    | keep   | same               |             |                                                                              |
| `packages/cli/src/tools/packages/commands.ts`    | 208   | keep   | same               |             |                                                                              |
| `packages/cli/src/tools/packages/environment.ts` | 59    | keep   | same               |             |                                                                              |
| `packages/cli/src/tools/packages/identity.ts`    | 78    | keep   | same               |             |                                                                              |
| `packages/cli/src/tools/packages/locks.ts`       | 142   | keep   | same               |             |                                                                              |
| `packages/cli/src/tools/packages/project.ts`     | 197   | keep   | same               |             | takes the owner as a parameter instead of opening one                        |
| `packages/cli/src/tools/packages/yarn.ts`        | 69    | keep   | same               |             |                                                                              |
| `packages/cli/src/tools/pins.ts`                 | 61    | keep   | same               |             |                                                                              |
| `packages/cli/src/tools/python-project.ts`       | 280   | rename | `tools`            | `python.ts` | takes the owner as a parameter                                               |
| `packages/cli/src/tools/vale.ts`                 | 156   | keep   | same               |             | `styleFiles` becomes `installedStyles`; the generator has a `styleFiles` too |

### B.2 `packages/cli/src/checks` and `packages/cli/src/parsers`

The custom analyses follow the kits. A kit at `kits/<category>/<kit>` keeps its analyses in one file,
`checks/<category>/<kit>.ts`, or in a folder of that name when it needs two files or more. One registry, keyed by check
ID, replaces `dispatch.ts`, the 16 `analyses.ts` files, the maps inside the naming and structure engines, and the two
maps in `packages/cli/src/execution/engines.ts`. Code that several kits share goes to the lowest kit that all of them
require, because a kit may only import from kits it requires.

| Shared module                                                      | Users                       | All of them require | Goes to                       |
| ------------------------------------------------------------------ | --------------------------- | ------------------- | ----------------------------- |
| `packages/cli/src/checks/structure/statements.ts`                  | python, swift, bash, sql    | structure           | `checks/general/structure`    |
| `packages/cli/src/checks/structure/imports.ts`                     | trpc, express               | javascript          | `checks/language/javascript`  |
| `packages/cli/src/checks/typescript/tsc.ts`                        | javascript, typescript, vue | javascript          | `checks/language/javascript`  |
| `packages/cli/src/checks/swift/cache.ts` and `plan.ts`             | swift, xctest               | swift               | `checks/language/swift`       |
| `packages/cli/src/checks/postgres/migrations.ts`                   | postgres, supabase          | postgres            | `checks/database/postgres`    |
| `referencedPaths` in `packages/cli/src/checks/docs/stale-paths.ts` | docs, structure             | nothing in common   | `parsers`, as `references.ts` |

In the tables, "Folder after" is relative to `packages/cli/src`, and "registry" means the file's map moves into the one
registry and the file goes.

| Now                                                          | Lines | Action       | Folder after                                          | File after                           | Why                                                                     |
| ------------------------------------------------------------ | ----- | ------------ | ----------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| `packages/cli/src/checks/actions.ts`                         | 90    | move         | `checks/general`                                      | `actions.ts`                         | the new actions kit (appendix A.5)                                      |
| `packages/cli/src/checks/ansible.ts`                         | 50    | move         | `checks/tool`                                         | `ansible.ts`                         |                                                                         |
| `packages/cli/src/checks/cloudflare.ts`                      | 211   | move         | `checks/platform`                                     | `cloudflare.ts`                      | its map goes to the registry                                            |
| `packages/cli/src/checks/commit-messages.ts`                 | 86    | move, rename | `checks/general`                                      | `commits.ts`                         | the kit is commits                                                      |
| `packages/cli/src/checks/css.ts`                             | 150   | move         | `checks/language`                                     | `css.ts`                             |                                                                         |
| `packages/cli/src/checks/dispatch.ts`                        | 73    | merge        | `checks`                                              | `registry.ts`                        | one registry                                                            |
| `packages/cli/src/checks/drizzle.ts`                         | 103   | move         | `checks/library`                                      | `drizzle.ts`                         |                                                                         |
| `packages/cli/src/checks/html.ts`                            | 209   | move         | `checks/language`                                     | `html.ts`                            |                                                                         |
| `packages/cli/src/checks/licenses.ts`                        | 167   | move         | `checks/general`                                      | `licenses.ts`                        | registered under dependencies today                                     |
| `packages/cli/src/checks/locales.ts`                         | 84    | move, rename | `checks/library`                                      | `i18n.ts`                            | the kit is i18n                                                         |
| `packages/cli/src/checks/react-native.ts`                    | 72    | move         | `checks/framework`                                    | `react-native.ts`                    |                                                                         |
| `packages/cli/src/checks/result.ts`                          | 44    | move, rename | `execution`                                           | `finding.ts`                         | `checks` imports `execution`; the model goes to the lower one           |
| `packages/cli/src/checks/sql.ts`                             | 215   | move         | `checks/language`                                     | `sql.ts`                             |                                                                         |
| `packages/cli/src/checks/svelte.ts`                          | 73    | move         | `checks/framework`                                    | `svelte.ts`                          |                                                                         |
| `packages/cli/src/checks/trpc.ts`                            | 31    | move         | `checks/library`                                      | `trpc.ts`                            |                                                                         |
| `packages/cli/src/checks/bash/ast-grep.ts`                   | 60    | move         | `checks/language/bash`                                | `ast-grep.ts`                        |                                                                         |
| `packages/cli/src/checks/bash/boundaries.ts`                 | 109   | move         | `checks/language/bash`                                | `boundaries.ts`                      |                                                                         |
| `packages/cli/src/checks/bash/code-lines.ts`                 | 78    | move         | `checks/language/bash`                                | `code-lines.ts`                      |                                                                         |
| `packages/cli/src/checks/bash/configuration.ts`              | 101   | move, rename | `checks/language/bash`                                | `guards.ts`                          | "configuration" names nothing                                           |
| `packages/cli/src/checks/bash/counts.ts`                     | 56    | merge        | `checks/language/bash`                                | `limits.ts`                          | one check, `bash/limits`                                                |
| `packages/cli/src/checks/bash/file-length.ts`                | 28    | merge        | `checks/language/bash`                                | `limits.ts`                          |                                                                         |
| `packages/cli/src/checks/bash/function-length.ts`            | 29    | merge        | `checks/language/bash`                                | `limits.ts`                          |                                                                         |
| `packages/cli/src/checks/bash/cross-file-index.ts`           | 79    | merge        | `checks/language/bash`                                | `scripts.ts`                         | the index of the scripts in a scope                                     |
| `packages/cli/src/checks/bash/parser.ts`                     | 48    | merge        | `checks/language/bash`                                | `scripts.ts`                         | clashes with the `parsers` folder                                       |
| `packages/cli/src/checks/bash/dead-parameters.ts`            | 81    | move, rename | `checks/language/bash`                                | `unread-arguments.ts`                | the finding says arguments                                              |
| `packages/cli/src/checks/bash/doc-comment.ts`                | 85    | move, rename | `checks/language/bash`                                | `doc-comments.ts`                    |                                                                         |
| `packages/cli/src/checks/bash/duplicate-functions.ts`        | 39    | move         | `checks/language/bash`                                | `duplicate-functions.ts`             |                                                                         |
| `packages/cli/src/checks/bash/env-access-owner.ts`           | 39    | move, rename | `checks/language/bash`                                | `env-owner.ts`                       | owners come only from settings                                          |
| `packages/cli/src/checks/bash/inline.ts`                     | 28    | move, rename | `checks/language/bash`                                | `embeds.ts`                          | it finds embedded runtimes                                              |
| `packages/cli/src/checks/bash/interpreter.ts`                | 211   | move, rename | `checks/language/bash`                                | `contract.ts`                        | it checks header, strict mode, and `main`                               |
| `packages/cli/src/checks/bash/policy.ts`                     | 69    | move, rename | `checks/language/bash`                                | `wrappers.ts`                        | it finds wrappers and aliases                                           |
| `packages/cli/src/checks/bash/remote.ts`                     | 78    | move, rename | `checks/language/bash`                                | `ssh.ts`                             | it finds SSH blocks                                                     |
| `packages/cli/src/checks/bash/safety.ts`                     | 40    | move         | `checks/language/bash`                                | `safety.ts`                          |                                                                         |
| `packages/cli/src/checks/bash/sources.ts`                    | 73    | move         | `checks/language/bash`                                | `sources.ts`                         |                                                                         |
| `packages/cli/src/checks/bash/trivial-function.ts`           | 48    | move, rename | `checks/language/bash`                                | `trivial-functions.ts`               | the plural, like the ESLint rule                                        |
| `packages/cli/src/checks/bash/unused-functions.ts`           | 26    | move         | `checks/language/bash`                                | `unused-functions.ts`                |                                                                         |
| `packages/cli/src/checks/bash/visibility.ts`                 | 84    | move         | `checks/language/bash`                                | `visibility.ts`                      |                                                                         |
| `packages/cli/src/checks/dependencies/analyses.ts`           | 15    | merge        | `checks`                                              | `registry.ts`                        |                                                                         |
| `packages/cli/src/checks/dependencies/install-policy.ts`     | 69    | move, rename | `checks/general/dependencies`                         | `install.ts`                         | "policy" names nothing                                                  |
| `packages/cli/src/checks/dependencies/manifest-policy.ts`    | 105   | move, rename | `checks/general/dependencies`                         | `manifests.ts`                       |                                                                         |
| `packages/cli/src/checks/dependencies/lockfile/fresh.ts`     | 57    | move         | `checks/general/dependencies/lockfile`                | `fresh.ts`                           |                                                                         |
| `packages/cli/src/checks/dependencies/lockfile/hosts.ts`     | 44    | move         | `checks/general/dependencies/lockfile`                | `hosts.ts`                           |                                                                         |
| `packages/cli/src/checks/docker/analyses.ts`                 | 9     | merge        | `checks`                                              | `registry.ts`                        |                                                                         |
| `packages/cli/src/checks/docker/ignore-file.ts`              | 41    | move, rename | `checks/tool/docker`                                  | `dockerignore.ts`                    | named after its check                                                   |
| `packages/cli/src/checks/docker/image-scan.ts`               | 118   | move, rename | `checks/tool/docker`                                  | `trivy-image.ts`                     | named after its check                                                   |
| `packages/cli/src/checks/docs/analyses.ts`                   | 17    | merge        | `checks`                                              | `registry.ts`                        |                                                                         |
| `packages/cli/src/checks/docs/copied-blocks.ts`              | 109   | move, rename | `checks/general`                                      | `duplication.ts`                     | the duplication kit runs it                                             |
| `packages/cli/src/checks/docs/fences.ts`                     | 107   | move, rename | `checks/language`                                     | `markdown.ts`                        | the markdown kit runs it                                                |
| `packages/cli/src/checks/docs/headings.ts`                   | 35    | move         | `checks/general/docs`                                 | `headings.ts`                        |                                                                         |
| `packages/cli/src/checks/docs/readme/present.ts`             | 32    | merge        | `checks/general/docs`                                 | `readme.ts`                          | two small files, one subject                                            |
| `packages/cli/src/checks/docs/readme/shape.ts`               | 77    | merge        | `checks/general/docs`                                 | `readme.ts`                          |                                                                         |
| `packages/cli/src/checks/docs/stale-paths.ts`                | 165   | split        | `checks/general/docs` and `parsers`                   | `stale-paths.ts` and `references.ts` | structure reads the path tokens without requiring docs                  |
| `packages/cli/src/checks/express/analyses.ts`                | 7     | merge        | `checks`                                              | `registry.ts`                        |                                                                         |
| `packages/cli/src/checks/express/routes.ts`                  | 35    | move, rename | `checks/framework`                                    | `express.ts`                         |                                                                         |
| `packages/cli/src/checks/jest/run.ts`                        | 166   | move, rename | `checks/tool`                                         | `jest.ts`                            |                                                                         |
| `packages/cli/src/checks/jest/schema.ts`                     | 12    | merge        | `policy`                                              | `tools.ts`                           | its other user; removes an import from policy into checks               |
| `packages/cli/src/checks/naming/cases.ts`                    | 40    | move         | `checks/general/naming`                               | `cases.ts`                           |                                                                         |
| `packages/cli/src/checks/naming/engine.ts`                   | 202   | move, rename | `checks/general/naming`                               | `identifiers.ts`                     | its map goes to the registry                                            |
| `packages/cli/src/checks/naming/extractors/bash.ts`          | 50    | move         | `checks/general/naming/extractors`                    | `bash.ts`                            | and the same for the other four languages                               |
| `packages/cli/src/checks/naming/extractors/python.ts`        | 102   | move         | `checks/general/naming/extractors`                    | `python.ts`                          |                                                                         |
| `packages/cli/src/checks/naming/extractors/sql.ts`           | 78    | move         | `checks/general/naming/extractors`                    | `sql.ts`                             |                                                                         |
| `packages/cli/src/checks/naming/extractors/swift.ts`         | 83    | move         | `checks/general/naming/extractors`                    | `swift.ts`                           |                                                                         |
| `packages/cli/src/checks/naming/extractors/typescript.ts`    | 103   | move         | `checks/general/naming/extractors`                    | `typescript.ts`                      |                                                                         |
| `packages/cli/src/checks/naming/match.ts`                    | 60    | move         | `checks/general/naming`                               | `match.ts`                           |                                                                         |
| `packages/cli/src/checks/naming/paths.ts`                    | 64    | move         | `checks/general/naming`                               | `paths.ts`                           |                                                                         |
| `packages/cli/src/checks/naming/policy.ts`                   | 199   | move         | `checks/general/naming`                               | `policy.ts`                          |                                                                         |
| `packages/cli/src/checks/naming/split.ts`                    | 31    | move         | `checks/general/naming`                               | `split.ts`                           |                                                                         |
| `packages/cli/src/checks/naming/validate-name.ts`            | 112   | move, rename | `checks/general/naming`                               | `problems.ts`                        | it exports `nameProblems`                                               |
| `packages/cli/src/checks/nextjs/analyses.ts`                 | 12    | merge        | `checks`                                              | `registry.ts`                        |                                                                         |
| `packages/cli/src/checks/nextjs/build.ts`                    | 111   | move         | `checks/framework/nextjs`                             | `build.ts`                           |                                                                         |
| `packages/cli/src/checks/nextjs/source.ts`                   | 99    | move         | `checks/framework/nextjs`                             | `source.ts`                          |                                                                         |
| `packages/cli/src/checks/nginx/config-test.ts`               | 127   | move, rename | `checks/tool/nginx`                                   | `test.ts`                            | "config" is filler                                                      |
| `packages/cli/src/checks/nginx/directives.ts`                | 106   | move         | `checks/tool/nginx`                                   | `directives.ts`                      |                                                                         |
| `packages/cli/src/checks/nginx/test-plan.ts`                 | 50    | move, rename | `checks/tool/nginx`                                   | `arguments.ts`                       | a test plan is an Xcode file elsewhere                                  |
| `packages/cli/src/checks/openapi/analyses.ts`                | 8     | merge        | `checks`                                              | `registry.ts`                        |                                                                         |
| `packages/cli/src/checks/openapi/openapi.ts`                 | 86    | move         | `checks/tool`                                         | `openapi.ts`                         |                                                                         |
| `packages/cli/src/checks/postgres/analyses.ts`               | 21    | merge        | `checks`                                              | `registry.ts`                        |                                                                         |
| `packages/cli/src/checks/postgres/history.ts`                | 112   | move         | `checks/database/postgres`                            | `history.ts`                         |                                                                         |
| `packages/cli/src/checks/postgres/migration-docs.ts`         | 122   | move         | `checks/database/postgres`                            | `migration-docs.ts`                  |                                                                         |
| `packages/cli/src/checks/postgres/migrations.ts`             | 67    | move         | `checks/database/postgres`                            | `migrations.ts`                      | supabase requires postgres                                              |
| `packages/cli/src/checks/postgres/schema/checks.ts`          | 117   | split        | `checks/database/postgres`                            | `access.ts` and `foreign-keys.ts`    | "checks" names nothing                                                  |
| `packages/cli/src/checks/postgres/schema/fields.ts`          | 171   | move, rename | `checks/database/postgres`                            | `schema.ts`                          | it exports `schema()`                                                   |
| `packages/cli/src/checks/prose/banned.ts`                    | 46    | move, rename | `checks/general/prose`                                | `hidden.ts`                          | it finds prose that Vale cannot see                                     |
| `packages/cli/src/checks/prose/vale.ts`                      | 136   | move         | `checks/general/prose`                                | `vale.ts`                            |                                                                         |
| `packages/cli/src/checks/python/analyses.ts`                 | 134   | move, rename | `checks/language/python`                              | `structure.ts`                       | its map goes to the registry; the import-cycle entry goes               |
| `packages/cli/src/checks/python/blocking-calls.ts`           | 62    | delete       |                                                       |                                      | Ruff ASYNC210 to ASYNC251, always on, find the same calls               |
| `packages/cli/src/checks/python/docstrings.ts`               | 59    | move, rename | `checks/language/python`                              | `pydoclint.ts`                       | named by tool                                                           |
| `packages/cli/src/checks/python/exports.ts`                  | 132   | move         | `checks/language/python`                              | `exports.ts`                         |                                                                         |
| `packages/cli/src/checks/python/functions.ts`                | 51    | move         | `checks/language/python`                              | `functions.ts`                       |                                                                         |
| `packages/cli/src/checks/python/imports.ts`                  | 167   | move, trim   | `checks/language/python`                              | `imports.ts`                         | `importCycles` repeats basedpyright `reportImportCycles`, always on     |
| `packages/cli/src/checks/python/modules.ts`                  | 106   | move         | `checks/language/python`                              | `modules.ts`                         |                                                                         |
| `packages/cli/src/checks/python/project.ts`                  | 158   | split        | `checks/language/python`                              | `deptry.ts` and `import-linter.ts`   | "project" names nothing                                                 |
| `packages/cli/src/checks/repository/allowlists-match.ts`     | 138   | move, rename | `checks/general/structure`                            | `stale-allowlists.ts`                | named by what it finds                                                  |
| `packages/cli/src/checks/repository/analyses.ts`             | 17    | merge        | `checks`                                              | `registry.ts`                        |                                                                         |
| `packages/cli/src/checks/repository/files.ts`                | 104   | move, rename | `checks/general/structure`                            | `config-logic.ts`                    | "files" names nothing                                                   |
| `packages/cli/src/checks/repository/generated-drift.ts`      | 19    | move, rename | `checks`                                              | `drift.ts`                           | a built-in check, `gspot/drift`                                         |
| `packages/cli/src/checks/repository/large-files.ts`          | 35    | move         | `checks/general/structure`                            | `large-files.ts`                     |                                                                         |
| `packages/cli/src/checks/repository/suppressions.ts`         | 138   | move, trim   | `checks/general/structure`                            | `suppressions.ts`                    | drop the `gspot-ignore` syntax and the census                           |
| `packages/cli/src/checks/repository/tracked-dependencies.ts` | 32    | move         | `checks/general/structure`                            | `tracked-dependencies.ts`            |                                                                         |
| `packages/cli/src/checks/secrets/history.ts`                 | 57    | move, rename | `checks/general/secrets`                              | `gitleaks-history.ts`                | matches its check                                                       |
| `packages/cli/src/checks/secrets/verified.ts`                | 139   | move, rename | `checks/general/secrets`                              | `trufflehog.ts`                      | matches its check                                                       |
| `packages/cli/src/checks/security/analyses.ts`               | 13    | merge        | `checks`                                              | `registry.ts`                        |                                                                         |
| `packages/cli/src/checks/security/codeql.ts`                 | 146   | move         | `checks/general/security`                             | `codeql.ts`                          |                                                                         |
| `packages/cli/src/checks/security/env/example.ts`            | 68    | move         | `checks/general/files`                                | `env-example.ts`                     | the files kit runs it                                                   |
| `packages/cli/src/checks/security/env/files.ts`              | 23    | move         | `checks/general/secrets`                              | `env-files.ts`                       | the secrets kit runs it                                                 |
| `packages/cli/src/checks/security/gitleaks-baseline.ts`      | 48    | move         | `checks/general/secrets`                              | `gitleaks-baseline.ts`               | the secrets kit runs it                                                 |
| `packages/cli/src/checks/security/sarif.ts`                  | 150   | move         | `checks/general/security`                             | `sarif.ts`                           | reads the CodeQL output; not the deleted report files                   |
| `packages/cli/src/checks/static-site/analyses.ts`            | 28    | merge        | `checks`                                              | `registry.ts`                        |                                                                         |
| `packages/cli/src/checks/static-site/build.ts`               | 142   | move         | `checks/general/static-site`                          | `build.ts`                           |                                                                         |
| `packages/cli/src/checks/static-site/output-checks.ts`       | 244   | move, rename | `checks/general/static-site`                          | `output.ts`                          | "checks" repeats the folder                                             |
| `packages/cli/src/checks/static-site/source-checks.ts`       | 149   | move, rename | `checks/general/static-site`                          | `source.ts`                          | the same                                                                |
| `packages/cli/src/checks/structure/directories.ts`           | 62    | move         | `checks/general/structure`                            | `directories.ts`                     |                                                                         |
| `packages/cli/src/checks/structure/engine.ts`                | 92    | split        | `checks/general/structure` and `checks/language/bash` | `context.ts` and `limits.ts`         | its map goes to the registry                                            |
| `packages/cli/src/checks/structure/file-layout.ts`           | 25    | move, rename | `checks/general/structure`                            | `stem-collisions.ts`                 | named after its check                                                   |
| `packages/cli/src/checks/structure/folder-names.ts`          | 49    | move         | `checks/general/structure`                            | `folder-names.ts`                    | the harness exemption only from settings                                |
| `packages/cli/src/checks/structure/imports.ts`               | 170   | move         | `checks/language/javascript`                          | `imports.ts`                         | its only users require javascript                                       |
| `packages/cli/src/checks/structure/prefix-collisions.ts`     | 91    | move         | `checks/general/structure`                            | `prefix-collisions.ts`               |                                                                         |
| `packages/cli/src/checks/structure/single-file-folder.ts`    | 46    | move, rename | `checks/general/structure`                            | `lone-files.ts`                      | named after its finding                                                 |
| `packages/cli/src/checks/structure/statements.ts`            | 152   | move         | `checks/general/structure`                            | `statements.ts`                      | all four users require structure                                        |
| `packages/cli/src/checks/supabase/admin-key.ts`              | 32    | move         | `checks/platform/supabase`                            | `admin-key.ts`                       |                                                                         |
| `packages/cli/src/checks/supabase/analyses.ts`               | 16    | merge        | `checks`                                              | `registry.ts`                        |                                                                         |
| `packages/cli/src/checks/supabase/config-checks.ts`          | 73    | merge        | `checks/platform/supabase`                            | `project.ts`                         | both read the project file                                              |
| `packages/cli/src/checks/supabase/project.ts`                | 46    | merge        | `checks/platform/supabase`                            | `project.ts`                         |                                                                         |
| `packages/cli/src/checks/supabase/deno.ts`                   | 95    | move         | `checks/platform/supabase`                            | `deno.ts`                            |                                                                         |
| `packages/cli/src/checks/supabase/types-fresh.ts`            | 28    | move         | `checks/platform/supabase`                            | `types-fresh.ts`                     |                                                                         |
| `packages/cli/src/checks/swift/analyses.ts`                  | 63    | move, rename | `checks/language/swift`                               | `structure.ts`                       | the same shape as python                                                |
| `packages/cli/src/checks/swift/bodies.ts`                    | 61    | move         | `checks/language/swift`                               | `bodies.ts`                          |                                                                         |
| `packages/cli/src/checks/swift/build.ts`                     | 162   | move         | `checks/language/swift`                               | `build.ts`                           |                                                                         |
| `packages/cli/src/checks/swift/cache.ts`                     | 128   | move         | `checks/language/swift`                               | `cache.ts`                           | xctest requires swift                                                   |
| `packages/cli/src/checks/swift/lint.ts`                      | 112   | move, rename | `checks/language/swift`                               | `swiftlint.ts`                       | named by tool                                                           |
| `packages/cli/src/checks/swift/order.ts`                     | 92    | move         | `checks/language/swift`                               | `order.ts`                           |                                                                         |
| `packages/cli/src/checks/swift/plan.ts`                      | 57    | move         | `checks/language/swift`                               | `plan.ts`                            | takes `buildFolder` from the platform folder                            |
| `packages/cli/src/checks/swift/sources.ts`                   | 79    | move         | `checks/language/swift`                               | `sources.ts`                         |                                                                         |
| `packages/cli/src/checks/typescript/analyses.ts`             | 9     | merge        | `checks`                                              | `registry.ts`                        |                                                                         |
| `packages/cli/src/checks/typescript/compiler-options.ts`     | 9     | merge        | `checks/language`                                     | `typescript.ts`                      |                                                                         |
| `packages/cli/src/checks/typescript/required-rules.ts`       | 66    | move, rename | `checks/language/javascript`                          | `rules-off.ts`                       | the javascript kit runs it; named by its finding                        |
| `packages/cli/src/checks/typescript/tsc.ts`                  | 142   | move         | `checks/language/javascript`                          | `tsc.ts`                             | the one kit all three users require                                     |
| `packages/cli/src/checks/typescript/tsconfig-options.ts`     | 46    | merge        | `checks/language`                                     | `typescript.ts`                      |                                                                         |
| `packages/cli/src/checks/xcode/analyses.ts`                  | 16    | merge        | `checks`                                              | `registry.ts`                        |                                                                         |
| `packages/cli/src/checks/xcode/project/checks.ts`            | 144   | move, rename | `checks/tool/xcode`                                   | `project.ts`                         |                                                                         |
| `packages/cli/src/checks/xcode/project/reader.ts`            | 262   | move, rename | `checks/tool/xcode`                                   | `pbxproj.ts`                         | named after the format it reads                                         |
| `packages/cli/src/checks/xcode/resources.ts`                 | 95    | move         | `checks/tool/xcode`                                   | `resources.ts`                       |                                                                         |
| `packages/cli/src/checks/xcode/settings-files.ts`            | 82    | move, rename | `checks/tool/xcode`                                   | `settings.ts`                        | "files" is filler                                                       |
| `packages/cli/src/checks/xctest/analyses.ts`                 | 13    | merge        | `checks`                                              | `registry.ts`                        |                                                                         |
| `packages/cli/src/checks/xctest/coverage.ts`                 | 103   | move         | `checks/tool/xctest`                                  | `coverage.ts`                        |                                                                         |
| `packages/cli/src/checks/xctest/line-checks.ts`              | 142   | move, rename | `checks/tool/xctest`                                  | `sources.ts`                         | "checks" repeats the folder                                             |
| `packages/cli/src/checks/xctest/references.ts`               | 51    | move         | `checks/tool/xctest`                                  | `references.ts`                      |                                                                         |
| `packages/cli/src/parsers/comments.ts`                       | 205   | move         | `checks/general/structure`                            | `comments.ts`                        | with inline `gspot-ignore` gone, the suppressions check is its one user |
| `packages/cli/src/parsers/sql/parser.ts`                     | 101   | move, rename | `parsers/sql`                                         | `pg.ts`                              | "parser" repeats the folder                                             |
| `packages/cli/src/parsers/sql/source.ts`                     | 165   | keep         | `parsers/sql`                                         | `source.ts`                          |                                                                         |
| `packages/cli/src/parsers/sql/statements.ts`                 | 72    | keep         | `parsers/sql`                                         | `statements.ts`                      |                                                                         |
| `packages/cli/src/parsers/tree-sitter.ts`                    | 81    | keep         | `parsers`                                             | `tree-sitter.ts`                     | nine kits and the repository tree use it                                |

The constants in `packages/cli/src/config/checks` (10 files, about 2,580 lines with `eslint-levels.json`) and the check
types in `packages/cli/src/types/checks.ts` (378 lines) almost all have one kit as their user. They move into the kit
files above. A few stay shared, with the finding model or in the platform folder: `Finding`, `EngineInput`,
`CheckResult`, `GIT_TIMEOUT_MS`, `SHOWN_LINES`, `HEADER_LINES`, the trivial-statement count, the shell tag, and the
`.gspot` path. `CONFLICT_HELP`, `MOVE_HELP`, and `STRAY_HELP` in `packages/cli/src/config/checks/repository.ts` have no
importer; delete them.

### B.3 Kits, and guides renamed to rules

Each kit keeps its agent rules in its own folder, as `rules/*.md` beside `manifest.toml`. Only the rules that every
repository gets stay apart, in three folders of the CLI package: `agent`, `code`, and `prose`. Most guides name their
kit in their front matter; five do not. The kit tables of rules shrink to five conditional entries in four kits:
Tailwind, Bun, SwiftUI and UIKit, and Playwright. TypeScript stays in `packages/cli/src`, because the kit folders ship to npm as raw
files.

| Now                                                                                  | Files | Action     | After                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------ | ----- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/cli/kits` manifests                                                        | 51    | keep, edit | check IDs start with their kit; `engine` goes; the seven duplicate and placeholder checks go (section 5.3); the `harness_directory` default and the knip entry files of this repository go; `[guides]` becomes `[rules]` with only the conditional entries |
| `packages/cli/kits/language/bash/rules`                                              | 3     | rename     | `ast-grep`, because rules now means agent rules                                                                                                                                                                                                            |
| `packages/cli/kits/language/html/templates.json.tmpl` and `built.json.tmpl`          | 2     | rename     | named after the file each writes, plus `.tmpl`                                                                                                                                                                                                             |
| `packages/cli/kits/language/markdown/configuration.jsonc.tmpl` and `runner.mjs.tmpl` | 2     | rename     | `markdownlint.jsonc.tmpl` and `markdownlint-cli2.mjs.tmpl`                                                                                                                                                                                                 |
| `packages/cli/kits/tool/docker/trivy`                                                | 2     | rename     | `trivy.yaml.tmpl` and `trivy-findings.tpl.tmpl` beside the manifest; the folder goes                                                                                                                                                                       |
| `packages/cli/kits/language/javascript/eslint.config.js.tmpl`                        | 1     | rename     | `eslint.config.mjs.tmpl`, like its target                                                                                                                                                                                                                  |
| the seven Semgrep templates                                                          | 7     | rename     | `semgrep/<kit>.yml.tmpl` in each kit; three naming schemes today                                                                                                                                                                                           |
| `packages/cli/guides/general/agent`, `code`, `prose`                                 | 25    | rename     | `agent`, `code`, `prose` under a `rules` folder of the CLI package                                                                                                                                                                                         |
| `packages/cli/guides/templates/docs`                                                 | 8     | delete     | never installed                                                                                                                                                                                                                                            |
| `packages/cli/guides/language`                                                       | 24    | move       | each language kit, in a `rules` folder with `NAMING.md` and a file named after the language; `YAML.md` to the files kit                                                                                                                                    |
| `packages/cli/guides/framework`                                                      | 15    | move       | each framework kit; SwiftUI and UIKit to the swift kit                                                                                                                                                                                                     |
| `packages/cli/guides/library`                                                        | 7     | move       | each library kit; next-intl to i18n                                                                                                                                                                                                                        |
| `packages/cli/guides/runtime`                                                        | 5     | move       | node and bun to javascript, workers to cloudflare, deno to supabase, browser to static-site                                                                                                                                                                |
| `packages/cli/guides/shared`                                                         | 2     | move       | http to express, i18n to i18n                                                                                                                                                                                                                              |
| `packages/cli/guides/repository`, `database`, and `platform`                         | 3     | move       | the static-site, postgres, and supabase kits                                                                                                                                                                                                               |
| `packages/cli/guides/tool`                                                           | 10    | move       | commitlint to commits, GitHub Actions to the new actions kit, tasks to files, Tailwind to css, Playwright to vitest, the rest to their kits                                                                                                                |

The installed layout puts the base rules in `agent`, `code`, and `prose` inside the installed rules folder, and each
kit in a `<category>/<kit>` folder beside them, so the two never collide. Problems the move fixes:

- Three guides are never installed: `packages/cli/guides/framework/fastapi/FASTAPI.md`,
  `packages/cli/guides/framework/fastapi/RUNTIME.md`, and `packages/cli/guides/framework/nextjs/SECURITY.md`. No
  manifest names them, and fastapi has no rules table at all.
- The front matter of `packages/cli/guides/language/YAML.md` and `packages/cli/guides/tool/tasks/TASKS.md` names a
  `configs` kit, which does not exist; `packages/cli/guides/tool/github-actions/GITHUB-ACTIONS.md` names cloudflare.
- About 20 manifest entries point at `general/agent`, `general/code`, or `general/prose`, which every repository gets
  anyway (`packages/cli/src/agents/assemble.ts:47`). Examples: `TESTING.md` from four test kits. Delete them.

### B.4 `packages/eslint-plugin`

| Now                                                                                   | Lines  | Action     | After                                                                                                                      |
| ------------------------------------------------------------------------------------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `packages/eslint-plugin/src/plugin.ts`                                                | 87     | keep, trim | 22 rules; the index-only special case shrinks to `max-barrel-reexports`                                                    |
| `packages/eslint-plugin/src/rules`, 22 kept rules                                     | ~1,870 | keep       | the same                                                                                                                   |
| `packages/eslint-plugin/src/rules/no-reexports-outside-index.ts`                      | 36     | delete     | never turned on                                                                                                            |
| `packages/eslint-plugin/src/rules/no-harness-barrel-imports.ts`                       | 40     | delete     | inert in every generated configuration; delete `packages/cli/src/generation/eslint/configuration.ts:143` to `:149` with it |
| `packages/eslint-plugin/src/rules/no-export-only-files.ts`                            | 50     | delete     | `no-reexports` covers it                                                                                                   |
| `packages/eslint-plugin/src/rules/import-direction.ts`                                | 158    | trim       | no default roles for `tests/support`, `config`, and `src/env`                                                              |
| `packages/eslint-plugin/src/rules/tests-directory-contents.ts`                        | 62     | trim       | the harness folder becomes required, with no default                                                                       |
| `packages/eslint-plugin/src/rules/env-access-owner.ts`                                | 57     | trim       | owners default to none                                                                                                     |
| `packages/eslint-plugin/src/config/import-direction.ts`                               | 18     | merge      | into the import-direction rule, its one user                                                                               |
| `packages/eslint-plugin/src/config/plugin.ts`                                         | 47     | dissolve   | each constant into the module that reads it                                                                                |
| `packages/eslint-plugin/src/config/rules.ts`                                          | 60     | dissolve   | the same; its section comments already group it                                                                            |
| `packages/eslint-plugin/src/types/plugin.ts`                                          | 22     | merge      | into `definition.ts`, one of its two users                                                                                 |
| `packages/eslint-plugin/src/types/rules.ts`                                           | 73     | dissolve   | each option type into its rule, as typescript-eslint does                                                                  |
| `packages/eslint-plugin/src/function-references.ts`                                   | 121    | merge      | into the no-trivial-functions rule, its one user                                                                           |
| `definition.ts`, `environment.ts`, `files.ts`, `imports.ts`, `layout.ts`, `syntax.ts` | 482    | keep       | shared by 2 to 25 rules                                                                                                    |
| `packages/eslint-plugin/build.ts`                                                     | 80     | keep       | builds ESM and CommonJS                                                                                                    |

### B.5 `tests`

Appendix D.1 maps the tests: five tiers named by what a test needs, `config` and `samples` instead of
`inputs`, `harness` instead of `support`, and no `timings`.

### B.6 `docs`

| Now                                                         | Action     | After                                                                                                                                                     |
| ----------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/package.json`                                         | rename     | `@gspothq/docs`                                                                                                                                           |
| `docs/src/content/reference`                                | keep, edit | check pages move from `/reference/rules/` to `/reference/checks/`; `docs/src/content/reference/collection.ts:55` links the kit schema, not `architecture` |
| `docs/src/content/docs/guides`                              | keep 18    | delete the uninstall page; edit the 10 pages that mention reports, the cache, or `gspot-ignore`                                                           |
| `docs/src/types`                                            | dissolve   | into their one user each                                                                                                                                  |
| `docs/public/brand/readme/tools` and four other brand files | delete     | referenced nowhere                                                                                                                                        |
| `docs/public/brand/diagrams/recovery.svg`                   | delete     | only the uninstall page uses it                                                                                                                           |
| `docs/public/tools`                                         | keep       | the homepage builds these paths when it runs                                                                                                              |

### B.7 The repository root

| Now                                   | Action | After                                                                                                                                                                    |
| ------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `architecture` and `architecture.png` | delete | once this work lands                                                                                                                                                     |
| `UPDATES.md`                          | delete | once this work lands                                                                                                                                                     |
| `dist`, `.ansible`, `.ruff_cache`     | delete | untracked, on this machine only                                                                                                                                          |
| `package.json`                        | rename | `@gspothq/workspace`; regenerate `bun.lock`                                                                                                                              |
| a new `scripts` folder                | create | the launcher from `packages/cli/bin/gspot`, the test tool pins from `packages/cli/scripts/test-tools.ts` with `testToolsText`, and the four runners from `tests/support` |
| `packages/cli/scripts/inputs.ts`      | rename | `grammars.ts`; it prepares the grammar files                                                                                                                             |
| `tsconfig.json`                       | edit   | one alias for the CLI manifest instead of `#package` and `#cli-package`                                                                                                  |
| `mise.toml`                           | edit   | delete `guides:lint`; merge `repo:setup` with `prepare:grammar`, which run the same script; new script paths                                                             |
| `gspot.toml`                          | edit   | `[rules]`; explicit roles and harness folder once the defaults go; delete the guide lint check and the self-exemptions                                                   |

## Appendix C: functions exempted from the tiny-function rule

`gspot/no-trivial-functions` reports a named function of two statements or fewer, counting the statements of callbacks
written inside it. The repository suppresses it 191 times: 122 in `packages/cli/src`, 10 in the plugin, 6 in the docs
site, and 53 in the tests. One `[[ignore]]` in `gspot.toml` also turns it off for all of
`packages/cli/src/policy/messages.ts`. Nothing suppresses `gspot/no-trivial-files`; the matches sit inside test strings.

Each function was read with every caller, found by searching the whole repository. The verdicts:

| Verdict                                           | CLI | Plugin | Docs | Tests | Total |
| ------------------------------------------------- | --- | ------ | ---- | ----- | ----- |
| keep: it names a concept or hides an expression   | 96  | 7      | 5    | 24    | 132   |
| inline at its call sites                          | 11  | 0      | 1    | 13    | 25    |
| merge into a neighbor or its single caller        | 8   | 3      | 0    | 11    | 22    |
| replace with a standard function or shared helper | 3   | 0      | 0    | 4     | 7     |
| delete                                            | 1   | 0      | 0    | 0     | 1     |
| goes with a deleted feature                       | 3   | 0      | 0    | 1     | 4     |

Doing all of it removes 56 suppressions and leaves 135: the 132 kept, and three that the merges leave behind. Those
three are one signal listener, one parser of generated files, and one builder of tracked files in the tests.

Reasons to rewrite, because they are not true:

- **They cite tests as a caller:** `head`, `internalLinks`, `hasCase`, `buildFolder`, `readProfile`, and the
  `messages.ts` entry in `gspot.toml`.
- **They claim one owner, and the same code exists elsewhere:** `toolDeadlineSeconds`, `asRecord`, `asRaw`,
  `scopeName`, and `trivialFunctionText`.
- **They count callers that do not exist:** `toolDeadlineSeconds` names two modules and has one. `readAsset` claims 20
  callers and has 11. `testManifest` claims two test files and ten calls, and has one file with 6 calls.
- **They name callers that go with the deletions, or never existed:** `sideFolders` names a removal, `hooksInstalled`
  and `ownHooksPath` name uninstall, and `reportStorageFailure` names the cache and the reports.
- **They claim a complexity limit that inlining does not reach:** `presenceDrift`; its caller is at 5 of 8.
- **Their counts are wrong:** `cliSource` (4 files, not 5), the release test `execute` (6 runs, not 4), and
  `astroSandbox` (3 call sites, not 4).
- **They pass arguments through unchanged:** `totalStatements`.
- About 15 reasons say that one owner keeps a value, or that something is done this one way. Where the verdict is
  keep, the real reason is the number of callers.

Two test cases show why users will hit the rule. `tests/acceptance/source/kits/react.test.ts:26` and `:29` suppress both
tiny rules in a clean React component. `tests/inputs/acceptance/source/kits/kits.ts:154` suppresses the tiny-file rule
in a clean Nest module. Real React and Nest code needs the same suppressions.

### C.1 `packages/cli/src`

| Where                                                      | Function                  | Callers                                                | Verdict | What to do                                                                                                                                                                 |
| ---------------------------------------------------------- | ------------------------- | ------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/cli/src/repository/tracked.ts:79`                | `isOutsideGit`            | 5 in the file                                          | keep    | hides a three-part test: exit code, stderr prefix, no `.git`                                                                                                               |
| `packages/cli/src/repository/tracked.ts:283`               | `head`                    | 1, `packages/cli/src/commands/doctor/changes.ts:59`    | inline  | write `readPrefix(root, path, CHANGE_HEAD_BYTES).toString('utf8')` at the call; the tests call `readPrefix`; the reason cites tests                                        |
| `packages/cli/src/repository/paths.ts:47`                  | `isInScope`               | 7 in 6 files                                           | keep    | the scope rule, where `''` is the root                                                                                                                                     |
| `packages/cli/src/repository/manifests.ts:203`             | `normalizedPythonPackage` | 9 in 5 files                                           | keep    | PEP 503 name normalization                                                                                                                                                 |
| `packages/cli/src/repository/scopes.ts:16`                 | `workspaceEntry`          | 3                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/repository/kind.ts:72`                   | `isValePackageFile`       | 5                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/repository/kind.ts:135`                  | `isEnvironmentFile`       | 2                                                      | keep    | hides "an env file, but not a template"                                                                                                                                    |
| `packages/cli/src/repository/revisions/git-queries.ts:33`  | `gitValue`                | 7                                                      | keep    | one of the `gitText` and `gitLines` family                                                                                                                                 |
| `packages/cli/src/repository/revisions/git-queries.ts:69`  | `isShallow`               | 2                                                      | keep    | names a git question                                                                                                                                                       |
| `packages/cli/src/parsers/sql/parser.ts:88`                | `textOf`                  | about 17                                               | keep    |                                                                                                                                                                            |
| `packages/cli/src/parsers/sql/parser.ts:98`                | `partsOf`                 | 4                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/tools/inspect.ts:83`                     | `missingInspection`       | 2                                                      | keep    | builds the "missing" state; the caller is near the complexity limit                                                                                                        |
| `packages/cli/src/tools/inspect.ts:132`                    | `isInstallationPending`   | 2                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/tools/packages/project.ts:42`            | `isCurrentLock`           | 4                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/tools/command.ts:42`                     | `toolDeadlineSeconds`     | 2, both in `packages/cli/src/execution/tool/runner.ts` | inline  | write `view?.limit('tool_seconds') ?? TOOL_DEADLINE.default`, which `packages/cli/src/tools/command.ts:28` and `packages/cli/src/execution/fixers.ts:59` already write out |
| `packages/cli/src/kits/select.ts:54`                       | `requireChain`            | 2                                                      | merge   | give `chainFrom` a default `seen = new Set()` and export it under this name                                                                                                |
| `packages/cli/src/kits/select.ts:80`                       | `selectForScope`          | 5                                                      | keep    | the scope inheritance rule                                                                                                                                                 |
| `packages/cli/src/kits/select.ts:97`                       | `languageKits`            | 2, both in `packages/cli/src/checks/naming/engine.ts`  | inline  | `selected.filter((m) => m.kit.kind === 'language')`                                                                                                                        |
| `packages/cli/src/kits/select.ts:107`                      | `sourceKits`              | 3                                                      | keep    | names "language or framework"                                                                                                                                              |
| `packages/cli/src/kits/manifest-problems.ts:211`           | `manifestError`           | 15                                                     | keep    | the reason says twelve                                                                                                                                                     |
| `packages/cli/src/kits/targets.ts:24`                      | `scopeFile`               | 2                                                      | replace | `posix.join(GSPOT_DIRECTORY, scope, name)` gives the same result, `''` included                                                                                            |
| `packages/cli/src/kits/manifests.ts:142`                   | `gitignoreBlock`          | 2                                                      | keep    | `init` and `apply` must write the same block; drop the `manifests` parameter, which only tests pass                                                                        |
| `packages/cli/src/checks/result.ts:41`                     | `findingAt`               | about 176                                              | keep    |                                                                                                                                                                            |
| `packages/cli/src/checks/xcode/project/checks.ts:11`       | `folderOf`                | 2                                                      | keep    | needs a trailing slash and `''` at the root, which `posix.dirname` does not give                                                                                           |
| `packages/cli/src/checks/static-site/output-checks.ts:163` | `internalLinks`           | 1, the analysis table                                  | inline  | table entry `(input) => brokenLinks(input, false)`; export `brokenLinks`; the reason cites tests                                                                           |
| `packages/cli/src/checks/static-site/output-checks.ts:173` | `externalLinks`           | 1, the analysis table                                  | inline  | the same, with `true`                                                                                                                                                      |
| `packages/cli/src/checks/xcode/resources.ts:82`            | `stringFiles`             | 1, the analysis table                                  | merge   | fold in `stringFindings`, whose only caller it is                                                                                                                          |
| `packages/cli/src/checks/xcode/project/reader.ts:91`       | `is` (closure)            | 6                                                      | keep    | closes over the moving cursor                                                                                                                                              |
| `packages/cli/src/checks/python/modules.ts:6`              | `isDocstring`             | 2                                                      | keep    | hides a tree-sitter shape                                                                                                                                                  |
| `packages/cli/src/checks/python/modules.ts:53`             | `assignmentOf`            | 2                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/checks/xctest/references.ts:4`           | `escapePattern`           | 2                                                      | replace | `RegExp.escape`, once `packages/cli/package.json` requires Node 24 like the root; `packages/cli/src/checks/security/env/example.ts:16` writes the same escaping by hand    |
| `packages/cli/src/checks/bash/parser.ts:45`                | `functionAt`              | 6 in 5 files                                           | keep    |                                                                                                                                                                            |
| `packages/cli/src/checks/bash/code-lines.ts:36`            | `withoutComment`          | 8                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/checks/bash/code-lines.ts:72`            | `isDirectoryConstant`     | 3                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/checks/supabase/deno.ts:24`              | `denoFileArguments`       | 2                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/checks/postgres/schema/checks.ts:91`     | `explicitGrants`          | 1, the analysis table                                  | keep    | it is the check: rule ID, text, and predicate                                                                                                                              |
| `packages/cli/src/checks/postgres/schema/checks.ts:112`    | `definerSearchPath`       | 1, the analysis table                                  | keep    | the same                                                                                                                                                                   |
| `packages/cli/src/checks/postgres/schema/fields.ts:6`      | `qualified`               | 4                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/checks/swift/plan.ts:7`                  | `text`                    | 3                                                      | keep    | narrows `unknown` to a string                                                                                                                                              |
| `packages/cli/src/checks/naming/policy.ts:22`              | `toSet`                   | 3                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/checks/naming/policy.ts:27`              | `compileRule`             | 2                                                      | keep    | maps 10 fields                                                                                                                                                             |
| `packages/cli/src/checks/naming/policy.ts:43`              | `writtenRule`             | 2                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/checks/naming/policy.ts:66`              | `numberSetting`           | 2, both inside `ceiling`                               | merge   | `ceiling` reads the two keys in order itself                                                                                                                               |
| `packages/cli/src/checks/naming/policy.ts:82`              | `ceiling` (closure)       | 2                                                      | keep    | closes over five values                                                                                                                                                    |
| `packages/cli/src/checks/naming/policy.ts:106`             | `shippedPolicy`           | 3                                                      | keep    | parsed once and cached                                                                                                                                                     |
| `packages/cli/src/checks/naming/cases.ts:37`               | `hasCase`                 | 2                                                      | keep    | the public face of the private `CHECKS` map; the reason cites tests                                                                                                        |
| `packages/cli/src/checks/naming/extractors/python.ts:29`   | `holderOf`                | 2                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/checks/structure/statements.ts:148`      | `trivialFunctionText`     | 4                                                      | keep    | the reason says five engines, there are four; the ESLint rule writes the same message on its own                                                                           |
| `packages/cli/src/checks/structure/directories.ts:9`       | `directoryOf`             | 4                                                      | keep    | rename: `packages/cli/src/platform/arguments.ts` has another `directoryOf`                                                                                                 |
| `packages/cli/src/platform/environment.ts:9`               | `isCi`                    | 4                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/platform/safe-paths.ts:75`               | `privateTarget`           | 2                                                      | keep    | a guard that throws                                                                                                                                                        |
| `packages/cli/src/platform/safe-paths.ts:85`               | `mutationTarget`          | about 11                                               | keep    |                                                                                                                                                                            |
| `packages/cli/src/platform/arguments.ts:43`                | `textFlag`                | 5                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/platform/arguments.ts:55`                | `listFlag`                | 6                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/platform/arguments.ts:66`                | `directoryOf`             | 16                                                     | keep    |                                                                                                                                                                            |
| `packages/cli/src/platform/arguments.ts:78`                | `textEntry`               | 8                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/platform/spawn.ts:50`                    | `notFound`                | 3                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/platform/assets.ts:28`                   | `packageRoot`             | 3                                                      | keep    | memoized                                                                                                                                                                   |
| `packages/cli/src/platform/assets.ts:41`                   | `readAsset`               | 11                                                     | keep    | the reason says 20                                                                                                                                                         |
| `packages/cli/src/platform/paths.ts:94`                    | `toPosix`                 | about 36                                               | keep    |                                                                                                                                                                            |
| `packages/cli/src/platform/paths.ts:105`                   | `toolPath`                | 12                                                     | keep    |                                                                                                                                                                            |
| `packages/cli/src/platform/paths.ts:115`                   | `toPlatform`              | 6                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/platform/paths.ts:125`                   | `baseName`                | 7                                                      | replace | `posix.basename`, which does what the reason describes; `packages/cli/src/repository/kind.ts:137` and `packages/cli/src/repository/scopes.ts:19` repeat the slice          |
| `packages/cli/src/platform/paths.ts:149`                   | `buildFolder`             | 1                                                      | keep    | hides the path hash the tests must match; move it beside its caller in `packages/cli/src/checks/swift/plan.ts`; the reason cites tests                                     |
| `packages/cli/src/output/messages.ts:25`                   | `configureOutput`         | 1                                                      | keep    | sets private module state                                                                                                                                                  |
| `packages/cli/src/output/messages.ts:53`                   | `fail`                    | 3                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/output/messages.ts:63`                   | `reportStorageFailure`    | 3, all in deleted files                                | delete  | its callers are the result cache and the report files                                                                                                                      |
| `packages/cli/src/output/messages.ts:73`                   | `print`                   | 4                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/output/reporter.ts:22`                   | `seconds`                 | 2                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/output/reporter.ts:27`                   | `fileCount`               | 2                                                      | merge   | it is `counted(n, 'file')`                                                                                                                                                 |
| `packages/cli/src/output/reporter.ts:32`                   | `scopeName`               | 2                                                      | inline  | `check.scope \|\| 'root'`, which line 213 of the same file and 7 other files already write out                                                                             |
| `packages/cli/src/output/reporter.ts:140`                  | `counted`                 | 4                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/lifecycle/drift.ts:21`                   | `patch`                   | 2                                                      | keep    | hides the diff settings                                                                                                                                                    |
| `packages/cli/src/lifecycle/drift.ts:69`                   | `presenceDrift`           | 2, both in `otherDrift`                                | merge   | one loop over merges and configurations in `otherDrift`; the complexity claim is false                                                                                     |
| `packages/cli/src/lifecycle/hooks.ts:16`                   | `ownHooksPath`            | 4                                                      | keep    | drop "uninstall" from the reason                                                                                                                                           |
| `packages/cli/src/lifecycle/hooks.ts:91`                   | `hooksInstalled`          | 1 after uninstall goes                                 | inline  | `readGitSetting(repository.root, 'core.hooksPath') === path` in `hookStatus`                                                                                               |
| `packages/cli/src/lifecycle/ownership/installs.ts:7`       | `sideFolders`             | 2                                                      | keep    | the reason names a removal caller that does not exist                                                                                                                      |
| `packages/cli/src/lifecycle/ownership/log.ts:132`          | `identity`                | about 14 in 4 files                                    | keep    |                                                                                                                                                                            |
| `packages/cli/src/execution/planning/plan.ts:164`          | `isActive`                | 2                                                      | keep    | drop the `export`                                                                                                                                                          |
| `packages/cli/src/execution/files/batches.ts:9`            | `argumentSize`            | 2                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/execution/engines.ts:26`                 | `toolCheck`               | 1                                                      | inline  | `return (session, planned) => runToolCheck(session, planned);`                                                                                                             |
| `packages/cli/src/execution/broken-tool.ts:113`            | `hasToolError`            | 2                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/execution/output/parse.ts:35`            | `compiled`                | 4                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/execution/output/parse.ts:202`           | `parseOutput`             | 2                                                      | merge   | fold in `parseRaw`, whose only caller it is                                                                                                                                |
| `packages/cli/src/commands/list.ts:18`                     | `scopeTag`                | 3                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/commands/explain/subjects.ts:15`         | `listLine`                | 7                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/commands/init/settings.ts:16`            | `firstMatch`              | 2                                                      | keep    | inlining pushes `detectedValue` over the complexity limit                                                                                                                  |
| `packages/cli/src/commands/check/command.ts:109`           | `cancel` (closure)        | 4 references                                           | keep    | `removeListener` needs the same function                                                                                                                                   |
| `packages/cli/src/commands/init/detection.ts:6`            | `row`                     | 10                                                     | keep    |                                                                                                                                                                            |
| `packages/cli/src/commands/explain/checks.ts:56`           | `toolOf`                  | 4                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/policy/source-locations.ts:24`           | `keyLocations`            | 3                                                      | inline  | call `valueLocations` directly; the mutual recursion becomes plain recursion, which the rule allows                                                                        |
| `packages/cli/src/policy/source-locations.ts:77`           | `policyLocation`          | 4                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/policy/read.ts:70`                       | `ownerOf`                 | 4                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/policy/read.ts:215`                      | `hasPolicy`               | 3                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/policy/settings.ts:36`                   | `plainIfPresent`          | 6                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/policy/settings.ts:196`                  | `asRecord`                | 12                                                     | keep    | make it the one check for a plain object; it lets arrays through, while `asRaw` and four private `isTable` copies reject them                                              |
| `packages/cli/src/policy/fields.ts:16`                     | `reasoned`                | 10                                                     | keep    |                                                                                                                                                                            |
| `packages/cli/src/policy/problems.ts:16`                   | `located`                 | 9                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/policy/check-state.ts:44`                | `repositoryCheckSpec`     | 2                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/policy/normalize.ts:51`                  | `defaulted`               | 6                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/policy/normalize.ts:68`                  | `compact`                 | about 18                                               | keep    |                                                                                                                                                                            |
| `packages/cli/src/policy/normalize.ts:78`                  | `compactAll`              | 3                                                      | inline  | `(x ?? []).map((e) => compact(e))`                                                                                                                                         |
| `packages/cli/src/policy/normalize.ts:150`                 | `normalizeArchitecture`   | 2                                                      | keep    | drop the `export`                                                                                                                                                          |
| `packages/cli/src/policy/normalize.ts:161`                 | `normalizeStructure`      | 2                                                      | inline  | a `STRUCTURE_DEFAULTS` constant and `defaulted(raw.structure, STRUCTURE_DEFAULTS)`                                                                                         |
| `packages/cli/src/policy/normalize.ts:219`                 | `asRaw`                   | 10                                                     | merge   | into `asRecord`, with the array check; the reason claims one owner of a test written four more times                                                                       |
| `packages/cli/src/policy/profiles/schema.ts:20`            | `isRepositoryPath`        | 3                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/policy/profiles/read.ts:89`              | `readProfile`             | 1                                                      | merge   | fold in `profileText`, whose only caller it is; the reason cites tests                                                                                                     |
| `packages/cli/src/generation/templates.ts:45`              | `byDepth`                 | 2                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/generation/json-format.ts:67`            | `jsonText`                | 2                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/generation/formatting/selectors.ts:12`   | `rebasePattern`           | 2                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/generation/formatting/selectors.ts:73`   | `mapPattern` (closure)    | 2                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/generation/formatting/selectors.ts:87`   | `literalGlob`             | 3                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/generation/formatting/selectors.ts:104`  | `fromGeneratedFile`       | 4                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/generation/vale-styles.ts:54`            | `styleNames`              | 2                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/generation/hooks.ts:51`                  | `hookLine`                | 2                                                      | keep    | the hook and its check must name the same command                                                                                                                          |
| `packages/cli/src/generation/eslint/configuration.ts:136`  | `limitsOf`                | 2                                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/generation/eslint/configuration.ts:153`  | `eslintSettings`          | 1                                                      | keep    | four `??` would push the caller over the limit                                                                                                                             |
| `packages/cli/src/generation/formatting/settings.ts:76`    | `prettierOptions`         | 2                                                      | keep    | drop the `export`                                                                                                                                                          |
| `packages/cli/src/generation/formatting/settings.ts:104`   | `fromConfig` (closure)    | passed as a value                                      | keep    |                                                                                                                                                                            |
| `packages/cli/src/agents/lint.ts:166`                      | `isRulePath`              |                                                        | goes    | with the guide linter                                                                                                                                                      |
| `packages/cli/src/execution/cache.ts:42`                   | `cacheKey`                |                                                        | goes    | with the result cache                                                                                                                                                      |
| `packages/cli/src/execution/cache.ts:56`                   | `fileHash`                |                                                        | goes    | with the result cache                                                                                                                                                      |

`packages/cli/src/policy/messages.ts` holds 26 message builders under one file-wide exemption whose reason cites
`tests/unit/cli/policy/messages.test.ts`. Sixteen have one caller; write their text at that caller: `unknownKey`,
`kitNotListed`, `dirtyTree`, `circularRequires`, `extraCoversSlot`, `extraNeedsReason`, `conflictingScalars`,
`weakerNeedsReason`, `groupNotRemovable`, `versionMismatch`, `versionUnsupported`, `checkEntryIncomplete`,
`limitUnknown`, `settingInScope`, `unreadableValue`, and `quotedTable`. Ten are shared wording; keep them, each with
its own suppression: `refusedReason` (6 callers), `unknownKit` (5), `missingReason` (3), `scopeMissing` (3),
`settingNotExposed` (3), `fileMissing` (2), `tomlSyntax` (2), `withoutRequired` (2), `ruleOffRefused` (2), and
`unknownCheck` (2). Then delete the `[[ignore]]` entry.

### C.2 `packages/eslint-plugin`

The plugin suppresses its own rule ten times.

| Where                                                         | Function          | Callers        | Verdict | What to do                                                                                                                                                                   |
| ------------------------------------------------------------- | ----------------- | -------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/eslint-plugin/src/definition.ts:13`                 | `createRule`      | 25 rules       | keep    | hides the repeated defaults                                                                                                                                                  |
| `packages/eslint-plugin/src/definition.ts:35`                 | `optionsSchema`   | 19 in 18 files | keep    | hides `additionalProperties: false` and the conditional `required`                                                                                                           |
| `packages/eslint-plugin/src/syntax.ts:31`                     | `totalStatements` | 2              | merge   | a pass-through: rename the private `count` to `totalStatements` and export it                                                                                                |
| `packages/eslint-plugin/src/imports.ts:17`                    | `isRequireCall`   | 2              | keep    | export it and use it in `packages/eslint-plugin/src/rules/import-direction.ts:143` and `packages/eslint-plugin/src/rules/private-before-public.ts:24`, which repeat the test |
| `packages/eslint-plugin/src/files.ts:51`                      | `isIndexFile`     | 5 rules        | keep    |                                                                                                                                                                              |
| `packages/eslint-plugin/src/files.ts:101`                     | `relativeToRoot`  | 8 rules        | keep    |                                                                                                                                                                              |
| `packages/eslint-plugin/src/files.ts:111`                     | `staticString`    | 7 rules        | keep    | `ASTUtils.getStringIfConstant` also accepts template literals and numbers                                                                                                    |
| `packages/eslint-plugin/src/rules/import-direction.ts:26`     | `roleOf`          | 2              | merge   | with `relativeOf` into one `roleAt(absolute)` closure                                                                                                                        |
| `packages/eslint-plugin/src/rules/import-direction.ts:110`    | `relativeOf`      | 2              | merge   | the same merge                                                                                                                                                               |
| `packages/eslint-plugin/src/rules/no-trivial-functions.ts:39` | `isRequired`      | 1              | keep    | inlining takes the handler from 4 to 9 against a limit of 8                                                                                                                  |

### C.3 The docs site

| Where                                          | Function        | Callers          | Verdict | What to do                                                                                          |
| ---------------------------------------------- | --------------- | ---------------- | ------- | --------------------------------------------------------------------------------------------------- |
| `docs/src/content/reference/page.ts:13`        | `referencePage` | 8 in 4 files     | keep    |                                                                                                     |
| `docs/src/content/reference/page.ts:32`        | `section`       | 12 in 3 files    | keep    | hides the rule for an empty body                                                                    |
| `docs/src/content/reference/page.ts:52`        | `cell`          | 7 in 3 files     | keep    | the escaping rule                                                                                   |
| `docs/src/content/reference/policy.ts:38`      | `schemaCell`    | 4                | keep    | hides the HTML and pipe escaping                                                                    |
| `docs/src/content/reference/policy.ts:83`      | `comparable`    | 1 line, twice    | inline  | `isDeepStrictEqual` on both settings with `default`, `default_all`, and `detect` set to `undefined` |
| `docs/src/pages/schema/gspot.schema.json.ts:9` | `GET`           | the Astro router | keep    | Astro requires the handler                                                                          |

### C.4 The tests

In tests, a small helper shared by many files earns its name; a helper with one caller does not.

| Where                                                                       | Function                | Callers         | Verdict | What to do                                                                                                          |
| --------------------------------------------------------------------------- | ----------------------- | --------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/plugin/rules/max-barrel-reexports.test.ts:4`                    | `lines`                 | 5               | inline  | one array of 20 exports and `.slice(0, n).join('\n')`; the reason about nested templates holds for 1 of 5 sites     |
| `tests/unit/cli/kits/owners.test.ts:10`                                     | `file`                  | 24              | merge   | one shared tracked-file builder in `tests/support`, which also replaces the copies in the next two files named here |
| `tests/unit/cli/checks/prose/grammars.test.ts:5`                            | `tracked`               | 16              | merge   | the shared tracked-file builder                                                                                     |
| `tests/unit/cli/commands/detected-settings.test.ts:10`                      | `file`                  | 8               | merge   | the shared tracked-file builder                                                                                     |
| `tests/unit/cli/commands/detected-settings.test.ts:8`                       | `selected`              | 3               | inline  | `[manifests.get('x')!]`                                                                                             |
| `tests/unit/cli/commands/detected-settings.test.ts:19`                      | `fields`                | 7               | keep    | seven fields of test data                                                                                           |
| `tests/unit/cli/kits/manifests/declarations.test.ts:15`                     | `selectorDefinition`    | 2               | inline  | a constant prefix plus a suffix at each case, as the first test in the file does                                    |
| `tests/unit/cli/kits/manifests/declarations.test.ts:42`                     | `pinnedSecurity`        | 2               | inline  | the same                                                                                                            |
| `tests/unit/cli/kits/manifests/declarations.test.ts:63`                     | `roleDefinition`        | 2               | inline  | the same                                                                                                            |
| `tests/unit/cli/kits/manifests/declarations.test.ts:74`                     | `toolPageDefinition`    | 3               | inline  | the same                                                                                                            |
| `tests/unit/cli/kits/manifests/declarations.test.ts:95`                     | `suppressionDefinition` | 3               | inline  | the same                                                                                                            |
| `tests/unit/cli/checks/postgres/schema-fields.test.ts:6`                    | `migration`             | 7               | merge   | one shared `migration(name, text, version?)` with the next file                                                     |
| `tests/unit/cli/checks/postgres/migration-docs.test.ts:8`                   | `migration`             | 2               | merge   | the same                                                                                                            |
| `tests/unit/cli/checks/naming/validate-name.test.ts:70`                     | `identifier`            | 16              | keep    |                                                                                                                     |
| `tests/unit/cli/agents/lint.test.ts:4`                                      | `file`                  | 5               | goes    | with the guide linter                                                                                               |
| `tests/integration/tools/swift-build.test.ts:20`                            | `inputFor`              | 8               | keep    | pairs the cleanup with the session                                                                                  |
| `tests/integration/tools/generation/sqlfluff.test.ts:32`                    | `run`                   | 2               | inline  | the arguments in a constant and `Bun.spawnSync` twice                                                               |
| `tests/integration/tools/generation/ruff.test.ts:116`                       | `run`                   | 5               | keep    |                                                                                                                     |
| `tests/integration/tools/generation/spelling.test.ts:93`                    | `run`                   | 6               | keep    |                                                                                                                     |
| `tests/integration/docs/release.test.ts:43`                                 | `execute`               | 6               | keep    | the reason says four                                                                                                |
| `tests/integration/cli/repository/staged.test.ts:9`                         | `git`                   | about 21        | replace | `gitOutput` from `tests/support/cli/git.ts`, which also sets the throwaway identity                                 |
| `tests/integration/cli/execution/index.test.ts:11`                          | `git`                   | 4               | replace | `gitOutput`                                                                                                         |
| `tests/integration/cli/execution/impact.test.ts:52`                         | `git`                   | 5               | replace | `gitOutput`                                                                                                         |
| `tests/acceptance/source/cli/changed.test.ts:15`                            | `commit`                | 5               | replace | `commitAll`; the file also has a fourth copy of the `git` helper                                                    |
| `tests/integration/cli/checks/codeql-execution.test.ts:26`                  | `policy`                | 2               | inline  | the `policyOf(...)` call at both sites                                                                              |
| `tests/integration/cli/lifecycle/hooks.test.ts:12`                          | `hooksOf`               | 7               | keep    |                                                                                                                     |
| `tests/integration/cli/lifecycle/ownership/recovery/replacement.test.ts:75` | `recovered`             | 4               | keep    |                                                                                                                     |
| `tests/integration/cli/execution/tool-runner/adapters.test.ts:10`           | `versionScript`         | 2               | keep    | it absorbs `versionCommand`                                                                                         |
| `tests/integration/cli/execution/tool-runner/adapters.test.ts:70`           | `versionCommand`        | 3               | merge   | into `versionScript(v, false)`                                                                                      |
| `tests/integration/cli/execution/tool-runner/adapters.test.ts:99`           | `exitScript`            | 3               | inline  | two constants, pass and fail                                                                                        |
| `tests/integration/cli/generation/shared-settings.test.ts:13`               | `knipConfiguration`     | 2               | merge   | one `generatedConfig(policy, path)` that parses JSON or TOML; three suppressions become one                         |
| `tests/integration/cli/generation/shared-settings.test.ts:24`               | `stylelintAtRules`      | 3               | merge   | the same                                                                                                            |
| `tests/integration/cli/generation/shared-settings.test.ts:30`               | `ruffLint`              | 4               | merge   | the same                                                                                                            |
| `tests/acceptance/source/kits/react.test.ts:23`                             | `head`                  | 6               | keep    |                                                                                                                     |
| `tests/acceptance/source/kits/fastapi.test.ts:22`                           | `PROJECT`               | 2               | inline  | a constant plus `.replace('["pytest"]', '["fastapi"]')`                                                             |
| `tests/acceptance/source/kits/fastapi.test.ts:25`                           | `ROUTE`                 | 2               | inline  | a constant plus `.replace`                                                                                          |
| `tests/acceptance/source/kits/astro.test.ts:16`                             | `astroSandbox`          | 3               | inline  | a constant for the sandbox options, spread at 3 sites                                                               |
| `tests/support/expectations.ts:43`                                          | `containing`            | 156 in 73 files | keep    | the Bun matchers are typed `any`                                                                                    |
| `tests/support/expectations.ts:53`                                          | `containingAll`         | 29 in 19 files  | keep    | the same                                                                                                            |
| `tests/support/expectations.ts:63`                                          | `textContaining`        | 61 in 39 files  | keep    | the same                                                                                                            |
| `tests/support/plugin/tester.ts:21`                                         | `tester`                | 26 in 25 files  | keep    |                                                                                                                     |
| `tests/support/cli/init.ts:10`                                              | `initArgs`              | 10 files        | keep    |                                                                                                                     |
| `tests/support/cli/process.ts:27`                                           | `cliSource`             | 7 in 4 files    | keep    | the reason says five files                                                                                          |
| `tests/support/cli/tooling.ts:24`                                           | `testManifest`          | 6 in 1 file     | keep    | move it into its one caller, `tests/unit/cli/kits/select.test.ts`, and rewrite the reason                           |
| `tests/support/cli/preservation.ts:99`                                      | `restore`               | 2               | keep    | its return value is part of the contract of `plant()`                                                               |
| `tests/support/cli/pins.ts:10`                                              | `libraryPin`            | 9 in 3 files    | keep    |                                                                                                                     |
| `tests/support/cli/pins.ts:22`                                              | `commandPin`            | 19 in 3 files   | keep    |                                                                                                                     |
| `tests/support/cli/platforms.ts:45`                                         | `venvExecutable`        | 13 in 4 files   | keep    | hides the Windows layout                                                                                            |
| `tests/support/cli/git.ts:11`                                               | `git`                   | 137 in 20 files | keep    |                                                                                                                     |
| `tests/support/cli/command.ts:21`                                           | `run`                   | 118 files       | keep    |                                                                                                                     |
| `tests/support/registry/plugin.ts:80`                                       | `interrupted`           | 2               | merge   | one listener that sets `process.exitCode` from the signal and aborts; two suppressions become one                   |
| `tests/support/registry/plugin.ts:85`                                       | `terminated`            | 2               | merge   | the same                                                                                                            |
| `tests/inputs/acceptance/source/kits/kits.ts:194`                           | `documentWriter`        | 4 in 2 files    | keep    |                                                                                                                     |

The other rule suppressions outside `packages/cli` are honest. Two deprecation rules cover `lchmodSync`, guarded for
macOS, in `tests/integration/cli/lifecycle/ownership/replacement-preservation/restoration.test.ts:14` and `:73`; the
control-character rule for man-page overstrike in `tests/integration/tools/flags.test.ts:60`; and two planted defects
in `tests/integration/tools/generation/swift/security.test.ts:26` and `tests/inputs/integration/tools/checks.ts:32`.

## Appendix D: every test file, judged

Every test file was read: 514 files and about 2,990 cases. Each was held to one standard: a test stays only if it
exercises real logic or a real scenario and catches a real regression.

| Area                                            | Files | Cases     | Cases removed                | Lines removed | Other effect                               |
| ----------------------------------------------- | ----- | --------- | ---------------------------- | ------------- | ------------------------------------------ |
| `tests/unit` and `tests/integration/cli`        | 244   | 2,304     | 774                          | about 3,400   | 58 CLI spawns become in-process calls      |
| `tests/integration/tools`, `docs`, `repository` | 59    | about 300 | about 96                     | about 2,100   | two folders disappear                      |
| `tests/acceptance`                              | 103   | about 690 | about 271 deleted, 307 moved | about 4,200   | about 2,500 seconds saved per Linux CI run |

Tests to add, ranked by risk, are in D.5; six of them confirm likely bugs.

### D.1 The structure

**The tiers.** The current folders do not say what a test needs. `tests/integration/tools` needs the native tools and
the network, has its own task, CI job, sharding, and timings, and so is a tier hidden inside integration; the nesting is
how `tests/integration/tools/tools/packages` came about. `tests/acceptance/source` and `tests/acceptance/package` need
different setups, runners, and CI jobs, so they are two tiers. Acceptance runs the CLI from source with only the plugin
built, not the built CLI as appendix B said.

| Tier          | Rule                                                                                                        | CI job               |
| ------------- | ----------------------------------------------------------------------------------------------------------- | -------------------- |
| `unit`        | imports source and calls it in-process; no child processes and no git; temporary files are fine             | `test`, on 3 systems |
| `integration` | temporary repositories, git, and child processes, the CLI from source included; no kit tools and no network | `test`, on 3 systems |
| `tools`       | needs the kit tools that the test pins install, and may download packages                                   | sharded              |
| `acceptance`  | runs `gspot` from source end to end in sandboxes, with the plugin served from a local registry              | sharded              |
| `package`     | needs the packed packages, published to a local registry                                                    | Linux                |

The network call per pin leaves the tests for a script on a schedule.

**`tests/timings`.** Bun reads it to split the sharded jobs by time instead of by file count. Delete it, with the
`--timings` and `--update-timings` flags and the artifact upload, and shard by file count:

- **It never balances acceptance.** The tool step runs first with `--update-timings`
  (`.github/workflows/ci.yml:229`), and under `--shard` Bun rewrites the file with only that shard of tool files. The
  acceptance step (`.github/workflows/ci.yml:232`) then finds no acceptance keys and gives every file the median time.
- **It is stale.** `tests/timings/windows.json` is a byte-for-byte copy of the Linux file. One key names a file that is
  gone, two files have no key, and every key goes stale when the folders move.
- **It saves little after the cuts.** With the recorded times and the acceptance files this audit moves out, the
  slowest Linux shard takes 10 minutes split by file count and 8 split by time.
- Fewer shards of equal size cut setup time: four per system, 12 jobs instead of 17. If the minutes matter later, Bun
  documents a cache of per-shard timing files that needs no committed file.

**`tests/inputs` becomes `config` and `samples`.** Its 36 TypeScript files hold 217 exports: 187 have one
user, 26 have two or more, and 4 are used only in their own file. In 29 of the 36 files no export has a second user.
Three values copy constants of the CLI (`LOCKS` and two file modes), and the Supabase version sits both here and in the
CI workflow.

- **The `config` folder** holds the hard-coded parameters. `timeouts.ts` holds every timeout, from the command limit
  to the 90-minute acceptance limit. `cli.ts` holds the quiet init arguments, the default list of left-out tools, and the
  run environment that three helpers repeat.
- **The rule for `config`:** a value goes there when it changes with the runner, a pin, or the CLI. A value that tells
  one test its story stays in that test.
- **The `samples` folder** holds planted content that several tests must keep identical, one module per kit: bash,
  components, Next.js, OpenAPI, Python, Swift, TypeScript, and the client environment JSON. Modules, because real files
  need exclusions in the lint, `tsc`, gitleaks, and typos of this repository.
- The rest goes inline into its one user, and the copied constants import from the CLI.

**`tests/support` becomes `harness`.** gspot bans `support` as a folder name. This repository passes only through the
default that section 5.5 removes. Four files are runners, not helpers, and move to a root `scripts`
folder. They are the acceptance runner, the package runner with its listener bug fixed, the local plugin command, and
the SwiftFormat runner. Six helpers with one user each go inline. The 53 files become 36:

| Folder             | Files | Holds                                                                                     |
| ------------------ | ----- | ----------------------------------------------------------------------------------------- |
| `harness`          | 3     | the preload, the matchers, and the spelling helper                                        |
| `harness/cli`      | 15    | running gspot (`runGspot`, not `run`), git, processes, platforms, policy, generated files |
| `harness/planted`  | 6     | planted cases, sandbox repositories, init, preservation, push, secrets                    |
| `harness/tools`    | 3     | tool installs and the npm and Python projects                                             |
| `harness/registry` | 4     | the local registry and its configuration                                                  |
| `harness/package`  | 3     | the packed packages and their consumers                                                   |
| `harness/plugin`   | 2     | the rule tester and planted plugin cases                                                  |

**`tests/types`.** Its 12 files hold 43 types. Two report types go with the report files, and one copies a CLI type. Ten
result types become type literals in the signatures of the functions that return them, and 17 types with one user go
inline. Four files stay while `types_directory = "types"` holds, because the `gspot/types-placement` rule reports any
type outside a `types` folder, test files included. If that setting goes, they move beside their harness modules too.

`support`, `inputs`, and `types` import each other in every direction: one harness split across three folders. The new
layout ends that.

**`tests/package.json`** stays a workspace package, because its 41 dev dependencies are the packages that planted
repositories link in. Drop its unused docs dependency, check whether the CLI dependency is needed, and rename the
package `@gspothq/tests`. The `[test]` section of the root `bunfig.toml` matters only when `bun test` runs from the
root; delete it.

**Before and after** (see `tests-structure.png`):

```text
Today: 514 files                          After
tests/                                     tests/
  unit/            97                        config/         2   hard-coded parameters
  integration/    206                        samples/        8   shared planted content, one per kit
    cli           147                        harness/       36   helpers with two or more users
    docs            5                        types/          4   while types_directory holds
    repository      3                        unit/          97   in-process
    tools          51                        integration/  155   repositories and child processes
  acceptance/     103                        tools/         51   native kit tools
    source/cli     41                        acceptance/    96   the source CLI end to end
    source/kits    55                        package/        6   packed packages
    package         7                      scripts/ (root)   5   runners that were helpers
  support/         53
  inputs/          37
  types/           12
  timings/          3
```

Counts after the move are before the deletions in D.2 to D.4.

### D.2 `tests/unit` and `tests/integration/cli`

All 244 files and 2,304 cases were read. 774 cases go (34%), about 3,400 of 24,554 lines. About 160 of those cases are
table rows that two rewrites collapse without losing coverage, and about 170 test features the owner removed. If the
open questions in section 1 go the way this audit recommends, about 60 more cases go.

Three changes touch many files at once:

- `Owner.restore` goes with `uninstall`. Twelve ownership test files end with it. Where it removes only gspot changes,
  it becomes `owner.applyPlan(owner.proposeRestoration(path))`, which `gspot remove` still uses. Where it brings back
  the bytes of a replaced file, the test goes with the byte backups.
- The report writer also writes `report.json` in the reports folder of `.gspot`. Eleven files read that file or import the report schema;
  they parse the `--json` output instead.
- `--no-cache` and `noCache` appear in 36 files.

**`tests/unit/plugin`**

| File                                                             | Cases | Verdict | Reason                                                                                                   |
| ---------------------------------------------------------------- | ----- | ------- | -------------------------------------------------------------------------------------------------------- |
| `tests/unit/plugin/configuration.test.ts`                        | 23    | trim    | one case pins a message text and README content; 18 rows restate the option schemas that ESLint enforces |
| `tests/unit/plugin/files.test.ts`                                | 3     | trim    | two cases test `node:fs`                                                                                 |
| `tests/unit/plugin/rules/env-access-owner.test.ts`               | 13    | rewrite | the valid cases rely on default owners, which go                                                         |
| `tests/unit/plugin/rules/header-comments-before-imports.test.ts` | 14    | trim    | two repeated cases                                                                                       |
| `tests/unit/plugin/rules/import-direction.test.ts`               | 28    | rewrite | every case relies on the default roles, which go; three rows differ only in import syntax                |
| `tests/unit/plugin/rules/no-export-only-files.test.ts`           | 7     | delete  | the rule goes                                                                                            |
| `tests/unit/plugin/rules/no-harness-barrel-imports.test.ts`      | 4     | delete  | the rule goes                                                                                            |
| `tests/unit/plugin/rules/no-reexports-outside-index.test.ts`     | 6     | delete  | the rule goes                                                                                            |
| `tests/unit/plugin/rules/no-trivial-functions.test.ts`           | 80    | trim    | eight names hit one branch; keep two                                                                     |
| `tests/unit/plugin/rules/tests-directory-contents.test.ts`       | 9     | rewrite | every case relies on the default harness, which becomes a required option                                |
| the other 17 rule tests                                          |       | keep    | real rule behavior                                                                                       |

**`tests/unit/cli`**

| File                                                          | Cases | Verdict                       | Reason                                                                                                    |
| ------------------------------------------------------------- | ----- | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `tests/unit/cli/agents/assemble.test.ts`                      | 3     | keep                          | the assembly stays                                                                                        |
| `tests/unit/cli/agents/examples.test.ts`                      | 2     | delete                        | the guide linter                                                                                          |
| `tests/unit/cli/agents/front-matter.test.ts`                  | 3     | delete                        | the guide linter                                                                                          |
| `tests/unit/cli/agents/lint.test.ts`                          | 5     | delete                        | the guide linter                                                                                          |
| `tests/unit/cli/agents/sections.test.ts`                      | 2     | trim                          | one case runs the linter                                                                                  |
| `tests/unit/cli/checks/bash-parser.test.ts`                   | 4     | trim, move                    | one case tests tree-sitter; one mocks a null tree to reach a defensive throw                              |
| `tests/unit/cli/checks/codeql.test.ts`                        | 9     | keep                          | takes in the SARIF parser test                                                                            |
| `tests/unit/cli/checks/naming/extract.test.ts`                | 5     | trim                          | two cases cover a default and a repeat                                                                    |
| `tests/unit/cli/checks/naming/python-extractor.test.ts`       | 1     | merge into extract            |                                                                                                           |
| `tests/unit/cli/checks/naming/swift-extractor.test.ts`        | 1     | merge into extract            |                                                                                                           |
| `tests/unit/cli/checks/naming/validate-name.test.ts`          | 11    | trim                          | four rows repeat one assertion; one case loops over the shipped banned words, which move out              |
| `tests/unit/cli/checks/nginx/test-plan.test.ts`               | 5     | trim                          | three rows of empty input are one                                                                         |
| `tests/unit/cli/checks/prose/batches.test.ts`                 | 2     | delete                        | repeats the grammar and batch tests                                                                       |
| `tests/unit/cli/checks/prose/vale.test.ts`                    | 8     | trim                          | six rows repeat one assertion                                                                             |
| `tests/unit/cli/checks/python/imports.test.ts`                | 3     | trim                          | the import-cycle case goes with the check                                                                 |
| `tests/unit/cli/checks/sarif.test.ts`                         | 15    | merge into codeql             | it parses CodeQL output, not a report file                                                                |
| `tests/unit/cli/checks/structure/directories.test.ts`         | 1     | delete                        | trivial getters                                                                                           |
| `tests/unit/cli/checks/structure/statements.test.ts`          | 26    | trim                          | a schema bound and a table of counts per language                                                         |
| `tests/unit/cli/commands/detected-settings.test.ts`           | 9     | keep, or delete               | depends on the open question about detected settings                                                      |
| `tests/unit/cli/commands/doctor-report.test.ts`               | 1     | delete                        | pins column offsets and colors                                                                            |
| `tests/unit/cli/commands/explain-rules.test.ts`               | 4     | trim                          | two cases pin manifest patterns and text                                                                  |
| `tests/unit/cli/commands/prompts.test.ts`                     | 10    | trim                          | two tables give one outcome per row pair                                                                  |
| `tests/unit/cli/commands/propose-width.test.ts`               | 4     | keep, rename `propose`        | only one case is about width                                                                              |
| `tests/unit/cli/generation/managed-blocks.test.ts`            | 1     | move                          | it tests lifecycle code                                                                                   |
| `tests/unit/cli/generation/workflow.test.ts`                  | 4     | rewrite                       | parse the YAML instead of matching text; drop the SARIF half                                              |
| `tests/unit/cli/kits/manifests/checks.test.ts`                | 19    | trim                          | seven cases restate required fields and enums; the `cached` field goes                                    |
| `tests/unit/cli/kits/manifests/declarations.test.ts`          | 11    | trim                          | six cases restate the schema or repeat one parse                                                          |
| `tests/unit/cli/kits/owners.test.ts`                          | 11    | trim                          | two cases pin manifest content or linguist data                                                           |
| `tests/unit/cli/kits/sections.test.ts`                        | 9     | merge into the rule-diff test | it tests the preview readers, not kits                                                                    |
| `tests/unit/cli/kits/select.test.ts`                          | 4     | trim                          | one case asserts manifest content                                                                         |
| `tests/unit/cli/output/progress.test.ts`                      | 2     | trim                          | the cache status goes                                                                                     |
| `tests/unit/cli/output/reporter.test.ts`                      | 13    | trim                          | five cases check wording, columns, the cache status, or the census                                        |
| `tests/unit/cli/policy/json-schema/checks.test.ts`            | 17    | trim                          | one row per refinement where the two schemas must agree; the folder goes if the schema of known keys goes |
| `tests/unit/cli/policy/json-schema/manifest-settings.test.ts` | 10    | merge, keep 2                 |                                                                                                           |
| `tests/unit/cli/policy/json-schema/overrides.test.ts`         | 18    | merge, keep 4                 | the ESLint rows repeat the policy boundary test                                                           |
| `tests/unit/cli/policy/json-schema/tool-settings.test.ts`     | 28    | merge, keep 4                 | enum tables                                                                                               |
| `tests/unit/cli/policy/json-schema/vocabulary.test.ts`        | 20    | delete                        | refuses renamed keys: history plus a generic refusal                                                      |
| `tests/unit/cli/policy/messages.test.ts`                      | 28    | delete                        | the wording of every message                                                                              |
| `tests/unit/cli/policy/settings.test.ts`                      | 32    | trim                          | 14 cases pin defaults or schema bounds, or repeat another case                                            |
| `tests/unit/cli/project-folder.test.ts`                       | 10    | move                          | it tests the repository scopes                                                                            |
| `tests/unit/cli/sql-parser.test.ts`                           | 10    | trim, move                    | one case repeats another; one spawns a process and belongs to integration                                 |
| `tests/unit/cli/sqlfluff-configuration.test.ts`               | 22    | merge into the rule-diff test | 15 rows become one per branch                                                                             |
| the other 32 files                                            |       | keep                          | real logic                                                                                                |

**`tests/integration/cli`: the top level and the checks**

| File                                                         | Cases | Verdict      | Reason                                                                                              |
| ------------------------------------------------------------ | ----- | ------------ | --------------------------------------------------------------------------------------------------- |
| `tests/integration/cli/completion.test.ts`                   | 19    | delete       | completion goes                                                                                     |
| `tests/integration/cli/doctor.test.ts`                       | 8     | trim         | coverage cases move; one case checks only that the version is a string; one uses `uninstallHooks`   |
| `tests/integration/cli/instructions.test.ts`                 | 2     | trim         | drop the wording checks                                                                             |
| `tests/integration/cli/profile.test.ts`                      | 16    | trim         | two cases mock file reads to reach defensive branches; the adoption case checks the recovery folder |
| `tests/integration/cli/checks/async-functions.test.ts`       | 1     | delete       | the fastapi check goes                                                                              |
| `tests/integration/cli/checks/cloudflare-types.test.ts`      | 5     | keep         | drop a tautology                                                                                    |
| `tests/integration/cli/checks/codeql-execution.test.ts`      | 5     | trim         | four rows to two                                                                                    |
| `tests/integration/cli/checks/copied-blocks.test.ts`         | 6     | trim         | three malformed reports hit one parse                                                               |
| `tests/integration/cli/checks/fences.test.ts`                | 12    | trim, rename | one case repeats three; it tests stale paths                                                        |
| `tests/integration/cli/checks/html-scripts.test.ts`          | 13    | move to unit | 13 sandboxes for a pure analysis of HTML text                                                       |
| `tests/integration/cli/checks/license-locks.test.ts`         | 24    | trim, move   | the lockfile parsing is unit logic; seven rows to two; six CLI spawns to one in-process run         |
| `tests/integration/cli/checks/licenses.test.ts`              | 11    | trim         | five malformed rows to two                                                                          |
| `tests/integration/cli/checks/lockfile-fresh.test.ts`        | 6     | trim         | registry and authentication failures give the same status                                           |
| `tests/integration/cli/checks/manifest-policy.test.ts`       | 7     | trim         | five malformed rows to two; one mocked denial                                                       |
| `tests/integration/cli/checks/naming.test.ts`                | 6     | rewrite      | 16 CLI spawns; run in-process                                                                       |
| `tests/integration/cli/checks/nextjs-build.test.ts`          | 7     | trim         | three rows are one branch                                                                           |
| `tests/integration/cli/checks/repository-shape.test.ts`      | 5     | trim         | two cases test one function                                                                         |
| `tests/integration/cli/checks/site-build.test.ts`            | 11    | trim         | argument quoting is covered elsewhere                                                               |
| `tests/integration/cli/checks/structure-functions.test.ts`   | 7     | trim, rename | a threshold loop, and mocked null trees; it tests SQL functions                                     |
| `tests/integration/cli/checks/svelte-execution.test.ts`      | 4     | trim         | keep two rows                                                                                       |
| `tests/integration/cli/checks/swift/build/compiler.test.ts`  | 7     | trim         | one case repeats another                                                                            |
| `tests/integration/cli/checks/swift/build/isolation.test.ts` | 7     | trim         | four rows to two                                                                                    |
| `tests/integration/cli/checks/swift/cache.test.ts`           | 2     | trim         | the cache home convention moves to a library                                                        |
| `tests/integration/cli/checks/tsconfig-options.test.ts`      | 13    | trim         | nine cases test the TypeScript `extends` resolution, malformed input, or a mocked denial            |
| `tests/integration/cli/checks/xctest-execution.test.ts`      | 7     | trim         | two rows hit one branch                                                                             |
| the other 17 check tests                                     |       | keep         |                                                                                                     |

**`tests/integration/cli/execution`**

| File                                                                    | Cases | Verdict              | Reason                                                                           |
| ----------------------------------------------------------------------- | ----- | -------------------- | -------------------------------------------------------------------------------- |
| `tests/integration/cli/execution/ast-grep.test.ts`                      | 7     | trim                 | the deadline and cancellation rows repeat the spawn tests                        |
| `tests/integration/cli/execution/cache-retention.test.ts`               | 8     | delete               | the result cache                                                                 |
| `tests/integration/cli/execution/comment-syntax.test.ts`                | 28    | trim                 | 25 cases are inline `gspot-ignore`                                               |
| `tests/integration/cli/execution/coverage.test.ts`                      | 12    | trim                 | strip report and wording assertions; two cases share setup and assertion         |
| `tests/integration/cli/execution/engine-input.test.ts`                  | 13    | trim                 | five rows pin the stages of five manifests                                       |
| `tests/integration/cli/execution/fixers/execution.test.ts`              | 8     | trim                 | batch splitting is covered by the unit test; the timeout rows wait a second each |
| `tests/integration/cli/execution/fixers/isolation.test.ts`              | 15    | trim, split          | the scratch copy gets its own file                                               |
| `tests/integration/cli/execution/identity.test.ts`                      | 5     | trim                 | one case reads the report files; three rows spawn the CLI                        |
| `tests/integration/cli/execution/ignores.test.ts`                       | 12    | delete               | ten cases are inline `gspot-ignore`; two move to the suppression test            |
| `tests/integration/cli/execution/impact.test.ts`                        | 10    | trim                 | rows that hit one branch                                                         |
| `tests/integration/cli/execution/parse-output/contract.test.ts`         | 122   | rewrite              | loops over 61 shipped specs instead of 8 output formats; about 16 cases          |
| `tests/integration/cli/execution/parse-output/declared-checks.test.ts`  | 9     | trim                 | two tables whose dimensions do not matter                                        |
| `tests/integration/cli/execution/parse-output/formats.test.ts`          | 20    | trim                 | assert the valid case once; drop message text                                    |
| `tests/integration/cli/execution/prerequisites.test.ts`                 | 2     | trim                 | pins five manifests                                                              |
| `tests/integration/cli/execution/scopes/readers.test.ts`                | 4     | rewrite              | 14 CLI spawns                                                                    |
| `tests/integration/cli/execution/scopes/trpc.test.ts`                   | 7     | rewrite              | 15 CLI spawns                                                                    |
| `tests/integration/cli/execution/scopes/xcode.test.ts`                  | 9     | rewrite, trim        | 20 CLI spawns; six rows prove one mechanism                                      |
| `tests/integration/cli/execution/single-file-folder-allowances.test.ts` | 2     | merge into structure |                                                                                  |
| `tests/integration/cli/execution/storage/cache.test.ts`                 | 6     | delete               | the result cache                                                                 |
| `tests/integration/cli/execution/storage/reports.test.ts`               | 12    | delete               | the report files; two cases move                                                 |
| `tests/integration/cli/execution/structure.test.ts`                     | 23    | trim                 | 14 rows to three; the default harness goes                                       |
| `tests/integration/cli/execution/suppression-comments.test.ts`          | 19    | trim                 | three cases are inline `gspot-ignore`                                            |
| `tests/integration/cli/execution/tool-runner/adapters.test.ts`          | 5     | trim                 | one case asserts the cache status; one repeats another                           |
| `tests/integration/cli/execution/vale.test.ts`                          | 6     | trim                 | the file type does not affect failure handling                                   |
| the other 8 execution tests                                             |       | keep                 |                                                                                  |

**`tests/integration/cli/generation`**

| File                                                                  | Cases | Verdict | Reason                                                                                   |
| --------------------------------------------------------------------- | ----- | ------- | ---------------------------------------------------------------------------------------- |
| `tests/integration/cli/generation/aliases.test.ts`                    | 11    | trim    | rows that assert one error; comment tolerance belongs to the JSON parser                 |
| `tests/integration/cli/generation/astro-parts.test.ts`                | 1     | keep    | loosen the exact rule list                                                               |
| `tests/integration/cli/generation/bun.test.ts`                        | 2     | trim    | drop `owner.restore`; one case depends on the bunfig import question                     |
| `tests/integration/cli/generation/every-template.test.ts`             | 56    | rewrite | a real safety net in 56 sessions; one sandbox per level, two cases                       |
| `tests/integration/cli/generation/format-width.test.ts`               | 3     | trim    | two widths take one path                                                                 |
| `tests/integration/cli/generation/framework-rules.test.ts`            | 4     | trim    | drop the dead rule                                                                       |
| `tests/integration/cli/generation/guides.test.ts`                     | 4     | trim    | one case asserts 42 headings of shipped rule text                                        |
| `tests/integration/cli/generation/level-contract.test.ts`             | 11    | trim    | pins constants, values, and wording                                                      |
| `tests/integration/cli/generation/managed-ignores.test.ts`            | 10    | rewrite | two cases end in uninstall; seven rows to four                                           |
| `tests/integration/cli/generation/package-manifests.test.ts`          | 2     | trim    | the two rows are identical                                                               |
| `tests/integration/cli/generation/plugin-levels/functions.test.ts`    | 9     | trim    | the four recommended rows repeat the plugin test                                         |
| `tests/integration/cli/generation/plugin-levels/jest.test.ts`         | 46    | trim    | 40 rows test eslint-plugin-jest; keep one per test module                                |
| `tests/integration/cli/generation/plugin-levels/limits.test.ts`       | 9     | trim    | rows that repeat the unit rule tests                                                     |
| `tests/integration/cli/generation/plugin-levels/source-rules.test.ts` | 6     | trim    | four rows repeat the plugin test                                                         |
| `tests/integration/cli/generation/prose.test.ts`                      | 3     | merge   | into the Vale packages test                                                              |
| `tests/integration/cli/generation/selection.test.ts`                  | 9     | trim    | six rows pin one file name each                                                          |
| `tests/integration/cli/generation/shared-settings.test.ts`            | 4     | rewrite | it pins the knip entries of this repository and shipped rule lists; use a local manifest |
| the other 8 generation tests                                          |       | keep    |                                                                                          |

**`tests/integration/cli/lifecycle`**

| File                                                                                       | Cases | Verdict           | Reason                                                                            |
| ------------------------------------------------------------------------------------------ | ----- | ----------------- | --------------------------------------------------------------------------------- |
| `tests/integration/cli/lifecycle/apply/rule-preview.test.ts`                               | 12    | trim              | eight cases repeat unit parser tests or the settings test                         |
| `tests/integration/cli/lifecycle/ci.test.ts`                                               | 3     | trim              | pins the command list and the upload wording                                      |
| `tests/integration/cli/lifecycle/hooks.test.ts`                                            | 7     | trim              | drop `uninstallHooks`                                                             |
| `tests/integration/cli/lifecycle/init.test.ts`                                             | 20    | trim              | tables cut; one case tests the choice validation of commander                     |
| `tests/integration/cli/lifecycle/installer-failures.test.ts`                               | 8     | trim              | one case exists for coverage                                                      |
| `tests/integration/cli/lifecycle/ownership/bounded-state.test.ts`                          | 12    | trim              | five cases test byte backups and uninstall                                        |
| `tests/integration/cli/lifecycle/ownership/configuration-preservation.test.ts`             | 10    | rewrite           | every case ends in `owner.restore`                                                |
| `tests/integration/cli/lifecycle/ownership/conflicts/documents.test.ts`                    | 3     | rewrite           | the same                                                                          |
| `tests/integration/cli/lifecycle/ownership/conflicts/links.test.ts`                        | 8     | trim              | one case keeps recovery bytes                                                     |
| `tests/integration/cli/lifecycle/ownership/conflicts/plans.test.ts`                        | 8     | trim              | two cases restore replaced bytes                                                  |
| `tests/integration/cli/lifecycle/ownership/recovery/batches.test.ts`                       | 4     | trim              | keep the crash points; share the child script copied five times                   |
| `tests/integration/cli/lifecycle/ownership/recovery/links.test.ts`                         | 5     | trim              | one case is the recovery folder                                                   |
| `tests/integration/cli/lifecycle/ownership/recovery/replacement.test.ts`                   | 10    | trim              | five cases are byte backups                                                       |
| `tests/integration/cli/lifecycle/ownership/replacement-preservation/boundaries.test.ts`    | 3     | delete            | old `.gspot` layouts, the recovery folder, and restore                            |
| `tests/integration/cli/lifecycle/ownership/replacement-preservation/installations.test.ts` | 5     | rewrite           | move to `proposeRestoration`                                                      |
| `tests/integration/cli/lifecycle/ownership/replacement-preservation/restoration.test.ts`   | 3     | trim              | one case is byte backups                                                          |
| `tests/integration/cli/lifecycle/root/consumers.test.ts`                                   | 8     | trim              | three rows test the YAML library; seven cases depend on the Xcode import question |
| `tests/integration/cli/lifecycle/root/roots.test.ts`                                       | 10    | move, trim        | it tests the platform folder                                                      |
| `tests/integration/cli/lifecycle/xcode.test.ts`                                            | 2     | rewrite or delete | spawns the CLI; depends on the Xcode import question                              |
| the other 5 lifecycle tests                                                                |       | keep              |                                                                                   |

**`tests/integration/cli/platform`, `policy`, `tools`, and `repository`**

| File                                                          | Cases | Verdict                | Reason                                                                   |
| ------------------------------------------------------------- | ----- | ---------------------- | ------------------------------------------------------------------------ |
| `tests/integration/cli/platform/assets.test.ts`               | 1     | rewrite                | copies seven source files by name; uses a constant that goes             |
| `tests/integration/cli/platform/spawn/termination.test.ts`    | 12    | trim                   | four rows of 1.5 seconds to two; one mocked permission error             |
| `tests/integration/cli/policy/read-policy/boundaries.test.ts` | 29    | move to unit, trim     | pure parsing; tables cut to one row per class                            |
| `tests/integration/cli/policy/read-policy/locations.test.ts`  | 15    | delete if positions go | the version gate and a repeated case go in any case                      |
| `tests/integration/cli/policy/read-policy/recovery.test.ts`   | 7     | move to unit           |                                                                          |
| `tests/integration/cli/policy/read-policy/settings.test.ts`   | 14    | move to unit, trim     | four cases with no branch of their own                                   |
| `tests/integration/cli/policy/write.test.ts`                  | 14    | trim                   | one case tests `appendEntry`, called nowhere; one repeats the width test |
| `tests/integration/cli/tools/inspect/placement.test.ts`       | 13    | rewrite                | seven rows read shipped manifests; use synthetic pins                    |
| `tests/integration/cli/tools/inspect/versions.test.ts`        | 12    | trim                   | one case waits the real 15-second timeout                                |
| `tests/integration/cli/repository/existing-tooling.test.ts`   | 18    | trim                   | four rows to one                                                         |
| `tests/integration/cli/repository/kinds.test.ts`              | 5     | trim                   | one case uses the reports folder                                         |
| `tests/integration/cli/repository/manifests.test.ts`          | 21    | trim                   | eight rows that hit one branch                                           |
| `tests/integration/cli/repository/refspecs.test.ts`           | 3     | trim                   | one refusal                                                              |
| `tests/integration/cli/repository/scopes.test.ts`             | 15    | trim                   | four rows to two                                                         |
| `tests/integration/cli/repository/snapshot/gitlinks.test.ts`  | 4     | trim                   | a wording line                                                           |
| `tests/integration/cli/repository/swift-tests.test.ts`        | 45    | trim, split            | 14 cases repeat a branch or spawn the CLI ten times                      |
| `tests/integration/cli/repository/tags.test.ts`               | 2     | trim                   | repeats the owners test                                                  |
| `tests/integration/cli/repository/tracked/boundaries.test.ts` | 7     | trim                   | a 50 MB test file where 2 MB does                                        |
| `tests/integration/cli/repository/tracked/discovery.test.ts`  | 15    | trim                   | mocked denials and a repeated case                                       |
| `tests/integration/cli/repository/xcode-project.test.ts`      | 9     | rewrite, trim          | four rows spawn the CLI; one case repeats the snapshot test              |
| the other tests in these folders                              |       | keep                   |                                                                          |

Across these tiers, 58 CLI spawns in 12 files can run in-process. The emit-and-write block is written 38 times, the
engine input 30 times, the run options 113 times, and full init options 15 times; one helper each.

### D.3 `tests/integration/tools`, `tests/integration/docs`, and `tests/integration/repository`

All 59 files were read with the helpers and test data they import. About 96 cases go and about 2,100 test lines with them. The tools
tier shrinks from about 4,680 lines to about 2,950, and the docs and repository folders disappear.

| File                                                                    | Cases | Verdict                        | Reason                                                                                                                                                             |
| ----------------------------------------------------------------------- | ----- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/integration/repository/acceptance.test.ts`                       | 11    | delete                         | tests the test runner script and its shard options, not gspot                                                                                                      |
| `tests/integration/repository/grammar.test.ts`                          | 4     | delete                         | tests the build script that downloads the grammars                                                                                                                 |
| `tests/integration/repository/test-tools.test.ts`                       | 1     | delete                         | checks that a generated file of this repository is fresh; a CI step with `git diff --exit-code` does the same                                                      |
| `tests/integration/docs/example.test.ts`                                | 2     | delete                         | checks that two pages contain text; `tests/acceptance/source/cli/example.test.ts` replays the example                                                              |
| `tests/integration/docs/examples.test.ts`                               | 2     | delete                         | checks page content, and repeats `tests/acceptance/source/cli/checks/declared.test.ts`                                                                             |
| `tests/integration/docs/links.test.ts`                                  | 1     | delete                         | tests a script of the docs site                                                                                                                                    |
| `tests/integration/docs/reference.test.ts`                              | 11    | delete                         | checks the wording of generated pages; move its one real guard, conflicting setting definitions, into manifest validation with a unit test                         |
| `tests/integration/docs/release.test.ts`                                | 1     | delete                         | tests a script of the docs site                                                                                                                                    |
| `tests/integration/tools/flags.test.ts`                                 | 54    | rewrite                        | catches a manifest flag that a pinned tool no longer accepts; run help in the sandbox, match whole tokens (11 flags are one letter), move the static check to unit |
| `tests/integration/tools/parameter-limits.test.ts`                      | 4     | keep                           | proves real tools read the generated limits                                                                                                                        |
| `tests/integration/tools/profile.test.ts`                               | 1     | delete                         | its point is that uninstall restores a replaced file                                                                                                               |
| `tests/integration/tools/swift-build.test.ts`                           | 2     | keep                           | the only real incremental Swift build; use the shared Swift helpers                                                                                                |
| `tests/integration/tools/bash/example.test.ts`                          | 3     | delete                         | runs rule examples and checks output wording                                                                                                                       |
| `tests/integration/tools/bash/safety.test.ts`                           | 2     | delete                         | runs rule examples                                                                                                                                                 |
| `tests/integration/tools/checks/licenses.test.ts`                       | 1     | trim                           | keep the Python name normalization; the acceptance test covers the rest                                                                                            |
| `tests/integration/tools/checks/lockfile-fresh.test.ts`                 | 6     | trim to 3                      | the check runs at both levels, so the level dimension doubles installs for nothing                                                                                 |
| `tests/integration/tools/checks/secrets-files.test.ts`                  | 1     | trim                           | the only test of scanning files without git; drop the third run and the wording match                                                                              |
| `tests/integration/tools/checks/site-output.test.ts`                    | 3     | move to the CLI tier           | its tools come from `node_modules`; no native tool                                                                                                                 |
| `tests/integration/tools/checks/xctest-coverage.test.ts`                | 1     | keep                           | the only real coverage floor run                                                                                                                                   |
| `tests/integration/tools/checks/supabase/configuration.test.ts`         | 1     | trim                           | drop the cancellation part, which other tests cover                                                                                                                |
| `tests/integration/tools/checks/supabase/types.test.ts`                 | 2     | trim to 1                      | the first case only proves the Supabase CLI works; it costs one database start of the 179 s file                                                                   |
| `tests/integration/tools/execution/fixers.test.ts`                      | 10    | trim and split                 | keep the SQLFluff crash case; the four ESLint cases share one spec: keep one, and move it with Stylelint to the CLI tier                                           |
| `tests/integration/tools/execution/python-staged.test.ts`               | 1     | keep                           | the only staged snapshot with a private Python environment                                                                                                         |
| `tests/integration/tools/execution/suppressions.test.ts`                | 32    | trim, move, batch              | the census goes with inline ignores; the reasons case repeats `tests/acceptance/source/cli/reasons.test.ts`; batch 16 Ruff rows into one run                       |
| `tests/integration/tools/execution/vale.test.ts`                        | 15    | trim                           | 8 extension rows only pin a list; keep 4; drop the case that the prose-ignore test covers                                                                          |
| `tests/integration/tools/execution/parse-output/actionlint.test.ts`     | 14    | rewrite                        | the rewrite of workflow scalars is pure: 13 unit rows and 2 native runs                                                                                            |
| `tests/integration/tools/execution/parse-output/native-tools.test.ts`   | 4     | trim                           | keep the Trivy image case and move it to the checks folder; merge the two typos cases                                                                              |
| `tests/integration/tools/execution/parse-output/partial-output.test.ts` | 3     | trim, speed up                 | a real exit-code contract; install Vulture once                                                                                                                    |
| `tests/integration/tools/execution/parse-output/plist.test.ts`          | 2     | keep                           | the two checks use different patterns                                                                                                                              |
| `tests/integration/tools/generation/bash.test.ts`                       | 1     | merge                          | one Semgrep file with one install instead of three                                                                                                                 |
| `tests/integration/tools/generation/docker.test.ts`                     | 1     | keep                           | scope isolation and inherited ignores                                                                                                                              |
| `tests/integration/tools/generation/fastapi.test.ts`                    | 2     | delete                         | runs rule examples; about 90 lines of test data go with it                                                                                                         |
| `tests/integration/tools/generation/headings.test.ts`                   | 1     | merge into the Vale test       | it tests one shipped style                                                                                                                                         |
| `tests/integration/tools/generation/ignores.test.ts`                    | 8     | merge into the spelling test   | real rebasing of excludes per scope; run typos once per case, not 12 times                                                                                         |
| `tests/integration/tools/generation/level-formatting.test.ts`           | 3     | delete                         | two cases run Prettier with no gspot configuration; the shfmt fix moves to the fixers test                                                                         |
| `tests/integration/tools/generation/toml.test.ts`                       | 1     | move to the CLI tier           | the trailing-comma logic needs a TOML parser, not Taplo                                                                                                            |
| `tests/integration/tools/generation/sqlfluff.test.ts`                   | 1     | keep                           | proves the generated dialect is read                                                                                                                               |
| `tests/integration/tools/generation/squawk.test.ts`                     | 1     | keep                           | fold three copied spawn blocks into one helper                                                                                                                     |
| `tests/integration/tools/generation/framework-security.test.ts`         | 2     | trim; becomes the Semgrep file | keep scope inheritance and the invalid-rule error                                                                                                                  |
| `tests/integration/tools/generation/javascript.test.ts`                 | 6     | trim                           | one case repeats the nested-scope case; one belongs to the CLI tier                                                                                                |
| `tests/integration/tools/generation/ruff.test.ts`                       | 9     | trim to 1                      | 8 cases run rule examples                                                                                                                                          |
| `tests/integration/tools/generation/spelling.test.ts`                   | 2     | keep                           | compare file, line, and word instead of the typos output lines                                                                                                     |
| `tests/integration/tools/generation/vale-install.test.ts`               | 3     | trim                           | keep sync, prune, and repair; drop the version and lint runs                                                                                                       |
| `tests/integration/tools/generation/xctest.test.ts`                     | 7     | trim to 4                      | the cache steps go with the cache; the level dimension adds nothing                                                                                                |
| `tests/integration/tools/generation/swift/docs.test.ts`                 | 6     | trim to 4                      | two cases run rule examples                                                                                                                                        |
| `tests/integration/tools/generation/swift/security.test.ts`             | 2     | trim, merge                    | a hand copy of the manifest command can drift; keep two rules to prove level gating                                                                                |
| `tests/integration/tools/guides/bash.test.ts`                           | 4     | delete                         | rule examples                                                                                                                                                      |
| `tests/integration/tools/guides/docker.test.ts`                         | 1     | delete                         | rule examples                                                                                                                                                      |
| `tests/integration/tools/guides/typescript.test.ts`                     | 1     | delete                         | rule examples; it also links the tools the developer installed in `.gspot`                                                                                         |
| `tests/integration/tools/lifecycle/mise-execution.test.ts`              | 2     | trim to 1                      | keep `mise link`, install, and argument forwarding                                                                                                                 |
| `tests/integration/tools/lifecycle/python-project.test.ts`              | 11    | trim to 6                      | merge the relocation cases; run the lock conflict once; drop every Ruff run                                                                                        |
| `tests/integration/tools/lifecycle/tool-isolation.test.ts`              | 2     | delete                         | the placement tests in the CLI tier cover the precedence; what remains proves Prettier and tsc work                                                                |
| `tests/integration/tools/tools/packages/native.test.ts`                 | 1     | keep                           | the only npm install with a native wrapper                                                                                                                         |
| `tests/integration/tools/tools/packages/preservation.test.ts`           | 6     | merge into the project test    | the same matrix; saves six setups                                                                                                                                  |
| `tests/integration/tools/tools/packages/refusals.test.ts`               | 7     | trim to 2                      | the refusal happens before any client runs, so one client proves it                                                                                                |
| `tests/integration/tools/tools/packages/clone.test.ts`                  | 4     | keep                           | check the tool state instead of running Prettier                                                                                                                   |
| `tests/integration/tools/tools/packages/environment.test.ts`            | 1     | keep                           | registry authentication reaches the private project                                                                                                                |
| `tests/integration/tools/tools/packages/project.test.ts`                | 6     | keep                           | absorbs the preservation cases                                                                                                                                     |
| `tests/integration/tools/tools/packages/locks.test.ts`                  | 12    | trim to 10                     | the recovery assertion goes with the byte backups                                                                                                                  |

Across these folders, 21 files still pass `--no-cache`, which dies with the cache, and the emit-and-write block is
copied 23 times in 17 files; one helper replaces it. `mise.toml` `guides:lint` names a test file that does not exist, and
the timing files still list a CI test file that is gone.

### D.4 `tests/acceptance`

All 103 files were read. Acceptance tests run the built CLI in sandbox repositories with the real tools, so they cost
the most: 3,951 seconds per Linux run. About 72% of that time leaves this tier. Most moved cases need no native tool
and become integration tests. The rest of the savings comes from dropping cases that plant one defect per third-party
rule, which only proves the third-party rule works. One case per kit that proves gspot wires the tool, its
configuration, and its exit code is enough.

- **Left in acceptance:** about 112 of about 690 cases (12 for commands, 90 for kits, 10 for the packed package).
- **Deleted:** 7 files and about 271 cases, 156 of them the network call per pin.
- **Moved to another tier:** 39 files and about 307 cases.
- **Saved:** about 2,500 seconds per Linux run, about 7 minutes off each Linux shard, and about 4,200 test lines.

Fix these with the deletions:

- The shared Bash sample in `tests/support/cli/planted.ts:43` holds an inline `gspot-ignore` comment, and 13 files use
  it. Replace it with a two-statement `main` or an `[[ignore]]` entry.
- `--no-cache` appears 163 times, and the report types and constants of SARIF and GitLab sit in the shared test types.
- `tests/acceptance/source/kits/documents.test.ts` records 5 milliseconds on Linux, so its 11 cases do not run there.
- The macOS-only Swift and Xcode tables install a sandbox on Linux and Windows before skipping every case.
- The static-site sandbox links the whole `node_modules` of the repository, although the site needs no packages.
- Sandboxes are set up four different ways, and init arguments are written out 15 times. The strict `tsconfig` text is
  copied 10 times, and the "run again, expect 0, no findings" block repeats about 80 times. One helper each.

**Commands, in `tests/acceptance/source/cli`**

| File                                                        | Cases | Seconds | Verdict                                  | Reason                                                                              |
| ----------------------------------------------------------- | ----- | ------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `tests/acceptance/source/cli/agents.test.ts`                | 3     | 5.4     | move to the CLI tier, trim               | no tool; drop the uninstall half of case 1                                          |
| `tests/acceptance/source/cli/attributes.test.ts`            | 1     | 1.4     | merge into the agents test               | a real Windows line-ending regression; drop the uninstall tail                      |
| `tests/acceptance/source/cli/cancellation.test.ts`          | 9     | 12.6    | move to the CLI tier, trim               | fake checks and a git shim; drop the SARIF assertions                               |
| `tests/acceptance/source/cli/changed.test.ts`               | 5     | 6.5     | move to the CLI tier                     | a Bun check and git; use the shared git helper                                      |
| `tests/acceptance/source/cli/checks/cache-inputs.test.ts`   | 6     | 13.1    | delete                                   | the result cache                                                                    |
| `tests/acceptance/source/cli/checks/declared.test.ts`       | 3     | 6.8     | merge into the declared-check parse test | case 1 is cache staleness; the format cases need no install                         |
| `tests/acceptance/source/cli/checks/policy-errors.test.ts`  | 6     | 12.1    | move to the CLI tier                     | policy parsing with host Bash only                                                  |
| `tests/acceptance/source/cli/checks/selection.test.ts`      | 5     | 6.4     | move to the CLI tier                     | no tool                                                                             |
| `tests/acceptance/source/cli/ci.test.ts`                    | 12    | 14.6    | move to the CLI tier, trim               | a fake npm; drop the SARIF and Code Quality assertions and the GitLab duplicate     |
| `tests/acceptance/source/cli/commits.test.ts`               | 4     | 51.6    | trim                                     | one case runs commitlint directly; install commitlint once, not three times         |
| `tests/acceptance/source/cli/configuration-arrival.test.ts` | 1     | 29.6    | keep                                     | `gspot add` changes the next check                                                  |
| `tests/acceptance/source/cli/declarations.test.ts`          | 2     | 6.8     | move to the CLI tier                     | absorbs the exclusions test                                                         |
| `tests/acceptance/source/cli/example.test.ts`               | 1     | n/a     | keep                                     | the recorded journey of the README; add it to the timings                           |
| `tests/acceptance/source/cli/exclusions.test.ts`            | 1     | 3.1     | merge into declarations                  | the same shape                                                                      |
| `tests/acceptance/source/cli/explain.test.ts`               | 6     | 10.7    | move to the CLI tier, trim               | keep the JSON and exit codes; drop the wording                                      |
| `tests/acceptance/source/cli/format-overrides.test.ts`      | 3     | 8.2     | trim                                     | keep the correction case; the other two belong to generation and unit tests         |
| `tests/acceptance/source/cli/hooks/commit.test.ts`          | 2     | 14.2    | trim                                     | keep the real commits in an installed and a cloned repository, minus wording        |
| `tests/acceptance/source/cli/hooks/push/refs.test.ts`       | 5     | 8.8     | move to the CLI tier                     | ref resolution with `bash -n`; five pasted assertion blocks become a helper         |
| `tests/acceptance/source/cli/hooks/push/revisions.test.ts`  | 4     | 10.6    | merge into refs, trim                    | drop the SARIF assertions and wording                                               |
| `tests/acceptance/source/cli/ignored-execution.test.ts`     | 5     | 19.0    | split                                    | ignores to the CLI tier, ESLint configuration to generation, profile export to unit |
| `tests/acceptance/source/cli/init/refusals.test.ts`         | 13    | 14.7    | move to the CLI tier, trim               | nothing is installed; assert exit 2 and nothing written, not messages               |
| `tests/acceptance/source/cli/init/replace.test.ts`          | 6     | 8.8     | move to the CLI tier, trim               | read the plan from `--json`; drop uninstall and byte restore                        |
| `tests/acceptance/source/cli/init/selection.test.ts`        | 3     | 4.0     | move to the CLI tier                     | detection only                                                                      |
| `tests/acceptance/source/cli/levels.test.ts`                | 3     | 10.4    | move to the CLI tier, trim               | one helper repeats the reasons test                                                 |
| `tests/acceptance/source/cli/lifecycle/apply.test.ts`       | 4     | 7.7     | move to the CLI tier, trim               | keep the refusal of an edited file; the uninstall parts go                          |
| `tests/acceptance/source/cli/lifecycle/performance.test.ts` | 1     | 28.3    | delete                                   | wall-clock limits on shared runners and a warm cache                                |
| `tests/acceptance/source/cli/lifecycle/roots.test.ts`       | 2     | 4.3     | merge into the CLI roots test            | no tool                                                                             |
| `tests/acceptance/source/cli/lifecycle/uninstall.test.ts`   | 7     | 14.7    | delete                                   | uninstall; keep the 15 lines about a fresh clone adopting exact bytes               |
| `tests/acceptance/source/cli/list.test.ts`                  | 2     | 6.1     | move to the CLI tier, trim               | drop the wording and an obsolete flag                                               |
| `tests/acceptance/source/cli/local-override.test.ts`        | 1     | 3.8     | move to the CLI tier                     | use a host tool instead of ShellCheck                                               |
| `tests/acceptance/source/cli/nested-scopes.test.ts`         | 1     | 3.0     | merge into the scopes test               | no tool                                                                             |
| `tests/acceptance/source/cli/profile.test.ts`               | 4     | 16.0    | trim                                     | keep the export into a second repository; one case repeats the reasons test         |
| `tests/acceptance/source/cli/prose-ignore.test.ts`          | 2     | 7.0     | trim                                     | keep the Vale path ignore                                                           |
| `tests/acceptance/source/cli/python-ownership.test.ts`      | 2     | 2.9     | move to the CLI tier                     | engine checks                                                                       |
| `tests/acceptance/source/cli/reasons.test.ts`               | 20    | 33.1    | move to the CLI tier, trim to 13         | no tool; four per-tool rows become one unit table                                   |
| `tests/acceptance/source/cli/report-storage.test.ts`        | 11    | 16.9    | delete; keep 4 cases                     | the report files, the cache, and uninstall; move the symlink and publication cases  |
| `tests/acceptance/source/cli/scopes.test.ts`                | 3     | 43.0    | trim                                     | keep the shared ESLint case; two cases belong to init                               |
| `tests/acceptance/source/cli/selectors.test.ts`             | 5     | 12.3    | move to the CLI tier                     | index snapshots with Bun and Bash                                                   |
| `tests/acceptance/source/cli/spelling.test.ts`              | 3     | 13.0    | trim                                     | keep the ambiguous correction                                                       |
| `tests/acceptance/source/cli/typed-tables.test.ts`          | 1     | 7.0     | move to the CLI tier                     | TOML parsing needs no install                                                       |
| `tests/acceptance/source/cli/uninstall.test.ts`             | 1     | 1.4     | delete                                   | uninstall                                                                           |

**Kits, in `tests/acceptance/source/kits`**

| File                                                                 | Cases | Seconds | Verdict                                | Reason                                                                                            |
| -------------------------------------------------------------------- | ----- | ------- | -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `tests/acceptance/source/kits/ansible.test.ts`                       | 1     | 18.1    | keep                                   | one wiring case                                                                                   |
| `tests/acceptance/source/kits/astro.test.ts`                         | 5     | n/a     | trim to 3, one install                 | two rows repeat the generation test                                                               |
| `tests/acceptance/source/kits/bash/checks.test.ts`                   | 33    | 59.4    | trim                                   | keep ShellCheck and shfmt; 30 engine rows move to an in-process table                             |
| `tests/acceptance/source/kits/bash/lifecycle.test.ts`                | 4     | 15.5    | trim                                   | keep init then check; one case checks the text format                                             |
| `tests/acceptance/source/kits/bash/syntax.test.ts`                   | 3     | 8.2     | move to the tools tier                 | host Bash, Zsh, and Bats with only `apply`                                                        |
| `tests/acceptance/source/kits/codeql.test.ts`                        | 4     | 278.5   | trim to 1                              | recommended and all assert the same findings; the JavaScript row repeats the adapter test         |
| `tests/acceptance/source/kits/component-files/accessibility.test.ts` | 2     | 40.6    | merge into the vue and svelte files    | the Vue alt-text row is a third-party rule                                                        |
| `tests/acceptance/source/kits/component-files/formatting.test.ts`    | 1     | 16.9    | merge into the svelte file             | real plugin wiring                                                                                |
| `tests/acceptance/source/kits/component-files/styles.test.ts`        | 2     | 36.3    | merge into the vue and svelte files    | on shared installs                                                                                |
| `tests/acceptance/source/kits/component-files/testing.test.ts`       | 2     | 44.3    | move to generation                     | ESLint configuration, repeated in the React test                                                  |
| `tests/acceptance/source/kits/component-files/types.test.ts`         | 3     | 98.1    | merge into the vue and svelte files    | keep the type checks and the takeover of tsc                                                      |
| `tests/acceptance/source/kits/components.test.ts`                    | 8     | 187.5   | merge into the vue and svelte files    | one ESLint row per framework; 18 cases in 16 installs become 9 cases in 3                         |
| `tests/acceptance/source/kits/css.test.ts`                           | 5     | 21.0    | trim to 1                              | one row is a third-party rule; three repeat the integration test                                  |
| `tests/acceptance/source/kits/dependencies.test.ts`                  | 9     | 18.6    | move and delete                        | six engine rows move; three repeat integration tests                                              |
| `tests/acceptance/source/kits/docker.test.ts`                        | 6     | 30.1    | trim to 3                              | keep compose, hadolint, and trivy                                                                 |
| `tests/acceptance/source/kits/documents.test.ts`                     | 11    | 0.005   | trim to 4, investigate                 | its cases do not run on Linux; two repeat integration tests                                       |
| `tests/acceptance/source/kits/duplication.test.ts`                   | 1     | 6.4     | keep                                   | jscpd wiring                                                                                      |
| `tests/acceptance/source/kits/express.test.ts`                       | 3     | 36.3    | trim to 1                              | two rows repeat integration tests                                                                 |
| `tests/acceptance/source/kits/fastapi.test.ts`                       | 4     | 48.9    | trim to 1                              | keep pytest coverage; the blocking-call check goes; one install fewer                             |
| `tests/acceptance/source/kits/files.test.ts`                         | 13    | 73.3    | trim to 11, one install                | six installs become one                                                                           |
| `tests/acceptance/source/kits/html.test.ts`                          | 4     | 10.7    | trim to 1                              | keep html-validate                                                                                |
| `tests/acceptance/source/kits/jest.test.ts`                          | 3     | 28.2    | trim to 2                              | one row checks a rule setting                                                                     |
| `tests/acceptance/source/kits/libraries.test.ts`                     | 6     | 44.7    | move                                   | ESLint rows to generation, engine rows to the CLI tier; the Zod row repeats configuration arrival |
| `tests/acceptance/source/kits/licenses.test.ts`                      | 5     | 36.6    | trim to 1                              | one journey on one install                                                                        |
| `tests/acceptance/source/kits/naming.test.ts`                        | 2     | 2.3     | merge into the naming integration test | engine only                                                                                       |
| `tests/acceptance/source/kits/nestjs.test.ts`                        | 7     | 56.3    | trim to 2                              | keep the clean module and the plugin row                                                          |
| `tests/acceptance/source/kits/nextjs/checks.test.ts`                 | 7     | 77.7    | merge into one nextjs file             | keep the type check; the build row runs webpack twice                                             |
| `tests/acceptance/source/kits/nextjs/delegation.test.ts`             | 3     | 95.5    | merge into one nextjs file             | three installs become one                                                                         |
| `tests/acceptance/source/kits/nextjs/selection.test.ts`              | 9     | 271.3   | merge and move                         | keep one row; the rest repeat generation tests or belong to init                                  |
| `tests/acceptance/source/kits/nginx.test.ts`                         | 3     | 15.0    | trim to 2                              | merge the two `nginx -t` cases                                                                    |
| `tests/acceptance/source/kits/platforms.test.ts`                     | 11    | 39.7    | trim to 1                              | keep the Deno check; the Cloudflare and Supabase engine rows move                                 |
| `tests/acceptance/source/kits/postgres.test.ts`                      | 10    | 21.9    | trim to 1                              | keep squawk; the rest are engine rows or repeats                                                  |
| `tests/acceptance/source/kits/python/docstrings.test.ts`             | 4     | 104.8   | move to generation                     | four full installs to test a style setting                                                        |
| `tests/acceptance/source/kits/python/structure.test.ts`              | 14    | 55.8    | move to the CLI tier                   | all 14 are engine checks                                                                          |
| `tests/acceptance/source/kits/python/tools.test.ts`                  | 11    | 109.2   | trim to 8                              | keep the real tools                                                                               |
| `tests/acceptance/source/kits/react.test.ts`                         | 15    | 171.8   | trim to 2                              | one row per third-party rule; nine move to generation                                             |
| `tests/acceptance/source/kits/secrets/pushed.test.ts`                | 4     | 31.8    | trim assertions                        | real history journeys; drop the report reads                                                      |
| `tests/acceptance/source/kits/secrets/staged.test.ts`                | 3     | 16.1    | trim to 1                              | three installs become one                                                                         |
| `tests/acceptance/source/kits/security.test.ts`                      | 2     | 65.3    | trim to 1                              | one case installs everything to read a stage list                                                 |
| `tests/acceptance/source/kits/sql.test.ts`                           | 5     | 16.3    | trim to 1                              | keep sqlfluff                                                                                     |
| `tests/acceptance/source/kits/static-site.test.ts`                   | 12    | 494.3   | trim to 2                              | keep the broken build and the clean run; stop linking `node_modules`                              |
| `tests/acceptance/source/kits/structure.test.ts`                     | 10    | 34.6    | move and delete                        | engine checks; the suppression census goes                                                        |
| `tests/acceptance/source/kits/svg.test.ts`                           | 2     | 56.3    | merge into static-site                 | the same kit                                                                                      |
| `tests/acceptance/source/kits/swift/checks.test.ts`                  | 14    | 24.0    | trim to 3                              | keep SwiftLint, SwiftFormat, and the header case                                                  |
| `tests/acceptance/source/kits/swift/package.test.ts`                 | 3     | 3.7     | keep, gate to macOS                    |                                                                                                   |
| `tests/acceptance/source/kits/swift/scopes.test.ts`                  | 1     | 14.5    | keep                                   |                                                                                                   |
| `tests/acceptance/source/kits/swift/security.test.ts`                | 1     | 37.8    | delete                                 | other tests cover every part                                                                      |
| `tests/acceptance/source/kits/typescript/eslint.test.ts`             | 4     | 80.7    | move to generation                     | configuration assertions, each paying for an install                                              |
| `tests/acceptance/source/kits/typescript/javascript.test.ts`         | 1     | 18.3    | keep                                   |                                                                                                   |
| `tests/acceptance/source/kits/typescript/planted-checks.test.ts`     | 15    | 178.7   | trim to 9                              | keep the real tools; the plugin row repeats its unit test                                         |
| `tests/acceptance/source/kits/typescript/projects.test.ts`           | 6     | 90.3    | move to the tools tier, trim to 4      | real tsc with no install                                                                          |
| `tests/acceptance/source/kits/vite.test.ts`                          | 1     | 33.8    | move to generation                     | the entry exceptions are ESLint configuration                                                     |
| `tests/acceptance/source/kits/vitest.test.ts`                        | 2     | 50.8    | trim to 1                              | keep coverage                                                                                     |
| `tests/acceptance/source/kits/xcode.test.ts`                         | 12    | 11.9    | trim to 1                              | keep the macOS plist row                                                                          |
| `tests/acceptance/source/kits/xctest.test.ts`                        | 5     | 11.5    | move and delete                        | four engine rows move                                                                             |

**The packed package, in `tests/acceptance/package`**

| File                                                 | Cases | Verdict                     | Reason                                                                                                       |
| ---------------------------------------------------- | ----- | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `tests/acceptance/package/install/languages.test.ts` | 4     | trim to one shared consumer | four identical consumers each install their tools                                                            |
| `tests/acceptance/package/install/launcher.test.ts`  | 3     | trim to 2                   | the uninstall and restore parts go                                                                           |
| `tests/acceptance/package/install/reports.test.ts`   | 1     | merge into languages        | the report assertions go                                                                                     |
| `tests/acceptance/package/install/tools.test.ts`     | 5     | trim to 2                   | two shared consumers, without message wording                                                                |
| `tests/acceptance/package/lifecycle.test.ts`         | 3     | trim, move                  | it tests the runner script; keep the refusal and one signal                                                  |
| `tests/acceptance/package/pins.test.ts`              | ~156  | delete from pull request CI | one network call per pin; a scheduled workflow instead                                                       |
| `tests/acceptance/package/plugin.test.ts`            | 2     | trim to 1                   | publish and install once; 76 lines of exact rule messages shrink to load, configurations, one rule per level |

### D.5 Tests to add

These real scenarios have no test, or only a test that stops short. They are ranked by how badly a failure hurts users.
Six look like bugs from reading the code; the first test of each confirms or clears it. Tiers use the target names of
D.1.

| #   | Scenario                                                                                                                                                                                                                                                                        | Code                                                                                                     | Tier        | Test                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Likely bug.** A repository tracks a link to a folder, an absolute path, a path outside the repository, or a missing file. The snapshot writes every tracked link through the lifecycle checks, which refuse all four, so the commit hook exits 2 on every commit.             | `packages/cli/src/repository/revisions/contents.ts:41`, `packages/cli/src/platform/root/reads.ts:42`     | integration | commit the four links; `check --staged` and the push check exit by findings alone                                                                  |
| 2   | **Likely bug.** The first install is killed after the new tool folder is swapped in and before the log records it. The next install refuses the folder gspot made.                                                                                                              | `packages/cli/src/lifecycle/ownership/installs.ts:36`                                                    | integration | build that state, as `tests/integration/cli/lifecycle/ownership/bounded-state.test.ts:57` already does, then install again: the folder is replaced |
| 3   | **Likely bug.** A crash leaves the writer lock behind with the ID of an unrelated process, or empty. Process 1 throws a permission error, and any live process gets "retry after it finishes", which never happens. Two real processes, `apply` during `install`, are untested. | `packages/cli/src/platform/root/writes.ts:104`                                                           | integration | a lock holding `1:x` or nothing: exit 2 with a message that names the lock; a second `apply` during a slow `install` exits 2                       |
| 4   | The commit hook runs with a staged `.env` file                                                                                                                                                                                                                                  | `packages/cli/src/commands/check/selection.ts:40`                                                        | integration | `git add -f .env`, then `check --staged --json`: exit 1, the env-files check fails, no tool runs                                                   |
| 5   | `gspot remove` is never run by any test: removal, a kit that another kit requires, a kit not listed, `--scope`, pruning outputs, dropping the npm install                                                                                                                       | `packages/cli/src/commands/kits.ts:60`                                                                   | integration | remove javascript: its outputs and its installed npm tools go; remove typescript while react needs it: exit 2 and the chain named                  |
| 6   | **Likely bug.** With `--json`, a command that fails with a plain error prints nothing on standard output                                                                                                                                                                        | `packages/cli/src/commands/program.ts:46`, `packages/cli/src/commands/print-result.ts:27`                | integration | an edited generated file, then `apply --json`: one JSON object with the error, exit 2                                                              |
| 7   | A commit that changes only `gspot.toml` rechecks every file the per-file checks own                                                                                                                                                                                             | `packages/cli/src/execution/planning/files.ts:73`                                                        | integration | tighten `limits.file_lines`, stage only `gspot.toml`: the file now too long is reported                                                            |
| 8   | Two paths that differ only by case, in a snapshot on macOS or Windows, and a generated file renamed by case                                                                                                                                                                     | `packages/cli/src/repository/revisions/contents.ts:53`, `packages/cli/src/lifecycle/ownership/log.ts:98` | integration | both spellings in the index: success or a clear selection error; a case rename: apply follows one defined rule                                     |
| 9   | Git worktrees: init, install, the hook, and the snapshot inside `git worktree add`, which coding agents use often                                                                                                                                                               | `packages/cli/src/repository/revisions/contents.ts:233`, `packages/cli/src/lifecycle/hooks.ts:23`        | integration | in a worktree, a real commit with a defect is blocked                                                                                              |
| 10  | Detecting the package manager of the tool project: a `+sha512` suffix, a `devEngines` range, a lockfile alone, no Bun installed                                                                                                                                                 | `packages/cli/src/tools/packages/identity.ts:33`                                                         | unit        | each input yields the right client and version, or a refusal                                                                                       |
| 11  | A failed reinstall keeps the working tools, as the `install` help promises                                                                                                                                                                                                      | `packages/cli/src/tools/packages/project.ts:95`                                                          | tools       | change a pin, make the registry answer 404: exit 2, the old tools still run, no temporary folder left                                              |
| 12  | Several fixers, one failing midway                                                                                                                                                                                                                                              | `packages/cli/src/execution/fixers.ts:189`                                                               | integration | three fixers, the first exits 3: order holds, later fixers run, exit 2, other edits stay                                                           |
| 13  | `check --fix --dry-run` through the CLI                                                                                                                                                                                                                                         | `packages/cli/src/commands/check/content.ts:18`                                                          | integration | a format defect: a diff on standard output, the file unchanged                                                                                     |
| 14  | Invalid flag combinations and bad pre-push input                                                                                                                                                                                                                                | `packages/cli/src/commands/check/run.ts:13`, `packages/cli/src/commands/check/push.ts:13`                | integration | `--staged --fix`, `--push --fix`, garbage or non-UTF-8 on standard input: exit 2, working tree untouched                                           |
| 15  | A staged check during a merge conflict, or with non-UTF-8 file names in the index                                                                                                                                                                                               | `packages/cli/src/repository/revisions/contents.ts:94`                                                   | integration | exit 2 with a clear message and no snapshot folder left                                                                                            |
| 16  | Repositories with SHA-256 object names                                                                                                                                                                                                                                          | `packages/cli/src/repository/revisions/contents.ts:78`                                                   | integration | `git init --object-format=sha256`: the same verdicts as with SHA-1                                                                                 |
| 17  | An analysis outside the engine wrapper throws, and every result is lost                                                                                                                                                                                                         | `packages/cli/src/execution/execute.ts:122`                                                              | integration | decide the behavior (that check errors, the rest survive), then pin it                                                                             |
| 18  | `init` in a repository that already has `gspot.toml`                                                                                                                                                                                                                            | `packages/cli/src/commands/init/command.ts:91`                                                           | integration | exit 2 with the already-initialized error; nothing changes                                                                                         |
| 19  | A file that init takes over changes or vanishes between the plan and the write                                                                                                                                                                                                  | `packages/cli/src/commands/init/write.ts:49`                                                             | integration | init refuses and writes nothing                                                                                                                    |
| 20  | `add` or `remove` when the install fails after the policy was written                                                                                                                                                                                                           | `packages/cli/src/commands/kits.ts:18`                                                                   | integration | exit 2 and a message that says to run `gspot install`                                                                                              |
| 21  | The refusals of `set`, run through the command                                                                                                                                                                                                                                  | `packages/cli/src/commands/set.ts:45`                                                                    | integration | a scope-only key without `--scope`, a tool rule turned off, a key without a value, an undeclared scope: exit 2                                     |
| 22  | `set` or `ignore` when apply fails after `gspot.toml` was written                                                                                                                                                                                                               | `packages/cli/src/commands/policy.ts:21`                                                                 | integration | pin whether the policy keeps the change                                                                                                            |
| 23  | Drift kinds of `apply --dry-run` other than a missing file: changed, stray, conflict, an edited managed block                                                                                                                                                                   | `packages/cli/src/lifecycle/drift.ts:28`                                                                 | integration | each kind with its diff, nothing written                                                                                                           |
| 24  | An `[[ignore]]` with a rule and paths, per scope in the generated configuration                                                                                                                                                                                                 | `packages/cli/src/policy/merge.ts:18`                                                                    | unit        | `paths = ["api/**"]` turns the rule off in `api` and below only                                                                                    |
| 25  | Nested scope precedence for limits per language and for tool settings; the code walks the outermost table first, so the root may win                                                                                                                                            | `packages/cli/src/policy/merge.ts:30`                                                                    | unit        | the deepest scope wins everywhere                                                                                                                  |
| 26  | Edge cases of `ignore`: an unknown check, removing an entry that does not exist, removing one rule                                                                                                                                                                              | `packages/cli/src/commands/ignore.ts:15`                                                                 | integration | exit codes and a byte-identical file where nothing matched                                                                                         |
| 27  | Profiles from `https://` and `github:owner/repo`, a 404, an `http://` address                                                                                                                                                                                                   | `packages/cli/src/policy/profiles/read.ts:14`                                                            | unit        | the address mapping, the refusal of plain HTTP, nothing written after a 404                                                                        |
| 28  | The change report of `doctor` and its exit code for an outdated tool                                                                                                                                                                                                            | `packages/cli/src/commands/doctor/changes.ts:19`                                                         | integration | a new Python file after init shows up with `gspot add python`; an outdated tool exits 1                                                            |
| 29  | Install guards: uv writes credentials into the lock, or a tool project file changes during an install                                                                                                                                                                           | `packages/cli/src/tools/python-project.ts:143`, `packages/cli/src/tools/packages/project.ts:77`          | tools       | both refused, nothing written                                                                                                                      |
| 30  | **Likely bug.** The lockfile host check never reads `npm-shrinkwrap.json`, which its parser supports; Yarn and pnpm hosts are untested                                                                                                                                          | `packages/cli/src/checks/dependencies/lockfile/hosts.ts:35`                                              | integration | a foreign host in each lockfile is reported                                                                                                        |
| 31  | Plugin rules that read paths, with Windows file names and a drive letter in another case                                                                                                                                                                                        | `packages/eslint-plugin/src/files.ts:16`                                                                 | unit        | the same verdicts as with POSIX paths                                                                                                              |
| 32  | `no-client-environment` with bracket access and custom prefixes                                                                                                                                                                                                                 | `packages/eslint-plugin/src/rules/no-client-environment.ts:73`                                           | unit        | public keys allowed, secret and computed keys reported                                                                                             |
| 33  | `globPaths` refuses patterns that leave the folder, and ends on a link loop                                                                                                                                                                                                     | `packages/cli/src/platform/paths.ts:163`                                                                 | unit        | a parent path, an absolute path, and a negated parent path throw; a loop ends                                                                      |
| 34  | Positional paths outside the repository, a path that matches nothing, a missing message file                                                                                                                                                                                    | `packages/cli/src/commands/check/selection.ts:22`                                                        | integration | exit 2 with the right error for each                                                                                                               |

These areas are well covered already, so new tests there repeat old ones. They are the recovery of the ownership log,
the lockfiles, cancellation, push ranges, the crash-or-finding contract, policy parsing, and most plugin rules. No source file is entirely unexercised. Still, 165 CLI files are reached only
through spawned CLI runs, and branches such as `removeCommand`, the refusals of `checkStaged`, and the failures of the
writer lock never run in any test.

## Appendix E: every page of the documentation

Every page of the docs site, the generators of its reference pages, the homepage, and every Markdown file outside the
rules corpus were read and checked against the code. 58 findings are bloat. 101 go stale or are wrong: 86 go stale when
this audit lands, 7 depend on an open question, and 8 are false today.

### E.1 Every page

| Page                                                                | Verdict                                                                            | Lines now and after                        |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------ |
| `docs/src/content/docs/404.md`                                      | keep                                                                               | 19                                         |
| `docs/src/content/docs/guides/overview.md`                          | rewrite: a table of what gspot writes, links for the rest                          | 52 to about 25                             |
| `docs/src/content/docs/guides/install.md`                           | shorten: the upgrade steps and tool list repeat other pages                        | 85 to about 50                             |
| `docs/src/content/docs/guides/quick-start.md`                       | keep; re-record the transcript after the renames                                   | about 236                                  |
| `docs/src/content/docs/guides/existing-repository.md`               | shorten: the backup and restore promises go                                        | 59 to about 40                             |
| `docs/src/content/docs/guides/findings.md`                          | shorten: the report files and coverage sections go                                 | 104 to about 60                            |
| `docs/src/content/docs/guides/customize.md`                         | shorten; the one home for levels, ignores, apply, upgrades                         | 121 to about 100                           |
| `docs/src/content/docs/guides/agents.md`                            | rewrite for rules and the new layout                                               | 51 to about 30                             |
| `docs/src/content/docs/guides/check-automation.md`                  | rewrite: hook internals and SARIF uploads go                                       | 102 to about 60                            |
| `docs/src/content/docs/guides/generated-files.md`                   | shorten: cache, reports, and recovery go                                           | 48 to about 32                             |
| `docs/src/content/docs/guides/scopes.md`                            | shorten: kit defaults and an SVG section that is not about scopes                  | 108 to about 70                            |
| `docs/src/content/docs/guides/profiles.md`                          | shorten                                                                            | 54 to about 40                             |
| `docs/src/content/docs/guides/without-mise.md`                      | rewrite: two sections describe one flag                                            | 62 to about 40                             |
| `docs/src/content/docs/guides/project-checks.md`                    | shorten: the cache inputs go; settings renamed                                     | 120 to about 90                            |
| `docs/src/content/docs/guides/testing.md`                           | shorten: Swift internals move to the kit pages                                     | 90 to about 55                             |
| `docs/src/content/docs/guides/dependency-licenses.md`               | shorten: exit codes repeat the command page                                        | 46 to about 32                             |
| `docs/src/content/docs/guides/security.md`                          | shorten; add the actions kit                                                       | 66 to about 50                             |
| `docs/src/content/docs/guides/troubleshooting.md`                   | shorten: cache and build cache paths go; document `GSPOT_JOBS`                     | 79 to about 55                             |
| `docs/src/content/docs/guides/uninstall.md`                         | delete, with `docs/public/brand/diagrams/recovery.svg`                             | 57 to 0                                    |
| `docs/src/content/docs/guides/build.md`                             | merge into `CONTRIBUTING.md`, then delete                                          | 158 to 0                                   |
| `docs/src/content/reference/definitions.ts`                         | shorten the text of 210 check pages; delete the engines page                       | check page tail from about 110 words to 25 |
| `docs/src/content/reference/commands.ts`                            | its parser of the `Effects:` help heading throws once that heading goes            | small                                      |
| `docs/src/content/reference/policy.ts`                              | shorten two introductions                                                          | about 310 words to 65                      |
| `docs/src/content/reference/page.ts`                                | drop the source link at the top of every page; the edit link already exists        | one line                                   |
| `docs/src/content/reference/collection.ts`                          | check pages under `/reference/checks/`, no engines page, no link to `architecture` | small                                      |
| `docs/src/pages/index.astro` with the home and Starlight components | a Starlight splash page (open question)                                            | about 190 to 40                            |
| `docs/astro.config.ts`                                              | drop the uninstall entry, the development group, and the rules path                | minus 12                                   |
| `README.md`                                                         | shorten: the fourth copy of the example; five links instead of ten                 | 114 to about 70                            |
| `CONTRIBUTING.md`                                                   | rewrite, taking in the build page, the test tiers, and the harness                 | 68 to about 110                            |
| `AGENTS.md`                                                         | regenerate with `gspot apply` after the rename                                     | about 79                                   |
| `CLAUDE.md`                                                         | delete (open question)                                                             | 79 to 0                                    |
| `docs/README.md`                                                    | keep only the asset license notices                                                | 124 to about 20                            |
| `packages/cli/README.md`                                            | two edits: rules, and an exact install                                             | 30                                         |
| `packages/eslint-plugin/README.md`                                  | drop the deleted rule; document the options that lose their defaults               | about 95                                   |

### E.2 Bloat

| Where                                                                                                                                                 | Problem                                                                                                                          | Action                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `docs/src/content/docs/guides/overview.md:11`                                                                                                         | four bold paragraphs, 170 words that repeat install, agents, and hooks                                                           | a table of four rows with links                         |
| `docs/src/content/docs/guides/overview.md:32`, `docs/src/content/docs/guides/customize.md:34`, `AGENTS.md:5`                                          | the two levels explained three times, nearly word for word                                                                       | keep customize; one sentence and a link elsewhere       |
| `docs/src/content/docs/guides/overview.md:42`                                                                                                         | "One policy file" repeats customize and generated files                                                                          | delete                                                  |
| `docs/src/content/docs/guides/overview.md:24`, `docs/src/content/docs/guides/agents.md:8`, `docs/src/pages/index.astro:46`                            | the promise that code following the rules passes, three times                                                                    | one plain sentence in agents                            |
| `docs/src/content/docs/guides/install.md:62`, `docs/src/content/docs/guides/customize.md:103`, `docs/src/content/docs/guides/troubleshooting.md:42`   | the upgrade steps three times                                                                                                    | keep customize; link from the others                    |
| `docs/src/content/docs/guides/install.md:77`                                                                                                          | "Tools gspot runs" repeats two pages                                                                                             | delete; the Bash 4.4 line goes to the prerequisites     |
| `docs/src/content/docs/guides/install.md:58`, `docs/src/content/docs/guides/troubleshooting.md:36`, `docs/src/content/docs/guides/without-mise.md:60` | the lock rule three times                                                                                                        | keep install                                            |
| `docs/src/content/docs/guides/customize.md:6` and seven more places                                                                                   | "run `gspot apply` after you edit it by hand", eight times                                                                       | keep customize                                          |
| `docs/src/content/docs/guides/findings.md:30`, `:48`, `:73`, `:90`                                                                                    | explain and whole-project checks repeat scopes; a heading for two sentences; a `doctor` feature on this page                     | keep each once; fold or move                            |
| `docs/src/content/docs/guides/agents.md:32`, `:42`                                                                                                    | restates the managed block the agent reads; copies the hooks page                                                                | two sentences; delete the copy                          |
| `docs/src/content/docs/guides/check-automation.md:27`                                                                                                 | hook internals the reader never types                                                                                            | three sentences and one example                         |
| `docs/src/content/docs/guides/scopes.md:68`, `:90`                                                                                                    | kit defaults, and an SVG check that has nothing to do with scopes                                                                | one sentence; delete the SVG section                    |
| `docs/src/content/docs/guides/profiles.md:17`, `:52`                                                                                                  | edge cases and advice                                                                                                            | one sentence; delete the advice                         |
| `docs/src/content/docs/guides/without-mise.md:31`                                                                                                     | two sections describe `--no-runner`                                                                                              | one section                                             |
| `docs/src/content/docs/guides/security.md:16`, `:42`                                                                                                  | reassurance and a list of kit details                                                                                            | one sentence and a link                                 |
| `docs/src/content/docs/guides/dependency-licenses.md:30`, `:42`                                                                                       | exit codes of the check command; internals                                                                                       | delete                                                  |
| `docs/src/content/docs/guides/testing.md:69`, `:74`, `:86`                                                                                            | SwiftLint internals, the xctest kit page repeated, Xcode membership that is not about tests                                      | shorten, link, move to the Xcode kit                    |
| `docs/src/content/docs/guides/troubleshooting.md:66`                                                                                                  | Swift build cache paths per system                                                                                               | delete                                                  |
| `README.md:32`                                                                                                                                        | the fourth copy of the example, with the fixed file                                                                              | keep the agent file and the transcript                  |
| `README.md:96`                                                                                                                                        | ten links to repository files, whose names differ from the page addresses                                                        | five links to gspot.dev                                 |
| `docs/src/pages/index.astro:41`, `:47`, `:56`, `:29`, `:9`, `:17`                                                                                     | the example twice, a setup grid with a different command, three calls to action, one heading four times, a logo strip, six cards | one example, three cards, no call to action             |
| `docs/src/content/docs/guides/build.md:101`, `:130`                                                                                                   | one-time publishing chores; a list of CI jobs that goes stale with every rename                                                  | three lines in `CONTRIBUTING.md`; point to the workflow |
| `docs/README.md:1`, `:33`, `:85`, `:112`                                                                                                              | setup, writing rules, review steps, and a logo prompt, all repeated or history                                                   | delete                                                  |
| `CONTRIBUTING.md:3`                                                                                                                                   | "None of them needs a GitHub run."                                                                                               | delete                                                  |
| `docs/src/content/reference/definitions.ts:176`                                                                                                       | 75 words about exit codes on each of 210 check pages                                                                             | the command only; exit codes once on the check page     |
| `docs/src/content/reference/definitions.ts:53`, `:121`                                                                                                | "Scope: selected file lists under the applicable scope policy" and "Kind: language" on 210 pages                                 | "Runs: per file, per scope, or once"; delete the kind   |
| `docs/src/content/reference/definitions.ts:109`, `docs/src/content/reference/policy.ts:115`                                                           | kits called "configuration"                                                                                                      | "kit"                                                   |
| `docs/src/content/reference/commands.ts:62`                                                                                                           | the `-C` sentence on every command page                                                                                          | once, on the commands index                             |
| `docs/src/content/reference/policy.ts:9`, `:100`                                                                                                      | a 200-word settings introduction that repeats scopes; a JSON Schema primer                                                       | two sentences and a link; one sentence                  |
| `docs/src/content/docs/guides/check-automation.md:2`, `docs/src/content/docs/guides/project-checks.md:2`                                              | file names differ from their addresses, so contributor links point to the wrong name                                             | rename the files and drop `slug`                        |

### E.3 Stale once the audit lands

| Topic                        | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Action                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| uninstall and backups        | `docs/src/content/docs/guides/uninstall.md`, `docs/astro.config.ts:87`, `docs/src/content/docs/guides/agents.md:47`, `docs/src/content/docs/guides/existing-repository.md:3`, `:8`, `:31`, `:59`, `docs/src/content/docs/guides/generated-files.md:41`, `docs/src/content/docs/guides/troubleshooting.md:58`, `README.md:104`, `docs/src/content/docs/guides/profiles.md:23`, and the init help at `packages/cli/src/commands/init/command.ts:127`                                                       | delete; say that git keeps replaced files                                                               |
| report files                 | `docs/src/content/docs/guides/findings.md:79`, `:103`, `docs/src/content/docs/guides/check-automation.md:73`, `:82`, `:101`, `docs/src/content/docs/guides/generated-files.md:38`, `CONTRIBUTING.md:65`, `docs/src/content/docs/guides/build.md:135`, and the check help at `packages/cli/src/commands/check/command.ts:136`                                                                                                                                                                             | delete; keep `gspot check --json`                                                                       |
| result cache                 | `docs/src/content/docs/guides/project-checks.md:101`, `--no-cache` in `docs/src/content/docs/guides/project-checks.md:57`, `docs/src/content/docs/guides/testing.md:17`, `docs/src/content/docs/guides/security.md:61`, `docs/src/content/docs/guides/troubleshooting.md:63`, and the command on 210 check pages at `docs/src/content/reference/definitions.ts:170`                                                                                                                                      | delete; the check pages show `gspot check --only <id>`                                                  |
| inline `gspot-ignore`        | the finding help at `packages/cli/kits/language/bash/manifest.toml:204` and `packages/cli/kits/general/structure/manifest.toml:108`                                                                                                                                                                                                                                                                                                                                                                      | point to `gspot ignore` with the new check ID                                                           |
| guides become rules          | `docs/src/content/docs/guides/overview.md:22`, `docs/src/content/docs/guides/agents.md:3`, `:27`, `docs/src/content/docs/guides/customize.md:31`, `docs/src/content/docs/guides/generated-files.md:14`, `docs/src/content/docs/guides/quick-start.md:236`, `README.md:27`, `packages/cli/README.md:20`, `docs/src/pages/index.astro:23`, the init and apply help, `docs/src/content/reference/definitions.ts:9`, and `AGENTS.md`                                                                         | rules; regenerate `AGENTS.md` with `gspot apply`                                                        |
| "rule" meaning a lint rule   | 16 places in overview, customize, findings, agents, troubleshooting, and `README.md:69`                                                                                                                                                                                                                                                                                                                                                                                                                  | "tool rule"                                                                                             |
| check IDs                    | `CONTRIBUTING.md:50`, `docs/src/content/docs/guides/dependency-licenses.md:41`, `docs/src/content/docs/guides/scopes.md:90`, `packages/cli/kits/general/files/manifest.toml:234`, `docs/src/content/docs/guides/findings.md:39`, `docs/src/content/docs/guides/customize.md:52`                                                                                                                                                                                                                          | the IDs of appendix A.5, and one `javascript/eslint`                                                    |
| recorded example             | `docs/src/content/docs/guides/quick-start.md:176`, `README.md:53`, and the recorded JSON of the homepage                                                                                                                                                                                                                                                                                                                                                                                                 | re-record through the example acceptance test                                                           |
| settings renamed             | `docs/src/content/docs/guides/security.md:30`, `docs/src/content/docs/guides/dependency-licenses.md:12`, `docs/src/content/docs/guides/testing.md:27`, `:34`, `:47`, `:49`, `docs/src/content/docs/guides/scopes.md:86`, `docs/src/content/docs/guides/project-checks.md:77`, `:89`, `:97`, `:109`, `:118`, `docs/src/content/docs/guides/customize.md:22`, `docs/src/content/docs/guides/without-mise.md:49`, `docs/src/content/reference/policy.ts:24`, `docs/src/content/reference/definitions.ts:45` | the names of appendices A.3 and A.4; drop `version = 1`                                                 |
| `--stage` becomes `--hook`   | `docs/src/content/docs/guides/check-automation.md:53`, `docs/src/content/docs/guides/security.md:27`, `docs/src/content/docs/guides/testing.md:17`, `docs/src/content/docs/guides/build.md:127`                                                                                                                                                                                                                                                                                                          | `--only` already selects checks of every stage; running every manual check needs a decision (section 1) |
| check pages and engines page | `docs/src/content/reference/collection.ts:61`, `:9`, `:55`, `docs/src/content/reference/definitions.ts:65`, `:192`, `docs/astro.config.ts:107`, `:118`                                                                                                                                                                                                                                                                                                                                                   | `/reference/checks/`; delete the engines page and the development group                                 |
| tasks, tiers, CI             | `CONTRIBUTING.md:10`, `:33`, `:39`, `:68`, `docs/src/content/docs/guides/build.md:16`, `docs/README.md:3`, `README.md:4`, `docs/src/pages/index.astro:59`                                                                                                                                                                                                                                                                                                                                                | the new task names, tiers, and harness; links to `CONTRIBUTING.md`                                      |
| the plugin                   | `packages/eslint-plugin/README.md:29`                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | drop the deleted rule; document the options that lose their defaults                                    |
| open questions               | the Cursor rule and `.gitattributes` block, `--allow-dirty` and `--runner`, the coverage report, source positions, `fix_order`, the custom homepage, `CLAUDE.md`                                                                                                                                                                                                                                                                                                                                         | follow the answers in section 1                                                                         |

### E.4 False today

| Where                                                                                                      | Problem                                                                                 | Action                                   |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------- |
| `docs/README.md:9`                                                                                         | links the user install page as the source setup                                         | link `CONTRIBUTING.md`                   |
| `docs/README.md:103`                                                                                       | describes a hero image that no page uses                                                | delete the sentence and both image files |
| `docs/src/content/docs/guides/build.md:26`                                                                 | calls the package "gspot"; it is `@gspothq/cli`                                         | fix the name                             |
| `docs/src/content/docs/guides/build.md:107`                                                                | `mise run build` does not build the plugin                                              | add `mise run build:plugin`              |
| `docs/src/content/docs/guides/without-mise.md:26`                                                          | the list of runners leaves out mise                                                     | add it                                   |
| `docs/src/content/docs/guides/without-mise.md:50`                                                          | says every table names its tool; `[hooks]` names none                                   | fix the sentence                         |
| `docs/src/content/docs/guides/overview.md:13`                                                              | says gspot installs every tool into `.gspot`; native tools come from mise or the system | "npm and Python tools"                   |
| `docs/src/content/docs/guides/install.md:16`, `packages/cli/README.md:12`, `docs/src/pages/index.astro:50` | install without `--save-exact`; a newer gspot than the pin makes six commands refuse    | `--save-exact` everywhere                |

## Appendix F: every file of the agent rules

All 99 files in `packages/cli/guides` were read and checked against the shipped templates, `policy.json`, and the
code. The corpus is 11,662 lines. About 4,060 of them go through edits, and about 520 more if the front matter goes
too, which leaves about 7,100 lines.

Four facts shape the cuts:

- **Levels are applied already.** `packages/cli/src/agents/sections.ts` strips the sections marked for level all at
  level recommended. The paragraph "Requirements about vocabulary… apply at all" tells an agent nothing, and it sits in
  65 files.
- **Front matter loses its reader.** Only the guide linter reads `layer`, `kit`, and `title`, and it goes. Assembly
  takes the kit from the manifest and the title from the first heading.
- **Eleven files install as empty shells** at level recommended. Every section in them is marked for level all:
  the two general naming files, the eight naming files per language, and the commitlint file.
- **The rules teach code that the shipped linters reject** (F.3). Fix those first, with the eight lines damaged by an
  old bulk rename, which no check catches.

### F.1 Every file

**`packages/cli/guides/general`**

| File                     | Lines now and after | Verdict                                                                 |
| ------------------------ | ------------------- | ----------------------------------------------------------------------- |
| agent `GIT.md`           | 54 to 42            | rewrite; takes the commitlint essentials                                |
| agent `PLANNING.md`      | 118 to 45           | shorten: one project's taste, and the order rules twice                 |
| agent `SUPPRESSIONS.md`  | 24 to 20            | rewrite: no suppression count; say how `[[ignore]]` accepts a finding   |
| agent `TALKING.md`       | 9                   | owner decides: ASD-STE100 is one owner's taste; merge into `WRITING.md` |
| agent `WORKING.md`       | 140 to 95           | shorten; the subagent rule is one owner's preference                    |
| code `ACCESSIBILITY.md`  | 52 to 42            | shorten                                                                 |
| code `CLI.md`            | 51 to 46            | keep                                                                    |
| code `COMMENTS.md`       | 90 to 45            | rewrite: the same rules twice in one file                               |
| code `CONFIGURATION.md`  | 51 to 44            | keep; the eight copies elsewhere go                                     |
| code `DEPENDENCIES.md`   | 43 to 38            | keep                                                                    |
| code `ERRORS.md`         | 68 to 50            | shorten; the six copies elsewhere go                                    |
| code `GENERATED.md`      | 27 to 22            | keep                                                                    |
| code `LOGGING.md`        | 62 to 52            | keep                                                                    |
| code `NAMING-FILES.md`   | 202 to 95           | rewrite: describes how two checks work; repeats testing                 |
| code `NAMING.md`         | 175 to 120          | shorten; the banned retrieval verbs are this repository's vocabulary    |
| code `SECRETS.md`        | 96 to 35            | shorten: the docs part moves to the docs rules                          |
| code `SECURITY.md`       | 79 to 72            | keep                                                                    |
| code `TESTING.md`        | 122 to 95           | rewrite: `tests/support` becomes the harness setting                    |
| prose `DOCS.md`          | 223 to 150          | shorten                                                                 |
| prose `DOCS-CONTENT.md`  | 173 to 145          | shorten                                                                 |
| prose `DOCS-FORMAT.md`   | 182 to 130          | shorten                                                                 |
| prose `DOCS-MEDIA.md`    | 148 to 110          | shorten                                                                 |
| prose `DOCS-REVIEW.md`   | 180 to 50           | delete the nine checklists that restate the other files                 |
| prose `DOCS-SURFACES.md` | 146 to 110          | shorten                                                                 |
| prose `WRITING.md`       | 175 to 140          | shorten: Vale enforces most of the numbers and punctuation              |

**`packages/cli/guides/language`**

| File                   | Lines now and after | Verdict                                                                           |
| ---------------------- | ------------------- | --------------------------------------------------------------------------------- |
| `BASH.md`              | 249 to 170          | rewrite: restates ShellCheck; another project's conventions                       |
| bash `LANGUAGE.md`     | 247 to 190          | shorten                                                                           |
| bash `OPERATIONS.md`   | 241 to 130          | rewrite: another project's server, model, and checkpoint conventions              |
| bash `SAFETY.md`       | 248 to 185          | shorten; merge the portability part from `BASH.md`                                |
| `CSS.md`               | 48 to 44            | keep                                                                              |
| `HTML.md`              | 57 to 45            | shorten: html-validate enforces most of it                                        |
| `JAVASCRIPT.md`        | 205 to 60           | rewrite: nearly the same as `TYPESCRIPT.md`; keep what is specific to JavaScript  |
| `PYTHON.md`            | 249 to 190          | shorten: how the rules were derived is not a rule                                 |
| python `DESIGN.md`     | 169 to 155          | keep                                                                              |
| python `FLOW.md`       | 178 to 140          | shorten: Ruff enforces two sections                                               |
| python `PACKAGING.md`  | 166 to 110          | shorten: three layout trees become one                                            |
| python `TYPING.md`     | 160 to 150          | rewrite: an inline `gspot-ignore` example                                         |
| `SQL.md`               | 37 to 30            | keep                                                                              |
| `SWIFT.md`             | 170 to 160          | rewrite: a TODO format that SwiftLint rejects                                     |
| `TYPESCRIPT.md`        | 211 to 165          | rewrite: an example that the shipped ESLint rejects; history                      |
| `YAML.md`              | 37 to 28            | rewrite: yamllint enforces half; the front matter names a kit that does not exist |
| naming `BASH.md`       | 114 to 60           | shorten: this repository's numbered file prefix                                   |
| naming `CSS.md`        | 31 to 22            | rewrite: BEM contradicts the shipped class pattern                                |
| naming `HTML.md`       | 30 to 22            | keep                                                                              |
| naming `JAVASCRIPT.md` | 119 to 55           | merge into the TypeScript naming file as a short delta                            |
| naming `PYTHON.md`     | 126 to 60           | rewrite: the case rules twice; examples from one machine-learning project         |
| naming `SQL.md`        | 159 to 110          | shorten; the Supabase parts move to the Supabase rules                            |
| naming `SWIFT.md`      | 121 to 112          | keep                                                                              |
| naming `TYPESCRIPT.md` | 194 to 120          | shorten                                                                           |

**`packages/cli/guides/framework`, `library`, `platform`, `database`, `repository`, `runtime`, `shared`, `tool`, and `templates`**

| File                                                         | Lines now and after          | Verdict                                                              |
| ------------------------------------------------------------ | ---------------------------- | -------------------------------------------------------------------- |
| astro `ASTRO.md`                                             | 66 to 55                     | rewrite: `interface Props`, which the shipped rules reject           |
| express `API.md`                                             | 88 to 50                     | shorten or merge into `EXPRESS.md`                                   |
| express `EXPRESS.md`                                         | 129 to 80                    | shorten: a 45-line example with project constants                    |
| express `OPENAPI.md`                                         | 63 to 55                     | keep                                                                 |
| fastapi `FASTAPI.md`                                         | 249 to 110                   | rewrite and wire into the kit; never installed today                 |
| fastapi `RUNTIME.md`                                         | 248 to 0                     | merge into `FASTAPI.md`                                              |
| nestjs `NESTJS.md`                                           | 65 to 58                     | rewrite                                                              |
| nextjs `NEXTJS.md`                                           | 249 to 215                   | shorten; assumes three libraries                                     |
| nextjs `SECURITY.md`                                         | 208 to 0                     | delete; one product's stack; 15 lines move to `NEXTJS.md`            |
| react-native, react, svelte, uikit, vue                      | 71, 107, 74, 95, 70          | keep, minus the accessibility lines that repeat the general rules    |
| swiftui `SWIFTUI.md`                                         | 112 to 85                    | shorten                                                              |
| drizzle, react-hook-form, tanstack-query, trpc, zod, zustand | 249, 243, 249, 233, 183, 175 | shorten each by about 20% to 30%: version history, repeated sections |
| next-intl `NEXT-INTL.md`                                     | 50 to 43                     | keep                                                                 |
| supabase `SUPABASE.md`                                       | 238 to 150                   | shorten: one project's setup                                         |
| postgres `POSTGRES.md`                                       | 200 to 150                   | rewrite: one project's choices; an example the SQL rules forbid      |
| static-site `STATIC-SITE.md`                                 | 90 to 70                     | shorten; takes in the browser rules                                  |
| browser `BROWSER.md`                                         | 33 to 0                      | merge into `STATIC-SITE.md`                                          |
| bun, deno, node, workers                                     | 25, 26, 43, 35               | keep, trimmed                                                        |
| http `HTTP.md`, i18n `I18N.md`                               | 65 to 45, 157 to 85          | shorten: i18n says each topic twice                                  |
| commitlint `COMMITLINT.md`                                   | 32 to 0                      | delete; commitlint enforces it, and `GIT.md` keeps three sentences   |
| docker `DOCKER.md`                                           | 195 to 150                   | shorten: hadolint enforces the pins                                  |
| github-actions `GITHUB-ACTIONS.md`                           | 66 to 55                     | rewrite: its front matter names the cloudflare kit                   |
| nginx, playwright, tailwind, xctest                          | 58, 46, 39, 92               | keep                                                                 |
| tasks `TASKS.md`                                             | 38 to 30                     | rewrite: this repository's task names                                |
| vitest `VITEST.md`                                           | 146 to 60                    | shorten: nearly word for word from the testing rules                 |
| xcode `XCODE.md`                                             | 55 to 48                     | rewrite                                                              |
| templates `docs` (8 files)                                   | 453 to 0                     | delete; never installed                                              |

### F.2 Bloat across files

- The level paragraph in 65 files (about 285 lines). Delete it; assembly applies levels.
- Lists of what each linter reports, in 25 files. The agent sees these as findings, and the lists drift: one names terms
  that `policy.json` does not hold. One sentence in a base file replaces them.
- The same rule sits in many files. Reading the environment in one place has 8 copies, and error disclosure has 6.
  No history in comments has 7, generated output 4, exact pins 3, and no speculative handling 3. Keep each rule in one
  file.
- Examples from other projects: `run_ssh`, `nvidia-smi`, `server_start`, model names, `HF_TOKEN`, Tiptap, `resend`,
  legal pages, Cloudflare request data, and a chat proxy. Use neutral examples.
- The corpus uses owner 236 times, contract 275 times, boundary 130 times, and declared 136 times. Many of those
  sentences carry no action.

### F.3 Rules that contradict the shipped configuration or each other

| Where                                                                                                                                                                                       | Rule                                                    | Conflicts with                                                                                                         | Action                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `packages/cli/guides/language/JAVASCRIPT.md:193`, `packages/cli/guides/language/TYPESCRIPT.md:148`, `packages/cli/guides/language/SWIFT.md:141`, `packages/cli/guides/language/BASH.md:231` | a TODO format with an issue or a date                   | `packages/cli/guides/general/code/COMMENTS.md:85` bans TODO; the shipped ESLint and SwiftLint rules reject that format | ban TODO everywhere            |
| `packages/cli/guides/language/TYPESCRIPT.md:187`                                                                                                                                            | a good example that uses `reduce`                       | the shipped `unicorn/no-array-reduce`                                                                                  | a `for…of` loop                |
| `packages/cli/guides/language/TYPESCRIPT.md:184` and three more                                                                                                                             | examples named with nouns                               | `packages/cli/guides/general/code/NAMING.md:89`: a function name starts with its action                                | rename the examples            |
| `packages/cli/guides/framework/astro/ASTRO.md:27`                                                                                                                                           | `interface Props`                                       | the shipped `consistent-type-definitions: type`                                                                        | `type Props`                   |
| `packages/cli/guides/language/naming/CSS.md:19`                                                                                                                                             | BEM class names                                         | the shipped kebab-case class pattern                                                                                   | drop BEM                       |
| `packages/cli/guides/language/naming/BASH.md:56` and the bash rules                                                                                                                         | `tmp_dir`, `tmp_file`                                   | `policy.json` bans `tmp` and `temp`                                                                                    | change the names or the policy |
| `packages/cli/guides/framework/vue/VUE.md:64`                                                                                                                                               | `useThing`                                              | `policy.json` bans `thing`                                                                                             | `useCart`                      |
| `packages/cli/guides/platform/supabase/SUPABASE.md:127`                                                                                                                                     | a `functions/shared` folder                             | a folder named `shared` is banned; Supabase uses `_shared`                                                             | `_shared`                      |
| `packages/cli/guides/database/postgres/POSTGRES.md:52`                                                                                                                                      | `CREATE TABLE IF NOT EXISTS`                            | `packages/cli/guides/language/SQL.md:21` forbids hiding schema drift                                                   | `CREATE TABLE`                 |
| `packages/cli/guides/framework/express/EXPRESS.md:47`                                                                                                                                       | a cast as the good example                              | the API and TypeScript rules: a cast neither validates nor narrows                                                     | narrow through the auth helper |
| `packages/cli/guides/general/agent/GIT.md:29`                                                                                                                                               | a subject under 72 characters                           | commitlint counts the whole header                                                                                     | "header"                       |
| `packages/cli/guides/general/code/COMMENTS.md:36`                                                                                                                                           | no double hyphens                                       | the `--` reason syntax of ESLint and the suppressions check                                                            | exempt tool directives         |
| `packages/cli/guides/general/code/NAMING-FILES.md:54`                                                                                                                                       | bans a `support` folder, then requires `tests/support`  | itself and `packages/cli/guides/general/code/TESTING.md:62`                                                            | the harness setting            |
| `packages/cli/guides/general/agent/WORKING.md:55`, `:52`, `:132`                                                                                                                            | tests and full runs only when asked; no deprecated code | the Postgres, Supabase, i18n, Docker, and Playwright rules ask for them; public interfaces need deprecation            | say which rule wins            |
| `packages/cli/guides/language/JAVASCRIPT.md:129`                                                                                                                                            | no decorators                                           | NestJS, which the nestjs kit supports                                                                                  | the TypeScript wording         |
| `packages/cli/guides/framework/astro/ASTRO.md:21`, and the Svelte and Vue rules                                                                                                             | PascalCase file names                                   | the React and TypeScript naming rules: kebab-case for every file                                                       | pick one                       |

### F.4 Stale once the audit lands

- The words this guide and the guides, in about 40 places, become these rules.
- `tests/support` in `packages/cli/guides/general/code/TESTING.md:62`, `packages/cli/guides/general/code/NAMING-FILES.md:28`,
  and `packages/cli/guides/language/naming/PYTHON.md:33` becomes the harness setting. Section 5.5 says three
  languages; only Python mentions it.
- Inline `gspot-ignore` examples in `packages/cli/guides/language/python/TYPING.md:142` and both fastapi files become
  `gspot ignore`.
- Check IDs that change (appendix A.5), such as the fastapi check that goes and the `structure/` prefix of the bash
  checks, and one plugin rule name (appendix A.12).
- The front matter of `YAML.md` and `TASKS.md` names a `configs` kit; `GITHUB-ACTIONS.md` names cloudflare. Their
  kits are files and the new actions kit.
- 26 kit manifest entries name general rules that every repository gets anyway (section 4).
- Eight lines carry damage from an old rename. "Required kit is invalid" means configuration, and "trusted owns" means
  claims. They sit in the Express, NestJS, Xcode, Postgres, docs review, i18n, and template files.
