# Gates

Where checks run, what happens when one cannot run, and how a repository with a backlog adopts a
strict gate without turning rules off.

The instruction this answers: include CI and git hooks, with a choice, and probably not combined.

## The two surfaces

|                             | Git hooks                                                 | CI                       |
| --------------------------- | --------------------------------------------------------- | ------------------------ |
| Runs                        | On the developer's machine, before commit and before push | On a runner, after push  |
| Latency limit               | Seconds at commit, minutes at push. A developer waits.    | Minutes. Nobody waits.   |
| Bypassable                  | `--no-verify`, and the hook can be uninstalled            | No                       |
| Sees the working tree       | Yes, including staged-only content                        | No, only what was pushed |
| Can gate a merge            | No                                                        | Yes                      |
| Needs the toolchain locally | Yes, all of it                                            | No                       |
| Build and container checks  | At push                                                   | Natural                  |
| Network checks              | At push                                                   | Natural                  |

The reference set is entirely on the first column. `yap-swift-app` has 102 mise tasks, two git hooks
and no `.github/`, and its own audit says so: "There is no continuous integration, so the two git
hooks are the only gate anywhere," and "Without CI there is no second line."

MegaLinter is entirely on the second column: a Docker image built for CI, with a `pre-commit` hook
definition bolted on that shells into the container.

## Both are optional, both are independent

Hooks and CI are two settings, not one mode:

```toml
[gate]
hooks = true              # true | false
ci    = "none"            # "none" | "github" | "gitlab" | "buildkite"
```

Four combinations, all valid: hooks only, CI only, both, or neither with checks run by hand. Most
teams have CI. About half have hooks. Teams with both run the fast checks in hooks and everything
in CI. gspot supports every combination and recommends none.

`init` asks two questions, "Install git hooks?" and "Set up CI?", and proposes an answer from what
the repository already has. See [17-lifecycle.md](17-lifecycle.md). Existing hooks propose yes.
Existing CI with a lint job proposes replacing that job. Existing CI with no lint job proposes
adding one. No CI proposes `none`. gspot never creates CI where none exists unless the answer is
yes, and never edits an existing workflow unless the answer is yes.

What is not allowed is two definitions of the same check. Every surface calls the same task graph
with a stage name. `yap-swift-app` runs markdownlint twice per push from two task paths because
nobody could tell whether the first covered it; that cannot happen when both paths are
`gspot check --stage <name>`.

## Every check runs locally

There is no check that only CI can run. CodeQL, Bearer, Semgrep, Trivy, osv-scanner, the gitleaks
history scan, external link verification: all of them run from `gspot check` and from the
`pre-push` hook. The four reference repositories have no CI, and every one of them runs its
scanners at push. A check that only ran in CI would be a check those repositories lose.

## Stages

A check declares what it requires: nothing, `build`, `docker` or `network`. The stage follows.

| Stage        | Runs                                                                         | Over                                      |
| ------------ | ---------------------------------------------------------------------------- | ----------------------------------------- |
| `pre-commit` | every check that requires nothing, plus `gspot generate --check` and `gspot coverage --diff` | staged paths, and the scopes whose policy changed |
| `pre-push`   | everything, including `build`, `docker` and `network`, plus baselines and the full coverage | the whole tree |
| `commit-msg` | commitlint                                                                   | the message                               |
| `ci`         | the same set as `pre-push`                                                   | the whole tree                            |

Hooks and CI run the same graph. When both are on, CI repeats `pre-push` over the pushed tree.
That is one definition invoked twice, and the run report says which surface ran it.

## CI emitters

One emitter per provider. Each writes one job that runs `gspot install` and then
`gspot check --stage ci`, and nothing else.

| Provider       | Writes                                | Notes                                                                  |
| -------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| GitHub Actions | `.github/workflows/gspot.yml`         | Findings uploaded as SARIF, so they appear inline on the pull request. |
| GitLab CI      | a `gspot` job in `.gitlab-ci.yml`     | Existing file is edited only after a yes; the job is a marked block.   |
| Buildkite      | a step in `.buildkite/pipeline.yml`   | Same.                                                                  |
| anything else  | nothing                               | Prints the two commands to paste into the provider's config.           |

A matrix only where the toolchain genuinely differs: macOS for the Swift and Xcode checks, Linux
for everything else. Adding a provider is one emitter file, not a design change.

## What CD means here

The instruction says CI and CD. gspot's CD surface is narrow on purpose, because deployment is the
consumer's product and gspot has no business in it. Three things:

| Thing                   | What gspot does                                                                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Release gating**      | A `release` task in the graph that runs `gspot check` plus the checks marked the `release` stage: `publint`, `attw`, licence attribution, and the coverage check asserted at zero gaps. A deployment that has not passed the gate is a deployment gspot refuses to bless. |
| **Artefact provenance** | The run report and SARIF are the record. The CI emitter uploads both, plus the coverage table, as build artefacts, so "what was checked at this commit" is answerable later.                                                                                             |
| **Deployment tasks**    | Emitted as graph nodes only where the consumer already has them. `yap-swift-app` has 18 deploy tasks under `.mise/tasks/supabase/deploy/` and `api/deploy/`; those stay the consumer's, under their own names, and gspot's collision check leaves them alone.              |

gspot does not deploy, does not manage environments, and does not own release versioning. The
release step, optional, is one `gspot check --stage release` line in whatever workflow the
consumer already has.

## The hook runner

The hook scripts are three lines each and call `gspot`. Considered and rejected: **lefthook** and
**prek** are good hook managers, and adopting one adds a dependency, a second configuration file and
a second place where stage assignment lives. The task graph already owns stage assignment, and a
hook that delegates to it needs no manager.

```text
.gspot/hooks/commit-msg    gspot check --stage commit-msg
.gspot/hooks/pre-commit    gspot check --stage pre-commit
.gspot/hooks/pre-push      gspot check --stage pre-push
core.hooksPath = .gspot/hooks
```

Hooks are per clone. `core.hooksPath` is git configuration, not a tracked file, so a fresh clone
has no hooks until something sets it. `gspot install` sets it when `[gate] hooks = true`, and the
runner's install task calls `gspot install`, so cloning and installing dependencies is enough.
`gspot hooks install` does the same by hand and refuses to overwrite a hook it did not write.
`gspot hooks uninstall` reverses it.

Under the bun and npm runners that install task is the `prepare` script gspot emits. A repository
whose policy bans package scripts, as `yap-swift-app` does, uses the mise runner.

Two honest limitations, printed at init, one line each and no lecture. Without CI, `--no-verify`
bypasses every hook and nothing gates a merge. And the simplest way to check nothing is to select
no preset: coverage reports what is unchecked, but a repository that selects nothing has nothing to
report against. Neither is a hole gspot can close, and both are worse when unstated.

## Skips

The evidence: sixteen `SKIP_*` variables in `yap-swift-app`, one of which (`SKIP_SECURITY_SCANS`)
disables four scanners at once. Those variables die with the hooks that read them.

- **A local skip is untracked.** `gspot.local.toml` carries `skip = ["docker/nginx-config"]` for a
  machine that has no Docker today. It never reaches another developer, and nothing in
  `gspot.toml` decides what a developer may skip on their own machine.
- **Every skip prints and is recorded.** stderr at the time, plus a row in the run report, plus a
  line in the coverage table.
- **Skipped has two meanings.** A check that cannot run on this platform, for example a type check
  whose dependencies only resolve on Linux, run on macOS, reports `skipped (platform)` and passes.
  A check that should run here but cannot, because a tool is missing or a daemon is down, reports
  `skipped (<reason>)` and fails. The check declares which case applies through `skip_when`.

## The baseline

Everything that runs is an error. There is no `warn` layer. That decision from `yap-swift-app`
stands, and it creates a real adoption problem: turning the full rule set on in `slopshop` produces
thousands of findings at once, and `yap-swift-app` responded by leaving good rules off
(`vitest/expect-expect` at 100 findings, `no_magic_numbers` at 921, `one_declaration_per_file` at
294, `type_contents_order` at 426, `strict-boolean-expressions` measured and shelved).

The baseline is the adoption device, and it is not a warning layer:

```text
.gspot/baseline/vitest-expect-expect.json
{
  "check": "ts/eslint",
  "rule": "vitest/expect-expect",
  "count": 100,
  "adopted": "2026-09-16",
  "paths": { "api/tests/unit/turn.test.ts": 7, "...": 0 }
}
```

Semantics:

- The rule is **on**, at error severity.
- The run fails when the count **exceeds** the baseline.
- A run whose count is **below** the baseline passes and prints the lower count. `gspot generate`
  writes the last run's counts into the baseline files. A hook never edits the tree. The count
  never rises by accident and never drifts down silently.
- Per-path counts make the baseline work at pre-commit: a touched file must not grow its own count,
  so the backlog cannot migrate.
- `gspot report` lists every baseline with its current count. There is no expiry and no clock.

That converts five shelved rules in `yap-swift-app` and the 119 unenforced qlty smells from
"measured, left off" into a number that can only go down.

## Suppressions

