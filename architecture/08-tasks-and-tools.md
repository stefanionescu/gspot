# Runner, Tasks and Tool Tool installation

Requirement R12: set up mise tasks, or let the consumer pick bun or npm. The design separates the
task graph, which is canonical, from the runner, which is a surface, and from tool installation, which is
where the honesty has to live.

## One graph, three surfaces

gspot owns the task graph. A runner emitter projects it onto a surface the consumer's ecosystem
already understands. Every emitted task calls `gspot check` with the matching flags, so the
graph has one implementation and the runner is a surface for humans, editors and muscle memory.

```text
                   gspot task graph  (presets contribute nodes)
                            |
        +-------------------+-------------------+
        |                   |                   |
      mise                 bun                 npm
   .mise/tasks/**      package.json        package.json
   mise.toml [tools]   scripts             scripts
        |                   |                   |
        +-------------------+-------------------+
                            |
                     gspot check
```

## The graph

A task is a named node with dependencies and a check list. Presets contribute nodes; the resolver
composes them.

```toml
[[tasks]]
name        = "lint:ts"
description = "Type check and lint TypeScript"
checks      = ["ts/tsc", "ts/eslint"]
scope       = "per-scope"          # per-scope | repo
stage       = "pre-commit"

[[tasks]]
name        = "lint"
description = "Every check"
deps        = ["lint:ts", "lint:sql", "lint:shell", "lint:prose", "coverage"]
```

Node identity is the task name plus the scope. The resolver deduplicates, so a check reachable from
two tasks runs once per invocation. `yap-swift-app` runs markdownlint twice per push, and
`repo:lint:quality` contains markdownlint while pre-push also calls it directly. A graph removes the
class.

### The canonical task set

The names are stable across every repository gspot touches, which is the point: one vocabulary,
whatever the language.

| Task              | Contents                                                    |
| ----------------- | ----------------------------------------------------------- |
| `setup`           | Install tools, fetch Vale styles, install hooks, run `sync` |
| `sync`            | Render every generated config                               |
| `sync --check`          | Drift check plus glob and referent assertions               |
| `coverage`        | Full coverage                                               |
| `format`          | Every formatter, write mode                                 |
| `format:check`    | Every formatter, check mode                                 |
| `lint`            | Every style, structure, naming and type check               |
| `lint:<lang>`     | One language                                                |
| `lint:prose`      | Vale                                                        |
| `lint:docs`       | markdownlint plus lychee                                    |
| `typecheck`       | Every type checker                                          |
| `test`            | Test runners, per scope                                     |
| `security`        | secrets, sast, deps                                         |
| `licenses`        | License policy                                              |
| `dependencies`            | Unused, duplicated, skewed, vulnerable                      |
| `check`           | Everything. The single command a human runs.                |
| `fix`             | Every fixable check, write mode                             |
| `hook:pre-commit` | Stage-filtered subset                                       |
| `hook:pre-push`   | Whole-tree subset                                           |
| `hook:commit-msg` | commitlint                                                  |

`yap-swift-app` has 104 tasks and `yap-text-inference` has 35, both with different naming schemes
(`repo:lint:quality` against `lint:quality`, `api:test:e2e:standard` against `test:e2e:live`).
Product tasks stay the consumer's, under their own names; gspot owns only the names above, and a
collision fails at emit time with both definitions named.

## Emitters

### the mise runner

The closest to what three of the four repositories already do.

- `mise.toml` `[tools]` gets every tool pin, rendered from the resolved toolchain. Other blocks are
  preserved.
- `[settings] not_found_auto_install = false` and `[settings.task] run_auto_install = false`,
  matching both reference repositories: a lint run must not install anything mid-run.
- `.mise/tasks/<name>` per node, as a file task with a `#MISE description=` line. gspot writes these
  as generated files with a provenance header, in a `.mise/tasks/gspot/` subtree, and `mise.toml`
  aliases the canonical names to them so a consumer task of the same name is still possible.
- Tool backends used: direct pins, `pipx:` for Python-distributed tools, `github:` for release
  assets, `aqua:`/`ubi:` where mise resolves them. `yap-swift-app` already uses
  `github:Bearer/bearer`, `github:qltysh/qlty`, `pipx:semgrep`, `pipx:sqlfluff` and
  `pipx:ansible-core`.

### the bun runner and the npm runner

- `package.json` `scripts` gets one entry per canonical task, each calling `gspot check` with the task's flags.
  The scripts are the surface; gspot resolves the graph. This keeps `package.json` small and stops
  the graph from being duplicated in JSON.
- Existing scripts are preserved. gspot writes only names it owns, and a collision fails.
- Tool acquisition is the hard part, below.

## Tool installation: the honest table

Under the mise runner, every tool is a pin and this section is short. Under the bun runner or the
npm runner, a decision has to be made per tool, because most of these binaries are not npm packages.

