# Decision Log

Each entry states the decision, the alternatives, and the evidence. Entries marked **inherited** are
decisions the reference audit made that this design adopts unchanged.

## D-01 gspot is the orchestrator; qlty, trunk and pre-commit are not

**Decision.** gspot owns the task graph and invokes tools directly. qlty is used only for what
nothing else provides.

**Alternatives.** Build on qlty (already in the reference repository), on trunk, or on the
`pre-commit` framework.

**Evidence.** The reference audit's own conclusion, adopted: "qlty hosts only what nothing else
runs. ESLint, Prettier, ShellCheck, shfmt, SQLFluff, SwiftLint, SwiftFormat, markdownlint, hadolint
and tsc run from mise tasks; enabling them in qlty would run every check twice." Beyond duplication,
none of the three orchestrators can express the coverage check, because none of them knows which
files a tool actually processed. The coverage check is the product, so the orchestrator has to be
the one that owns the file listing.

qlty keeps its three unique plugins: trufflehog, editorconfig-checker and dotenv-linter, plus
`qlty smells` behind a parsed-output gate rather than a `mode = "block"` that does not block.

**No second orchestrator for other languages either.** A language gspot has no preset for is declared
with an `[[exception]]` against the coverage check and a reason, and the coverage report says so. A MegaLinter bridge would be
a second configuration surface and a second finding format for breadth gspot has chosen not to
pursue. One tool per job applies to orchestrators.

## D-02 Claims are reported by the tool, never manifest-asserted

**Decision.** A preset states which files it claims by asking the tool.

**Alternatives.** Trust a glob list in the manifest, which is what every existing mega-linter does.

**Evidence.** `.sqlfluffignore` line 9 reads `sql/` and hides 58 of 83 SQL files. The pre-commit
command names three SQL paths and two of them are silently ignored. No amount of reading finds that;
only asking sqlfluff finds it. This is the single decision the whole design rests on.

**Tradeoff.** A full coverage is slower than a manifest read, and six file listing mechanisms have to be implemented
and fixture-tested. Accepted.

## D-03 Generated configuration is tracked

**Decision.** `.gspot/generated/` is committed.

**Alternatives.** Generate into an ignored directory at setup time.

**Evidence.** Editors and language servers discover configuration by walking up from the file,
`bunx <tool>` needs a real file, CI needs no bootstrap, and an upgrade diff is the most important
review signal a policy change produces.

**Tradeoff.** Noise in diffs on upgrade, which is the intended signal, and a drift check to stop hand
edits.

## D-04 One version for the whole distribution

**Decision.** Every preset ships at one version. No per-preset version.

**Alternatives.** Semantic versioning per preset, with a resolver.

**Evidence.** The reference set's most expensive class of defect is drift between parts that had to
agree: `.editorconfig` against `.prettierrc.json` against markdownlint `MD007`; `mise.toml` against
`.nvmrc` against `engines` against a constant; ESLint 9.38 with `typescript-eslint` 8.29 in one
repository and 10.9 with 8.69 in another. A resolver that permits those combinations permits the
drift.

## D-05 Python structural rules run on ast-grep, not on Python's `ast`

**Decision.** One structure runtime in TypeScript, with an ast-grep Python grammar. No Python-side
analysis process.

**Alternatives.** Implement the Python rules in Python with `ast` and `libcst`, as
`yap-text-inference` does in 12 files.

**Evidence for.** Every rule times every language is the implementation count under the per-language
approach, and the reference set already shows the result: three repositories, three implementations,
three divergent behaviours for one rule name.

**Evidence that nothing needs `ast`.** The three files that looked like they might, in
`yap-text-inference/quality/python/rules/imports/`, were read: `cycles.py` is a 55-line Tarjan
traversal, `graph.py` is a 216-line `ast.NodeVisitor` collecting runtime imports outside
`TYPE_CHECKING`, and `deferred.py` rejects `__getattr__` lazy-export hooks in 39 lines.
`import-linter`'s `forbidden` and `independence` contracts cover the first two and its import
collection already skips `TYPE_CHECKING` bodies. The third is one ast-grep pattern over a
module-level `def __getattr__`.

## D-06 A parse error is a lint failure (inherited, strengthened)

**Decision.** Every adapter rejects a tree containing `ERROR` or `MISSING`.

**Evidence.** One shell file in the reference tree produces an `ERROR` node, and four functions
after that line vanish from three checks. `master` found them; the branch found none of them. The
audit found it by diffing extractor output, which is not a repeatable process.

## D-07 Everything is an error; adoption uses a baseline (inherited, extended)

**Decision.** Zero `warn` severities, `--max-warnings 0`, `--strict` everywhere,
`reportUnusedDisableDirectives: "error"`. A rule with a backlog gets a baseline: a recorded count
that can only fall. There is no expiry and no owner. The count is listed in every run report.

