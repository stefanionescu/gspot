# Migration

This document decides the two goals gspot is built against, what `gspot init` does to a
repository that already has home-grown linting, and what that repository looks like when the
migration is done. yap-swift-app is worked first because it has the most to replace;
yap-text-inference second because its policy lives in `pyproject.toml` and inside the lint
folder, which is the harder case. The other reference repositories follow in one table.

## The two goals

1. **gspot lints gspot.** Full strictness, no ignores, from Phase 0 (D-27). The self-lint is the
   first integration test and runs on every change.
2. **gspot replaces the home-grown linting in the six reference repositories.** Every rule and
   check in their `quality/` folders, dotfiles, hooks and task runners lands in a gspot check
   ([06-enforcement-ledger.md](06-enforcement-ledger.md)). The acceptance harness proves it in a
   detached worktree. The migration itself, deleting what gspot made redundant, is the owner's
   step, guided by the plan `init` prints (D-57). gspot lists; the person deletes.

## yap-swift-app in numbers

| Today | Count | After `init --yes` and the delete-when-ready step |
| --- | --- | --- |
| Root linter and formatter config files | 17 | none hand-written: 8 become one-line stubs pointing at `.gspot/`, 9 are gone |
| Per-scope linter configs (`api/`, `supabase/`, `ios/`) | 12 (`ios/.swiftlint.yml` alone is 235 lines, `ios/.swiftformat` 134) | none hand-written; stubs for eslint, sqlfluff, swiftlint, swiftformat, hadolint |
| `quality/` | 159 files, 836 KB; plus `LINTING.md` (1,815 lines), `.qlty/`, and the `quality` workspace entry | deleted |
| `.mise/tasks/` | 102 task files, of which 35 are lint, format, typecheck, knip, deps, hook or quality tasks | 67 stay (build, test, deploy, dev, gen, local); 35 deleted; `.mise/conf.d/gspot.toml` adds five `gspot:*` tasks |
| `.githooks/` | 3 hand-written hooks calling `mise run repo:hook:*` | deleted; `.gspot/hooks/` replaces them |
| `mise.toml` `[tools]` | 22 pins, 15 of them linters | the person trims to the runtime and product pins (bun, node, deno, jq, ansible-core, and what deploys need); `doctor` lists the duplicates |
| `ios/package.json`, `ios/knip.json` | exist only to hold ESLint tooling for the iOS scope | listed as lint-only; deleted with `quality/` |
| `rules/`, `CLAUDE.md`, `AGENTS.md` | the old corpus and its index | one managed block each; the old `rules/` is deleted once the completeness check proves `.gspot/rules/` covers it |
| `gspot.toml` | none | about 70 lines; every carried entry with its reason |

## yap-swift-app, file by file: root

