# Gates

Where checks run, what happens when one cannot run, and how a repository with a backlog adopts a
strict gate without turning rules off.

The instruction this answers: include CI and git hooks, with a choice, and probably not combined.

## The two surfaces

|                             | Git hooks                                                 | CI                       |
| --------------------------- | --------------------------------------------------------- | ------------------------ |
| Runs                        | On the developer's machine, before commit and before push | On a runner, after push  |
| Latency limit               | Seconds. A developer waits.                               | Minutes. Nobody waits.   |
| Bypassable                  | `--no-verify`, and the hook can be uninstalled            | No                       |
| Sees the working tree       | Yes, including staged-only content                        | No, only what was pushed |
| Can gate a merge            | No                                                        | Yes                      |
| Needs the toolchain locally | Yes, all of it                                            | No                       |
| Build and container checks  | Painful                                                   | Natural                  |
| Network checks              | Never                                                     | Natural                  |

The reference set is entirely on the first column. `yap-swift-app` has 104 mise tasks, two git hooks
and no `.github/`, and its own audit says so: "There is no continuous integration, so the two git
hooks are the only gate anywhere," and "Without CI there is no second line."

MegaLinter is entirely on the second column: a Docker image built for CI, with a `pre-commit` hook
definition bolted on that shells into the container.

## Why not both by default

Running the same checks in both places is the failure mode, for four reasons that all showed up in
the reference set:

1. **Two definitions drift.** `yap-swift-app` already runs markdownlint twice per push from two
   different task paths, and the second run exists because somebody could not tell whether the first
   one covered it.
1. **The slow set degrades the fast surface.** A hook that runs the whole tree plus four scanners
   plus a container build takes minutes, so developers use `--no-verify`, and then neither surface
   gates.
1. **The skip surface doubles.** Sixteen `SKIP_*` variables exist because the hooks carry work that
   belongs in CI. Move that work and most of the variables have no reason to exist.
1. **Cost.** Every check in CI is billed per push. Every check in a hook is paid in developer
   seconds. Paying twice for the same finding is the definition of waste.

## The three modes

`gspot init` asks one question and offers three answers.

### Mode `hooks`

For a repository with no CI, or one that does not want a `.github/` directory. The reference
monorepo's position.

```text
.githooks/commit-msg    gspot check --stage commit-msg
.githooks/pre-commit    gspot check --stage pre-commit
.githooks/pre-push      gspot check --stage pre-push
core.hooksPath = .githooks
```

- `pre-commit`: every `fast` check over staged paths, plus `slow` checks for the affected scopes,
  plus `gspot sync --check` and `gspot coverage --diff`.
- `pre-push`: everything except a `network` requirement, over the whole tree, plus the full coverage, limits
  and baselines.
- `network` checks (external link verification, advisory database refresh) are in the graph and run
  only from `gspot check`, which a human runs.

Honest limitation, printed at init: `--no-verify` bypasses all of it, and nothing gates a merge. One
line, no lecture.

### Mode `ci`

For a repository with CI that wants the gate there and nothing local.

```text
.github/workflows/gspot.yml
```

- one job for checks that require nothing, one for those that need a build, one for those that need the network, running in parallel.
- A matrix only where the toolchain genuinely differs: macOS for the Swift and Xcode checks, Linux
  for everything else.
- No hooks installed. `gspot check --since origin/main` is what a developer runs by hand.
- Findings surface as SARIF, so they appear inline on the pull request.

Honest limitation, printed at init: a developer finds out about a lint failure after a push and a
wait, which is the slowest feedback loop of the three.

### Mode `split` (recommended)

Not "both". A partition, with each check in exactly one place, decided by what each check requires.

| Requires          | Hook                                                 | CI                    |
| ----------------- | ---------------------------------------------------- | --------------------- |
| nothing           | pre-commit over staged paths, pre-push over the tree | the whole tree, again |
| `build`, `docker` | never                                                | yes                   |
| `network`         | never                                                | yes                   |

The rule that makes it a partition rather than a duplication: **a check runs in a hook only when it
is cheap enough that a developer would rather wait than push.** Everything else is CI's, and the
hook does not attempt it.

The one deliberate overlap: CI re-runs the `fast` and `slow` sets over the whole tree, because a
hook only ever saw the staged set and the affected scopes. That overlap is not a duplicate
definition, it is the same node of the graph invoked with a different scope, and the run report says
which scope it ran over.