**Alternatives rejected.** A warning level. A dated expiry on the baseline, which an earlier draft
carried and which is a deadline nobody set; the count falling is the only signal that matters. Expiry that warns and never fails, which is a warning
level by another name. Expiry that fails only in CI, which makes the hook and CI disagree.

**Evidence.** The reference repository's own decision, quoted: "Everything is an error. Zero `warn`
severities. The only escape is a scoped suppression with a reason." And the cost of a baseline with
no deadline: five good rules left off at 100, 921, 294, 426 and 93 findings, recorded as "measured,
left off", with no date on any of them. A count with no deadline never moves. If pushing dates
becomes the habit, the exception list makes it visible, which is more than the reference set has.

## D-08 Bespoke checks survive only when no maintained tool expresses the rule

**Decision.** Eighteen structural rules and one naming policy survive. Everything else is a mature
tool.

**Evidence.** Three independent reimplementations of the same rules across three
repositories is proof that no tool ships them. The reference audit reaches the same conclusion for
the five file-existence rules and the four barrel rules independently, and explicitly rejects
`eslint-plugin-barrel-files` and `eslint-plugin-no-barrel-files` as "lightly maintained".

Rules dropped in favour of a plugin: `no-imports-after-statements` becomes `import-x/first`,
`newline-after-imports` becomes `import-x/newline-after-import` with `count: 1`. Tools dropped
because no task ever invoked them, in `yap-swift-app`: Lizard, jscpd and madge.

## D-09 Ruff `S` runs alongside bandit; nothing a reference repository runs is cut on theory

**Decision.** Ruff `S` is selected and bandit, pip-audit, interrogate, Bearer and Lizard keep
running wherever a reference repository runs them today. A tool is dropped only after a
replacement is proven on that repository, finding for finding.

**Alternatives.** Cut bandit for Ruff `S`, pip-audit for osv-scanner, interrogate for Ruff `D`,
Bearer for Semgrep, Lizard for `sonarjs/cognitive-complexity`. An earlier draft did all five.

**Evidence.** Each cut rested on a claim that did not survive contact with the repository: Ruff
`D` skips private and nested functions, so it is not interrogate at 100; `sonarjs/cognitive-complexity`
is turned off for every file in `yap-landing`, so Lizard was the only complexity gate; Bearer's
fingerprinted ignores do not port to Semgrep; bandit scans `docker/` and `quality/`, which Ruff
`S` does not reach. Overlap between two tools costs seconds. A lost check costs a class of defect.

## D-10 The naming policy stays one data file (inherited)

**Decision.** One 290-line JSON policy, extended through the settings file. Only the extraction
layer is replaced.

**Evidence.** The reference audit's reasoning, adopted: "Reconstructing 70 percent of it would need
four configuration formats with the banned list duplicated four times."

## D-11 Migration safety is scoped to a baseline version

**Decision.** `squawk` runs on migrations after a recorded version. A `migration-immutable` check
fails on an edit to an earlier one.

**Alternatives.** Run Squawk on everything, which is what the reference branch did.

**Evidence.** Running it on everything caused sixteen already-applied migrations to be edited on a
quality branch, breaking the repository's own immutability rule and leaving the remote having run
different text from what a fresh environment will run. Worse, the inserted non-`LOCAL`
`SET statement_timeout` persists for the session into nine large insert migrations with no guard.

## D-12 mise is the recommended runner; bun and npm are supported with a tool installer

**Decision.** Three runner emitters. Under bun and npm, gspot downloads non-npm tools with pinned
checksums into `.gspot/bin/`.

**Alternatives.** Support mise only, which is simpler and excludes a Next.js repository that does
not want a version manager. Or require Homebrew, which excludes Linux CI.

**Evidence.** Many of the tools are not npm packages. All three reference
repositories chose mise, and all three are polyglot. A single-language repository has a weaker
reason to adopt one.

**Tradeoff.** A checksummed downloader with per-platform assets, and honest reporting when a tool cannot
be installed. `gspot doctor` names the checks lost.

## D-13 Rules is generated from presets, and tiered

**Decision.** `CLAUDE.md` and `AGENTS.md` are generated. Four layers, with architecture permitted
only in the framework layer and the project layer.

**Alternatives.** Ship a rules directory and let the consumer maintain the index, as all three
reference repositories do.

**Evidence.** The two files are byte-identical and hand-maintained in one repository,
`rules/DOCUMENTATION.md` is missing from both and linked by nothing, and `slopshop`'s nine-row
framework table has no check that the repository still uses all nine libraries. Generation removes
all three failures.

## D-14 the project layer is copied once and never upgraded

**Decision.** `rules/project/` is written at init from a template and never touched again.

**Evidence.** It contains the project's architecture. An upgrade that rewrites a team's ownership
map is a bug, not a feature.

## D-15 CI is a question at init, never a default

