# Decisions

This document records each decision that shapes gspot, with the alternative it rejects. A
decision changes only by adding a new entry that supersedes it.

## D-01 One binary, compiled with Bun

gspot is TypeScript compiled with `bun build --compile` into one executable per platform. A
Python-only or Swift-only repository needs no Node. Rejected: an npm package, which makes Node a
requirement in every repository and made the previous design assume mise to get it there.

## D-02 The ESLint plugin hosts the JavaScript and TypeScript structural rules

The 21 rules the reference repositories wrote as ESLint rules stay ESLint rules, in
`eslint-plugin-gspot`, so editors show them and the tested semantics survive. Rejected: one
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

gspot writes `.mise/conf.d/gspot.toml` when mise is present and proposes mise when nothing is.
Without it, gspot writes to the package manager the repository has. Rejected: mise as the only
runner, which fails the stranger with a plain npm repository.

## D-08 The naming engine is original code

Extractors per language and a whole-part matcher over one policy document. Rejected: compiling
the policy into five tool configurations, which loses per-term messages, cross-file prefix
collisions, and the reserved-term mechanism, and which the reference audit judged not
replaceable as a unit.

## D-09 Whole-part matching, never substrings

A banned term matches a whole identifier part. Rejected: the reference implementation's
substring match, which made the conjunctions group fire on `spawnSync` and needed fifteen
exemptions.

## D-10 Tree-sitter through WASM, ast-grep through its CLI

`web-tree-sitter` with embedded grammars for the extractors and original analyses; the ast-grep
CLI for declarative rules. Rejected: `@ast-grep/napi`, a native addon the binary cannot embed
and a second grammar registration path.

## D-11 Generated configuration is tracked

Editors and `bunx <tool>` discover it; upgrades are diffs; CI needs no bootstrap. `sync --check`
catches hand edits. Rejected: generating into an ignored directory at every run.

## D-12 Every ignore carries a reason and prints

There is no cap, no expiry, no ticket field. A reason that says nothing (`N/A`, `TBD`) is
refused at load. Rejected: a ticket requirement, which the reference repositories filled with
`N/A` twelve times out of twenty-eight.

## D-13 The marketing and defensive term groups are not removable

They are what the distribution is for. Individual names take scoped exemptions with reasons.
Rejected: every group removable, which lets `enhancedHandler` back in with one line.

## D-14 Stages follow requirements

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

`enforced-by` or `unenforced` on every statement; the unenforced count is reported. Rejected: a
corpus with no link to enforcement, which the reference audit called "enforcement on paper
only".

## D-18 The layer boundary is enforced

General and language rule files carry no architecture. A framework file carries only what the
framework dictates. The project layer belongs to the team. Rejected: shipping one team's
ownership map and MVVM stack to strangers.

## D-19 A maintained tool wins

An original analysis exists only where the manifest records the tools searched and why none
expresses the rule. Rejected: the reference pattern of writing a careful analyser four times.

## D-20 Limits ship at the strictest value observed

Shell function length is 40, not 100. A repository above the limit gets a baseline, not a
weaker rule. Rejected: the loosest value, which makes the limit decorative.

## D-21 Preset ids are bare names

`typescript`, not `language:typescript`. The kind is a field. Rejected: kind prefixes in every
id, which nobody typed correctly and which the folder name already says.

## D-22 The inverse config-purity check is not carried

The reference check that forced every scalar-only module into a config folder produced sixty
hoisted constants and three duplicates. gspot keeps the forward check (config files hold no
logic) only.

## D-23 Seven commands in v1

`init`, `check`, `sync`, `rules`, `doctor`, `upgrade`, `uninstall`. `fix` is a flag on `check`;
coverage lives in `doctor`; the last run is a file. Rejected: fourteen verbs, half of which
printed things nobody asked for. Superseded in part: D-32 and D-37 add the six writing commands,
`why` and `explain`; D-45 folds `rules` into `sync`; D-55 adds `completion`. The count is fifteen.

## D-24 No environment variables turn checks off

Skips live in `gspot.local.toml` and print. Rejected: sixteen `SKIP_*` variables, one of which
turned off four scanners at once.

## D-25 The hook finds gspot through the runner

The hook body calls the runner's exec (`mise exec`, `bunx`) or an absolute path written at
install. Rejected: `exec gspot`, which assumes `PATH`.

## D-26 Prose and identifiers share one vocabulary

The marketing, defensive and conjunction groups render into both the naming policy and the Vale
style. Rejected: two lists that drift.

## D-27 gspot lints gspot with no ignores

A rule too strict for gspot's own code is fixed in the code or changed for everyone. Rejected:
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
keywords. Rejected: public-first ordering, which several style guides prefer and which the user
rejected for this distribution because the contract is what a reader wants at the end, after
the parts it is built from.

## D-30 Types live under `types/`

