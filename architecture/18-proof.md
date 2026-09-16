# Proof: The Design Run Against `yap-swift-app`

The acceptance test. `yap-swift-app` is the reference monorepo: four scopes, six languages, 3,330
tracked files, a strict gate, and eleven documented blind spots. This document walks every file
class in the tree and states its status under gspot. If a class cannot be accounted for here, the
design is incomplete.

Counts are from `git ls-files` on 2026-09-16.

## The selection

```toml
version = 1
runner  = "mise"
rules   = true

presets = [
  "language:markdown", "language:bash", "repository:configuration",
  "repository:structure", "repository:naming", "repository:prose", "repository:secrets",
  "repository:vulnerabilities", "repository:dependencies", "repository:licenses",
  "repository:commits", "repository:duplication", "repository:formatting",
  "repository:assets", "repository:spelling",
]

[[scope]]
path  = "api"
presets = ["language:typescript", "framework:express", "tool:docker", "tool:vitest"]

[[scope]]
path  = "supabase"
presets = ["language:typescript", "language:sql", "database:postgres", "platform:supabase", "tool:vitest"]

[[scope]]
path  = "ios"
presets = ["language:swift", "tool:xcode", "tool:swift-testing"]
```

Sixteen root presets, ten scope presets. The root `quality/` directory disappears, along with its 159
files and 13,451 lines.

## The coverage check, file class by file class

### Source, 1,878 files

| Class    | Count | Status  | Claims                                                                                                                          | Was                                                                                      |
| -------- | ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `.ts`    | 836   | covered | tsc, ESLint, Prettier, structure, naming, Vale, typos, Semgrep, jscpd, knip                                                     | covered, except tests untyped in `api`                                                   |
| `.swift` | 724   | covered | SwiftLint (both configs), SwiftLint analyze, SwiftFormat, structure, naming, Vale, typos, Semgrep, Periphery, jscpd, xcodebuild | style only, in no hook                                                                   |
| `.js`    | 118   | covered | ESLint, Prettier, structure, naming, Vale, typos                                                                                | ESLint with a weaker policy for `quality/`, a separate 130-line policy for two iOS files |
| `.sh`    | 99    | covered | ShellCheck, shfmt, `bash -n`, structure, naming, Vale, typos, Semgrep                                                           | ShellCheck and shfmt for all; project rules for 75 of 99                                 |
| `.sql`   | 85    | covered | sqlfluff, libpg-query, structure, naming, Vale, typos; Squawk for migrations after the baseline                                 | **25 of 85 linted**                                                                      |
| `.pgsql` | 9     | covered | as above, via `sql_file_exts`                                                                                                   | **0 linted**                                                                             |
| `.mjs`   | 7     | covered | ESLint, Prettier, structure, naming, Vale through stdin as `.js`, typos                                                         | ESLint and Prettier; Vale would have linted the whole file as prose                      |

The `.sql` and `.pgsql` rows are the headline. 94 SQL files, 25 linted, and the configuration reads
as though all of them are. Three independent gspot mechanisms catch it, described in
[13-language-presets/sql.md](13-language-presets/sql.md).

### Shell without an extension, 108 files

| Class                           | Count | Status   | Claims                                                                              | Was                                                                                                                                        |
| ------------------------------- | ----- | -------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `.mise/tasks/**`                | 102   | covered  | ShellCheck, shfmt, `bash -n`, structure, naming, Vale through stdin as `.rb`, typos | ShellCheck, shfmt, syntax, naming, function size. No doc comments, no unused-function detection, no file length, no disable justification. |
| `.githooks/**`                  | 3     | covered  | as above                                                                            | as above                                                                                                                                   |
| `api/Dockerfile`                | 1     | covered  | hadolint, buildx check, dockerfile policy, trivy config, typos                      | hadolint, trivy image when the daemon is up                                                                                                |
| `quality/security/trivy/ignore` | 1     | none     | The file disappears with `quality/`; its entries become exceptions                     | tool ignore file                                                                                                                           |
| `ios/Yap/Services`              | 1     | reported | A tracked symlink to `Info.plist`. The coverage check resolves and reports it.      | invisible                                                                                                                                  |

The 102 task files are blind spot 4, and the fix is the absence of a mechanism: there is no
`SHELL_PROJECT_RULES` prefix table in gspot, so the full shell required kinds applies everywhere by
default.

### Markdown, 21 files

| Class | Count | Status  | Claims                                                                                                                                            | Was                                                              |
| ----- | ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `.md` | 21    | covered | markdownlint, Prettier, lychee offline in hooks and online in `check`, Vale, typos, `md/toc-accurate`, `md/no-orphan-doc`, `md/fenced-code-lints` | markdownlint twice per push, lychee offline only, no prose check |