| File | Verb | What happens |
| --- | --- | --- |
| `.squawk.toml` | replace, carry | `.gspot/squawk.toml`. `assume_in_transaction` is the supabase default. `prefer-bigint-over-int` becomes `[[ignore]] check = "postgres/squawk" rule = "prefer-bigint-over-int"` with the file's comment as its reason |
| `.shellcheckrc` | replace, carry | `.gspot/shellcheckrc` and a `.shellcheckrc` stub. The six `disable=` codes become six `[[ignore]]` entries with the reason `carried from .shellcheckrc at init`, for the person to rewrite or remove |
| `.semgrepignore` | delete | gspot passes Semgrep an explicit file list; every path here is excluded by nature already (build output, lockfiles, Xcode artefacts, `.env*`) |
| `.prettierrc.json` | replace | `.gspot/prettier.json` and a stub. Its eight values are the shipped `[format]` defaults; nothing to carry |
| `.prettierignore` | replace, suggest | gspot owns the file, rendered by nature. The three generated paths it names print in the plan as `gspot declare api/types/supabase.ts --produced-by "supabase gen types"` suggestions; not applied |
| `.nvmrc` | leave | a runtime pin, not linting. `integrity/manifest-policy` checks it agrees with `engines` and the mise pin; redundant once mise pins node, and the person may delete it |
| `.markdownlint-cli2.jsonc` | replace | `.gspot/markdownlint.jsonc` and a stub. Every value in it is the shipped default, because the defaults came from this repository |
| `.license-checker.json` | replace, carry | `.gspot/licenses.json`. The allowlist equals the shipped one. The twelve `excludePackages` entries become `[[tools.licenses.exceptions]]` with the license the checker reports at `init` and the reason `carried at init` |
| `.gitleaks.toml` | replace, carry | `.gspot/gitleaks.toml`. The allowlist for public identifiers in `ios/Yap/Config/*.xcconfig` is carried with its description as the reason |
| `.editorconfig` | replace | the formatting preset owns the whole file: rendered from `[format]` with the header; the old one is deleted and listed. A section gspot does not render goes in `[tools.editorconfig.extra]` |
| `.commitlintrc.json` | replace | `.gspot/commitlint.config.js` and a stub. Its scopes (`api`, `ios`, `supabase`, `root`, `hooks`, `deps`) are the default: the scope paths plus `root`, `hooks`, `deps` |
| `bearer.yml`, `bearer.ignore` | delete | Bearer is cut (D-28). Semgrep covers the same classes; the twelve recorded false positives re-enter through the Semgrep baseline on day one |
| `lychee.toml` | replace | `.gspot/lychee.toml`: offline, fragments, the online profile for `manual` |
| `mise.toml` | leave, list | never edited. `doctor` lists the fifteen pins gspot also pins under "pinned twice", each with the line to delete |
| `osv-scanner.toml` | replace, carry | `.gspot/osv-scanner.toml`. Both ignored advisories carried with their reasons and a `review_by` date |
| `tsconfig.base.json` | replace | `.gspot/tsconfig.base.json` holds the same fourteen options; `api/tsconfig.json` and `supabase/tsconfig.json` keep their `paths`, `include` and module settings and their `extends` is repointed |
| `typos.toml` | replace, carry | `.gspot/typos.toml` and a stub. The eight words carried with their comments as reasons; excludes come from natures |
| `.syncpackrc` | replace | `.gspot/syncpack.json`, the same one-version policy plus the shipped aligned pairs |
| `.gitattributes` | leave | LFS and generated markers are the person's; gspot reads them for natures |
| `.dockerignore` | leave | `docker/dockerignore` checks it |
| `.githooks/` | delete | `.gspot/hooks/` and `core.hooksPath`; listed under "no longer runs; delete when ready" until deleted |
| `.mise/tasks/` | leave 67, delete 35 | a task whose body calls a file under `quality/` or a tool gspot owns is listed under "no longer runs"; build, test, deploy, dev, gen and local tasks stay and the bash preset lints them |
| `quality/`, `LINTING.md`, `.qlty/` | delete | listed under "no longer runs; delete when ready". The completeness check proves every rule landed before the person deletes |
| `CLAUDE.md`, `AGENTS.md`, `rules/` | leave, add | one managed block each. `rules/` is listed as "yours; delete once `.gspot/rules/` covers it", and the completeness check is the proof |
| `README.md`, `ADVANCED.md` | leave | the docs checks run over them. There is no `LICENSE` file at the root today, so `docs/readme-present` fails until one is added or `tools.docs.require_license` is set false with a reason |
| `package.json` (root) | change | gspot's npm tools land in `devDependencies` (or under mise `npm:`); `quality` leaves `workspaces` when the folder is deleted; the lint scripts are replaced by `check` and `sync` |
| `bunfig.toml` | leave | already at the shipped install policy |

## yap-swift-app, file by file: scopes

