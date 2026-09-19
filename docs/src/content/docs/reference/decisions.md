---
title: "Decisions"
description: "The decision log of the architecture, copied from the repository."
---

This document records each decision that shapes gspot, with the alternative it rejects. A
decision changes only by adding a new entry that supersedes it.

## D-01 One binary, compiled with Bun

gspot is TypeScript compiled with `bun build --compile` into one executable per platform. A
Python-only or Swift-only repository needs no Node. Rejected: an npm package, which makes Node a
requirement in every repository and made the previous design assume mise to get it there.

## D-02 The ESLint plugin hosts the JavaScript and TypeScript structural rules

The 21 rules the reference repositories wrote as ESLint rules stay ESLint rules, in
`@gspot/eslint-plugin`, so editors show them and the tested semantics survive. Rejected: one
ast-grep engine for every language, which loses editor feedback and rewrites tested code.

## D-03 Everything is an error

No warning level. A finding is an error, or the rule is off. D-119 adds two levels, so a stranger
starts with the rules that find defects. D-165 removes the baseline this decision first held: the
install in yap-swift-app wrote about 23,000 findings into files nobody read. An old repository
adopts gspot by checking the files a change touches.

## D-04 Coverage is a report

Files no preset claims are listed by `doctor`. `[coverage] strict` turns them into a failing
check for teams that want it. Rejected: coverage as the exit code of every hook, which fails on
every repository with a README until every file type has a preset.

## D-05 gspot hands every tool a file list

The file set comes from git, claims, natures and ignores, computed once. Tools that walk the
tree get a generated ignore file mirroring git's and are checked against the expected list.
Rejected: asking each tool which files it read through a listing mode and a regex, which doubled
run time and broke on tool upgrades.

## D-06 gspot downloads nothing

Amended by D-145, D-156, and D-157. gspot still ships no downloader of its own: `gspot install`
runs mise, the package manager of the repository, and uv, and `doctor` verifies the result.
Rejected: a checksummed downloader and lockfile, which re-implemented mise.

## D-07 mise is recommended, never required

gspot writes `.config/mise/conf.d/gspot.toml` when mise is present and proposes mise when nothing is.
Without it, gspot writes to the package manager the repository has. Rejected: mise as the only
runner, which fails the stranger with a plain npm repository.

## D-08 The naming engine is original code

Extractors per language and a whole-part matcher over one policy document. Rejected: compiling the policy into five tool configurations. That loses per-term messages, cross-file prefix collisions, and the reserved-term mechanism, and the reference audit judged it not replaceable as a unit.

## D-09 Whole-part matching, never substrings

A banned term matches a whole identifier part. Rejected: the reference implementation's
substring match, which made the conjunctions group fire on `spawnSync` and needed fifteen
exemptions.

## D-10 tree-sitter through WASM and ast-grep through its CLI

`web-tree-sitter` with embedded grammars for the extractors and original analyses; the ast-grep
CLI for declarative rules. Rejected: `@ast-grep/napi`, a native addon the binary cannot embed
and a second grammar registration path.

## D-11 Generated configuration is tracked

Editors and `bunx <tool>` discover it; upgrades are diffs; CI needs no bootstrap. `apply --check`
catches hand edits. Rejected: generating into an ignored directory at every run.

## D-12 Every ignore carries a reason and prints

A reason has no cap, no expiry, and no ticket field. A reason that says nothing (`N/A`, `TBD`) is
refused at load. Rejected: a ticket requirement, which the reference repositories filled with
`N/A` twelve times out of twenty-eight.

## D-13 The marketing and defensive term groups are not removable

They are what the distribution is for. Individual names take scoped exemptions with reasons.
Rejected: every group removable, which lets `enhancedHandler` back in with one line.

## D-14 stages follow requirements

A check that needs a build, a daemon or the network runs at push or manual; everything else at
commit over staged files. Rejected: per-repository stage tables, which put `swiftlint lint` in no
hook at all in a reference repository.

## D-15 A skipped check that is not a platform skip fails

Docker down, tool missing, network absent: the check fails and says so. Only a declared platform
requirement passes as skipped. Rejected: printing a warning and returning zero, which two
reference checks did during their own audit.

## D-16 The corpus starts from the merged fork and is repaired, not remerged

`reference-rules/merged/` is the base. A repair pass fixes the six substitutions, the modals and
the cross-file links. Rejected: a fresh merge from the four forks, which repeats editorial work
already done.

## D-17 Every rule statement names its check

