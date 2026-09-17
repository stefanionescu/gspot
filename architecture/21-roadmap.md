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

The whole design rests on D-02, reported by the tool claims. If file listings cannot be made reliable, nothing
else matters, so this phase comes before any preset work.

| Deliverable                                                                       | Acceptance                                                                                         |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/coverage/` with the tracked file list and the six file listing mechanisms | Runs over this repository                                                                     |
| One small tree per ignore idiom, beside the test in `src/coverage/`               | A test per file listing asserting the replay matches the real tool                                        |
| `gspot explain`                                                        | Produces the `.sqlfluffignore` explanation in [16-cli.md](16-cli.md) verbatim                      |
| Two presets only: `language:sql` and `language:bash`                                | Chosen because SQL is where coverage broke worst and Bash is where the extensionless problem lives |

**Kill criterion.** If the ignore-replay file listings cannot be made to agree with the real tools across
the fixture set, `ignore-replay` is downgraded to `declared` and the design has to admit that a
class of tools cannot be verified. That is a worse product, and it is better to know in phase 0.

## Phase 1: the tool

| Deliverable                                                                     | Notes                                                       |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| The command surface on commander, the `init` wizard on @clack/prompts, live check output on listr2. Fourteen commands, each operation a plain function the tests call with no terminal. | [16-cli.md](16-cli.md) names the three libraries and the two rules. No other terminal library enters. |
| Preset reading, with the manifest invariants                                        | Including the orphan-config and orphan-check rules          |
| `src/settings`: schema, typed merge, reasons on loosening entries      | The `gspot config` surface                                   |
| Config generation: the three mechanisms, provenance headers, `gspot generate --check`     | Drift, glob emptiness, missing referents                    |
| Task graph and the mise runner                                                  | The runner three of four reference repositories already use |
| Run report and SARIF output                                                     |                                                             |
| Gate logic: the eight verdict conditions                                         |                                                             |
| `gspot init`, `generate`, `check`, `coverage`, `generate --check`, `report`                   |                                                             |

At the end of phase 1, gspot lints a SQL-and-Bash repository completely, with total coverage proved,
and fails for the right reasons.

## Phase 2: structure and naming, declaratively

Reshaped by D-19 and D-20. This phase is now mostly rule files and emitters rather than an engine.

| Deliverable                                                                              | Notes                                                                                        |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| ast-grep runner: rule-file loading, SARIF-shaped output, `ERROR` and `MISSING` rejection | D-06. The rejection is in the runner, so every rule file gets it.                            |
| ast-grep rule files for the fourteen declarative structural rules, per language          | Roughly 50 YAML files. Zero analysis code.                                                   |
| the finding counter, the generic finding counter with a ceiling                                | Serves `barrel-ceiling`, Bash complexity, and every future rule needing a threshold          |
| The directory walk: single-file folders, prefix collisions                               | Roughly 60 lines, shared by every language                                                   |
| Line counters for Bash and SQL                                                           | Roughly 60 lines                                                                             |
| Unused-function reachability for Bash and SQL                                            | Roughly 200 lines. The only substantial original analysis in the distribution.               |
| Shell branch, nesting and mutable-assignment rules                                       | ast-grep plus the finding counter. Zero code, from `yap-text-inference`'s thresholds.              |
| Naming policy document plus five emitters                                               | `naming-convention`, pylint regexes, SwiftLint block, sqlfluff config, ls-lint config. D-20. |
| Whole-part matcher semantics, with sample names                                              | D-21. The correction to the reference substring matcher.                                     |
| the parity test                                                                 | Runs in the test suite for any grammar or rule-file change                                         |
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
1. `language:swift`. Needs the ast-grep Swift grammar and the Xcode file listings, which are the most
   unproven part of the design.
1. `language:css`, `language:html` and `repository:static-site`. Driven by `yap-landing`, and cheap:
   `html-validate`, `purgecss`, `linkinator`, `svgo` and `size-limit` do nearly all of it.

## Phase 4: repository presets

| Preset                                                                 | Notes                                                          |
| -------------------------------------------------------------------- | -------------------------------------------------------------- |
| `repository:spelling`, `repository:formatting`, `repository:commits` | Trivial, high value                                            |
| `repository:secrets`                                                 | Plus the exception consolidation of three parallel allowlists     |
| `repository:dependencies`, `repository:licenses`                     | Plus the `Package.resolved` extractor                          |
| `repository:vulnerabilities`                                         | Wiring the 40 existing Semgrep rules, split across three presets |
| `repository:duplication`, `repository:assets`                        |                                                                |

## Phase 5: prose

Separate phase because Vale has its own install checks and its own two-stage adoption.

| Deliverable                                                            | Notes                                                                              |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/prose`: grammar dispatch, stdin mapping, JSON output parsing      |                                                                                    |
| The `gspot` style, ten rules, every one an error | A rule with findings at install gets a baseline, like any other rule |
| Vendored package pins in `tools.lock`                                  | Google, Microsoft, write-good, proselint, alex, RedHat                             |
| Install checks in `gspot doctor --prose`                               | The four install checks from [11-prose.md](11-prose.md)                                    |
| Adjacent enforcement rules                                             | ESLint `no-restricted-syntax` selectors, Ruff `EM` and `G`, SwiftLint custom rules |
| Harper                                                                 | Last, spelling rules off                                                           |

## Phase 5.5: gate delivery

Small, and it unblocks adoption in repositories that want CI as well as hooks.

