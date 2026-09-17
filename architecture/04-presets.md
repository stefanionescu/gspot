# Presets

## The manifest

One file per preset, `manifest.toml`. Everything a preset contributes is declared here, and the preset reader
rejects a preset that contributes anything it did not declare.

```toml
[preset]
id          = "language:typescript"
title       = "TypeScript and JavaScript"
kind        = "language"
requires    = ["repository:structure", "repository:naming"]
conflicts   = []
detect      = { any_file = ["tsconfig*.json", "**/*.ts", "**/*.tsx"] }
# Shared packages this preset installs in addition to its own checks and rule
# block. A shared package is checks plus a rule block that belong to several
# presets and to no one of them: `http` is installed by every HTTP framework,
# `i18n` by every i18n library. `generate` installs it while any such preset is
# present and removes it when the last one goes.
shared      = []

# Files this preset claims. Used to build the coverage candidate set, and
# cross-checked against every file listing result.
[claims]
extensions  = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".d.ts"]
filenames   = ["tsconfig.json", "package.json", "eslint.config.js"]

# Tools, by id. The toolchain resolves them.
[[tools]]
id       = "node"
version  = "24.20.0"
provider = "mise"

[[tools]]
id       = "eslint"
version  = "9.38.0"
provider = "npm"
package  = "eslint"

# Configuration this preset renders. See 07-config-generation.md.
[[configs]]
target    = ".gspot/generated/eslint.config.js"
stub      = "eslint.config.js"
stub_kind = "reexport"
template  = "configs/eslint.config.js.tmpl"
readers   = ["eslint"]

# Checks. One entry per atomic unit the scheduler runs and the coverage check counts.
[[checks]]
id          = "ts/eslint"
inspects        = ["style", "structure", "naming"]
mechanism   = "configured"
stage       = "pre-commit"
takes  = "project"
command     = ["eslint", "--max-warnings", "0", "--no-warn-ignored"]
fails_on    = "exit-code"
file_list  = { via = "print-config", command = ["eslint", "--print-config"] }
fix         = ["eslint", "--fix"]

# Output patterns that mean the tool broke, not that the code is bad.
# Taken from MegaLinter's common_linter_errors.
[[checks.tool_errors]]
regex   = "Error while loading rule|Failed to load plugin|Cannot find module"
message = """
ESLint could not load a plugin or rule from the generated config.
  - Run `gspot install` to install the preset's peer dependencies.
  - Run `gspot config eslint` to see the resolved config and its provenance.
"""

[[checks.tool_errors]]
regex   = "Parsing error: Cannot read file .*tsconfig"
message = """
The type-aware rules could not find a tsconfig for a linted file.
  - A file claimed by language:typescript is outside every tsconfig `include`.
  - `gspot check --unchecked` names the file and the tsconfig it is outside
    of. Add it to that tsconfig, or declare it in gspot.toml.
"""

[[checks]]
id          = "ts/tsc"
inspects        = ["types", "syntax"]
mechanism   = "configured"
stage       = "pre-commit"
takes  = "project"
command     = ["tsc", "--noEmit"]
fails_on    = "exit-code"
file_list  = { via = "project-graph", command = ["tsc", "--noEmit", "--listFiles"] }

# Kind required inspections: what a file of this language must have to count as covered.
[required]
".ts"   = ["format", "syntax", "style", "types", "structure", "naming", "prose", "spelling"]
".d.ts" = ["format", "syntax", "types", "spelling"]
".js"   = ["format", "syntax", "style", "types", "structure", "naming", "prose", "spelling"]

# Settings this preset exposes. Anything not listed here is not extensible,
# and a gspot.toml that targets an unlisted setting fails to load.
[[settings]]
name      = "eslint.rules"
ops       = ["add", "remove", "set"]
direction = "declared-per-rule"

[[settings]]
name      = "tsconfig.paths"
ops       = ["add"]
direction = "neutral"

# Rule files this preset installs.
[rules]
language = ["TYPESCRIPT.md", "naming/TYPESCRIPT.md"]

# Tasks this preset contributes to the graph. See 08-tasks-and-tools.md.
[[tasks]]
name   = "lint:ts"
checks = ["ts/eslint", "ts/tsc"]
```

