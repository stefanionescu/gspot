# Configuration Generation

Every tool gspot drives needs a configuration file, and gspot owns the contents while the consumer
owns the inputs. Three mechanisms, chosen per tool by what the tool supports.

## The three mechanisms

### 1. Native extend

The tool reads a config that references another config. gspot renders the real policy into
`.gspot/generated/`, and the conventional path holds a stub that extends it.

| Tool                | Stub at                        | Stub content                                                                                           |
| ------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| ESLint              | `eslint.config.js`             | `export { default } from './.gspot/generated/eslint.config.js';`                                       |
| Ruff                | `pyproject.toml` `[tool.ruff]` | `extend = ".gspot/generated/ruff.toml"`                                                                |
| stylelint           | `.stylelintrc.json`            | `{ "extends": "./.gspot/generated/stylelint.json" }`                                                   |
| `markdownlint-cli2` | `.markdownlint-cli2.jsonc`     | `{ "config": { "extends": ".gspot/generated/markdownlint.json" }, "globs": [...] }`                    |
| Prettier            | `.prettierrc.json`             | `"./.gspot/generated/prettier.json"` as the whole document, which Prettier resolves as a shared config |
| tsconfig            | `tsconfig.json`                | `{ "extends": "./.gspot/generated/tsconfig.base.json", "include": [...] }`                             |
| commitlint          | `.commitlintrc.json`           | `{ "extends": [".gspot/generated/commitlint.cjs"] }`                                                   |
| jscpd               | `.jscpd.json`                  | `{ "extends": ".gspot/generated/jscpd.json" }`                                                         |

The stub is the extension point the consumer does **not** use. Project-specific `include` lists in
`tsconfig.json` and the `globs` array in markdownlint are the exception: those are project facts,
they are rendered from `gspot.toml`, and the stub is regenerated when they change.

### 2. Compile and point

The tool has no extend mechanism. gspot renders the whole file and passes `--config` explicitly from
the task.

| Tool        | Generated path                      | Flag       |
| ----------- | ----------------------------------- | ---------- |
| typos       | `.gspot/generated/typos.toml`       | `--config` |
| ShellCheck  | `.gspot/generated/shellcheckrc`     | `--rcfile` |
| SwiftLint   | `.gspot/generated/swiftlint.yml`    | `--config` |
| SwiftFormat | `.gspot/generated/swiftformat`      | `--config` |
| Squawk      | `.gspot/generated/squawk.toml`      | `--config` |
| sqlfluff    | `.gspot/generated/sqlfluff.cfg`     | `--config` |
| lychee      | `.gspot/generated/lychee.toml`      | `--config` |
| Vale        | `.gspot/generated/vale.ini`         | `--config` |
| gitleaks    | `.gspot/generated/gitleaks.toml`    | `--config` |
| yamllint    | `.gspot/generated/yamllint.yml`     | `-c`       |
| hadolint    | `.gspot/generated/hadolint.yaml`    | `--config` |
| osv-scanner | `.gspot/generated/osv-scanner.toml` | `--config` |
| Periphery   | `.gspot/generated/periphery.yml`    | `--config` |

Passing `--config` explicitly closes a real hole: `yap-swift-app` runs the gitleaks runner with no
`--config`, and `.gitleaks.toml` is honoured only because gitleaks happens to discover it at the
source root. Change the working directory and the four allowlisted client identifiers stop being
allowlisted, silently. Every gspot task names its config.

### 3. Derived, single-source

Some files are consumed by more than one tool and must agree. gspot derives all of them from one
`[format]` block so they cannot disagree.

| Generated                                   | Derived from                                         | Consumers                                       |
| ------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------- |
| `.editorconfig`                             | `[format]` indent, width, line ending, final newline | editorconfig-checker, every editor, shfmt hints |
| `.prettierrc.json`                          | `[format]`                                           | Prettier                                        |
| `.gspot/generated/shfmt.flags`              | `[format]` plus shell dialect                        | shfmt                                           |
| `.gspot/generated/ruff.toml` format section | `[format]`                                           | Ruff format                                     |
| markdownlint `MD007` list indent            | `[format].indent_width`                              | markdownlint                                    |

`yap-swift-app` maintains this agreement by hand, with a comment in `.markdownlint-cli2.jsonc`
reading "MD007: List indent, 4 spaces, matching Prettier's tabWidth". One block replaces the comment
and the vigilance.

## Generated files are tracked

The alternative was considered and rejected. See [19-decisions.md](19-decisions.md), D-03.

Reasons to track:

1. **Editors and language servers walk up the tree.** An ESLint language server with no
   `eslint.config.js` reports nothing, and a Swift editor with no `.swiftlint.yml` shows no
   warnings. A build step that has to run before the editor works is a broken editor.
1. **`bunx <tool>` and `uv run <tool>` must work directly.** A developer debugging one rule runs the
   tool by hand.
1. **`gspot upgrade` produces a reviewable diff.** A rule set changing under a version bump is the
   single most important thing to see in a pull request.
1. **CI needs no bootstrap step.**

Every generated file opens with a header naming its origin:

```text

# Generated by gspot 0.1.0 from gspot.toml. Do not edit

# Regenerate: gspot sync

# Change policy: edit gspot.toml, then run gspot sync

```

For formats with no comment syntax (JSON), the header lives in a sibling
`.gspot/generated/<name>.provenance.json`, and JSON files that accept a `$schema` key also carry a
`"_generated"` key that the schema declares.

## Drift

`gspot sync --check` re-renders every generated file in memory and compares bytes. A difference fails, and
the message shows the diff and the two ways forward: move the change into `gspot.toml`, or run
`gspot sync` to discard it.

This check runs at pre-commit, because a hand edit to a generated file is cheapest to catch
immediately.

`gspot sync --check` also asserts three properties the reference repositories violate:

1. **Every glob matches something.** `yap-swift-app` carries eight globs under `shared/`,
   `workspace/` and `projects/` in `config/eslint.js` pointing at folders a refactor deleted, plus
   stale paths in `.prettierignore`, `.gitignore`, `ios/.swiftlint.yml`, two `knip.json` files and
   `README.md`. Under gspot, a glob matching nothing fails, unless the settings file marks it
   `forward_looking = true` with a reason.
1. **Every referenced file exists.** `api/knip.json` and `supabase/knip.json` both name
   `eslint.entry: ["eslint-config.js"]` while the file is `eslint.config.js`. A missing referent
   fails.
1. **Every generated file has a reader.** The orphan rule from the coverage check.

## Templates and product facts

A template renders from three inputs and nothing else: preset defaults, the merged settings, and
declared product facts.

A product fact is a value the product owns and the lint needs. The preset declares how to get it; it
never restates it.

```toml
[[project.value]]
id         = "nginx_image"
file       = "{project.compose_file}"
extract    = { kind = "yaml-path", path = "services.{project.nginx_service}.image" }
on_missing = "fail: nginx config lint needs the compose service image. Set project.compose_file in gspot.toml."
```

That block replaces `NGINX_IMAGE = 'nginx:1.29.3-alpine'` in `quality/config/nginx.js`, which
duplicates `api/docker-compose.yml:81` and goes stale the moment the image is bumped. Same for
`API_HOST_ENTRY = 'api:127.0.0.1'`, which exists because `api/nginx.conf:64` upstreams to
`api:3000`.

Extraction kinds: `yaml-path`, `json-path`, `toml-path`, `regex-capture`, `command-output`. Each
declares a failure message. There is no default value, because a default is how a stale duplicate
survives.

The runtime version is the same class of problem. `yap-swift-app` states the Node version in
`mise.toml` as 22.13.1, in `.nvmrc` as 20, in `engines.node` across five manifests as
`>=22.0.0 <23.0.0`, and in `quality/config/repository.js` as a constant. Under gspot the runner pin
is the source, `engines` and `.nvmrc` are generated from it, and `eslint-plugin-n` reads `engines`
as it already does with no gspot constant at all.

## Configuration gspot does not generate

Named so the boundary is clear:

- **`package.json` dependencies.** gspot emits `scripts` under the bun and npm runners and nothing
  else. A preset's npm tool requirements are peer dependencies of the preset, resolved at install.
- **`pyproject.toml` project metadata.** gspot writes only the `[tool.<linter>]` sections it owns,
  through a TOML edit that preserves the rest of the document and its comments.
- **`mise.toml` beyond `[tools]` and `[settings.task]`.** A consumer's `[env]` and `[tasks]` blocks
  survive untouched.
- **`supabase/config.toml`, `next.config.ts`, `wrangler.jsonc`, `.xcodeproj`.** Product
  configuration. Presets read them as product facts and validate them.
- **`.gitignore`.** gspot appends one managed block, delimited by markers, and never touches the
  rest:

```text

# >>> gspot managed >>>

/.gspot/run/ /gspot.local.toml /packages/prose/styles/\* !/packages/prose/styles/gspot/

# <<< gspot managed <<<

```

The same marker-block technique applies to `.gitattributes` and to `.prettierignore`, both of which
consumers have real reasons to extend by hand.
