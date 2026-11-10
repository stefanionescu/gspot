# Changelog

## 0.4.1

gspot 0.4.1 installs a mise tool only when one of its checks has a file to read, installs syncpack only in JavaScript
repositories, and runs the CI job with the Node.js that `mise.toml` pins. `WRITING.md` and `WORKING.md` gain four rules.
The ESLint plugin moves to 0.2.6, with no change to its rules.

### Upgrade from 0.4.0

1. Install 0.4.1 with your package manager, such as `npm install --save-dev --save-exact @gspothq/cli@0.4.1`. With a
   mise pin, raise the version in `mise.toml` and run `mise install`.
2. Run `gspot install`. It installs only the mise tools whose checks have a file to read. Without the `javascript`
   configuration, `.gspot/package.json` drops syncpack, and a Vue repository without `typescript` drops vue-tsc. With CI
   on and a Node.js pin in `mise.toml`, the workflow now installs that version.
3. Commit `.gspot/`, the rule files, and the workflow that changed.

After you add the first file of a new kind, such as the first `.env` file, run `gspot install` again. Until then, its
check reports the tool as missing. The files under `.gspot/` stay the same.

From 0.3.9, follow the 0.4.0 steps. 0.4.1 no longer names the flags, commands, and keys that 0.4.0 removed: an old hook
script with `gspot check --stage` stops on an unknown option, and `limits.min_function_statements` stops as an unknown
key. Rename it to `trivial_function_statements` first.

### Known issues

- When a staged file also has unstaged edits, a commit checks a copy of what you staged, and a test file that imports
  `eslint` can get false type errors there. Stage the rest of the file, or commit it separately.
- Node.js 22 ships an npm older than 11.19.0, which `gspot init` and `gspot install` need. On Node.js 22, run
  `npm install --global npm@latest` first.
- A `.gitattributes` rule above the gspot block still loses to `* text=auto eol=lf`, because `gspot install` keeps the
  order of a block that exists. Move such a rule below the block.

### Highlights

#### Fixes

- `gspot install` installs a mise tool only when one of its checks has a file to read. A repository with no `.env` file
  no longer gets dotenv-linter, and one with no Markdown file no longer gets lychee. The files under `.gspot/` still pin
  every tool, so they stay the same when files come and go, and `gspot doctor` reports only the tools that
  `gspot install` installs. (23b12c1)
- `dependencies/syncpack` runs, and gets installed, only with the `javascript` configuration, and reads only a
  `package.json` below the root, where a workspace keeps its packages. A check that needs a configuration the scope does
  not select, such as `vue/vue-tsc` without `typescript`, no longer installs its tool either. (5db5201, 44cbf51)
- The CI workflow installs the Node.js that `mise.toml` pins, and runs the dependency installs with it, so CI runs the
  version that your machine runs. Without a pin, it keeps the version that gspot pins for CI. (ec6e98d)

#### Rules

- `WRITING.md` asks documentation and comments to name a setting, parameter, or config entry instead of copying its
  value, and asks for a fresh read of the code, with its `file:line`, before a claim about what the code does. The
  `COMMENTS.md` rule on copied values moves into it. (a642b63)
- `WORKING.md` keeps an analysis or a discussion read-only until the user allows changes, as it did for a review or a
  plan. (a642b63)
- `WORKING.md` forbids piping a test, a check, or a CI command into `head`, `tail`, or `grep`, because a pipe reports the
  exit code of its last command and a failed run looks like a pass. (2fcb057)

#### Documentation

- The site serves one `llms.txt`, with the supported languages and tools, then the steps to try and to set up gspot.
  (e5dd377)
- Each topic page has one job and a short title, and the upgrade page names the release age setting without its
  default. (b54ea75, 2f8e569)

### Development

Doc comments that only restated a name are gone, and so are the tests that another test already proved. The messages for
the flags, commands, and keys of 0.3.9 are gone too. (c0f925e, c6da4d8, af44b84, 8d01b2c, eb1c039, faf2b47, 0f1d984)

Released 2026-11-10. [Compare with 0.4.0](https://github.com/stefanionescu/gspot/compare/v0.4.0...v0.4.1)

## 0.4.0

gspot 0.4.0 removes `gspot baseline`, `gspot check --stage`, and `gspot check --changed`, so a hook script or CI line
from 0.3.9 stops until you change it. Several `gspot.toml` keys and `[[ignore]]` records stop every command with exit 2,
and generated configs move to a shorter path. A repository that used a baseline sees its old findings again. A commit
now reports old findings only in the files it touches. `gspot check --fix` no longer rewrites SQL, spelling, or
environment files, and `gspot scan` no longer runs your tests or your build. Read the upgrade steps before you install.

### Upgrade from 0.3.9

1. Install 0.4.0 with your package manager, such as `npm install --save-dev --save-exact @gspothq/cli@0.4.0`. With a
   mise pin, raise the version in `mise.toml` and run `mise install`. Each commit now stops on
   `gspot check --stage was removed` until step 3.
2. Edit `gspot.toml` by hand, because `gspot set` stops on the same errors. `gspot install` names only some bad keys in
   each run, so repeat it until it stops naming them.
    - Rename each `limits.min_function_statements` and `limits.<language>.min_function_statements` to
      `trivial_function_statements`, with the same value.
    - Delete `type-enum` and `scope-enum` from `tools.commitlint.rules`, and set `commits.types` or `commits.scopes`.
    - Give a `[[command_check]]` with the ID `commit` or `push` a new ID.
    - Delete each `[[ignore]]` of `gspot/baseline`, `bash/doc-comments`, or `swift/doc-comments`. Rename
      `ansible/ansible-lint-production` to `ansible/ansible-lint`.
    - Delete each `.gspot/rules/` entry for `NODE.md`, `BUN.md`, `JEST.md`, `VITEST.md`, `PYTEST.md`, `PACKAGING.md`, or
      `YAML.md` from `rule_files.exclude`.
    - With a `[licenses]` table or a `[[licenses.allowed_package]]` record and no `licenses` configuration, run
      `gspot add licenses`, or delete them.
    - Delete `jsdoc/require-jsdoc` and `jsdoc/require-description` from `tools.eslint.rules`. No command names these,
      and `javascript/eslint` exits 2 on them after step 3. Breaking changes says how to keep them.
3. Run `gspot install`. It writes the new hooks, moves the generated configs, and deletes the old tree and the removed
   rule files. A hook manager that calls `.gspot/hooks/*` needs no change.
4. Delete `gspot.baseline.json`. `format/prettier` can report the file if you keep it, because `.prettierignore` stops
   listing it.
5. Replace the old flags in your scripts and CI jobs. `--stage commit` becomes `--only commit`, `--stage push` becomes
   `--only push`, and `--changed` becomes `--base origin/main`, with your default branch. So
   `gspot check --changed --stage push` becomes `gspot check --base origin/main --only push`. The generated CI job needs
   no edit.
6. Drop the group folder from each path that you wrote by hand to a generated config, such as an editor setting or a CI
   script. `.gspot/configurations/language/javascript/knip.json` becomes `.gspot/configurations/javascript/knip.json`.
7. With shell scripts, run `gspot check --only bash/shfmt`. If it reports a script with another indent, run
   `gspot check --fix --only bash/shfmt`. Or write a `[[format.override]]` with the extensions you have, such as
   `paths = ["**/*.sh"]` and `indent_width = 4`, then run `gspot install`.
8. Update each script that reads `--json` output, with the JSON output changes below.
9. Stage `gspot.toml`, your package manifest and lockfile, `.gspot/`, and the other generated files, then commit them
   together. The hook reads only what you staged, so old findings in other files do not stop it. A blank line left by a
   hand edit fails `data-files/taplo-format`, and the report prints the fix.
10. Run `gspot check --base origin/main` before you push. The upgrade commit changes `gspot.toml` and `.gspot/`, so this
    run and the CI run read every file and list what the baseline hid. Fix each finding, or run
    `gspot ignore <check> --rule <rule> --paths <old files> --reason "<why>"` and commit. A check that lists no rules
    takes `--paths` alone. If `gspot/detected-configurations` fails, run the `gspot add` line that it prints. Then
    push. On this push, `gspot/weakenings` prints `compared no settings` if the old `gspot.toml` held a key that step 2
    changed.
11. In each other clone, install the dependencies, such as with `npm ci`, and run `gspot install`. Until then its hooks
    stop with `This repository pins gspot 0.4.0; this is gspot 0.3.9.`

### Breaking changes

Commands and flags:

- `gspot baseline`, with `--prune` and `--only`, the check `gspot/baseline`, and the file `gspot.baseline.json` are
  gone. Each form exits 2 and says to fix old findings or ignore them with a reason. Old findings come back in
  `gspot check`, in commits that touch their files, and in push checks. (ded0427, 1f7eeb6)
- `gspot check --stage <commit|push>` is gone, in the `--stage=push` form too. It exits 2 and names
  `gspot check --only <commit|push>`. A hook script from 0.3.9 stops the same way until `gspot install`. (84432d4,
  81abc4b, 1f7eeb6)
- `gspot check --changed` is gone. It exits 2 and names `--base origin/main` and `--base origin/HEAD`. When a clone
  lacks `origin/HEAD`, the error says to run `git remote set-head origin --auto`. (99a0bb0, 4ce3522)
- `gspot check --only commit` and `--only push` run that stage at your level, and any other name in the list exits 2.
  (81abc4b)
- `gspot scan --markdown` is gone: run `gspot scan`, and put its report in a code fence.
  `gspot init --no-configurations` is gone: run `gspot init --configurations <one name>`, then
  `gspot remove <each name> --reason "<why>"`. Each exits 2 and prints its replacement. (1ee3d57)
- A bare `gspot unignore` exits 2, where it deleted every path ignore without asking. Name a check, or pass `--paths`.
  (0da77ea)
- `add`, `remove`, `set`, `unset`, `ignore`, and `unignore` exit 2 when the repository pins another gspot version, as
  `check` and `install` did. `gspot doctor` prints the mismatch and exits 1. (46cf966)
- From a subfolder, a `--scope` value that starts with `.` exits 2, because `--scope .` named the repository root. Write
  the path from the root. (c16f102)
- `gspot doctor` no longer suggests configurations or lists lint commands. `gspot/detected-configurations` and
  `gspot/conflicting-configs` report them. (54645ef)
- `gspot scan` exits 2 in a repository that tracks no file, and says to run `git add`. It reported 0 files and 0
  findings. (9e45d2b)
- `gspot set tools.<tool>.rules` exits 2 on a rule that the tool does not have, with
  `gspot does not know rule <rule> of <check>.` It wrote the value before. (35d24d1, 7d2d4da)

`gspot.toml`:

- `limits.min_function_statements` and each `limits.<language>.min_function_statements` stop every command with exit 2.
  Write `trivial_function_statements`, with the same value. The error names the new key. (c5d4756)
- `type-enum` and `scope-enum` in `tools.commitlint.rules` stop every command with `Set commits.types instead.` or
  `Set commits.scopes instead.` `gspot init` lists one from a replaced commitlint config as dropped. (ea85d9b)
- A `[licenses]` table or a `[[licenses.allowed_package]]` record with no `licenses` configuration stops every command,
  because its check never ran. Run `gspot add licenses`, or delete them. `gspot remove licenses` now deletes both.
  (a600c5e, 5fefb2c)
- A `[[command_check]]` with the ID `commit` or `push` stops every command, because `--only` reads those names as
  stages. Give it a new ID. (81abc4b)
- An `[[ignore]]` of `gspot/baseline`, `bash/doc-comments`, `swift/doc-comments`, or `ansible/ansible-lint-production`
  stops every command with `There is no check called <check>.` `--only` and `--skip` refuse them too. (ded0427, b6d7a1c,
  95aa5a0)
- Options for `jsdoc/require-jsdoc` or `jsdoc/require-description` in `tools.eslint.rules` stop `javascript/eslint`,
  with `gspot does not run jsdoc/require-jsdoc at level <level>, so it takes no options.` Delete them. (76e32b6,
  01ecf72)

JSON output:

- In `gspot check`, `baselined` is gone, and `checks[].command` comes only with `--verbose`. `comparison` and `fixes`
  are always present, and `null` when empty. So is `canceled` in `gspot check --hook pre-push`. (ded0427, 00767f3,
  72aa622)
- `skippedCount` counts each check once and leaves out a check that another scope ran. In `gspot scan`, `totals.checks`
  counts each check once. (292577a)
- `gspot list` gives the `cause` `replaced` to a nested scope that another run covers. (10638d7, f00ad95, 1910509)
- A finding `file` outside the checked folder is no longer absolute. A file outside the repository is relative to the
  root, such as `../shared/a.ts`, and a package that a copy run reports starts at the root. (94c1c04)
- In `gspot doctor`, `suggestions` is gone and `pin` is new. `ci.provider`, `ci.file`, `hooks.tool`, and `hooks.lines`
  are always present. (54645ef, 46cf966, 72aa622)
- An edit command that changes nothing prints `written`, `updated`, `deleted`, and `unchanged` as empty lists. (72aa622)
- `gspot explain` gives each optional key of its check, lint rule, setting, and file forms the value `null`.
  `turnOff.paths` is `null` for `gspot/weakenings`, because that ignore exits 2. (72aa622, c42a3af)
- In `gspot scan`, `leftOut` is new, and each `categories` item adds `rules`. Its `examples` now come from the largest
  rule. (5a7efb8, a69bb60)
- In `plan.carryover`, an `.editorconfig` row now names `indent_size`, `max_line_length`, `indent_style`, `quote_type`,
  and `sections`, in place of the Prettier words such as `tabWidth`. (292577a)
- The `message` of a `gspot.toml` error ends with a line that names the settings page. (a0a4b37)
- No command prints the error code `copy`, because the refusals that raised it are gone. (c270f3e, e4a1578)

Text output:

- Without `--verbose`, text output holds no absolute path. A failed commit message prints its rerun path from the
  current folder, such as `.git/COMMIT_EDITMSG`, and a note prints paths from the repository root. (00767f3, dc14b64, 4cfe3ac)
- The summaries of `gspot check` and `gspot scan` count a check once, under its worst result, so a count in a repository
  with scopes gets smaller. (292577a)
- A refused import says `from rule "features"` where it said `from import-rule:features`. (c0ce02c)
- A `help:` line ends with `Details: gspot explain <check>`. (35d24d1, 5ec3cee)
- `gspot list` prints `on in . and 2 scopes` where it named each scope, and `skipped (replaced)` for a covered test
  scope. (e5d58d6, 10638d7)
- `gspot list settings` heads its column `needs a reason when`, with `you add items`, `you lower it`, or `you raise it`.
  The JSON `reasonFor` values stay. (4da5cc3)
- Each `gspot.toml` error ends with `https://generativespotting.com/reference/gspot-toml/ lists every setting.` An
  unknown key named `gspot list settings`, which stops on the same key, and other errors named no page. (a0a4b37,
  4ce3522)
- `gspot unignore` prints `Removed 1 ignore of <check> for <path>`. (8595567)
- `gspot explain` prints `Ignore it only with a reason your team accepts.` where it told the reader to ask the user.
  (048b030)

Generated files and paths:

- Generated configs move from `.gspot/configurations/<group>/<configuration>/` to
  `.gspot/configurations/<configuration>/`. `gspot install` writes the new tree and deletes the old one. A path that you
  wrote by hand needs its group folder removed. (d890afd)
- npm, pnpm, and Bun hooks start gspot from `node_modules/.bin`, and need `node` on the `PATH` that your Git client
  gives hooks. They name that `PATH` when `node` is missing. Yarn and mise keep their launchers. (89dfa7e)
- `.editorconfig` no longer takes an indent from your `.sh` and `.bash` files, so its `[*.{sh,bash}]` section goes and
  `bash/shfmt` reports a script with another indent. `gspot init` records that indent as a `[[format.override]]`.
  (437dabf)
- A `.pre-commit-config.yaml`, a Lefthook file, or a `simple-git-hooks` key counts as installed hooks only when
  `.git/hooks` holds an executable hook. Otherwise `gspot install` sets `core.hooksPath`, so commits start to run the
  checks. (cbe9910)
- In `.gitattributes`, `.gspot/hooks/**` is `linguist-generated=false`, and the CI workflow leaves the block, so both
  show in a review. The generated GitHub workflow no longer gives `MISE_GITHUB_TOKEN` to its install step. (17eac17)
- The block in `AGENTS.md` is one sorted list. It says "Before you finish a change, stage it and run
  `gspot check --staged --only commit`." (64e53a6)

Checks that newly fail:

- `structure/empty-folders` runs at every level and fails a commit on a folder that holds no files, directly or through
  its subfolders. A folder that holds only `.gitkeep` or `.keep` fails a commit only when the commit touches that file.
  Delete the folder. (e60245b, 09f0e2d)
- `structure/import-rules` now reads the types that a Swift file names, so a repository with `[[import_rule]]` on Swift
  sees new findings for a crossing inside one target. Move the code, or change the `[[import_rule]]`. (0d6e1c2)
- At level `all`, SwiftLint now reads `limits.swift.max_cyclomatic_complexity`, where gspot wrote a key that names no
  rule. A Swift function fails above 8, where SwiftLint's default of 10 applied. Level `basic` keeps that default. At
  every level, `gspot/suppressions` reports a `swiftlint:disable` of `cyclomatic_complexity`. Split the function, or
  raise the limit with a reason. (9339592, 097f82c)
- A `package.json` with only gspot's tools plus `vitest` or `wrangler` now selects that configuration and `javascript`,
  and a nested one becomes a scope. `gspot/detected-configurations` fails until you run `gspot add vitest` or
  `gspot add cloudflare`, with `--scope` for a nested package, then `gspot install`, or `gspot remove` with a reason.
  The Vitest tests of such a repository then run at push. (6b7ddc0)
- A full `secrets/gitleaks-staged` scan now reports a secret in a tracked file that an ignore pattern names, and leaves
  out a file that `.git/info/exclude` ignores. It stops reading submodules. (bf83786)
- A commit that only deletes a file now runs `docs/missing-paths`, `site/build`, and the other checks that an edit runs.
  That includes a deleted task in `mise-tasks`. (a337c75, 6563d98)

Checks that stop running or report less:

- A commit reads only what you staged, so a staged `gspot.toml` no longer runs every check on every file. A
  repository-wide check reports a finding when its file is staged or the staged change causes it. `gspot check` and a
  push still read everything, and `--base` does when `gspot.toml` or `.gspot/` changed. (2705d6c)
- `gspot check --fix` no longer runs `typos`, `sqlfluff`, or `dotenv-linter`, and Ruff no longer fixes `F401`. Each
  stays a finding that you correct by hand. (f0b9547, 71f5497, 1253651, b723b14)
- At level `basic`, ESLint and Ruff stop reporting unused suppressions, so `gspot check --fix` no longer deletes one
  that names an `all` rule. Level `all` still reports them. (b723b14)
- Doc comments are no longer required. `bash/doc-comments` and `swift/doc-comments` are gone, and SwiftLint's
  `missing_docs`, `jsdoc/require-jsdoc`, `jsdoc/require-description`, and Ruff's `D100` to `D107` are off at every
  level. At level `all`, an ESLint or Ruff suppression for one of them fails as unused, and `gspot check --fix` removes
  it. To keep Ruff's, name each code in `tools.ruff.rules`, because a bare `D` no longer reaches them. To keep the
  JSDoc rules, add a `[[tools.eslint.plugins]]` record with `package = "eslint-plugin-jsdoc"`. (76e32b6, b6d7a1c,
  82da594, 9434f67)
- With a path, `gspot check` reports only the findings in that path. A run on `src/a.ts` dropped findings in other
  tracked files and kept those under `node_modules` or in build output, so it can now exit 0 where it exited 1.
  `gspot check`, `gspot check .`, and the hooks still report them. (d77a34c)
- `jsdoc/check-param-names` accepts a doc comment that leaves out some parameters, and no longer checks destructured
  field names. It still reports a wrong name. (76e32b6, 2bb1bcb)
- `ansible/ansible-lint` takes its profile from the generated `ansible-lint.yml`: moderate at `basic`, production at
  `all`. An ignore written at `basic` now also applies at `all`. (95aa5a0)
- Vitest and Jest run only where a test config sits. A package with no config leaves its tests to an enclosing scope. A
  run leaves out each nested scope that runs its own tests, so tests run once on a push. (f00ad95, 1910509)
- ShellCheck drops `--check-sourced`, so a staged script no longer reports the file that it sources. A sourced file with
  no shell tag goes unchecked. (7f1178a)
- `javascript/knip` skips a repository with no `package.json`, and no longer reports files that Git ignores. (597216e,
  bd1c232)

Removed rule files:

- `TALKING.md`, `NODE.md`, `BUN.md`, `JEST.md`, `VITEST.md`, `PYTEST.md`, `PACKAGING.md`, and `YAML.md` are gone from
  `.gspot/rules/`, and `gspot install` deletes them. A `rule_files.exclude` entry that names one stops every command,
  and a doc of yours that names one fails `docs/missing-paths`. (64e53a6)

### Known issues

- When a staged file also has unstaged edits, a commit checks a copy of what you staged, and a test file that imports
  `eslint` can get false type errors there. Stage the rest of the file, or commit it separately.
- Node.js 22 ships an npm older than 11.19.0, which `gspot init` and `gspot install` need. On Node.js 22, run
  `npm install --global npm@latest` first.
- A `.gitattributes` rule above the gspot block still loses to `* text=auto eol=lf`, because `gspot install` keeps the
  order of a block that exists. Move such a rule below the block.

### Highlights

#### First run

- In a Swift repository on a machine without the Swift grammar, `gspot scan`, `init`, `install`, and `check` all stopped
  with `The swift grammar is not installed. Run gspot install.`, and `gspot install` needs a `gspot.toml`. Each command
  now downloads the grammar first, so this also fixes a new CI runner. (638a874)
- `gspot scan` runs no tests, no build, no project install, and no check that loads project code. It lists those checks
  under `Not run in a scan, because they run your code`. It still loads your Prettier config and runs your installed
  ESLint, Stylelint, and TypeScript. (5a7efb8)
- The scan report lists the five largest rules of each category with one `gspot ignore` line, and takes its examples
  from the largest. What did not run groups by cause. A check that refuses `--rule` gets a `--paths` line. (a69bb60,
  ea88c22)
- The scan next steps end with committing the setup files and fixing each file as you touch it. In a mise repository
  they start with the Node.js pin. At a pnpm workspace root the install command holds `--workspace-root`. (a69bb60,
  d8ae8ba, 6049603)
- `gspot init` writes only the extensions the repository tracks in `[[format.override]]` and its pyright ignore, so
  `gspot/unmatched-paths` stops failing the setup commit on them. (94e9881, ed4dc57)
- A `package.json` with no dependency selects nothing, unless the repository holds a JavaScript or TypeScript file. It
  cost 200 MB of tools before. (0546834)
- `gspot init` lists Ruff's `I` as dropped, and names a format script that calls oxfmt or dprint. A pyright include
  stays one glob, and its Python comes from `requires-python`. (c568dfb, 0aca8e4, 31a5cf6)
- `gspot init` keeps a sorted `devDependencies` block sorted when it pins gspot, and writes the `.gitattributes` block
  before your rules in a new repository. (3569269, d176646)
- A `lib` or `target` name that the bundled compiler lacks no longer stops `gspot scan` and `gspot init`. `gspot init`
  no longer stops on the GitHub limit of 60 requests, and a failed install names `GITHUB_TOKEN`. (09cb0e9, beb643c)

#### Findings that no longer report correct code

- `prose/commit-message` lets a commit message say what changed, and a session link reports once, in
  `commits/references`. (a62a84d, eee4201)
- MD026 accepts a heading that ends with `?`, `package-json/valid-contributors` is off, and `bash/safety` accepts a
  function named like a command and the removal of a `mktemp` folder. (61d6ff7)
- `unicorn/require-array-sort-compare` and `unicorn/no-useless-coercion` are off, because TypeScript rules report the
  same code. (61d6ff7)
- `python/vulture` counts a route decorator as a use, `structure/shared-prefixes` leaves out pytest's `test_`, and the
  heading rule accepts GitHub Actions, React Hook Form, and TanStack Query. (9339592, 820bab2)
- A full secrets scan leaves out Git-ignored build output, `format/editorconfig-checker` leaves out TOML files that
  Taplo formats, and `jest/tests` stops reading console output as a failed test. (9339592, afa99bc, c196d3b)
- `docs/missing-paths` leaves out changelogs. A link that leaves the repository root reports nothing and no longer
  crashes `docs/lychee` or `site/lychee`, and a Windows file link reads as a path. (232f176, 158b943, a0a4cef, 56d3a66)
- `typescript/tsc` and `javascript/tsc` resolve a `types` entry from the tsconfig that names it, and a failed run names
  a workspace package that needs a build. (95cf206, abe633e, 5ec343c)
- A Drizzle raw SQL finding no longer tells you to turn off every lint selector in a file. A Ruff finding counts as
  fixable only when its fix is safe. (2184cd3, ba04c5b)

#### Install and hooks

- A commit copies the repository only when a staged file or `gspot.toml` also has unstaged edits. It used to copy for any
  untracked or unstaged file, so most commits ran in a copy, where a test file that imports `eslint` could get false
  type errors. In place, type-aware ESLint can read unstaged edits in other files. `tsc` at push and ESLint in CI read
  the real commit. (13cb6ed)
- A copy no longer stops on a folder with no lockfile, a tracked `node_modules`, Vale settings that differ from the
  installed packages, or two files whose names differ only by letter case. (c270f3e, e4a1578)
- Git writes each copy with `git checkout-index`, and `markdown/markdownlint` runs in place, where it made a copy on
  every commit that touched Markdown. (e4a1578, 945b3a1)
- `gspot install` passes `--inexact` to `uv sync`, so it no longer deletes an installed extra of a Python project.
  (616cad8)
- `gspot install` always fetches the HTML grammar that `gspot/suppressions` reads, so a Markdown commit no longer exits
  2 on a clean machine. (0667b47)
- A private registry token survives `NPM_CONFIG_USERCONFIG` under Bun 1.4.4, and a Bun package alias that names another
  package is refused. (0c35fd7, aa6510c)
- The package ships `dist/THIRD-PARTY-NOTICES.md` for its bundled packages. (3189583)
- A hook that stops on an old Node.js says that a Git client can give hooks another `PATH`. `gspot doctor` starts gspot
  as the hooks do, so it no longer reports a working hook as broken. (38c3629, 1a014e5)
- A pre-commit or Lefthook repository now gets a YAML block in place of a shell line, because both tools keep the push
  input from a shell line. (cbe9910)

#### Settings and messages

- `gspot set --reason` works on every key that holds a reason, and keeps a reason on a value that is not weaker. On
  `level`, `hooks.enabled`, and `rule_files.enabled` it exits 2 and names `gspot ignore gspot/weakenings`. (bef49cc)
- `gspot set` and `unset` print `This turns off <check>.` when an empty list turns a check off, and `gspot add` prints
  `<check> stays off until you set <setting>.` (418b1bc, 4ce3522)
- A note says when no check reads a naming key at your level, and `gspot list settings` hides 20 naming keys that `set`
  refuses. A configuration with no checks, such as `zustand`, says that it changes the lint rules. (bed31b7, 3292029)
- `gspot explain` and `gspot ignore` accept each rule name that a report prints, such as a Vale built-in or a Stylelint
  syntax error. A comment for a rule of a removed plugin says to delete it. (b3cbec8, a68206a, 158b943)
- `gspot explain swift/swiftlint <rule>` and `gspot ignore swift/swiftlint --rule <rule>` work on macOS and Linux, where
  both exited 2 for every rule. A failed lookup of a SwiftLint or Ruff rule now prints the check's help and exits 0.
  (618d49d)
- `gspot explain` on a rule of a configuration that no scope selects says `css is not selected. Run gspot add css, then
gspot install.` where it said to run `gspot install`, which did not help. (f344f74)
- `gspot doctor` prints the install help of a package that `gspot install` does not add, such as `pytest-cov`, and
  counts only npm packages as `missing npm packages`. With no mise on `PATH`, it says to install mise or the tools it
  names, and `gspot scan` and `gspot check` stop reporting `.gspot/mise.lock`. (01d9350, 07bf224)
- The package manager floor error names the upgrade, such as `Run npm install --global npm@latest.` A version read
  error says to run the command again, not `gspot install`. (78f971e, c601caa)
- `gspot init --from` lists under `left out of <file>` a setting of a configuration that the new repository does not
  select. It stopped on a `gspot.toml` that did not exist yet. (4c1cb15)
- `gspot set` on a naming key that takes its value from another names the key to set, where it asked for a reason and
  then refused. A hint for an unknown key prints the full key. (e84ab99)
- The `undo:` line of `gspot explain` prints a path from the current folder, so it works from a subfolder. A file that
  an ignore covers says `gspot unignore --paths <path>`, not a bare `gspot unignore`, which exits 2. (51f127b, 529719b)
- `gspot --version` before a command prints the version and runs nothing. A `help:` line names the `fix:` command only
  when one prints. The refusal of a rule's options says `gspot does not run <rule> at level <level>`. (cff449a, 4e37b57,
  01ecf72)
- The `origin/HEAD` error says to run `gspot check --only push` before the first push to an empty remote. The scan says
  files differ from the format that gspot uses, and it quotes a lint command in a script. (0d5d1ae, 4484b6f, 63ccdb4)
- A hand-written weaker value prints the form to write, where the `gspot set` line it printed stopped on the same value.
  (b27f291)
- `gspot unignore --paths` removes an ignore after its files are gone, and its note names the rule of an ignore that it
  cannot narrow. `--only a b` suggests commas when `b` is a check. (4ce3522, 8595567, 77aa6e8)
- A failed run names the command to write in place of `gspot` when `gspot` is not on your `PATH`. A fixer failure names
  its cause and file. `gspot remove` always stores its reason. (2120645, 639f005, a1c4a79)
- A missing system tool prints its own install help, and `Delete this line` points at the right line. The help of
  `spelling.allowed_words` and the package manager pin message name a form that works. (3c22996, 34a7e7f, 934fe3f,
  7d39f2d)
- One word now means a weaker setting. `gspot explain` names the configuration that owns a setting, and a root setting
  with `--scope` says to leave it out. (35d24d1)
- Help lines, check text, setting descriptions, and the generated reference pages now say what a reader can do.
  (4da5cc3, d897b45, e958bb0, 64ebcaa, b8be792, 8c0574c, 9168abb, 1cb92fb, 99ec37a, c25eca6, decda37, 71279c3, 6cf4a06,
  360b559, 7b52c95, 0fd3b13, c256dd6)

#### Speed

- npm, pnpm, and Bun hooks skip starting the package manager, which cost each hook about 150 ms. (89dfa7e)
- The fixers of one check run together, so `--fix` in a nine-scope sample took 3 s where it took 11 s. (6776be8)
- `docs/missing-paths` runs only when a doc, a task, or a path changes, and a deleted path still starts it. (3348f73)
- The bundle leaves out development builds of its packages, and hooks reuse the compiled `typescript` module. (57be5f6)

#### Rules for coding agents