Loader invariants, each enforced at load:

1. Every `[[checks]]` entry declares at least one inspection.
1. Every `[[configs]]` entry names at least one reader. A config with no reader is the
   `api-false-positives.json` bug, and it fails to load.
1. Every check appears in at least one task. A check reachable from no task is the Semgrep bug, and
   it fails to load. 3a. Every check declares `mechanism`, and a check at a plugin or 4 carries
   the `searched` tool list and the `verdict` that justified original code. Those two fields are
   reviewed at every release, which is what stops the distribution from growing a fifth `quality/`
   folder. 3b. Every check declares `takes` and `fails_on`. A `fails_on` of `finding-count` or
   `parsed-output` declares its counting regex. There is no `warn` value.
1. Every extension in `[claims]` appears in `[required]`.
1. Every setting declares its direction, so the direction classifier is mechanical.
1. Templates reference only preset-local files and settings values, never product paths. A template
   that reads `api/docker-compose.yml` does so itself, in the check, which
   names the file, the extraction and the failure message. This is the mechanism that replaces the
   hardcoded nginx image tag.

## The catalog

### Language presets

| Preset                  | Owns                                                                                       | Primary tools                                                     | Doc                                                  |
| --------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------- |
| `language:typescript` | `.ts .tsx .mts .cts .d.ts`, `tsconfig*.json`                                               | tsc, ESLint with `typescript-eslint`, Prettier, knip              | [typescript.md](13-language-presets/typescript.md)     |
| `language:javascript` | `.js .jsx .mjs .cjs` | `tsc --checkJs`, ESLint with `n` or `compat` by runtime, JSDoc type rules, prettier, knip | [javascript.md](13-language-presets/javascript.md) |
| `language:python`     | `.py .pyi`, `pyproject.toml`                                                               | Ruff, basedpyright, `import-linter`, deptry, vulture, pydoclint   | [python.md](13-language-presets/python.md)             |
| `language:swift`      | `.swift`                                                                                   | SwiftLint, SwiftFormat, Periphery, xcodebuild                     | [swift.md](13-language-presets/swift.md)               |
| `language:bash`       | `.sh .bash`, extensionless files with a Bash shebang                                       | ShellCheck, shfmt, `bash -n`                                      | [bash.md](13-language-presets/bash.md)                 |
| `language:sql`        | `.sql .pgsql`                                                                              | sqlfluff, Squawk                                                  | [sql.md](13-language-presets/sql.md)                   |
| `language:markdown`   | `.md .mdx`                                                                                 | `markdownlint-cli2`, lychee, Vale                                 | [markdown.md](13-language-presets/markdown.md)         |
| `language:css`        | `.css .scss .pcss`                                                                         | stylelint, Prettier                                               | [css.md](13-language-presets/css.md)                   |
| `repository:configuration`       | `.json .jsonc .yaml .yml .toml .env .plist .xcconfig .entitlements .xcstrings .properties` | taplo, yamllint, v8r, dotenv-linter, plutil, actionlint, Prettier | [04-presets.md](04-presets.md) |
| `tool:docker`    | `Dockerfile*`, `*.dockerfile`, `docker-compose*.yml`, `.dockerignore`                      | hadolint, `docker compose config`, trivy                          | [14-framework-presets.md](14-framework-presets.md)       |
| `language:html`       | `.html .htm`, template extensions                                                          | html-validate, Prettier, djlint, linkinator                       | [html.md](13-language-presets/html.md)                 |

