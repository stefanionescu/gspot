# Levels

Row 11 of the build order, which the Swift preset started and which holds for every preset. A
default install turned on the strictest setting of each tool and the house style of one owner.
The first run gave thousands of findings, and all of them went into a baseline nobody reads.

D-119 decides two levels. `recommended` holds what finds a defect, a security problem, or dead code. Banned-term checks, including folder and prose term bans, run at `all`. The shipped lists omit
`generate` and `service` (D-174). `all` adds what enforces a layout, an order, a header, or one way to write a thing that
works. `init` installs `recommended` and asks nothing.

No code holds a level today: the manifest schema has no such key, and `[inspection] strict`
changes nothing. This step builds the mechanism once, then sorts every check and every opt-in
tool rule. The fix file of row 22 sorts what this step leaves.

## K-198: every template starts at the strictest setting

Closes K-198, K-52, and K-221.

**What is wrong.** A default TypeScript install turns on `strictTypeChecked`, the recommended
sets of sonarjs and unicorn, a doc comment on every export, a ban on `enum`, and a capital letter
on every error message. A default Python install selects 50 ruff families with `preview` on.
`swiftlint.yml.tmpl` turns on 95 opt-in rules for every repository. basedpyright runs at
`typeCheckingMode = all`, ShellCheck at `enable=all`, and hadolint fails at `style`. The vue and
svelte fragments accept one script form alone.

**Target.** `level = "recommended"` or `level = "all"` at the top of `gspot.toml`. A check carries
`level` in its manifest, and a check above the level of the repository is not planned. A template
renders by level: `recommended` writes the recommended set of each tool and the rules that find a
defect, and `all` writes the rest.

**Files.** `policy/schema.ts`, `policy/normalize.ts`, `presets/manifest-schema.ts`, new
`presets/levels.ts`, `run/plan.ts`, `emit/templates.ts`, and every template that lists rules.

**Logic.** `checkSchema` gains `level`, required, so no check is unsorted. `levels.ts` holds
`isPlanned(check, policy)`. `templates.ts` gives every template `isAll`, and a rule list in a
template is two lists.

For ESLint the first list is `recommended` of typescript-eslint, and the
second adds `strictTypeChecked`, sonarjs, unicorn, and jsdoc. For ruff the first list is `E`,
`F`, `B`, `S`, `ASYNC`, `UP`, and `PL` errors, with `preview` off. For SwiftLint the first list
is the default rules and the opt-in rules that find a defect. basedpyright runs at `standard`,
ShellCheck with its default set, and hadolint fails at `warning`.

**What goes.** `[inspection] strict` as a switch for rules. Its other meaning, that an unchecked
file fails the run, becomes `[coverage] strict` ([13-words.md](13-words.md)). The single rule
list of each template goes too.

**Tests.** The snapshots hold both levels for each preset (T-36). A unit test fails a manifest
check with no `level`.

**Done when.** `init --yes` on the planted TypeScript repository of a plain Vite app holds under
50 findings, and none of them is about style.

## K-101: the plugin calls house style recommended

**What is wrong.** `configs.recommended` of the plugin turns on 23 rules as errors. Rules that
find a defect (`no-client-environment`, `require-server-only`, `no-cross-project-imports`) sit
beside imports sorted by line length and a file comment above the imports.

**Target.** `configs.recommended` holds the rules that find a defect, and `configs.all` holds
every rule.

**Files.** `packages/eslint-plugin/src/plugin.ts`, `presets/language/javascript/eslint.config.js.tmpl`.

**Logic.** Each rule states `meta.docs.level`. `plugin.ts` builds both configs from that field,
and the template spreads the config of the level.

**What goes.** The hand-written rule list of `configs.recommended`.

**Tests.** A unit test of the plugin holds that every rule names a level.

**Done when.** That test passes, and the README of the plugin shows both configs.

## K-135: one shell check holds sixteen rules

Closes K-135, K-141, K-142, and K-123.

**What is wrong.** `structure/bash-interpreter` holds the shebang, a three-line header, computed
directories, `readonly` on every name, strict mode, one `main`, the executable bit, and a trap
for `mktemp`. `${PORT:-8080}` anywhere is a finding, and every function needs a comment in a
fixed section order. Four checks look for the habits of one deploy repository: `run_ssh`,
`_CFG_<NAME>_READY`, a sweep of `nvidia-smi`, and `/root/.cache`.

**Target.** At `recommended` the bash preset runs the checks that find a defect. They are strict
mode, a `mktemp` with no trap, a failure discarded by an or-true, and `cd` with no failure path.
They are also a recursive remove, a broad `pkill`, unread arguments, duplicate functions, and
unused functions. The header,
order, underscore, owner, and doc-section rules are `all`.