Superseded by [D-73](#d-73-rule-files-name-no-check): the markers are gone.

## D-18 The layer boundary is enforced

General and language rule files carry no architecture. A framework file carries only what the
framework dictates. The project layer belongs to the team. Rejected: shipping one team's
ownership map and MVVM stack to strangers.

## D-19 A maintained tool wins

An original analysis exists only where the manifest records the tools searched and why none
expresses the rule. Rejected: the reference pattern of writing a careful analyzer four times.

## D-20 Limits ship at the strictest value observed

Replaced by D-119 and D-126.

## D-21 preset names are bare names

`typescript`, not `language:typescript`. The kind is a field. Rejected: kind prefixes in every
id, which nobody typed correctly and which the folder name already says.

## D-22 The inverse config-purity check is not carried

The reference check that forced every scalar-only module into a config folder produced sixty
hoisted constants and three duplicates. gspot keeps the forward check (config files hold no
logic) only.

## D-23 Seven commands in v1

Replaced by D-131.

## D-24 No environment variables turn checks off

Skips live in `gspot.local.toml` and print. Rejected: sixteen `SKIP_*` variables, one of which
turned off four scanners at once.

## D-25 The hook finds gspot through the runner

The hook body calls the runner's exec (`mise exec`, `bunx`) or an absolute path written at
install. Rejected: `exec gspot`, which assumes `PATH`.

## D-26 Prose and identifiers share one vocabulary

The tool and product names in the shipped vocabulary are accepted by both the naming policy and
the Vale style. Banned words are not shared. The naming policy's groups ban what dates or hedges a name (`new`, `custom`, `fallback`, `should`), and those words are plain in prose. The Vale rules `marketing` and `hedging` carry the prose bans. Amended by [D-72](#d-72-the-prose-gate-keeps-the-corpus-ceilings-and-turns-off-the-upstream-rules-that-contradict-the-corpus).
Rejected: one banned list for both, which flagged `an advanced guide` and `a new file`.

## D-27 gspot lints gspot with no ignores

A rule too strict for the code of gspot itself is fixed in the code or changed for everyone. Rejected:
an exemption block for the distribution, which is how a reference lint package ended up on
`eslint:recommended` plus six rules.

## D-28 One tool per job

Where two tools do one job, the one that runs in the editor, covers more surfaces, or hosts the
repository's own rules stays. Cut: lizard, madge, type-coverage, sort-package-json, pip-audit,
bandit, interrogate, bearer, and two analyses gspot had written for jobs lychee and syncpack
already do. basedpyright replaces pyright. Every rule a cut tool enforced is re-pointed in the
ledger. Rejected: keeping every tool the reference repositories ran, which means two
configurations and two exception lists per defect.

## D-29 Private first, public last

In every language, private declarations precede public ones in a file; `main` and `__all__`
come last. Python and Bash mark private with `_`; the other languages use their visibility
keywords. Rejected: public-first ordering, which several style guides prefer. The contract is what a reader wants at the end, after the parts it is built from.

## D-30 Types live under `types/`

Type aliases live under the declared types directory; `interface` is banned; the directory
holds type-only imports and no runtime exports. On by default, strict everywhere, exceptions
through `[[ignore]]`. Rejected: co-located types, which spread a contract across every file
that uses it and which agents extend in place.

## D-31 native on Windows

The binary, `check`, `apply`, `doctor` and the hooks run natively on Windows; CI tests it.
Rejected: Windows Subsystem for Linux (WSL) only, which excludes a stranger's machine for a reason gspot has to fix.

## D-32 Every setting has a writing command; hand edits stay valid

`ignore`, `add`, `remove`, `allow`, `set` and `declare` write `gspot.toml` through one writer
that keeps comments and order, validates as load does, and runs `apply`. A hand edit produces the
same file. Rejected: no writing command at all, which an earlier design held and which made the first customization a TOML lookup. Also rejected: hiding decisions behind commands. The required reasons and the tracked file prevent that, because every command's output is a line in `gspot.toml`.

## D-33 Install policy is part of the gate

A minimum release age of seven days and an install-time security scanner, where the package
manager supports them, are checked like any other setting. Rejected: leaving supply chain settings to each repository, which two of four reference repositories had set and two had not.

## D-34 Every finding links to its documentation

A finding carries the check name and a URL under `docs/rules/`; `explain` prints the same page.
Rejected: messages alone, which leave a person searching the source of the rule.

## D-35 Cyclomatic and cognitive complexity are two limits

`cyclomatic_complexity` (ESLint `complexity`, Ruff `C901`, SwiftLint `cyclomatic_complexity`,
the shell branch count) and `cognitive_complexity` (sonarjs) measure different things and ship
as two keys with two defaults. Rejected: one key mapped to whichever rule a language has, which
made the JavaScript number a cognitive score and the Python number a cyclomatic one under one
name.

## D-36 `init` installs the tools it pins

After the yes, `init` runs the runner's install step so the first `check` runs every tool.
`--no-install` opts out. Rejected: writing pins and leaving the install to the person, which
made the first run a wall of `missing`.

## D-37 `add`, `remove` and `why`

Three commands join `ignore` as the ones that touch `gspot.toml` or explain it: `add` and
`remove` change the preset list with the same validation and re-render, `why` explains one file.
Rejected: hand edits for every preset change, which a stranger gets wrong in the same ways the
ignore table was got wrong.

## D-38 One license mode, exceptions name the license

The license checks run in allow mode only. A package passes when its reported license is on the allowlist. It also passes when an exception names that package at that exact version, with the license it reports, and a reason. Rejected: the exclude mode two reference repositories also ran, which lists packages to
skip without saying what was accepted and so cannot notice a license change at the same version.

## D-39 `explain` covers a tool's rule, not only a gspot check

`gspot explain <tool>/<rule>` prints the rule's summary, the check that runs it, the `gspot
ignore` line that turns it off and the `gspot set` line that changes its options. The finding
line prints the command. `explain` also takes a check name, a preset name and a setting name, so one
verb answers "what is this" for everything gspot has a name for. Rejected: a link to the tool's
documentation alone, which answers "what is it" and not the question of changing it here.

## D-40 Every tool has an `extra` passthrough

`[tools.<name>.extra]` renders verbatim into the tool's configuration with a required reason,
prints every run, and is reported by `upgrade --check` when a slot arrives for one of its keys.
A person writes it; `init` does not (D-46). Rejected: failing on unknown options, which blocked
a person until a release added the slot.

## D-41 `upgrade` asks before it writes

`gspot upgrade` prints its plan and waits for a yes, as `init` does; `--yes` skips the question
and `--check` is read-only. Rejected: writing on invocation, which surprised people who wanted the
report and made a wrong version choice a revert instead of a no.

## D-42 A second `init` reports instead of writing

`init` on an installed repository refuses. What changed in the repository after the install is reported, with the `add`, `declare` or `apply` command that applies each difference, and
nothing is applied without that second command. Rejected: re-running the full init, which cannot
tell a deliberate omission from a new arrival and overwrites one to serve the other.
Superseded by D-45 on where the report lives: `doctor`, not an `init` flag.

## D-43 Copied project templates carry their origin version

Replaced by D-134, because project templates were never built.

## D-44 One way to turn a rule off

A rule inside a tool is turned off by `gspot ignore <check> --rule <rule>` with no paths, which
writes an `[[ignore]]` entry, the same shape as a path-scoped ignore. A tool slot
(`[tools.eslint.rules]`) holds options and rules turned on and refuses `off`. Rejected: both
forms, which the first draft of this folder allowed and which put "what does not run" in two
tables with two reason conventions.

## D-45 `doctor` absorbs reconcile; `apply` absorbs `rules`

`doctor` prints what changed in the repository after `init`: languages and frameworks that appeared, configuration files not owned, or hooks or CI changed by hand. Each line carries the command that applies it, beside the tool and coverage report `doctor` already printed. `apply` installs the rule
files and the managed blocks, `apply --check` reports their drift, and
`apply --project-templates` copies templates once. Fourteen commands, fifteen with D-55. Rejected: `init
--reconcile` and `rules`, which printed or wrote a subset of what `doctor` and `apply` already
covered, so a person had two commands to remember for one question.

## D-46 Takeover replaces; it carries exception lists only

Replaced by D-109 and D-150.

## D-47 Static output, one library per job

Every command prints lines; `--json` prints a documented object. The only interactive moments
are the questions `init` and `upgrade` ask through `@clack/prompts`, skipped under `--yes`, `CI`
or no terminal. commander parses and writes help; picocolors colors; zod validates; smol-toml
reads and `@decimalturn/toml-patch` writes `gspot.toml`; `consola` carries messages on stderr.

The full table, one library per job, is in [12-repository-layout.md](https://github.com/stefanionescu/gspot/blob/main/architecture/12-repository-layout.md); what gspot writes itself is listed under it. No terminal UI framework, table renderer, or logging framework. Rejected: a rendered interface, which agents cannot read,
CI cannot show, and which no linter people already trust has.

## D-48 Limits and naming ceilings are per language

`[limits]` and `[naming]` keys apply to every language at the root and can be overridden under a
language table (`[limits.python]`, `[naming.swift.parameters]`). The shipped per-language
defaults are the strictest observed (D-20). Rejected: one number for every language, which made
a Python module limit and a TypeScript file limit the same setting and forced a repository to
loosen both to loosen one.

## D-49 The repository pins its gspot version

`.gspot/version` and the runner surface pin one gspot version per repository. A binary of another
version refuses `check`, `apply` and the writing commands with the two remedies. A global install
exists to run `init`; after that, the hook, and the runner resolve the pin. Rejected: whatever
version is on `PATH`, which makes two people on one repository run two rule sets and makes an
upgrade happen by accident.

## D-50 every check explains itself in plain English

Each check carries `summary`, `why` and `fix`, written for a person who does not code, validated
non-empty at load, printed by `explain` and the finding line, and rendered into `docs/`. The prose, help strings and docs of gspot itself pass the prose engine and a readability ceiling in its own gate.
Rejected: messages alone plus the tool's website, which assume a reader who already knows what a
barrel file or a call-through is.

## D-51 The writing commands also remove, and lists append

`ignore`, `allow` and `declare` take `--remove`; `set` takes `--default` and, for lists,
`--replace` and `--remove`, appending otherwise. One entry per command; bulk edits are a hand
edit followed by `apply`. Rejected: write-only commands, which made the second edit to any entry
a TOML lookup, the thing D-32 removed for the first edit.

## D-52 The npm package is a launcher over per-platform packages

The `gspot` npm package lists one package per platform as `optionalDependencies`, each gated by
`os` and `cpu` and holding the compiled binary; its `bin` runs the one that installed. This is
how Biome and ast-grep ship. Rejected: a wrapper that downloads the release asset at install,
which fails behind proxies, under `--ignore-scripts` and offline, and runs code at install time.

## D-53 `gspot.toml` has a published JSON schema

`gspot.schema.json` is generated from the zod schema with `z.toJSONSchema`, published with each
release and submitted to SchemaStore; `init` writes the `#:schema` line. Editors and taplo then
validate the file as they do `mise.toml`. Rejected: validation only at load, which tells a person
about a typo after they saved and switched windows.

## D-54 Where a tool has its own baseline, gspot drives it

Replaced by D-165.

## D-55 Completions come from `tab`, in v1

`gspot completion <shell>` prints the script `@bomb.sh/tab` generates from the commander tree
for bash, zsh, fish, and PowerShell. Rejected: a hand-written completion command, which is why the
feature sat in v1.1.

## D-56 qlty, Trunk and MegaLinter are prior art, never dependencies

They validate the shape (init, check, pinned tool versions, one config) and their docs and
descriptors are read when a preset is written. None is run or embedded: qlty is Fair Source and
downloads its own tools, Trunk is closed, MegaLinter is Docker-only. [15-prior-art.md](https://github.com/stefanionescu/gspot/blob/main/architecture/15-prior-art.md)
records what each taught. Rejected: building on qlty's plugin catalog, which its license forbids
for a tool in the same space.

## D-57 Migration is the owner's step; gspot lists, the person deletes

`init` replaces what it owns and lists what it can prove redundant without reading code. That list holds a directory nothing in the gate references, a hand-written hook directory, a manifest whose dependencies are all tools gspot pins, and a pin gspot also pins. `doctor` keeps listing them.

Tasks,
rule directories and documentation are the person's to judge; the migration document walks them
for the reference repositories, and the ledger is the proof for checks. Rejected: `init` deleting those itself, which destroys code it cannot prove it replaced. Also rejected: `init` reading task bodies or rule files to decide what is redundant. That is a heuristic per repository shape and the kind of code this design refuses.

## D-58 Formatting is asked, never imposed

When a repository's formatter configuration differs from the shipped `[format]`, `init` asks
one question, `--format keep|shipped`, and `--yes` keeps the repository's values. Whatever is
chosen is written to `[format]` and can be changed with one `gspot set`. Rejected: always shipping 4 spaces and 120 columns, which reformats a stranger's whole repository on the first commit and buries the real diff. Also rejected: always keeping. That never lets a repository converge on one style, and it contradicts D-20 for the one setting where "strictest" has no meaning.

## D-59 The file set is what git tracks or is about to track

`git ls-files --cached --others --exclude-standard`: tracked files plus files git is about to track,
minus what `.gitignore` excludes. A file the developer created and has not staged is checked by
`gspot check`, so a whole-tree pass is a promise the commit hook keeps. Rejected: tracked files
only, which passed a whole-tree run and then failed the pre-commit hook on the new file the run
never saw.

## D-60 The literals of gspot live in `packages/cli/config/`

The regexes, pattern lists, marker strings, header templates, refused reasons and file-tag table
gspot ships in code live in one directory of literal-only modules. The check `integrity/config-purity` guards it in the gate of this repository through the `config` role in its `gspot.toml`. The `gspot.toml`
schema and writer live in `src/policy/`, so `config` means one thing. An algorithm's own constant
stays inline (D-22). Rejected: literals scattered through the engines, which is what the reference
audit found and what made a regex change a hunt; rejected: hoisting every constant, which D-22
already refused.

## D-61 one release, whole

v1 is Phases 0 through 6. Rejected: the earlier cut that shipped after Phase 4 and deferred prose, the corpus, and CodeQL. That handed every early adopter a second migration when the agent rule files arrived. It also put the part of gspot that makes it more than a linter runner into "later."

## D-62 Build order follows the two goals

Replaced by D-121.

## D-63 Templates render through `eta`

Every `*.tmpl` under `presets/` renders through `eta`, one maintained template engine for JS, JSON,
TOML, YAML, INI, and Vale output alike. Rejected: a placeholder renderer written for gspot, which is a
template engine with fewer tests and one more thing to document.

## D-64 The reference ESLint rules have no tests upstream

No test file exists beside any reference `quality/` ESLint rule. The rule tests in
`packages/eslint-plugin/tests/rules/` are written new from each rule's semantics and messages. The port is checked by running the reference plugin and the gspot plugin over one planted scope and comparing findings. Rejected: skipping the tests because the reference had none, which leaves
twenty-six rules with no fixture.

## D-65 The hook in this repository resolves the development binary through `GSPOT_BIN`

Until a release exists, `mise.toml` in this repository sets `GSPOT_BIN` to run the CLI from
source with Bun, and the hook body already reads `${GSPOT_BIN:-gspot}`. Once the first tag
exists, `.config/mise/conf.d/gspot.toml` pins gspot through `ubi:` like any other repository and the
environment entry goes. Rejected: a special case in `init` for this repository.

## D-66 One naming scheme for the packages

The launcher on npm is `gspot`. Every other package is scoped. `@gspot/cli` is the private workspace package that builds the binary. `@gspot/eslint-plugin` is published, and the flat config registers it under the plugin key `gspot`, so rule names stay `gspot/<rule>`. `@gspot/cli-<os>-<arch>` are the platform packages. Rejected: the mixed set the first draft had
(`gspot-cli`, `eslint-plugin-gspot`, `@gspot/cli-*`), three conventions for one project.

## D-67 `security/detect-non-literal-regexp` is off

The rule flags every `RegExp` built from anything but a literal, at the constructor, with no way
to say where the pattern came from. A tool that compiles patterns its manifests and options declare (the gspot runner, the glob options of its ESLint rules) cannot pass it. Application code hits it on every pattern read from configuration. The risk it names, a pattern from untrusted
input that backtracks, stays covered: `regexp/no-super-linear-backtracking`,
`sonarjs/super-linear-regex` and `security/detect-unsafe-regex` check every literal, and a
manifest pattern is compiled once at load. Rejected: an `[[ignore]]` in this repository, which D-27 forbids, and a per-path exception in the shared config, which every repository then copies.

## D-68 The names inside gspot follow the naming policy, so `sync` is `apply` and `render/` is `emit/`

The naming groups in `presets/naming/policy.json` bind the identifiers, files, directories, setting names and architecture documents of gspot, with no group removed, and no allowance. The first draft of the file tree and the CLI carried banned parts; they were renamed rather than allowed:

- the `sync` command and everything named after it became `apply` (`gspot apply`, `apply --check`, `apply --baseline`, the `gspot:apply` task and script);
- `src/render/` became `src/emit/`, and the `render*` functions and `*Render` types took names that say what they produce;
- `policy/load.ts` and `presets/load.ts` became `read.ts` (verbs-strict bans `load`);
- `presets/catalog.ts` became `listing.ts` (containers bans `catalog`);
- `[hooks] manager` became `[hooks] tool` (roles bans `manager`);
- `format.final_newline` became `format.newline_at_end` (marketing bans `final`);
- the `support` role became `harness`, `gspot/no-support-in-dirs` became `gspot/tests-directory-contents` and `gspot/no-tests-support-imports` became `gspot/no-harness-barrel-imports` (roles bans `support`);
- `ScopeInfo` became `ScopeEntry`, and `resolveSetting` became `settingValue`;
- `src/rules/corpus-lint.ts` became `lint.ts` (containers bans `corpus`).

Strings that name another tool's option (`withFileTypes`, `useWith`, `semver.coerce`, `insert_final_newline`) are calls into that tool, not declarations, and stay. The default path of the `harness` role is `tests/harness/**` for the same reason: `tests/support/**` puts a banned word in every repository's tree. Rejected: a `naming.allowed` entry for `sync` in the policy of this repository, which every reader then takes as the precedent for their own.

## D-70 The reference corpora and their completeness check are gone

`reference-rules/` held the merged corpus, the four source corpora's completeness check with
its dropped-statement records, the marker map, and two maintenance scripts. The merge is done
and the state is recorded in [09-rules.md](https://github.com/stefanionescu/gspot/blob/main/architecture/09-rules.md), so the folder is
deleted: the corpus lives in `rules/`. Rejected: keeping the completeness
check running against repositories outside this one, which made the gate of this repository depend on four other checkouts.

## D-69 The naming engine over the gspot code: what was renamed and what the engine leaves alone

Running `naming/identifiers` over gspot with the shipped policy found four kinds of names. Each
was resolved by renaming or by a clarification of the policy that holds for every repository,
never by an allowance.

Reserved terms: `config` stays reserved for the four configuration uses, so functions and types say the whole word (`configurationName`, `FormatSettings`, `ConfigurationTarget`). `data` in the vague sense became `parsed` or `inputs` (`TemplateInputs`). A `message` variable or parameter became `text`, because the `message` property of a finding is the named use. `values` became `items`.

Ceilings: the ESLint rule `only-tests-in-test-dirs` became `tests-directory-contents` (five words is over the file ceiling), and the option types of four-word rules dropped their `No` prefix (`CrossFolderImportsOptions`).

Contract shapes: a property signature written in snake_case or UPPER_SNAKE is a shape another format fixes, so it is exempt from the case check (the TOML keys in `types/config.ts`). The reference extractor had the same rule. Not declarations: declaration files, import bindings and the keys and methods of object literals are not extracted, because the names belong to another module or another party's contract. The `test` group applies in non-test code only, as [08-naming-policy.md](https://github.com/stefanionescu/gspot/blob/main/architecture/08-naming-policy.md) says.

Rejected: a `naming.allowed` list for the gspot code, and widening the reserved uses of `config` to types and functions, which makes the reservation say nothing.

## D-71 The folder checks judge code, and what gspot installs is generated

Recorded 2026-09-18, when the markdown preset made every `.md` file a claimed file and the
self-lint reported the rule corpus. The directory analyses (`single-file-folder`, `prefix-collisions`, `file-directory-collision`, `folder-names`) skip documents (`.md`, `.mdx`) and everything under `.gspot/`. One page per topic in its own folder is the corpus layout [09-rules.md](https://github.com/stefanionescu/gspot/blob/main/architecture/09-rules.md) fixes. `rules/general/code/NAMING.md` beside `NAMING-FILES.md` is a topic and its sub-topic, not a prefix collision. Files gspot installs under `.gspot/rules/` have the nature `generated` (source `gspot`), and the Vale packages under `.gspot/vale/styles/` are `vendored`. No check then reports what only gspot can change, and `apply` never removes a package file as a stray.

Three smaller rules landed with it:

- the naming policy strips a two-digit ordering prefix from document names (`01-product.md`), treats the numeronyms `i18n`, `l10n` and `a11y` as words, and exempts the `ADVANCED.md` the docs template names;
- `integrity/stale-paths` counts a slash token as a path only when its first segment is a tracked top-level entry or it ends in a file extension (`feat/order-export` is a branch);
- `docs/readme-shape` asks the root README and each scope's README for a getting-started section, and a folder README only for one H1 and an opening paragraph.

Rejected: allowances in `gspot.toml` for the corpus folders, which repeat in every repository that installs it.

## D-72 The prose gate keeps the corpus ceilings and turns off the upstream rules that contradict the corpus

Replaced by D-151.

## D-73 Rule files name no check

Recorded 2026-09-18, on the user's call. Every rule statement carried a trailing marker
(`enforced-by: <check>` or `unenforced`) and a map beside the corpus kept them current. That
tied the text an agent reads to the tool set gspot happens to run, and it said nothing a reader
of the rule needs. The markers, the map, the count files, the scripts that wrote them, and the lint that required them are deleted. A rule file states the rule; the ledger records what the gate enforces.

Supersedes [D-17](#d-17-every-rule-statement-names-its-check). Rejected: keeping
the map without the markers, which is the same coupling one file away.

## D-74 The commits preset writes the conventional rules itself

Recorded 2026-09-18. The rendered `commitlint.config.cjs` carries the conventional rule set in
full instead of extending `@commitlint/config-conventional`. An extended package has to be
resolvable from the configuration file, which fails when mise installs the commitlint binary
outside a `node_modules` tree. The file is CommonJS so it loads under any `package.json` type.

The limits follow the corpus (`GIT.md`, `COMMITLINT.md`): header 72, body line 72, the nine
types, a scope from the repository's scopes. `subject-case` refuses start, pascal, and upper
case rather than demanding one case. The commitlint `sentence-case` check rejects a subject that
names `ESLint`. The push check starts at the merge base with the upstream branch, so history
from before the preset is never judged. Rejected: `subject-max-length` 100 and
`header-max-length` 120 from a reference repository, which loosen what the corpus states.

## D-75 One TOML style: the writer's, which taplo formats to

Recorded 2026-09-18, when the config-files preset first ran over this repository. The
`gspot.toml` writer emits compact brackets (`["bash", "spelling"]`, `{word = "udid"}`) and
one-line arrays. The rendered taplo configuration formats to the same: no padding inside
brackets or inline tables, and arrays never expanded or collapsed. A hand edit and a written
entry then agree, and `config-files/toml-format` passes over the file the writer owns.

Two more choices landed in the same preset. Schema loading is off in the taplo configuration,
so the commit stage stays offline and the schema check is v8r's at push. zizmor reports in its
GitHub format, which puts the file, the line, and the audit on one line. Rejected: padded
brackets, which taplo cannot be told to add; and excluding `gspot.toml` from the format check,
which D-27 forbids.

## D-76 The suppressions flag appears only when the file exists

Recorded 2026-09-18, with the ESLint suppression baselines (D-54). ESLint exits with an error
when `--suppressions-location` names a file that does not exist, and a repository whose first
run had no ESLint findings has none. The `{suppressions}` placeholder therefore expands to the
flag, the path and `--pass-on-unpruned-suppressions` when the file exists and to nothing
otherwise. Unpruned suppressions never fail a check: a count that fell is the baseline model,
and `apply --baseline` prunes them. Rejected: writing an empty suppressions file at `init`,
which puts a file in every repository for the few that need it.

## D-77 One binary compares the disk with its own render

Replaced by D-129 and D-152.

## D-78 The reference pages of the manual stay source files

Replaced by D-153.

## D-79 A profile carries a policy between repositories

Recorded 2026-09-18. A profile is a TOML file with the schema of `gspot.toml`, a `profile` name,
a `selection` mode, and no entry that names a path. `gspot profile save` writes one,
`gspot profile check` validates one, and `gspot init --from` installs from one, by path, `https`
URL or `github:owner/repo`.

`init` validates the profile before it reads the repository and
prints every problem in one pass. `selection = "exact"` installs the named presets and what they
require, and nothing else. `init` copies the tables, and the repository keeps no link to the
profile. Sixteen commands. Rejected: an `extends` key, which makes every run depend on a second
file, and a user-level default profile, which makes two machines install two policies from one
command.

## D-80 `requires` is what breaks, `recommends` is what ships together

A preset requires only what it cannot run without. Every language preset requires `structure`,
which owns the limits, and recommends `naming`, `formatting` and `spelling`.

`init` selects the recommended presets unless the person clears them.
`--without`, `gspot remove` and a profile drop a recommended preset. Dropping a required one
fails with the chain.

Amends the field rules in [04-presets.md](https://github.com/stefanionescu/gspot/blob/main/architecture/04-presets.md). Rejected: keeping
the four as requirements and pointing people at `gspot ignore`. That leaves the tools installed
and the configuration written, with one ignore entry for each check.

## D-81 The rule files and the checks install apart

`init --no-checks` installs the rule files and no check (the flag form of D-130). `init --no-rules` installs the checks
and no rule file.

The rule files do not name gspot, its engines or its setting names, and claim no
enforcement. A tool may appear as a standard or as the subject of a rule. The managed block
mentions `gspot check` only when a check is selected, and `[rules] exclude` leaves files or
layers out. Amends D-73.

Rejected: one boolean for the whole corpus, which makes a library carry the accessibility and
command-line rules it has no use for.

## D-82 The build order is hardening, 5, 2, 4, 3

Replaced by D-121.

## D-83 `init` validates, writes, runs, then deletes

`init` checks every flag against its list and refuses a working tree with uncommitted changes
unless `--allow-dirty` is given. It writes the new files, runs the install and the first check,
and deletes the replaced files last. A failure before the last step leaves the old configuration in place.
Rejected: a backup folder, which git already is.

## D-84 The version has one source

`version` in `packages/cli/package.json` is the version of the binary, the plugin, and every npm
package. The build defines it into the binary. The release workflow fails when the tag differs.
Rejected: a literal in the source, which a tag does not change.

## D-85 Hooks run under Bash 3.2, and the workflow names assets by table

The hook body uses nothing newer than Bash 3.2. The workflow without mise maps the runner to the
asset name and verifies the SHA-256 against `checksums.txt`. Rejected: requiring Bash 4 for the
hook, which stops every commit on a Mac with no second Bash.

## D-86 The binary carries nothing about this repository

The corpus lint, the layer boundary word list and the corruption phrase list are a `[[check]]`
of this repository. `apply --check` reports drift only. Rejected: linting the embedded corpus in
every repository, which spends a Vale run on text the person cannot change.

## D-87 A tool row is a binary or a library

`kind = "library"` marks an npm package that is imported, not run. `doctor` reads its version
from `node_modules`. A version that differs from the pin fails `doctor`, newer or older, because
a pin that is not held is not a pin. A binary file with no secrets preset selected reads `not
checked`.

## D-88 The plugin stands alone

`@gspot/eslint-plugin` exports `configs.recommended` and matches paths with `picomatch`.
Rejected: a matcher of its own, which gives one pattern two meanings.

## D-89 File lists are batched and every spawn ends

A `{files}` expansion is split so that no command line passes 100,000 bytes, or 30,000 on
Windows. The batches of one check run in order and their findings join. Every tool run has a
timeout from `limits.tool_seconds` (default 600, a ceiling), and a run that passes it is an
`error` result that names the tool. A fixer that exits with an error is reported, not counted as
run. `check --fix --dry-run` copies the claimed files and the generated configuration, and links
`node_modules` and `.venv` instead of copying them.

## D-90 `[[check]]` is the extension point, and it can parse

A `[[check]]` entry takes `output`, with the formats a manifest has (`regex`, `grouped`, `lines`,
`eslint-json`, `none`). Rejected for v1: preset folders in the repository. A preset outside the binary is not
covered by the version pin, and the pin is what makes two repositories run the same rules.

## D-91 Code for a preset arrives with the preset

A table row, a carry reader, an allow list or a workflow job that serves a preset ships in the
commit that ships the preset. `gspot allow` lists only the lists of selected presets. The core
names no preset name: what a preset adds to the workflow, the hooks or `apply` is a key in its
manifest. Rejected: rows kept ready for later phases, which read as working features and are not.

## D-92 One word, one meaning

A word carries one meaning in the code, the setting names, the manifest keys, the flags, and the
folders. [19-names.md](https://github.com/stefanionescu/gspot/blob/main/architecture/19-names.md) holds the rules a name follows and the renames still to apply. The glossary in the
README of this folder holds the words that stay. Rejected: keeping a name because it passes the
naming policy. The policy measures length, case and banned terms, and none of those sees a word
used twice.

## D-93 Swift tests get a preset

`xctest` covers XCTest, Swift Testing and snapshot tests, as `vitest` and `pytest` cover theirs.
It checks disabled tests for a reason, sleeps, a recording mode left on, snapshot references
with no test, and coverage. Rejected: leaving tests to the five SwiftLint test rules, which see
one file at a time and no snapshot folder.

## D-94 Semgrep packs ship with their preset, and the registry stays on the network

A Semgrep pack belongs to the preset whose code it reads: `security` holds the Node and token
packs, and `express`, `supabase` and `swift` hold theirs. A `[[configs]]` row with
`needs = "security"` is written only while that preset is selected, so a pack costs nothing in a
repository that runs no Semgrep. `security/semgrep` runs the packs at push with no network.
`security/semgrep-registry` is a manual check over the registry packs in
`tools.semgrep.registry`. Rejected: vendoring the registry packs, because the Semgrep Rules
License forbids shipping them inside another tool. The reference rules `no-console-log`,
`no-ts-ignore` and `no-non-null-assertion-chain` are not carried: ESLint owns them.

A command part `{each:<flag>:<setting>}` becomes the flag and one value for every value of a
list setting. `tools.semgrep.rules` uses it to pass the repository's own rule files.

## D-95 A tool that prints JSON needs no code

`[[checks]] output` takes `format = "json"`. `items` is the dotted path to the list, `children`
is the list inside each item when findings nest under a file, and `fields` maps `file`, `line`,
`column`, `rule` and `message` to the tool's keys. gixy, squawk, sqlfluff, SwiftLint, and Ruff
all print JSON, so their presets stay data. Rejected: one parser in the binary for each tool.

## D-96 A command reads one setting by name

A command part may hold `{setting:<name>}`, which becomes the value the policy holds for that
setting. `vitest/coverage` passes its four floors to Vitest this way. Rejected: a generated
Vitest configuration, because the repository owns its `vitest.config` and a second one fights it.

## D-97 The yap-swift-app migration changes the real repository

The owner asked for the migration as part of the build. It runs on the branch `chore/gspot` of the
real repository: the old lint folder, hooks, tasks, rule files, and pins go, gspot comes in, and
`gspot check` runs over everything. Findings in the application code enter baselines and a
report, and nobody fixes them here, because the app is not the subject. A gspot defect the run
exposes is fixed in gspot. Rejected: a worktree run only, which proves the plan and leaves the
old setup in place.

## D-98 A structure check carries the name of its language

`structure/trivial-function` reads shell scripts, and one check name maps to one analysis. The
same idea over Python is `python/trivial-function`, and over Swift `swift/trivial-function`. A
repository that selects both presets runs both. Each has its own baseline and its own ignore
entries. Rejected: one id with an analysis for each language behind it, which makes one baseline
hold two languages and one `gspot ignore` silence both.

Ruff owns what Ruff already checks. `import-layout` is `E402` and `PLC0415`, and `import-boundary`
is the import contracts of `python/import-linter`, so neither has an analysis of its own.

## D-99 One check may take the work of another, and a preset names the rules it requires

`nextjs/typecheck` has Next.js write `next-env.d.ts` and the route types, then runs `tsc`. A fresh
clone holds neither file, so `typescript/tsc` alone fails there. Two type checks in one scope print
every error twice. A check may therefore carry `takes_over = "<check name>"`: in a scope that
plans both, the named check is skipped with the note `<taker> runs it here`. A taker that is
itself skipped takes nothing.

The framework command runs with `CI=1`, because Next.js otherwise installs the packages it misses
with whatever package manager it finds. The `tsconfig.json` it rewrites is put back as committed.
A check never installs anything and never leaves a tracked file changed.

`integrity/required-rules` reads a `[required_rules]` table in each manifest: a file ending, and the
ESLint rules that must be on for a file with that ending. The check asks ESLint for the resolved
configuration of one tracked file per ending (`eslint --print-config`). A rule the policy turned
off with a reason is a decision and is not reported. The first run of this check found that the
React hooks rules were never on in the nextjs preset, which is the class of defect it exists for.

## D-100 The root holds a pointer or nothing, and every written file carries its mark

Nine stubs copied the whole generated file to the root, and a JSON copy lost its mark
([20-adoption.md](https://github.com/stefanionescu/gspot/blob/main/architecture/20-adoption.md), A-1 and A-2). A root file exists only as a pointer to
`.gspot/`: `extends`, `inherit_from`, `parent_config`, or a re-export. A tool with no include form
gets no root file, because every check passes `--config` itself. A JSON file keeps the `_gspot`
key. No new setting comes with this: the nine `copy = true` stubs leave their manifests.

Rejected: copies for editor support, because the root then holds more lint files after the
install than before it.

## D-101 gspot adds to the hooks a repository has

A repository with hooks keeps them: gspot writes one managed block into each hook file it needs,
in the folder git already runs, and leaves `core.hooksPath` alone. gspot owns the hooks path only
where no hooks exist. `hooks.tool` takes the value `existing` for this form. The bare folder name
`hooks` is no hooks folder. The generated line asks the developer for no environment variable.

Rejected: the
takeover of the hooks path with a warning line in the plan, because `--yes` accepts it
unread and the hooks of a team stop without anybody choosing that.

## D-102 The slow checks move to the manual stage, and a push runs what changed

Replaced by D-122.

## D-103 init offers the fix run, and no local file hides a failure

`gspot init` runs no check (D-165). Its last lines name `gspot check` and `gspot check --fix`, and
the developer runs them when they want. `gspot.local.toml` skips a check only when its tool
cannot run on this machine, and every summary line counts the local skips.

## D-104 One baseline file, and a rise prints what rose

Replaced by D-165.

## D-105 The message run writes no record, and a build folder is no cache entry

`.gspot/last.json` stays one file in the place it has. A run of the `message` stage does not
write it, so a commit cannot replace the record of a full check. The build folder of a tool, such
as the 7 GB Swift build folder, moves to the cache folder of the platform. The verdict cache
stays in `.gspot/cache/` and drops entries older than 30 days.

Rejected: one record for each stage, which adds files to answer a defect that one condition
fixes.

## D-106 One policy file, written so a person can read it

`gspot.toml` stays the one policy, and nothing moves out of it. Two changes make it readable. A
scope setting is a sub-table, never an inline table. One reason may cover many entries, so the 36
gitleaks entries of the app become one entry for each reason. The mise file is
`.mise/conf.d/gspot-tools.toml` (D-127), so one file in a repository is called `gspot.toml`.

Rejected: exception files beside the policy, because a second file is a second place to look.

## D-107 init gets no trial form

`gspot init --dry-run` prints the plan, and git undoes an install. A trial form of init is a
second install path to build and test, and the defects of [20-adoption.md](https://github.com/stefanionescu/gspot/blob/main/architecture/20-adoption.md) are in
the first one.

## D-108 A folder with a project file is a scope, and scope files have one place

init proposes a scope for a folder that holds `package.json`, `pyproject.toml`,
`Package.swift`, or an `.xcodeproj`. A workspace member list wins where one
exists. Generated configuration for a scope lives under `.gspot/<scope>/`, and only a pointer stub
lives in the scope folder.

## D-109 Takeover deletes only a file that one tool owns, and it lists tasks

A file that more than one tool reads is never deleted: the plan names the section to remove by
hand. Task files, package scripts and make targets that call an owned tool are listed in the plan
and never edited. `uninstall` prints the commit init started from.

## D-110 Opt-in rules of taste are off unless the policy asks

Replaced by D-119.

## D-111 The prefix of a file name is its first word

`structure/prefix-collisions` and the plugin rule split a stem the way the naming engine does:
dash, underscore, dot, and case boundary. A peer is a source file that a language preset claims. A
manifest declares the names its framework fixes, and the analysis names no preset. One function
holds the split, and the plugin imports it.

## D-112 A framework preset carries its naming rules

`react`, `vue`, `svelte`, `react-native`, `nextjs` and `nestjs` each hold `[[naming.rules]]` in
their manifest. The shared policy names no framework. The init plan and `gspot doctor` say, for
each language preset, whether names are checked.

## D-113 Tests keep their fixed values in one place, and test the path a person takes

`tests/config/` holds the init command lines, the manifests, the fixture text, the tool lists and
the timeouts. One planted test installs with defaults and the mise runner in a repository of two
scopes. `toolsPath` fails with the name of the tool it cannot find. `repository-check.test.ts`
becomes `declared-check.test.ts`, and `scope-languages.test.ts` becomes `scope-presets.test.ts`.

## D-114 gspot goes where the hook already points

In five of the six reference repositories the hook is one line that calls a task. init reads what
the hook calls and proposes the gspot line there: the task first, then the hook file, then the
hooks of gspot where none exist. This amends D-101, which named the hook file only. Lines of the
task that are not lint stay. Rejected: a block in the hook file in every case, because the task it
calls still runs the old lint.

## D-115 The setup entry of the repository installs the hooks

`core.hooksPath` belongs to one clone. gspot never sets it where a tracked file sets it. With a
yes, `init` adds the one line `gspot install` to the setup entry the repository already has: a
`setup` task, a `prepare` script, or a Makefile target (D-156). An added line is no replaced
script. `gspot doctor` and `gspot check` report a clone whose config names hooks and that runs
none.

## D-116 Existing command names keep working

Where a `lint`, `format`, or `format:check` task or script exists, init proposes a new body that
calls gspot, and writes a `gspot:*` task only where no such name exists. The plan ends with what
changes for the team. Rejected: new names beside the old ones, because the README and the habits
of a team then point at dead commands.

## D-117 A table in a shared manifest is read, carried, and left in place

Takeover reads the lint tables of `pyproject.toml` and the lint keys of `package.json`, carries
what they hold, and never edits the file. The plan lists the table, the lint-only dependencies,
the workspace entry, and the duplicate pins under `remove by hand`, each with its command.
`gspot doctor` reports a tool with two configurations.

## D-118 One command shows what exists and what is on

`gspot list` prints presets in three groups and, under each installed preset, its checks with
their state. It reads the data `explain` reads. Rejected: a longer `doctor`, because `doctor`
answers what is wrong, and this answers what is there.

## D-119 Two levels, and the first install takes the smaller one

Every check and every opt-in tool rule is in the level `recommended` or in the level `all`. init
installs `recommended` and asks nothing about it. One key at the top of `gspot.toml` holds the
choice: `level = "recommended"` or `level = "all"`. A profile may name it. The banned terms are
`recommended`.

This reverses the rejection in D-03, and answers its two worries. A stranger picks nothing,
because `recommended` is what init writes. No useful rule sits behind the switch, because the
rule for sorting is fixed. A check is `recommended` when it finds a defect, a security problem,
dead code, or a name from the banned terms. A check that enforces a layout, an order, a header, or
one way to write a thing that works is `all`.

The second level is not called `strict`, because TypeScript (`"strict": true`) and JavaScript
(`"use strict"`) already own that word. It is not called `core`, which is a banned term.
Rejected: a level for each preset, because a person then answers 52 questions in place of one.

## D-120 init asks in three groups

The selection question becomes three: languages, frameworks, concerns. Each item shows one line
of description and its number of checks, and found items start ticked.

## D-121 yap-swift-app first, and the owner is asked before any other repository

The owner set this order on 2026-09-19, and amended the first form of this decision.

1. The branch `chore/gspot` of yap-swift-app is deleted, on that machine only. Nothing is pushed
   to the app, and no other branch is touched.
2. Every gap of [18-gaps.md](https://github.com/stefanionescu/gspot/blob/main/architecture/18-gaps.md) is fixed in this repository. This step ends when gspot
   checks itself with no ignore entry (D-135), and its run on GitHub is green (K-204, S-12).
3. gspot is installed in yap-swift-app from the source tree, on a new branch. The table that
   opens [20-adoption.md](https://github.com/stefanionescu/gspot/blob/main/architecture/20-adoption.md) is measured again beside the first numbers, and every
   file the install writes is read.
4. The owner is asked. No install starts in yap-text-inference, slopshop, yap-landing, or any
   other repository before the owner says so, and each one after that is asked for again. Each
   is measured against its sheet in [17-migration.md](https://github.com/stefanionescu/gspot/blob/main/architecture/17-migration.md).

Rejected: waiting for a release before the redo, because the redo is how the fixes are judged.
Rejected: a trial install in a throwaway worktree of the other repositories before step 4,
which is an install the owner did not ask for.

## D-122 gspot check is the truth, and the hooks are the fast path

| When                         | What runs                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `gspot check`                | every check over the whole repository                                         |
| the commit hook              | staged files, and the whole-project checks of a project a staged file sits in |
| the push hook                | files changed from the upstream branch, by the same rule                      |
| `gspot check --stage manual` | the checks that build, test, or scan a whole project                          |
| CI                           | what the change touches, or everything with `[ci] run = "all"`                |

Checking only what a change touches lets an old repository adopt gspot with no record of old
findings (D-165). A file is judged when somebody changes it, and a whole-project check runs in
full when a file of its project changes. A full run alone sees the
world change, such as a new advisory. `gspot doctor` prints the date of the last full run. This folds D-102 in. Rejected: a full run on every push, which
took 45 minutes in the app.

## D-123 Three commands and one setting

A developer learns `gspot check`, `gspot check --changed` and `gspot check --staged`. `--changed`
is `--since` with the upstream branch as its ref, and `--since <ref>` stays for another ref.
`[hooks] push = "changed"` is the default, and `"all"` is for a team that wants the full run on
push. Finer switches stay in `--help`. Rejected: a setting for each hook and each stage, which
gives power nobody asked for and a page of options to read first.

## D-124 A long run shows that it moves

init runs the commit stage, which is fast, and prints the command that runs the rest. It
estimates nothing. A run prints each check as it ends. A passing check prints no line unless
`--verbose` asks. The summary holds the findings, the checks, and the time of each stage. A run
that is stopped keeps the verdicts of the checks that ended.

Rejected: a time estimate before the
first run, because a guess that is wrong is worse than a command the person can time.

## D-125 An empty repository installs what needs no code

init in a repository with no source installs the presets that read no language: commits,
formatting, spelling, secrets, and the rule files. `gspot check` names a language that has files
and no preset, with the `gspot add` command. `preset-arrival.test.ts` covers the second half.

## D-126 The first install never changes a build, and house style is strict

The `recommended` level of D-119 holds no check that changes what the tools of the developer accept.
The typescript preset writes no `extends` into a `tsconfig.json` at that level, and
`integrity/tsconfig-options` is in the `all` level. The checks of K-75 and K-91 are in the `all` level too:

- exact dependency versions and the release age;
- a README in each scope and the banned headings;
- the shell script header;
- the types folder and the folder with one file.
  The banned terms stay
  `recommended`. The sentence about subagents leaves the managed block: a repository says that in its own
  part of `CLAUDE.md`.

## D-127 The mise file has one place

mise loads a second file only from a `conf.d` folder, so a file of its own is how gspot adds pins
and tasks and never edits `mise.toml`. The file is `.mise/conf.d/gspot-tools.toml` in every
repository: mise reads that folder whether or not the repository had a `.mise` folder before. One
constant holds the path. This amends D-106. Rejected: one place where `.mise/` exists and another
where it does not, which is two paths to test for no gain.

## D-128 This repository names its folders after languages, by an exception of its own

The shipped folder rule keeps its list, the language names included: it is part of the banned
terms, which stay. This repository needs two of those names, because a folder that holds the
Swift checks is called `swift`. Its own `gspot.toml` allows them under
`structure.folder_name_allowed`, with a reason. `apple/` becomes `swift/`, `pyproject/` becomes
`python/`, and the two test folders follow. Rejected: the names `apple` and `pyproject`, which
passed the check and told a reader nothing. The folders `golang/` and `cargo/` are deleted, not
renamed (D-136).

## D-129 One word for a run that writes nothing

`--dry-run` means "show what happens and write nothing" on `init`, `upgrade`, `uninstall` and
`check --fix`, and on no other command. `upgrade --check` takes that name. The six commands that
edit one line of `gspot.toml` lose the flag, because the file is tracked and `git diff` shows the
edit. Rejected: keeping it everywhere for symmetry, because no test and no guide ever used it on
those commands.

## D-130 A refusal is a `--no-` flag, never the value `none`

`--no-ci`, `--no-hooks` and `--no-runner` join `--no-rules` and `--no-install`. In `gspot.toml`
the table is absent where today it holds `"none"`. A developer still needs the refusal: a
repository with a CI of its own takes no workflow from gspot.

## D-131 A command exists when nothing else answers its question

`why` folds into `explain`, which takes a path. `declare` folds into `set`. `allow` keeps the one
list people type daily, `typos`. `profile check` folds into `init --from --dry-run`.
`doctor --settings` moves to `gspot list settings`, and `doctor` calls no network.
[02-cli.md](https://github.com/stefanionescu/gspot/blob/main/architecture/02-cli.md) holds the table.

## D-132 Baselines have a command

Replaced by D-165.

## D-133 GitLab beside GitHub, and gspot owns no CI file it did not create

`--ci` takes `github` or `gitlab`. The default follows the repository: a `.gitlab-ci.yml` or a
GitLab remote, a `.github/` folder or a GitHub remote, and no CI otherwise. For GitLab, gspot
writes `.gitlab/ci/gspot.yml`, and the plan shows the one `include:` line for the developer to
add to `.gitlab-ci.yml`. gspot never edits that file. A repository whose CI already runs a lint
job is told so and gets no second job.

## D-134 A thing is built or deleted, and nothing is kept for compatibility

gspot has no release and one install, the branch in yap-swift-app, which is deleted and redone
(D-121). A rename therefore replaces the old name everywhere, and the old name is an unknown key or an
unknown flag like any other. No alias, no flag kept and marked as old, no reader for an earlier
`gspot.toml`, and no message written for one old name.

Every finding of [18-gaps.md](https://github.com/stefanionescu/gspot/blob/main/architecture/18-gaps.md) lands in one of two columns. Implement: the thing is
built, tested, and shown in a guide. Delete: the code, the flag or key, its test, and every
mention go in one change. Three kinds of thing sit in the second column until somebody asks for the first:

- a flag that parses and does nothing;
- a key that loads and changes nothing;
- a page of this folder that describes what nobody built.

The Adoption phase of the build order opens with the delete table.

## D-135 What this repository overrides for itself

gspot checks itself with every preset it selects and with no `[[ignore]]` entry (D-27). One kind
of exception is allowed: a name. The right name for a folder, a file, or an identifier sometimes clashes with the naming policy.
`gspot.toml` of this repository then allows that one name, in that one place. The reason says why
the name is right.

The forms are
`structure.folder_name_allowed` for a folder and `[[naming.rules]]` with `exclude = true` for an
identifier or a file. No other check is loosened for this repository, and no banned term group is
removed. [19-names.md](https://github.com/stefanionescu/gspot/blob/main/architecture/19-names.md) lists every exception the repository holds.

The default level of D-119 is called `recommended`. The first name, `core`, is a banned term of
the containers group, and `recommended` is the word ESLint and Biome already taught developers.

## D-136 The go, rust, django and ruby presets are deleted

Recorded 2026-09-19. The owner never asked for these presets. `ruby` joined the list the same
day, with RuboCop, bundler-audit, its rule file, and its test. `react`, `react-native`, `nestjs`,
`vue` and `svelte` stay, by the owner's word, and D-137 to D-141 say what they must hold. They came from the Phase 7
list, which an earlier pass of this folder wrote by itself and then built. None of the six
reference repositories holds Go, Rust, Django or Ruby code, so nothing proves them against a real
repository.

All four go whole, by D-134. That means the manifests, the templates, the engine code, and
the types. It also means the Go grammar, the Cargo workspace reader, the tests, the rule files,
the preset pages, and the generated reference pages. The "Delete first" table of the phases document lists the paths. A repository that holds `go.mod`, `Cargo.toml`
or `manage.py` is told that no preset reads those files, as [04-presets.md](https://github.com/stefanionescu/gspot/blob/main/architecture/04-presets.md)
already says.

A preset enters this folder when the owner asks for it, or when a reference repository needs it.
Rejected: keeping the code because it exists and its tests pass.

## D-137 The shared rules read every code file, component files included

Recorded 2026-09-19. The ESLint template applied every shared block to a fixed list of eight
endings. A `.vue` or a `.svelte` file got the rules of its plugin and nothing else. It got no line
limit, no complexity ceiling, no sonarjs, no unicorn, no security rule, no gspot rule, and no
banned syntax.
The page of the vue preset stated that as the design.

A framework preset names its component endings under `claims` in its manifest. The template
builds its list of code files from the endings of the languages plus those. Every shared block
reads that list. The Vue and Svelte parsers hand ESLint the script of a component as a syntax
tree, so the shared rules run on it as they are.

One ESLint check reads those files. `vue/eslint` and `svelte/eslint`, which copied its command
for another ending, are deleted.

Rejected: a copy of the limit rules inside each framework fragment, which is the same number in
six places.

## D-138 A framework turns a shared rule off in its manifest, with a reason, and a test holds the list

A fragment writes no `off`. A preset lists each shared rule it turns off, with the files and
the reason, in its manifest, and the template renders the list. A limit is never on it: lines
for each file, lines for each function, parameters, depth, statements, and complexity are the
same number in every framework.

One test for each framework asks ESLint for the final config of a component file and of a plain
`ts` file in the planted repository of that framework. The test fails when the two differ by a
rule that is not on the list. That test is what keeps two frameworks from drifting apart.

Three reasons stand today:

- a Nest module is a decorated class with no members, and Nest calls a handler as a method;
- `jsx-a11y` reads DOM elements, and React Native has none;
- a route file of Next.js or SvelteKit is found by its name, so it may be the one file of its
  folder.

Rejected: a comment beside a hand-written `off`, which no test can read.

## D-139 The rules of a library and of a framework live in its own preset

The same holds for every tool, not for ESLint alone. No template asks for another preset by
name. Five do today:

- the ruff template asks for pytest and django;
- the sqlfluff and squawk templates ask for supabase;
- the knip template asks for nextjs;
- the tsconfig template asks for nextjs and nestjs.

A preset changes the config of another preset in two ways only. It sets a setting the other
preset exposes, as supabase sets the SQL dialect. Or it adds a fragment.

## D-140 Type check, format, style, and names reach a component file

Each part uses a key that exists:

- `vue-tsc` takes over `typescript/tsc` in a scope that selects vue, through `takes_over`,
  because `tsc` cannot read a `.vue` file. `svelte-check --fail-on-warnings` does the same for
  svelte, and it reports the accessibility warnings of the Svelte compiler;
- Prettier reads `.vue` by itself and `.svelte` through `prettier-plugin-svelte`, which the
  svelte preset pins. Both endings join the claims of the formatting preset;
- where the css preset is selected, stylelint reads the `<style>` block through `postcss-html`;
- the naming engine reads the script block through the TypeScript extractor, with the line
  offset of the block, and the tag table learns both endings (K-128).

## D-141 Every framework preset holds every linter that exists for it, and a jest preset ships

A framework preset is never thinner than its linters allow. Each holds the recommended set of
each plugin written for it, an accessibility plugin, and the test rules of its runner:

- react: `eslint-plugin-react` recommended with `jsx-runtime`, `eslint-plugin-react-hooks`
  recommended-latest, `eslint-plugin-jsx-a11y` recommended, `eslint-plugin-react-refresh`;
- nextjs: react, plus `@next/eslint-plugin-next` core-web-vitals and its six checks;
- react-native: react, plus `@react-native/eslint-plugin`, `eslint-plugin-react-native`,
  `eslint-plugin-expo`, and `expo-doctor` at the push stage. `eslint-plugin-react-native-a11y`
  is left out, because its range ends at ESLint 8 (D-142), and its page says so;
- nestjs: `@darraghor/eslint-plugin-nestjs-typed` recommended;
- vue: `eslint-plugin-vue` recommended, `eslint-plugin-vuejs-accessibility` recommended;
- svelte: `eslint-plugin-svelte` recommended, and `svelte-check` for accessibility.

Nest and React Native test with Jest by default, so a `jest` preset ships beside `vitest`. It
holds the same ten test rules through `eslint-plugin-jest`, which also reads `bun:test` (S-8).
`eslint-plugin-testing-library` reads the test files of react, vue, and svelte, each in its own
flavor. The split of D-119 is the same in every framework. The recommended set of a plugin and the
rules that find a defect are `recommended`. A rule of layout or style is `all`.

The names of a framework are `[[naming.rules]]` of its preset (D-112):

- components in PascalCase, and hooks and composables that start with `use`;
- the kind suffix of a Nest file, and the platform suffix of a React Native file;
- the route names of Next.js and SvelteKit.

Each pin is read from the registry on the day it is written (K-206). Rejected: Nuxt, Angular,
Astro, Remix, Playwright and Cypress presets, which nobody asked for (D-136).

## D-142 gspot pins the newest ESLint that every plugin it ships supports

Decided by the owner on 2026-09-19. gspot pinned ESLint 10, and three plugins it
already shipped did not support it. `eslint-plugin-react` ends at 9.7. `eslint-plugin-react-hooks`
6.1.1 and `@tanstack/eslint-plugin-query` end at 9. The plugins D-141 adds for React and React
Native end at 9 too.

The pin is ESLint 9, at 9.39.5 on the day of this decision. `@eslint/js` follows it.
`eslint-plugin-unicorn` goes to 65.0.1, the last version that runs on ESLint 9. gspot moves to
ESLint 10 on the day every plugin it ships names 10 in its range.

The release test that asks the registry for every pin (K-206) also reads the ESLint range of
each plugin, and fails when the pinned ESLint is outside one.

Rejected: staying on ESLint 10 with `@eslint-react/eslint-plugin` and a fork of the
accessibility plugin at version 0.2.0. That path leaves React Native with no plugin for its
styles.

## D-143 Every widening takes one path

Replaced by D-165.

## D-144 One idea has one word in a setting name

The table is in [19-names.md](https://github.com/stefanionescu/gspot/blob/main/architecture/19-names.md). A list a gspot check skips ends in `_allowed`, one
folder ends in `_directory`, and a list of file globs ends in `_files`. A rule of a tool is
turned off through `[[ignore]]` and nowhere else, so `prose.disabled` goes. The option of a tool
keeps the word of the tool. A test over the manifests holds the table.

## D-145 The lint tools of gspot are tools, not dependencies of the repository

Decided by the owner on 2026-09-19.

gspot pins ESLint 9 (D-142), and today it writes that pin over the version a repository holds
(K-217). A range is replaced, so a repository on ESLint 8 moves up a major version and one on
ESLint 10 moves down. The plugins of the developer stay installed and lint nothing.

The rule: gspot never writes a lint tool into the `package.json` of the developer. The npm tools
and libraries a preset pins install into `.gspot/node_modules`, from a generated
`.gspot/package.json` and its lockfile. The generated ESLint config sits in `.gspot/`, so its
imports resolve there with no setting. Every check runs the binary under `.gspot/`. The mise
runner already works this way for the tools that have a mise installer, and this makes ESLint,
Prettier, knip, and stylelint the same.

What follows from it:

- The ESLint of the developer, its config and its plugins stay as they are. Takeover still
  lists them, and the person removes them when ready (D-109).
- The pin of ESLint is a fact about gspot. D-142 stays true, and no repository is asked to
  match it.
- `integrity/manifest-policy` has no lint package to call pinned twice, and knip has no lint
  package to ignore (K-220).
- The editor reads a root pointer, `eslint.config.mjs`, which re-exports the config under
  `.gspot/`, and the plugins resolve under `.gspot/`. gspot writes that pointer only where the
  developer keeps no ESLint config. Where they keep one, the guide on editors says how to point
  the ESLint extension at `.gspot/`.
- The type check keeps the TypeScript of the repository, because `tsc` answers for the build
  the developer ships.

Rejected: writing the pin only where the repository holds no ESLint, and refusing the install
where the major version differs. That asks a repository on the newest ESLint to move down
before it can try gspot. Also rejected: leaving a newer exact version in place, which is what
the code does today, and which runs plugins on an ESLint they do not support.

## D-146 A built-in check is one file named after its check name

One file registered 130 analyses under names of their own, and the folders of `src/` were named
after presets and package managers (K-79). A built-in check that is not structure, naming, or
prose is now one file under `src/checks/`. The folder is the first part of the check name, and the
file is the second part. `checks/registry.ts` maps the id to the function, and a unit test holds
that map equal to the manifests. The manifest key `analysis` goes, because the id is the name.

The family `integrity` keeps the checks over the policy and the files gspot writes. A check that
reads documents, dependencies, licenses, or secrets takes the family of its preset:
`integrity/docs-headings` becomes `docs/headings`, and `integrity/lockfile-fresh` becomes
`dependencies/lockfile-fresh`. A parser that several checks use sits in `src/readers/`.
[16-file-tree.md](https://github.com/stefanionescu/gspot/blob/main/architecture/16-file-tree.md) holds every move.

Rejected: a registration in each manifest that the build turns into an index, which adds a build
step to answer a question one table answers. Also rejected: folders named after languages for
this code (D-128), because `apple/` held the Xcode, the XCTest, and the Swift checks together.
D-128 still names the two folders `swift` and `python` under `checks/`.

## D-147 The launcher is the one package gspot writes into a manifest

D-145 left one point open: a repository that runs gspot through npm, pnpm, yarn, or bun needs the
`gspot` launcher in its `devDependencies`. The launcher is the tool the developer chose, and it
is no lint tool, so gspot writes that one line at `init` and removes it at `uninstall`. It writes
no other package, no `prepare` script, and no pin of a tool. The hooks are installed by the setup
entry of the repository (D-115). Rejected: a global install only, which leaves a clone with no
way to get the version the repository pins.

## D-148 The type check extends the config of the repository and never edits it

The typescript preset wrote `extends` into the `tsconfig.json` of the developer and set options
that change emit and resolution (K-74, K-201). gspot writes `.gspot/tsconfig.check.json`,
which extends the file of the repository and adds flags that only add errors: `strict` at
`recommended`, and three more at `all`. `typescript/tsc` runs through that file. Where the file
of the repository holds `references`, the check builds them as they are. Rejected: a shared base
the developer extends, because a Vite, Vue, or Svelte app then stops resolving its imports.

## D-149 An idea is written once, and each language lists it under its own id

The trivial-function, call-through, and duplicate-function logic existed three times, with three
sets of constants. The ideas did not hold in every language alike (K-87, K-235). One
analysis holds each idea over the syntax tree, and a small table for each language names its
node kinds.

D-98 stands: the manifest of each language lists the idea under an id of its own, so
a baseline and an ignore hold one language. D-02 stands: TypeScript keeps its ESLint rules, and
one table of cases holds both implementations to the same answers.
The fix file of that row holds the table of what runs where. Rejected: moving
the TypeScript rules into the structure engine, which loses what an editor shows.

## D-150 A manifest holds every fact about its preset, and takeover carries both ways

The CLI named presets, tools, and check names in tables of its own (K-38, K-39). Every such fact is
a key of a manifest. The keys hold takeover rows, what is carried from an old file, the version
command, the baseline file, and the suppression comment. They also hold the page of a rule, what
a check waits for, and what detects a setting. One unit test fails a preset name, a tool name, or a check name under `src/`
outside `src/checks/`.

Takeover carries a rule in both directions (K-193): off as an
`[[ignore]]`, on as `tools.<tool>.rules`, each with its paths. For ESLint it asks ESLint itself
for the final config, and the plan lists every setting it did not carry. This replaces D-46.

## D-151 The prose preset runs the gspot style alone at the recommended level

Seven Vale packages of other companies shipped to every project, with 93 of their rules turned
off for reasons about the text of this repository (K-175). `recommended` runs the `gspot`
style alone, which is what `WRITING.md` tells an agent, and needs no network. `all` adds the
packages, and the off list with its reasons is data of the prose preset. This replaces D-72.

## D-152 A check never writes into the tree, and every file is written whole

One check ran `git clean`, one ran `git checkout`, and the site checks built into the real
output folder (K-156, K-159, K-154). A check that needs to run a generator or a build works
on a copy under `.gspot/cache/`, and compares. The push hook checks the files of the pushed commits, in place (K-70). Drift of generated files is a check,
`integrity/generated-drift`, and `apply --check` is gone (K-246). Every file gspot writes goes to
a temporary file in the same folder and is renamed, so a full disk leaves the old file whole
(K-257).

## D-153 The reference pages of the manual are built, not tracked

293 of the 309 tracked files under `docs/` were pages a script writes (K-205). The docs build
writes them first, git ignores them, and the check `docs/generated` is gone. This replaces D-78.
The check `docs/samples` keeps the hand-written pages and this folder true: it loads every config
sample and parses every `gspot` command a document shows (S-11).

## D-154 A rule file installs because a manifest lists it, and follows the level

The assembler installed three general folders by name, and six rule files were installed by
nothing (K-179, K-232). A rule file installs because a selected manifest lists it, and an
entry may carry a `when` table, as `[detect]` does. A section of a rule file carries the level of
the checks it describes, and the assembler leaves out a section above the level of the
repository (K-230). A good example in a rule file passes the linter of its preset (K-261).

## D-155 A repository check names its inputs

A `[[check]]` was cached on the files its `paths` name, and its command read more, so a failure
outlived its cause (K-69). `paths` says when the check runs. `inputs` says what it reads, and the
cache key holds those files. A check with no `inputs` is never cached.

## D-156 `gspot install` sets up one clone

A teammate who clones a repository that uses gspot had no way to get the lint tools and the
hooks. D-145 took the `prepare` script away, and `apply` only writes files (D-132). The command
is `gspot install`, the word a developer already knows from `npm install`, `mise install`,
`lefthook install`, and `pre-commit install`. It installs the mise tools, `.gspot/node_modules`,
`.gspot/.venv`, and the hooks of this clone. It writes no tracked file, and it is safe to run
twice.

`init` and `upgrade` end by calling it, and `--no-install` skips it. The CI job of gspot runs it
as its one setup step. A clone that is not set up never fails without a word: `gspot check`,
`gspot doctor`, and a missing tool each print `Run: gspot install`.

Rejected: `check` installs what it misses, because a lint run that downloads packages breaks
offline and in CI and surprises the person who ran it. Also rejected: a guide with two commands
to copy, which every team then wraps in a script of its own.

## D-157 Python tools install under `.gspot/` with uv

The Python tools had no home without mise, after the `uv` runner left (K-240). They install the
way D-145 installs the npm tools: from a generated `.gspot/pyproject.toml` and its `uv.lock`,
into `.gspot/.venv`. uv is the one host tool a Python repository needs, and gspot writes nothing
into the `pyproject.toml` of the developer (D-117). Rejected: the `pipx` backend of mise alone,
which leaves a Python developer without mise with every Python check missing.

## D-158 Before the first release, a repository installs from a local registry

The redo of yap-swift-app comes before any release, and `.gspot/package.json` needs
`@gspot/eslint-plugin`, which is on no registry. The `verdaccio` registry of the test harness
serves the launcher, the platform package, and the plugin. The variable `GSPOT_REGISTRY` points
`gspot install` at it, and no tracked file holds the address. The variable goes with the first
release, as `GSPOT_BIN` does (D-65). Rejected: a packed file under a `file:` path, which writes a
path of one machine into a tracked file. Also rejected: a public prerelease, which cannot be
undone and needs the npm name settled first (K-121).

## D-159 After the first release, a rename ships with its rewrite

D-134 rests on two facts: gspot has no release, and it has one install. From the first release
on, `gspot upgrade` rewrites a renamed key of `gspot.toml`, and its plan lists each rewrite.
The `version` key of the file moves only for a change `upgrade` cannot rewrite. A removed flag
stays an unknown flag, and its message names what took its place for one major version.

## D-160 Every check and every rule turns off and on from the command line, one way each

Two keys turned the same thing off: `tools.<name>.enabled = false`, and an `[[ignore]]` with no
rule. One command, `gspot allow`, was a second way to write a list that `gspot set` writes. And
nothing turned one check of the level `all` on in a repository that stays at `recommended`.

| A developer wants to                        | The one way                                         |
| ------------------------------------------- | --------------------------------------------------- |
| turn a check off, everywhere or for paths   | `gspot ignore <check> [--paths ...] --reason "..."` |
| turn one rule of a tool off                 | `gspot ignore <check> --rule <rule> --reason "..."` |
| turn either back on                         | the same line with `--remove`                       |
| turn on one check above the level           | `gspot set extra_checks <check>`                    |
| turn on, or set the options of, a tool rule | `gspot set tools.<tool>.rules.<rule> error`         |
| turn everything on                          | `gspot set level all`                               |

`tools.<name>.enabled` goes. A tool whose every check is ignored whole is not installed.
`gspot allow` goes, and the help line of a spelling finding prints the `gspot set` line that adds
the word. `extra_checks` is a list of check names at the top of `gspot.toml`, and a check it turns
on takes the widening step (D-143). Four commands write the config: `ignore`, `set`, `add`, and
`remove`. Rejected: a pair of commands `on` and `off`, which names a third way beside `ignore`
and `set` for what those two already do.

## D-161 A setup travels as an exported profile, and the profile carries what names no path

`gspot export <file>` writes a profile from the repository, and `gspot init --from` starts a
repository from one: a file, an `https` address, or `github:owner/repo`. The noun command
`gspot profile` with its one verb goes. A profile carries the level, the presets,
`extra_checks`, the limits, the naming lists, and the format. It carries the options and the
rules of each tool, and the choices for hooks, CI, runner, and rule files.

It also carries every `[[ignore]]` that names
no path, because a rule a team turned off everywhere is part of its setup. An entry that names a
path stays behind, and `export` prints each one it left out. A profile is a starting point and
no link: the repository does not point back at it (D-79).

## D-162 A tool that keeps its own baseline keeps it under one name form

Replaced by D-165.

## D-163 One word for the name of a thing, and `--dry-run` wherever many lines change

The documents said check id, preset id, rule id, and setting key for one idea. Each is a name: a
check name, a preset name, a rule name, a setting name. Usage lines show the thing alone, as git
shows `<branch>`: `gspot ignore <check>`, `gspot add <preset>`, `gspot set <setting> <value>`.
The manifest key `id` of a preset and of a check becomes `name`, as a tool already has.

`--dry-run` exists on every command that changes more than one line: `init`, `install`, `apply`,
`baseline`, `add`, `remove`, `upgrade`, `uninstall`, and `check --fix`. This amends D-129. `ignore`
and `set` change one line of a tracked file, and `git diff` shows it.

The findings of the baseline are listed by `gspot list baseline [<check>]`, beside
`gspot list settings`. No command has a `--held` flag, and no global flag prints licenses: the
notice ships as a file beside the binary and in each package.

## D-164 A reason is optional, and a repository may require it

This amends D-12. An `[[ignore]]` and a loosened setting may carry a `reason`. A reason prints with
`--verbose` and travels in a profile. By default gspot requires no reason, so turning a rule off
is one short command.

`require_reasons = true` at the top of `gspot.toml`
brings the old rule back for a team that wants it, and this repository sets it. With that key, a
reason that says nothing, such as `N/A` or `TBD`, is refused. The same key decides whether
`integrity/suppressions` asks a suppression comment in the code for a reason.

## D-165 gspot has no baseline, and installing it runs no check

Decided by the owner on 2026-09-19. gspot manages the lint tools and the rules of a repository.
It does not decide when a developer lints, and it blocks nobody.

- `gspot init` detects, writes the config, and installs the tools. It runs no check, so an
  install takes as long as the downloads take. The same holds for `gspot add`, `gspot upgrade`,
  and `gspot set level all`: each turns checks on and runs none.
- Nothing records old findings. `.gspot/baseline.json`, the baseline a tool keeps itself, the
  command `gspot baseline`, the check `integrity/baselines-current`, and the widening step are
  gone. `gspot check` reports what it finds today, and nothing else.
- An old repository adopts gspot through what already exists. The hooks and the CI job check the
  files a change touches (`--staged`, `--changed`). The level `recommended` keeps taste out.
  `gspot ignore` turns a check or a rule off. `git commit --no-verify` and `git push --no-verify`
  pass a hook, and the failing run names them.
- The developer decides when to run `gspot check` over the whole repository, and when to run
  `gspot check --fix`.

This replaces D-54, D-104, D-132, D-143, and D-162, and amends D-03, D-103, and D-122. Rejected:
a baseline that falls and never rises, which made the first install run every check and write
hundreds of counts that nobody reads.

## D-166 `check` takes paths, and a repository can leave a folder out

`gspot check` took a check name as its argument and had no way to read one file. ESLint, Ruff,
Prettier, and Biome all take paths there, so gspot does too: `gspot check src/app.ts docs` reads
those files and folders. A scope is a folder, so `gspot check api` reads one project of a
monorepo, and `--scope` leaves `check`. One check is `--only <check>`, the pair of `--skip`. Every
flag composes with a path: `gspot check api --changed --fix`.

`exclude` at the top of `gspot.toml` lists folders and files gspot never reads. `init` detects
each project of a monorepo (D-108) and asks which to take. A project the developer leaves out
goes into `exclude`, and `gspot set exclude --remove <path>` brings it back. Rejected: an
`[[ignore]]` for each check of the folder, which is fifty entries for one wish.

## D-167 gspot never takes a hook of a repository away

The first design wrote hooks into `.gspot/hooks/` and pointed `core.hooksPath` there. That setting
turns every file under `.git/hooks/` off without a word: a hook a developer wrote for one clone,
and the four hooks git-lfs installs. The rule is that gspot adds one line and takes nothing.

| The repository has                                         | Where the gspot line goes                              |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| a hook tool: husky, lefthook, pre-commit, simple-git-hooks | the config of that tool, as one managed block (K-275)  |
| tracked hooks that `core.hooksPath` points at              | the task the hook calls, or else the hook file (D-114) |
| hooks under `.git/hooks/`, in this clone alone             | the end of that hook file, as one managed block        |
| no hooks                                                   | a new `.git/hooks/pre-commit` and `pre-push`           |

gspot never sets `core.hooksPath`, and the folder `.gspot/hooks/` is gone. The first two rows
are tracked, so `init` writes them once. The last two live in one clone, so `gspot install`
writes them in each clone, as `lefthook install` and `pre-commit install` do. `gspot uninstall`
removes its block and leaves the rest of the file. This amends D-101 and D-115.

## D-168 A run over changed files reports findings in those files alone

Some checks read a whole project: a type checker, a dead code tool, an import graph. With no
baseline (D-165), such a check reports every old problem of the project on every push, and the
developer passes the hook every time. In a run with `--staged`, `--changed`, or `--since`, a
whole-project check still reads the whole project, because it has to.

gspot then keeps the
findings in the files the change touches. The exit code comes from those alone. One line counts
the rest: `214 more findings in files you did not change (gspot check)`. `gspot check` with no
such flag reports everything.