**Decision.** `init` asks "Set up CI?" and proposes the answer from what it finds: a workflow with
a lint job proposes replacing that job, a workflow without one proposes adding a job, no CI
proposes no. Emitters exist for GitHub Actions, GitLab CI and Buildkite, and any other provider
gets the two commands printed. Nothing is written without a yes. Every check runs locally whatever
the answer.

**Evidence.** The reference repository states "there is no `.github/` and none is wanted."
Respecting that is the difference between a tool that gets adopted and one that gets configured
around. The same repository runs CodeQL, Bearer and four scanners at push with no CI, which is
why no check may be CI-only.

## D-16 One Vale style

**Decision.** One style, `gspot`, holding every prose rule at error level.

**Alternatives.** Two styles, one mechanical and on by default, one opinionated
and opt-in, so a repository adopts the taste rules later.

**Evidence.** The split existed only for staged adoption, and adoption already
happens per rule through baselines. A second style duplicates a
mechanism that exists elsewhere, and its name (`plain`, `text`, `strict`) tells
a reader nothing. One style, one name, every rule an error, and a rule with a
backlog gets a baseline like any other.

## D-17 Product text is out of scope for prose linting

**Decision.** Vale reads comments and documentation. String literals, prompt text, visible HTML copy
and message catalogues are product data, and the coverage report records them as a declared gap.
Error and log message shape gets adjacent enforcement through ESLint `no-restricted-syntax` and Ruff
`EM` and `G`.

**Evidence.** 248 em dashes in the reference tree are inside prompt strings. Rewriting a prompt to
satisfy a dash rule changes model behaviour, and rewriting a landing page to satisfy an engineering
prose rule changes the product. A marketing style is a different style with different rules, and a
page that fails `gspot` is a page, not a defect.

## D-18 The coverage check is never given a baseline

**Decision.** Format, syntax, schema, secrets, licences and the coverage check must pass
immediately. Only style, structure, naming, prose and complexity are baseline-eligible.

**Evidence.** A declaration costs a minute and a coverage gap costs an audit. `yap-swift-app` needed
a human reading the tree for a day to find what the coverage check computes in seconds, and a
baseline on that would have deferred the finding indefinitely.

## D-19 Declarative rule files over original analysis code

**Decision.** A rule uses the highest available mechanism: an existing rule configured, then a
declarative rule file, then a documented plugin API, then original code. ast-grep YAML is the
primary declarative vehicle.

**Alternatives.** One original engine with a language adapter per grammar, which is what all four
reference repositories built.

**Evidence.** ast-grep takes rule documents with `pattern`, `kind`, `regex`, `nthChild`, the
relational operators with a `stopBy` bound, the composites, and `constraints` applying a regex to a
captured metavariable, across 26 languages including TypeScript, Python, Swift, Bash and CSS.
Fourteen of the eighteen structural rules are expressible that way. Against that: the reference set
has the same rules implemented four times, diverging in each.

**Tradeoff.** ast-grep rule files are less expressive than code for count-based and directory-based
rules, so a handful keep original implementations, and a generic counter serves every rule that
needs a ceiling. Total original analysis code drops from roughly 6,000 lines to roughly 640.

## D-20 The naming policy compiles; it does not execute

**Decision.** The 103-term policy and its per-language limits are one JSON document with five
emitters, emitting a `@typescript-eslint/naming-convention` rule array, a pylint regex set, a
SwiftLint block, a sqlfluff config and an ls-lint config. gspot ships no identifier extractor.

**Alternatives.** Keep the engine, which is 2,479 lines in one reference repository, 14 files in a
second and 13 in a third.

**Evidence.** Every tool already extracts identifiers and already has a per-category selector.
`@typescript-eslint/naming-convention` with `custom: {regex, match: false}` is strictly more
expressive than the policy's category list. pylint `bad-names-rgxs` is the only maintained Python
mechanism for banned terms. SwiftLint `custom_rules` takes a regex. ls-lint owns files and
directories in every language at once.

**Tradeoff.** Three losses: cross-file prefix collision needs the directory walk; pylint reports
`disallowed-name` rather than naming the matched term, mitigated by emitting one rule per term
group; and `banDuplicateWords` needs one regex per case convention rather than one function. All
three are cheaper than five extractors.

## D-21 Match whole identifier parts, never substrings

**Decision.** The banned-term matcher splits an identifier at case boundaries, underscores and
hyphens, and matches whole parts. Multi-word terms match consecutive parts.

**Evidence.** The reference policy sets `caseInsensitive: true` and matches substrings over whole
identifiers, which makes the `conjunctions` group (`and`, `or`, `with`, `when`, `what`, `once`) a
false-positive generator. Most of the fifteen `bannedTermExemptions` in the reference tree are that
defect leaking: `spawnSync`, `buildValuesList`, `applyDefaultValues`, `toEnumValues`. Fixing the
matcher removes the need for most exemptions.