**Files.** `structure/analyses/scripts/`: `interpreter.ts` splits into `strict-mode.ts`,
`temp-trap.ts`, and `script-header.ts`. `config/structure.ts`, `presets/language/bash/manifest.toml`.

**Logic.** Three check names replace one: `structure/bash-strict-mode`, `structure/bash-temp-trap`
(both `recommended`), and `structure/bash-script-header` (`all`).

**What goes.** `shell/ssh-blocks.ts`, `shell/config/guards.ts`, the `nvidia-smi` and
`/root/.cache` patterns of `shell/safety.ts`, and their word lists. They named one repository.

**Tests.** A planted script in ordinary style, with `${PORT:-8080}` and no function comments,
passes at `recommended` and fails at `all`.

**Done when.** That case passes.

## K-152: seven Python checks of one style

Closes K-152, K-151, and K-227.

**What is wrong.** Seven of the twelve Python structure checks are conventions. They ask for a
leading underscore on every private name, private above public, and `__all__` at the bottom. They
ban a lazy export, cap the exported names, and allow five names for an object built at import.
`integrity/dependency-ownership` calls a `requirements.txt` a second owner in any project.
`python/pydoclint` passes `--style google`, and `pytest/coverage` needs `pytest-cov`, which no
manifest names.

**Target.** `recommended` holds import-cycle defects. File and function length, call-through, placeholder prose, the seven conventions, pydoclint, and vulture are `all`. A thin wrapper is not a defect merely because it delegates (K-301). The ownership check is
planned where the scope holds `uv.lock`, `poetry.lock`, or `pdm.lock`.

**Files.** `presets/language/python/manifest.toml`, `presets/tool/pytest/manifest.toml`,
`checks/dependencies/ownership.ts`.

**Logic.** The ownership check takes `waits_for` a lockfile through `[detect] project_files` of
its manifest. pydoclint reads its style from `[tool.pydoclint]` or
`[tool.ruff.lint.pydocstyle]` of the project, and passes no `--style` where neither exists. The
pytest manifest names `pytest-cov` as a tool.

**What goes.** The flags `--style google` and `--min-confidence 80` as fixed values. The second
becomes `tools.vulture.min_confidence`.

**Tests.** A planted pip project with `requirements.txt` and NumPy docstrings passes.

**Done when.** That case passes.

## K-174: strict defaults of one owner in five presets

Closes K-174, K-161, K-167, K-112, and K-200.

**What is wrong.** `html/scripts` reports every inline script, so an analytics snippet fails a
normal site. `sql/block-comments` bans a comment form. `postgres/rls-present` asks every `public`
table for row level security, which is right only where clients reach the database. The heading `Table of contents` is banned, and a long README must hold a heading called
`Contents`. The
commits preset is a default of every repository, with a scope list gspot made up.

**Target.** `html/scripts`, `sql/block-comments`, and the README contents rule are `all`. The
postgres preset ships `client_schemas = []`, and the supabase preset sets `["public"]`. The
commits preset is proposed and not selected, as security and licenses are, and its scopes are
what `tools.commitlint.scopes` names.

**Files.** The manifests of html, sql, postgres, supabase, docs, and commits, `config/docs.ts`,
`checks/docs/readme-shape.ts`, `checks/docs/headings.ts`.

**Logic.** One README contents rule stays: a README over six sections has a list of its sections
near the top, under any heading. The banned heading list loses `Table of contents`.

**What goes.** The scopes `root`, `hooks`, and `deps` (K-40), and the second README rule.

**Tests.** The default planted install holds no commit message check. A Postgres project with no
Supabase holds no row level security finding.

**Done when.** Both pass.

## K-175: seven Vale packages and 93 rules turned off

**Partial local verification, September 20, 2026.** The prose preset owns shipped vocabulary,
package selection, styles, and the default disabled-rule policy. The CLI retains source
parsing and output handling. Generated vocabulary combines shipped and project words without
duplicates. Package readiness reads the generated Vale configuration.

All 24 focused prose and generation cases pass. Recommended-level selection, offline
recommended acceptance, and review of inherited disabled-rule reasons remain open.

**What is wrong.** The prose preset turns on seven style packages of other companies and turns 93
of their rules off, each with a reason about the text of this repository. The off list and a
vocabulary of 68 product names live in `config/prose.ts` and ship to every project.

**Target.** `recommended` runs only demonstrated defect rules of the `gspot` style, excluding banned terms and house-style judgments. `all` runs the complete style, which is what `WRITING.md` tells an
agent. `all` adds the packages. The off list and the vocabulary are data of the prose preset.

**Files.** `presets/concern/prose/manifest.toml`, `presets/concern/prose/vale.ini.tmpl`,
`presets/concern/prose/vocabularies/gspot/accept.txt`, `prose/vocabulary.ts`. Deleted: `config/prose.ts`.

