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

## D-03 Everything is an error; a baseline is the adoption device

No warning level. `init` records the current count per rule; `check` fails when a count rises.
Rejected: a `recommended` and a `strict` level, which makes strangers pick a level and puts the
useful rules behind a switch. Rejected: no baseline, which makes a new rule an upgrade nobody
takes.

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

Presets pin versions; mise, npm, uv, Homebrew install; `doctor` verifies. Rejected: a
checksummed downloader and lockfile, which re-implemented mise.

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

Shell function length is 40, not 100. A repository above the limit gets a baseline, not a
weaker rule. Rejected: the loosest value, which makes the limit decorative.

## D-21 preset ids are bare names

`typescript`, not `language:typescript`. The kind is a field. Rejected: kind prefixes in every
id, which nobody typed correctly and which the folder name already says.

## D-22 The inverse config-purity check is not carried

The reference check that forced every scalar-only module into a config folder produced sixty
hoisted constants and three duplicates. gspot keeps the forward check (config files hold no
logic) only.

## D-23 Seven commands in v1

`init`, `check`, `apply`, `rules`, `doctor`, `upgrade`, `uninstall`. `fix` is a flag on `check`;
coverage lives in `doctor`; the last run is a file. Rejected: fourteen verbs, half of which
printed things nobody asked for. Superseded in part: D-32 and D-37 add the six writing commands,
`why` and `explain`; D-45 folds `rules` into `apply`; D-55 adds `completion`. The count is fifteen.

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

A finding carries the check id and a URL under `docs/rules/`; `explain` prints the same page.
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
line prints the command. `explain` also takes a check id, a preset id and a setting key, so one
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

A project template copied into the project layer opens with a `gspot-template` header naming the
template and the gspot version. `upgrade --check` reports when that template changed upstream;
nothing merges it. Rejected: upgrading project files, which the project owns; rejected: no header,
which left the person unaware that the source they copied had moved on.

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

At `init`, an owned tool's existing configuration file is deleted (git keeps it; the plan prints
`git show HEAD:<path>`) and the gspot one is written. Carried into `gspot.toml`: typos words, gitleaks
allowlists and baseline fingerprints, osv ignored advisories, license exceptions, and rules
turned off, which become `[[ignore]]` entries with the reason `carried from <file> at init`.
Nothing else is read. Rejected: one loader per tool that carries every option into `[tools.<name>]` or `extra`. That is twenty loaders to write and maintain, and it preserves the old policy inside the new one, so the repository never adopts the shipped rule set. Rejected:
carrying nothing, which makes a person re-type a typo list and a gitleaks allowlist that are
facts about their repository, not policy.

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

The bulk suppressions of ESLint and the baseline file of basedpyright live under `.gspot/baseline/` and
are written at `init`, read on every run and pruned by `apply --baseline`. The editor honors the
same file, so the editor and the gate agree. Every other check uses the gspot count file. Rejected:
one gspot-owned format for everything, which made the editor show findings the gate had
baselined.

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

The build runs Phase 0, then Phase 1 with this repository as the acceptance repository. Then come the preset set yap-swift-app selects together with the corpus assembler, then Python, then the web presets, then release. `13-roadmap.md` records this order and keeps every "done when" row. Rejected: the language order that document first had, which reached Swift last and yap-swift-app fourth, so the repository with the most to replace was proven last.

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

The launcher on npm is `gspot`. Every other package is scoped. `@gspot/cli` is the private workspace package that builds the binary. `@gspot/eslint-plugin` is published, and the flat config registers it under the plugin key `gspot`, so rule ids stay `gspot/<rule>`. `@gspot/cli-<os>-<arch>` are the platform packages. Rejected: the mixed set the first draft had
(`gspot-cli`, `eslint-plugin-gspot`, `@gspot/cli-*`), three conventions for one project.

## D-67 `security/detect-non-literal-regexp` is off

The rule flags every `RegExp` built from anything but a literal, at the constructor, with no way
to say where the pattern came from. A tool that compiles patterns its manifests and options declare (the gspot runner, the glob options of its ESLint rules) cannot pass it. Application code hits it on every pattern read from configuration. The risk it names, a pattern from untrusted
input that backtracks, stays covered: `regexp/no-super-linear-backtracking`,
`sonarjs/super-linear-regex` and `security/detect-unsafe-regex` check every literal, and a
manifest pattern is compiled once at load. Rejected: an `[[ignore]]` in this repository, which D-27 forbids, and a per-path exception in the shared config, which every repository then copies.

## D-68 The names inside gspot follow the naming policy, so `sync` is `apply` and `render/` is `emit/`

The naming groups in `presets/naming/policy.json` bind the identifiers, files, directories, setting keys and architecture documents of gspot, with no group removed, and no allowance. The first draft of the file tree and the CLI carried banned parts; they were renamed rather than allowed:

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

Recorded 2026-09-18, when the prose preset first ran over the text of gspot and reported 9,821 alerts. Three changes. The length ceilings default to what the corpus was written to: 30 words a sentence, 45 words a list item, 6 sentences a paragraph. The ledger's 25 and 20 came from one reference repository's own limits and failed 932 corpus statements.

