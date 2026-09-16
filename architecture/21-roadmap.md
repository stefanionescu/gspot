# Roadmap

Ordered so that each phase is usable on its own and the riskiest thing is proved first.

## Before phase 0

The repository holds `architecture/` and `reference-rules/`, and nothing else.
`reference-rules/<repository>/` is every rule file and agent index from the five
reference repositories, copied verbatim and never edited in place, plus `merged/`, the first pass of the
merge in [10-rules.md](10-rules.md). No configuration,
no tasks, no tool pins. The first lint run on this repository is `gspot init`,
executed by the tool this design describes, at the end of phase 1.

## Phase 0: prove the coverage check

The whole design rests on D-02, reported by the tool claims. If the files each check reads cannot be made reliable, nothing
else matters, so this phase comes before any preset work.

| Deliverable                                                                       | Acceptance                                                                                         |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `packages/gspot/src/coverage/` with the tracked file list and the six the files a check reads kinds | Runs over `fixtures/monorepo/`                                                                     |
| `fixtures/ignore-semantics/` with one file per ignore idiom                       | A test per the files a check reads asserting the replay matches the real tool                                        |
| `gspot explain`                                                        | Produces the `.sqlfluffignore` explanation in [16-cli.md](16-cli.md) verbatim                      |
| Two presets only: `language:sql` and `language:bash`                                | Chosen because SQL is where coverage broke worst and Bash is where the extensionless problem lives |

**Kill criterion.** If the ignore-replay the files each check reads cannot be made to agree with the real tools across
the fixture set, `ignore-replay` is downgraded to `declared` and the design has to admit that a
class of tools cannot be verified. That is a worse product, and it is better to know in phase 0.

## Phase 1: the tool

| Deliverable                                                                     | Notes                                                       |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| The command surface on commander, the `init` wizard on @clack/prompts, live check output on listr2. Fifteen commands, each operation a plain function the tests call with no terminal. | [16-cli.md](16-cli.md) names the three libraries and the two rules. No other terminal library enters. |
| Preset loader with the manifest invariants                                        | Including the orphan-config and orphan-check rules          |
| `packages/settings`: schema, typed merge, direction classifier, exception limit | The `gspot config` surface                                   |
| Config generation: the three mechanisms, provenance headers, `gspot sync --check`     | Drift, glob emptiness, missing referents                    |
| Task graph and the mise runner                                                  | The runner three of four reference repositories already use |
| Run report and SARIF output                                                     |                                                             |
| Gate logic: the nine verdict conditions                                         |                                                             |
| `gspot init`, `sync`, `check`, `coverage`, `sync --check`, `report`                   |                                                             |

At the end of phase 1, gspot lints a SQL-and-Bash repository completely, with total coverage proved,
and fails for the right reasons.

## Phase 2: structure and naming, declaratively

Reshaped by D-19 and D-20. This phase is now mostly rule files and renderers rather than an engine.

| Deliverable                                                                              | Notes                                                                                        |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| ast-grep runner: rule-file loading, SARIF-shaped output, `ERROR` and `MISSING` rejection | D-06. The rejection is in the runner, so every rule file gets it.                            |
| ast-grep rule files for the fourteen declarative structural rules, per language          | Roughly 50 YAML files. Zero analysis code.                                                   |
| the finding counter, the generic finding counter with a ceiling                                | Serves `barrel-ceiling`, Bash complexity, and every future rule needing a threshold          |
| The directory walk: single-file folders, prefix collisions                               | Roughly 60 lines, shared by every language                                                   |
| Line counters for Bash and SQL                                                           | Roughly 60 lines                                                                             |
| Unused-function reachability for Bash and SQL                                            | Roughly 200 lines. The only substantial original analysis in the distribution.               |
| Shell branch, nesting and mutable-assignment rules                                       | ast-grep plus the finding counter. Zero code, from `yap-text-inference`'s thresholds.              |
| Naming policy document plus five renderers                                               | `naming-convention`, pylint regexes, SwiftLint block, sqlfluff config, ls-lint config. D-20. |
| Whole-part matcher semantics, with fixtures                                              | D-21. The correction to the reference substring matcher.                                     |
| the parity test                                                                 | The release gate for any grammar or rule-file change                                         |
| Configured-rule mapping for the four rules at a configured rule                                | `import-x`, `perfectionist`, `sonarjs`, `unicorn` options                                    |