In-code suppressions (`eslint-disable`, `@ts-expect-error`, `# noqa`, `# type: ignore`,
`swiftlint:disable`, `shellcheck disable`, `nosemgrep`, `# nosec`) are counted and listed in the
run report. There is no ceiling. Every suppression carries a reason, enforced by the tool that
owns it where possible (`@eslint-community/eslint-comments/require-description`,
`reportUnusedDisableDirectives: "error"`, Ruff `PGH004`), and by a gspot check where the tool has
none (`swiftlint:disable`, `shellcheck disable`, `nosemgrep`).

```text
suppressions
  eslint-disable       5     all carry a reason
  @ts-expect-error     1     all carry a reason
  swiftlint:disable    6     ios/Yap/Views/Feed.swift:42 redundant_self
                             no reason given -> FAIL
  shellcheck disable  24     all carry a reason
  nosemgrep            6     all carry a reason
```

The reason format is one shape: `reason: <sentence>.` No ticket field, no owner field.
`yap-swift-app` requires a ticket and nine of 23 suppressions say `N/A`. A field nobody fills
honestly is worse than no field.

## Parallelism and caching

Both surfaces need this, and it is one implementation.

- **Parallel by default**, bounded by CPU count, scheduled over the graph so a node runs when its
  dependencies are done. Independent scopes run at once, which is where a four-scope monorepo gets
  most of its wall-clock back.
- **The file cache** keyed on the generated-config hash plus the candidate path list, per
  [05-coverage.md](05-coverage.md).
- **A check-result cache** keyed on the check id, the resolved tool version, the generated config
  hash and the content hash of every path in scope. A check whose inputs are unchanged is reported
  as `cached` in the run report, which is distinct from `ran` and from `skipped`, and which counts
  as a pass.
- In CI, both caches restore from the runner cache, keyed on the same hashes.

`cached` being a distinct status matters: a run where every check is cached is informative, and a
run where a check is cached because its config hash was computed wrong is a bug the report makes
visible.

## The run report

Every takes writes `.gspot/run/<timestamp>.json` and updates `.gspot/run/latest.json`.
Untracked. The report is the thing that makes "did it actually check" answerable.

```json
{
  "gspot": "0.1.0",
  "stage": "pre-push",
  "startedAt": "2026-09-16T09:12:00Z",
  "durationMs": 184320,
  "verdict": "failed",
  "checks": [
    { "id": "ts/eslint", "scope": "api", "status": "ran", "findings": 0, "paths": 512, "durationMs": 21400 },
    { "id": "docker/nginx", "scope": "api", "status": "skipped", "reason": "docker daemon unavailable", "platform": false },
    { "id": "python/types-trt", "scope": ".", "status": "skipped", "reason": "linux only", "platform": true },
    { "id": "sql/squawk", "scope": "supabase", "status": "ran", "findings": 0, "paths": 3, "note": "migrations after 20260415175157" },
    { "id": "swift/analyze", "scope": "ios", "status": "ran", "findings": 2, "paths": 724 }
  ],
  "coverage": { "unchecked": 0, "partial": 0, "orphan": 0 },
  "exceptions": 7,
  "suppressions": { "swiftlint:disable": 6 },
  "baselines": [{ "rule": "vitest/expect-expect", "baseline": 100, "count": 100 }]
}
```

Also emitted: SARIF at `.gspot/run/latest.sarif`, so findings load into an editor or a code-scanning
surface without gspot implementing either. Findings from tools that already emit SARIF (Semgrep,
CodeQL, trivy) pass through; findings from tools that do not appear in the JSON run report only.

`gspot report` prints the human summary. `gspot report --failed` prints only the failing checks,
with the exact command to reproduce each one in isolation. That last property matters more than it
sounds: `yap-swift-app` runs 40-plus tools through 102 tasks, and reproducing one failure means reading
shell.

## Verdict rules

The gate fails when any of these hold:

| Condition                                                                 | Source               |
| ------------------------------------------------------------------------- | -------------------- |
| Any check reports findings                                                | the check            |
| Any check reports `skipped` for a reason other than platform              | skip policy          |
| Any coverage status is `unchecked`, `partial` undeclared, or `orphan`     | coverage             |
| Any generated file differs from its render                                | `gspot generate --check` |
| Any glob matches nothing, or names a missing file                         | `gspot generate --check` |
| Any baseline count exceeds its baseline                                   | baseline             |
| Any suppression lacks a reason                                            | suppression check    |
| Any tool in `tools.lock` is missing or fails its checksum                 | tool installer       |

Eight conditions, all machine-checked, none of them a comment in a config file.