- Rule text drops what a check already reports, what another rule says, and what agents already know. In a TypeScript
  and Bash sample at level `all`, the rule files and `AGENTS.md` went from 14,226 words to 8,460. (bb629a8, 44ef7a8,
  285bf53, f16da2d, 66d17c3, 81791d4, 86a9bb4, beb2119, 58bdc33, bc76504, a11b02d, 63454d5, 0a55cdb, b59d584, 38b43a2,
  0996054, 28c89d2, 4201527, d25a3ab, 1b09c88, e467d4e, 272be5d, 9adb1a2, 4ff49c1, cf1a29c, 384e97f, f3c1d6a, d09dfb4,
  ffd3bbb, 60f72b5, b3402af, 4e8cace, 1b02668, c8216e5, b60aafb, f98c0e6, 34a7404, 0214881, 8decd3b, eaecf8f, 152a3a4,
  14b8268, 6ea48a6, d5a6f98, 2ee91f8, 5ae80ee, 2dc4d2a, 5e4b5ee, 00cd8ee, 3573cb0, b62a91c, dbede20, 656b5a1, b3a73ef,
  f5164dd, 483c398, 74903c7, a4ccde5, ec13512, 38a8bf2, 3989ff0, 2657091, ca94f06, 76e4dc2, ecfc582, 3a9cae8, be7211a,
  0e0a67f, 671327e, 3942ce6, ad9943b, 98defde, d95aa3a)
- `WRITING.md` asks for connected prose and replaces its word list with one instruction. `TESTING.md` asks you to break
  the code before a new test stays. `GIT.md` says that a `feat` or `fix` subject says what changes for a user. (7d2de05,
  58454a7, 98992a2)
- Some lines now say more exactly when they apply, such as which booleans take a prefix, and that a time needs a time
  zone. `WORKING.md` says to delete an empty folder. (429bab1, 5c6cce7, 2e69c6e, b7a1c09, 1a0ace7, d838a56, 5a78b10,
  cfdecdd, 04f64db, 9e6e70f, e60245b)

#### ESLint plugin 0.2.5

- `gspot/no-unexplained-test-skips` reports a skipped test in a Karma project, where it read jasmine only by its own
  package. (e4dfeb2)
- `gspot/prefer-readonly-static` also checks `.mts` and `.cts` files. (4d3e616)
- `gspot/no-any-origin-messages` exempts only a handler that passes the event on, so one that reads the data with no
  origin check now reports. (dbfedff)
- `gspot/no-path-command` accepts any drive letter, where only `C:` counted as an explicit path. (6082b99)

#### Docs

- Each older section of this changelog now says what changed, what you see, and what to do. (f0acd43, fa1c6be, d1d286a,
  87d66db)