## D-22 pylint runs as a complement to Ruff, never at defaults

**Decision.** `pylint --disable=all` plus an explicit enable list, restricted to checks Ruff does
not implement: `disallowed-name`, `invalid-name` with the category regexes, and six design metrics.

**Alternatives.** Ruff alone, which cannot express banned terms. Both at defaults, which is what
MegaLinter does. pylint alone, which is slow.

**Evidence.** Ruff's FAQ states it implements every rule natively and does not support custom or
third-party rules, and the plugin discussion is open with no implementation as of September 2026.
Running both at defaults produces two findings per issue with different codes, which is why the
reference repository dropped pylint and wrote its own Python checks instead.

## D-23 Hooks and CI are two independent settings

**Decision.** `[gate] hooks = true|false` and `[gate] ci = none|github|gitlab|buildkite`. Four
combinations, all valid. Both surfaces call the same task graph with a stage name. Pre-commit
runs what needs nothing over staged paths; pre-push runs everything over the tree; CI repeats
pre-push.

**Alternatives.** One `gate` enum with `hooks`, `ci` and `split`, which an earlier draft had.
It stored the same two facts in one field and made "both" a special mode with its own name.

**Evidence.** Duplication in the reference tree comes from two definitions of one check, not from
two surfaces: markdownlint runs twice per push from two task paths. One graph, called from two
places, cannot drift.

## D-24 No file-exclusion mechanism that a tool alone honours

**Decision.** gspot never writes a tool ignore file that the coverage check cannot see through.
Every exclusion is a declaration in `gspot.toml` with a status, and file listing confirms what the tool
actually did.

**Evidence.** MegaLinter's own configuration carries five distinct exclusion mechanisms and
seventeen entries, thirteen with no stated reason, including one regex that removes nine directory
trees from every linter at once with no report of how many files that was. `.sqlfluffignore` hides
58 of 83 files in the reference monorepo. These are the same defect at two scales.

## D-25 ASD-STE100 at the sentence, ISO 24495 at the document

**Decision.** One Vale style, `gspot`, enforcing ASD-STE100's writing rules at
the sentence and ISO 24495-1's principles at the document. Both apply to
everything gspot writes or ships.

**Alternatives.** One standard only. ISO 24495 alone is principle-based and
leaves sentence rules to taste; STE alone says nothing about how a document is
organised.

**Evidence.** The reference corpus already names both: `TALKING.md` requires
STE, and the documentation rules cite ISO 24495-1. STE's rules are the
mechanisable ones (word counts per sentence, one instruction per sentence,
active voice, present tense, no modals). ISO 24495's are the structural ones
(findability, headings, contents). The STE dictionary is copyrighted and is
approximated, not vendored. This is an alignment for both standards, not a
conformance claim for either; the style says so in its header.

## D-26 gspot's own gate carries no exceptions

**Decision.** `gspot.toml` in this repository has no `[[exception]]` entry, and the self-gate fails
if one appears. When self-application fails, the responses are to fix gspot's
code or to change the rule for everyone. Adding an exemption for gspot is not a response.

**Evidence.** Every reference repository made the other choice. `quality/eslint/policy.mjs` lints a
large lint package with `eslint:recommended` plus six rules while shipping nine plugins to its
consumers, and the `qlty.toml` comment claiming complexity is enforced there is false.

## D-27 Seven preset kinds, named for what selects them

**Decision.** `language:`, `framework:`, `library:`, `tool:`, `database:`, `platform:` and
`repository:`, defined once in [02-model.md](02-model.md). Runner and CI are settings. The general
rules install with `[rules] install = true`, which is a setting too.

**Alternatives.** Eight kinds: `lang:`, `framework:`, `aspect:`, `doctrine:`, `runner:`, `ci:`,
`cd:`, `bridge:`.

**Evidence.** Five of the eight described settings that `gspot.toml` already holds, which is
duplication. `aspect:` is borrowed from aspect-oriented programming, where it means something else,
and it served as the bucket for anything not tied to a language, which is the vague-container
pattern the shipped banned-terms policy bans as term group 1. `doctrine:` is invented, and the kind
is unnecessary because rules arrive with `[rules] install = true` and the language and framework presets
contribute their own. `lang:` is an abbreviation, and `unicorn/prevent-abbreviations` is in the
shipped TypeScript rule set.

`repository:` is not invented: MegaLinter names this exact class of linter `repository_*`, with a
`repository.megalinter-descriptor.yml` holding the whole-tree tools. Prior art in the same problem
domain.

**The metaphor pass.** A second round removed every name that described the thing by analogy rather
than by what it does:

| Was                                                                     | Now                                                                       | Why                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `budget`                                                                | removed; there is no cap                                                  | Finance metaphor for a cap on a count, and the cap itself was a feature nobody asked for.                |
| `ledger`                                                                | the exception list                                                        | Same.                                                                                                    |
| `ratchet`                                                               | `baseline`                                                                | Mechanical metaphor. The files were already at `.gspot/baseline/`, so the plain word was already in use. |
| `census`                                                                | `coverage`                                                                | Population metaphor. The thing measures coverage, and everyone knows that word.                          |
| `disposition`                                                           | `status`                                                                  | Legal abstraction for a category.                                                                        |
| `universe`                                                              | tracked files                                                             | Grandiose for `git ls-files`.                                                                            |
| `plane`                                                                 | concern                                                                   | Architecture-speak.                                                                                      |
| `totality`                                                              | full coverage                                                             | Abstract noun where a plain phrase works.                                                                |
| `actionability rule`                                                    | do not report what nobody can fix                                         | The rule is one sentence; it does not need a noun.                                                       |
| `framework:node-api`                                                    | `framework:node`, then removed by D-50: the checks are the shared `http` package                                                        | A mushy compound. Node is what the preset is for, and the HTTP checks are what a Node service does.        |
| `language:docker`                                                       | `tool:docker`                                                        | Docker is a platform that dictates a file format, which is the framework test. Not a language.           |
| `adoption ladder`, `spine`, `crown jewel`, `blast radius`, `dogfooding` | staged adoption, the tool, highest-value asset, reach, gspot lints itself | Metaphors that carry no information.                                                                     |

**Consequence.** Every name in the distribution is checked against the policy it ships. `rules/core`
becomes `rules/general` because `core` is a banned term. `rules/local` becomes `rules/project`
because "local" reads as local development. `overlay` becomes `settings`. Numbered layers become
named ones. The full table is in [03-repo-layout.md](03-repo-layout.md).

## D-28 One version pins rules, tools and corpus together

**Decision.** A `gspot` version fixes the preset set, every tool version and checksum, the naming
policy, the structural rule files, the Vale styles and the rule corpus. `gspot upgrade` moves all of
them as one reviewable commit.

**Alternatives.** Let a dependency bot bump the version. Let tool versions float. Version the corpus
separately from the rules.

**Evidence against a bot.** Bumping the version without re-rendering leaves the generated
configuration stale, so `gspot generate --check` fails on every subsequent run. A bot that changes one line
produces a broken tree. `gspot upgrade` does the whole operation and opens the result.

**Evidence against floating tools.** A check run that resolves a tool version from the network can
run a different rule set than the last commit recorded, and cannot run at all offline. The lock is
tracked, and `generate`, `generate --check` and `check` never reach the network.

**The one hard failure.** A negative coverage change aborts an upgrade. A rule getting stricter is
loud; a tool quietly ceasing to read a directory is not, and coverage loss is the failure mode the
whole design exists to catch.

## D-29 No compatibility shim, in either direction

**Decision.** A renamed setting fails the load and names the old setting, the new setting and the
release note. No alias, no deprecation period, no automatic migration.

**Evidence.** The reference repositories forbid backward compatibility in their own rules, and the
reason applies here with force: an automatic migration is how a loosening entry survives a rename
without anybody reading it again. A `[[exception]]` entry with a reason has to be
re-read when the rule it loosens changes shape, and a failing load is what makes that happen.

## D-30 Do not report what nobody can fix

**Decision.** Build artifacts leave the tracked file list entirely. Generated files get `freshness`,
`determinism` and `secrets`. Frozen files get `immutability` and `secrets`. Vendored files get
`secrets` and `license`. None of the four gets `format`, `style`, `naming` or `types`.

**Alternatives.** Lint everything and carry exclusion lists, which is what the reference
repositories do.

**Evidence.** `yap-landing` lints `dist/**/*.html`, which git does not track, through a second
`html-validate` config that disables five of its seven rules so minified output passes. What remains
is one rule the source check already enforces. The check costs a build and a config file and can
find nothing.

The stronger evidence is what an unfixable finding eventually costs. The reference monorepo
style-checks 25 applied migrations that its own rules declare immutable, and the branch resolved
that contradiction by **editing sixteen of them**, breaking immutability and leaving the remote
having executed different text from what a fresh environment will execute. An unfixable finding does
not stay ignored; it gets "fixed", and the fix is worse.

**The corollary.** A check that needs rules disabled to pass is telling you it should not run. The
disabled list measures the misfit.

## D-31 Easy to change, impossible to hide

**Decision.** Every common settings change is one TOML line, documented in a copy-paste table. A
loosening entry carries a reason and is listed in every run report.

**Alternatives.** Hand-edited TOML only, which makes exclusion tedious and therefore rare. Or a
free-form disable flag, which makes it invisible.

**Evidence.** Both failure modes are present in the reference set. Sixteen `SKIP_*` environment
variables exist because turning a check off properly was harder than skipping it. Twelve of 28
suppressions cite `N/A` as their ticket because the field was mandatory and unvalidated. Friction
does not produce discipline; it produces workarounds.

