# Contributing

You work on gspot in a source checkout with [mise](https://mise.jdx.dev). Every task below runs
on your machine. None of them needs a GitHub run.

## Setup

```sh
mise install
mise run repo:setup
```

`repo:setup` installs the locked dependencies and prepares the grammar files. It also builds
the ESLint plugin of the workspace and generates the content types the documentation build
reads. After you change the plugin, run `mise run build:plugin` before the repository
checks.

## Verification

Run these tasks before a commit, in this order. Each task stops on its own failures.

Run them from the repository root, so mise selects the pinned runtimes. The tests check the Bun
version against `package.json` at startup. A plain `bun test` can pick an older Bun from your
`PATH`.

| Task                       | What it verifies                                                           |
| -------------------------- | -------------------------------------------------------------------------- |
| `mise run check:types`     | TypeScript in the workspace and in the documentation site.                 |
| `mise run test`            | The unit and integration tests, without native tools or the network.       |
| `mise run test:tools`      | The pinned tools, run over the generated configuration.                    |
| `mise run test:acceptance` | Planted repositories, checked end to end through a local registry.         |
| `mise run test:package`    | The two npm packages, built, published to a local registry, and installed. |
| `mise run check`           | The checks of this repository, run from source.                            |

The full acceptance suite stops after 90 minutes. Each test also has its own time limit. To run
some of it, pass files or folders:

```sh
mise run test:acceptance -- acceptance/source/kits/css.test.ts acceptance/source/cli/hooks
```

Some tool installers download a binary from GitHub. Without a token, GitHub allows 60 requests
an hour, which a cold install can use up. Before an acceptance run, set `GITHUB_TOKEN` to a
token that can read public releases.

## Policy and generated files

`gspot.toml` is the policy of this repository. Change it with `gspot set`, `gspot ignore`,
`gspot add`, or `gspot remove`, then run `mise run apply` to write the files under `.gspot/`
again. Do not edit a generated file by hand. `integrity/generated-drift` reports a generated
file that differs from the policy.

## Commits

Every commit message follows the conventional format: `type(scope): Subject`.

- The types are `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, and `chore`.
- The scopes are `cli`, `eslint-plugin`, `docs`, `root`, `hooks`, and `deps`.

The commit hook runs `gspot check --staged`, which reads only what you staged.

## CI results

CI runs on every pull request, on Linux, macOS, and Windows. To run it on a branch without a
pull request, start the `ci` workflow by hand. The check job uploads `.gspot/reports/report.json`
and the SARIF reports of the commit. A failed job names its task. Run that task locally with
the same arguments to reproduce the failure. A failed shard of the suite runs the same files
again with `mise run test:acceptance -- --shard=<k>/<n> --timings=timings/<system>.json`.