Type aliases live under the declared types directory; `interface` is banned; the directory
holds type-only imports and no runtime exports. On by default, strict everywhere, exceptions
through `[[ignore]]`. Rejected: co-located types, which spread a contract across every file
that uses it and which agents extend in place.

## D-31 Native on Windows

The binary, `check`, `sync`, `doctor` and the hooks run natively on Windows; CI tests it.
Rejected: WSL only, which excludes a stranger's machine for a reason that is gspot's to fix.

## D-32 Every setting has a writing command; hand edits stay valid

`ignore`, `add`, `remove`, `allow`, `set` and `declare` write `gspot.toml` through one writer
that keeps comments and order, validates as load does, and runs `sync`. A hand edit produces the
same file. Rejected: no writing command at all, which an earlier design held and which made the
first customization a TOML lookup; rejected: hiding decisions behind commands, which the required
reasons and the tracked file prevent, since every command's output is a line in `gspot.toml`.

## D-33 Install policy is part of the gate

A minimum release age of seven days and an install-time security scanner, where the package
manager supports them, are checked like any other setting. Rejected: leaving supply-chain
settings to each repository, which two of four reference repositories had set and two had not.

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
made the first run a wall of `MISSING`.

## D-37 `add`, `remove` and `why`

Three commands join `ignore` as the ones that touch `gspot.toml` or explain it: `add` and
`remove` change the preset list with the same validation and re-render, `why` explains one file.
Rejected: hand edits for every preset change, which a stranger gets wrong in the same ways the
ignore table was got wrong.

## D-38 One license mode, exceptions name the license

The license checks run in allow mode only: a package passes when its reported license is on the
allowlist or an exception names that package at that exact version with the license it reports and
a reason. Rejected: the exclude mode two reference repositories also ran, which lists packages to
skip without saying what was accepted and so cannot notice a license change at the same version.

## D-39 `explain` covers a tool's rule, not only a gspot check