| File | Verb | What happens |
| --- | --- | --- |
| `api/eslint.config.js`, `supabase/eslint.config.js` | replace | three-line imports of `quality/eslint/*` become three-line stubs importing `.gspot/eslint.config.js` with the scope's file class |
| `api/tsconfig.json`, `supabase/tsconfig.json` | change | `extends` repointed; everything else stays |
| `api/tsconfig.build.json`, `api/tsconfig.test.json` | leave | build configuration, not linting |
| `api/knip.json`, `supabase/knip.json` | replace, carry | `.gspot/knip.json` per scope. `entry` and `project` are carried into `[tools.knip] entry`; `ignoreDependencies` entries that name linters disappear with the linters |
| `api/.hadolint.yaml` | replace | `.gspot/hadolint.yaml` and a stub |
| `api/.prettierignore`, `supabase/.prettierignore`, `ios/.prettierignore` | delete | natures |
| `supabase/.sqlfluff`, `supabase/.sqlfluffignore` | replace, carry | `.gspot/sqlfluff.cfg` (dialect postgres, 120 columns, 4 spaces, upper keywords) and a stub. The eight `exclude_rules` become eight `[[ignore]]` entries. The ignore file goes: gspot passes the list, and this file hid 58 of 83 SQL files in the reference audit |
| `ios/.swiftlint.yml` | replace, carry | `.gspot/swiftlint.yml` with the 87 opt-in rules and the limits from `[limits]`; a stub with `parent_config`. Every `disabled_rules` entry becomes an `[[ignore]]`; `included` and `excluded` come from claims and natures |
| `ios/.swiftformat` | replace | `.gspot/swiftformat` from `[format]` and the shipped rule lists; a stub |
| `ios/.periphery.yml` | replace, carry | `.gspot/periphery.yml`. `schemes` and the retain options carried into `[tools.periphery]` and `[tools.xcodebuild] scheme` |
| `ios/package.json`, `ios/knip.json` | list | a workspace package whose dependencies are all linters: "lint tooling; yours; delete when ready" |
| `*/.env.example`, `*/.env.development`, `*/.env.staging` | leave | `config-files/dotenv` checks that tracked ones hold keys only; `integrity/env-files` refuses staging the rest |
| `api/Dockerfile`, `api/docker-compose.yml`, `api/nginx.conf`, `supabase/config.toml` | leave | product files: checked, never written |

## yap-text-inference in numbers

A Python inference server with two Docker images and a large shell layer. It has fewer
dotfiles than yap-swift-app because most of its policy lives in `pyproject.toml` tables and
inside `quality/`, which changes what `init` can find.