`md/no-orphan-doc` reports `rules/DOCUMENTATION.md`: 4,088 lines that no file links to and that
`CLAUDE.md` does not name. `md/fenced-code-lints` extracts the shell examples from `rules/BASH.md`,
2,433 lines of which have never been ShellCheck'd.

Prose coverage over these 21 files is 12,391 lines of text. The reference tree has 64 em dashes in
`LINTING.md` alone, against its own written ban.

### Data and configuration, 98 files

| Class                                                                                                                                 | Count | Status    | Claims                                                                                                                                            | Was                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `.json`                                                                                                                               | 50    | covered   | Prettier, `@eslint/json`, check-jsonschema, typos                                                                                                 | Prettier, typos. 28 of them excluded from both.                |
| `.yml`, `.yaml`                                                                                                                       | 17    | covered   | Prettier, yamllint, check-jsonschema, `ansible-lint` for `api/deploy/*.yml`, `docker compose config` plus Compose schema for `docker-compose.yml` | **typos and editorconfig only**                                |
| `.toml`                                                                                                                               | 9     | covered   | taplo fmt, taplo check, taplo lint, schema from SchemaStore, typos                                                                                | **typos and editorconfig only**                                |
| `.xcconfig`                                                                                                                           | 4     | covered   | xcconfig parser, key policy, no-secret-value check, typos, gitleaks                                                                               | **nothing but gitleaks, which allowlists four values in them** |
| `.entitlements`                                                                                                                       | 4     | covered   | `plutil -lint`, entitlement policy, typos                                                                                                         | **nothing**                                                    |
| `.xcstrings`                                                                                                                          | 3     | covered   | `xcstringstool`, translation completeness per locale, typos                                                                                       | **nothing**                                                    |
| `.plist`                                                                                                                              | 2     | covered   | `plutil -lint`, required-key policy, typos                                                                                                        | **nothing**                                                    |
| `.xcscheme`                                                                                                                           | 2     | covered   | XML well-formedness, target-reference resolution, shared-scheme assertion                                                                         | **nothing**                                                    |
| `.xctestplan`                                                                                                                         | 1     | covered   | schema, plus every test target appears in a plan                                                                                                  | **nothing**                                                    |
| `.storyboard`                                                                                                                         | 1     | covered   | XML well-formedness, unused-scene check                                                                                                           | **nothing**                                                    |
| `project.pbxproj`                                                                                                                     | 1     | covered   | parse, reference resolution, duplicate build files, no absolute paths, orphan-source diff                                                         | **nothing, and excluded from typos**                           |
| `Package.resolved`                                                                                                                    | 1     | covered   | pin-match assertion, plus an OSV query per pin                                                                                                    | **nothing; osv-scanner has no extractor**                      |
| `.env.example`                                                                                                                        | 2     | covered   | dotenv-linter, key completeness against source reads, secrets                                                                                     | production env guard on staged `.env.prod*` only               |
| `.nvmrc`                                                                                                                              | 1     | generated | Derived from the runner pin, or deleted                                                                                                           | **says 20, against a required range of 22**                    |
| Ignore files (`.prettierignore` x4, `.sqlfluffignore`, `.sqlfluff`, `.shellcheckrc`, `.semgrepignore`, `.syncpackrc`, `.swiftformat`) | 11    | generated | Rendered into `.gspot/generated/`, with stubs where the tool needs one                                                                            | hand-maintained, and three carry stale paths                   |

That table is blind spots 2 and 3, closed. Twenty-two files that nothing checked now have `syntax`
and `schema` at minimum, and the nine TOML files that pin the entire toolchain get schema
validation.

### Assets, 1,205 files

| Class                  | Count | Status  | Claims                                                                                                                               |
| ---------------------- | ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `.png`                 | 982   | binary  | gitleaks, trufflehog, `repository:assets`: size ceiling, dimension policy, orphan detection against source references, naming policy |
| `.jpg`                 | 112   | binary  | as above                                                                                                                             |
| `.wav`                 | 79    | binary  | as above                                                                                                                             |
| `.webp`                | 27    | binary  | as above                                                                                                                             |
| `.svg`                 | 2     | covered | Prettier, XML well-formedness, plus the asset policy                                                                                 |
| `.mp4`, `.mp3`, `.pcm` | 3     | binary  | as above                                                                                                                             |

Classification is free: `.gitattributes` already marks 60-plus media extensions with
`filter=lfs -text`, so the coverage check reads the binary status from git rather than asking.

`repository:assets` is new coverage. Orphan detection alone is worth it on 982 images: an asset
referenced from no source file is dead weight in a shipped app bundle, and nothing in the reference
tree looks for one.

### Generated, 3 files

| Path                         | Status    | Freshness                              |
| ---------------------------- | --------- | -------------------------------------- |
| `api/types/supabase.ts`      | generated | `supabase:gen:types` re-runs and diffs |
| `supabase/types/database.ts` | generated | as above                               |
| `supabase/types/deno.d.ts`   | generated | as above                               |