`repository:configuration` is the preset that closes the third `yap-swift-app` blind spot: nine TOML files, the
Ansible playbooks, `docker-compose.yml`, four `.xcconfig`, four `.entitlements`, three `.xcstrings`,
two `.plist` and the 28 `Assets.xcassets/**/Contents.json` files all had weak coverage only.

### Framework presets

| Preset                    | Requires                                               | Adds                                                                                                                                                                                           | Architecture it assumes                                                  |
| ----------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `framework:nextjs`      | `language:typescript`, `language:css`                  | `eslint-config-next`, next build type check, route and metadata conventions, `server-only` boundary, i18n message coverage                                                                     | App Router, because Next.js itself does. This is the one permitted case. |
| `database:postgres`    | `language:sql`                                         | RLS presence, explicit grants, `SECURITY DEFINER` search path, migration safety and order, migration immutability, object naming, index covers foreign key, no blocking DDL                    | None. Postgres, not any product built on it.                             |
| `platform:supabase`    | `database:postgres`, `language:typescript`            | CLI filename contract, `config.toml` validation, Deno lint for edge functions, generated types freshness, storage policies, service-role key containment                                       | The Supabase CLI layout, because the CLI dictates it                     |
| `framework:fastapi`     | `language:python`                                      | OpenAPI export and diff, dependency-injection lint for `Depends`, route conventions                                                                                                            | None beyond what FastAPI requires                                        |
| `tool:xcode`     | `language:swift`, `repository:configuration`                      | Checks only, no rule block. Xcode project validation, `plutil -lint`, entitlement policy, `xcstringstool` catalogue check, asset catalogue validation, test plan presence, orphan-source diff                              | None. Does not assume MVVM.                                              |
| `library:drizzle`     | `database:postgres`, `language:typescript`            | Schema and migration output match, no raw SQL outside a declared escape, relation completeness                                                                                                 | The Drizzle layout                                                       |
| `library:zod` | `language:typescript` | `eslint-plugin-zod`, fourteen rules, plus `rules/library/zod/ZOD.md` | None. One plugin, one rule file. |
| `library:next-intl` | `language:typescript` or `language:javascript` | Message-catalogue schema, completeness per locale, usage cross-check against the source, plus `rules/shared/i18n/I18N.md` | None. Selected by any i18n library. |
| `framework:comfyui` | `language:python` | Node mappings, `WEB_DIRECTORY`, registry metadata, `.comfyignore`, generated `requirements.txt`, host-provided dependencies, node docs, workflow validity, built-frontend freshness, locale completeness | The ComfyUI custom-node layout, because ComfyUI loads it that way |
| `repository:static-site` | `language:html`, `language:css`, `language:javascript` | Build reproducibility, dead CSS against built output with purgecss, dead assets, bundle limit with size-limit, link crawl with linkinator, SVG normalisation, redirects and sitemap validation | None. The build pipeline is the consumer's.                              |

The shared `http` package (installed by `framework:express`, `framework:fastapi` and `framework:nextjs`) is the answer to requirement R11. The `yap-swift-app` `rules/API.md` is 1,470 lines
and contains an "Ownership Map", "Module Boundaries", a layered endpoint structure and a
contracts-plus-Zod-plus-OpenAPI pipeline. Those are one project's architecture. The preset keeps what
generalises (a contract exists; requests are validated at the boundary; secrets never reach a
response) and ships the rest as a the project layer template the consumer copies and owns.

### Repository presets