**Logic.** `vale.ini.tmpl` lists `BasedOnStyles = gspot` at `recommended` with every term-ban and house-style rule disabled by level. At `all` it enables those rules and adds the
packages and the off list, which the manifest holds as a setting with its reasons. `apply`
downloads a Vale package only at `all`, so a `recommended` install needs no network.

**What goes.** The reasons that name the text of this repository. Each is rewritten as a reason
any repository shares, or the rule is turned on.

**Tests.** The prose snapshot at both levels. A planted install at `recommended` runs with the
network off.

**Done when.** Both pass.

## K-201: the shared tsconfig sets how a project builds

**What is wrong.** `tsconfig.base.json.tmpl` writes `module`, `moduleResolution`, `target`, `types`,
`verbatimModuleSyntax`, and `erasableSyntaxOnly`. Every repository that is not Next.js gets
`NodeNext`, so a Vite, Vue, or Svelte app that extends the base stops resolving its imports. The
template asks `has('nextjs')` and `has('nestjs')`.

**Target.** gspot writes no option that changes emit or resolution (D-126). The type check runs
through a generated file that extends the `tsconfig.json` of the repository and adds flags that
only add errors, as [17-recommended.md](17-recommended.md) builds it (K-74).

**Files.** `presets/language/typescript/tsconfig.check.json.tmpl`, `presets/language/javascript/jsconfig.json.tmpl`.

**Logic.** The generated file holds `strict` at `recommended`, and four more flags at `all`. `javascript/checkjs`
reads the `jsconfig.json` of the repository for resolution.

**What goes.** Six options, and the two `has(...)` branches (K-197).

**Tests.** A planted Vite app with `Bundler` resolution passes `typescript/tsc`, and its
`tsconfig.json` is unchanged.

**Done when.** That case passes.

## K-218: Semgrep packs that name the functions of one repository

**What is wrong.** The cloudflare pack passes a request body only through `validateRequestJson`.
The express pack asks for `createAuthRateLimiter` after `supabaseAuthMiddleware`. The supabase
pack reports every `createAdminClient(...)` and asks for a comment, which clears no finding.

**Target.** A shipped pack names the API of its framework and nothing else.

**Files.** `presets/platform/cloudflare/semgrep/`, `presets/framework/express/semgrep/`, `presets/platform/supabase/semgrep/`.

**Logic.** A rule that names a function of one repository moves into that repository, under
`tools.semgrep.rules`, in its migration. The supabase rule reports `createClient` with the
service role key outside `tools.supabase.admin_files`, which is a fact a fix can change.

**What goes.** Seven rules of the three packs.

**Tests.** Each planted repository holds a plain handler that reads `request.json()` through its
own validator, with no finding.

**Done when.** A search of `presets/` for the three function names finds nothing.

## K-93: defaults that assume one kind of project

**What is wrong.** A static site builds with `npm run build` into `dist`, assets live under
`assets/`, and a Swift build targets `generic/platform=iOS Simulator`. Each is a setting, and
none is detected.

**Target.** `init` detects each value, and asks where it cannot.

**Files.** `lifecycle/init/plan.ts`, `lifecycle/init/questions.ts`, and the `[detect]` tables of
the static-site, xcode, and swift manifests.

**Logic.** A setting in a manifest takes `detect`, a small table: a `package.json` script name, a
key of a config file, or an `xcodebuild -list` field. The build command is the `build` script
where one exists. The output folder is `outDir` of the Vite or Astro config. The destination
comes from the platforms of the package or the SDK of the project.

**What goes.** The three fixed defaults.

**Tests.** A planted macOS package proposes a macOS destination.

**Done when.** That case passes.

## K-230: rule files do not follow the levels

**What is wrong.** `TYPESCRIPT.md` states the house style as the standard: every type under
`types/`, no `interface`, no re-export, exact versions. At `recommended` an agent is told to do
what no check asks. `REACT.md` says a component file is kebab-case, and D-112 accepts
`UserCard.tsx`.

**Target.** A section of a rule file carries the level of the checks it describes, and the
assembler leaves out a section above the level of the repository.

**Files.** `src/rules/assemble.ts`, `src/rules/front-matter.ts`, `src/rules/lint.ts`, and the rule
files of every language and framework.

**Logic.** A heading line is followed by `<!-- level: all -->` where its rules are taste. The
assembler drops such a section at `recommended`. The lint fails a section that names a rule name of
the `all` level and carries no mark. `REACT.md` names the file after its component.

**What goes.** Nothing from the files. The text moves under marked headings.

**Tests.** A unit test assembles `TYPESCRIPT.md` at both levels and compares the headings.

**Done when.** That test passes, and `rules/lint` passes with the new finding on.