**Kill criterion.** If ast-grep rule files cannot express `trivial-function` and `call-through` with
acceptable precision across TypeScript, Python and Swift, D-19 is wrong for those two rules and they
fall back to a plugin, an ESLint rule plus a Semgrep rule. Test that pair first, before authoring
the other twelve.

## Phase 3: the language presets

In order of reference-repository need:

1. `language:typescript` and `language:javascript`. The largest preset, 836 files in the reference
   tree, and the one with the most existing policy to translate.
1. `repository:configuration`. Closes three blind spots for little code, because taplo, yamllint and v8r do the
   work.
1. `language:markdown`, `tool:docker`.
1. `language:python`. The tool matrix plus the pylint complement list plus the Python ast-grep rule
   files. Zero original Python. The 139-file bespoke layer in `yap-text-inference` maps entirely
   onto configuration and phase 2.
1. `language:swift`. Needs the ast-grep Swift grammar and the Xcode the files each check reads, which are the most
   unproven part of the design.
1. `language:css`, `language:html` and `repository:static-site`. Driven by `yap-landing`, and cheap:
   `html-validate`, `purgecss`, `linkinator`, `svgo` and `size-limit` do nearly all of it.

## Phase 4: aspects

| Preset                                                                 | Notes                                                          |
| -------------------------------------------------------------------- | -------------------------------------------------------------- |
| `repository:spelling`, `repository:formatting`, `repository:commits` | Trivial, high value                                            |
| `repository:secrets`                                                 | Plus the exception consolidation of three parallel allowlists     |
| `repository:dependencies`, `repository:licenses`                     | Plus the `Package.resolved` extractor                          |
| `repository:vulnerabilities`                                         | Wiring the 40 existing Semgrep rules, split across three presets |
| `repository:duplication`, `repository:assets`                        |                                                                |

## Phase 5: prose

Separate phase because Vale has its own install the files each check reads and its own two-stage adoption.

