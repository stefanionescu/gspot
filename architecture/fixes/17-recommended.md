# The Recommended Level

Row 22 of the build order. [07-levels.md](07-levels.md) builds the level key and sorts the
presets of each language. This file sorts what is left: checks that change how a repository
builds or installs, and house rules that sat in shared presets. One rule decides each case
(D-126): the first install never changes a build.

## K-74: the typescript preset edits the `tsconfig.json` of the developer

**What is wrong.** The preset puts `extends` into the `tsconfig.json` of the developer and
requires ten compiler options, among them `erasableSyntaxOnly` and `verbatimModuleSyntax`. That
changes what their own `tsc` and their build accept.

**Target.** gspot never edits a `tsconfig.json`. `typescript/tsc` type-checks through a generated
`.gspot/tsconfig.check.json` that extends the file of the repository and adds flags that only add
errors.

**Files.** New `presets/language/typescript/tsconfig.check.json.tmpl`. Deleted: `tsconfig.base.json.tmpl`
and the merge stub of the manifest. `checks/typescript/tsc.ts`, `checks/typescript/tsconfig-options.ts`.

**Logic.** At `recommended` the generated file adds `strict` only. At
`all` it adds `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`, `noImplicitOverride`, and `exactOptionalPropertyTypes`.
Where the file of the repository holds `references`, the check builds them as they are (K-226).
`typescript/tsconfig-options` moves to `all`, and reads the options of the repository without
asking for an `extends`.

**What goes.** The `extends` pointer, `jsonc-parser` edits of a file of the developer, and six
options that change emit or resolution (K-201).

**Tests.** A planted Vite app holds an unchanged `tsconfig.json` after `init`, and a finding for a
strict error.

**Done when.** It passes.

## K-75: checks of taste that fail a normal repository

**Additional local evidence.** The test-layout staged gate rejects `e2e` as a duplicate
word, `python` as a folder name, and React/React Native suites as a shared prefix.
It also rejects `custom-checks` and `scoped-presets` through vocabulary groups. These
are descriptive test names, not demonstrated defects. K-75 remains open.

Closes K-75 and K-91.

**What is wrong.** Every dependency must be an exact version, and `packageManager` must exist.
`bunfig.toml` must hold a seven-day release age. Every scope needs a README, a list of headings
is banned, and a long README needs a Contents list. Every shell script needs a four-line header.
Every TypeScript type sits under one folder, and no folder holds one file.

**Target.** Each is `all`. The README check of `recommended` asks for one README at the root.

**Files.** The manifests of dependencies, docs, markdown, bash, structure, and javascript.

**Logic.** `level = "all"` on `dependencies/manifest-policy`, `dependencies/install-policy`, the
scope rule of `docs/readme-present`, the banned list of `docs/headings`,
`structure/bash-script-header`, `structure/single-file-folder`, and `gspot/types-placement`.
`dependencies/lockfile-fresh` and `dependencies/lockfile-hosts` stay `recommended`, because they
find a defect.

**What goes.** Nothing but defaults.

**Tests.** The generated projects of [10-tests.md](10-tests.md) hold none of these findings at
`recommended`.

**Done when.** They pass.