In `split` mode the hooks get measurably smaller, which is the point:

|                                        | `hooks` mode pre-push | `split` mode pre-push |
| -------------------------------------- | --------------------- | --------------------- |
| Checks                                 | ~40                   | ~18                   |
| Container builds                       | 3                     | 0                     |
| Security scanners                      | 4                     | 0                     |
| Full coverage                          | yes                   | yes, diff only        |
| Typical duration on the reference tree | minutes               | seconds               |

## What CD means here

The instruction says CI and CD. gspot's CD surface is narrow on purpose, because deployment is the
consumer's product and gspot has no business in it. Three things:

| Thing                   | What gspot does                                                                                                                                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Release gating**      | A `release` task in the graph that runs `gspot check --all` plus the checks marked the `release` stage: `publint`, `attw`, licence attribution, and the coverage check asserted at zero gaps. A deployment that has not passed the gate is a deployment gspot refuses to bless. |
| **Artefact provenance** | The run report and SARIF are the record. the GitHub CI emitter uploads both, plus the coverage check, as build artefacts, so "what was checked at this commit" is answerable later.                                                                                        |
| **Deployment tasks**    | Emitted as graph nodes only where the consumer already has them. `yap-swift-app` has 18 deploy tasks under `.mise/tasks/supabase/deploy/` and `api/deploy/`; those stay the consumer's, under their own names, and gspot's collision check leaves them alone.              |

gspot does not deploy, does not manage environments, and does not own release versioning. The
GitHub CI emitter writes a workflow that gates. The release emitter, optional, writes nothing but
a `gspot check --stage release` step into whatever workflow the consumer already has.

## The hook runner

The hook scripts are three lines each and call `gspot`. Considered and rejected: **lefthook** and
**prek** are good hook managers, and adopting one adds a dependency, a second configuration file and
a second place where stage assignment lives. The task graph already owns stage assignment, and a
hook that delegates to it needs no manager.

`gspot hooks install` writes the three files, sets `core.hooksPath`, and refuses to overwrite an
existing hook it did not write. `gspot hooks uninstall` reverses it. A `pre-commit` framework
definition is emitted on request for repositories already standardised on that framework, and it
calls the same graph.

## Skip policy

The evidence: sixteen `SKIP_*` variables in `yap-swift-app`, one of which (`SKIP_SECURITY_SCANS`)
disables four scanners at once, plus `--no-verify` and no CI. The audit's own words: "Without CI
there is no second line."

The design:

1. **Skips are off by default.** No environment variable disables a check unless the repository opts
   in.
1. **Opting in is tracked and per check.** `gspot.toml` carries
   `skip_allowed = ["docker/nginx-config"]`, which is a loosening entry with a reason, an owner and
   an expiry.
1. **A local skip is untracked.** `gspot.local.toml` carries `skip = [...]` for a machine that has
   no Docker today. It never reaches another developer.
1. **Every skip prints and is recorded.** stderr at the time, plus a row in the run report, plus a
   line in the coverage check.
1. **Skipped fails the gate** unless a exception covers it. See [05-coverage.md](05-coverage.md).
1. **`--no-verify` is not gspot's problem, and CI is the answer.** The GitHub CI emitter preset exists
   for exactly that reason and is off by default, per the reference repository's stated preference.
   gspot prints one line at init saying which gate the repository does not have.

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
  "expires": "2026-12-16",
  "owner": "api",
  "paths": { "api/tests/unit/turn.test.ts": 7, "...": 0 }
}
```

Semantics:

- The rule is **on**, at error severity.
- The run fails when the count **exceeds** the baseline.
- A run whose count is **below** the baseline rewrites the baseline down and fails with "baseline
  lowered, commit the new baseline". The count never rises by accident and never drifts down
  silently.
- `expires` is required. At expiry the baseline must be zero, or the gate fails. There is no renewal
  without an explicit commit that moves the date, and `gspot exceptions` lists every baseline with
  its remaining days.
- Per-path counts make the baseline work at pre-commit: a touched file must not grow its own count,
  so the backlog cannot migrate.

That converts five shelved rules in `yap-swift-app` and the 119 unenforced qlty smells from
"measured, left off" into scheduled work with a date.

## Limits

Two counters, both asserted at pre-push:

| Counter           | Source                                                                                                                                                    | Failure                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Exception limit   | `[exceptions]` entries in `gspot.toml`                                                                                                                    | Count above `limit`, or any entry expired                             |
| Suppression limit | In-code suppressions: `eslint-disable`, `@ts-expect-error`, `# noqa`, `# type: ignore`, `swiftlint:disable`, `shellcheck disable`, `nosemgrep`, `# nosec` | Count above the per-kind ceiling, or any suppression missing a reason |