Every exception is listed in every run report with its reason, which is what makes the
decision visible rather than merely recorded.

## D-32 One setting decides which migrations are frozen

**Decision.** `[sql] immutable_through`, taking `"none"`, `"all"` or a version. No
default; `gspot init` asks once. A frozen migration gets `secrets` and `immutability` and nothing
else, and `gspot fix` never writes to it.

**Alternatives.** A per-file declaration list. Separate keys for "are migrations immutable" and
"from which version". A third state that reports without failing.

**Evidence.** Immutability is not a property of a file; it is a statement about whether a migration
has run somewhere you cannot rebuild. A pre-launch project resets production, a squash workflow
rewrites history deliberately, and a dev-only database has nothing immutable. So no default is
correct, and guessing produced the worst outcome in the reference set: sixteen shipped migrations
edited to satisfy two lint rules.

**Why one key and not two.** A second key that only matters in one mode is an option that goes
stale. The version is the boundary, `"none"` and `"all"` are its two ends, and one value covers all
three cases.

**Why two states and not three.** "Report, do not fail, do not fix" is a warning level, and D-07
rejects those. If the reader may edit the file it is not frozen; if not, a finding is noise.

**Why the fixer matters more than the reporter.** A reporting-only freeze leaves `sqlfluff format`
free to rewrite shipped SQL on the next `gspot fix`. The freeze is enforced where files get written,
not only where findings get printed.

## D-33 Three database presets, so the general work stays reusable

**Decision.** `language:sql` for the language, `database:postgres` for nine Postgres checks,
`platform:supabase` for five product-specific ones.

**Alternatives.** One `platform:supabase` preset holding everything, which is what the reference
monorepo's rule file implies.

**Evidence.** Row-level security, explicit grants, `SECURITY DEFINER` search paths, migration
safety, migration order, object naming, index coverage for foreign keys and blocking DDL are
Postgres facts. Putting them behind a product name makes them unavailable to a Neon, RDS, Drizzle or
Prisma project for no reason. Nine of the eighteen non-language checks are general.

**The shape it sets.** Every database preset that follows requires `database:postgres` and adds only
what its own tooling dictates.

## D-34 Node first; the single binary follows when the grammars allow it

**Decision.** v0 ships as an npm package that requires Node. The compiled binary for Python-only and
Swift-only repositories lands when the native grammar modules can be bundled or loaded from a
sidecar, and not before.

**Evidence.** Every reference repository already has Node. `yap-text-inference` carries a
`package.json` and `bun.lock` for three JavaScript tools today, so requiring Node changes nothing
for it. The binary is a real improvement and an unproven build, so it is not on the critical path.

## D-35 Scopes are flat

**Decision.** A scope is a subtree with its own preset selection, and scopes do not nest. Root presets
apply everywhere.

**Evidence.** Both reference monorepos are one level deep. Nesting would make preset resolution and
settings merge order-dependent for a case that does not exist yet. When a three-level workspace
appears, this decision is revisited against a real tree.

## D-36 Two rule-file targets in v0

**Decision.** The assembler writes `CLAUDE.md` and `AGENTS.md`. Other agent targets are emitters
over the same document model and arrive on demand.

**Evidence.** Every reference repository uses exactly these two. MegaLinter's eight targets prove
the emitter needs more outputs eventually; nothing proves it needs them now.

## D-37 The corpus merge takes content from the longest fork and form from slopshop

**Decision.** Per file, the longest fork is the base for **content**, because the shorter forks are
mostly the longer ones with sections removed. `slopshop` is the base for **form**: sentence-case
headings, imperative mood, and every mechanical rule deferred to its formatter. `yap-text-inference`
supplies the word `control` wherever `yap-swift-app` has the corrupted `command`.

**Assignment.** The importer does the classification, the split, the near-duplicate detection and
the heading re-casing. A person resolves the conflict list it prints and rewrites modals to
imperatives. That person is whoever runs `gspot init` on the first repository to adopt the rules
layer, and the result is the shipped corpus for everyone after.

## D-38 `DOCUMENTATION.md` keeps what an agent needs before the linter runs

**Decision.** A statement survives when an agent needs it to write correct text the first time. It
goes when the agent would learn the same thing from the linter in one round trip.

**Applied.** Heading case, the dash ban, present-state prose, contents-list accuracy and file-path
rules stay, because an agent writes a whole document before any linter sees it. Fence style,
emphasis style, table alignment, list indentation and line width go, because Prettier and
markdownlint settle them on the first run and restating them is a second source of truth. Roughly
2,300 of 4,088 lines go.

## D-39 gspot owns only the `mise.toml` tool pins it introduced

**Decision.** `[tools]` entries gspot wrote are recorded by name in `.gspot/tools.lock` and merged;
a consumer's own pins are never changed. When both sides pin a tool and the consumer's version is
below what a check needs, gspot reports both versions and stops. It does not upgrade somebody
else's toolchain on their behalf.