| Deliverable                                                              | Notes                                                |
| ------------------------------------------------------------------------ | ---------------------------------------------------- |
| `[gate] hooks` and `[gate] ci`                                           | D-23, [09-gates.md](09-gates.md)                     |
| CI emitters for GitHub Actions, GitLab CI and Buildkite; `actionlint` and `zizmor` over the GitHub one | The workflow gspot emits is itself linted            |
| Check-result cache, with `cached` as a distinct status                   | Both surfaces need it, one implementation            |
| Parallel scheduling over the graph                                       | Where a four-scope monorepo gets its wall clock back |
| `release` task: `publint`, `attw`, licence attribution, coverage at zero | The CD half, narrow by design                        |

## Phase 6: rules

| Deliverable                                                            | Notes                                                                                                     |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Front matter schema, layer rules                                       |                                                                                                           |
| `src/rules` with the assembler                                         |                                                                                                           |
| Resolve conflicts C-01 through C-17                                    | Decided in [10-rules.md](10-rules.md), applied once                                                       |
| the general layer corpus                                                | Merged from four forks, plus four files with no source text (`SUPPRESSIONS.md`, `TOOLING.md`, `CONFIGURATION.md`, `GIT.md`) |
| the language layer corpus                                             | Including the `NAMING.md` split at its language headings                                                  |
| the framework layer corpus                                            | Including the `slopshop` library files, which need the least work                                         |
| the project layer templates                                           | From Category C: roughly 1,270 lines of one project's architecture                                        |
| Parameterized examples                                                 | The mechanism that removes the reason the forks diverged                                                  |
| Category A deletion pass                                               | Roughly 2,300 lines of `DOCUMENTATION.md` that restate a formatter                                        |
| `gspot report --rules`, and the rules lint as a check in the graph                           |                                                                                                           |
| The importer, for `gspot init` on a repository with an existing corpus | The R11 deliverable                                                                                       |

This phase is the largest by line count and the smallest by code. Most of it is editing      00 lines
of existing Markdown down to a shared corpus, and the mechanical parts (the split, the layer
classification, the conflict report) are what the importer automates.

## Phase 7: frameworks, runners, CI

| Deliverable                                                                                          | Notes                |
| ---------------------------------------------------------------------------------------------------- | -------------------- |
| `platform:supabase`, `framework:nextjs`, `framework:express`, `tool:xcode`, `framework:fastapi` |                      |
| Test-runner presets                                                                                    |                      |
| the bun runner, the npm runner, the checksummed tool installer                                          |                      |
| the GitLab CI and Buildkite emitters                                                                 |                      |
| `init` detection and takeover, `upgrade`, `doctor`, `explain`, `config`                                     | The adoption surface |

## The v0 cut

Phase 0 through 3, plus `repository:spelling`, `repository:formatting`, `repository:structure` and
`repository:naming`, plus the mise runner, plus hooks, plus
`gspot init/sync/check/coverage/report/fix`.

That is a tool that:

- Covers TypeScript, JavaScript, Bash, SQL, Markdown, Dockerfile, the data formats, Python, Swift,
  CSS and HTML completely, with coverage proved.
- Runs the eighteen structural rules and the 103-term naming policy across every one of those
  languages, from a small amount of original analysis code plus rule files.
- Generates every config, detects drift, and fails on a coverage gap.
- Emits mise tasks and git hooks.
- Has no rules, no Vale, no CI mode, no security presets.

It is enough to replace all four reference `quality/` folders, which is the measure that matters:
159 files in one, 139 in another, 118 in a third, 79 in the fourth.

Two things are deliberately not in v0, and both are named because they are the ones a reader would
expect to be:

- **Rules.** Phase 6, because the corpus merge is editorial work across four
  divergent forks and the gate is useful without it. `gspot init --rules none` is the v0 default.
- **Vale.** Phase 5, because its install checks and its two-stage adoption are their own problem and
  the mechanical checks earn trust first.

## Validation gates per phase

Every phase ends with the same three assertions:

1. **Self-lint.** `gspot check` on `gspot`, with the presets shipped so far and no `[[exception]]`
   entry. This is the integration test and it is the first one to pass, not the last.
1. **Coverage parity.** The expected path table for this repository is checked in, and any change to
   it is a reviewed diff. A phase that loses coverage fails here.
1. **Structure parity.** Any adapter or grammar change produces a superset of the previous record
   set, per D-06.

There is no set of golden repositories. A tree built to mirror `yap-swift-app` proves the tool works
on `yap-swift-app`. What the self-lint cannot reach is a language this repository does not contain,
so a preset for Swift or SQL is proven once, by hand, against a real repository that has them, with
the result recorded in the pull request. [03-repo-layout.md](03-repo-layout.md) has the unit-test
breakdown.

## Sequencing risks

| Risk                                                                                             | Mitigation                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Xcode file listings (`-showBuildSettings`, pbxproj parsing) are the least proven part of the design | `language:swift` is fifth in phase 3, so four presets ship before the risk lands. If file listings prove unreliable, Swift files fall back to a `declared` claim, annotated as unverified. |
| ast-grep Swift grammar quality is unknown                                                        | Same position in the order. D-06's `ERROR` rejection makes a weak grammar loud rather than silent.                                                                                    |
| The rules merge is tens of thousands of lines of editorial work across three divergent forks                   | Phase 6, after the tooling is useful on its own. `gspot init --rules none` means the gate ships without waiting for the prose.                                                          |
| Vale behaviour changes across versions                                                           | Install checks assert the verified behaviours, and a pinned version in `tools.lock`.                                                                                             |
| The coverage check is too slow for pre-commit                                                    | `coverage --diff` plus the file cache, both in phase 0, so the performance question is answered before anything is built on top.                                                     |