`yap-swift-app` tracks these counts by hand in a Markdown table across a branch diff:
`eslint-disable` 5 to 5, `@ts-expect-error` 1 to 1, `lint:justify` 28 to 28, `swiftlint:disable` 4
to 6. That table is the right idea and the wrong medium. gspot computes it:

```text
suppressions
  eslint-disable       5 / 8     all carry a description
  @ts-expect-error     1 / 2     all carry a description
  swiftlint:disable    6 / 6     AT CEILING
                                 ios/Yap/Views/Feed.swift:42 redundant_self
                                 no reason given -> FAIL
  shellcheck disable  24 / 30    all carry a reason
  nosemgrep            6 / 6     AT CEILING
```

Every suppression syntax is required to carry a reason, enforced by the tool that owns it where
possible (`@eslint-community/eslint-comments/require-description`,
`reportUnusedDisableDirectives: "error"`, Ruff `PGH004`), and by a gspot check where the tool has
none (`swiftlint:disable`, `shellcheck disable`, `nosemgrep`).

The reason format is one shape, validated:

```text
reason: <sentence>. owner: <team>.
```

No ticket field. `yap-swift-app` requires a ticket and twelve of 28 suppressions say `N/A`, eight
say `linting-config`, three say `linting-codeql`. A field nobody fills honestly is worse than no
field, so the requirement is an owner that must match `[owners]` in `gspot.toml`.

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

Every invocation writes `.gspot/run/<timestamp>.json` and updates `.gspot/run/latest.json`.
Untracked. The report is the thing that makes "did it actually check" answerable.

```json
{
  "gspot": "0.1.0",
  "task": "hook:pre-push",
  "startedAt": "2026-09-16T09:12:00Z",
  "durationMs": 184320,
  "verdict": "failed",
  "checks": [
    { "id": "ts/eslint", "scope": "api", "status": "ran", "findings": 0, "paths": 512, "durationMs": 21400 },
    { "id": "docker/nginx", "scope": "api", "status": "skipped", "reason": "docker daemon unavailable", "excepted": false },
    { "id": "sql/squawk", "scope": "supabase", "status": "ran", "findings": 0, "paths": 3, "note": "migrations after 20260415175157" },
    { "id": "swift/analyze", "scope": "ios", "status": "ran", "findings": 2, "paths": 724 }
  ],
  "coverage": { "unchecked": 0, "partial": 0, "partial": 0, "orphan": 0 },
  "exceptions": { "used": 7, "max": 12 },
  "suppressions": { "swiftlint:disable": { "used": 6, "max": 6 } },
  "baselines": [{ "rule": "vitest/expect-expect", "baseline": 100, "count": 100, "expires": "2026-12-16" }]
}
```

Also emitted: SARIF at `.gspot/run/latest.sarif`, so findings load into an editor or a code-scanning
surface without gspot implementing either. Findings from tools that already emit SARIF (Semgrep,
CodeQL, trivy) pass through; findings from tools that do not are converted by the preset's parser.

`gspot report` prints the human summary. `gspot report --failed` prints only the failing checks,
with the exact command to reproduce each one in isolation. That last property matters more than it
sounds: `yap-swift-app` runs 40 tools through 104 tasks, and reproducing one failure means reading
shell.

## Verdict rules

The gate fails when any of these hold:

| Condition                                                                              | Source            |
| -------------------------------------------------------------------------------------- | ----------------- |
| Any check reports findings                                                             | the check         |
| Any check reports `skipped` without a exception                                           | skip policy       |
| Any coverage status is `unchecked`, `partial` undeclared, `partial`, or `orphan` | coverage          |
| Any generated file differs from its render                                             | `gspot sync --check`    |
| Any glob matches nothing, or names a missing file                                      | `gspot sync --check`    |
| Any baseline count exceeds its baseline, or a baseline expired above zero              | baseline          |
| Any limit is exceeded, or any exception expired                                           | limits            |
| Any suppression lacks a valid reason or owner                                          | suppression check |
| Any tool in `tools.lock` is missing or fails its checksum                              | tool installer       |

Nine conditions, all machine-checked, none of them a comment in a config file.