| Tool                                                                                                                                                                                                                | npm?    | bun or npm mode                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| ESLint, Prettier, TypeScript, knip, syncpack, `markdownlint-cli2`, stylelint, commitlint, jscpd, `sort-package-json`, `license-checker-rseidelsohn`                                                                 | yes     | dev dependency                                                                 |
| lychee                                                                                                                                                                                                              | no      | download, checksummed                                                          |
| typos                                                                                                                                                                                                               | no      | download, checksummed (`typos-cli` exists on crates.io, not npm)               |
| ShellCheck                                                                                                                                                                                                          | partial | download, checksummed. The npm wrappers are third-party and unpinned upstream. |
| shfmt                                                                                                                                                                                                               | no      | download, checksummed                                                          |
| gitleaks, trufflehog, osv-scanner, trivy, hadolint, taplo, Vale, Squawk, actionlint                                                                                                                                 | no      | download, checksummed                                                          |
| Ruff, basedpyright, deptry, vulture, interrogate, pydoclint, bandit, pip-audit, pip-licenses, pyproject-fmt, validate-pyproject, `import-linter`, sqlfluff, yamllint, check-jsonschema, ansible-lint, dotenv-linter | no      | `uv tool run` against a pinned `uv.lock`. `uv` itself is downloaded.           |
| SwiftLint, SwiftFormat, Periphery                                                                                                                                                                                   | no      | download for macOS; Homebrew is a fallback the consumer opts into              |
| xcodebuild, plutil, xcstringstool                                                                                                                                                                                   | no      | Xcode. Present or the check is skipped, and skipped fails.                     |
| Semgrep, CodeQL                                                                                                                                                                                                     | no      | download; CodeQL is opt-in and slow                                            |
| Docker, nginx                                                                                                                                                                                                       | no      | Docker. Present or the check is skipped, and skipped fails.                    |
| Deno                                                                                                                                                                                                                | no      | download, for Supabase edge functions                                          |

`gspot install` reads `.gspot/tools.lock`, downloads what is missing into `.gspot/bin/`, verifies
the SHA-256 recorded in the lock, and refuses on a mismatch. The lock is tracked. Platform and
architecture are keys in the lock, so a Linux CI runner and a macOS laptop resolve different assets
from the same file.

Three properties:

- **No network access during a lint run.** Tool installation is its own task, and the lint tasks fail
  with "run gspot install" rather than fetching.
- **A tool that cannot be installed is named, with the checks it gates.** `gspot doctor` prints
  exactly which checks are unavailable and what coverage is lost:

```text
tool      swiftlint 0.63.2        missing
          gates  swift/swiftlint, swift/swiftlint-analyze
          effect 724 .swift files lose kind style
          fix    gspot install, or install Xcode command line tools
coverage  would report 724 paths as partial
```

- **Missing does not mean skipped.** The coverage check still fails. The message above is the
  diagnosis, not a pass.

The recommendation is mise, and gspot says so at init: one file, one pin per tool, every backend
already solved. the bun runner exists because a Next.js repository with three tools has no reason to
adopt a version manager, and the npm runner exists because some repositories are told which package
manager to use.

## Stage assignment

Stage derives from what a check requires, never from habit. This is the rule that puts `swiftlint lint --strict` in
pre-commit, where `yap-swift-app` has it in no hook at all although it needs no build.

| Requires         | Meaning                                | Default stage                                              |
| ---------------- | -------------------------------------- | ---------------------------------------------------------- |
| nothing          | Runs from source alone                 | pre-commit over staged paths; pre-push over the whole tree |
| `build`, `docker` | Needs a compile or a running daemon   | pre-push under `hooks`; CI under `split`                   |
| `network`        | Needs the network                      | CI, or `gspot check` by hand. Never a hook.                |

Pre-commit runs the staged-path subset for `fast` and the affected scopes for `slow`. Pre-push runs
the whole tree.

### Scope invalidation

`yap-swift-app` pre-commit lints a project only when a file under its prefix is staged, so editing
`quality/eslint/api/*` never re-lints `api/` until push. The fix: a scope's checks are invalidated
by its sources **and** by its policy inputs. Policy inputs are `gspot.toml`, every generated config
the scope's checks read, and every preset file when gspot itself is the repository being linted. The
file cache is keyed on the same hash, so the invalidation and the cache agree by construction.

## Fix mode

Every check declares whether it has a fixer. `gspot fix` runs the fixable set in a fixed order,
because order matters: formatters last, since a linter fixer rewrites code that the formatter then
reflows.

```text
1  codemod-class fixers        eslint --fix, ruff check --fix, stylelint --fix
2  import and export ordering  eslint --fix with the import rules only
3  manifest normalisation      sort-package-json, pyproject-fmt, taplo fmt
4  formatters                  prettier, ruff format, shfmt, swiftformat, sqlfluff fix
5  re-run every check          to prove the fixers converged
```

Step 5 is not optional. Two fixers that disagree loop, and the reference set has a live example of
the shape: Prettier realigns every table row while the documentation rule says not to, and
markdownlint sets list indentation to four while the documentation rule says two. gspot resolves
those at config generation time (one `[format]` block) and asserts convergence at fix time.