| Deliverable                                                            | Notes                                                                              |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/prose`: grammar dispatch, stdin mapping, JSON output parsing |                                                                                    |
| The `gspot` style, 28 rules, every one an error | A rule with findings at install gets a baseline with an expiry, like any other rule |
| Vendored package pins in `tools.lock`                                  | Google, Microsoft, write-good, proselint, alex, RedHat                             |
| Install the files each check reads in `gspot doctor --prose`                               | The four the files each check reads from [11-prose.md](11-prose.md)                                    |
| Adjacent enforcement rules                                             | ESLint `no-restricted-syntax` selectors, Ruff `EM` and `G`, SwiftLint custom rules |
| Harper                                                                 | Last, spelling rules off                                                           |

## Phase 5.5: gate delivery

Small, and it unblocks adoption in repositories that want CI rather than hooks.

| Deliverable                                                              | Notes                                                |
| ------------------------------------------------------------------------ | ---------------------------------------------------- |
| The three gate modes: `hooks`, `ci`, `split`                             | D-23, [09-gates.md](09-gates.md)                     |
| the GitHub CI emitter with `actionlint` and `zizmor` over its own output | The workflow gspot emits is itself linted            |
| Check-result cache, with `cached` as a distinct status                   | Both surfaces need it, one implementation            |
| Parallel scheduling over the graph                                       | Where a four-scope monorepo gets its wall clock back |
| `release` task: `publint`, `attw`, licence attribution, coverage at zero | The CD half, narrow by design                        |

## Phase 6: rules

| Deliverable                                                            | Notes                                                                                                     |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Front matter schema, layer rules                                       |                                                                                                           |
| `packages/rules` with the assembler                                    |                                                                                                           |
| Resolve conflicts C-01 through C-15                                    | Decided in [10-rules.md](10-rules.md), applied once                                                       |
| the general layer corpus, twelve files                                 | Merged from four forks, plus four new files (`SECRETS.md`, `SUPPRESSIONS.md`, `TOOLING.md`, `WRITING.md`) |
| the language layer corpus, sixteen files                               | Including the `NAMING.md` split at its language headings                                                  |
| the framework layer corpus, seventeen files                            | Including the `slopshop` library files, which need the least work                                         |
| the project layer templates, four files                                | From Category C: roughly 1,270 lines of one project's architecture                                        |
| Parameterized examples                                                 | The mechanism that removes the reason the forks diverged                                                  |
| Category A deletion pass                                               | Roughly 2,300 lines of `DOCUMENTATION.md` that restate a formatter                                        |
| `gspot report --rules`, and the rules lint as a check in the graph                           |                                                                                                           |
| The importer, for `gspot init` on a repository with an existing corpus | The R11 deliverable                                                                                       |

This phase is the largest by line count and the smallest by code. Most of it is editing 38,000 lines
of existing Markdown down to a shared corpus, and the mechanical parts (the split, the layer
classification, the conflict report) are what the importer automates.

## Phase 7: frameworks, runners, CI

| Deliverable                                                                                          | Notes                |
| ---------------------------------------------------------------------------------------------------- | -------------------- |
| `platform:supabase`, `framework:nextjs`, `framework:express`, `tool:xcode`, `framework:fastapi` |                      |
| Test-runner presets                                                                                    |                      |
| the bun runner, the npm runner, the checksummed tool installer                                          |                      |
| the GitHub CI emitter                                                                                |                      |
| `init` detection and takeover, `upgrade`, `doctor`, `explain`, `config`                                     | The adoption surface |

## The v0 cut

Phase 0 through 3, plus `repository:spelling`, `repository:formatting`, `repository:structure` and
`repository:naming`, plus the mise runner, plus the `hooks` gate mode, plus
`gspot init/sync/check/coverage/report/fix`.

That is a tool that:

- Covers TypeScript, JavaScript, Bash, SQL, Markdown, Dockerfile, the data formats, Python, Swift,
  CSS and HTML completely, with coverage proved.
- Runs the eighteen structural rules and the 102-term naming policy across every one of those
  languages, from roughly 560 lines of original analysis code and 50 rule files.
- Generates every config, detects drift, and fails on a coverage gap.
- Emits mise tasks and git hooks.
- Has no rules, no Vale, no CI mode, no security presets.

It is enough to replace all four reference `quality/` folders, which is the measure that matters:
159 files in one, 139 in another, 118 in a third, 79 in the fourth.

Two things are deliberately not in v0, and both are named because they are the ones a reader would
expect to be:

- **Rules.** Phase 6, because the corpus merge is 41,540 lines of editorial work across four
  divergent forks and the gate is useful without it. `gspot init --no-rules` is the v0 default.
- **Vale.** Phase 5, because its install the files each check reads and its two-stage adoption are their own problem and
  the mechanical checks earn trust first.

## Validation gates per phase

Every phase ends with the same three assertions, run over the fixtures:

1. **Coverage parity.** The expected path table for `fixtures/monorepo/` is checked in, and any
   change to it is a reviewed diff. A phase that loses coverage fails here.
1. **Self-hosting.** `gspot` passes its own gate with the presets shipped so far, with no exemption
   block.
1. **Structure parity.** Any adapter or grammar change produces a superset of the previous record
   set, per D-06.

## Sequencing risks

| Risk                                                                                             | Mitigation                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Xcode the files each check reads (`-showBuildSettings`, pbxproj parsing) are the least proven part of the design | `language:swift` is fifth in phase 3, so four presets ship before the risk lands. If the files each check reads prove unreliable, Swift files fall back to a `declared` claim, annotated as unverified. |
| ast-grep Swift grammar quality is unknown                                                        | Same position in the order. D-06's `ERROR` rejection makes a weak grammar loud rather than silent.                                                                                    |
| The rules merge is 38,000 lines of editorial work across three divergent forks                   | Phase 6, after the tooling is useful on its own. `gspot init --no-rules` means the gate ships without waiting for the prose.                                                          |
| Vale behaviour changes across versions                                                           | Install the files each check reads assert the four verified behaviours, and a pinned version in `tools.lock`.                                                                                             |
| The coverage check is too slow for pre-commit                                                    | `coverage --diff` plus the file cache, both in phase 0, so the performance question is answered before anything is built on top.                                                     |