`gspot explain <tool>/<rule>` prints the rule's summary, the check that runs it, the `gspot
ignore` line that turns it off and the `gspot set` line that changes its options. The finding
line prints the command. `explain` also takes a check id, a preset id and a setting key, so one
verb answers "what is this" for everything gspot has a name for. Rejected: a link to the tool's
documentation alone, which answers "what is it" and not "how do I change it here".

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

`init` on an installed repository refuses. What changed in the repository since the install is
reported, with the `add`, `declare` and `sync` command that would apply each difference, and
nothing is applied without that second command. Rejected: re-running the full init, which cannot
tell a deliberate omission from a new arrival and would overwrite one to serve the other.
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

## D-45 `doctor` absorbs reconcile; `sync` absorbs `rules`

`doctor` prints what changed in the repository since `init` (languages and frameworks that
appeared, configuration files not owned, hooks or CI changed by hand) with the command that
applies each, beside the tool and coverage report it already printed. `sync` installs the rule
files and the managed blocks, `sync --check` reports their drift and the unenforced count, and
`sync --project-templates` copies templates once. Fourteen commands, fifteen with D-55. Rejected: `init
--reconcile` and `rules`, which printed or wrote a subset of what `doctor` and `sync` already
covered, so a person had two commands to remember for one question.

## D-46 Takeover replaces; it carries exception lists only

At `init`, an owned tool's existing configuration file is deleted (git keeps it; the plan prints
`git show HEAD:<path>`) and gspot's is written. Carried into `gspot.toml`: typos words, gitleaks
allowlists and baseline fingerprints, osv ignored advisories, license exceptions, and rules
turned off, which become `[[ignore]]` entries with the reason `carried from <file> at init`.
Nothing else is read. Rejected: one loader per tool that carries every option into
`[tools.<name>]` or `extra`, which is twenty loaders to write and maintain and which preserves the
old policy inside the new one, so the repository never adopts the shipped rule set. Rejected:
carrying nothing, which makes a person re-type a typo list and a gitleaks allowlist that are
facts about their repository, not policy.

## D-47 Static output, one library per job

Every command prints lines; `--json` prints a documented object. The only interactive moments
are the questions `init` and `upgrade` ask through `@clack/prompts`, skipped under `--yes`, `CI`
or no terminal. commander parses and writes help; picocolors colours; zod validates; smol-toml
reads and `@decimalturn/toml-patch` writes `gspot.toml`; `consola` carries messages on stderr.
The full table, one library per job, is in [12-repository-layout.md](12-repository-layout.md);
what stays gspot's own is listed under it. No terminal UI framework,
table renderer or logging framework. Rejected: a rendered interface, which agents cannot read,
CI cannot show, and which no linter people already trust has.

## D-48 Limits and naming ceilings are per language

`[limits]` and `[naming]` keys apply to every language at the root and can be overridden under a
language table (`[limits.python]`, `[naming.swift.parameters]`). The shipped per-language
defaults are the strictest observed (D-20). Rejected: one number for every language, which made
a Python module limit and a TypeScript file limit the same setting and forced a repository to
loosen both to loosen one.

## D-49 The repository pins its gspot version

`.gspot/version` and the runner surface pin one gspot version per repository. A binary of another
version refuses `check`, `sync` and the writing commands with the two remedies. A global install
exists to run `init`; after that, the hook and the runner resolve the pin. Rejected: whatever
version is on `PATH`, which makes two people on one repository run two rule sets and makes an
upgrade happen by accident.

## D-50 Every check explains itself in plain English

Each check carries `summary`, `why` and `fix`, written for a person who does not code, validated
non-empty at load, printed by `explain` and the finding line, and rendered into `docs/`. gspot's
own prose, help strings and docs pass the prose engine and a readability ceiling in gspot's gate.
Rejected: messages alone plus the tool's website, which assume a reader who already knows what a
barrel file or a call-through is.

## D-51 The writing commands also remove, and lists append

`ignore`, `allow` and `declare` take `--remove`; `set` takes `--default` and, for lists,
`--replace` and `--remove`, appending otherwise. One entry per command; bulk edits are a hand
edit followed by `sync`. Rejected: write-only commands, which made the second edit to any entry
a TOML lookup, the very thing D-32 removed for the first edit.

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

ESLint's bulk suppressions and basedpyright's baseline file live under `.gspot/baseline/` and
are written at `init`, read on every run and pruned by `sync --baseline`. The editor honours the
same file, so the editor and the gate agree. Every other check uses gspot's count file. Rejected:
one gspot-owned format for everything, which made the editor show findings the gate had
baselined.

## D-55 Completions come from `tab`, in v1

`gspot completion <shell>` prints the script `@bomb.sh/tab` generates from the commander tree
for bash, zsh, fish and PowerShell. Rejected: a hand-written completion command, which is why the
feature sat in v1.1.

## D-56 qlty, Trunk and MegaLinter are prior art, never dependencies

They validate the shape (init, check, pinned tool versions, one config) and their docs and
descriptors are read when a preset is written. None is run or embedded: qlty is Fair Source and
downloads its own tools, Trunk is closed, MegaLinter is Docker-only. [15-prior-art.md](15-prior-art.md)
records what each taught. Rejected: building on qlty's plugin catalog, which its license forbids
for a tool in the same space.

## D-57 Migration is the owner's step; gspot lists, the person deletes

`init` replaces what it owns and lists what it can prove redundant without reading code: a
directory nothing in the gate references, a hand-written hook directory, a manifest whose
dependencies are all tools gspot pins, a pin gspot also pins. `doctor` keeps listing them. Tasks,
rule directories and documentation are the person's to judge; the migration document walks them
for the reference repositories, and the ledger is the proof for checks. Rejected: `init` deleting
those itself, which would destroy code it cannot prove it replaced; rejected: `init` reading task
bodies or rule files to decide what is redundant, which is a heuristic per repository shape and
the kind of code this design refuses.

## D-58 Formatting is asked, never imposed

When a repository's formatter configuration differs from the shipped `[format]`, `init` asks
one question, `--format keep|shipped`, and `--yes` keeps the repository's values. Whatever is
chosen is written to `[format]` and can be changed with one `gspot set`. Rejected: always
shipping 4 spaces and 120 columns, which reformats a stranger's whole repository on the first
commit and buries the real diff; rejected: always keeping, which never lets a repository
converge on one style and contradicts D-20 for the one setting where "strictest" has no meaning.

## D-59 The file set is what git tracks or would track

`git ls-files --cached --others --exclude-standard`: tracked files plus files git would track,
minus what `.gitignore` excludes. A file the developer created and has not staged is checked by
`gspot check`, so a whole-tree pass is a promise the commit hook keeps. Rejected: tracked files
only, which passed a whole-tree run and then failed the pre-commit hook on the new file the run
never saw.

## D-60 gspot's own literals live in `packages/cli/config/`

The regexes, pattern lists, marker strings, header templates, refused reasons and file-tag table
gspot ships in code live in one directory of literal-only modules, which `integrity/config-purity`
guards in gspot's own gate through the `config` role in gspot's `gspot.toml`. The `gspot.toml`
schema and writer live in `src/policy/`, so `config` means one thing. An algorithm's own constant
stays inline (D-22). Rejected: literals scattered through the engines, which is what the reference
audit found and what made a regex change a hunt; rejected: hoisting every constant, which D-22
already refused.

## D-61 One release, whole

v1 is Phases 0 through 6. Rejected: the earlier cut that shipped after Phase 4 and deferred
prose, the corpus and CodeQL, which handed every early adopter a second migration when the agent
rule files arrived, and which put the part of gspot that makes it more than a linter runner into
"later".
