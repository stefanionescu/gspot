# Migration

This document decides the two goals gspot is built against, what `gspot init` does to a
repository that already has home-grown linting, and what that repository looks like when the
migration is done. yap-swift-app is the worked example because it has the most to replace. The
other reference repositories follow in one table each.

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

## The other reference repositories

| Repository | Shape | Root lint configs | `quality/` | Hooks | Lint-related tasks | Lint pins in `mise.toml` | Old `rules/` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| yap-text-inference | Python API, Docker, shell | 5 (`.markdownlint-cli2.yaml`, `.prettierrc.json`, `.prettierignore`, `.typos.toml`, `pyrightconfig.json`) plus `[tool.ruff]`, `[tool.importlinter]`, `[tool.deptry]`, `[tool.vulture]` in `pyproject.toml` | 139 files, 2.8 MB | 3 | 16 of 34 | 10 of 14 | 7 files |
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
