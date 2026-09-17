# The Model

Seven ideas carry the whole design: preset, inspection, claim, status, settings, scope and check.
Everything else is plumbing.

## Three separate jobs

The reference repositories mix these three and pay for it. gspot separates them, and each concern
has exactly one source of truth.

| Job           | Question it answers                               | Source of truth                                                   | Emitted to                                                       |
| ------------- | ------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Toolchain** | Which binaries, at which versions, obtained how   | Preset `tools` blocks, resolved into one lockfile                   | `mise.toml` `[tools]`, or `.gspot/tools.lock` plus `.gspot/bin/` |
| **Policy**    | Which rules, with which options, over which files | Preset `configs` and `checks` blocks, merged with the settings file | `.gspot/generated/*`, plus stub files at conventional paths      |
| **Rules**     | Which prose an agent reads before editing         | Rule preset layers                                                  | `CLAUDE.md`, `AGENTS.md`, `rules/`                               |

One never reaches into another. Policy names a tool by id and version constraint and the toolchain resolves it. Rules state a rule
in prose and name the check that enforces it; they do not configure the check.

That last link is a design feature, not decoration. Every rule statement carries an `enforced-by`
annotation naming a check id, or the annotation `unenforced`. A rules lint reports the unenforced
count, which is the honest version of the `yap-swift-app` section titled "Enforcement on paper
only".

## Preset

A preset is the unit of selection, the unit of versioning and the unit of documentation. A consumer
selects presets; nothing else.

Seven kinds, defined here and nowhere else. A preset goes under the kind that names what it is, not the nearest one; a library is not a framework and a test runner is not either:

| Kind                      | Examples                                                                                                                                                                                                                                       | Claims files                        | Ships rules                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------- |
| `language:`               | `language:typescript`, `language:javascript`, `language:python`, `language:swift`, `language:bash`, `language:sql`, `language:markdown`, `language:css`, `language:html` | Yes, by extension                   | Yes, the language layer      |
| `framework:`              | `framework:nextjs`, `framework:express`, `framework:fastapi`, `framework:swiftui`, `framework:uikit`, `framework:comfyui`                                                                          | Yes, by path convention
| `library:`                | `library:zod`, `library:drizzle`, `library:trpc`, `library:tanstack-query`, `library:zustand`, `library:react-hook-form`, `library:next-intl`, `library:i18next`                                                                          | Yes, by path convention
| `tool:`                   | `tool:docker`, `tool:nginx`, `tool:xcode`, `tool:vitest`, `tool:pytest`, `tool:swift-testing`                                                                          | Yes, by path convention
| `database:`               | `database:postgres`                                                                          | Yes, by path convention
| `platform:`               | `platform:supabase`, `platform:cloudflare`                                                                          | Yes, by path convention             | Yes, the framework layer     |
| `repository:`             | `repository:structure`, `repository:naming`, `repository:prose`, `repository:secrets`, `repository:vulnerabilities`, `repository:dependencies`, `repository:licenses`, `repository:commits`, `repository:duplication`, `repository:formatting`, `repository:configuration`, `repository:spelling`, `repository:assets`, `repository:static-site` | Cross-cutting, often the whole tree | Sometimes, the general layer |

Selection rules:

- the general rules and `repository:structure` are implied by any `language:` preset and removable
  only explicitly.
- A `framework:` preset declares its `language:` requirements and pulls them in.
- A preset declares conflicts. the mise runner conflicts with the bun runner.
- Presets are versioned as one distribution. There is no per-preset version, because the interesting
  failure mode is drift between presets, and a single version removes it. See
  [19-decisions.md](19-decisions.md), D-07.

## Inspection

An inspection is a thing a check looks for, not a tool. Inspections are the axis on which coverage is
measured, because "linted" is too coarse to be honest: a file that only `typos` reads is not linted
in any useful sense, and the `yap-swift-app` audit says exactly that about 982 images and nine TOML
files.