| Preset                         | Kind    | Tools                                                                | Notes                                                                                                                                    |
| ---------------------------- | ------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `repository:structure`       | `structure`   | gspot structure engine                                               | The     hteen rules. Implied by every language preset. [12-structure-and-naming.md](12-structure-and-naming.md)                             |
| `repository:naming`          | `naming`      | gspot naming engine                                                  | The 290-line policy, extended through the settings file                                                                                  |
| `repository:prose`           | `prose`       | Vale                                                                 | [11-prose.md](11-prose.md)                                                                                                               |
| `repository:secrets`         | `secrets`     | gitleaks, trufflehog                                                 | Whole tree including binaries                                                                                                            |
| `repository:vulnerabilities` | `vulnerabilities`        | Semgrep, CodeQL                                                      | Per-language rule sets; CodeQL is opt-in and slow                                                                                        |
| `repository:dependencies`    | `dependencies`        | osv-scanner, trivy, knip, deptry, syncpack, lockfile-lint, dustilock |                                                                                                                                          |
| `repository:licenses`        | `license`     | `license-checker-rseidelsohn`, pip-licenses                          | Policy list in the settings file                                                                                                         |
| `repository:commits`         | none          | commitlint                                                           | Commit message stage                                                                                                                     |
| `repository:duplication`     | `duplication` | jscpd                                                                | Per-language thresholds                                                                                                                  |
| `repository:formatting`      | `format`      | editorconfig-checker                                                 | Renders `.editorconfig` from the format settings of every selected preset, so indentation cannot disagree between Prettier, shfmt and Ruff |
| `repository:assets`          | `format`      | gspot asset policy                                                   | Orphan detection against source references, plus `secrets`. No dimension or size policy. Closes blind spot 5. |
| `repository:spelling`        | `spelling`    | typos                                                                | Implied by everything                                                                                                                    |
| `repository:naming`          | `naming`      | The policy document plus five emitters, plus ls-lint                | No extractor. D-20.                                                                                                                      |

`repository:formatting` is worth naming: `yap-swift-app` carries a hand-written `.editorconfig` with
shfmt hints, a `.prettierrc.json` with `tabWidth: 4`, and a markdownlint `MD007` indent of 4 chosen
to match Prettier. Three files agreeing by hand. The preset derives all three from one `[format]`
block.

### Runner and CI emitters

| Preset                       | Emits                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| the mise runner            | `mise.toml` `[tools]`, `.mise/tasks/**`, `[settings]`                                                       |
| the bun runner             | `package.json` `scripts`, `.gspot/tools.lock`, `.gspot/bin/`                                                |
| the npm runner             | same as the bun runner with npm                                                                             |
| the GitHub Actions emitter | `.github/workflows/gspot.yml`, plus `actionlint` and `zizmor` over its own output. Only when `[gate] ci = "github"`. |
| the GitLab CI emitter      | a marked `gspot` job in `.gitlab-ci.yml`. Only when `[gate] ci = "gitlab"`.                                  |
| the Buildkite emitter      | a step in `.buildkite/pipeline.yml`. Only when `[gate] ci = "buildkite"`.                                    |
| the release step           | Nothing but a `gspot check --stage release` call for a workflow the consumer already has. [09-gates.md](09-gates.md). |

### Rule preset

the general rules ships the general layer only, and installs without any check preset. A repository
that wants the agent rules and none of the linting runs `gspot init --rules install --presets ""`.

## Detection

`gspot init` proposes a selection. Signals, in precedence order:

| Signal                                                                      | Proposes                                                              |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `next.config.*` or `next` in dependencies                                   | `framework:nextjs`                                                    |
| `zod` in dependencies | `library:zod` |
| `next-intl`, `i18next`, `react-intl` or `@formatjs/intl` in dependencies | `library:next-intl` |
| `express` in dependencies | `framework:express` |
| `NODE_CLASS_MAPPINGS` in the root `__init__.py`, or `[tool.comfy]` in `pyproject.toml` | `framework:comfyui` |
| `supabase/config.toml`                                                      | `platform:supabase`, which pulls `database:postgres`                |
| `wrangler.jsonc`, `wrangler.toml`, or `functions/_middleware.js`               | `platform:cloudflare`                                                 |
| Any `*.sql` with Postgres syntax, or a Postgres connection string in config | `database:postgres`                                                  |
| `pyproject.toml` with `fastapi`                                             | `framework:fastapi`                                                   |
| `*.xcodeproj` or `Package.swift`                                            | `language:swift`, and `tool:xcode` when an `.xcodeproj` exists |
| `*.html` with no framework dependency, plus a build script                  | `language:html`, `repository:static-site`                              |
| `tsconfig.json`                                                             | `language:typescript`                                                 |
| `pyproject.toml` or `requirements*.txt`                                     | `language:python`                                                     |
| Any tracked file with a Bash shebang                                        | `language:bash`                                                       |
| Any `*.sql`                                                                 | `language:sql`                                                        |
| `Dockerfile*`                                                               | `tool:docker`                                                    |
| Extension coverage of the tree                                              | Every `language:` preset whose claims match at least one tracked file   |