- `gspot init --from` has its own page, [Copy settings](https://generativespotting.com/start/copy-settings/). Page
  descriptions and field rows that repeated a name are gone. (5c7f8f5, d056cbc, 4d18692)
- The README and every page are rewritten in connected prose around what a reader does. The
  [Upgrade](https://generativespotting.com/start/upgrade/) page holds the steps from 0.3.9, and `/use/baseline`
  redirects to the Quickstart. (b3fd3b4, 4ce7401, 67846c6, 4245ffb, cbd0933, 5ac6d8e, b6c5a25, 1dad64b, 7845054,
  9ee940f, 83d1aeb, ba86564, b6dcb3a, e1a1443, 4807496, c859780, 6aa5c6d, 23b37aa, 35b6ca9, 9836548, d2abea1, 6de6abc,
  9fd299b, 32a64c6, fe60237, 67cc203, 129686d, 32ea351, 2f8812e, 7e98d0d, a05060a, 5f955f3, 2bac957, 50d450b, 811c23e)

### Development

Publishing and deployment are by hand, and the release workflow is gone. `mise run changelog` prints material, and
`CHANGELOG.md` is written by hand. CI tests Ubuntu on each push and all systems before a release, and about 120 commits
cut the test suite and moved slow tests to the unit suite. (8c4bacc, f1e772d, d90bdba, 3432b7a)

Released 2026-11-06. [Compare with 0.3.9](https://github.com/stefanionescu/gspot/compare/v0.3.9...v0.4.0)

## 0.3.9

gspot 0.3.9 removes `gspot apply`: `gspot install` now writes every generated file, and `gspot init` also installs the
tools and turns on the Git hooks. Three `gspot.toml` keys take new names, and every command exits 2 until you rename
them. The `--json` output of most commands changes. Level `basic` reports less in Bash, Python, and ESLint, and a plain
`gspot check` now scans every file for secrets. A committed baseline needs a prune. Read the upgrade steps before you
install.

### Upgrade from 0.3.8

1. Install 0.3.9 with your package manager, such as `npm install --save-dev --save-exact @gspothq/cli@0.3.9`. With a
   mise pin, raise the version in `mise.toml` and run `mise install`.
2. Edit `gspot.toml`. Rename `[[naming.override]]` to `[[naming.exception]]` and `security.rule_files` to
   `security.semgrep_rules`, and move each `naming.javascript` key to `naming.typescript`. Run `gspot doctor`, and
   delete each `tools.markdownlint.rules` or `tools.eslint.rules` key that its error names. At level `basic`, that
   includes the options of the unicorn rules that left the level.
3. If you set a general limit such as `limits.max_function_lines`, check the language limits that gspot ships, such as
   `limits.bash.max_function_lines`. The general key no longer reaches them. To keep your value, write the language key.
   A value above the shipped limit needs a reason.
4. Replace `gspot apply` with `gspot install` in your scripts and CI jobs. Then run `gspot install`.
5. In `.gitattributes`, move each rule of yours that sets `eol` or `text`, or uses `binary`, below the gspot block,
   which now starts with `* text=auto eol=lf`. Then, if `git ls-files --eol` lists `i/crlf`, run
   `git add --renormalize .`.
6. Run `gspot check --fix`, and review the diff. It rewrites more than style, and at level `basic` it deletes
   suppressions of the rules that left the level, as Known issues says. At level `all`, it sorts your imports into the
   new groups.
7. If you commit `gspot.baseline.json`, run `gspot baseline --prune`. It clears the `stale-baseline` findings that the
   last step printed.
8. Update each script that reads `--json` output, with the JSON output changes below. In a custom CI job, install the
   project dependencies before `gspot check`.
9. Run `gspot check`, and fix what it reports. Commit everything these steps changed: `gspot.toml`,
   `gspot.baseline.json`, `.gspot/`, the other generated files, the package manifest and lockfile, and the files that
   `--fix` rewrote. The commit hook checks every file, because `gspot.toml` and `.gspot/` changed.

### Breaking changes

`gspot.toml`:

- `[[naming.override]]` is `[[naming.exception]]`, and its fields keep their names. gspot reports the old key as
  unknown. (e222b39)
- `naming.javascript` is gone, and `naming.typescript` now covers JavaScript files. Move your keys there.
  `limits.javascript` stays. (e8088b9)
- `security.rule_files` is `security.semgrep_rules`. gspot reports the old key as unknown. (09f289a)
- `tools.markdownlint.rules` refuses options for the 21 rules that the formatter owns, with
  `gspot runs MD009 at no level, so it takes no options.` Only `MD013` was refused before, and the others turned back on
  against the formatter. (ffe9153)
- A general limit no longer replaces a shipped language limit, whether it is looser or stricter. With
  `limits.max_function_lines = 59` or `30`, Bash stays at 40 lines until you set `limits.bash.max_function_lines`.
  (102f66c)

Commands:

- `gspot apply` is gone. It exits 2 and prints `gspot install writes the generated files. Run gspot install.` Each
  message, generated file header, and `gspot/generated-files` finding names `gspot install`. (765dfbf, 7f8fca1)
- `gspot install` writes every generated file before it installs the tools, so it replaces a hand edit in one. (18a6cf1)
- `gspot init` now installs the tools and sets `core.hooksPath`, so it needs the network. It exits 1 when a tool stays
  missing, 2 when the install fails, and 129, 130, or 143 on a signal. The written files stay in each case, so run
  `gspot install` to finish. (23325ad)
- `gspot check --only <checks>` exits 2 and names the cause when `--skip` or `--stage` leaves out every named check. It
  printed `Passed: 0 checks` and exited 0. (f459d8c)
- `gspot init --configurations <names> --no-configurations` and `gspot scan --markdown --json` exit 2 before they read
  or write anything. One flag used to overwrite the other. (b7a65d5)
- The pre-push hook runs only `push` checks, and gspot writes it only when one exists. It ran the `commit` checks too. A
  commit made with `--no-verify` now gets its commit checks only from CI or a manual `gspot check`. (7dee8e0)
- `javascript/eslint`, `javascript/knip`, `javascript/tsc`, and `typescript/tsc` report `missing`, and `gspot check`
  exits 2, when `package.json` declares dependencies and no `node_modules` folder exists. The packages of gspot do not
  count. Install the dependencies first. (7085606)
- `gspot doctor` exits 1 when the program of a `[[command_check]]` or of its fix is missing. It printed the tools as
  ready and exited 0. (c8b46ee)
- A check that a signal stops prints `canceled` and counts under `Canceled`. It printed as an error and counted under
  `Errors`. (fca62d6)
- `gspot list` prints `skipped (level)`, `skipped (setting)`, and `skipped (no-files)` in place of `off (level)`,
  `off (setting)`, and `no matching files`. (aacc0c6)
- The pnpm, Yarn, and Bun hooks exit 2 with the install steps when the project lacks gspot. They fell back to a global
  gspot on `PATH`. Run the install of your package manager, then `gspot install`. (72e9c74)

JSON output:

- In the generated-file fields, `removed` is `deleted`. In the plan of `gspot init` and `gspot scan`, `delete` is
  `deleted`, and `from.leftOut` is `from.leftOutSettings`. (a7a1f79)
- In `gspot baseline`, `findings` is `findingCount` and `files` is `fileCount`. In `gspot doctor`, `ruleFiles` is
  `ruleFileCount`. (a7a1f79)
- In `gspot list settings` and `gspot explain` of a setting, `key` is `setting` and `reasonRequirement` is `reasonFor`.
  `source` is an object with `kind` and `name`, and `origin` and `originScope` are gone. (a7a1f79, f2fc327)
- In `gspot explain` of a check or a configuration, `settings` is `settingNames`. (a7a1f79)
- In `gspot list`, a check has the `status` `on`, or `skipped` with the `cause` that `gspot check --json` uses.
  (aacc0c6)
- In `gspot check`, `status` can be `canceled`, where it was `error`. Without `--verbose`, a check that no file selects
  is left out, and `skippedCount` gives the skipped checks per `cause`. (fca62d6, 1e28d40)
- A secret finding holds the gitleaks rule ID in `rule`, such as `github-pat`, and its fingerprint in the new
  `fingerprint`. An `[[ignore]]` whose `rule` names a fingerprint still works. (668316b)
- `gspot init` adds `installed`, `missing`, and `steps`, and `gspot install` adds the generated-file fields. (23325ad,
  18a6cf1)

Findings:

- A plain `gspot check` or `gspot baseline` runs `secrets/gitleaks-staged` over every file in the repository folder.
  That includes files that Git ignores, such as `.env` and `dist/`. gitleaks leaves out `node_modules/`. Hooks keep
  their staged and pushed scans. A token already in a file now fails, and a baseline cannot hold it. Ignore a test key
  in a tracked file by path with a reason. For a file that Git ignores, delete the token, or ignore its fingerprint,
  which `--json` prints: `gspot ignore secrets/gitleaks-staged --rule ".env:github-pat:1" --reason "<why>"`. (9aece72)
- These leave level `basic` for level `all`: the `bash/safety` rules `function-keyword`, `combined-redirect`, and
  `echo`, `bash/unused-functions`, `python/vulture`, three optional ShellCheck checks, and six unicorn rules such as
  `unicorn/no-for-each`. (1d65457, 8fd15e9, 6aaf168, 38b31cb, 47fa303)
- A baseline that counted these findings fails `gspot/baseline` with `stale-baseline` until `gspot baseline --prune`.
  `gspot baseline` also leaves fixable findings out, and `--prune` removes their old counts, so run `gspot check --fix`
  first. (49bbdbc)
- At level `all`, `perfectionist/sort-imports` sorts alphabetically in groups: builtins, packages, aliases, then
  relative paths, with a blank line between groups. It sorted by line length. The names inside each import sort
  alphabetically too. `gspot check --fix` rewrites them. (030416c)
- At level `all`, `unicorn/consistent-boolean-name` accepts only the prefixes `is`, `has`, and `can`, so a variable such
  as `requiresInstall` fails. It stops checking function names. (0c2e746, 0db49e6)
- At level `all`, a module that exports values may hold no top-level `for`, `while`, `do`, `if`, or `try`. Config files
  stay exempt. (50cc844)
- At level `all`, `gspot.heading-case` also checks the H1 heading and the front matter `title`, and `gspot.title-case`
  is gone. Write page titles in sentence case. A file name with an extension passes. (06cdd6b, eed3b9e)
- `github-actions/workflow-shape` no longer reports a concurrency group on a push-only workflow, and its
  `push-concurrency` rule is gone. It still asks pull request workflows for a group. A baseline that counted the rule
  needs `gspot baseline --prune`. (9a53cdd)
- At level `all`, `naming/identifiers` skips the member names of interfaces and object types. A `[[naming.exception]]`
  that listed such a name now fails `naming/allowed-names` with `unused-record`. Remove the name, or the record.
  (f993241)
- `gspot/detected-configurations` fails in a repository whose `mkdocs.yml` enables `admonition`, `pymdownx.details`, or
  `pymdownx.tabbed`, until you run `gspot add mkdocs` and `gspot install`, or `gspot remove mkdocs --reason "<why>"`.
  (a228a8a)
- A file counts as binary on `-diff` or an LFS filter, not on `-text`, so a repository with `* -text` gets its text
  files checked. Fix or ignore what these files now report, or mark them `-diff`. (c1de1d5)

Files that gspot writes:

- The `.gitattributes` block starts with `* text=auto eol=lf`, and its generated paths lose `text eol=lf`. Each text
  file of your repository now checks out with LF. (3f087d1)
- The generated GitHub and GitLab jobs run `git add --intent-to-add -- .` and `git diff --exit-code` after
  `gspot install`. The job now fails on a hand edit of a generated file outside `.gspot/`. It also fails on any tracked
  or new file that an earlier step changed, such as `ci.setup_command` or the project install. Make such a step leave
  the tree clean, or ignore its output in `.gitignore`. (ac6fde1)

ESLint plugin 0.2.4:

- `gspot/no-trivial-functions` takes no `exportNames` option, and ESLint refuses a config that sets it. The rule reports
  a named function only when the module does not export it and at most one place in the file names it. (7c08206)
- `gspot/unverified-hostname` no longer reports `rejectUnauthorized: false`. Only `gspot/unverified-certificate` does,
  so turning that rule off loses the report. (8f3dde7)

### Known issues

- Node.js 22 ships an npm older than 11.19.0, which `gspot init` and `gspot install` need. On Node.js 22, run
  `npm install --global npm@latest` first.
- A `.gitattributes` rule above the gspot block loses to `* text=auto eol=lf`. On the next add, a Windows batch file
  with `eol=crlf` gets LF, and a file marked `-text` or `binary` gets normalized. Write such a rule below the block,
  which `gspot install` keeps.
- `gspot check --fix` rewrites more than style. `typos` changes words in code samples, `sqlfluff` rewrites committed
  migrations, `dotenv-linter` renames keys, and Ruff deletes a side-effect import. Review the diff.
- At level `basic`, ESLint and Ruff call a suppression unused when it names a rule that only level `all` runs, and
  `gspot check --fix` deletes the comment. This includes the rules that left `basic` in this release.
- In a repository without the `html`, `javascript`, `typescript`, or `site` configuration, `gspot install` skips the
  HTML grammar. On a machine without it, a staged Markdown file stops `gspot/suppressions` with
  `The html grammar is not installed. Run gspot install.` Run `gspot add html`, then `gspot install`.
- A `.pre-commit-config.yaml`, a Lefthook file, or a `simple-git-hooks` key counts as installed hooks even when that
  tool never wrote one. `core.hooksPath` then stays unset, so commits run no checks. Delete the file, then run
  `gspot install`.
- `gspot install` runs `uv sync --locked` in each Python project with a `uv.lock`, which removes an installed extra.
  Install the extra again afterwards.
- `gspot init` and `gspot install` look up tool releases on api.github.com. Without a token, a shared address that used
  its 60 requests stops `gspot init` after it wrote its files. Set `GITHUB_TOKEN`, then run `gspot install`.

### Highlights

#### New commands and settings

- `gspot baseline --only <checks>` runs only the named checks, replaces or prunes their counts, and keeps the others.
  When `gspot set` or `gspot add` turns on checks in a repository with a baseline, it prints that line. (712df59)
- `gspot baseline --prune` runs when a check cannot run, such as offline. It keeps that check's counts and names it,
  where it refused to write. (e049631)
- `naming.terms` maps a word you reject to its replacement, such as `"config file" = "generated file"`. At level `all`,
  the naming checks and the Vale style `gspot.terms` report the word in names, documentation, comments, and commit
  messages. (c7f6333)
- `[[command_check]]` takes `runs = "files"`, `"scope"`, or `"once"`. With `scope` or `once`, a commit that only deletes
  a covered file still runs the check. (d6cfb7a)
- The new `mkdocs` configuration turns off `MD046` and `MD053` in a scope whose `mkdocs.yml` enables `admonition`,
  `pymdownx.details`, or `pymdownx.tabbed`. (a228a8a)
- `--verbose` and `--json` work on every command, before or after its name. `gspot install --verbose` exited 2 with an
  unknown option. `gspot check --hook` stays for the hooks and leaves the help. (b8dce2d, 5d4e274)
- In GitHub Actions, `gspot check` prints one error annotation per finding, up to ten, so findings show on the pull
  request diff. `--json` prints none. (ddcac7f)
- `gspot ignore --rule` and `gspot explain <check> <rule>` accept each rule of the built-in checks that report several,
  and the Vale rules. They refused these. (2d26785, ceb2436, 853ffdb, 8eb6eba, 21665e1)
- A finding of a tool with no rule list in gspot, such as `tsc` or `knip`, no longer prints an explain command that
  exits 2. `gspot ignore --rule` keeps such a rule as given. (dd22559, b60bea8)
- `gspot explain --json` holds what the text prints: the ignore commands, `minVersions`, `selected`, and for a lint rule
  `turnOff` and `changeOptions`. (d87cc17)
- The editor schema lists the shipped configuration names, and offers the shipped check IDs for the `check` of an
  `[[ignore]]`. (bd8d3ba)

#### `gspot init` and `gspot scan`

- `gspot init` writes each rule that a replaced Ruff, markdownlint, or commitlint config turns off as an `[[ignore]]`
  record. Its reason is `Carried over from <file>.` It printed a line to run by hand. (2c1be59)
- `gspot init` carries the `include` and `exclude` of a pyright config as an `[[ignore]]` of `python/basedpyright`, so a
  project that type checks only its package keeps that scope. (d9f1521)
- `gspot scan` compares only the rules that your ESLint or Stylelint file names, not every rule of the shared configs it
  extends. (6be5907)
- The next steps of `gspot init` and `gspot scan` name `gspot check --fix` before `gspot baseline`, and the plan names
  `git add --renormalize .` when the index holds CRLF files. (49bbdbc, 3f087d1)
- In a repository without `package.json`, `gspot init` also pins `node = "24"` in `mise.toml` when that file names no
  Node.js. `gspot doctor` prints the real error of a failed `gspot --version`. (3ce0c45)
- A tsconfig that extends an uninstalled package no longer stops `gspot init`, `gspot add`, or `gspot install`.
  `typescript/tsconfig` reports it as a finding of its scope. (89c4156)
- A detected `js` or `ts` import suffix that the code needs wins over the React default of
  `javascript.import_extension`. A root `package.json` that holds only tools and the gspot pin stays tool-only after
  `gspot init`. (ac669a8, 1b83883)
- The comment above `gspot.toml` names `gspot add` and `gspot remove`, and lists every record that takes a hand edit.
  For a lint script, the plan and `gspot/conflicting-configs` ask for one `gspot check` at the root, and name the right
  lint-staged line. (f488af6, e3ebe67, 6d056d1)

#### `gspot install`

- When nothing needs work, it prints `No change: every generated file is up to date, and every tool is installed.` It
  ran mise and the package manager each time, and printed that it installed every tool. (e7f59ce, 69d2c1e, 18a6cf1)
- Type-aware ESLint uses the TypeScript of your root `package.json`, when that version fits the peer range of
  typescript-eslint. The pinned 5.9.3 gave false `no-unsafe-call` findings in a project on TypeScript 6.0.3. After you
  change that version, `gspot/generated-files` fails until you run `gspot install` and commit the result. (9bb630d)
- A new npm tool lockfile now empties `.gspot/node_modules` first, so a stale package cannot crash ESLint.
  `dependencies.min_release_age_days` reaches the pnpm install in `.gspot/`, which refused the gspot packages for a day
  after each release. (f124226, f0b6046)
- gspot reads the two-document `pnpm-lock.yaml` of pnpm 11 and 12. The lockfile checks reported an error in every scope,
  and with a pin in `package.json`, every command stopped. (82d138c)
- `.gspot/mise.toml` no longer sets `lockfile = true`, so mise stops creating an untracked `mise.lock` at the root, and
  `.gspot/mise.lock` keeps the layout that mise writes. (fe8804d)
- A grammar download moves into place from a staged file, so a killed install cannot leave half a file in the shared
  cache. A grammar that fails to load names its file and `gspot install`. (bdd1224)
- actionlint installs from `aqua:rhysd/actionlint`, the same release with no deprecation notice from mise. (6d271c3)
- gspot compares only the Node.js version. The package drops `engines.bun`, so a Bun that runs gspot gets no version
  check. (1decfa8)

#### Git and hooks

- A staged check, a pre-push check, and `--changed` read the tree with one `git status` and no lock, so a concurrent
  `git add` no longer fails on `.git/index.lock`. A pre-push check of `HEAD` with staged changes runs in a copy of the
  pushed commit. (ac79c7c)
- `--changed` and the pre-push hook find the default branch one way: the upstream, `origin/HEAD`, then `origin/main` or
  `origin/master`. When none exists, the error names `gspot check --base <branch>`. (e1b370b, b0e8667)
- In a shallow clone, a missing base names `git fetch --unshallow` or a checkout fetch depth of 0. (81376b9)
- During a conflicted merge, a staged check names each conflicted path, and the fix line leaves out files with conflict
  markers. (6612b59, 2560fee)
- With `core.autocrlf`, a staged check reads each file as the index holds it, so CRLF from the checkout no longer
  reaches the checks. When a missing lockfile refuses the copy, the message names
  `git stash push --keep-index --include-untracked`. (cec9acb, b220f73)
- `gspot doctor` reports the hooks as not ready when a hook file is missing or not executable, and `gspot check` warns
  with the fix. Git skipped such a hook, with at most a hint. (7ce6ad0)
- With Git LFS, the pre-push hook runs the checks before `git lfs pre-push`, so a refused push uploads nothing.
  (020d8d9)
- A `.husky` folder counts as hooks only while `core.hooksPath` points into it. Turning `hooks.enabled` off also unsets
  `core.hooksPath`. (3d0a819, 86a39b1)

#### Check output

- A failed check prints its help once, after its findings. It repeated the help once per rule. (27914de)
- Outside a rewritable terminal, `gspot check` prints a running line every 10 seconds, and a done line only for a check
  that took that long. It printed a line for every check. (c5c6f7f)
- The progress line stays off a terminal with `TERM=dumb` or with `NO_COLOR` set, and the help fits a terminal narrower
  than 80 columns. (dc1133c)
- In a full run where every reported file is fixable, the fix line names only the check, not thousands of file names.
  (89572fa)
- `commits/commitlint-pushed` reports wall time, not the sum of its runs. `gspot check --verbose` prints the time before
  the first check. (2a13406, 3284334)

#### Messages and help

- `gspot set` on a setting of an unselected configuration names the `gspot add` line. `ci.enable` suggests `enabled`,
  and an unknown `tools` table lists the ones that exist. (aaada60)
- `gspot explain` offers the setting that writes the options of a rule, such as `structure.reexports`, where `gspot set`
  refused the command it offered. A doctor suggestion sets its command off with a colon. (5adccdf, 7f3537d)
- The help and messages say "ignore" for every ignore, keep "accept" for the baseline, and say "generated file" or "tool
  config" for each kind of file. (bc755b7, 20405b8)
- The help names a working `gspot explain bash/shellcheck SC2086`, a table setting that `gspot set` merges, every exit
  code per command with 129 for SIGHUP, and `gspot check --only gspot/detected-configurations` for `gspot add` lines.
  (574c336, e34a1b2, b04b001, 29af229, 2859db9)
- Check and configuration texts match what runs: the Next.js and Express descriptions, the html-validate summary, the
  trivial function rules, and the detection conditions in `gspot explain`. (04e741d, 5fe72f1, 88e9baf, 99c1c77, 1257433,
  ef50922)
- A tool crash note leads with the tool's error output, and guesses no network cause. A failed install step names the
  signal that stopped it. (be98057, d66ac97)
- A tool failure under `.gspot/node_modules` ends with `Run gspot install.` A checksum, package manager version, or
  workspace error names a next step. A built-in check that runs a tool reports an unexpected exit with the tool, the
  exit code, and the end of its output. (91d853f, a98ba3c, 27f5caf)
- A syntax error in `mise.toml` names the file, line, and column. A defect in what gspot ships reports as an internal
  error that names what is missing. (25ce37a, 4984947, c5968ce)
- `gspot set` writes a table into a later `[[scope]]` entry, and gspot loads such a file. It failed with
  `Table already defined`. (586ac4e)

#### Checks

- `limits.max_cognitive_complexity` defaults to 15, not 8. The ESLint `complexity` rule counts a `switch` once, so an
  exhaustive `switch` no longer fails on its cases. (c444a1c, b29d4e4)
- `unicorn/prefer-ternary`, `unicorn/prefer-await`, and three unicorn rules that only reorder code are off. Level `all`
  drops `jsdoc/require-param` and `jsdoc/require-param-description`. (b0f575c, 6224bee, 339e5ff, f25c2c8)
- `@typescript-eslint/restrict-template-expressions` allows a number, so a count no longer needs `String()`. It still
  refuses booleans, nullish values, `any`, `never`, and regular expressions. (b27a891)
- `structure/trivial-functions` reports a Python, Swift, or Bash helper only when at most one place calls it.
  `structure/function-order` accepts a private function below a function that calls it. (ebaf8ed, 202162d)
- `naming/identifiers` reads `awsS3Bucket` as camel case. `structure/shared-prefixes` and
  `structure/file-folder-clashes` leave out `gspot.toml` and `gspot.baseline.json`. (4e2c5c8, ec08abd)
- `bash/unused-functions` counts a call from any script in the scope. ShellCheck runs bats files with `SC2030`,
  `SC2031`, `SC2034`, and `SC2218` off. (8fd15e9, 38b31cb)
- `bash/shfmt` reads its layout from `.editorconfig`, so format on save passes the check. A scope that selects Bash gets
  `switch_case_indent`, `simplify`, and a `[*.{sh,bash}]` section with the indent your scripts use. Only a
  `[[format.override]]` sets that indent now, not `format.indent_width`. When most of your scripts change indent,
  `gspot/generated-files` fails until you run `gspot install`. (782f869, 5dbd031)
- `repository/conflict-markers` counts `=======` only inside a conflict, so a Markdown title underline passes and
  `--fix` stops skipping the file. `markdown/fences` accepts a fragment, such as a line of `...` or an object member.
  (e7d7f8f, ffea8ee)
- `dependencies/osv-scanner` and `licenses/allowed` name each lockfile they cover, so a worktree in an ignored folder
  stops failing the push, and a lockfile over `repository.max_file_kilobytes` still gets scanned. (f2559e6, 7375657,
  79d47fe)
- `dependencies/lockfiles` leaves out the lockfile in `.gspot/`, which it counted as a second package manager. The tool
  checks drop findings in the files that gspot writes. (8bac47c, 05c796b)
- The Python checks read the environment that `VIRTUAL_ENV` names before `.venv`. `pytest/tests` skips a scope with no
  test file, and `vitest/tests` leaves out `.gspot-copies/`, where a copy made full runs fail at random. (85ecc04,
  5501fe9, b825c5d)
- The generated tool configs leave out what tracked `.gitignore` files ignore. The generated jsconfig keeps the
  `include` of a tsconfig that sets `allowJs` or `checkJs`. (12c3273, e0e1127)
- `site/purgecss` runs again. It failed for every site, because its process imported a package that the published CLI
  does not install. `site/unused-assets` counts a package alias import, and `site/html-validate` turns off four rules
  that Starlight output breaks. (7f61a9e, 9ac1826, decf471)
- `javascript/import-cycles` no longer fails on a disable comment that names another plugin's rule. The two import
  resolvers stop printing `Multiple projects found` in every check and editor session. (6f9c7a6, 8674311)
- Five rule settings stop reporting correct code. They are `n/no-unpublished-import` in a private package,
  `jsdoc/require-jsdoc` on object literal functions, template string rules in tests, a config file's default export, and
  the Zustand `useStore` selector. (a89acb5, f6c0ae8, 0db49e6, 635e314, 160a103)
- `as any` gives one finding, not two, and the Vale rule `gspot.home-paths` matches a home folder only at the start of a
  path. (879c274, 4fc4fd7)
- A tracked symbolic link with a missing target no longer stops the run with exit 2. A workspace `package.json` that
  starts with a BOM no longer fails the run. (30e40ab, db09e29)

#### Speed

- `structure/long-files`, `structure/trivial-functions`, `structure/function-order`, `structure/bare-blocks`,
  `javascript/biome`, `python/function-size`, `python/placeholder-docstrings`, and `gspot/suppressions` read only the
  files of a commit. A commit no longer fails on their findings in untouched files. `structure/trivial-functions` still
  reads its scope to count callers. (2acb567, 126746b)
- `prose/commit-message` takes 0.02 seconds in place of 0.89 on a three-line message, and `javascript/import-cycles`
  took 14 seconds of CPU in place of 47 on one test folder. (d2f1636, c97dc76)
- A check run starts the tools sooner and does less work: per file, in a monorepo, and in a commit with unstaged
  changes. (88bf205, 8dda26b, 879c928, 52ba0fc, 63b1a05, 99011ff, b959178, facd4c0)
- A cold install runs the npm tool project beside mise, resolves it in one npm run, and downloads grammars in parallel.
  `gspot init` lists the tracked folders once. (426c89c, dfddf19, 2482b63, d901cc9)
- A scope with one limit of its own writes only the rules that differ, where one number made a diff of about 86 lines.
  Each repeated list prints once in a generated ESLint file. (3471909, eb96d7f, 08e6501)

#### CI

- The generated GitHub workflow has no cache steps, because restoring the cache took longer than it saved. The GitLab
  include keeps its cache. (b355661)

#### ESLint plugin 0.2.4

- `gspot/no-magic-numbers` accepts the limit of `split`, a `slice` size that equals its destructuring pattern, and
  numbers in a module-level `new Map` or `new Set`. (d388490, 1d5ddde)
- `gspot/unverified-hostname` reports a `checkServerIdentity` that returns nothing, which accepts every server, and
  stops reporting one that returns `true`, which rejects every server. (d6bfd41)
- `gspot/no-trivial-files` accepts a file that the nearest `package.json` names in `exports`, `main`, or `bin`.
  (3418c9f)
- Rule descriptions in `gspot explain` say what a rule reports in one or two sentences, and rule examples render as
  written. The `gspot/no-clear-text-protocols` example shows an `http` URL. (74419aa, 18fb4f5, ae60597, 3aadd88)

#### Rule files for agents

- The `AGENTS.md` block says to commit and fix what the hook reports, and to read `COMMENTS.md` and `GIT.md` only before
  a comment or a commit. (3189ca4, 7ac9b88)
- `WORKING.md` tells agents to ask until no decision is open, and to inline a trivial function only when it has one
  caller. `PLANNING.md` stops asking for the full diff of each change. (fdd8c2d, 02b00ff, 6796d3f)
- `TESTING.md` asks tests to assert exit codes, error codes, and structured fields, and to compare text only when text
  is the output. (ef36aad)
- `COMMENTS.md` and `NAMING.md` match what the rules accept: a nested `@param` for an inline object type, and `get` or
  `read` functions that return nothing when the type says so. (b16069d, 8072270)
- `WRITING.md` asks for sentence case in every title, asks for clear words before clever ones, and limits active voice
  to documentation. Two Vale messages state a rule, and shipped rule titles use sentence case. (06cdd6b, cd92e10,
  b952081, a3a6290)

#### Documentation

- New guides cover Bash, HTML, Markdown, and SQL, and a new Frameworks group covers Astro, Expo, Express, FastAPI,
  NestJS, Next.js, React, React Native, Svelte, and Vue. (fdba592, 6012f27, 8808aef, c2b4384, 9848f94, e1ce6eb, 9684caa,
  b60dbb3, 28f12a3, 670c885, 902bf53, a614aae, 8537ade, 5ae8b23, 2ed7a2c, fe3105a)
- New pages: Baseline and Mistakes that gspot catches. The
  [changelog page](https://generativespotting.com/reference/changelog/) renders from `CHANGELOG.md`, and each ESLint
  plugin topic has its own page. (680a994, ac55cdd, 1588eae, 99c2a95)
- Overview merges into the [Quickstart](https://generativespotting.com/start/quickstart/), and Footprint into
  [Files and caches](https://generativespotting.com/reference/generated-files/). Exclude files moves to Ignore. The old
  paths answer with a 301. (777b158, b27b7cd, 67259b9)
- Install, Migrate your linters, Change settings, Concepts, Hooks, and CI are rewritten, Run checks shows a real report,
  and Editors names the setting of each tool. The hand-written pages and the README use plain words, and diagrams render
  in light and dark. (1611d15, fa53b76, 3017345, d9055b5, 6d87a38, 2555aba, 3e4d3c6, 51f91bc, ecbc609, cfba71e, a65e6fd,
  7e83079, 0571452, 1e30ec2, 3c83e33, 9fd8320, b1a955f, 8ffe5bc, ac0fb2e, dde00e5, b245e9a, bebb5a4)
- Pages that were wrong now match gspot: Troubleshooting, Lint rules, import rules, monorepos, coding agents, the
  language pages, security, sites, dependencies, tests, prose, and the command check example. (7084711, 151ede7,
  f7d52cc, cb3a9a5, 1698188, 7a06d63, 45f73f9, 5065193, 4c6e725, 9b19814, e977e1b)
- The reference pages keep straight quotes and double hyphens in code, and rule tables show no raw tags. They list
  `fixCommand`, `GITHUB_TOKEN`, and `GITHUB_ACTIONS`, and show plain types and defaults for settings. (f816a1b, 5041a4a,
  23ad8e5, 7f81460, c3c8774, 2b1205c, efded78, 663d2bb, 5a0a0f0, 1cedde2)
- `llms.txt` leads with what gspot does, names the version it documents, and uses plain words, and `llms-small.txt`
  leaves out the plugin reference. (a32a562, 08e6e6b, 8ecf919, c003907)
- The home page gets a setup card, six "What you get" tiles, a strip of nine tools, and a real catch of a vulnerable
  package. The 404 page has its own design and sends `noindex`, and `gspot.schema.json` sends CORS headers. (1e65c3a,
  15f8b86, 0e2de27, e3ee898, 3d9b48b, 64c7819, 945786b, 54dbde3)
- Home headings grow with zoom, the home lead fits a phone, and the version link's accessible name starts with its text.
  Each docs section has its own Open Graph image, and the site has an SVG favicon and a web app manifest. (bb97f7a,
  277805a, 52b014f, d5492b6, 6bba2b2, 02bf108, 32fb4bc)

### Development

`mise run changelog <version>` writes each `CHANGELOG.md` section, and a pushed `v*` tag publishes both packages through
npm trusted publishing with provenance and deploys the docs. Tests assert exit codes, error codes, and fields in place
of sentences, and parse `--json` through Zod schemas. The integration suite runs the built `dist/gspot.js` on Node.js.
(f4fb847, 16633b4, 7943c5a, fb6cf34, 1decfa8)

Released 2026-11-05. [Compare with 0.3.8](https://github.com/stefanionescu/gspot/compare/v0.3.8...v0.3.9)

## 0.3.8

gspot 0.3.8 adds `gspot scan`, which tries gspot on a copy of your repository. It also adds `gspot baseline`, which
accepts the findings that exist now so that only new findings fail. The level `recommended` is now `basic`, most
settings and seven checks take new names, `gspot init` stops asking before it writes, and several flags are gone. ESLint
moves to 10 and Stylelint to 17. The ESLint plugin 0.2.3 grows from 9 to 183 rules and replaces eslint-plugin-sonarjs,
which gspot stops running. The upgrade needs work: gspot refuses a `gspot.toml` with an old key, and level `basic`
reports more, so expect new findings.

### Upgrade from 0.3.7

1. Commit your work. Install 0.3.8 with your package manager, such as
   `npm install --save-dev --save-exact @gspothq/cli@0.3.8`, or with
   `mise use --pin --tool-option allow_low_downloads=true npm:@gspothq/cli@0.3.8`.
2. Edit `gspot.toml`. Delete the `#:schema` line, write `level = "basic"` in place of `level = "recommended"`, rename
   each key that the table below lists, and delete each key that the bullets after it name. Delete `duplication` from
   `configurations`. Rewrite `removed_configurations = { value = ["nextjs"], reason = "..." }` as a table with one line
   per name. `gspot check` and `gspot apply` name each key that they refuse.
3. In `[[ignore]]` records, rename the old check IDs with the table below and `data-files/yamllint` to
   `data-files/yaml`, and delete each record of `site/size` or `security/semgrep-registry`. Move a `javascript/eslint`
   record of `import-x/no-cycle` to `javascript/import-cycles`. At level `all`, move a record of `ansible/ansible-lint`
   to `ansible/ansible-lint-production`. In records, suppression comments, and `tools.eslint.rules`, rename
   `gspot/no-client-env` to `gspot/no-client-environment` and `jsx-a11y/*` to `jsx-a11y-x/*`. Replace each `react/*`
   rule with the `@eslint-react/*` rule that reports the same thing, where one exists, because the names differ. Delete
   each `sonarjs/*`, `barrel-files/*`, and `react-native/*` rule, because ESLint reports a comment that names one as
   `Definition for rule ... was not found.`
4. If Husky, Lefthook, pre-commit, or your own hook folder runs the hooks, replace each `gspot check --hook` line with
   the script line, such as `.gspot/hooks/pre-commit "$@"`. Add `.gspot/hooks/commit-msg "$@"` to the `commit-msg` hook
   too, because `commits/references` runs at both levels. `gspot install` prints each line.
5. Run `gspot apply`. It deletes `.gspot/version`, `.gspot/gspot.schema.json`, the rule files at their old paths, and
   the gspot block of the root `.gitignore`.
6. Delete each `.stylelintrc.json` that gspot 0.3.7 wrote, at the root and in scope folders. `gspot apply` leaves them.
7. Run `gspot install`. It exits 2 below npm 11.19.0, pnpm 10.16.0, or Bun 1.3.0, whichever your repository uses. A Yarn
   repository needs that npm version. Node.js ships npm 11.19.0 from 24.20 and 26.7, so on an older Node.js run
   `npm install --global npm@latest` first. With Bun, delete `.gspot/node_modules` first. `gspot install` also stops
   when a pinned tool came out less than `dependencies.min_release_age_days` days ago, 7 by default. Set `GITHUB_TOKEN`
   when mise reaches the GitHub rate limit.
8. Run `gspot check`. Run the `gspot add` or `gspot remove` line that `gspot/detected-configurations` prints, replace
   the lint commands that `gspot/conflicting-configs` names, and run each `fix:` line. Run `uv sync` in each Python
   project that a `missing` line names. Run `gspot baseline` to accept the rest. It stops while a check cannot run, and
   it leaves out the findings of `secrets/*` and `gspot/*`, which you fix.
9. Update each script that passes a removed flag or reads `--json` output, with the lists below.
10. Commit `gspot.toml`, `gspot.baseline.json`, `.gspot/`, the other generated files, and your pin. Each other clone
    then installs the pin with its package manager, such as `npm ci` or `mise install`, and runs `gspot install`.

### Breaking changes

#### `gspot.toml`

- `level = "recommended"` is refused. Write `level = "basic"`. `gspot init --level` takes `basic` or `all`. (1103f0e)
- Every limit and coverage minimum takes a `max_` or `min_` prefix and its unit, and each setting moves to the table of
  its configuration. Only lint rule options stay under `tools.<tool>`. Rename each key with this table. (b9b6a23,
  e166dbb, 5c0a2a1, 580dd36, bd1bb0e, 053984b, b9459d8)

| 0.3.7                                               | 0.3.8                                               |
| --------------------------------------------------- | --------------------------------------------------- |
| `limits.<name>`, `limits.<language>.<name>`         | `limits.max_<name>`, `limits.<language>.max_<name>` |
| `limits.trivial_function_statements`                | `limits.min_function_statements`                    |
| `limits.<language>.trivial_function_statements`     | `limits.<language>.min_function_statements`         |
| `limits.shared_prefix_files`                        | `limits.min_shared_prefix_files`                    |
| `coverage.lines`                                    | `coverage.min_line_percent`                         |
| `coverage.swift_target[].lines`                     | `coverage.swift_target[].min_line_percent`          |
| `coverage.branches`                                 | `coverage.min_branch_percent`                       |
| `coverage.functions`                                | `coverage.min_function_percent`                     |
| `coverage.statements`                               | `coverage.min_statement_percent`                    |
| `duplication.min_lines`                             | `structure.min_duplicate_lines`                     |
| `duplication.min_tokens`                            | `structure.min_duplicate_tokens`                    |
| `rules.enabled`, `rules.exclude`                    | `rule_files.enabled`, `rule_files.exclude`          |
| `docs.banned_headings`                              | `prose.banned_headings`                             |
| `python.extra_paths`                                | `python.import_folders`                             |
| `secrets.env_examples`                              | `secrets.environment_examples`                      |
| `tools.commitlint.scopes`, `tools.commitlint.types` | `commits.scopes`, `commits.types`                   |
| `tools.eslint.import_extension`                     | `javascript.import_extension`                       |
| `tools.eslint.restricted_imports`                   | `javascript.banned_imports`                         |
| `tools.knip.entry`                                  | `javascript.entry_files`                            |
| `tools.knip.ignore_dependencies`                    | `javascript.allowed_unused_dependencies`            |
| `tools.hadolint.trusted_registries`                 | `docker.allowed_registries`                         |
| `tools.trivy.severity`                              | `docker.severity`                                   |
| `tools.nginx.image`                                 | `nginx.image`                                       |
| `tools.purgecss.safelist`                           | `site.allowed_classes`                              |
| `tools.ruff.docstring_convention`                   | `python.docstring_convention`                       |
| `tools.semgrep.rule_files`                          | `security.rule_files`                               |
| `tools.sqlfluff.dialect`                            | `sql.dialect`                                       |
| `tools.squawk.assume_in_transaction`                | `postgres.assume_in_transaction`                    |
| `tools.swiftlint.always_keep_imports`               | `swift.allowed_unused_imports`                      |
| `tools.v8r.schema`                                  | `data_files.schemas`                                |

- `structure.min_duplicate_lines` and `structure.min_duplicate_tokens` are root settings. Delete `duplication.min_lines`
  and `duplication.min_tokens` from a `[[scope]]` table, because a scope can no longer set them. (b9459d8)
- `format.final_newline` and `format.line_ending` are gone, also in `format.override`. gspot always writes LF line
  endings and a final newline, and `gspot init` names a CRLF or no-newline `.editorconfig` as dropped. (a15472d)
- `site.size_limit`, `tools.semgrep.registry_packs`, and `tools.yamllint.rules` are gone with their checks. (01613f3,
  87e4a3d)
- An `[[ignore]]` record takes no `names` or `until` field, and an empty `paths` list is refused. Ignore the paths that
  hold the definitions instead of naming them. (a7abd91, 5cc1c2a, 1103f0e)
- The `duplication` configuration is gone. Delete it from `configurations`. Its check is `structure/jscpd` at level
  `all`. (b9459d8)
- `rule_files.exclude` takes `.gspot/rules/<NAME>.md` paths, not configuration folders. (439b47c)
- `removed_configurations` takes only a table of names and reasons, such as `nextjs = "The app does not use Next.js."`,
  not the `{ value = [...], reason = "..." }` that `gspot remove` wrote in 0.3.7. A configuration in both that table and
  `configurations` is refused. (c084279, acf2bcf, 1103f0e)
- The first list you write replaces the shipped default. In a scope, a plain list still adds to the lists of its
  parents. To keep the shipped items, copy them into your list. `gspot explain <setting>` prints them. (4df5818)
- A path in a `[[scope]]` table is relative to that scope, a root path to the root, and a built-output path to
  `site.build_folder`. Drop the scope folder from such a path: in the scope `web`, write `e2e/**`, not `web/e2e/**`.
  (5545841)
- A `[[command_check]]` refuses `output = { format = "sarif" }`, and its `id` takes no spaces or commas. The
  `{existing:...}` placeholder is gone: gspot now passes it to the command as plain text, with no error, so write the
  flag and the path yourself. (2d4173d, bd1bb0e, 1103f0e)
- gspot refuses a compound SPDX expression in `licenses.allowed` and `dependencies.min_release_age_days` in a scope.
  (10c2d71, e013baa)
- gspot refuses a repeated `[[import_rule]]` name and an import rule path that starts with `!`, except an extglob such
  as `!(generated)/**`. (40c7fe7, 4d7e31c, da5dac8)
- gspot refuses options for a Markdown or commit message rule that does not run, and a Markdown alias or tag in place of
  a rule ID. (170518c, fb775f8, 611fc9b, b0eee2e)
- ESLint stops when it loads the config if you set options for a rule that no block turns on, or name an unknown
  `tools.eslint.override.runtime`. Stylelint options can now turn on a rule that its preset leaves off. (7e76cc7)
- `hooks.enabled` defaults to `true`. A `gspot.toml` without it gets the Git hooks at the next `gspot install`. To keep
  them off, run `gspot set hooks.enabled false`. (e6f0482)

#### Commands

- `gspot init` takes no `--yes` or `--dry-run`. It prints its plan and writes without asking. Run `gspot scan` to read
  the plan first. (87e4a3d, fb49bde, 01a0ff5)
- `gspot init` writes no CI setting. CI starts off, even with a GitHub remote, until you run
  `gspot set ci.enabled true`. (1103f0e)
- `gspot apply` takes no `--dry-run`. Run `gspot check --only gspot/generated-files --verbose --json` to read the diffs.
  (87e4a3d)
- `gspot check --fix` takes no `--dry-run`. (fb49bde)
- `gspot check --changed` takes no value. Write `--base <ref>` for `--changed <ref>`. (87e4a3d)
- `gspot check --hook` takes only `pre-push` and `commit-msg`. Write `gspot check --staged --stage commit` for
  `--hook pre-commit`. (87e4a3d)
- `gspot doctor` counts a hook line as installed only when it calls the script in `.gspot/hooks/`. (9e06564, b06871f)
- `gspot ignore` takes no `--names` or `--until`. (a7abd91, 5cc1c2a)
- `--paths` in `gspot ignore` and `gspot unignore` takes one path per flag, resolved from your current folder.
  `gspot init --configurations` takes one flag per name or a comma list, and `--scope` is relative to the repository
  root. `gspot explain ./<file>` also resolves from your current folder. (87e4a3d, f60cfd0)
- Every repository command stops outside a Git repository. (bd1bb0e, 87e4a3d)
- `check`, `apply`, `install`, and `baseline` exit 2 with the install command when the pin in `package.json` or
  `mise.toml` names another gspot version. `gspot doctor` no longer exits 1 for a version mismatch. (017c924, e977050,
  fec3887)
- `gspot install` stops when a pinned tool came out less than `dependencies.min_release_age_days` days ago. Wait, or
  lower the setting. A committed lockfile that matches the pins installs as it is. (248e963, 6a88b09)
- `gspot install` exits 1 when a tool stays missing or cannot start after a forced reinstall. (aedf417, 7e8ff4a)
- `gspot doctor` exits 1 for a missing Python `.venv` and for hooks that cannot start gspot. (5b1fc3c, f669c27)
- `gspot set` replaces a whole list, so pass the complete list. `gspot unset <setting> <items...>` removes single items.
  (fbd6c3b, 17350b3)
- `gspot explain` names a lint rule after its check, as in `gspot explain python/ruff E501`. It reads rules from the
  installed tools, so it needs `gspot install` first. (87e4a3d, 7e76cc7)
- `gspot install` exits 2 below npm 11.19.0, pnpm 10.16.0, or Bun 1.3.0, which enforce the release hold. Upgrade the
  package manager. (574a0bd)
- The pre-push hook refuses an update of the default branch whose remote tip is not an ancestor of the pushed commit.
  Merge the remote branch, then push. (97e184c)
- `gspot init` exits 2 before it replaces a config that Git does not hold unchanged at `HEAD`. Commit it or move it
  away. (5d2d520)

#### JSON output

- Every `--json` object starts with `version`, `exitCode`, and `notes`, and a failure adds `error` and `message`.
  (b156f02)
- Error codes: `output`, `pin`, and `prompt` are gone, and `parse` and `runtime` are new. A malformed file reports
  `parse`, not `filesystem` or `settings`. (1103f0e, 5478449, fec3887, 87e4a3d)
- `init`: `written: true` is now the `written`, `updated`, `removed`, and `unchanged` path lists, and `settings` is
  `settingsText`. In `plan`, `retained` is `keep`, `noLongerRuns` is gone, and `lintFolders`, `lintCommands`, and
  `carryover` are new. (b156f02, 88e7c83, 1103f0e, 2e9a01b, 2b6a2e5)
- `install` returns `summary`, `installed`, `missing`, and `steps`, and `notes` holds what you still have to do.
  (b156f02, 88e7c83)
- `doctor`: `version` is a string, not `{ pinned, running }`. `hooks` and `ci` are objects, not strings. `suggestions`
  drops `detected` and `lintJobs` and adds `lintCommands`. `environments` and each tool's `kind` are new. (b156f02,
  fec3887, 88e7c83, 2e9a01b, 5b1fc3c, 99804da)
- `list`: each check item uses `check` and `status`, not `name` and `state`, and `removed` is new. In `list settings`,
  `reason_needed` is `reasonRequirement`. (88e7c83, 9592b93)
- `explain`: `rules` is `ruleFiles`. For a setting, `current` is `value`, `reason_needed` is `reasonRequirement`,
  `language_defaults` is `languageDefaults`, and `name`, `configurations`, and `languages` are gone. (bd1bb0e, 88e7c83)
- `check`: `stage` is the list `stages`, `reproduce` is `rerun`, and `historyComplete` is `shallow`, with the value
  inverted. Help moves to the check result, so a finding keeps `help` only where it differs. (5c0a2a1, bd1bb0e, 18b5e60)
- `check` drops the `name` of a finding, the `names` and `until` of an ignore, and `fixes.diffs`. (a7abd91, 5cc1c2a,
  fb49bde)
- `set`, `unset`, `add`, `remove`, `ignore`, and `unignore` return `changed` and `summary`, and an edit that changes
  nothing omits the file lists. The `unignore` note moves from `warning` to `notes`. (b156f02, 88e7c83)

#### Checks

- Seven checks take new names. Rename them in ignores with this table. (714f07f, b9459d8, 053984b, b630099)

| 0.3.7                            | 0.3.8                          |
| -------------------------------- | ------------------------------ |
| `jest/coverage`                  | `jest/tests`                   |
| `vitest/coverage`                | `vitest/tests`                 |
| `pytest/coverage`                | `pytest/tests`                 |
| `swift/coverage`                 | `swift/tests`                  |
| `duplication/jscpd`              | `structure/jscpd`              |
| `secrets/env-examples`           | `secrets/environment-examples` |
| `gspot/conflicting-config-files` | `gspot/conflicting-configs`    |

- Level `basic` reports more. `python/vulture`, `site/unused-assets`, `xcode/unused-assets`, and `html/inline-scripts`
  move to it, with the Node security rules, clear-text protocols, and the `package.json` `type` and `files` rules. Ruff
  `RET503`, `S101`, and `S311` and SwiftLint `force_unwrapping` move too. (058205d)
- Level `basic` also reports `@ts-ignore` and `@ts-nocheck`, `any`, `namespace`, `this` aliases, and triple-slash
  references in TypeScript, `console` output, work markers, Python `print` and `Any`, and the Dockerfile `ADD`.
  Correctness selectors that ran only at `all` run at both levels. (bb584b6, 2355562, ef2355e, 6c3c337, 1103f0e)
- Vitest reports raw mock casts, loops of tests, and deep `describe` nesting, at both levels. (6f3af87)
- `bash/safety` reports the `function` keyword, `typeset`, combined redirects and pipes, brace `for` loops, `echo`,
  `bash -lc`, GNU `timeout`, and `curl` without `--fail`, at both levels. It also reports `eval` and a download that
  runs in a shell. (d177939, 96c8b39)
- Stylelint reports physical properties and font sizes outside `rem`, `em`, and percent, and Ruff `PLW1514` runs, at
  both levels. ESLint adds `n/hashbang`, and `no-unpublished-import` checks private packages too. (eec225b, 2c6f8f2,
  d62c215)
- `gspot/detected-configurations` fails until each configuration that your files suggest is added, or removed with a
  reason. The finding prints the line to run. (b1bf1aa)
- `gspot/conflicting-configs` fails on each old lint command: package scripts, lint-staged entries, hook lines,
  pre-commit entries, CI steps, and repeated devDependencies. It also fails on the settings of black, flake8, isort, and
  mypy at the root: their own files, and their sections in `pyproject.toml`, `setup.cfg`, and `tox.ini`. (2e9a01b)
- `engineering/nested-agents-files` fails on a tracked `AGENTS.md` outside the root. (408109c, 322d86c)
- `prose/vale` runs only at level `all`, so level `basic` does not install Vale. An ignore of `gspot.dates` moves to
  `prose/dates` and its `ambiguous-date` rule. (e805619)
- `data-files/yaml`, a built-in check, replaces `data-files/yamllint`. (87e4a3d)
- `licenses/allowed` reads licenses from lockfiles through osv-scanner and needs the network. A project without a
  lockfile stops with a note, and gspot selects `licenses` only through `gspot add`. (b16081a, aeb8951, 5082d75,
  5a9a172)
- `site/size` and `security/semgrep-registry` are gone. (01613f3)
- `security/semgrep` runs only the FastAPI rules and `security.rule_files`. The JavaScript, Express, Next.js,
  Cloudflare, and Supabase rules move to ESLint, so their findings carry `javascript/eslint`. (8dacba8, 1756a35,
  96c8b39)
- gspot stops running eslint-plugin-sonarjs, because its license excludes AI use of its output. gspot rules and other
  tools take over its findings. (dc200e4, b394d85, 6011e51, 14e5907, b59691b)
- `@eslint-react/eslint-plugin` replaces eslint-plugin-react, and eslint-plugin-jsx-a11y-x replaces
  eslint-plugin-jsx-a11y, with new rule prefixes. eslint-plugin-react-native and its `react-native/*` rules are gone.
  (bd1bb0e, 8dec3fe)
- `gspot/no-trivial-files` replaces eslint-plugin-barrel-files. (1d379d6)
- Tools move up major versions: ESLint 10, Stylelint 17, stylelint-config-standard 40, eslint-plugin-unicorn 78,
  eslint-plugin-astro 3, eslint-plugin-zod 5, eslint-plugin-jsdoc 65, PurgeCSS 8, and editorconfig-checker 4. (bd1bb0e)
- Prettier now formats the embedded code of Vue and Astro files, so those files can report as unformatted. (ab38372)
- `dependencies/package-manager-pin`, `dependencies/stale-lockfile`, and `react-dom/react-versions` move from push to
  commit. `package-manager-pin` reports a pnpm, Yarn, or Bun project without a `packageManager` field. (4f4dec2,
  0ce71cc)
- ESLint uses `configs.unopinionated` of unicorn at `basic` and `configs.recommended` at `all`, so level `basic` runs
  about 200 unicorn rules that 0.3.7 did not. (e77fe4a, bd1bb0e)
- At level `all`, the production profile of ansible-lint moves from `ansible/ansible-lint` to its own check,
  `ansible/ansible-lint-production`, and `ansible/ansible-lint` is off there. Move an ignore to the new ID. (f767738)

#### Files that gspot writes

- Rule files sit at `.gspot/rules/<NAME>.md`, not under `.gspot/configurations/`. (439b47c)
- One `.stylelintrc.yml` at the repository root covers every scope, and replaces the `.stylelintrc.json` of each scope.
  (bf82b59, 791b05b)
- gspot writes no `.gspot/version`, no `.gspot/gspot.schema.json`, no `.gspot/state/`, and no `#:schema` line. Editors
  that read SchemaStore validate `gspot.toml`. (fec3887, ba6ece1, fda4981, 5ab5744)
- gspot keeps its ignore lines in `.gspot/.gitignore`, not in a block of the root `.gitignore`. (1103f0e, e59beec)
- `.gspot/hooks/commit-msg` exists at both levels, because `commits/references` runs at both. (b3f8962, c8c6b79)
- In a Yarn repository, the gspot tool project uses npm and `.npmrc`. gspot writes no `.gspot/.yarnrc.yml` or
  `.gspot/yarn.lock`. (2d4173d, d347162)

#### ESLint plugin 0.2.3

- `gspot/no-client-env` is `gspot/no-client-environment`. (b666a25)
- The plugin needs ESLint 10.13, typescript-eslint 8.71, and Node.js 22.22.3. (53eae9a)
- The `recommended` preset grows from 1 rule to 144 and `all` from 7 to 180, so a config that spreads one reports more.
  (dac9428)

### Known issues

- A machine without the HTML grammar stops at `gspot/suppressions` on a Markdown file, in a repository that selects none
  of `html`, `javascript`, `typescript`, or `site`. `gspot install` does not help. Run `gspot add html`, then
  `gspot install`. (c4d90da)
- A plain `gspot check` and `gspot baseline` scan only staged changes and pushed commits for secrets, so a token that
  already sits in a file passes.
- `repository/conflict-markers` reads a line of seven equals signs as a marker. A setext Markdown heading of seven
  letters fails, and `gspot check --fix` skips that file. Write the heading with `#`. (858d170)
- With Bun, `gspot install` keeps the packages that a new tool lockfile drops, and the old eslint-plugin-jsx-a11y
  crashes ESLint in an Astro repository. Delete `.gspot/node_modules` before you run `gspot install`. (bd1bb0e)
- Node.js 22, and Node.js 24 before 24.20, ship an npm older than 11.19.0, which `gspot install` needs. Run
  `npm install --global npm@latest` first. (53eae9a, 574a0bd)
- `gspot apply` leaves each `.stylelintrc.json` of 0.3.7 and the `#:schema` line, which points at a deleted file. Delete
  both. `gspot/conflicting-configs` names each `.stylelintrc.json`. (bf82b59, ba6ece1)
- Moved documentation pages have no redirects, such as `/checks/security/`, `/configure/customize/`, and each check and
  plugin rule page. (aad8f35, f886b69, 9d0470a)
- `gspot unignore --paths` exits 2 when the file is gone, which 0.3.7 accepted. Edit the `paths` of the record in
  `gspot.toml`, or run `gspot unignore <check>` to remove every ignore of the check.

### Highlights

#### New commands and flags

- `gspot scan` copies the files that Git tracks into `.gspot-copies/`, sets gspot up in the copy, and runs every check
  at the default level with no fixes. It then deletes the copy. (5541747, 6add6bb, 3028dd0)
- The scan report gives the findings by category, the files that differ from your style, how long each tool took, and
  the plan of `gspot init`. It prints as text, `--markdown`, or `--json`. It runs your project's tools, so use it only
  on code you trust. (e03ec35, 57583c1, 7689112)
- `gspot baseline` writes `gspot.baseline.json`, a count of the findings per file, check, and rule. `gspot check` then
  fails only on new findings. Findings of `secrets/*` and `gspot/*` stay out. (62380b4, e977050)
- The check `gspot/baseline` reports each count that the run no longer fills, and `gspot baseline --prune` lowers the
  counts. (62380b4)
- `gspot check --skip <checks>` runs every check except the ones you name, `--stage <commit|push>` runs one stage, and
  `--only` also runs a check that your level turns off. (3ce6c06, 87e4a3d)
- `gspot init --from <file>` starts from the `gspot.toml` of another repository. (1103f0e)
- `gspot explain --verbose` prints the full rule explanation. (87e4a3d)

#### New checks

At both levels:

- `gspot/weakenings` lists what a push weakens in `gspot.toml` or `gspot.baseline.json` against the base, and fails on a
  weakening without a reason. (e67f5a9)
- `repository/conflict-markers` reports merge-conflict markers in every tracked text file, and a file with a marker
  stays out of every fixer. (858d170)
- `repository/encoding` checks that tracked text files use UTF-8. (1103f0e)
- `commits/references` refuses a commit message with an AI session link, a `Claude-Session:` trailer, a finding ID such
  as `C3-BUG-019`, or a home folder path. It also refuses a plan step such as `step 3.77`, a CI skip marker, and a
  `Refs:` or `Closes:` footer without an issue number. (b3f8962, eb79a79, 97e184c)
- `github-actions/workflow-shape` reports a job without a timeout, a runner that ends in `-latest`, and
  `continue-on-error` without a comment. It also reports an expression in `run:`, a concurrency group that does not fit
  the triggers, and an upload without retention. (76c76ac)
- `docker/instructions` reports an install that can rewrite the lockfile and a download piped into a shell. It also
  reports an nginx tag that is not a full version, and a shell as the first `ENTRYPOINT` element. (6e3fb06)
- `swift/security` reports always-accessible Keychain items, MD5 and SHA-1, and secrets in `UserDefaults`, plist reads,
  and logs. (96c8b39)
- `xcode/build-settings` reports a target without strict concurrency, a run-script phase with no declared files, and a
  phase that runs the linter or formatter. (05a9f30)
- `secrets/environment-defaults` reports a secret variable read with a literal default value. (cb373f5, 5102d4a,
  bb00df4)
- `supabase/verify-jwt` reports `verify_jwt = false` without a comment. (0482b5d)
- `javascript/import-cycles` runs `import-x/no-cycle` alone at push, because it walks the whole import graph. Move an
  ignore of `import-x/no-cycle` from `javascript/eslint` to this check. (0025d29, 70eb787)
- `prose/dates` reports a date such as `03/04/2026` in Markdown text and code comments. (e805619)

At level `all`:

- `structure/function-order` reports a private top-level function below a public one in Python, Swift, JavaScript, and
  TypeScript. (e78f5ee)
- `swift/doc-comments` reports a public function whose doc comment leaves out a parameter. (04cd095)
- `docs/version-strings` reports a copied package version, and `javascript/biome` checks cognitive complexity. (e2b67d4,
  a26e20c, 87e4a3d)
- `prose/commit-message` runs the word rules of `WRITING.md` on a new commit message, and Vale reads code comments too.
  (c885afc)

#### What existing checks report

- `repository/local-files` reports tracked `xcuserdata/`, `*.xcuserstate`, coverage, and `.wrangler/` paths. (97e184c,
  e2b67d4, 07540e7)
- `postgres/row-level-security` reports a policy without a role, an identity call outside a subquery, `USING (true)`
  without a comment, and a client view without `security_invoker`. (0482b5d)
- `postgres/edited-migrations` reports `IF NOT EXISTS` on anything but `CREATE INDEX CONCURRENTLY`. (0482b5d)
- At level `all`, Vale reports AI session links, home folder paths, ASCII arrows, and page titles and headings against
  `WRITING.md`. Markdown link text and alt text move to markdownlint. (18c0e4b, c885afc, 2da63fc, e805619)
- `docker/dockerignore` reports a `COPY` source that the ignore file holds, and Stylelint reports a removed focus
  outline. `gspot/suppressions` reports an AI session link, finding ID, or plan step in a suppression reason or a
  `gspot.toml` reason. (e2b67d4)
- `bash/doc-comments` requires an `# Arguments:` section on a public function that reads arguments, and
  `python/pydoclint` checks one-line docstrings at level `all`. (18900d6, a1cc06f)
- `python/placeholder-docstrings` reports a class docstring that opens with `Class that`, `Class for`, or `A class`.
  (2c6f8f2)
- Level `all` adds `array-type`, `consistent-type-assertions`, `prefer-nullish-coalescing`, `no-mutable-exports`,
  `no-relative-packages`, `no-default-export`, and the ban on `FC`. (d62c215)
- Level `all` adds Stylelint limits on ID selectors, specificity, and state classes, Ruff `TID251` and `TID252`,
  `set -x` and `seq` loops in Bash, and Squawk `require-table-schema`. (eec225b, 2c6f8f2, d177939, fde8504)
- Level `all` refuses vague test titles, titles that name a removal, script names that are not kebab-case, and
  sentence-case commit subjects. (6f3af87, b485889, c2c6dc5)
- The naming lists at level `all` ban abbreviations, generic verbs, prepositions as a first word, and negated
  predicates. Camel and pascal case refuse two capitals in a row, and Swift keeps acronyms. (bc763f8, a6f8a60)
- Selectors report `next/link` and `next/navigation` under next-intl, `useForm` without `defaultValues`, `Dimensions`
  read at module load, and two Playwright waits. Vue reports lost reactivity. (07540e7)
- `svelte-ignore` and coverage-ignore comments need a reason, and a module-level Zustand store inside a store file
  reports at level `all`. (07540e7, 10eabc6)
- The `@eslint-react` naming rules and `use-state` run only at level `all`. (ed30773)
- `package-json/restrict-dependency-ranges` pins only the `devDependencies` of a published package, and every range of a
  private one. (dc1bad1, 3617481)
- A file belongs to the first `[[import_rule]]` that matches it, also in ESLint. (45bd26a)
- One finding comes from one tool in more cases. Ruff `D417`, ten SwiftLint layout rules, unused Python classes and
  functions in basedpyright, and `unicorn/no-abusive-eslint-disable` are off. (a5ca03a, 3ff4058, 6cbe7af, 5853dd8)
- `docs/missing-paths` leaves inline link targets to lychee, and editorconfig-checker skips formatter-owned files.
  (55091dc, 2cec25a, 3538816, 0025d29)

#### ESLint plugin 0.2.3

- The plugin grows from 9 to 183 rules. The `recommended` preset turns on 144 and `all` turns on 180. (dac9428, ad83d6e,
  03a8fc9, c28e983, b666a25)
- The new rules cover logic bugs, loops, regular expressions, types, tests, and assertions. They also cover React, Vue,
  lodash, jQuery, Axios, JSX tables, web servers, cookies, cryptography, and AWS CDK stacks. (50484c0, 85fd3b8, 63c9af6,
  5d834a3, b9cde10, db5465d, cd3dfee, be56740, 383511f, 481362d, 6da0d85, 526c8eb, 74a2225, fab6ff0, 1ffdad8, 27ae074,
  df76245, 7a78d8f, 6adafbf, eb0d0c7, b86d223, 6b3575c, 9828d14, 2556127)
- `gspot/restricted-syntax` takes the selectors of every scope in one block, and leaves the core `no-restricted-syntax`
  to you. (b92fc89)
- `javascript.import_boundaries` adds folder globs, such as `src/features/*`, that `gspot/import-boundaries` keeps
  imports inside. `eslint --fix` writes the alias. (c2e8f6b)
- `gspot/no-client-environment` also reads Vite apps, Astro scripts, and Expo code, follows `process` destructuring,
  reads `Deno.env.get`, and allows Vite's built-in names. (39a80ac, 08077a0, e25fc22, f3824c9)
- `gspot/no-trivial-files` takes a `reexports` option, reports each re-export once, and spares a module with side-effect
  imports. (1d379d6, f1fca8f)
- `gspot/no-trivial-functions` skips overload implementations, framework exports through `exportNames`, decorated
  methods, constructors with parameter properties, and object-literal members. Its message names the function. (e4bda56,
  47ec5ce, 5770115, 08da1b1)
- `gspot/no-renamed-exports` reports a rename made in the import and in exported destructuring, and treats only imported
  and module-bound names as aliases. (49cbcea, 273ea09, cd5adb8)
- `gspot/no-magic-numbers` reports call arguments in module-level constants, such as `app.listen(8080)`. (ac8dcd5,
  53cfd79)
- `gspot/no-comments-in-imports` keeps explaining comments in place and allows tool directives. (0117a5e, 8e76958)
- `gspot/import-boundaries` matches exact and suffix aliases and says where to declare an alias, and
  `gspot/no-index-imports` reads `~/` paths. (14c047c, a176aaf, f796876)
- `gspot/require-server-only` accepts markers in plain JavaScript, and refuses empty and type-only imports. (0d3b5e0,
  7a29b65)
- Rule docs links point at the section of each rule on one page, and the README lists what the plugin reports. (e035dc9,
  aad8f35, 33f30f9, d47ca7d)

#### `gspot init` and migration

- `gspot init` selects a configuration only from strong evidence. Ansible needs its config file, a playbook, or an
  inventory file, Supabase its `config.toml`, and a site its build outputs. (5082d75, 428524e)
- Site also detects VitePress, Docusaurus, and Eleventy, and Postgres detects psycopg variants. (5082d75, c02048f)
- `gspot init` carries Prettier options, Ruff format options, and `.editorconfig` values into `[format]`, with the new
  `format.bracket_spacing`, `format.arrow_parens`, and `format.prose_wrap`. A value it cannot hold prints as dropped.
  (d63cd00, 896d126, 56b79bc, 83b0d08, 13f5461, 95a02ca, ac37b21, 95d83e3, 6b4cfb5)
- `gspot init` turns ignore files and Ruff excludes into `[[ignore]]` records, and compares your Ruff, markdownlint, and
  commitlint rules with what gspot runs. `tools.ruff.rules` holds the Ruff selectors that gspot does not run. (9755784,
  72eb6dc, 5fa9dbb, f123eb4)
- `[[tools.eslint.plugins]]` and `[[tools.stylelint.plugins]]` pin a third-party plugin by `package` and `version`, and
  `gspot install` puts it in `.gspot/node_modules`. gspot refuses one package at two versions. (fe0b0a2, 2f5dd85,
  fee1ed4, 52cb373, a3e885d, b5617f4)
- A config that `gspot init` replaces never stops it. A broken nested manifest or CI file gets a row or a note, and the
  plan names each config it does not read. (c9c9154, 1c33810, 599e6dc, 768c249, 5ff4790, 645041d, 8f1c054)
- `gspot init` lists the commands that call a replaced tool, each configuration with its scopes, and the `gspot.toml`
  text. (2e9a01b, e5e87aa, 7366a5a, 166e296, fa224e8)
- Hook lines for Husky, Lefthook, and pre-commit run the scripts in `.gspot/hooks/`. (9e06564)
- `gspot init` gives code without a formatter config the formatter's own defaults, and writes the site build command,
  OpenNext types, and each detected value into `gspot.toml`. It writes neither `hooks.enabled` nor `rule_files.enabled`.
  (102014c, 5fa4974, e6f0482)
- `gspot init` pins gspot in `package.json` or `mise.toml`, keeps the file's format, and names the install to run next.
  (017c924, df95bb6, 70c0d3a)
- A nodenext `tsconfig.json` wins over the import style of a framework, and a Deno scope asks for `.ts` imports.
  (8a2f33a, 794a233)

#### `gspot check`

- A check run prints one line per finished check when stderr is not a terminal, and `--json` stays quiet. (eef157b)
- A failed check with fixable findings prints a `fix:` line with its check and files. (c5e61e1)
- Report lines read status, scope, check, then tail, and the summary splits missing tools, missing environments, and
  errors. gspot says generated file, tool config, rule file, off, and absent in one sense each. (7379e5c, 5c0a2a1,
  2120653, 91a85ca)
- A pre-commit with nothing staged prints `Nothing is staged.` and exits 0. `commit-msg` reads `gspot.toml` from the
  index, and a staged check names the setup files that are not staged. (7701aec, c83253f)
- Hook failures name the PATH and the missing step, and a pushed ref without `gspot.toml` is skipped. (87e4a3d)
- A push of commits that leave the tree unchanged is checked, and a staged check reads pushed commits from the checkout.
  (6ae72cc, d263366)
- `--staged` findings stay within the paths you name, a `rerun:` line repeats your paths and base, and a canceled check
  says canceled. (2038588, 9719957, afd16d4, 7a02956, 691858a, a20972d)
- A check run fails when a fixer breaks a file, and gspot restores the file with your edits. (0800ac4, 2474921)
- A crash note shows the end of the tool's stderr, and a timeout note holds the output tail and the setting that raises
  the limit. mise's own failure reaches each affected check. (d5a92df, 0f17049, 5478449)
- A scope's `limits` reach the shared ESLint config, and a scope config file exists for each check that reads it. One
  broken scope config stays in that scope. (0553158, 0250ba8, 836eedb)
- A configuration that only a scope selects runs its checks there, and rule options for a missing scope are ignored.
  (5a9a172, 8a0d178)
- One process limit covers every tool process of a run, and a long built-in check no longer stalls a tool that is
  writing its output. (9ff2d08, eb61f1a)
- A broken manifest below the root gives a note in every run. (768c249)
- Check copies sit in `.gspot-copies/` inside the repository, and a run writes there only when a check needs a copy.
  (277e64b, f85c84e, 01a4164, 35b3835, 8d1089f)

#### Other commands

- `gspot install` builds the tool projects itself, starts each program after the install, and reinstalls one that fails.
  It repairs a broken `.gspot/mise.lock`. (aedf417, 7e8ff4a, 4adab9a, 971cbee, 39f309b, 0f17049)
- `gspot install` names `GITHUB_TOKEN` at the rate limit, blames the release hold only when it applies, and names each
  long step as it runs. (258766f, 078edf3, eef157b)
- `gspot install` runs `uv sync` in each project with a `uv.lock`, and `uv sync` recreates `.gspot/.venv` when the
  Python pin changes. (1e47077, e41f0af)
- `gspot install` downloads only the tree-sitter grammars that your repository needs, and checks each against a SHA-256
  value. (c4d90da, b5babaf)
- `gspot doctor` names only programs as tools, starts each one, reports the version it finds, and prints `newer` for a
  mise tool above its pin. (99804da, 4adab9a, d99622b)
- `gspot doctor` lists old lint commands, suggests configurations it detects, and includes the reason in removal
  commands. A missing Swift toolchain reports. (2e9a01b, d21a39d, 10bad9c, cc07468)
- `gspot list` prints every setting of every scope in full, groups equal scopes, and lists removed configurations.
  (0a73527, 9592b93, 62fccd1)
- `gspot explain` shows the ignores of a check and the removals of a configuration, offers `--scope` only for scope
  settings, and explains every core ESLint rule. Check help gives the fix alone. (14aa0ea, 9592b93, 377706b, b6c9b4c)
- `gspot set` parses words by the type of the setting, keeps numeric words in string settings, and validates values
  before reasons. (207ce7f, f43c62d, 79b4e80)
- `add`, `remove`, `set`, and `init` write `gspot.toml` in one order and Taplo's layout, comments in scope tables stay,
  and an edit keeps a written default. (e0391e1, 684668f, 17d7a5a)
- Setting errors name the affected key, and rule options and environment readers need no reason. (38565d8, 8751bfe,
  46688d7, 0a97cc3, d8749a9, e06971b, 3c57c90, e81dffb, d390e21)
- `gspot add` and `gspot remove` report only what changed. `remove` records a name only when detection brings it back,
  and prunes the settings of what it removes. (f5ca02c, b891c4a, fbc0a88)
- A `--json` flag after `--` stays a value. (c8b1e81)
- `gspot apply` says which folder its file count covers, notes changed tools only when a tool lockfile is stale, and
  restores a deleted `.gitattributes`. It warns about managed keys only when ownership ends. (c6db52f, 1e9a73b, f1cb7c9,
  6bf3304, 3dd8f79, e000054)
- `--help` wraps at 80 columns. Commander errors read like gspot errors and name the help command, and an extra word
  after `--version` exits 2. A note about one pushed commit uses the singular. (1071bad, 2120653, 68622fd, a491824)
- On Windows, the cache moves from `%LOCALAPPDATA%\gspot\Cache` to `%LOCALAPPDATA%\gspot`. (1ea7508)

#### Generated files and rule files

- Every file that gspot owns outside `.gspot/` starts with the gspot header, and `.gitattributes` marks each one
  generated. `AGENTS.md` and `.gitattributes` keep a managed block instead. (791b05b, 51ada9c, 1f8264f)
- Generated ignore lists leave out submodule checkouts and what Git ignores, and inherited Markdown pointers stay out of
  them. (54bb058, 5927a9b, 28319e1)
- `gspot apply` deletes a stale generated file only where gspot writes it. (0591d23)
- A `{setting:<key>}` token shows your value in rule text. `ANSIBLE.md`, `JEST.md`, and `PYTEST.md` ship, and
  `COMMENTS.md` and `GIT.md` join the rules that agents read first. (8df73af, 349ae75, 87e4a3d, 439b47c)
- Shipped rule text matches what the checks do, examples pass the shipped checks, and `WRITING.md` holds the privacy
  rules. (0693442, 34a7071, 4a46bd9, ee2b0fc, a4fbcac, 9f609ec, e09ef99, 6fda966, 2548fc4, 21b6a27, fac79cb, a81ea7c)

#### Generated CI

- The GitHub workflow runs your test checks in their own `tests` job beside `lint`, through `--skip` and `--only`. The
  GitLab include keeps one job. (3ce6c06)
- The workflow names one exact Node.js version, and a package manager version only when `package.json` pins it, so two
  developers write the same file. (9c46555, 0ce71cc, e202ad4)
- The mise token reaches only the step that installs gspot, which runs before the code of the project. The cache holds
  only the mise download store and the npm cache. (54ec90f, 48ebc9c, 85b3b5f, 255597d)
- A job fails with a message that names the fix when `gspot install` changes `.gspot/`, and the slow checks step is
  gone. (face2df, 5304824, 1103f0e)
- The generator refuses a command that holds `${{`, and `actionlint` and `zizmor` now read the generated workflow.
  (bce279e, 82d1fa0)
- The swift configuration sets `ci.operating_systems`, and a written value wins. (e6f0482)
- The GitLab include runs in the mise image at the pinned version, in the `.pre` stage, with a cache of the mise
  folders. (9ed5bd6)

#### Security

- `gspot install` treats a mise lock with another checksum or a download outside the release hosts as stale, and writes
  it again. It refuses a tool lockfile whose package, pin, or Python index does not match. (43869e3, 5e39ddf, be50f16)
- Every mise pin carries a checksum per platform. (70edd7b, afe85f4)
- pnpm and Bun run with `--ignore-scripts` in the tool project, and install stops on a package manager settings file in
  `.gspot/`. (286ec20)
- gspot grants mise access to `.gspot/mise.toml` for one call, only while it holds the generated bytes. (ade8562,
  505869c)
- gspot resolves `git`, `mise`, `node`, and `npm` outside the repository, and looks up a mise-pinned tool only in mise
  folders, `.gspot`, and the system path. (67a3701, 3a6182c)
- A file name that starts with a dash stays out of command options, and a setting value that holds a placeholder stays
  literal. A revision copy refuses a `.gspot` link. (6c8c66c, e2dff5a, 45e04f6)
- Readable output drops escape sequences and bidirectional controls, and malformed registry credentials stay redacted.
  (53d1da8, 08726fc)
- The default nginx image is pinned by digest, and Vale runs without the global config of the host. (ce8a0d7, f494914)

#### Fixes by tool

- **Postgres:** Migration checks compare with the selected base, and replay table renames, column renames, and function
  security changes. `postgres/grants` reports `GRANT ALL` in default privileges, and indexes match composite foreign
  keys. (803772c, f42de15, da4200c, c9a151d, 1fea8af)
- **Postgres:** Numeric and `V`-prefixed freeze versions compare, Prisma and Drizzle migration paths count, row security
  skips without client schemas, and `postgres/edited-migrations` compares every base migration. (781f3eb, 23f1a2d,
  876e39f, cd4f61f)
- **JavaScript and TypeScript:** ESLint lints a TypeScript file that no tsconfig includes, and the nearest
  `package.json` decides how a `.js` file parses. Astro files parse in their own typed project. (7205338, adc24f9,
  c797e8a)
- **JavaScript and TypeScript:** Type roots resolve from each scope and stay inside the repository, compiler settings
  read through dependency links, and JavaScript checks use the generated target. (6896a18, 050f8fe, 85a4133, 49d2a7f)
- **JavaScript and TypeScript:** A Vitest scope without test files passes, and implicit `any` in JavaScript fails only
  at level `all`. (3d37391, 44b1aef)
- **Knip:** Default entries stay, only gspot's packages are hidden, and a package outside the workspaces runs in its own
  folder. (aa9a158, d5b32c8, cd45844)
- **Lint rules:** Testing Library rules read only Testing Library queries, `sql` fragments pass in Drizzle code, Astro's
  `:global()` passes in Stylelint, and `vue/require-default-prop` stays off. (62fc5e0, 28a54bf, 7720c43, 4fbd37a)
- **Lint rules:** React Native text wrappers, native snapshot names, JavaScript route names, and log fields pass. Zod
  asks for named imports at level `all`. (8dec3fe, c7bab55, 79ccb09, 67a8576, 3c8714f)
- **Selectors:** Query, form, tRPC, and Zustand selectors match at their syntax, and direct `innerHTML` and `outerHTML`
  assignments report. (3ceb035, 26a3b6e)
- **React and Next.js:** `react-dom/react-versions` compares direct importers, `@next/eslint-plugin-next` stays at the
  shipped pin, and the tool project installs no framework peers. (49a537e, 58744e6, ca592e0)
- **Naming:** Ordinary domain words stay out of findings, double-underscore tool folders match first, and silent-e word
  stems combine correctly. (bc2cfbc, 313a882, a944ada)
- **Python:** Pydantic and FastAPI runtime imports stay out of `TYPE_CHECKING`, a src-layout package counts as first
  party, `PLR0917` uses Ruff's default, and a linked `.venv` counts. (c00f880, d7e3143, 181f37d, c2253a0)
- **Python:** `structure/trivial-functions` exempts decorated functions and tests, and a bad requirement or uv setting
  names its file. (f3c49c3, 9d1eeb9, 8519954)
- **Swift:** One build serves the code, tests, coverage, and index of each scope, SwiftFormat keeps access modifiers on
  extension declarations, and package declarations parse as syntax. (62905bd, b7fa0ec, eba1135)
- **Swift:** Parsing Swift no longer takes gigabytes of memory, and Swift type files skip `structure/shared-prefixes`.
  (c3f8dd6, 83c5c3b)
- **Bash:** Quoted trap handlers count as calls, and function comments stop at the shebang. (e021623, ec79f2a)
- **Docker:** Ordered ignore allowlists work, named Compose overrides pair, `docker/compose` runs without a daemon,
  Docker checks skip scopes without inputs, and the probe uses the located binary. (402bfc0, 7f4b56d, fbc62d1, 5f5f93e,
  170f3a0)
- **nginx and GitHub Actions:** A colon in a path no longer breaks the nginx check, and local actions outside the
  workflow folder reach the copy. (6dcdf2b, 02ad272)
- **HTML and sites:** `html/inline-scripts` tells script types apart, site builds get the tracked root files, malformed
  sitemap locations report, and unused-selector checks read project styles only. (f1615a2, bf7c853, 9d67e19, 95cfdd9)
- **HTML and sites:** `astro check` diagnostics report in every file type, and `site/purgecss` finds its child script
  beside the running module. (d93d5e1, b286ec6)
- **Dependencies:** `dependencies/lockfiles` reads the download format of each lockfile and checks only download URLs.
  (16e04f3, e7a3260)
- **Prose and comments:** The `typos` fixer rewrites only prose files, and `gspot/suppressions` reads HTML comments in
  MDX and comments in component code sections. (0cebed1, e8a6825, 0253eb8)
- **Prose and comments:** `structure/long-files` honors file ownership, unused-asset checks read literal glob imports,
  and Vale masking keeps inline code. (4f20d9d)
- **Supabase and links:** A schema-validated body passes, malformed settings report, a staged symbolic link runs
  `repository/local-files`, and links stay out of every tool's file list. (8786417, d8bf862, 87491bd, 15f3b17, 84b2516)
- **Package managers:** Yarn runs entry commands through `exec`, Bun hooks use the installed binary, and nested packages
  name their manager. (63b3241, a5ba2f0, 9d2081a, 02ad4e7)
- **Git and errors:** Git refusals report with Git's message, and `core.hooksPath` reads one way in every hooks check.
  Failures that you can fix print as named errors, and warnings reach `notes`. (1024471, 12c2121, 08fc28c, e69b9fa)
- **Repository reads:** A tool that reads `PWD` sees the folder it runs in, and a file named `constructor` no longer
  breaks the file tables. Generated files keep one order in every locale, and an invalid alias in `mise.toml` reports as
  a TOML error. (69df915, 83d327d, 2c373d2, 5f26550)
- **Windows:** A tracked link becomes a file when links fail, npm tools start through Node, tsconfig and dependency
  paths match, and vulture findings stay. Reads and writes no longer refuse a path segment that names a device. A
  `[[scope]]` path with such a name stays refused. (bde4ae5, 4cd02ec, 681fa54, d149198, 03fb2d1, f75a103, ebc2085)
- **Processes:** gspot stops a tool with SIGTERM, then SIGKILL after 3 seconds, and starts no process whose cancel
  signal fired. Downloads honor proxies, and Python tools run in UTF-8 mode. (b588e30, bfab269, cc07468)

#### Speed and size

- The npm package bundles its pure-JavaScript dependencies, so an install adds 5 packages, not 150, and it ships no
  grammars. `gspot --version` drops from about 300 ms to about 165 ms on Node.js 24. (29cb8f5, c4d90da, f2c2114)
- JavaScript repositories install no Python for security checks, and zizmor installs through mise. (8dacba8, 96c8b39,
  69dc414)
- A staged check runs in place when the index matches the working tree, and a commit reads only the files it needs.
  (49b3523, e29bf22, 150eca3)
- Git calls no longer block, one `git log` reads all pushed messages, staged writes skip fsync, and only Swift files
  that can carry a tag get parsed. (9949b1a, 55e05e7, 1492e4f, 5a63e8c, 92217ef)
- `gspot apply` lists owned configs once, and the generated ESLint config prints shared values once. (a1252e9, 29998f6)
- `gspot install` skips what it already installed, through `npm install --no-save` and the Vale release file. (fda4981,
  362b1e9, 7dc1d62)

#### Runtime

- The CLI runs on Node.js 22.22.3 or newer, down from 24.15, and on Bun 1.4.3 or newer. (53eae9a, c3f447a)

#### Documentation

- Footprint and the [site guide](https://generativespotting.com/topics/site/) are new. The topic guides move from
  `/checks/` to `/topics/`, and Customize merges into the `gspot.toml` guide. (87e4a3d, 8afc591, f886b69, 9d0470a)
- Each check is a section of its configuration page, and each plugin rule a section of one page. (aad8f35)
- The [JSON output](https://generativespotting.com/reference/json-output/) page has a field table for each command.
  (88e7c83, b156f02, fd11d94)
- The migrate page starts from `gspot scan` and explains the carry-over table. The Quickstart names the Node.js minimum
  and says to run `gspot check --fix` before the first commit. (b8e3cb9, 37b76aa, 77bf814, b50371d, c885f5b)
- The Trust section lists every input that runs code, and the CI page names the repositories that need their own
  pipeline. (9c9029d, 3e59042)
- The site drops the per-page Markdown copies and the Agent Skills files, and `llms-small.txt` keeps the hand-written
  reference. (6351dcd, e83494a, 5ddb870)
- Long table cells wrap on a phone, and the home page gets its own layout with the search box. Pages paint earlier, and
  the font swap moves no text. (595422d, 11c3a29, daecefd, f3dcc6b, 9006d59, 5cefdda)
- The CLI package names the issue tracker. (ce4cd74)

### Development

The CLI source moved into layers from `system/` to `commands/`, with each configuration's checks and generator beside
its manifest, and `gspot check` reports an import that breaks the order. The unit suite now runs before each push,
integration runs in three shards, and CI tests the Node.js floor through the e2e suite. The release runs from one task
and pushes tags before it publishes.

Released 2026-11-02. [Compare with 0.3.7](https://github.com/stefanionescu/gspot/compare/v0.3.7...v0.3.8)

## 0.3.7

gspot 0.3.7 gives the generated GitHub workflow one `lint` job per system, and adds `ci.linux_runner` to pick the runner
of the Linux job. It also fixes two failures in check runs and moves Zod past a memory advisory. With GitHub CI, the
upgrade needs a change to your required status checks. The ESLint plugin stays at 0.2.2.

### Upgrade from 0.3.6

1. Install 0.3.7 with your package manager, such as `npm install --save-dev --save-exact @gspothq/cli@0.3.7`.
2. Run `gspot apply`, then `gspot install`.
3. With GitHub CI, update the required status checks of each protected branch, as the breaking changes below say.
4. Run `gspot check`, and commit `.gspot/` and the other generated files that changed.

### Breaking changes

GitHub workflow:

- The job `check-linux` is `lint`, and `manual-linux` is its last step, `Slow checks`. With several systems, each job is
  `lint-<os>` with the name `lint (<os>)`. Update required status checks that name the old jobs. (4aab79e)
- A push runs the job on the default branch only. A push to another branch runs nothing until you open a pull request. A
  push to a branch with an open pull request no longer runs the job twice. (4aab79e)
- `Slow checks` runs only on a push to the default branch, in the same job as `Lint`, and only when `Lint` passes.
  (4aab79e)

### Known issues

- `gspot check --staged` and the Git hooks stop with `Cannot read the compiler settings in` when a tsconfig extends a
  package in a `node_modules` folder that has no `package.json` beside it.

### Highlights

#### CI

- `ci.linux_runner` sets the runner label of the Linux job, for a larger or self-hosted runner, and defaults to
  `ubuntu-24.04`. It works on GitHub only: gspot refuses it with `ci.provider = "gitlab"`. (4aab79e)
- `gspot check --changed` treats an empty ref or a ref of all zeros, as CI gives for a new branch, as "check every
  file". A ref of all zeros used to stop with an error, and an empty ref used to compare with the upstream branch, else
  the default branch. The GitHub and GitLab workflows now pass the base straight to it. (4aab79e)
- The GitHub cache key covers the gspot version, the tool files in `.gspot/`, and your lockfiles, in place of
  `gspot.toml`. `restore-keys` reuse the newest cache, and the workflow saves the cache right after the installs, so a
  run with findings still saves it. (4aab79e)

#### Fixes

- gspot builds config files from the repository root in every run. With a tsconfig that extends a package in
  `node_modules`, `markdown/markdownlint` and `docker/trivy-config` no longer stop with
  `Cannot read the compiler settings in`. (6e0727d)
- `docs/missing-paths` reports a documented path outside the repository, such as `../../scripts/app.js`. It used to stop
  with exit code 2 and ``path should be a `path.relative()`d string``. (6e0727d)
- The rule index in `AGENTS.md` holds the whole first paragraph of a rule. It used to cut the sentence at its first line
  break, as in the entry of `SAFETY.md`. (6e0727d)
- Vale accepts the acronym ASD. (6e0727d)
- `@gspothq/cli` depends on Zod 4.6.7. Zod before 4.6.6 can exhaust memory while it validates an oversized constrained
  collection, which is advisory GHSA-mrhx-c7xc-m3w5. (128fead)

#### Documentation

- The docs site paints dark on a cold visit, and the Latin files of Geist and Geist Mono load ahead of layout. Pages no
  longer flash white or swap from the fallback font, and the theme script switches to light for readers who chose it.
  (460ed2b)

Released 2026-10-23. [Compare with 0.3.6](https://github.com/stefanionescu/gspot/compare/v0.3.6...v0.3.7)

## 0.3.6

gspot 0.3.6 renames many checks, lint rules, settings, and JSON fields. `gspot export`, `gspot init --from`, TruffleHog,
and import-linter are gone, and lychee replaces linkinator. An ignore past its `until` date now fails
`gspot/suppressions`, and ESLint plugin 0.2.2 reports every small named function at level `all`. The upgrade needs edits
to `gspot.toml` and to each script that reads `--json` output, so read the steps before you install.

### Upgrade from 0.3.5

1. Install 0.3.6 with your package manager, such as `npm install --save-dev --save-exact @gspothq/cli@0.3.6`.
2. In a Git repository, move a `gspot.toml` that sits below the Git root to the root, as a `[[scope]]` record.
3. Edit `gspot.toml`, with the `gspot.toml` changes below. `gspot apply` names each key and configuration that it
   refuses.
4. Rename checks and lint rules in `[[ignore]]` records, in suppression comments, and in `--only` scripts, with the
   tables below and the ESLint plugin list. gspot refuses an old check name. It accepts an old rule name in a record,
   and the findings of that rule come back.
5. Run `gspot apply`. It moves the generated files, rewrites `eslint.config.mjs`, and adds a `#:schema` line to
   `gspot.toml`.
6. Run `gspot install`. Until then, `gspot/generated-files` fails on the tool lockfile.
7. Add `--reason` to each `gspot remove` in your scripts, and update each script that reads `--json` output.
8. Run `gspot check`, fix the new findings, and commit `gspot.toml`, `.gspot/`, and the other generated files that
   changed.

### Breaking changes

`gspot.toml`:

- gspot reads `gspot.toml` only at the Git root of a Git repository. Inside a repository without a root file, `cd api`
  and `gspot check` print `There is no gspot.toml here.` Use a `[[scope]]` record for the folder. (c8e2ba0)
- `allowed_words` is `spelling.allowed_words`, in the `[spelling]` table, and a scope adds its words to the root words.
  (63dee64)
- The configuration `files` is `data-files`. (63dee64)
- `removed_configurations` needs a reason: write `removed_configurations = { value = ["nextjs"], reason = "<why>" }`. A
  plain list stops with `removed_configurations needs a reason`. (c8e2ba0)
- `[[command_check]]` takes `id` instead of `name`. In its `output` table with `format = "json"`, `items` is `list`.
  (63dee64, 06ea945)
- `[[command_check]]` output takes no `file_type`, and refuses `format = "trufflehog"`. (c8e2ba0)
- In a `[[command_check]]` command, `{tool_file:<name>}` is `{config_file:<name>}`. gspot passes the old text to the
  command as written. (af3878c)
- `can_also_import` is gone from `[[import_rule]]`. Move the allowed rule above the record, or list the rules in
  `can_import`. (c8e2ba0)
- `tools.<tool>.extra` is gone for `editorconfig-checker`, `eslint`, `knip`, `prettier`, `shellcheck`, `taplo`, and
  `typos`. Delete the key. For every tool in that list but `eslint` and `knip`, delete its `[tools.<tool>]` table too.
  (c8e2ba0)
- `tools.semgrep.rule_files` refuses a path that names no file. (c8e2ba0)
- Under `.gspot/configurations/`, six rule files moved or merged. `rules.exclude` stops on an entry that matches no
  rule, so rename or delete their entries. (63dee64, 5bfd901)
    - `general/files/rules/YAML.md` is `general/data-files/rules/YAML.md`.
    - `general/engineering/rules/SUPPRESSIONS.md` is `general/gspot/rules/SUPPRESSIONS.md`.
    - `general/engineering/rules/CONFIGURATION.md` is `general/engineering/rules/SETTINGS.md`.
    - `language/bash/rules/LANGUAGE.md` merges into `BASH.md`, and `language/python/rules/DESIGN.md` and `FLOW.md` merge
      into `PYTHON.md`.
- The `postgres` configuration sets `tools.squawk.assume_in_transaction` to `true`, as `supabase` already did. Set it to
  `false` when your migration runner uses no transactions. (5bfd901)
- gspot refuses a local ESLint plugin prefix that names two modules. Give each module its own prefix. (022d65a)

Commands:

- `gspot export` and `gspot init --from` are gone. To start from another repository, copy its `gspot.toml` and the files
  that its settings name, delete the `[[scope]]` records you do not need, and run `gspot apply`. (c8e2ba0)
- `gspot remove` needs `--reason "<why>"`, and stops when `removed_configurations` already holds another reason.
  (c8e2ba0)
- An ignore past its `until` date stays in effect, so its findings stay hidden. `gspot/suppressions` reports
  `expired-ignore` on that record until you run `gspot unignore` or write a later date. (c8e2ba0)

Checks:

- These checks take new names. Rename them in `[[ignore]]` and `--only`. (c8e2ba0, 3001a94, 63dee64, 762118a)

| 0.3.5                         | 0.3.6                            |
| ----------------------------- | -------------------------------- |
| `dependencies/react-versions` | `react-dom/react-versions`       |
| `files/taplo-format`          | `data-files/taplo-format`        |
| `files/v8r`                   | `data-files/v8r`                 |
| `files/xmllint`               | `data-files/xmllint`             |
| `files/yamllint`              | `data-files/yamllint`            |
| `gspot/replaced-files`        | `gspot/conflicting-config-files` |
| `gspot/unmatched-patterns`    | `gspot/unmatched-paths`          |
| `html/scripts`                | `html/inline-scripts`            |
| `nginx/config-test`           | `nginx/syntax`                   |
| `site/linkinator`             | `site/lychee`                    |

- `site/lychee` reads the built pages without a server or network requests. gspot no longer installs linkinator, and
  `gspot init` no longer deletes `linkinator.config.json`. (c8e2ba0)
- `python/import-linter` is gone, and gspot no longer installs import-linter. Write a layers contract as
  `[[import_rule]]` records, lowest layer first, or run `lint-imports` as a `[[command_check]]`. (c8e2ba0)
- `secrets/trufflehog-pushed` is gone, and gspot no longer installs TruffleHog. Gitleaks scans staged changes and pushed
  commits, and no check asks a service whether a secret still works. (c8e2ba0)

Lint rules:

- These rules take new names. Rename them in `[[ignore]] rule`. (63dee64, 762118a)

| 0.3.5                                           | 0.3.6                                            |
| ----------------------------------------------- | ------------------------------------------------ |
| `dead-asset`                                    | `unused-asset`                                   |
| `dead-selector`                                 | `unused-selector`                                |
| `admin-key`                                     | `service-role-key`                               |
| `stem-collision`                                | `file-folder-clash`                              |
| `blanket-success`                               | `ignored-failure`                                |
| `unused-record` of `gspot/unmatched-paths`      | `unmatched-path`                                 |
| `replaced-file`                                 | `conflicting-config-file`                        |
| `function_branches`                             | `function-branches`                              |
| `block_nesting`                                 | `block-nesting`                                  |
| `function_assignments`                          | `function-assignments`                           |
| `gspot.dashes`                                  | `gspot.em-dashes`                                |
| `nextjs.checks-off`                             | `gspot.nextjs.checks-off`                        |
| `nextjs.env-secret`                             | `gspot.nextjs.env-secret`                        |
| `gspot.express.no-stack-trace-in-response`      | `gspot.express.stack-trace-in-response`          |
| `gspot.javascript.no-dom-html-sinks`            | `gspot.javascript.dom-html-sink`                 |
| `gspot.javascript.no-secret-in-log`             | `gspot.javascript.secret-in-log`                 |
| `gspot.javascript.jwt-no-algorithm-none`        | `gspot.javascript.jwt-verify-without-algorithms` |
| `gspot.javascript.jwt-no-decode-without-verify` | `gspot.javascript.jwt-decode-without-verify`     |
| `gspot.javascript.no-interpolated-exec`         | `gspot.javascript.interpolated-exec`             |
| `gspot.swift.no-secrets-in-userdefaults`        | `gspot.swift.secret-in-userdefaults`             |
| `gspot.swift.no-secrets-in-plist`               | `gspot.swift.secret-in-plist`                    |
| `gspot.swift.log-sensitive-data`                | `gspot.swift.secret-in-log`                      |
| `gspot.cloudflare.no-wildcard-cors-origin`      | `gspot.cloudflare.wildcard-cors-origin`          |

New findings at level `all`:

- `gspot/no-trivial-functions` reports each named function of `limits.trivial_function_statements` statements or fewer,
  two by default. Exported functions, methods, accessors, constructors, and recursive functions count. An anonymous
  function written inline as a value stays out. (0bb259f, 2cfe021)
- `structure/trivial-functions` does the same for Python, Swift, and Bash, with Python properties, overrides, overloads,
  and abstract and protocol methods. List a function that must stay under `names` in an `[[ignore]]`. (2cfe021)
- `structure/pass-through-folders` reports a folder whose only entry is one folder. It skips installed dependency
  folders and scope folders. (becde8a)
- ESLint reports a block statement that stands alone, and `structure/bare-blocks` reports a Swift `do` block without
  `catch`. (762118a)
- `naming/identifiers` reports the length of Python class and exception names. (f9ea634)
- The docs checks report a required README, LICENSE, or Xcode image that Git ignores. (907c62d)
- `gspot.ampm` reports `1 pm`, and no longer reports `5 amps`. (35d70c0)

New findings at both levels:

- In TypeScript files, `jsdoc/check-tag-names` reports JSDoc type tags. (762118a)
- `docs/missing-paths` reads `.mdx` pages. (df5de5f)
- `gspot/suppressions` reads Bats files, Python stubs, extensionless scripts, and TypeScript declarations. (69a2943)
- A scope's `tools.eslint.restricted_imports` reach its ESLint file, and an empty list clears the inherited ones.
  (b7c2e6c)
- A broken Supabase bucket table fails its check. (f4e70e9)

JSON output:

- In `check --json`, `skips` is gone: read `cause` on a `checks` item with `status: "skipped"`. The cause `inputs` is
  `no-files`, the cause `flag` is gone, and `ignores` items carry no `matched`. (c8e2ba0, 3001a94, 63dee64)
- The error codes `failure`, `installation`, and `manifest` are `unexpected`, `install`, and `configuration`. (63dee64)
- The error codes `template` and `files` are gone. A file that gspot cannot read or parse reports `filesystem`, and a
  failed copy of the files of a check reports `copy`. (c8e2ba0, d5c84a4, 63dee64)
- Invalid command values and flag combinations report `arguments`. (a9f60df)
- In `doctor --json`, the tool fields `hint` and `floor` are `help` and `minimumVersion`. A suggestion row without a
  command leaves out `command`, and its note holds the instruction. (63dee64, 5bfd901)
- In `apply --dry-run --json`, `stale` is `outdated`, and `notes` is gone. (66f070b, c8e2ba0)
- In `init --json`, `dryRun` is gone: `written` holds `true` or `false`. A declined plan also returns `settings`, and
  each item of `plan.configurations` has `origin` instead of `how`. (c8e2ba0, 3001a94)
- `install --json` has no `installed`, `list settings --json` has no `extras`, and `explain <setting> --json` has no
  `summary`. Read its `description`. (c8e2ba0, 3001a94)

Files that gspot writes:

- The main ESLint config file is `.gspot/configurations/language/javascript/eslint/eslint.mjs`, beside `functions.mjs`,
  and `eslint-runtime.mjs` is gone. Each configuration with ESLint rules writes its own `eslint.mjs`. Update your own
  files that import the old paths. (762118a, 1372714)
- `.gspot/configurations/general/files/` is `general/data-files/`. (63dee64)
- `data-files/v8r` validates `gspot.toml` against `.gspot/gspot.schema.json`, so it reports what the schema refuses.
  (79a4072)

ESLint plugin 0.2.2:

- `gspot/no-alias-exports` is `gspot/no-renamed-exports`, and its message ID `alias` is `renamed`. The message ID
  `noCommentsInImports` of `gspot/no-comments-in-imports` is `comment`. (63dee64)
- `gspot/no-trivial-functions` takes `trivialFunctionStatements` instead of `trivialStatements`, and reads no type
  information. (63dee64, 2cfe021)
- `gspot/no-trivial-files` reports only a file of imports, re-exports, and aliases, and takes only `allowIndex`.
  (2cfe021)
- `gspot/no-client-env` takes `client` and `allowedNames` instead of `isClient` and `allowed`. (63dee64)
- The plugin drops its optional `typescript` peer dependency. (2cfe021)

### Known issues

- `docs/missing-paths` stops with exit code 2 on a documented path outside the repository, such as
  `../../scripts/app.js`.
- With a tsconfig that extends a package in `node_modules`, `markdown/markdownlint` and `docker/trivy-config` stop with
  `Cannot read the compiler settings in`, in every run.

### Highlights

#### Settings and generated files

- `gspot.toml` starts with `#:schema ./.gspot/gspot.schema.json`, and `gspot apply` writes that JSON Schema of the
  running version. `gspot apply` adds the line, and `gspot init` and the settings commands write it. (79a4072)
- Editors that read Taplo directives, and `data-files/v8r`, validate `gspot.toml` against the settings of your pinned
  gspot, so an older repository sees no key it cannot use. (79a4072)
- `naming.css.*` and `naming.html.*` keys work as the published schema promises. gspot used to refuse them. (7216333)
- `gspot list settings` lists each `naming.<language>.<category>.cases` key of TypeScript, JavaScript, Python, Swift,
  Bash, and SQL. (c8e2ba0)
- The generated ignore lists of Prettier, ESLint, Knip, jscpd, and typos leave out `.env` and `.dev.vars` files, under
  the title `Paths that configurations leave out`. (c8e2ba0, a695822)
- Generated ignore lists anchor pointer files at the root, so your own file with the same basename stays checked. An
  `[[ignore]]` reason that matches a generated section title no longer changes what the jsconfig and typos files skip.
  (b501d6f, 3e77e55)
- Nested scopes keep their test, script, and mise task blocks. (d730a9b)
- A local ESLint plugin reaches its scope once. (022d65a)
- jscpd skips import lists, and `javascript/tsc` builds only the jsconfig of its own scope, so a broken jsconfig of
  another scope no longer fails it. (50e393b, 762118a)
- The generated commitlint config accepts the `!` marker, such as `feat!: <subject>`, and marks the commit as breaking.
  (4ee702a)
- The published JSON Schema holds no internal language, category, or reason metadata. (ad8c707)
- At level `all`, rule files drop their `<!-- level: all -->` markers, and every shipped rule file has new wording.
  (5bfd901)

#### Lint rules and checks

- Level `all` drops `import-x/exports-last`, `jsdoc/require-returns`, and `jsdoc/require-returns-description`.
  `n/no-unpublished-import` ignores type imports. (3001a94, 5bfd901, 762118a)
- `naming/identifiers` allows `config` in type and function names. (af3878c)
- An exact `package.json` import, such as `#entry`, needs no file extension. An alias with a path, such as `#lib/owner`,
  still does. (dc85d3b)
- `typescript/tsc` reports an error of a referenced project once, in the scope that runs the check for that project.
  (74fc550)
- `bash/unused-functions` counts a plain `trap` handler as a call, and `bash/unread-arguments` skips calls that forward
  `"$@"`. (64eef0a, 9abb8bc)
- A files-only naming allowance reads the file stem, not a folder name. (fbb68be)
- `dependencies/package-manager-pin` reads every mise file, `mise.local.toml` included, and follows the order of mise
  when two files pin one tool. (a2cbfcb)
- `prose/vale` accepts USD, EUR, GBP, and TODO. (98c234a)
- `site` detection counts `site.webmanifest` and `sitemap.xml` in any folder. (202012e)
- A nested Ansible project lints each file once, and `github-actions/actionlint` resolves the local references of
  `action.yaml` as it does those of `action.yml`. (7a6af33, 6483e01)
- Swift checks in the Git hooks reuse one build cache between runs. (916abbb)
- Outside Git, the file walk keeps symlinked files. Quoted `.gitattributes` patterns decode as UTF-8, and macro lines
  are skipped. (5959991, 2dca76c)

#### Messages

- A tool that exits with an error reads `<tool> failed with exit N:` and its output, in place of `<tool> broke: exit N`.
  (ff3d600)
- A failed Jest test is a finding named after the test, and `docker/trivy-image` quotes the stderr of Trivy. (ff3d600)
- `site/build` prints its command with shell quoting and keeps the output lines, and says when a build exits 0 without
  its output folder. `swift/build` names a tracked file that is missing. (9a2b207, 0bcc88d)
- A broken tsconfig or jsconfig reads `Cannot read the compiler settings in` and a path from the repository root. On
  Windows, a malformed one reports its JSON error instead of `Debug Failure`. (5e99fe2, d32bdb2)
- A broken JSON, TOML, or workspace file, a user file that is not UTF-8, and a held or broken writer lock each name the
  file and the next step. (d5c84a4, 5a37173, 90f707b, bfc5371)
- An EditorConfig selector that gspot cannot represent is a settings error, and an internal error ends with one period.
  (29ca484, dceacf1)
- A finding outside the scope keeps its own path. A message that ends in a bracketed word keeps that word, and gspot no
  longer guesses a rule from it. (44834b0, 1b789b7)
- Messages, help, docs, and the headers of pointer files say `config file` in place of `tool file`. A refused rule
  option says whether the rule runs only at level `all`, at no level, or in no plugin that gspot loads. (af3878c,
  5bfd901)

#### Commands

- `gspot remove --scope` drops an inherited configuration, and `gspot doctor` suggests no configuration you removed.
  (10701d0, 95bd158)
- `gspot doctor` reports the hooks as ready only when every hook runs gspot, aligns its suggestions, and lists each tool
  once. (40a7c42, 9d21b83)
- `gspot init` reads the EditorConfig section for every file as the project default, and other sections as overrides. It
  lists a file once, and plans `.gitattributes` only with Git. (07b7e25, 0717813)
- `gspot explain` lists every detection rule of a configuration and only the tool minimums of the check.
  `gspot explain <path>` lists the configurations whose checks read the file. (8c8fe9c, 19629fd, 74b78e3)
- `gspot check --json` and `--verbose` keep the `names` of an ignore, and the unstaged-changes line prints once.
  (a018833, dbe3c6b)
- `gspot apply --dry-run` and `gspot/generated-files` report a change of file mode alone. (fe6f75c)
- `gspot set` and `gspot add` quote each list value they report. For a key with no dot, the error of `gspot unset` lists
  the top-level settings. (d6b72f0, 7e1d8e8)
- The Git hooks print the gspot version to install when mise is missing, in place of `<version>`. The exact-version
  message quotes the package manager field. (9de7a2b, ab70b2a)
- `gspot list settings` aligns its columns. (b1e1af8)

#### Documentation

- Customize gspot lists each thing you can change and the command or setting that changes it. (5bfd901)
- The Share settings page is gone, and `gspot.toml` has a section on starting from another repository. (c8e2ba0)
- The npm page of `@gspothq/cli` shows the banner of the GitHub README. (c40a4cc)

### Development

The CLI source moved into `config/`, `types/`, `schemas/`, and one folder per configuration group, and the test suites
sit in `tests/suites/`. (c8e2ba0, 3001a94, 762118a) Every test assertion compares exact results. (9ed3393) The docs
deploy runs only inside the release task. (4591180)

Released 2026-10-23. [Compare with 0.3.5](https://github.com/stefanionescu/gspot/compare/v0.3.5...v0.3.6)

## 0.3.5

gspot 0.3.5 stops Vale from reading fenced code as prose, a false positive that 0.3.4 introduced. The ESLint plugin
stays at 0.2.1.

### Upgrade from 0.3.4

Install 0.3.5, run `gspot apply` and `gspot install`, and commit the generated files that changed.

### Known issues

- `docs/missing-paths` stops with exit code 2 on a documented path outside the repository, such as
  `../../scripts/app.js`. 0.3.7 fixes this.

### Highlights

#### Fixes

- Vale wraps each match of its ignores in backticks. The ignores for snake_case names and upper-case file names held the
  line break before a name, which broke the fence of a block that starts with one. They now start at a line start, a
  space, or a tab. (ba80dd4)

Released 2026-10-20. [Compare with 0.3.4](https://github.com/stefanionescu/gspot/compare/v0.3.4...v0.3.5)

## 0.3.4

gspot 0.3.4 removes four false positives that 0.3.3 reports, in `gspot/replaced-files`, Vale, `files/v8r`, and
`docs/lychee`. The ESLint plugin stays at 0.2.1.

### Upgrade from 0.3.3

Install 0.3.4, run `gspot apply` and `gspot install`, and commit the generated files that changed.

### Known issues

- Vale reads a fenced code block as prose when its first line starts with a snake_case name or an upper-case file name.
  The new ignores also match the line break before that name. 0.3.5 fixes this.
- `docs/missing-paths` stops with exit code 2 on a documented path outside the repository, such as
  `../../scripts/app.js`. 0.3.7 fixes this.

### Highlights

#### Fixes

- `gspot/replaced-files` and `gspot init` count a settings file with a plain name, such as `knip.ts` or `gitleaks.toml`,
  only at the root of a project. A dotfile such as `.prettierrc.json` still counts in any folder. (0eae15f)
- Vale's ignores for snake_case names and upper-case file names start after a space, so they stop breaking a code span
  such as `rules/BUN.md`. (0eae15f)
- `files/v8r` maps `gspot.toml` to a new file, `gspot-toml.schema.json`, that accepts it. v8r reads TOML dates as
  objects, which the published schema refuses, so a date such as `until` failed the check. gspot still validates
  `gspot.toml` on every run. (0eae15f)
- `docs/lychee` skips a link that is an MDX expression, such as `href={link}`, which it read as a file name. (0eae15f)

Released 2026-10-20. [Compare with 0.3.3](https://github.com/stefanionescu/gspot/compare/v0.3.3...v0.3.4)

## 0.3.3

gspot 0.3.3 applies `[[import_rule]]` to Python and Swift, adds Python checks at level `all`, adds three dependency
checks, and loads your own ESLint plugins. It also fixes many false positives and fixers that broke imports. The upgrade
needs work: `allowed_words` takes a new shape, Python formats with double quotes by default, and `--only` takes one
value. ESLint plugin 0.2.1 ships with this release.

### Upgrade from 0.3.2

1. Install 0.3.3 with your package manager, such as `npm install --save-dev --save-exact @gspothq/cli@0.3.3`.
2. In `gspot.toml`, write `allowed_words` as a table of word and reason, such as
   `allowed_words = { Nebulix = "The product name." }`.
3. To keep single quotes in Python, write `format.quotes = "single"`. To keep one English dialect, write
   `spelling.locale = "en-us"` or the dialect you use.
4. Delete the entries of `tools.eslint.rules` and `tools.stylelint.rules` for a rule that your level does not run.
5. At level `all`, rename `@typescript-eslint/no-magic-numbers` to `gspot/no-magic-numbers` in options, ignores, and
   suppression comments.
6. In scripts, replace `--only python/ruff javascript/eslint` with `--only python/ruff,javascript/eslint`.
7. Run `gspot apply`, then `gspot install`. At level `all` in a Python repository, `gspot install` adds `vulture`.
8. Run `gspot check`, fix or ignore the new findings, and commit `gspot.toml`, `.gspot/`, and the other generated files
   that changed.

### Breaking changes

`gspot.toml`:

- `allowed_words` is a table of `word = "reason"`. gspot refuses a list, its message for the `{ value, reason }` form
  shows the new shape, and `gspot set allowed_words <word> --reason "<why>"` adds a word. (1135fb4)
- Without `format.quotes`, Ruff formats Python with double quotes and Prettier keeps single quotes. Both used single
  quotes before, so `gspot check --fix` rewrites Python strings. (1135fb4)
- `spelling.locale` defaults to `en`, which accepts every dialect, not `en-us`. The typos fixer corrects misspellings
  only and leaves dialect spellings to the check. (1135fb4, 5e22c12)
- `tools.eslint.rules` and `tools.stylelint.rules` refuse options for a rule that the level does not run. gspot dropped
  them before. The refusal says `<rule> does not run at level <level>`. (40d2fa1)

Commands:

- `gspot check --only` takes one value, with commas or by repeating the flag. In `--only python/ruff src/app.py`, the
  second word is a path, not a check. (b511c43)

Checks:

- The new `structure/import-rules` runs at commit at level `recommended`. With `[[import_rule]]` records, it reports
  `uncovered-file` for each code file that no rule covers, in JavaScript and TypeScript too. Add a path to a rule, or
  ignore it. (50dd662)
- The new `gspot/replaced-files` runs at commit at level `recommended`. It reports the settings file of a tool that
  gspot writes settings for, such as `.commitlintrc.json`. Delete it, and move any rule you need into `gspot.toml`.
  (4b0c88b)
- Three new checks run at push at level `recommended`. `dependencies/stale-lockfile` compares `package.json` with its
  npm, pnpm, or Bun lockfile, `dependencies/react-versions` compares `react` and `react-dom`, and
  `dependencies/package-manager-pin` compares `packageManager` with the mise pin. (a546020)
- At level `all`, `python/vulture` reports unused definitions and unreachable code, and `python/function-size` checks
  `limits.function_lines`. basedpyright also reports import cycles and implicit overrides. (a06cf99)
- At level `all`, `gspot/no-magic-numbers` replaces `@typescript-eslint/no-magic-numbers`, and `jsdoc/tag-lines` asks
  for one blank line between a description and its tags. (40d2fa1, c2cea85)
- At level `all`, Vale reports an en dash through the new `gspot.en-dashes`, so an ignore of `gspot.dashes` no longer
  covers it. The new `gspot.tree-blocks` reports a file tree in Markdown. (c2cea85, a6b9570)
- `translations/messages` compares the arguments, tags, and select keys of each message with its base message. (a546020)
- `bash/inline-scripts` also finds `bun -e`, `deno eval`, `perl -e`, and `ruby -e`. The selector that reports a template
  literal in a log call also covers `logger.log`. (a6b9570, 40d2fa1)
- With `@opennextjs/cloudflare`, `cloudflare/stale-types` checks `cloudflare-env.d.ts` against `CloudflareEnv`, and it
  reports a types file that Git does not track. (a6b9570)

Files that gspot writes:

- Without `ci.setup_command`, the generated CI job installs the locked dependencies of each project before
  `gspot install`, and writes Next.js route types. An outdated lockfile fails that step. Set `ci.setup_command` to run
  your own install. (0e7f5e8)

### Known issues

- `docs/missing-paths` stops with exit code 2 on a documented path outside the repository, such as
  `../../scripts/app.js`. 0.3.7 fixes this.

0.3.4 fixes these four false positives.

- `gspot/replaced-files` and `gspot init` count a source file with a plain name, such as `knip.ts` or `gitleaks.toml`,
  in any folder as a tool settings file.
- Vale's ignores for snake_case names and upper-case file names break a code span such as `rules/BUN.md`, and Vale then
  reads its text as prose.
- `files/v8r` refuses a `gspot.toml` that holds a TOML date, such as `until` in an `[[ignore]]`.
- `docs/lychee` reads an MDX expression such as `href={link}` as a file name.

### Highlights

#### New settings

- An `[[ignore]]` without `check` keeps its paths out of every check and every generated tool file. `gspot ignore` and
  `gspot unignore` take the check as optional, and such an ignore needs `--paths`. (1135fb4)
- `[[import_rule]]` takes `can_import`, an exact list of the rules that a rule may import. A record writes `can_import`
  or `can_also_import`, not both. (1135fb4, d092287)
- `tools.eslint.plugins` loads your own ESLint plugin from a `.js` or `.mjs` path, and turns its rules on as errors for
  the code files of its scope. It may not take the prefix of a plugin that gspot loads. (c448fc9, 1135fb4)
- `javascript.externals` and `python.externals` name modules that a host provides, for `gspot/import-boundaries`, Knip,
  deptry, and `structure/import-rules`. `python.extra_paths` adds basedpyright search folders. (c448fc9, 50dd662)
- A `[[command_check]]` with `outputs` runs its command in a scratch copy and reports each output that differs from the
  committed file. (a546020)
- `gspot ignore --names` and the `names` field of `[[ignore]]` cover named definitions in `structure/trivial-functions`
  and `python/vulture`, such as a hook that a framework calls. (08be84b, a06cf99)
- A `[[licenses.allowed_package]]` record takes a name glob, and a semver range or `*` as its version. (8a3d255)

#### Commands

- `gspot init --level <level>` starts at that level, so the plan replaces the tool files of the tools that level runs.
  (4b0c88b)
- gspot refuses a Node.js or Bun older than the minimum in its `engines`, and names the version it found, in place of a
  load error. (b511c43)
- With path arguments, a project-wide check drops its findings in other tracked files. A finding in build output stays.
  (b511c43, f2fde0b)
- `gspot check --fix` names each code file that parsed before the fixers ran and fails to parse after, with the
  `git checkout` line that restores it. (5e22c12)
- A tool that runs out of memory reports the likely cause, not a garbage collector dump. (c94356d)
- The hook report stops suggesting `--no-verify`. The install note says that `gspot/generated-files` fails on the tool
  lockfile until `gspot install` runs. (b511c43)
- An unknown option of `gspot set` explains how to pass a value that starts with a dash. `gspot set` prints no
  `was undefined` note, and refuses `--reason` on a value that does not loosen a check. (b511c43, 59d596c, 1135fb4)
- `gspot ignore` escapes the brackets and parentheses of an existing route folder. (40d2fa1)
- A refused `gspot.toml` names the version that the repository ran before and the version that runs now, in place of a
  link to the release notes. (7c03cd7)

#### `gspot init`

- An old lint folder no longer counts as a project scope, and the plan labels it as a setup that gspot replaces. The
  plan lists disable comments that name rules gspot will not load. (4b0c88b)
- `gspot init` reads Prettier overrides and the Ruff quote style into `gspot.toml`. (4b0c88b)
- `gspot init` picks the import style: `ts` when the tsconfig imports `.ts` files by name, and `extensionless` for
  Bundler resolution or a bundler package. (5e22c12)
- The `AGENTS.md` block demotes its headings when the file has its own title. A `core.hooksPath` written as an absolute
  path or with `./` matches the hook folders. (4b0c88b)

#### Fixers and imports

- `extensionless` drops only the suffix of `.js`, `.jsx`, `.ts`, and `.tsx` imports. Other assets keep theirs, and
  `.mjs`, `.cjs`, and Node.js shebang scripts keep every suffix and use only `package.json` imports as aliases.
  (5e22c12)
- Duplicate TypeScript imports merge with inline type specifiers. The old merge wrote invalid code for a default import
  with an inline type next to a type-only import. The JSDoc fixer adds no empty doc blocks. (5e22c12)
- A refused import names the rules that the importing rule may import and the rule that owns the file. An override of
  `no-restricted-imports` keeps the bans of `tools.eslint.restricted_imports`. (d092287)
- `.js` files may import TypeScript files by their extension, because the generated jsconfig allows it. (40d2fa1)

#### False positives

- The naming check parses only the code files of a language, so TOML keys in `pyproject.toml` stop drawing naming
  findings. (8f15e53)
- Python dunder names skip the naming rules by pattern, and a module-level `TypeAlias` or typing form counts as a type
  alias. (08be84b)
- Naming accepts PascalCase for a variable that holds a `memo`, `lazy`, `forwardRef`, `createContext`, or `styled`
  result, and in a `.tsx` or `.jsx` variable. A destructured name keeps its source spelling, and a mise task may be
  `_default`. (40d2fa1)
- `structure/shared-prefixes` counts a file and its companions, such as `button.module.css`, as one name.
  `structure/lone-files` skips a folder whose only file is a Next.js or SvelteKit route file. (40d2fa1)
- `structure/trivial-functions` leaves out Python overloads, abstract methods, accessors, stubs, and methods of
  `Protocol` and `ABC` classes. It counts a use in the defining file as one more user of an exported function. (08be84b,
  6d9657d)
- `licenses/allowed` keeps only the packages that the lockfile holds, and maps Python trove classifiers to license IDs.
  It skips with a note while `licenses.allowed` is empty. (8a3d255)
- `translations/messages` compares each folder of locale files with its own base file. CSS Modules files accept
  `composes`, `:global`, and `@value`. react-refresh knows `catchError` from `next/error`. (40d2fa1)
- jsx-a11y lets an element with role `region` take `tabIndex`, so a keyboard can scroll it. (a6b9570)
- Knip keeps a declared package that a mise file task runs through `bunx`, `npx`, or a similar runner. (a546020)
- Vale stops reporting passive voice twice, and `Harper.NumericRangeEnDash` stops asking for the en dash that
  `gspot.en-dashes` reports. (c2cea85)
- Vale skips `@property`, `@prop`, `@arg`, `@argument`, `@callback`, `@yields`, `@enum`, `@this`, and `@satisfies`,
  snake_case names, and upper-case file names. (c2cea85)

#### Links and Markdown

- `docs/lychee` resolves a link that starts with `/` from the repository root, as GitHub does. A scope that selects
  `site` leaves it to `site/linkinator`. (a6b9570)
- markdownlint treats the leading import and export blocks of an `.mdx` page as front matter. `docs/missing-paths`
  counts a path that Git ignores as present. (a6b9570, c94356d)

#### Git and environments

- The patterns of each tracked `.gitignore` reach every generated tool file, so `tsc`, basedpyright, ESLint, typos, and
  Prettier skip what Git ignores. A force-added file stays checked. (c94356d)
- The generated jsconfig repeats the `exclude` of the nearest file in the `extends` chain, so an excluded folder stays
  out of `javascript/tsc`. (f2fde0b)
- In a repository whose tracked attributes use Git LFS, the gspot hooks run `git lfs` for its four hooks. Stock Git LFS
  hooks stop counting as other hooks at install. (b511c43)
- A repository that sets `UV_PYTHON` no longer breaks `gspot install`, because gspot names the Python of its own tools
  on each uv call. Python checks in the push hook read the environment of the working tree. (0e7f5e8)

#### ESLint plugin 0.2.1

- The `javascript` configuration pins `@gspothq/eslint-plugin` 0.2.1. (f9656cd)
- `gspot/no-magic-numbers` runs the typescript-eslint rule with the same options, and accepts the numbers of a
  module-level `const`. It needs the optional peer `@typescript-eslint/eslint-plugin` 8.70 or newer. (40d2fa1)
- `gspot/no-trivial-functions` stops reporting a function that code inside another function passes as a value and never
  calls, such as the `subscribe` argument of `useSyncExternalStore`. (6d9657d)
- `gspot/no-trivial-files` counts an exported function as content when it does more than forward, and its message says
  to import from the module that defines the forwarded code. (6d9657d)

#### Shipped rules and documentation

- `LANGUAGE.md` asks for `main` only in an executable that defines functions, as `bash/script-layout` checks. New rules
  cover stored data as contracts, read-only reviews, `fetch` and `response.ok`, Next.js `env`, and `z.coerce.boolean`.
  (6a462ff)
- A new Import rules page covers `[[import_rule]]`, and the guides cover the settings and checks of this release.
  (1ace52e)

### Development

GitHub releases hold only the tag and source archives, and the release task needs no notes section, so
`packages/cli/RELEASE_NOTES.md` is gone. (e327419, 7c03cd7)

Released 2026-10-19. [Compare with 0.3.2](https://github.com/stefanionescu/gspot/compare/v0.3.2...v0.3.3)

## 0.3.2

gspot 0.3.2 folds the `swift-tests` configuration into `swift`, so two check IDs change and the upgrade needs
`gspot.toml` edits in a Swift repository. The docs site joins its command and settings pages and rewrites its check,
configuration, language, and plugin pages. A repository without Swift needs only steps 1 and 6. The ESLint plugin stays
at 0.2.0.

### Upgrade from 0.3.1

1. Install 0.3.2 with your package manager, such as `npm install --save-dev --save-exact @gspothq/cli@0.3.2`.
2. In `gspot.toml`, remove `swift-tests` from each `configurations` list and each `removed_configurations` list.
3. Rename `swift-tests/coverage` to `swift/coverage` and `swift-tests/skip-reasons` to `swift/skip-reasons` in your
   `[[ignore]]` records and `--only` flags.
4. To keep those checks off in a scope that removed or never listed `swift-tests`, add an `[[ignore]]` record by hand,
   with `check = "swift/coverage"`, `paths = ["<scope>/**"]`, and `reason = "<why>"`. `gspot ignore` refuses to run
   until step 6 moves the pin.
5. Point a `rules.exclude` entry for `SWIFT-TESTS.md` at `.gspot/configurations/language/swift/rules/SWIFT-TESTS.md`.
6. Run `gspot apply`, then `gspot install` and `gspot check`, and commit the files that changed.

### Breaking changes

- The `swift-tests` configuration is gone, and gspot refuses its name in `configurations`. `swift` holds its checks, its
  `coverage.*` settings, and its rule file `SWIFT-TESTS.md`. (14b66bb)
- `swift-tests/coverage` is `swift/coverage`, and `swift-tests/skip-reasons` is `swift/skip-reasons`. gspot refuses the
  old IDs in an ignore or `--only`. (14b66bb)
- `swift` runs both test checks in any scope with Swift tests, including a scope that never listed `swift-tests`, so a
  commit or push can newly fail. `removed_configurations = ["swift-tests"]` has no effect. Ignore the checks by their
  new IDs to keep them off. (14b66bb)

### Known issues

- When `gspot apply` refuses a file that you wrote, it still marks that file in `.gitattributes`. A second `gspot apply`
  then replaces the file, so commit it first.

### Highlights

#### Swift

- `swift/coverage` runs in a scope that holds XCTest or Swift Testing files, or a Swift package with a test target, and
  skips any other scope with a note. `SWIFT-TESTS.md` installs under the same condition. (14b66bb)
- A folder of a `swift` scope gets the `.swiftlint.yml` test overrides when its name ends in `Tests` and it holds Swift
  files. The scope no longer needs `swift-tests` for that. (14b66bb)

#### Commands

- The help of `gspot install` puts a blank line between its list of tool folders and the sentence after it. (92c8c55)

#### Documentation

- All 15 command pages and the environment variables page join one Commands page, and the `[tools]`, `[limits]`,
  `[naming]`, and `[[command_check]]` pages join the Settings page. Each key has its own heading, and the old addresses
  redirect. (92c8c55, 86d3b6b)
- The sidebar Reference holds seven links, not one link per check and configuration. The language and topic pages form a
  Guides group, and the old `swift-tests` pages redirect to their `swift` pages. (92c8c55, 23feb72)
- A check page opens with where and when it runs in sentences, in place of the Details list, and ends with how to turn
  it off. Configuration pages and both indexes use tables. (e75437a)
- Each language guide opens with a table of the checks that run for it, built from the manifests, and keeps only setup
  and the choices you make. (a2c9f30)
- One ESLint plugin page holds the install steps, the usage, and a generated table of the rules and the configs that
  turn each one on. (691f284)
- Ten guide pages split dense paragraphs and move commands into code blocks. (be58695)
- The landing header shows Docs and GitHub at every width, and a link under the setup box opens the docs. (8325eac)

Released 2026-10-19. [Compare with 0.3.1](https://github.com/stefanionescu/gspot/compare/v0.3.1...v0.3.2)

## 0.3.1

gspot 0.3.1 stops changing how your project installs packages, so the 7-day hold on new releases covers only the tools
in `.gspot/`. The `dependencies/release-age` check goes with that hold, and level `recommended` asks a tsconfig only for
`strict`. Husky 9 repositories stop crashing, and a refused `gspot.toml` key names the fix. The upgrade needs one
`gspot.toml` edit when you ignore the removed check. The ESLint plugin stays at 0.2.0.

### Upgrade from 0.3.0

1. Install 0.3.1 with your package manager, such as `npm install --save-dev --save-exact @gspothq/cli@0.3.1`.
2. Delete any `[[ignore]]` record for `dependencies/release-age`.
3. Run `gspot apply`, then `gspot install` and `gspot check`, and commit the files that changed.
4. Optional: to stop holding back your own installs, delete the keys that gspot wrote before:

    | File                  | Keys                                                             |
    | --------------------- | ---------------------------------------------------------------- |
    | `bunfig.toml`         | `[install] minimumReleaseAge`, `minimumReleaseAgeExcludes`       |
    | `.npmrc`              | `min-release-age`, `min-release-age-exclude[]`                   |
    | `pnpm-workspace.yaml` | `minimumReleaseAge`, `minimumReleaseAgeExclude`                  |
    | `.yarnrc.yml`         | `npmMinimalAgeGate`, `npmPreapprovedPackages`                    |
    | `pyproject.toml`      | `[tool.uv] exclude-newer`                                        |
    | `mise.toml`           | `[settings] minimum_release_age`, `minimum_release_age_excludes` |

### Breaking changes

- `gspot apply` writes no release hold into the install settings of your project. Keys that it wrote before stay in your
  files and keep holding back your installs until you delete them. (f174aa8)
- `dependencies.min_release_age_days` sets the hold of the tools that gspot installs in `.gspot/`, and nothing else. The
  Bun scanner still goes into `bunfig.toml` when `dependencies.bun_scanner` names one. (f174aa8)
- `dependencies/release-age` is gone, and gspot refuses an ignore or `--only` that names it. Its docs page redirects to
  the Dependencies page. (f174aa8, 2abcce3)

### Known issues

- When `gspot apply` refuses a file that you wrote, it still marks that file in `.gitattributes`. A second `gspot apply`
  then replaces the file, so commit it first.

### Highlights

#### Fixes

- With Husky 9, `gspot check` and `gspot doctor` stopped with `EISDIR` after install, because gspot read the `.husky/_`
  folder as a hook file. A `core.hooksPath` inside `.husky` now counts as Husky, and the init plan stops listing Husky's
  stubs as your own hooks. (45189ee)
- At level `all`, Vale installs fixed releases of its upstream styles, not the latest of each: Google 0.7.1, write-good
  0.4.1, proselint 0.3.4, alex 0.2.3, and Harper 0.1.0. Every clone now checks prose with the same rules. (de147d5)

#### Checks

- At level `recommended`, `typescript/tsconfig` requires `strict` only. `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`, and `noFallthroughCasesInSwitch` move to level `all`, so a
  tsconfig can drop them without a finding. (11ee87f)

#### Commands

- A refused `gspot.toml` key names the keys of its table that look like it, such as `bun_scanner` for `scanner`. When
  `.gspot/version` differs from the running gspot, the refusal also links the release notes of the running version.
  (398dd5d)
- The delete section of the `gspot init` plan says that your own rules in the replaced tool files do not carry over.
  (536ad85)
- `gspot --help` and the package description read `Lint AI-generated code and install rules for AI coding agents.` Both
  READMEs open with `gspot is a command-line tool that lints AI-generated code and installs rules for AI coding agents.`
  (4fecd44)

#### Documentation

- Each docs page has a Markdown copy at its address plus `index.md`, and the site adds `robots.txt` and an Agent Skill
  index at `/.well-known/agent-skills/index.json`. (3a51823)
- The landing header holds the mark, GitHub, and the theme button. Search and the Docs link sit on docs pages, and the
  landing page links the docs from its footer. (d2ce0c3)

Released 2026-10-18. [Compare with 0.3.0](https://github.com/stefanionescu/gspot/compare/v0.3.0...v0.3.1)

## 0.3.0

gspot 0.3.0 moves the files it writes into one folder per configuration and replaces the `[architecture]` table with
`[[import_rule]]` records. It removes the `coverage` configuration and four checks, and `gspot.toml` refuses naming keys
that no code reads. The upgrade needs edits to `gspot.toml`. The ESLint plugin stays at 0.2.0. Version 0.2.3 was never
published, so this release holds its fixes.

### Upgrade from 0.2.2

1. Install 0.3.0 with your package manager, such as `npm install --save-dev --save-exact @gspothq/cli@0.3.0`.
2. In `gspot.toml`, turn each `[[architecture.module]]` into an `[[import_rule]]`, and move each role to its new key.
3. Remove `coverage` from each `configurations` list, and delete or move each ignore of a removed check.
4. Point `rules.exclude` at `.gspot/configurations/`, and delete each limit or naming key that gspot refuses.
5. Run `gspot apply`. It writes `.gspot/configurations/` and deletes the old files under `.gspot/config/` and
   `.gspot/rules/`. A `.semgrepignore` that stays is your own. gspot's Semgrep checks do not read it, so keep it only
   for a `semgrep scan` that you run by hand.
6. Run `gspot install` and `gspot check`.
7. Commit `gspot.toml`, `.gspot/`, the other generated files that changed, and `package.json` with its lockfile or
   `mise.toml`.

### Breaking changes

`gspot.toml`:

- `[architecture]` is gone. Each `[[architecture.module]]` becomes an `[[import_rule]]`: `name` and `paths` stay, and
  `may_import` is `can_also_import`. Code may import its own rule and every rule listed above it. (c363df6)
- The roles move to the configuration that reads them: `structure.environment_readers`, `javascript.script_files` for
  `scripts`, `zustand.store_files` for `stores`, and `trpc.router_files` for `routers`. (c363df6)
- The tRPC type-only import rule reads the new `trpc.server_files`, not a module named `server`. The default empty list
  turns the rule off, so list your server files to keep it. (c363df6)
- The `coverage` configuration is gone, and gspot refuses its name. The `coverage.*` settings keep their names and
  belong to `jest`, `pytest`, `vitest`, and `swift-tests`. `coverage.swift_target` belongs to `swift-tests` only.
  (a9c9a19)
- `limits.css` and `limits.html` are gone, so an empty `[limits.css]` table is refused. A refused limit key now names
  the limits of that language. 0.2.2 already refused a limit that a language does not read. (ed1981e)
- A table under `naming` accepts only the categories that its language reports. `css` and `html` take files and folders,
  `bash` adds functions and variables, and `sql` adds functions and parameters. (ed1981e)
- `rules.exclude` takes paths under `.gspot/configurations/`, such as
  `.gspot/configurations/general/engineering/rules/PLANNING.md`. gspot refuses a path that matches no rule. (ddae9bd)

Files that gspot writes:

- Tool files and rules move from `.gspot/config/` and `.gspot/rules/` to
  `.gspot/configurations/<group>/<configuration>/`. Each tool file takes its tool's name, such as
  `language/javascript/eslint.mjs`. Update editor settings and scripts that name the old paths. (ddae9bd)
- Rules sit in the `rules/` folder of their configuration, and a scope that needs other text gets `scopes/<scope>/`
  there. The tool projects, hooks, state, and version stay at the top of `.gspot/`. (ddae9bd)
- `prettier.config.mjs` holds one line that re-exports the generated Prettier file, in every repository, and
  `gspot init` writes it in place of your file. The Prettier check passes it as `--config`, so editors and gspot read
  the same file. (093defd, 4e20fb6)
- A root `.markdownlint.jsonc` replaces the `.markdownlint-cli2.mjs` pointer, so a repository without JavaScript gets
  one too. A scope gets its own only when its tool file differs from the root file. (0800e51)
- `gspot apply` leaves the `CLAUDE.md` block that gspot 0.2.0 and 0.2.1 wrote. Delete that block yourself. (ede7663)

Checks:

- `bash/forwarders` and `xcode/xcconfig` are gone. Delete their ignores. gspot refuses an ignore of a check it does not
  know. (b5f9195, db379b8)
- `cloudflare/security-headers` merges into `cloudflare/headers`, which reports `syntax` and `missing-header`. Move an
  ignore to `cloudflare/headers` with `rule = "missing-header"`. (878f680)
- `dependencies/package-json` is gone. At level `all`, `javascript/eslint` reports a root `package.json` without
  `packageManager` through `package-json/require-packageManager`. Move an ignore to that check and rule. (ba8d41f)
- `structure/environment-readers` reports `read-outside-reader`, not `read-outside-owner`. Rename the rule in your
  ignores. (07b746c)
- A bare `eslint-disable`, a bare `noqa`, and `swiftlint:disable all` report `eslint-all`, `ruff-all`, and
  `swiftlint-all` from `gspot/suppressions`, not the `-limit` rules. Name the rules in the comment and give a reason.
  (59e0b27)
- ESLint applies `limits.javascript.*` to JavaScript files. It applied `limits.typescript.*` before, so only
  `function_parameters` reached them. A raised TypeScript limit no longer covers a JavaScript file. (3c66315)

JSON output:

- `gspot doctor --json` calls its list of existing lint jobs `suggestions.lintJobs`, not `suggestions.written`.
  (07b746c)
- `gspot explain <lint rule> --json` has no `summary` field. It was always `null`. (ede7663)

### Known issues

- When `gspot apply` refuses a file that you wrote, it still marks that file in `.gitattributes`. A second `gspot apply`
  then replaces the file, so commit it first.

### Highlights

#### Commands

- `gspot set` and `gspot unset` reach the settings of detected configurations, such as `licenses.allowed` in a
  repository with a `package.json`. They refused what `gspot list` offered. (731368b)
- `gspot set` and `gspot unset` print `No change: gspot.toml already has this value.` when the file stays the same.
  (1aad78e)
- `gspot explain` shows the shipped default of a scope with its path, such as `web/dist`, and says to write a record
  list by hand. It told you to run `gspot set`, which refuses record lists. (2f98e3f)
- `gspot explain ./<file>` lists a check that this system cannot run, such as a macOS-only check on Linux. (30eabe2)
- `gspot --help` builds its groups and summaries from the registered commands, so it agrees with each command's help.
  Command help marks code with backticks, which the terminal strips. (5292592, b37defe)
- `gspot install` refuses stale tool projects before it reads the package manager version. The package manager refusal
  prints the version it found, or the exit code and error of the version command. (7240206, 448ded7)
- `gspot doctor --help` stops claiming to find outdated generated files, and `gspot apply --dry-run` stops claiming to
  print lint rule changes. The `bash/safety` findings and the cache folder error name the fix. (def5f99)
- Every command that refuses to overwrite a file that gspot did not write now says
  `Move them aside, then run the command again.` Before, one copy said `then run gspot apply` and another
  `then retry the command`. (c4b8fe5)
- `gspot init` labels your own lint setups `lint folders`, and `gspot apply --dry-run` prints
  `1 generated file needs updating`. (f7f8c6f)
- On Windows, a `taskkill` that exits nonzero after the process tree ended counts as a stop, so a tool timeout reports
  the timeout. (9cde92a)

#### Checks

- `bash/inline-scripts` stops reporting `cat > file <<EOF`, which mostly writes data files. It still reports inline
  Python, Node, and interpreter heredocs. (6955604)
- A migration that does not parse gives one finding from `postgres/migration-order`, not up to nine. The other Postgres
  and Supabase checks skip with a note, and the naming checks skip any file that does not parse. (5e7f2d7)
- `jsdoc/match-name` stops reporting a real parameter named `root`, and still reports `root0` and `root1`. (94afa16)
- The Vale style `gspot.alt-text` reads markup files only, so an `img` tag in a string in a code file reports nothing.
  (a429775)
- The `AGENTS.md` block writes the folders of a scoped rule as ``in `app/` ``, without the parentheses that made it fail
  `prose/vale`. (0d4bee0)

#### Generated files

- When `.prettierignore` or another generated ignore file covers every file of a check, `gspot apply` keeps the tool
  files of that check. Before, every second `gspot apply` deleted them and the next wrote them back, so `jsconfig.json`
  changed between apply and check. (f8cc693)
- `.prettierignore` and the tool exclusions name only the files that gspot writes in your repository, not each settings
  file that a scope may get, such as `services/api/.markdownlint-cli2.mjs`. (3df5124)
- `lychee.toml` and `osv-scanner.toml` open with two comment lines that say why each file exists. (363051a)
- gspot writes no `.semgrepignore`, because Semgrep scans every file named on its command line and both Semgrep checks
  name their files. A `semgrep scan .` that you run by hand no longer gets the file. (3e1c1f6)
- gspot writes a Git hook only when a configured check runs in it, so level `recommended` gets no `commit-msg` hook. The
  lines that `gspot install` prints for Husky, Lefthook, or another hook folder follow the same list. (db4af7a)
- At level `recommended`, gspot writes only the Vale styles that the level runs, with no word list. `vale.ini` turns off
  only `gspot.alt-text`, outside markup files. (2122deb, a429775)
- The `AGENTS.md` block drops its `Level:` line and lists `set`, `unset`, `add`, `remove`, `ignore`, and `unignore`
  under one `Commands` heading. (48aa367, 7c5f601)
- `gspot init` writes no `tools.commitlint.scopes`. An empty list allows the last part of each scope path, and a
  template keeps its own list. (e0525c3)

#### Shipped text

- The rules take the general lines of gspot's own `AGENTS.md`, agree with the shipped tools, and drop sentences that a
  linter or another rule covers. `ERRORS.md` holds the retry and stale-response rules once. (e22a514, 7c5f601, dff691c)
- Configuration descriptions say what each one checks, each `why` states the risk, and check help stops naming tool file
  paths. Three configurations get short titles: `Engineering`, `Data files`, and `Shell scripts`. (e7456b1, 07b746c)
- The JSON Schema describes every top-level table, and each value and reason of a reasoned setting, so editors show text
  on hover. (740dcc4, 1975222)

#### Documentation

- The sidebar has six sections: Getting started, Usage, Configuration, Languages, Checks, and Reference. Every route
  that changes gets a 301 redirect, and the Maintain section is gone. (92f06c5, 119860e)
- New pages cover editors and environment variables. Guides state what runs and when, passages that repeat another page
  are gone, and sections that belong to one language move to its page. (e2db594, 4e11fd2, 74fc10c, 05194a5)
- A check page shows how to suppress one place and whether `--fix` fixes it. The settings pages give each table and
  record a heading, and each page prints a key once. (6b1f066, 5eea6d6, 1fd05dc, ea2bdb0, a489330)
- The reference pages stop printing `undefined:` and turning a `--flag` into an en dash. The guides stop telling you to
  write `tools.ruff.rules`, a key that does not exist. (40f5496, 9afca6f)
- The Commands index lists the exit codes of every command, and the ESLint plugin rule pages give the lowest level that
  turns each rule on. (4e11fd2, bdaa835)
- Repeated lists become tables and tabs, such as one table for the levels and one for generated files. (f18b8dd)
- `llms-small.txt` holds the guides only, down from 468 KB to 63 KB. Both llms files put the guides first, and
  `llms.txt` adds the stages, exit codes, and ignores. (25673e2, 6b1f066)
- The landing page shows one gspot mark, six tiles for what gspot does, one description, and only the tools that gspot
  installs and runs. (05cbdb3, ad8c6b1, c07746c)

### Development

The CLI source moves into `runs/`, `install/`, and one check file or folder per configuration. The release task reads
`packages/cli/RELEASE_NOTES.md`, refuses a version without a section there, and tags the plugin as
`eslint-plugin-v<version>`. Tests merge into tables, and their folders follow the source folders. (8abeb70, 7240206,
53f5c5c, ba9123c, 54fc4e0)

Released 2026-10-18. [Compare with 0.2.2](https://github.com/stefanionescu/gspot/compare/v0.2.2...v0.3.0)

## 0.2.2

gspot 0.2.2 fixes the upgrade from 0.1 and the npm release hold, and stops writing `CLAUDE.md`. `@gspothq/eslint-plugin`
stays at 0.2.0. Run `gspot apply` to rewrite `.npmrc` and to remove the `CLAUDE.md` block.

### Upgrade from 0.2.1

1. Install 0.2.2 with your package manager, such as `npm install --save-dev --save-exact @gspothq/cli@0.2.2`. In an npm
   repository during the first 7 days after this release, add `--min-release-age=0` once, because the `.npmrc` from
   0.2.1 holds `@gspothq/cli` back.
2. Run `gspot apply`.
3. Run `gspot install`.
4. Commit `package.json` with its lockfile or `mise.toml`, `.npmrc`, `.gspot/`, and the removal of `CLAUDE.md`.

From 0.1, follow the 0.2.0 upgrade steps too. One `gspot apply` is enough with 0.2.2.

### Breaking changes

- gspot writes the agent rules into `AGENTS.md` only. `gspot apply` removes the `@AGENTS.md` block from `CLAUDE.md`,
  keeps your own text, and deletes the file when the block was all it held. Point an agent that reads `CLAUDE.md` at
  `AGENTS.md` yourself. (77a88ff)
- `gspot apply --json` reports a refused file with the code `writing`, not `failure`. (80302c6)

### Known issues

- `gspot apply` prints `removed CLAUDE.md` even when it keeps your text in that file.
- When `gspot apply` refuses a file that you wrote, it still marks that file in `.gitattributes`. A second `gspot apply`
  then replaces the file, so commit it first.

### Highlights

#### Fixes

- `gspot apply` writes `min-release-age-exclude[]=` lines in `.npmrc`, the list form that npm reads. Before, npm kept
  only the last of the repeated keys, excluded only the ESLint plugin, and refused a new `@gspothq/cli` during the hold.
  (f0996e2)
- `gspot apply` replaces the files that gspot 0.1 generated, such as `.editorconfig` and `eslint.config.mjs`. Before,
  the first run after the upgrade refused them, because gspot matched only its new header sentence. (80302c6)
- When `gspot apply` refuses a file, it prints
  `These files were not overwritten by gspot: <paths>. Move them aside, then run gspot apply.` Before, the message
  called this an internal error. (80302c6)

#### Documentation

- The home page example bolds only the first sentence of each report summary. Before, the whole line was bold. (26e2ec5)
- The coding agents page says that gspot writes the rules into `AGENTS.md` only. (77a88ff)

Released 2026-10-17. [Compare with 0.2.1](https://github.com/stefanionescu/gspot/compare/v0.2.1...v0.2.2)

## 0.2.1

gspot 0.2.1 fixes `gspot install` in npm repositories that use the ESLint plugin, during the release hold of a new
plugin version. `@gspothq/eslint-plugin` stays at 0.2.0, and the upgrade needs no edits.

### Upgrade from 0.2.0

1. Install 0.2.1 with your package manager, such as `npm install --save-dev --save-exact @gspothq/cli@0.2.1`. In an npm
   repository during the first 7 days after this release, add `--min-release-age=0`, as "Known issues" says.
2. Run `gspot apply`, which moves the pin in `.gspot/version`.
3. Run `gspot install`, and commit `.gspot/` with `package.json` and its lockfile, or `mise.toml`.

### Known issues

- gspot writes one `min-release-age-exclude=` line per package in `.npmrc`, and npm keeps only the last line. npm then
  refuses a new `@gspothq/cli` during the hold. Add `--min-release-age=0` to that install. 0.2.2 fixes this.
- After an upgrade from 0.1.1, the first `gspot apply` exits 2 with
  `gspot stopped because of an internal error: These files were not overwritten by gspot`. A second `gspot apply`
  replaces those files. 0.2.2 fixes the first run.

### Highlights

#### Fixes

- `gspot install` stopped with `npm error code ETARGET` for `@gspothq/eslint-plugin` while that release was younger than
  `dependencies.min_release_age_days`. The hold now applies only to the step that resolves the tool lockfile, and the
  frozen install takes the versions in the lockfile. (172fe7f)
- The `gspot init` plan prints `1 pinned Python tool`, not `1 pinned Python tools`. The npm tool and mise pin counts use
  the same format. (6cd385b)

#### Documentation

- The [install page](https://generativespotting.com/start/install/) says that `npx gspot` stops with a 404 error without
  `@gspothq/cli` installed, because npm has no package named `gspot`. Before, it warned of an unrelated package.
  (e1033c9)

Released 2026-10-17. [Compare with 0.2.0](https://github.com/stefanionescu/gspot/compare/v0.2.0...v0.2.1)

## 0.2.0

gspot 0.2.0 holds new dependency releases for 7 days in every installer that a folder uses, and `gspot check` prints
only what did not pass. It renames 11 checks, 13 limit settings, and several flags, removes 43 checks and the
`swift-snapshot-testing` configuration, and needs Node.js 24.15. `gspot apply` stops editing `gspot.toml` and replaces
each generated file that gspot owns, even one with local edits. The upgrade needs manual work, because gspot refuses the
old names. `@gspothq/eslint-plugin` is also 0.2.0.

### Upgrade from 0.1.1

1. Use Node.js 24.15 or newer.
2. Install 0.2.0 with your package manager, such as `npm install --save-dev --save-exact @gspothq/cli@0.2.0`.
3. Edit `gspot.toml`. Rename or delete each setting and check ID that "Breaking changes" lists. `gspot apply` names what
   it refuses.
4. Optional: delete the `#:schema` line at the top of `gspot.toml`. It points at the 0.1.1 schema, and gspot keeps it.
5. Run `gspot apply`. It stops once on the files that 0.1.1 wrote outside `.gspot/`, as "Known issues" says. Run
   `gspot apply` again.
6. Run `gspot install`.
7. Update your scripts and your Husky or Lefthook lines for `--message-file`, `--base`, `--configurations none`, and the
   JSON changes below.
8. Run `gspot check`, and commit `gspot.toml`, `.gspot/`, and the other generated files that changed.

### Breaking changes

Commands:

- The CLI needs Node.js 24.15 or newer, up from 24.2. (a9c90cc)
- `gspot check --message-file <file>` is gone. Run `gspot check --hook commit-msg -- <file>`. (2a0ec33)
- `gspot check --base <ref>` is gone. Run `gspot check --changed <ref>`. Without a ref, `--changed` compares with the
  upstream branch, else the default branch. (2a0ec33)
- `gspot check --dry-run` no longer turns on `--fix`. It stops with `--dry-run previews the fixes. Add --fix.` (2a0ec33)
- `gspot check --only` with a commit message check, such as `commits/commitlint`, stops unless you pass
  `--hook commit-msg`. Before, the run checked no message and passed. (7807b2d)
- `gspot check` prints only the checks that failed or did not run. `--verbose` adds the passed and skipped checks. The
  last lines read `Failed: 2 checks with 2 findings. Passed: 7 checks. Skipped: 16 checks.` and
  `Time: 0.2s. Exit code 1.`, and `reproduce:` is `run again:`. Update scripts that read this text. (2a0ec33)
- `gspot init --configurations none` is refused. Run `gspot init --no-configurations`. (2a0ec33)
- `gspot apply` no longer adds detected configurations and no longer changes `gspot.toml`. `gspot doctor` lists them,
  with the `gspot add` line to run. (341468d)
- `gspot apply` replaces each generated file that gspot owns, even with local edits or merge markers. Before, it kept an
  edited file and named it. Move your edits into `gspot.toml`. (7a1d469, c7988db)
- gspot finds its files from `.gspot/`, the generated header, and `linguist-generated` in its `.gitattributes` block.
  Keys that it stops managing in a shared file stay there, and `gspot apply` prints a note. (7a1d469, c7988db)
- `gspot apply --dry-run` no longer lists each lint rule that turns on or off. Its help line still says so. (02b7340)
- `gspot install` no longer writes `.gspot/package.json`, `.gspot/pyproject.toml`, or `.gspot/mise.toml`. When one is
  stale, it stops with `Run gspot apply first`. (2952437)
- `gspot install` gets `editorconfig-checker` 3.4.0 from its GitHub release through mise, in place of an npm wrapper
  that downloaded it on first run. Without mise, gspot names it as a program to install: install it yourself, or the
  check stops the run with exit code 2. (e54456d)
- A different gspot version in `.gspot/version` stops only `add`, `remove`, `set`, `unset`, `ignore`, `unignore`,
  `install`, `export`, and `check --fix`. `check`, `list`, and `explain` run under any version. (2a0ec33)
- `GSPOT_JOBS` has no effect. gspot runs checks in parallel by processor count. (ba7d00d)
- Outside a Git repository, gspot does not read `.gitattributes` to classify files. (93369ce)

`gspot.toml`:

- gspot refuses each old name below with `is not a gspot.toml setting`. The same limit names apply under
  `limits.<language>`. (2a0ec33)

    | 0.1.1                            | 0.2.0                                |
    | -------------------------------- | ------------------------------------ |
    | `limits.statements`              | `limits.function_statements`         |
    | `limits.branches`                | `limits.function_branches`           |
    | `limits.returns`                 | `limits.function_returns`            |
    | `limits.assignments`             | `limits.function_assignments`        |
    | `limits.nesting`                 | `limits.block_nesting`               |
    | `limits.min_function_statements` | `limits.trivial_function_statements` |
    | `limits.prefix_collisions`       | `limits.shared_prefix_files`         |
    | `limits.file_kilobytes`          | `repository.max_file_kilobytes`      |
    | `limits.sentence_words`          | `prose.max_sentence_words`           |
    | `limits.paragraph_sentences`     | `prose.max_paragraph_sentences`      |
    | `limits.list_item_words`         | `prose.max_list_item_words`          |
    | `limits.min_duplicate_lines`     | `duplication.min_lines`              |
    | `limits.min_duplicate_tokens`    | `duplication.min_tokens`             |
    | `coverage.target`                | `coverage.swift_target`              |
    | `dependencies.scanner`           | `dependencies.bun_scanner`           |
    | `secrets.reader_functions`       | `secrets.environment_functions`      |
    | `xcode.project`                  | `swift.xcode_project`                |
    | `xcode.scheme`                   | `swift.xcode_scheme`                 |
    | `xcode.destination`              | `swift.xcode_destination`            |
    | `naming.<language>.directories`  | `naming.<language>.folders`          |

- `directories` in `[[naming.override]]` `categories` is `folders`. (2a0ec33)
- These settings are gone, so delete them: `limits.duplicate_percent`, `limits.headings_before_contents`,
  `rules.instruction_files`, `html.templates`, `tools.codeql.languages`, `tools.svgo.min_saving_percent`,
  `limits.python.function_lines`, `limits.python.index_exports`, `limits.sql.function_parameters`, and
  `limits.sql.min_function_statements`. (2a0ec33, 35bcdaf, aee6a61)
- `configurations` refuses `swift-snapshot-testing`, and that configuration is gone. (aee6a61, 2a0ec33)
- An `architecture.module` record may import the records listed before it, itself, and its `may_import` list. Before,
  only itself and its `may_import` list were allowed. (2a0ec33)

JSON output:

- `gspot apply --dry-run --json` names its list `stale`, not `drift`, and has no `settings` or `reconciled`. An entry
  has no `rules`, and a file with merge markers has the kind `changed`, not `conflict`. (62f0c36, 341468d, 02b7340,
  7a1d469)
- `gspot apply --json` has no `changed` field, and `gspot doctor --json` has no `stale` field. (341468d)
- `gspot explain <file> --json` names `fileKindSource` as `fileKindOrigin`. (8223f88)
- A failed `gspot install --json` prints `error` and `message`, without `steps`. (2a0ec33)

Checks:

- Eleven checks take new names. `gspot.toml` refuses an `[[ignore]]` with an old name, with
  ``There is no check called `expo/doctor`.`` (2a0ec33)

    | 0.1.1                         | 0.2.0                           |
    | ----------------------------- | ------------------------------- |
    | `expo/doctor`                 | `expo/expo-doctor`              |
    | `html/validate`               | `html/html-validate`            |
    | `dependencies/osv`            | `dependencies/osv-scanner`      |
    | `dependencies/lockfile-hosts` | `dependencies/lockfiles`        |
    | `naming/settings`             | `naming/allowed-names`          |
    | `repository/tracked-files`    | `repository/local-files`        |
    | `secrets/trufflehog`          | `secrets/trufflehog-pushed`     |
    | `structure/env-reads`         | `structure/environment-readers` |
    | `structure/file-lines`        | `structure/long-files`          |
    | `gspot/unused-entries`        | `gspot/unmatched-patterns`      |
    | `bash/wrappers`               | `bash/forwarders`               |

- These 43 checks are gone. Delete their IDs from `gspot.toml` and your scripts. (6ea38b5, 7fd316a, 35bcdaf, aee6a61)
    - `bash/bash-syntax`, `bash/bats-syntax`, `bash/include-guards`, `bash/private-prefix`, `bash/source-order`,
      `bash/ssh-blocks`, and `bash/variable-defaults`
    - `python/export-order`, `python/exports-at-bottom`, `python/function-size`, `python/module-getattr`,
      `python/package-exports`, `python/private-prefix`, `python/pyproject`, and `python/singletons`
    - `site/build-reproducible`, `site/linkinator-external`, `site/svgo`, and `site/webmanifest`
    - `nextjs/build`, `nextjs/route-segments`, `nextjs/version-pairs`, and `react/version-pairs`
    - `gspot/settings`, `gspot/settings-format`, `dependencies/bun-release-age`, and `dependencies/stale-lockfile`
    - `supabase/migration-names`, `supabase/project-file`, `xcode/symlinks`, and `xcode/test-plans`
    - `swift-snapshot-testing/recording`, `swift-snapshot-testing/references`, and `swift-tests/sleep`
    - `cloudflare/wrangler`, `docs/readme-shape`, `drizzle/relations`, `files/taplo`, `github-actions/pinact`,
      `html/template-text`, `secrets/gitleaks-files`, `security/codeql`, and `sql/functions`
- gspot no longer installs pinact, validate-pyproject, CodeQL, or SVGO. (aee6a61)
- `nextjs/next-config` is gone. `security/semgrep` reports the same two problems at push, through the rules
  `nextjs.checks-off` and `nextjs.env-secret`. (2a0ec33)
- Naming findings use the lint rule `banned-word`, not `banned-term`. The rule `unused-entry` of
  `gspot/unmatched-patterns`, `licenses/allowed`, and `naming/allowed-names` is `unused-record`. Update ignores that
  name them. (3688f31, a8838c8)
- Five lint rules are gone, so remove their ignores: `translations/messages` `dotted-key`, `bash/forwarders`
  `wrapper-name`, `xcode/files-without-target` `missing-file`, and `dependencies/package-json` `private-root` and
  `package-manager` for workspace packages. (bc577f9)
- `foreign-lockfile` moves from `dependencies/package-json` at level `all` to `dependencies/lockfiles` at level
  `recommended`, so two kinds of lockfile fail at both levels. (2a0ec33)
- `naming/allowed-names` runs at level `all` only. It ran at `recommended` as `naming/settings`. (bc577f9)
- `structure/trivial-functions` at level `all` also reports exported JavaScript and TypeScript functions that forward
  one expression and have one importing file. (2a0ec33)
- Ruff `RUF022` runs at level `recommended` and sorts `__all__` the Ruff way, not shortest first. Ruff `PLR0915` runs at
  level `all` and reads `limits.function_statements`. (aee6a61)
- `github-actions/zizmor` reports an action that no commit hash pins. Before, zizmor skipped this audit. (aee6a61)
- At level `all`, ESLint reports a comment on the line under the last import, through `import-x/newline-after-import`.
  (48966b6)
- The new check `dependencies/release-age`, at level `recommended`, fails a `packageManager` older than npm 11.17, pnpm
  10.16, Yarn 4.10, or Bun 1.3, which ignores the hold. Upgrade it. (bfb5802)

Files that gspot writes:

- `gspot apply` writes a 7-day release hold into the install settings of your project, so your own installs refuse a
  younger release. To keep them free, set `dependencies.min_release_age_days = { value = 0, reason = "<why>" }` before
  the first `gspot apply`. An existing longer hold stays, so delete a key that is already there. (bfb5802)
- Each `NAMING.md` rule file under `.gspot/rules/language/<language>/` merges into the main rule file of that language,
  such as `TYPESCRIPT.md`. Update your links to the old paths. (2a0ec33)
- `.gspot/rules/general/engineering/code/HTTP.md` and `LOGGING.md` install only when a dependency calls for them, such
  as `express` or `pino`. `gspot apply` deletes them otherwise. (2a0ec33)
- Scopes with the same tool file text share one copy, such as `.gspot/config/ruff.toml` in place of
  `.gspot/config/services/api/ruff.toml`, and one root `.semgrepignore`. (6030675, 2a0ec33)
- gspot no longer reads or writes `.gspot/state/ownership.json`. The file stays, Git ignores it, and you can delete it.
  (7a1d469)

ESLint plugin 0.2.0:

- `gspot/header-first` is `gspot/no-comments-in-imports`. Rename it in suppression comments and in your ESLint config.
  (2a0ec33)
- The rule reports a tool directive between imports, and `--fix` leaves that directive in place. A directive after the
  last import stays valid. (48966b6)

### Known issues

- After an upgrade from 0.1.1, the first `gspot apply` exits 2 with
  `gspot stopped because of an internal error: These files were not overwritten by gspot`. That run marks the files in
  `.gitattributes`, so a second `gspot apply` replaces them. A file that you wrote yourself is replaced too, so commit
  it first. 0.2.2 fixes the first run.
- `gspot install` stops with `npm error code ETARGET` in an npm repository that uses the ESLint plugin, while the plugin
  release is younger than `dependencies.min_release_age_days`. 0.2.1 fixes this.
- gspot writes one `min-release-age-exclude=` line per package in `.npmrc`, and npm keeps only the last line. npm then
  refuses a new `@gspothq/cli` during the hold. Add `--min-release-age=0` to that install. 0.2.2 fixes this.

### Highlights

#### Release hold

- `gspot apply` writes `dependencies.min_release_age_days`, 7 by default, into the settings file of each installer that
  a folder uses. Before, the setting reached only Bun. (bfb5802)
- The files are `bunfig.toml`, `.npmrc`, `pnpm-workspace.yaml`, `.yarnrc.yml`, `pyproject.toml`, and `mise.toml`. A
  folder uses an installer when it holds the lockfile of that installer, or a `mise.toml` for mise. Yarn 1 gets no hold.
  (bfb5802)
- A longer hold and your own excludes stay. `@gspothq/cli` and `@gspothq/eslint-plugin` go on the exclude lists of Bun,
  npm, pnpm, and Yarn, and `npm:@gspothq/cli` on the list of mise. uv has no exclude list. gspot uses the same hold for
  its own installs in `.gspot/`. (bfb5802)

#### Commands

- `gspot init` runs with uncommitted changes and before the first commit. Before, it stopped and asked you to commit. A
  branch with no commits has no pushed commits to check. (8cd50b4)
- The `gspot init` plan no longer tells you to delete a `package.json` whose dependencies gspot pins. It names the
  packages to remove from `devDependencies`. (db21020)
- `gspot --help` and `gspot` without a command print the commands in groups, with the exit codes. (2a0ec33, e93c240,
  64fc892)
- An argument error starts with a capital letter and has no `error:` label, such as
  `Unknown command nosuch. Run gspot --help to see the commands.` (2a0ec33, 64fc892)
- `gspot set level bogus` prints ``The value `bogus` is not valid for level. Use recommended or all.`` Before, it
  printed a raw list of validation issues. An internal error names the address to report it. (2e7c716)
- `gspot doctor` lists what needs work and a count of the ready tools. `gspot doctor --json` keeps the full list.
  (2a0ec33)
- An npm, uv, or mise step that runs past `tool_timeout_seconds` names that limit and the command that raises it.
  Before, it reported `failed (exit 1)`. (8ac64d1)
- Ctrl-C or SIGTERM stops `gspot install` with exit code 130 or 143. (2a0ec33)

#### Generated workflow and rules

- The generated GitHub workflow gives mise the job token as `MISE_GITHUB_TOKEN` in the steps that install tools. Before,
  those steps hit the anonymous GitHub rate limit on shared runners. (3f66c7e)
- Each workflow step has a name, and the changed-file step runs `gspot check --changed "${base}"`. (2a0ec33)
- `AGENTS.md` lists the rules to read first, then each rule with the sentence that says when to read it, then sections
  for settings and generated files. (2a0ec33)
- Generated files start with `Generated by gspot from gspot.toml. Do not edit this file.` (2a0ec33)
- The shipped rules use plain, short sentences. `NAMING.md` defines one verb per kind of function, and `YAML.md` puts a
  file comment above the first key. (70c1a8e, 91ba86e, 1fcd689)
- Check summaries, help lines, setting descriptions, and messages use plain sentences, and they name settings that
  exist. `repository/large-files` used to advise `limits.file_kb`, a setting that does not exist. (2df6995, 2b3d5f5,
  e93c240, 3688f31, d1d87f5, d5d647a)
- The generated reference describes the scope field `removed_configurations` as a removal. (6ab35fd)
- gspot writes `CLAUDE.md` with a one-line `@AGENTS.md` block at the top, and keeps your text below it. (2a0ec33)
- gspot writes no `#:schema` line in `gspot.toml`, and the npm package no longer holds `gspot.schema.json`. The schema
  sits at <https://generativespotting.com/gspot.schema.json>. (54dace5, 2a0ec33)
- Generated ignore files and tool exclusions use the same named sections, such as `# Build output`. (2a0ec33)

#### Checks

- `secrets/trufflehog-pushed` scans the pushed range with `trufflehog git`, in place of a generated file of changed
  blobs and commit metadata. (bc577f9, c8997c6)
- `files/taplo-format` reports a TOML file that does not parse, with its line and column, in place of `files/taplo`.
  (aee6a61)
- `jest/coverage` runs in your working tree, not in a scratch copy. (bc577f9)
- `structure/trivial-functions`, `python/placeholder-docstrings`, and the Swift test findings report a column. (088c0c8)
- `typescript/tsc` uses the compiler options of your own `tsconfig.json`. Before, gspot added its strict options on top.
  (bc577f9)

#### Fixes

- `gspot apply` in a fresh clone replaces generated files. Before, it needed an ownership record that only the first
  clone held. (c7988db, 7a1d469)
- On Windows, `javascript/tsc` matched no file, so it checked nothing and passed. It now reads the files. (f2e708e)
- On Windows, the Swift coverage check reads its report path. (ea824e4)
- On Windows, `javascript/tsc` stopped with an error in every child scope, and `site/purgecss` stopped with an error.
  Both run now. (bbeada0, 9f3d00a)
- On Windows, the launcher that mise writes for the CLI failed to start, so the quickstart failed. (db2d5c9)
- A finding message names a file relative to the repository, such as in Docker Compose errors. Before, it printed the
  absolute path. (0d6e6bc)
- `gspot check --fix --dry-run` links `.gspot/node_modules` into its scratch copy, so ESLint loads its packages in a
  TypeScript preview. (0a52591)
- A `tsconfig.json` with no `files` or `include` reaches type checking. Before, the run stopped with no inputs.
  (6bf6ffb)
- `gspot check --fix` keeps each project scope when it checks the fixed files. (f4710de)
- `secrets/env-examples` finds example files in nested scopes by base name. (b4e732f)
- `bash/script-layout` reads `environment_readers` from the scope, so a scoped reader gets no false library finding.
  (d7ab9fe)
- `structure/lone-files` reads the selected files, so an untracked neighbor no longer hides a lone tracked file.
  (b07d722)
- `docs/missing-paths` skips host names, and counts nested `.mise/tasks` files as tasks. (04012d2)
- A scoped `.semgrepignore` rebases every pattern into the scope. (2abf5a5)
- A check no longer asks for a tool that it uses only at another level, or with a setting that its scope leaves empty,
  such as `eslint-plugin-boundaries`. (0cce94f)
- A failed Vale download keeps the installed packages. Before, gspot deleted them first. (46407ee)
- `gspot/generated-files` findings no longer say `fixable`, because `gspot apply` repairs them. (d1e07b9)

#### Speed

- `gspot apply`, `init`, `set`, `add`, and `ignore` no longer start `npm --version` when `package.json` names no
  version. (ea8f29f)
- `github-actions/actionlint` copies only `.github/` files into its scratch folder. (f84ba68)

#### Documentation

- Guides move from `/guides/` to `/start/`, `/use/`, `/configure/`, `/checks/`, `/languages/`, and `/maintain/`. Each
  old URL redirects to its new page with a 301. (2a0ec33, 6585101)
- The new page `/reference/json-report/` documents the JSON report and the error codes. (2a0ec33)
- Generated reference pages have heading links. (26e1f18)
- The home page has its earlier design and no preview notices, and its example shows a 0.2.0 run. (8cd50b4, c08cff2,
  582ee7d)
- The READMEs and the overview, findings, install, and plugin pages are shorter. (2c3178b, 06b1b2e, 6d8fa5f, a53dcd6,
  99107ac, f80dcfa, 20ec0b4)
- Pages no longer name deleted checks and configurations, such as `python/pyright` and Swift Snapshot Testing. (102943d,
  b2ef674)

### Development

The CLI source moves into folders by layer, with function and type names rewritten to one vocabulary. Shared test tools
install once per suite, and tests of the docs and of other tools are gone. The mise tasks `build:docs`, `serve:docs`,
`test:integration`, and `test:e2e` are `docs:build`, `docs:serve`, `test integration`, and `test e2e`, and the unused
npm release workflow is gone.

Released 2026-10-17. [Compare with 0.1.1](https://github.com/stefanionescu/gspot/compare/v0.1.1...v0.2.0)

## 0.1.1

gspot 0.1.1 is the first tagged release of the `@gspothq/cli` command-line tool and the `@gspothq/eslint-plugin` ESLint
plugin. gspot lints AI-generated code and installs rules for AI coding agents. `gspot init` reads a repository, selects
configurations, and writes `gspot.toml`, tool files, Git hooks, a CI workflow, and rule files. `gspot install` installs
the tools and turns on the hooks. The checks then run at commit, at push, and in CI, and a finding stops the commit or
push. The release holds 14 commands, 60 configurations, 175 checks, 81 rule files, and 8 ESLint rules.

### Known issues

- The CLI declares Node.js `>=24.2.0`, but its dependency `which@7.0.0` declares `^22.22.2 || ^24.15.0 || >=26.0.0`. Use
  Node.js 24.15 or a later 24 release, or Node.js 26 or newer.
- `.gspot/state/` is not committed, so a fresh clone has no record of what gspot wrote. There, the first command that
  changes a generated file, such as `gspot apply` or `gspot set`, keeps it, writes the others, and exits 2 with
  `These files were not overwritten by gspot`. Move the named files aside and run `gspot apply`.
- The generated GitHub workflow passes no GitHub token to `gspot install`, so mise asks GitHub for release builds
  without one. On a shared runner, the anonymous rate limit can fail the job.
- `gspot install` runs the `editorconfig-checker` npm wrapper, which downloads its program from the GitHub API. Without
  `GITHUB_TOKEN`, the rate limit can fail the install. The Troubleshooting guide quotes
  `GitHub refused a tool download`, a message gspot does not print.
- Some check text names a setting that does not exist. `swift-tests/coverage` names `coverage.override`, and the setting
  is `coverage.target`. `bash/include-guards` and `bash/variable-defaults` name `architecture.roles.env`, and the
  setting is `architecture.roles.environment_readers`. `duplication/jscpd` names `limits.duplication.percent`, and the
  setting is `limits.duplicate_percent`. `docs/readme-shape` names `limits.docs.headings_before_contents`, and the
  setting is `limits.headings_before_contents`. `repository/large-files` names `limits.file_kb`, and the setting is
  `limits.file_kilobytes`. It also names `gspot set generated` and `gspot set vendored`, which do not exist: mark the
  file `linguist-generated` or `linguist-vendored` in `.gitattributes`.

### Highlights

#### Install and run

- `@gspothq/cli` needs Git, and declares Node.js `>=24.2.0` and Bun `>=1.4.2`. Bun can install and start gspot, but the
  checks run on Node.js. (5f8503e, 40cb0f0)
- In a repository with `package.json`, add the exact CLI version with
  `npm install --save-dev --save-exact @gspothq/cli`, `pnpm add --save-dev --save-exact @gspothq/cli`,
  `yarn add --dev --exact @gspothq/cli`, or `bun add --dev --exact @gspothq/cli`. Elsewhere, run
  `mise use node@24 'npm:@gspothq/cli@<version>'`. Commit that, then run `gspot init`, `gspot install`, and
  `gspot check`. (40cb0f0)
- The hooks start gspot through your package manager when the root `package.json` lists the CLI:
  `npm exec --no -- gspot`, `pnpm exec gspot`, `yarn exec gspot`, or `bun run --no-install gspot`. Otherwise they run
  `mise exec -- gspot`. (c322a78, 40cb0f0)
- `level = "recommended"` is the default and covers bugs, security, accessibility, type errors, formatting, and misuse
  of the frameworks and libraries you declare. `level = "all"` adds word choice, architecture, naming, doc comments,
  declaration order, API style, and complexity. Neither turns on experimental or preview lint rules. (d6403a0)
- gspot reads the files Git tracks and the untracked files `.gitignore` does not hide. It does not check files marked
  `linguist-generated` or `linguist-vendored` as your own code. (86bb8fb)
- A folder without Git works. Hooks and the configurations that read Git stay out until `git init`, and
  `secrets/gitleaks-files` replaces the staged scan. (f1c8e26)
- A scope gives one folder its own configurations and settings. `gspot init` proposes a `[[scope]]` for each folder with
  a tracked project file, such as `package.json`, `pyproject.toml`, or `Package.swift`, and the deepest scope that holds
  a file owns it. (f9ed3eb)

#### Commands

Every command takes `--json` and `-h, --help`. The program takes `--version` and `--help`. Commands use the nearest
`gspot.toml` at or above the current folder, up to the Git top level. (c322a78)

- `gspot init` prints what it found and a plan, asks `Continue?`, and writes `gspot.toml` and the generated files. It
  installs nothing and runs no check. Flags: `--yes`, `--dry-run`, `--from <template>`, and
  `--configurations <names...>`, where `none` selects no configurations. `--json` needs `--yes` or `--dry-run`.
  (c322a78, 40cb0f0)
- `gspot init` stops when `gspot.toml` exists, and outside a dry run it stops on uncommitted changes. The plan turns on
  hooks and rules. It proposes CI from an existing `.github/workflows/` or `.gitlab-ci.yml`, or the host of `origin`,
  and proposes none when a CI file already holds a lint job. (f1f6a53, 40cb0f0)
- `gspot init` deletes the tool files it replaces, such as `.eslintrc.json`, `.prettierrc`, and `ruff.toml`, and leaves
  shared sections such as `[tool.ruff]` in place. It writes `format.indent_width`, `format.print_width`, and
  `format.quotes` from Prettier JSON settings, and the first two from `.editorconfig` when the project does not use
  Prettier. (cccfbf9)
- `gspot init --from <template>` takes a path, an https URL, or `github:owner/repo[/path][@ref]`, and records the source
  and SHA-256 in a comment in `gspot.toml`. A GitHub source without a path reads `gspot.template.toml`. (fc7babe,
  40cb0f0)
- `gspot install` installs npm tools into `.gspot/node_modules/`, Python tools into `.gspot/.venv/`, program tools with
  mise, and at `all` the Vale packages into `.gspot/vale/`. It makes a missing or stale lockfile first. (1b49bdd,
  40cb0f0)
- `gspot install` sets `core.hooksPath` to `.gspot/hooks`. When Husky, Lefthook, or your own hooks already run, it
  leaves them and prints the three lines to add. Without mise, it installs what it can, names each missing program, and
  exits 0. (86bb8fb, 1b49bdd)
- `gspot apply` adds detected configurations to `gspot.toml`, skips `removed_configurations`, writes the generated
  files, and moves `.gspot/version` to the running version. It rewrites a generated file that a merge left with conflict
  markers. It keeps a file you edited, names it, and exits 2. `--dry-run` prints the diffs and each lint rule that turns
  on or off. (c322a78, ac6a5e5)
- `gspot check [paths...]` runs the commit and push checks over the working tree. Message checks run only with
  `--message-file`, and manual checks only when named with `--only`. (c322a78, e6cc200)
- `gspot check` flags: `--only <checks...>`, `--staged`, `--changed`, `--base <ref>`, `--fix`, `--dry-run`,
  `--hook <hook>` with `pre-commit` or `pre-push`, `--message-file <path>`, and `--verbose`. `--changed` checks the
  files changed after the upstream or default branch, and `--base` names another branch, tag, or commit and turns on
  `--changed`. `--dry-run` turns on `--fix`. (84a2026, 3cebd1a)
- `gspot check --staged` checks an exact copy of the index and refuses `--fix` and `--changed`. `--hook pre-push` reads
  what Git sends, checks each pushed revision in its own copy, and refuses `--staged`, `--changed`, `--fix`,
  `--dry-run`, and `--message-file`. (a26f8b5, 1d8be68)
- `gspot check --fix` runs each fixer in up to three passes, then runs the checks again. The changes stay in the working
  tree, unstaged. `--fix --dry-run` prints the diffs and writes nothing. (40cb0f0)
- The report prints one line per check with the status `passed`, `failed`, `missing`, `error`, or `skipped`, and each
  finding with its file, line, rule, message, and `help:` line. A failed check prints a `reproduce:` command, and a
  failed `pre-commit` or `pre-push` hook prints the `--no-verify` line. It shows 200 findings per check unless you pass
  `--verbose`, which also prints each command and ignore. (c322a78)
- `gspot add <configuration...>` selects configurations and takes `--scope <path>`. `gspot remove <configuration...>`
  takes `--scope <path>`, records the name in `removed_configurations`, and refuses a configuration that another one
  needs. Both refuse an always-selected configuration. (c322a78, 8af3d4c, ca2975c)
- `gspot set <setting> <values...>` takes `--reason <text>` and `--scope <path>`. It adds items to a list, adds entries
  from a TOML inline table, and replaces a command whole. It refuses `configurations` and record lists such as
  `[[command_check]]`. (c322a78)
- `gspot unset <setting> [items...]` takes `--scope <path>`. It deletes your value, or only the named list items or
  table entries. (40cb0f0)
- `gspot ignore <check>` takes a required `--reason <text>`, `--rule <rule>`, `--paths <glob...>`, and `--until <date>`.
  `gspot unignore <check>` takes `--rule <rule>` and `--paths <glob...>`, and keeps an ignore that covers every path
  when you pass `--paths`. (c322a78, 2b9624e, 4ce293a)
- `gspot list` prints selected and available configurations, with the state of each check in each scope.
  `gspot list settings` prints each setting of the selected configurations, its value, and its source. (1b49bdd)
- `gspot explain <subject>` explains a check such as `python/ruff`, a lint rule such as `eslint/no-console`, a
  configuration, a setting such as `limits.file_lines`, or a file such as `./src/app.ts`. It also prints the commands
  that change it. (c322a78, 5a02fef)
- `gspot doctor` reports tools, hooks, CI, the rule file count, and versions. It suggests configurations to add or
  remove and tool files to delete, and lists existing lint jobs and submodules. It exits 1 when a selected tool or a
  hook is not ready. (c322a78)
- `gspot export <file>` writes `gspot.toml` without its scopes as a template. It refuses `gspot.toml` and generated
  files, and warns when a command check runs a script from the repository. (fc7babe, 410336a)
- `check`, `install`, `add`, `remove`, `set`, `unset`, `ignore`, `unignore`, `list`, `explain`, and `export` stop with
  exit 2 when `.gspot/version` names another version. The message prints the install command. (40cb0f0)
- Exit code 0 means done, and 1 means findings remain. Exit code 2 means the run did not finish: a missing tool, a
  failed fixer, an invalid report, or invalid input. Ctrl-C and SIGTERM exit 130 and 143. (c322a78)
- With `--json`, a failure prints `error` and `message`. The codes are `arguments`, `git`, `files`, `writing`,
  `filesystem`, `settings`, `manifest`, `installation`, `tool`, `output`, `skip`, `pin`, `template`, and `prompt`. An
  unexpected error uses `failure`, and a stopped check uses `canceled`. (40cb0f0)
- `GSPOT_JOBS` limits how many checks run at once, `GITHUB_TOKEN` reads a private template and raises the download
  limit, and `NO_COLOR` turns color off. (c322a78)

#### Configurations and checks

- `gspot init` proposes a configuration from extensions, file names, paths, shebangs, project files, and declared
  dependencies. A configuration brings what it requires. Fifteen general configurations are always selected. (c322a78)
- Of the 175 checks, 128 run at both levels and 47 only at `all`. By stage, 122 run at commit, 46 at push, 6 by hand,
  and 1 on the commit message. Each entry below marks a check that does not run at commit. (40cb0f0)
- `gspot check --fix` has 15 fixers: `gspot/settings-format`, `site/svgo`, `files/taplo-format`, `format/prettier`,
  `secrets/dotenv-linter`, `spelling/typos`, `bash/shfmt`, `css/stylelint`, `javascript/eslint`,
  `markdown/markdownlint`, `python/ruff`, `python/ruff-format`, `sql/sqlfluff`, `swift/swiftlint`, and
  `swift/swiftformat`. (40cb0f0)
- These checks need the network: `expo/doctor`, `site/linkinator-external`, `dependencies/osv`,
  `dependencies/stale-lockfile`, `docs/lychee-external`, `files/v8r`, `secrets/trufflehog`, `security/semgrep-registry`,
  `github-actions/pinact`, and `security/codeql`, which downloads its query packs. (40cb0f0)
- These checks need Docker: `docker/compose`, `docker/trivy-image`, `nginx/config-test`, and `supabase/stale-types`.
  These run a build: `nextjs/build`, `swift/build`, `swift/swiftlint-analyze`, `swift/periphery`,
  `swift-tests/coverage`, and seven `site` checks. (40cb0f0)
- `swift/build` and `swift-tests/coverage` run on macOS and Linux, and `swift/swiftlint-analyze` on macOS. The pins for
  Semgrep, ansible-lint, gixy, SwiftLint, and SwiftFormat have macOS and Linux builds. Periphery has macOS builds, and
  CodeQL has macOS, Linux x64, and Windows builds. A check whose tool has no build for the host is skipped. (40cb0f0)
- gspot pins 67 npm packages, 12 Python packages, and 20 programs. It also names 20 tools that your system or project
  supplies, such as `docker`, `swift`, and `jest`. (40cb0f0)

##### Languages

- `bash`: ShellCheck, shfmt, and syntax passes for Bash, zsh, and Bats, plus structure checks for shell functions,
  sourcing, and unsafe commands. Both levels: `bash/bash-syntax`, `bash/zsh-syntax`, `bash/bats-syntax`,
  `bash/shellcheck`, `bash/shfmt`, `bash/unused-functions`, `bash/unread-arguments`, `bash/safety`. `all` adds:
  `bash/script-layout`, `bash/doc-comments`, `bash/source-order`, `bash/private-prefix`, `bash/function-size`,
  `bash/wrappers`, `bash/inline-scripts`, `bash/ssh-blocks`, `bash/variable-defaults`, `bash/include-guards`. (c322a78)
- `css`: Stylelint with the standard rules over stylesheets and the style blocks of Vue and Svelte components. SCSS gets
  formatting only. Both levels: `css/stylelint`. (dbe2f27)
- `html`: html-validate for structure and accessibility. At `all`, it refuses inline scripts and handlers, and the files
  in `html.templates` must hold placeholders instead of copy. Both levels: `html/validate`. `all` adds: `html/scripts`,
  `html/template-text`. (dbe2f27)
- `javascript`: ESLint with the shipped rule set over JavaScript, TypeScript, component files, and `package.json`, JSDoc
  type checks, and Knip for unused files, exports, and dependencies. Both levels: `javascript/eslint`, `javascript/tsc`
  (push), `javascript/knip` (push). (7ff4582)
- `markdown`: markdownlint, plus JSON, JSONC, TOML, YAML, Bash, JavaScript, JSX, TypeScript, TSX, and Python code fences
  in `.md` files that must parse. Both levels: `markdown/markdownlint`, `markdown/fences`. (d08e71b)
- `python`: Ruff for lint and layout, basedpyright for types, import contracts, docstrings that match signatures, unused
  dependencies, and `pyproject.toml` validation. At `all`, basedpyright also requires annotations, and structure checks
  cover function size, exports, and singletons. Both levels: `python/ruff`, `python/ruff-format`, `python/basedpyright`
  (push), `python/import-linter`, `python/pydoclint`, `python/deptry` (push), `python/pyproject`. `all` adds:
  `python/pip-installs`, `python/function-size`, `python/placeholder-docstrings`, `python/private-prefix`,
  `python/exports-at-bottom`, `python/module-getattr`, `python/package-exports`, `python/export-order`,
  `python/singletons`. (0a3fe7b)
- `sql`: SQLFluff for layout, capitalization, aliasing, and ambiguous references, in the dialect of
  `tools.sqlfluff.dialect`. At `all`, it also reports trivial Postgres functions. Both levels: `sql/sqlfluff`. `all`
  adds: `sql/functions`. (58f1fda)
- `swift`: SwiftLint with warnings as errors, SwiftFormat, a package or Xcode build, the analyzer rules, and Periphery
  for unused declarations. Both levels: `swift/swiftlint`, `swift/swiftformat`, `swift/build` (push),
  `swift/swiftlint-analyze` (manual), `swift/periphery` (push). (8d5b446)
- `typescript`: Requires `javascript`. ESLint with typescript-eslint, and the strict compiler. Every `tsconfig.json` you
  write must set `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, and
  `noFallthroughCasesInSwitch`, and `all` adds `noImplicitReturns` and `noPropertyAccessFromIndexSignature`. Both
  levels: `typescript/tsc` (push), `typescript/tsconfig`. (7ff4582)

##### Frameworks

- `astro`: Requires `javascript`. ESLint reads frontmatter, markup, and scripts with the Astro plugin, and `astro check`
  reports type errors in every component. Both levels: `astro/astro-check` (push). (184e4ad)
- `expo`: Requires `react-native`. Rules for public environment variables and DOM exports, and Expo Doctor. Both levels:
  `expo/doctor` (push). (4ce293a)
- `express`: Requires `javascript`. Semgrep rules for request handling, and at `all` an ESLint selector that keeps
  identifiers out of client messages. (3990c68)
- `fastapi`: Requires `python`. Ruff rules for route declarations, and Semgrep rules for request handling. (0a3fe7b)
- `nestjs`: Requires `typescript`. The compiler options that decorators need, and the NestJS plugin rules for providers,
  routes, and DTOs. (85b68a6)
- `nextjs`: Requires `typescript`, `react`, and `react-dom`. The framework and hooks rules of ESLint, and
  `gspot/require-server-only` for server code. The checks type-check the app, keep a page and a route handler out of one
  segment, keep build checks on, and match package versions. Both levels: `nextjs/tsc` (push), `nextjs/route-segments`,
  `nextjs/next-config`, `nextjs/version-pairs`. `all` adds: `nextjs/build` (push). (7e6cb1c)
- `react`: Requires `javascript`. The recommended React and hooks rules as errors, component files that keep their state
  on a reload, and one version of `react` and `react-dom`. Both levels: `react/version-pairs`. (de07848)
- `react-dom`: Requires `react`. JSX accessibility rules for labels, alternative text, keyboard access, and ARIA
  attributes. (4ce293a)
- `react-native`: Requires `react`. Lists use stable keys and virtualized rendering, touch targets use `Pressable`, and
  AsyncStorage stores no credentials. (7f122e8)
- `site`: Requires `html`. A site built to a folder: its build, HTML, unused CSS, links, sitemap, web manifest, and SVG
  weight. `site/size` waits for a `[[site.size_limit]]` record. Both levels: `site/build` (push), `site/html-validate`
  (push), `site/purgecss` (push), `site/linkinator` (push), `site/linkinator-external` (manual), `site/size` (push),
  `site/sitemap` (push), `site/svgo`, `site/webmanifest`. `all` adds: `site/build-reproducible` (push),
  `site/unused-assets` (push). (d04c456)
- `svelte`: Requires `javascript`. ESLint over markup and scripts, and `svelte-check` for compiler warnings,
  accessibility warnings, and types. Both levels: `svelte/svelte-check` (push). (fb7b5c2)
- `vue`: Requires `javascript`. ESLint over templates, scripts, and accessibility, and `vue-tsc` when the scope selects
  `typescript`. Both levels: `vue/vue-tsc` (push). (fb7b5c2)

##### Platforms and databases

- `cloudflare`: Requires `javascript`. Wrangler configurations that parse and pin a compatibility date, headers and
  redirects files that Cloudflare can read, fresh binding types, and Semgrep rules for workers at `all`. Both levels:
  `cloudflare/wrangler`, `cloudflare/headers`, `cloudflare/redirects`, `cloudflare/stale-types` (push),
  `cloudflare/security-headers`. (7e6cb1c)
- `supabase`: Requires `postgres` and `javascript`. A project file that parses, migration names, a policy for every
  storage bucket, privileged keys only in edge functions and tests, Deno over edge functions, and fresh database types.
  Both levels: `supabase/project-file`, `supabase/migration-names`, `supabase/storage-policies`,
  `supabase/service-role-key`, `supabase/deno-lint`, `supabase/deno-check` (push), `supabase/stale-types` (push).
  (273e081)
- `postgres`: Requires `sql`. Squawk over migrations, ordered versions, frozen migrations, row level security, no
  blanket grants, `search_path` on `SECURITY DEFINER`, and an index for every foreign key. Both levels:
  `postgres/squawk`, `postgres/migration-order`, `postgres/edited-migrations`, `postgres/row-level-security`,
  `postgres/grants`, `postgres/definer-search-path`, `postgres/foreign-key-indexes`. (91b08ff)

##### Testing

- `jest`: Requires `javascript` and `coverage`. Test rules through ESLint, and Jest in a copy of your sources, against
  all four coverage floors. Both levels: `jest/coverage` (push). (40cb0f0)
- `pytest`: Requires `python` and `coverage`. Ruff pytest rules, test-name prefixes, and pytest with a coverage floor.
  Both levels: `pytest/coverage` (push). (0a3fe7b)
- `swift-tests`: Requires `swift` and `coverage`. A disabled test says why, no test sleeps at `all`, and each source
  target holds a coverage floor. It writes a `.swiftlint.yml` into each `Tests` or `*Tests` folder. Both levels:
  `swift-tests/skip-reasons`, `swift-tests/coverage` (push). `all` adds: `swift-tests/sleep`. (48fcc38)
- `vitest`: Requires `javascript` and `coverage`. Test rules through ESLint, and Vitest with coverage thresholds. Both
  levels: `vitest/coverage` (push). (3990c68)

##### Infrastructure

- `ansible`: ansible-lint with the `moderate` profile at `recommended` and `production` at `all`. Both levels:
  `ansible/ansible-lint`. (ad1814f)
- `docker`: hadolint with ShellCheck over `RUN` lines, Compose files that parse, an ignore file beside every Dockerfile,
  and Trivy over configuration and images. Both levels: `docker/hadolint`, `docker/compose` (push),
  `docker/dockerignore`, `docker/trivy-config` (push), `docker/trivy-image` (manual). (00629a9)
- `github-actions`: actionlint, pinact for full commit pins, and zizmor for template injection, permissions, and
  dangerous triggers. Both levels: `github-actions/actionlint`, `github-actions/pinact` (push), `github-actions/zizmor`.
  (199b525)
- `nginx`: gixy for security mistakes, and `nginx -t` inside the image that `tools.nginx.image` names. Both levels:
  `nginx/gixy`, `nginx/config-test` (push). (00629a9)
- `openapi`: Spectral over `openapi.document`, and a stale check when `openapi.generate_command` is set. Both levels:
  `openapi/spectral`, `openapi/stale-document` (push). (3990c68)
- `xcode`: Property lists, build settings files, string catalogs, asset catalogs, target membership, entitlements, and
  App Transport Security. `xcode/entitlements` waits for `xcode.allowed_entitlements`. Both levels: `xcode/plutil`,
  `xcode/xcconfig`, `xcode/xcstrings`, `xcode/assets`, `xcode/files-without-target`, `xcode/entitlements`,
  `xcode/app-transport-security`. `all` adds: `xcode/unused-assets`, `xcode/test-plans`, `xcode/symlinks`. (48fcc38)

##### Libraries

- `drizzle`: Requires `javascript`. No update or delete without a `where`, relations for every reference at `all`, and
  migrations that match the schema. Both levels: `drizzle/stale-migrations` (push). `all` adds: `drizzle/relations`.
  (7e6cb1c)
- `react-hook-form`: Requires `javascript`. A form validates through a resolver, and a registered field is not also
  controlled. (7e6cb1c)
- `swift-snapshot-testing`: Requires `swift`. No test stays in recording mode, and `__Snapshots__` folders name a
  sibling test file. Both levels: `swift-snapshot-testing/recording`. `all` adds: `swift-snapshot-testing/references`.
  (ca2975c)
- `tanstack-query`: Requires `javascript`. The query rules of ESLint for dependency lists, stable clients, and option
  order. (7e6cb1c)
- `testing-library`: Requires `javascript`. Testing Library rules over test files. (48298e0)
- `translations`: Requires `javascript`. No literal text in components, and next-intl message files that parse and stay
  complete in every locale. Both levels: `translations/messages` (push). (7e6cb1c)
- `trpc`: Requires `javascript`. Every procedure validates its input, and client code imports the server module as a
  type only. (7e6cb1c)
- `zod`: Requires `javascript`. ESLint rules against unsafe and deprecated schema APIs. (7e6cb1c)
- `zustand`: Requires `javascript`. A store is created in a store file, and a component reads it through a selector.
  (7e6cb1c)

##### General

- `commits`: Selected in a Git repository. commitlint requires a conventional type, an optional known scope, a first
  line of 72 characters or fewer, and a wrapped body. At `all`: `commits/commitlint` (message),
  `commits/commitlint-pushed` (push). (8e6bd0b)
- `coverage`: Coverage floors that the test configurations share. It has no check, and the test configurations select it
  for you. (ca2975c)
- `dependencies`: OSV advisories, a frozen install in a temporary copy, lockfile hosts, and at `all` one version per
  dependency, one package manager, and the Bun release age. Both levels: `dependencies/osv` (push),
  `dependencies/stale-lockfile` (push), `dependencies/lockfile-hosts`. `all` adds: `dependencies/syncpack` (push),
  `dependencies/package-json`, `dependencies/bun-release-age`. (25b1234)
- `docs`: Local links and anchors, documented paths and commands, and external links by hand. At `all`, a `README.md` in
  every scope, a `LICENSE` at the root, and the README shape. Both levels: `docs/lychee`, `docs/lychee-external`
  (manual), `docs/missing-paths`. `all` adds: `docs/required-files`, `docs/readme-shape`. (d08e71b)
- `duplication`: jscpd over the languages of the selected configurations. Past the share in `limits.duplicate_percent`,
  every copy is a finding. At `all`: `duplication/jscpd` (push). (25b1234)
- `engineering`: Rule files on how to work and how to write code. It has no check. (4ce293a)
- `files`: Taplo for TOML, yamllint for YAML, xmllint for XML, and v8r against the SchemaStore catalog. Both levels:
  `files/taplo`, `files/taplo-format`, `files/yamllint`, `files/v8r` (push), `files/xmllint`. (2d4df08)
- `format`: One `[format]` table for Prettier and the other formatters, and `editorconfig-checker` for line endings,
  final newlines, and trailing whitespace. Both levels: `format/prettier`, `format/editorconfig-checker`. (c322a78)
- `gspot`: `gspot.toml` format and validity, generated files that match, setting paths that match tracked files, and a
  reason on every suppression comment. Semgrep and Vale suppression comments are refused. Both levels:
  `gspot/settings-format`, `gspot/generated-files`, `gspot/unused-entries`, `gspot/settings`, `gspot/suppressions`.
  (4ce293a)
- `licenses`: Selected by `package.json` or `pyproject.toml`. It compares installed npm and Python packages with
  `licenses.allowed`, and scans nothing until you set that list or an allowed package. Both levels: `licenses/allowed`
  (push). (2b9624e)
- `naming`: Banned terms, case, length, and word count over identifiers, file stems, and folder names. Shipped term
  groups are `containers`, `roles`, `marketing`, `defensive`, `conjunctions`, `tests`, and `folders`. Both levels:
  `naming/settings`. `all` adds: `naming/identifiers`, `naming/paths`. (c322a78)
- `prose`: Vale over comments and documentation. At `recommended` it checks ambiguous dates, link text, and alternative
  text, and `all` adds the complete gspot style and upstream packages. Both levels: `prose/vale`. (d08e71b)
- `repository`: Tracked files over `limits.file_kilobytes` need Git LFS or a `linguist-generated` or `linguist-vendored`
  mark, and paths such as `.env` and `node_modules/` must stay untracked. Both levels: `repository/large-files`,
  `repository/tracked-files`. (895fee5)
- `secrets`: Gitleaks on the staged change, on pushed commits, and on files in a folder without Git, TruffleHog
  verification of pushed secrets, `dotenv-linter`, and example environment files. Both levels:
  `secrets/gitleaks-staged`, `secrets/gitleaks-pushed` (push), `secrets/gitleaks-files`, `secrets/trufflehog` (push),
  `secrets/dotenv-linter`, `secrets/env-examples` (push). (cb37127)
- `security`: Semgrep with the packs of the selected configurations and your `tools.semgrep.rule_files`, registry packs
  by hand, and CodeQL by hand once `tools.codeql.languages` is set. Both levels: `security/semgrep` (push),
  `security/semgrep-registry` (manual), `security/codeql` (manual). (2963d88)
- `spelling`: typos over code, comments, and documentation, with `allowed_words` and `spelling.locale`. Both levels:
  `spelling/typos`. (c322a78)
- `structure`: Lone files, shared name prefixes, a file beside a folder of one stem, line limits, trivial functions and
  forwarding files, and environment reads outside the allowed files. At `all`: `structure/lone-files`,
  `structure/shared-prefixes`, `structure/file-folder-clashes`, `structure/file-lines`, `structure/trivial-functions`,
  `structure/env-reads`. (c322a78)

#### Settings

`gspot.toml` uses TOML 1.0 and starts with a `#:schema` line for editors. The npm package ships `gspot.schema.json`.
`gspot list settings` prints the settings of the selected configurations, each with its source. (40cb0f0)

- Root keys: `level`, `configurations`, `removed_configurations`, `allowed_words`, `test_files`, and
  `tool_timeout_seconds`, which defaults to 600. `test_files` ships ten patterns, such as `**/tests/**` and
  `**/*.test.*`. (ca2975c, 4ce293a)
- A value that loosens a check needs a reason, written as `{ value = ..., reason = "..." }` or passed with `--reason`.
  That covers raised limits, lowered coverage, and items added to an allow list. A reason needs at least two words.
  (40cb0f0)
- `[hooks]` has `enabled`, and `gspot init` writes `true`. `[ci]` has `enabled`, `provider` with `github` or `gitlab`,
  `setup_command`, and `operating_systems`, which defaults to `linux` and is GitHub only. (f1f6a53)
- `[rules]` has `enabled`, which defaults to `true`, `exclude`, and `instruction_files`. (4ce293a)
- `[format]` defaults: `indent_style = "space"`, `indent_width = 4`, `print_width = 120`, `line_ending = "lf"`,
  `final_newline = true`, `quotes = "single"`, `trailing_commas = "all"`, and `semicolons = true`. `[[format.override]]`
  sets them per path. (c322a78)
- `[limits]` function defaults: `function_lines` 60, `function_parameters` 7, `statements` 30, `nesting` 3,
  `callback_nesting` 3, `cognitive_complexity` 8, `cyclomatic_complexity` 8, `branches` 8, `returns` 4, `assignments` 8,
  and `min_function_statements` 2. (c322a78)
- `[limits]` file and Swift defaults: `file_lines` 300, or 400 for SQL and 140 for Bash, `closure_lines` 60,
  `type_lines` 300, `index_exports` 20, `prefix_collisions` 2, and `file_kilobytes` 1024. Bash also sets
  `function_lines` to 40. The function, file, and Swift limits take `limits.<language>` for the languages each one
  reads, out of TypeScript, JavaScript, Python, Swift, SQL, and Bash. `prefix_collisions`, `file_kilobytes`, and the
  prose and duplication limits take none. (c322a78)
- `[limits]` prose and duplication defaults: `sentence_words` 30, `list_item_words` 45, `paragraph_sentences` 6,
  `headings_before_contents` 6, `min_duplicate_lines` 8, `min_duplicate_tokens` 40, and `duplicate_percent` 4. (c322a78)
- `[naming]` has `max_characters` 35, `max_words` 4, `cases`, `banned_words`, and `[[naming.override]]`, per language
  and per category. Swift defaults to 40 and 5, and SQL to 55 and 7. (c322a78)
- `[architecture]` has `[[architecture.module]]` with `name`, `paths`, and `may_import`, and the roles
  `environment_readers`, `scripts`, `stores`, and `routers`. `structure.reexports` takes `none` or `index-only`.
  (4ce293a)
- `[coverage]` has `lines`, `branches`, `functions`, and `statements`, which default to 0 at `recommended` and 80 at
  `all`, and `[[coverage.target]]` for Swift targets. (ca2975c)
- `[dependencies]` has `min_release_age_days` 7 for Bun installs, `allowed_registries` with `registry.npmjs.org` and
  `registry.yarnpkg.com`, and `scanner`. `[docs]` has `banned_headings` and `allowed_urls`. `[licenses]` has `allowed`
  and `[[licenses.allowed_package]]`. (fdae08d, 40cb0f0)
- Configuration tables: `cloudflare.types_file`, `cloudflare.types_interface`, `drizzle.client_names`, `html.templates`,
  `openapi.document`, `openapi.generate_command`, `postgres.client_schemas`, `postgres.frozen_through`, and
  `postgres.migrations_folder`. (40cb0f0)
- More configuration tables: `secrets.env_examples`, `secrets.reader_functions`, `site.build_command`,
  `site.build_folder`, `site.allowed_unlisted_pages`, `[[site.size_limit]]`, `spelling.locale`,
  `supabase.functions_folder`, `supabase.schemas`, and `supabase.types_file`. (40cb0f0)
- The last configuration tables: `translations.base_locale`, `translations.messages_folder`, `xcode.project`,
  `xcode.scheme`, `xcode.destination`, and `xcode.allowed_entitlements`. (40cb0f0)
- Tool tables with values: `tools.codeql.languages`, `tools.hadolint.trusted_registries`, `tools.nginx.image`,
  `tools.ruff.docstring_convention`, `tools.semgrep.registry_packs`, `tools.semgrep.rule_files`,
  `tools.sqlfluff.dialect`, `tools.squawk.assume_in_transaction`, `tools.svgo.min_saving_percent`,
  `tools.swiftlint.always_keep_imports`, and `tools.trivy.severity`. (40cb0f0)
- Tool tables for rule options: `tools.commitlint.rules`, `tools.eslint.rules`, `tools.markdownlint.rules`,
  `tools.stylelint.rules`, and `tools.yamllint.rules`. The level decides which rules run, and these keys set options
  only. (40cb0f0)
- More tool keys: `tools.commitlint.types`, `tools.commitlint.scopes`, `tools.eslint.import_extension`,
  `tools.eslint.restricted_imports`, `[[tools.eslint.override]]`, `tools.knip.entry`, `tools.knip.ignore_dependencies`,
  `tools.purgecss.safelist`, and `[[tools.v8r.schema]]`. (40cb0f0)
- `extra` passes options to the tool as written, and needs a reason. It exists for `eslint`, `prettier`,
  `editorconfig-checker`, `typos`, `shellcheck`, `knip`, and `taplo`. (40cb0f0)
- `[[scope]]` takes `path`, `configurations`, `removed_configurations`, `test_files`, and the configuration and tool
  tables above. These stay at the root: `level`, `allowed_words`, `tool_timeout_seconds`, `[hooks]`, `[ci]`, `[rules]`,
  `structure.reexports`, `docs.banned_headings`, `[[ignore]]`, `[[command_check]]`, `tools.v8r`, and record lists such
  as `[[naming.override]]`. A scope list adds to the root list, and a single value replaces it for that folder and the
  folders inside it. (40cb0f0)
- `[[ignore]]` takes `check`, `rule`, `paths`, `reason`, and `until`, an unquoted TOML date. A record without `rule` or
  `paths` turns the whole check off. (c322a78, 4ce293a)
- `[[command_check]]` runs your command as a check, without a shell, with `name`, `command`, `paths`, `stage`,
  `summary`, `help`, `fix`, `exit_codes`, and `output`. `stage` takes `commit`, `push`, or `manual`, and `command` takes
  `{files}` or `{file}`. (40cb0f0)
- `output.format` takes `regex`, the default, `json`, `sarif`, `grouped`, `lines`, `none`, `semgrep`, `trufflehog`,
  `typos`, `markdownlint`, or `knip`. (40cb0f0)
- `output` also takes `pattern`, `file_pattern`, `message`, `fixable`, `fields`, `items`, `children`, `line_base`, and
  `file_type`. `[[naming.override]]` takes `paths`, `languages`, `categories`, `ignored_prefix`, `allow_digits`,
  `allow_repeated_words`, `allowed_names`, `cases`, and `reason`. (40cb0f0)

#### Generated files and hooks

gspot writes these files from `gspot.toml`. Pointers, except the JSON ones `.stylelintrc.json` and `pyrightconfig.json`,
and the CI file carry a header that names `gspot.toml` as their source. `gspot/generated-files` reports a changed,
missing, or stray file. (ac6a5e5)

- `.gspot/hooks/` holds `pre-commit`, which runs `gspot check --hook pre-commit`, `pre-push`, which runs
  `gspot check --hook pre-push -- "$@"`, and `commit-msg`, which runs `gspot check --message-file "$1"`. The hooks exit
  2 with an install hint when the start command is missing. (c322a78, 86bb8fb)
- `.gspot/config/` holds the tool files of the selected checks, with a folder per scope when a tool needs one:
  `ansible-lint.yml`, `basedpyrightconfig.json`, `commitlint.config.cjs`, `eslint.config.mjs`, `gitleaks.toml`,
  `gixy.cfg`, `hadolint.yml`, `html-validate-built.json`, and `html-validate-source.json`. (8af3d4c)
- `.gspot/config/` also holds `jscpd.json`, `jsconfig.json`, `knip.json`, `lychee.toml`, `markdownlint-cli2.mjs`,
  `markdownlint.jsonc`, `osv-scanner.toml`, `periphery.yml`, `prettier.json`, `purgecss.config.mjs`, `ruff.toml`,
  `shellcheckrc`, `spectral.yaml`, `sqlfluff.cfg`, and `squawk.toml`. (8af3d4c)
- `.gspot/config/` also holds `stylelint.json`, `swiftformat`, `swiftlint.yml`, `syncpack.json`, `taplo.toml`,
  `trivy.yml`, `trivyignore`, `typos.toml`, `v8r.yml`, `vale.ini`, `vale/styles/`, `yamllint.yml`, `zizmor.yml`, and
  `semgrep/<pack>.yml`. The Semgrep packs are `bash`, `javascript`, `swift`, `express`, `fastapi`, `cloudflare`, and
  `supabase`. (8af3d4c)
- Pointers send editors to the tool files: `eslint.config.mjs`, `prettier.config.mjs`, `.stylelintrc.json`,
  `.markdownlint-cli2.mjs`, `ruff.toml`, `pyrightconfig.json`, and `.swiftlint.yml`. gspot also writes `.editorconfig`,
  `.prettierignore`, and `.semgrepignore`. (c322a78)
- Tool projects: `.gspot/package.json` with its lockfile, `.gspot/pyproject.toml`, which pins Python 3.13.16, with
  `.gspot/uv.lock`, and `.gspot/mise.toml`. A repository on Yarn 2 or newer also gets `.gspot/.yarnrc.yml`.
  `.gspot/version` holds the gspot version. (1b49bdd, f5d55ed)
- GitHub CI writes `.github/workflows/gspot.yml`, with a `check-<system>` job for each system in `ci.operating_systems`.
  It checks changed files on a pull request, a merge group, or a later push, and every file on the first push of a
  branch. (1b49bdd, f1f6a53)
- On a push to the default branch, a `manual-<system>` job runs the manual checks that the configurations select. A
  scope that selects `swift` adds macOS. (f1f6a53)
- GitLab CI writes `.gitlab/ci/gspot.yml`, for you to include from `.gitlab-ci.yml`. It expects mise on the CI machine.
  (1b49bdd)
- Managed blocks sit in `.gitignore`, `.gitattributes`, `AGENTS.md`, and each path in `rules.instruction_files`. Text
  outside the markers stays yours. gspot changes `CLAUDE.md` only when you list it in `rules.instruction_files`.
  (cc7c817)
- Beside a Bun lockfile, gspot sets `install.minimumReleaseAge` in `bunfig.toml`, and `install.security.scanner` when
  `dependencies.scanner` is set. In a `package.json` that holds a `commitlint` or `stylelint` key, it points the key at
  the generated tool file once that tool runs. `commitlint` runs at `all`, and `stylelint` when `css` is selected.
  (8af3d4c, 40cb0f0)
- `.gspot/state/` records what gspot wrote, so it can tell its files from your edits. Git ignores it, along with
  `.gspot/node_modules/`, `.gspot/.venv/`, `.gspot/vale/`, `.gspot/.npmrc`, and `.gspot/.yarnrc-install.yml`. Commit the
  rest. (1b49bdd)

#### Rule files

gspot writes the rule files that fit your selection under `.gspot/rules/<group>/<configuration>/`, and the block in
`AGENTS.md` lists them by area and says to read `WORKING.md` and `WRITING.md` first. `rules.exclude` leaves files out,
and `rules.enabled = false` deletes the files and the blocks. (7805b09, cc7c817, 40cb0f0)

- Sections marked `<!-- level: all -->` drop out at `recommended`, and 49 of the 81 files hold such sections. A file
  left with no section is not written. (bd7c659)
- General: `commits/GIT.md`, `dependencies/DEPENDENCIES.md`, `docs/DOCS.md`, `files/YAML.md`, `gspot/GENERATED.md`,
  `naming/NAMING.md`, `prose/WRITING.md`, `secrets/SECRETS.md`, and `security/SECURITY.md`. (7805b09)
- General, in `engineering/agent/`: `PLANNING.md`, `SUPPRESSIONS.md`, `TALKING.md`, `TASKS.md`, and `WORKING.md`. In
  `engineering/code/`: `ACCESSIBILITY.md`, `CLI.md`, `COMMENTS.md`, `CONFIGURATION.md`, `ERRORS.md`, `HTTP.md`,
  `LOGGING.md`, and `TESTING.md`. (7805b09)
- Languages: `bash` has `BASH.md`, `LANGUAGE.md`, `NAMING.md`, `OPERATIONS.md`, and `SAFETY.md`. `css` has `CSS.md`,
  `NAMING.md`, and `TAILWIND.md`. `html` has `HTML.md` and `NAMING.md`. `sql` has `NAMING.md` and `SQL.md`. `typescript`
  has `NAMING.md` and `TYPESCRIPT.md`. (7805b09)
- More languages: `javascript` has `BUN.md`, `COMPONENTS.md`, `DENO.md`, `JAVASCRIPT.md`, `NAMING.md`, `NODE.md`, and
  `PLAYWRIGHT.md`. `python` has `DESIGN.md`, `FLOW.md`, `NAMING.md`, `PACKAGING.md`, `PYTHON.md`, and `TYPING.md`.
  `swift` has `NAMING.md`, `SWIFT.md`, `SWIFTUI.md`, and `UIKIT.md`. (7805b09)
- Frameworks: `ASTRO.md`, `EXPRESS.md`, `FASTAPI.md`, `NESTJS.md`, `NEXTJS.md`, `REACT-NATIVE.md`, `REACT.md`,
  `SITE.md`, `SVELTE.md`, and `VUE.md`. (7805b09)
- Infrastructure: `DOCKER.md`, `GITHUB-ACTIONS.md`, `NGINX.md`, `OPENAPI.md`, and `XCODE.md`. Testing: `SWIFT-TESTS.md`
  and `VITEST.md`. Platforms: `CLOUDFLARE.md` and `SUPABASE.md`. Database: `POSTGRES.md`. (7805b09)
- Libraries: `DRIZZLE.md`, `REACT-HOOK-FORM.md`, `TANSTACK-QUERY.md`, `NEXT-INTL.md`, `TRANSLATIONS.md`, `TRPC.md`,
  `ZOD.md`, and `ZUSTAND.md`. (7805b09)
- These files need a match in your repository. `ACCESSIBILITY.md` needs a UI file type, `TAILWIND.md` needs
  `tailwindcss`, `PLAYWRIGHT.md` needs Playwright, `COMPONENTS.md` needs Astro, Svelte, Vue, or React, and
  `NEXT-INTL.md` needs `next-intl`. (40cb0f0)
- `NODE.md` needs a Node runtime without `react-native` or `expo`, `DENO.md` needs a Deno runtime, and `BUN.md` needs a
  Bun lockfile or `bunfig.toml`. `SWIFTUI.md` and `UIKIT.md` need that Swift import, and `DRIZZLE.md` needs `pg` or
  `postgres`. (40cb0f0)

#### ESLint plugin 0.1.1

`@gspothq/eslint-plugin` 0.1.1 ships ES modules with TypeScript declarations. It needs Node.js `>=22.12` and ESLint
`>=9.38.0`, and its optional TypeScript peer is `>=4.8.4 <6.1.0`. The CLI installs the plugin version that matches it.
(5f8503e, 2202bcf)

- `gspot.configs.recommended` turns on `gspot/no-client-env`, which finds private environment reads in client modules:
  `process.env`, `Bun.env`, `Deno.env`, and `import.meta.env`. (7ff4582, c57c270)
- `gspot.configs.all` adds `gspot/header-first`, `gspot/import-boundaries`, `gspot/no-alias-exports`,
  `gspot/no-index-imports`, `gspot/no-trivial-files`, and `gspot/no-trivial-functions`. (7ff4582, 6ec3562)
- `gspot/header-first` reports comments inside or right after an import block. `gspot/import-boundaries` reports
  relative imports that leave the nearest boundary folder. `gspot/no-alias-exports` reports an exported constant that
  only renames a value. (7ff4582, 6ec3562)
- `gspot/no-index-imports` reports an import that names an index file. `gspot/no-trivial-files` reports a file with only
  forwarding, aliases, re-exports, or trivial functions. `gspot/no-trivial-functions` reports named functions of two
  statements or fewer by default. (7ff4582, 95c71b4)
- No preset turns on `gspot/require-server-only`, which requires `import "server-only"` or `"use server"` in the files
  you select. The `nextjs` configuration turns it on. (7ff4582)

#### Documentation

- The site at [generativespotting.com](https://generativespotting.com) has 22 guides: what gspot does, install,
  quickstarts for JavaScript and TypeScript, Python, and Swift, and joining a repository. They also cover findings,
  hooks, CI, coding agents, `gspot.toml`, excludes, monorepos, command checks, and templates. (9750666, 40cb0f0)
- The other guides cover generated files, upgrades, tests and coverage, dependency licenses, security, troubleshooting,
  and removal. gspot has no uninstall command, and the removal guide lists the steps. (94a4938, 40cb0f0)
- The reference pages for commands, configurations, checks, the ESLint plugin, and `gspot.toml` are built from the code.
  A separate page lists exit codes and environment variables. (4ce293a, 40cb0f0)

### Development

CI runs the unit, integration, and e2e suites on Ubuntu, macOS, and Windows, from 381 test files at the tag, and gspot
checks its own repository at level `all`. A `release` workflow, started by hand on a version tag, publishes both
packages to npm through trusted publishing and creates the GitHub release. (c443e3c, 40cb0f0, 2202bcf, d5a1b69)

Released 2026-10-13. [Commits of 0.1.1](https://github.com/stefanionescu/gspot/commits/v0.1.1)