| Inspection | Meaning                                                                       | Example providers                                                         |
| ------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `format`      | Byte-level canonical form, fixable                                            | Prettier, Ruff format, shfmt, SwiftFormat, taplo fmt                      |
| `syntax`      | The file parses under its real grammar                                        | `bash -n`, `tsc`, Ruff, `plutil -lint`, `taplo check`                     |
| `schema`      | The file validates against a published schema                                 | check-jsonschema, taplo with SchemaStore, validate-pyproject, actionlint  |
| `style`       | Idiom and rule-set conformance                                                | ESLint, Ruff check, SwiftLint, sqlfluff, stylelint, yamllint, hadolint    |
| `types`       | Static type checking                                                          | tsc, basedpyright, swiftc through xcodebuild                              |
| `structure`   | File and module shape: length, triviality, barrels, boundaries, imports, dead code | gspot structure engine, `import-linter`, `eslint-plugin-boundaries`, knip |
| `naming`      | Identifier and path vocabulary                                                | gspot naming engine                                                       |
| `prose`       | Comment and documentation text                                                | Vale                                                                      |
| `spelling`    | Lexical                                                                       | typos                                                                     |
| `security`    | Credentials and vulnerable patterns                                           | gitleaks, trufflehog, Semgrep, CodeQL, bandit                             |
| `dependencies`        | Dependency health: advisories, licences, unused, duplicated, version skew          | osv-scanner, trivy, knip, deptry, syncpack, pip-audit                     |
| `duplication` | Copy-paste detection                                                          | jscpd, qlty smells                                                        |
| `links` | Links resolve | lychee, linkinator |
| `accessibility` | Rendered-page accessibility | pa11y, html-validate |
| `output` | Properties of built output: size, performance, reproducibility | size-limit, lighthouse-ci, preset checks |
| `freshness` | A generated or frozen file still matches its source | preset check |

Inspections are ordered by strength for coverage purposes: `spelling` and `security` are **weak**
(byte-level, no grammar). Everything else is **strong**. A file whose only coverage is partial
inspections is reported as shallowly covered and requires a declaration. That single rule converts
eight of the eleven `yap-swift-app` blind spots from invisible into loud.

## Claim

A claim is the statement "check C inspects path P for K". Claims are the unit the
coverage check counts.

The critical property: **a claim is derived by asking the tool, not by reading a manifest**. A preset
supplies a `file_list` for each check, and the file listing returns the set of paths the tool would actually
process, under the configuration gspot generated, in the repository as it exists now.

File listing mechanisms, strongest first:

| Mechanism                  | Tools                                                                                                                                                                           | How                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native file listing        | Ruff (`ruff check --show-files`), Prettier (`prettier --list-different` over the candidate set), stylelint, sqlfluff (`--nofail` over candidates and parse the ignored notices) | The tool names the files                                                                                                                                       |
| Per-file config resolution | ESLint (`eslint --print-config <path>`), `markdownlint-cli2`                                                                                                                    | Ask per candidate; a file with no matching config is unchecked                                                                                                 |
| Project graph              | tsc (`tsc --listFiles`), knip, `import-linter`, xcodebuild (`-showBuildSettings` plus the file list)                                                                            | The tool reports its own graph, which also catches files the graph silently omits                                                                              |
| Ignore-file replay         | typos, gitleaks, ShellCheck, shfmt                                                                                                                                              | gspot replays the tool's documented ignore semantics against the candidate set, and the replay is unit-tested against the tool with a fixture per ignore idiom |
| Declared, unverifiable     | a small set named explicitly in [05-coverage.md](05-coverage.md)                                                                                                                | The preset asserts, and the assertion is annotated as unverified in the coverage check report                                                                    |

Ignore-file replay is the weakest mechanism and the one that broke `yap-swift-app`: gitignore
semantics turned `sql/` into a pattern that matched two nested directories nobody intended. gspot
therefore treats replay as a tested unit, run against the real tool, and prefers a native listing whenever the
tool has one.

## Status

Every tracked path lands in exactly one status. The coverage check computes them and fails on the
ones marked as failures.

| Status          | Meaning                                                                                                               | Gate                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `covered`       | At least one strong inspection claims it, and the required inspections for its type is satisfied                          | pass                                                    |
| `partial`       | Claimed, but an inspection its required list needs is missing, or claimed only by weak kinds                          | **fail** unless declared in `[[declare]]` with a reason |
| `generated`     | A `[[declare]]` names the task that produces it, or a `linguist-generated` attribute says so; still receives `security` and `format` | pass                                                    |
| `vendored`      | Declared third-party; receives `security` and `dependencies` only                                                           | pass                                                    |
| `binary`        | Not text, per git attribute or content sniff; receives `security` and the asset policy if `repository:assets` is on        | pass                                                    |
| `excepted`      | An explicit exception with a reason                                                                                   | pass                                                    |
| `unchecked`     | No claim at all                                                                                            | **fail**                                                |
| `orphan`        | A configuration artifact or rule file that no check reads                                                             | **fail**                                                |