**Evidence.** `yap-swift-app` pins `ansible-core`, `deno` and `supabase` for product reasons in the
same block. Owning the whole block would stop a consumer pinning a product tool, which is not
acceptable.

## D-40 A consumer registers its own checks through the same manifest shape

**Decision.** `gspot.toml` accepts `[[check]]` entries with the same fields a preset check has: `id`,
`command`, `inspects`, `takes`, `stage`, `gate` and `file_list`. A consumer check joins the task
graph and the coverage report like any other.

**Alternatives.** No surface, so a consumer runs its own scripts outside the gate.

**Evidence.** `slopshop` has sixteen application-specific integrity checks and `yap-landing` has
four. Without a surface, every consumer keeps a `quality/` folder beside gspot, which is the thing
the distribution exists to remove. The check contract is already declarative, so this is a manifest
entry pointing at a consumer script, not a plugin system.

## D-41 Asset orphan detection ships and reports three numbers

**Decision.** `repository:assets` reports resolved-and-used, resolved-and-unused, and unresolvable
references. It fails on the second only and prints the third.

**Evidence.** 982 PNG files in the reference tree, referenced from Swift, TypeScript and
asset-catalogue JSON, some by constructed names. A check that says "40 unused, 120 unresolvable" is
useful; one that says "40 unused" without the caveat is not.

## D-42 The repository stays private until told otherwise, and nothing in the design depends on it

**Decision.** `gspot` is private today and the design assumes that. If it goes public, two things
change: the Vale style packages are fetched by `gspot install` rather than vendored, and the
rule corpus ships as a separate package so an organisation can keep its engineering opinions private
while using the public tooling. Neither changes any other document.

## D-43 Policy is edited in `gspot.toml`; a command exists only where a hand edit cannot do the job

**Decision.** Fourteen commands. No command writes `gspot.toml`. Limits, terms, declarations,
exceptions, migrations and presets are edited in the file and applied with `gspot generate`.

**Alternatives.** A command per table, which an earlier surface had: `limits set`,
`terms add`, `terms exempt`, `migrations freeze-through`, `declare`,
`presets --add`, `tools pin`, `checks disable`.

**Evidence.** Each of those wrote one TOML line the person could have written,
and several pairs wrote the same table (`checks disable` and `exceptions add`),
which is two ways to do one thing. `run` duplicated the task runner the
repository already chose. `baseline` duplicated what `init` and `generate` do when
they meet findings. `rules report` was one flag on `report`. Nineteen commands
became fourteen: `why`, `terms test` and `coverage --explain` were three answers to
"explain this" and are one `explain`; `tools` had one verb, so `tools install` is `install`, the way `bun install` installs what a project needs, and the file that was always the source of truth is now also the
only editor.

## D-44 The CLI is built on commander, @clack/prompts and listr2

**Decision.** Command parsing and help on commander; the `init` wizard on
@clack/prompts; the live check list on listr2. Every operation is a plain
function in the package that owns it, callable with no terminal, and the command
modules hold parsing and output only. No other terminal library is a dependency.

**Alternatives.** oclif, which brings a plugin architecture and a generator at
roughly fifty times the installed size; clipanion, whose v4 has been a release
candidate since 2024; citty, which is tied to one ecosystem; ink, which is React
in the terminal and more than a check list needs.

**Evidence.** commander is the dependency behind Vue CLI and Create React App at
fifty million weekly installs and 220 kB. gspot's presets are data, so a plugin
system has nothing to host. @clack/prompts is what current scaffolding tools use
and is a fifth the size of its alternatives. listr2 is the maintained successor
to listr and does exactly one thing: nested task lists with spinners, which is
what forty checks running at once need.

### D-45 The CLI aligns with the CLIs people already use

Verb subcommands, `--help` per command, `--version`, shell completion, `NO_COLOR`
and non-terminal detection, distinct exit codes, an `uninstall` that inverts
`init`, and `init --yes` as the one-command install. Each is what `git`, `cargo`,
`ruff`, `mise`, `gh` or `pre-commit` does, and none is new. See [16-cli.md](16-cli.md).

### D-46 0.1.0 first, semantic versioning

The version goes into every generated header and into `coverage.json`, and
`upgrade` compares it with the binary.

### D-47 init replaces the tool configuration it owns, and touches nothing else

A configuration file for a tool gspot generates is read, carried into
`gspot.toml`, and deleted, because two configurations for one tool is drift.
A tool whose job a gspot check now does is removed whole, config and dependency
and scripts, with each removal listed; a tool with no gspot equivalent is left
gets a proposed `[[check]]`. A hook runner is replaced. CI is edited only after a yes at init. The exact table is in [17-lifecycle.md](17-lifecycle.md).

### D-48 gspot's pin wins for its own tools, the project's for TypeScript