The last row is the important one, and it runs regardless of the others. Detection reports every
extension present in the tree that no proposed preset claims, and asks for a decision: enable a preset,
or declare a status. The flow is described in [17-lifecycle.md](17-lifecycle.md).

Existing tool configuration is a signal too. `gspot init` reads `.prettierrc.json`, `.eslintrc*`,
`eslint.config.*`, `pyproject.toml`, `.swiftlint.yml`, `typos.toml` and the rest, and proposes
settings that preserves the settings it finds, so adoption starts from the repository's current
policy rather than from gspot's defaults. Divergences are listed as a table for the consumer to
accept or reject, one row at a time.

## `repository:configuration`

Configuration files are not a language, and they belong to no single scope, so this
is a repository preset. It closes the third blind spot: "No TOML or YAML linter. Nine TOML files including
`mise.toml`, `supabase/config.toml` and `.qlty/qlty.toml` get editorconfig and typos only."

Every file class here was covered by spell check and end-of-line normalisation alone in all three
reference repositories, and several of them configure the lint stack itself.

#### Claims

```text
.json .jsonc .json5
.yaml .yml
.toml
.env .env.* (never .env.local or anything git-ignored)
.plist .entitlements .xcconfig .xcstrings .strings
.xml .storyboard .xib
.properties .ini .cfg
```

#### Tools

| Format               | format                            | syntax          | schema                                         | style                    |
| -------------------- | --------------------------------- | --------------- | ---------------------------------------------- | ------------------------ |
| JSON, JSONC          | Prettier                          | Prettier        | `v8r` against SchemaStore                      | `@eslint/json`           |
| YAML                 | Prettier                          | `yamllint`      | `v8r`, plus `actionlint` for workflows         | `yamllint`               |
| TOML                 | `taplo fmt`                       | `taplo check`   | `taplo check` with a schema, SchemaStore-aware | `taplo lint`             |
| `.env`               | none                              | `dotenv-linter` | preset policy: required keys, no values          | `dotenv-linter`          |
| plist, entitlements  | `plutil -convert xml1` round trip | `plutil -lint`  | preset policy                                    | preset policy              |
| xcconfig             | preset formatter                    | preset parser     | preset policy                                    | preset policy              |
| xcstrings            | none                              | `xcstringstool` | `xcstringstool`                                | translation completeness |
| XML, storyboard, xib | Prettier                          | `xmllint`       | none                                           | unused-scene check       |

##### Schema validation is the interesting kind

`v8r` and `taplo` both resolve schemas from SchemaStore by filename, which means a large set of
configuration files gets real validation for free:

| File                               | Schema source                                         | Would have caught                                                                       |
| ---------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `package.json`                     | SchemaStore                                           |                                                                                         |
| `tsconfig.json`                    | SchemaStore                                           |                                                                                         |
| `.markdownlint-cli2.jsonc`         | SchemaStore                                           |                                                                                         |
| `mise.toml`                        | mise's published schema                               |                                                                                         |
| `pyproject.toml`                   | `validate-pyproject`                                  |                                                                                         |
| `supabase/config.toml`             | Supabase CLI schema                                   |                                                                                         |
| `.github/workflows/*.yml`          | `actionlint`, which is stronger than a schema         |                                                                                         |
| `knip.json`                        | SchemaStore                                           | `eslint.entry: ["eslint-config.js"]`, a typo present in two files in the reference tree |
| `.syncpackrc`                      | The `$schema` key the reference file already declares |                                                                                         |
| `docker-compose.yml`               | Compose spec schema                                   | The reference repository validates it with nothing, not even `docker compose config`    |
| `.qlty/qlty.toml`                  | qlty schema                                           |                                                                                         |
| `*.xctestplan`                     | Apple's schema                                        |                                                                                         |
| `Assets.xcassets/**/Contents.json` | Asset catalogue schema                                | The 28 files excluded from Prettier, qlty and typos in the reference tree               |

That table is the argument for the preset. Nothing in it is bespoke work.

##### The `.env` policy

`.env` files are the highest-risk data files, and the reference repository guards them with one
pre-commit step: a production env guard on staged `.env.prod*` paths. The preset does more:

- `dotenv-linter` for duplicate keys, unordered keys, missing quotes, leading spaces, incorrect
  delimiters.
- A preset policy check: a tracked `.env*` file contains keys and no values, unless the settings file
  declares it an example file. A tracked file with a value that looks like a credential fails,
  before gitleaks even runs.
- `.env.example` completeness: every key the code reads through the declared environment accessor
  appears in the example file. That is derivable from the TypeScript or Python source through the
  structure engine.

The reference repository's production guard is kept as a preset check, generalised: any tracked path
matching a declared production pattern fails at commit.

#### Required inspections

```text
.json .jsonc            format syntax spelling, plus schema when one is known
.yaml .yml              format syntax style spelling, plus schema when one is known
.toml                   format syntax schema style spelling
.env .env.*             syntax style spelling security
.plist .entitlements    syntax schema spelling
.lock uv.lock bun.lock  syntax deps
.webmanifest            syntax schema
.txt                    spelling
.nvmrc .node-version    syntax
_headers _redirects     syntax, through platform:cloudflare
.xcconfig               syntax schema spelling security
.xcstrings              syntax schema spelling
.xml .storyboard .xib   format syntax spelling
```

No `prose`: Vale has no comment-only mode for any of these, which [../11-prose.md](11-prose.md)
states and which the required inspections reflects by omission rather than by an exclusion. No `structure` or
`naming`: the structure engine has no adapter for data formats, which is accepted.

`.xcconfig` gets `secrets` explicitly because the reference repository's `.gitleaks.toml` allowlists
four public client identifiers in `ios/Yap/Config/*.xcconfig`. Those four entries become four
`[[exception]]` entries with reasons.

#### Totality

| Habit                                             | Reference evidence                                                                  | gspot                                                                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Configuration files are not code                  | Nine TOML files with spelling only                                                  | Claimed, with schema validation                                                                                 |
| Generated data files are excluded from everything | 28 `Contents.json` excluded from Prettier, qlty and typos                           | Claimed for `syntax` and `schema`; `format` and `spelling` omitted by declaration, because Xcode owns the bytes |
| Compose files are validated by the runtime, later | `api/docker-compose.yml` validated by nothing                                       | `docker compose config` plus the Compose spec schema, at `lint:docker`                                          |
| Ansible playbooks are configuration               | `api/deploy/*.yml` with no `ansible-lint`, although `ansible-core` 2.19.4 is pinned | `ansible-lint`, enabled when a playbook or an `ansible.cfg` is detected                                         |
| Locale files are content                          | `.xcstrings` and `next-intl` message JSON                                           | Claimed: schema, plus translation completeness per locale, plus usage cross-check against the source            |

The locale row generalises `slopshop`'s three bespoke checks (`integrity/locales.mjs`,
`integrity/translation-usage.mjs`, `config/application/translations.mjs`). Message-catalogue
completeness and unused-message detection are not project-specific, and they belong to
`library:next-intl`, driven by a shared implementation in `repository:configuration`.