Three failure modes, three exit paths, no silence. There is no "unknown".

## Settings

The settings file is the consumer's half of the check configuration. One tracked file, `gspot.toml`,
plus one untracked file, `gspot.local.toml`, for machine-local skips. gspot reads both and writes
neither.

The settings file is typed. Every extension point is a named setting with a declared merge operation,
so the consumer never edits a generated file and never needs to fork a preset. Three operations:

- `add` appends to a list, deduplicated. Adding a typo exception, an excluded path, a naming
  exemption, a license, a vocabulary term.
- `remove` subtracts from a list. Removing a rule from a selected family.
- `set` replaces a scalar. Changing a line length, a complexity threshold.

An operation that loosens a rule carries a reason and appears in every run report. That is the
whole ceremony. No cap, no expiry, no owner registry.

This is the answer to "add allowed typos and excluded functions without changing gspot code", and
the guard against that mechanism becoming the way rules quietly die. Full detail in
[06-settings.md](06-settings.md).

## Scope

A scope is a subtree with its own preset selection. A single-project repository has one scope at the
root. `yap-swift-app` has four: `api`, `supabase`, `ios` and the root.

```toml
[[scope]]
path  = "api"
presets = ["language:typescript", "framework:express", "tool:docker"]

[[scope]]
path  = "supabase"
presets = ["language:typescript", "language:sql", "database:postgres", "platform:supabase"]

[[scope]]
path  = "ios"
presets = ["language:swift", "tool:xcode"]
```

Scope rules:

- Root presets apply to the whole tree. Scope presets apply to their subtree.
- Scopes do not nest. D-35.
- A path outside every scope is still in the coverage check tracked files, and is covered by root
  presets or fails as unchecked. This is the mechanism that catches `.mise/tasks/`, `.githooks/` and
  the lint package itself, which is where 129 shell files hid in `yap-swift-app`.
- Scope invalidation follows policy inputs. A change to `gspot.toml` or to any generated config
  invalidates every scope that config governs, which fixes the pre-commit bug where editing lint
  policy never re-lints the project it governs.

## The check

A check is the atomic unit the task graph schedules and the coverage check counts.

```text
id             structure/function-length
preset         repository:structure
inspects       structure
tools          eslint, pylint, swiftlint, counter
takes          project          one-file | file-list | project
stage          pre-commit
requires       none
file_list      print-config
fails_on       finding-count, zero
fix            none
tool_errors    [{regex: "...", message: "..."}]
skip_when      none
```

Properties every check declares:

- `inspects`, so the coverage check can attribute coverage.
- `requires`, a list drawn from `build`, `network` and `docker`, empty for most checks.
  Stage follows from it: a check that requires nothing runs in a hook, and the rest run
  where the requirement is met. That is why `swiftlint lint --strict` lands at pre-commit
  and `swiftlint analyze`, which needs a build, does not.
- `fails_on`, one of `exit-code`, `finding-count` or `parsed-output`, with a counting regex where the
  tool's exit code does not reflect findings. Declaring this is what stops a `qlty smells`
  situation, where a blocking mode is configured and the command exits zero on 119 findings. There
  is no `warn` value and no run-but-do-not-fail mode.
- `file_list`, so coverage is measured rather than claimed.
- `skip_when`, a predicate that reports whether the check could not run, for example a Docker
  daemon that is down. A true predicate produces `skipped(reason)`. A platform skip passes; every
  other skip fails. [09-gates.md](09-gates.md).
- `takes`, one of `one-file`, `file-list` or `project`, taken from MegaLinter's
  `cli_lint_mode`. It determines both the takes shape and the file listing strategy, and a tool that
  supports several declares the set so the fast mode and the accurate mode are distinguishable.
- `tool_errors`, a list of output patterns that mean the tool itself broke rather than the code
  being bad, each with a remediation message. Taken from MegaLinter's `common_linter_errors`. A gate
  that fails because pylint could not parse its own configuration must not look like a gate that
  failed because the code is wrong.
