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
printed things nobody asked for.

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

`gspot explain <tool>/<rule>` prints the rule's summary, the check that runs it, and the exact
`gspot.toml` line that changes it. The finding line prints the command. Rejected: a link to the
tool's documentation alone, which answers "what is it" and not "how do I change it here".

## D-40 Every tool has an `extra` passthrough

`[tools.<name>.extra]` renders verbatim into the tool's configuration with a required reason,
prints every run, and is reported by `upgrade --check` when a slot arrives for one of its keys.
`init` uses it to carry options it has no slot for. Rejected: failing on unknown options, which
blocked a person until a release added the slot, and dropping them at takeover, which lost
configuration silently.

## D-41 `upgrade` asks before it writes

`gspot upgrade` prints its plan and waits for a yes, as `init` does; `--yes` skips the question
and `--check` is read-only. Rejected: writing on invocation, which surprised people who wanted the
report and made a wrong version choice a revert instead of a no.

## D-42 A second `init` becomes `init --reconcile`

`init` on an installed repository refuses and points at `--reconcile`, which re-detects, writes
nothing, and prints the `add`, `declare` and `sync` commands that would apply each difference.
Rejected: re-running the full init, which cannot tell a deliberate omission from a new arrival
and would overwrite one to serve the other.

## D-43 Copied project templates carry their origin version

A project template copied into the project layer opens with a `gspot-template` header naming the
template and the gspot version. `upgrade --check` reports when that template changed upstream;
nothing merges it. Rejected: upgrading project files, which the project owns; rejected: no header,
which left the person unaware that the source they copied had moved on.