| Today | Count | After `init --yes` and the delete-when-ready step |
| --- | --- | --- |
| Root config files | 5 (`.markdownlint-cli2.yaml`, `.prettierrc.json`, `.prettierignore`, `.typos.toml`, `pyrightconfig.json`) | none hand-written; stubs for markdownlint, prettier, typos, pyright |
| `pyproject.toml` tool tables | `[tool.ruff]` (97 lines), `[tool.interrogate]`, `[tool.deptry]`, `[tool.vulture]`, `[tool.bandit]`, `[tool.pytest]`, `[tool.importlinter]` with nine contracts (589 lines in all) | the tables gspot owns are rewritten from `gspot.toml` through a comment-preserving edit; `[project]`, `[dependency-groups]` and `[tool.uv]` are untouched; `[tool.interrogate]` and `[tool.bandit]` are removed because the tools are cut |
| Configuration inside `quality/` | `quality/config/shellcheckrc`, `security/osv/config.toml`, `security/gitleaks/{baseline,reasons}.json`, `repository/licenses/policy.json`, `typecheck/{trt,vllm,llmcompressor}.json`, `naming/policy.json`, `duplication/*.json` | not at conventional paths, so takeover does not find them; step 0 below moves the five that carry facts, and the rest are the ledger's job |
| `quality/` | 139 files, 2.8 MB, plus a `quality/package.json` workspace | deleted |
| Root `package.json`, `bun.lock` | exist only to install jscpd, markdownlint and prettier | listed as lint-only; deleted. Under the mise runner the npm tools become `npm:` pins and the repository has no Node footprint |
| `.mise/tasks/` | 34 task files: 20 are lint, format, type, deps, hook, security or licenses tasks | 12 test tasks stay; `setup` stays; `check` is rewritten by hand to call `gspot check` and the tests; 20 deleted |
| `.githooks/` | 3, including a hand-written commit-message regex | deleted; `.gspot/hooks/`, with commitlint in the `commit-msg` hook |
| `mise.toml` `[tools]` | 14 pins, 9 of them linters | the person trims to bun, node (mise's `npm:` backend needs it), python, uv, jq; `doctor` lists the nine |
| `rules/` | 7 files, 13,721 lines, with `rules/DOCUMENTATION.md` excluded from its own linters | one managed block in `CLAUDE.md` and `AGENTS.md` (they are identical today); the old `rules/` is deleted once the completeness check is clean |
| Documentation | `README.md` and `ADVANCED.md` name 65 `mise run` commands and one `quality/` path | the "Develop the project" and "Developer workflow" sections shrink to `gspot check`, `gspot check --fix`, and the test tasks; `integrity/stale-paths` fails until they do |

## yap-text-inference, file by file

| File | Verb | What happens |
| --- | --- | --- |
| `.markdownlint-cli2.yaml` | replace | `.gspot/markdownlint.jsonc` and a stub. MD007 indent 4 and MD013 off are the defaults; its `ignores` come from natures; `MD060` off is carried as an `[[ignore]]` |
| `.prettierrc.json`, `.prettierignore` | replace | the shipped defaults; `embeddedLanguageFormatting: off` is added; the generated `requirements-*.txt` pattern becomes a `gspot declare` suggestion |
| `.typos.toml` | replace, carry | four words (`AWQ`, `certifi`, `TRT`, `vLLM`) carried |
| `pyrightconfig.json` | replace, carry | `.gspot/basedpyrightconfig.json` and a stub. `typeCheckingMode` moves from `strict` to `all` with a baseline. The nine files it excludes are the ones the three variant projects include, so the excludes disappear and the variants become three `[[tools.basedpyright.projects]]` entries |
| `quality/config/typecheck/{trt,vllm,llmcompressor}.json` and `.mise/tasks/type/*` | carry after step 0 | each variant becomes `[[tools.basedpyright.projects]] name = "trt" include = [...] extra = "trt" platform = "linux"`. On a Mac the three checks print as platform skips, which is what the task's `uname` guard did; in CI on Linux they run under `uv run --extra` |
| `[tool.ruff]` | replace, carry | rendered from the ledger set. `lint.select` equals the shipped families; gspot adds `S`, `ANN401`, `PLR2004`, `PLR0917` and `FAST`, which enter with a baseline. Every `lint.pylint.max-*` value and `mccabe.max-complexity = 8` equals the shipped `[limits]` default. `extend-ignore-names` (`setUp`, `tearDown`, ...) are shipped external names. `COM812`, `D203`, `D213` are shipped ignores |
| `[tool.interrogate]` | delete, carry | cut for Ruff `D100` to `D107`. `ignore-init-method = true` becomes `[[ignore]] check = "python/ruff" rule = "D107"` with the reason `carried from [tool.interrogate] at init` |
| `[tool.deptry]` | replace, carry | `per_rule_ignores` entries become `[[ignore]]` entries with `rule = "DEP001"` and the package in the reason; `known_first_party` is detected |
| `[tool.vulture]` | replace | `paths` come from claims (`quality` drops out with the folder); `min_confidence = 80` is the default |
| `[tool.bandit]` | delete | cut; Ruff `S` and the Semgrep Python pack |
| `[tool.pytest]` | replace | `testpaths` from claims; `addopts` gains `--strict-markers --strict-config` |
| `[tool.importlinter]` and its nine contracts | replace, carry | the contracts are policy the repository wrote and are carried verbatim into `[architecture.contracts]` (they are the architecture, and D-46's exception for "facts about the repository" covers a declared import matrix the same way it covers an allowlist); `root_packages` from `[architecture] package_roots` |
| `[tool.uv]`, `[project]`, `[dependency-groups]` | leave | product dependencies, indexes and conflicts; gspot adds a `gspot` dependency group only when the runner is uv |
| `quality/config/shellcheckrc` | carry after step 0 | `.gspot/shellcheckrc` and a root stub; its disables become ignores |
| `quality/config/security/osv/config.toml` | carry after step 0 | four ignored advisories with reasons; `ignoreUntil` becomes `review_by` |
| `quality/config/security/gitleaks/{baseline,reasons}.json` | carry after step 0 | `[tools.gitleaks] baseline_reasons`, each with its `review_by` |
| `quality/config/repository/licenses/policy.json` | carry after step 0 | the four-license allowlist is narrower than the shipped twelve; the person keeps the narrow one with `gspot set tools.licenses.allow --replace ...` or accepts the shipped one; the exemptions become `[[tools.licenses.exceptions]]` with their licenses and reasons |
| `quality/config/naming/policy.json`, `rules.py`, `schema.py` | ledger | the shipped policy is the union of the reference policies; the structural prefixes (`TRT_`, `OTEL_`, `WS_`, `HF_`) are the example in [08-naming-policy.md](08-naming-policy.md); any term unique to this repository is added by hand with `gspot set naming.banned_terms` in step 4 |
| `quality/config/security/semgrep/*.yml`, `vendor/*.yml` | ledger | the `python`, `secrets` and `markers` packs ship in the python and vulnerabilities presets; the vendored sets ship pinned; `bandit.yml` is not shipped because Ruff `S` is the port |
| `quality/config/security/codeql/*` | ledger | `security/codeql` at `manual` with `[tools.codeql] false_positives` |
| `quality/config/duplication/*.json` | ledger | the shipped jscpd values are these |
| `quality/config/python/*`, `quality/config/repository/*`, `quality/config/shell.py` | ledger | every limit and policy file maps to a `[limits]` key or a structure check in [06-enforcement-ledger.md](06-enforcement-ledger.md) section 5 and 6 |
| `quality/python/`, `quality/repository/`, `quality/shell/`, `quality/security/`, `quality/lib/` | delete | the 14 Python structure analyses, the shell family, the naming engine, the integrity checks and the security runners, all in gspot |
| `.githooks/commit-msg` | delete | a regex that accepted any scope; commitlint replaces it, and with no `[[scope]]` in `gspot.toml` there is no scope enum, so `feat(server):` still passes |
| `.githooks/pre-commit`, `pre-push` and the `SKIP_*` variables | delete | `.gspot/hooks/`; the production-env guard is `integrity/env-files`; there are no skip variables (D-24), only `gspot.local.toml` |
| `docker/trt/Dockerfile`, `docker/vllm/Dockerfile`, their `.dockerignore` and `build.sh` | leave | hadolint, `docker/dockerignore` and the bash preset check them; `templates/project/DOCKER-ML.md` is offered because the base images are CUDA |
| `scripts/`, `docker/shared/scripts/` | leave | the bash preset's structure family runs over them; the shell limits (140 lines, 40 per function) are this repository's own values |
| `config/` | leave | `integrity/config-purity` checks the modules hold literals; `architecture.roles.env` is proposed as the module that reads `os.environ` most |
| `.env.example` | leave | `config-files/dotenv`; `config-files/env-example` once `tools.dotenv.accessor` names the reader |
| `mise.toml` | leave, list | nine pins gspot also pins; `github:Bearer/bearer` goes with Bearer |
| `README.md`, `ADVANCED.md` | leave, rewrite | the docs checks pass once the developer sections name gspot commands and the test tasks instead of the 20 deleted tasks |

What is different here, and what it changed in the design:

- **A repository can need several incompatible dependency sets.** The engines cannot share one
  virtual environment, so type checking runs per variant under `uv run --extra`, and two of the
  three only build on Linux with CUDA. `[[tools.basedpyright.projects]]` now carries `extra`
  and `platform`, and a project whose platform does not hold is a platform skip that prints,
  the same rule as SwiftLint on Linux ([presets/python.md](presets/python.md)).
- **Policy that lives inside the lint folder is invisible to takeover.** `init` reads
  conventional paths. The plan says which files it did not find and where to move them, and the
  migration has a step 0 for it.
- **The cyclomatic limit was wrong in the ledger.** Every source repository uses 8; the ledger
  said 10. D-20 says the strictest observed ships, so the default is 8.
- **Documentation that lists task names goes stale when the tasks go.** `integrity/stale-paths`
  now also checks that every `mise run`, `bun run` and `npm run` a document names exists.
- **A Python repository should not need Node.** A root `package.json` whose dependencies are all
  linters is listed as lint-only, and under the mise runner the npm tools become `npm:` pins.
- **A commit-message regex that allowed any scope must not become an enum by accident.** With
  no `[[scope]]`, commitlint has no `scope-enum`.

## The other reference repositories

yap-swift-app and yap-text-inference are worked above. The remaining four:

| Repository | Shape | Root lint configs | `quality/` | Hooks | Lint-related tasks | Lint pins in `mise.toml` | Old `rules/` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| slopshop | Next.js on Cloudflare | 8 (`.commitlintrc.json`, `.editorconfig`, `.license-checker.json`, `.markdownlint-cli2.jsonc`, `.prettierrc.json`, `.prettierignore`, `eslint.config.mjs`, `typos.toml`) | 83 files, 416 KB | 3 | 20 of 28 | 4 of 7 | 2 folders |
| yap-landing | static site on Cloudflare | 12, including `.whitelizard`, `.qlty/`, `bearer.*`, `.semgrepignore`, `.stylelintrc.json` | 119 files, 564 KB | 3 | 14 of 15 | 9 of 13 | 5 files |
| comfyui-reactor-connector | Python custom node with a `web/` front end | 7 (`.markdownlint-cli2.yaml`, `.prettierrc.json`, `.prettierignore`, `.stylelintrc.json`, `.typos.toml`, `pyrightconfig.json`, `tsconfig.json`) plus the `pyproject.toml` tool tables | 225 files, 2.0 MB | 3 | 27 of 36 | 8 of 12 | 8 files |
| comfyui-live-shopping | same shape | 7 | 221 files, 1.9 MB | 3 | 27 of 36 | 8 of 12 | 8 files |

Across the six repositories: 946 files of home-grown lint code, about 8.5 MB, six sets of
hooks, roughly 140 task files and 54 dotfiles do one job that gspot does once. The `pyproject.toml`
tool tables in the Python repositories are replaced the same way as dotfiles: the tables gspot
owns (`ruff`, `importlinter`, `deptry`, `vulture`, `pytest.ini_options`) are rewritten from
`gspot.toml` through a comment-preserving TOML edit, and every other table stays.

## The end state for a stranger's repository

After `gspot init --yes` and deleting what the plan lists under "no longer runs", the repository
holds, for linting, exactly this:

- `gspot.toml`: the policy, tens of lines, every exception with a reason.
- `.gspot/`: generated, tracked, never edited; configuration, baselines, hooks, rule files, the
  version pin.
- One-line stubs at the conventional paths, so editors work without knowing gspot exists.
- One file under `.mise/conf.d/` (or a few `package.json` entries): the tool pins and five tasks.
- One managed block in `CLAUDE.md` and `AGENTS.md`.

Nothing else about linting exists in the tree. `mise.toml` pins runtimes and product tools
only. The task runner holds build, test and deploy tasks only. Every rule the old folder
enforced still runs, at the strictest value observed, behind a baseline that only falls.
Changing anything is one `gspot set`, `allow` or `ignore` line, and `gspot explain` says what
every finding means and what to do.

## How the migration runs

0. When policy files live inside the lint folder rather than at conventional paths (a
   `shellcheckrc`, an osv config, a gitleaks baseline, per-variant type-check configs), move
   them to the conventional path with `git mv` so takeover finds them. `init --dry-run` lists
   the ones it did not find.
1. `gspot init` in a branch. Read the plan: the delete, carry, change and "no longer runs"
   sections. Say yes.
2. `gspot check`. Everything passes through baselines; read the counts.
3. Delete what "no longer runs" listed: the lint folder, the old hooks, the lint-only tasks and
   workspace packages, the duplicate pins `doctor` names. `gspot check` again.
4. Rewrite or remove every `carried at init` reason in `gspot.toml` while the old file is one
   `git show` away.
5. Delete the old `rules/` once the completeness check is clean, and any linting documentation
   the old setup needed (`LINTING.md`).
6. Commit. The diff is the migration; nothing outside it changed.

The acceptance harness runs steps 1 and 2 in a detached worktree for every reference
repository on every release, so the plan a person sees is the plan that was tested.