The Vale reject list rendered from the naming policy is gone, amending [D-26](#d-26-prose-and-identifiers-share-one-vocabulary). The corpus itself writes `an advanced guide`, `modern Bash` and `a new file`, so the identifier bans are not prose bans. The Vale rules `marketing` and `hedging` own the prose.

Seventy more upstream rules are off, each with its reason in the rendered `vale.ini`:

- product terminology from another company (Google's `app` for `application`, Microsoft's `personal digital assistant` for `agent`, Red Hat's `shell prompt`);
- rules a gspot rule already owns (semicolons, future tense, headings, dashes, hedges);
- rules that report the same thing under three names (the Oxford comma, ellipses, spacing, quotes);
- rules that misread technical words (`disabled` as a slur, `primitive` as a type, `swallow` as profanity).

Tables are a skipped scope. A ledger cell is a list of identifiers and rule names, not a sentence, and the rules that judge prose have nothing to say about it. The `future` rule matches `is planned`, `are planned`, `planned for` and `planned to`, not the bare word, because a planned check is what the planner produces. No token ignore covers code spans: the Markdown parser drops code, and a backtick pattern swallowed every fenced block, so the code spans after it were read as prose.

The URL token ignore stops at a closing parenthesis, because a link target that swallowed its `)` left the code spans after it read as prose. Rejected: a baseline for the 1,345 semicolons, which hides the corpus's own unenforced rule. Also rejected: trimming the packages, because the rules that stay (the Oxford comma, `there is`, repeated words, the Harper grammar rules) find real slips.

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

Recorded 2026-09-18, with `upgrade`. A binary carries one version of the presets, so
`upgrade --check` cannot ask an older version what it shipped. It compares what the repository
holds on disk with what this binary renders and pins.

The report holds the drift of every generated file and rule file, and the rule names that
appear or vanish in a configuration diff. It holds the tool pins the runner surface has on disk
against the manifests. It lists the presets detection proposes that the policy does not select,
and the `extra` keys that now have a slot.

Two lines of the earlier report are gone: the coverage change and the refusal when the target
claims fewer files, both of which need the older binary's claim set. Rejected: embedding every
past manifest in the binary, which grows without bound for a report nobody reads twice.

## D-78 The reference pages of the manual stay source files

Recorded 2026-09-18, with the docs site. `docs/reference-pages.ts` writes one page per command,
preset, check and setting, plus the engines page and the decision log, from the binary's own
data. It formats each page with Prettier so the tree stays stable. The pages carry no generated header on purpose. The check texts (`summary`, `why`, `fix`) live
in TOML manifests, which the prose engine cannot read. The generated Markdown is where Vale
reads them.

Drift is caught by the repository check `docs/generated`, which runs the writer with `--check`
at the commit stage. Root-relative links inside the site are validated by the Starlight build
through `starlight-links-validator`, and lychee excludes them. The `docs/` folder is a scope
with the typescript preset alone. The site's own configuration files are TypeScript, and the
scope's `tsconfig.json` uses the Bundler resolution the Astro plugins need.

Rejected: a generated header, which takes the check texts out of the prose gate, and Markdown
links with file extensions, which the site does not serve.

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

`init --presets none` installs the rule files and no check. `init --no-rules` installs the checks
and no rule file.

The rule files do not name gspot, its engines or its setting keys, and claim no
enforcement. A tool may appear as a standard or as the subject of a rule. The managed block
mentions `gspot check` only when a check is selected, and `[rules] exclude` leaves files or
layers out. Amends D-73.

Rejected: one boolean for the whole corpus, which makes a library carry the accessibility and
command-line rules it has no use for.

## D-82 The build order is hardening, 5, 2, 4, 3

The build order in `13-roadmap.md` is: the hardening phase, then Phase 5
(security), Phase 2 (Python, SQL, containers), Phase 4 (Swift) and Phase 3 (the web). The
acceptance run on yap-swift-app needs the security presets, SQL, Supabase, Docker, and nginx
before the Swift presets can close it. Amends D-62. Rejected: Swift first, which ends with a
repository whose secrets, advisories, licenses, and migrations nothing checks.

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
names no preset id: what a preset adds to the workflow, the hooks or `apply` is a key in its
manifest. Rejected: rows kept ready for later phases, which read as working features and are not.

## D-92 One word, one meaning

A word carries one meaning in the code, the setting keys, the manifest keys, the flags, and the
folders. [19-names.md](https://github.com/stefanionescu/gspot/blob/main/architecture/19-names.md) holds the rules a name follows and the renames still to apply. The glossary in the
README of this folder holds the words that stay. Rejected: keeping a name because it passes the
naming policy. The policy measures length, case and banned terms, and none of those sees a word
used twice.

## D-93 Swift tests get a preset

`xctest` covers XCTest, Swift Testing and snapshot tests, as `vitest` and `pytest` cover theirs.
It checks disabled tests for a reason, sleeps, a recording mode left on, snapshot references
with no test, and coverage. Rejected: leaving tests to the five SwiftLint test rules, which see
one file at a time and no snapshot folder.