A dev dependency gspot uses is set to gspot's pin and the change is listed. An
explicit conflicting pin fails with both values, never a silent winner. TypeScript
is the project's dependency, because types must resolve against the code, and
gspot states a minimum.

### D-49 i18n is its own block

`library:next-intl`, selected by any i18n library, installs `rules/shared/i18n/I18N.md`.
It left `nextjs/` because the text is not Next.js-specific.

### D-50 Preset kinds are true kinds

`framework:` held fifteen presets of which six were frameworks. A prefix that lies teaches the
reader the wrong thing. Now: `language:`, `framework:`, `library:`, `tool:`, `database:`,
`platform:`, `repository:`. A preset goes under what it is. `framework:node` is removed because
Node is a runtime and its checks were HTTP checks; those, with `HTTP-API.md` and `OPENAPI.md`, are
the shared `http` package that every HTTP framework preset lists in `shared`. The i18n block is the
shared `i18n` package, listed by `library:next-intl`, `library:i18next` and `library:react-intl`.
`repository:static-site` replaces `framework:static-site` because its checks are properties of the
whole repository. Rule folders follow the kinds, plus `rules/shared/`.

## Rejected

| Option                                                                      | Why not                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Biome** instead of ESLint plus Prettier                                   | Faster and simpler, and it does not host the eighteen structural rules, the sonarjs complexity metric, the boundaries plugin or the type-aware rules. Its `useNamingConvention` is genuinely good and does not reach the banned-term policy. Revisit when custom rules land. |
| **MegaLinter as the engine**                                                | D-01 and D-24. Its descriptor model is adopted; its gating model, its five exclusion mechanisms, its Docker-first execution and its run-but-do-not-fail mode are not. [01-findings.md](01-findings.md).                                                                      |
| **lefthook or prek as the hook runner**                                     | Both are good, and both add a dependency plus a second configuration file plus a second place where stage assignment lives. The task graph already owns stage assignment. A three-line hook that calls `gspot` needs no manager.                                             |
| **A `pylint` custom checker plugin for the banned terms**                   | A plugin where a rule file reaches: `bad-names-rgxs` is configuration and a checker is code.                                                                                                                                                                              |
| **`mypy` alongside `basedpyright`**                                         | basedpyright at `typeCheckingMode: "all"` is stricter and faster. mypy earns a place only where a framework ships a mypy plugin the type checker needs.                                                                                                                      |
| **A fourth secret scanner**                                                 | gitleaks and trufflehog saturate the finding space. `kingfisher` and `betterleaks` would add noise and one more allowlist.                                                                                                                                                   |
| **oxlint** as a fast pre-pass                                               | Real speed gain, and a second rule engine means two configurations that must agree, which is D-04's failure mode. Revisit as an opt-in `--fast` mode.                                                                                                                        |
| **dependency-cruiser**                                                      | The reference decision stands: `import-x/no-cycle`, knip and `eslint-plugin-boundaries` cover what it offers.                                                                                                                                                                |
| **`pre-commit` framework**                                                  | Python-centric, no coverage model, and its own tool-version mechanism competing with mise.                                                                                                                                                                                   |
| **A single monolithic config file per tool, hand-written**                  | This is what the reference repositories do, and the cost is in [01-findings.md](01-findings.md).                                                                                                                                                                             |
| **Per-preset semantic versioning**                                            | D-04.                                                                                                                                                                                                                                                                        |
| **Untracked generated config**                                              | D-03.                                                                                                                                                                                                                                                                        |
| **A warning layer**                                                         | D-07.                                                                                                                                                                                                                                                                        |
| **Vendoring the ASD-STE100 dictionary for simplified-English prose checks** | The dictionary is copyrighted. `RedHat.SimpleWords` and `write-good.TooWordy` approximate it, as the reference plan concluded.                                                                                                                                               |
| **Linting build output**                                                    | D-30.                                                                                                                                                                                                                                                                        |
| **`format` or `style` on a generated file**                                 | D-30. The generator is the only edit site.                                                                                                                                                                                                                                   |
| **A `--just-ignore-it` flag**                                               | Every declaration names which kind of thing it is, because the kind decides which checks still run.                                                                                                                                                                          |
| **A gspot-hosted SQL SAST engine**                                          | No maintained tool exists, and writing one is a different product. Compensated in `platform:supabase`.                                                                                                                                                                      |
| **Auto-migrating the settings file on upgrade**                             | D-29.                                                                                                                                                                                                                                                                        |
| **A dependency bot as the upgrade mechanism**                               | D-28. It bumps a version and leaves every generated file stale.                                                                                                                                                                                                              |
| **Floating tool versions**                                                  | D-28. A lint run that resolves versions from the network is neither reproducible nor offline-capable.                                                                                                                                                                        |
| **`aspect:` and `doctrine:` as preset kinds**                                 | D-27.                                                                                                                                                                                                                                                                        |