Still claimed for `syntax`, `types`, `format` and `secrets`. Excluded from `style` and `naming`, by
declaration rather than by a glob in four tool configs.

The freshness assertion is new. The reference tree excludes these from qlty, Prettier and ESLint and
never verifies that they match the database, so a migration that lands without a type regeneration
passes everything.

### Total

| Status                                | Files |
| ------------------------------------- | ----- |
| covered                               | 2,119 |
| binary                                | 1,203 |
| generated                             | 3     |
| reported (symlink)                    | 1     |
| none (tool files that gspot replaces) | 4     |
| **unchecked**                         | **0** |
| **weak**                              | **0** |
| **partial**                     | **0** |
| **orphan**                            | **0** |

## The eleven blind spots

| #   | Blind spot                                                                                  | Closed by                                                                                                                                                                                | Status |
| --- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | iOS has no static analysis, SAST or dependency scan in any hook                             | `language:swift` at pre-commit for `swiftlint lint --strict` (no requirement), `repository:vulnerabilities` with the 14 existing Semgrep rules wired, preset extractor for `Package.resolved` | closed |
| 2   | Xcode project files checked by nothing                                                      | `tool:xcode` plus `repository:configuration`: 22 files, plus orphan-source detection                                                                                                         | closed |
| 3   | No TOML or YAML linter; no `ansible-lint`; compose validated by nothing                     | `repository:configuration`: taplo, yamllint, v8r, ansible-lint, `docker compose config`                                                                                                             | closed |
| 4   | 129 shell files get two checks instead of six                                               | One shell required kinds, no prefix table                                                                                                                                                       | closed |
| 5   | Assets seen by secret scanners only; 28 `Contents.json` excluded from everything            | `binary` status plus `repository:assets`; `Contents.json` gets schema validation                                                                                                         | closed |
| 6   | `supabase/functions/config` and `functions/shared` linted transitively and only at pre-push | `platform:supabase` lints every edge function directory directly, at pre-commit                                                                                                         | closed |
| 7   | Prose rules unenforced; lychee offline so no external link verified                         | `repository:prose` with Vale; lychee split into an offline hook task and an online `check` task                                                                                          | closed |
| 8   | Coverage thresholds gate nothing                                                            | A threshold is a check in the graph with a stage, or it does not exist                                                                                                                   | closed |
| 9   | Pre-commit skips a project when none of its files are staged                                | Scope invalidation follows policy inputs as well as sources                                                                                                                              | closed |
| 10  | Squawk is pre-push only                                                                     | Staging by requirement: Squawk is `fast`, therefore pre-commit                                                                                                                               | closed |
| 11  | License check supports `ios` but pre-push calls only `api` and `supabase`                   | Coverage by ecosystem lockfile; a lockfile with no license check fails                                                                                                                   | closed |

Eleven for eleven, and every one by a structural mechanism rather than by adding a step to a hook.

## The other defects

### Checks that pass without checking

| Defect                                                                                | gspot                                                                                                                                           |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| nginx and Trivy exit zero without Docker                                              | `skipped(reason)` fails the gate. The nginx check also splits: hadolint, compose schema, trivy config and the Dockerfile policy need no daemon. |
| `qlty smells` reports 119 findings and exits zero while `mode = "block"`              | `fails_on = "finding-count"` declared per check, so the exit code is never the only signal                                                          |
| qlty in pre-push checks only changed files while the coverage claims assumed the tree | Stage semantics are declared per check and printed in the run report                                                                            |
| `dotenv-linter` never runs                                                            | An orphan config fails at preset load                                                                                                             |
| `codeql/api-false-positives.json` never read                                          | Same                                                                                                                                            |
| `lint:justify` accepts any token as a ticket                                          | No ticket field; a validated `owner` and `expires` instead                                                                                      |

### Coverage lies

| Defect                                        | gspot                                                                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `.sqlfluffignore` `sql/` hides 58 of 83 files | Path selectors are not gitignore; the files a check reads asks sqlfluff; full coverage per language fails on 58 unchecked files |
| Nine `.pgsql` files match nothing             | `sql_file_exts` set, and the files a check reads proves it                                                                      |
| Semgrep: 40 rules, zero invocations           | An unreferenced rule file fails at preset load                                                                      |
| `quality/functions/swift.js` is dead          | Self-hosting plus the same orphan rule                                                                            |

### Silent analysis failure

| Defect                                                              | gspot                                                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A Bash `ERROR` node silently drops four functions from three checks | The adapter rejects `ERROR` and `MISSING` nodes and fails the check with the path and offset |
| The shell rewrite lost one file while gaining 420 names             | the parity test requires a superset, as a release gate                              |

### Policy in the wrong place

| Defect                                                                                        | gspot                                                                |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `NGINX_IMAGE` duplicates `docker-compose.yml:81`; `API_HOST_ENTRY` duplicates `nginx.conf:64` | The check runs through the compose service; the image is never named |
| Four Trivy settings live in `api/scripts/config.sh`                                           | Scanner parameters belong to `repository:vulnerabilities`            |
| `NODE_VERSION` restates `engines` in five manifests, against `mise.toml` and `.nvmrc`         | The runner pin is the source; `engines` and `.nvmrc` are generated   |
| About sixty string constants hoisted into `config/` to satisfy a check                        | `checkStrayConfigFiles` is not ported                                |
| `PACKAGE_JSON_LINT_MESSAGES` is a table of error strings                                      | Diagnostics carry their text at the site                             |

### Structure of the lint package

| Defect                                                                             | gspot                                                                   |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `quality/` linted with a weaker policy than the code it polices                    | Self-hosting, no exemption block                                        |
| 17 imports, 2 declared, 15 resolved by hoisting                                    | The distribution declares its dependencies; a consumer declares `gspot` |
| Two one-line re-export config files that violate the repository's own rule         | Generated stubs, marked as such                                         |
| `api/Dockerfile` copies `quality/package.json`                                     | The lint distribution is a dependency, not a workspace member           |
| `--scope` implemented three times; the project map spread over five config files   | One scope concept, one `gspot.toml`                                     |
| Eight dead globs, plus stale paths in six files                                    | `gspot sync --check`: a glob matching nothing fails                           |
| `policy` names four different things; six `index.js`; seven `.mjs` among 114 `.js` | Self-hosting under `repository:naming` and `repository:structure`       |

### Product logic changed by a quality branch

| Defect                                                             | gspot                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Sixteen applied migrations edited to satisfy two Squawk rules      | `migration_safety_baseline`, plus a `migration-immutable` check that fails on the edit      |
| Five runtime dependencies bumped to clear scanner findings         | `gspot fix` never touches a version; a finding produces a exception or a task                  |
| `EDGE_ERROR_CODES` lost its literal types during a type relocation | A type-derivation rule: a constant object keyed by a union derives its type from the object |

## The rules split

13,940 lines across eleven files, redistributed:

| Source             | Lines | the general layer | the language layer | the framework layer | the project layer | Deleted                                     |
| ------------------ | ----- | ----------------- | ------------------ | ------------------- | ----------------- | ------------------------------------------- |
| `GENERAL.md`       | 349   | 349               |                    |                     |                   |                                             |
| `PLANNING.md`      | 157   | 157               |                    |                     |                   |                                             |
| `TALKING.md`       | 3     | 3                 |                    |                     |                   |                                             |
| `DOCUMENTATION.md` | 4,088 | ~1,400            | ~400               |                     |                   | ~2,300 (Markdown mechanics the linters own) |
| `NAMING.md`        | 2,574 | ~500              | ~2,000             |                     | ~70               |                                             |
| `TYPESCRIPT.md`    | 358   |                   | 358                |                     |                   |                                             |
| `BASH.md`          | 2,433 |                   | 2,433              |                     |                   |                                             |
| `DOCKER.md`        | 527   |                   | 527                |                     |                   |                                             |
| `SUPABASE.md`      | 450   |                   | ~120               | ~330                |                   |                                             |
| `API.md`           | 1,470 | ~200              | ~250               | ~420                | ~600              |                                             |
| `IOS.md`           | 1,531 |                   | ~700               | ~230                | ~600              |                                             |

Roughly 1,270 lines move to the project layer, where the ownership map, the module boundary table,
the endpoint structure, the MVVM layering, the use cases, the repositories and the coordinators
belong. Roughly 2,300 lines of `DOCUMENTATION.md` are deleted because markdownlint, Prettier and
Vale enforce them mechanically and the prose restates the tool.

`CLAUDE.md` and `AGENTS.md` become generated, so `rules/DOCUMENTATION.md` cannot be an orphan again.

## What the design does not fix

Stated, because an honest proof names its residue.

- **Prompt strings.** 248 em dashes inside prompt text in one migration and its TypeScript sources
  stay uncovered by prose linting. Vale reads comments, never strings, and rewriting a prompt to
  satisfy a dash rule changes model behaviour. Declared, not hidden.
- **`swiftlint analyze` and `periphery` still need a build.** They stay at pre-push, and a laptop
  with no Xcode gets a loud skip rather than coverage.
- **119 qlty smell findings.** They enter the baseline with baselines and dates. The design
  schedules them; it does not fix them.
- **No CI unless the consumer asks.** the GitHub CI emitter is off by default, per the repository's
  stated preference, and `--no-verify` still bypasses the hooks. gspot prints one line at init
  saying so.
