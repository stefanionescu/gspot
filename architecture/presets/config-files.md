# config-files

Kind: repository. Requires: formatting, spelling. Claims every data and configuration file no
language owns, so `.toml`, `.yaml` and `.json` files stop being spell-checked only.

## Detects and claims

| | |
| --- | --- |
| Detect | any repository |
| Claims | `.json`, `.jsonc`, `.json5`, `.yaml`, `.yml`, `.toml`, `.ini`, `.cfg`, `.properties`, `.env`, `.env.*` (tracked ones only), `.plist`, `.entitlements`, `.xcconfig`, `.xcstrings`, `.xml`, `.storyboard`, `.xib`, `.webmanifest`, `.nvmrc`, `.node-version`, `.python-version`, `_headers`, `_redirects` |
| Required inspections | format, syntax, schema where a schema is known, style, spelling |

## Tools

prettier, taplo, yamllint, v8r, actionlint, zizmor, dotenv-linter, plutil (host, macOS),
xmllint (host).

## Generated configuration

| Target | Holds |
| --- | --- |
| `.gspot/taplo.toml` | format from `[format]`; schema catalog on |
| `.gspot/yamllint.yml` | `extends: default`, line length off, document-start off, indent from `[format]` |
| `.gspot/v8r.yml` | SchemaStore catalog plus preset-known schemas (`mise`, `supabase/config.toml`, `wrangler`, `.xctestplan`, asset catalogue `Contents.json`) |

## Checks

| Id | Stage | Command |
| --- | --- | --- |
| `config-files/json` | commit | `prettier --check` and `@eslint/json` for JSON and JSONC |
| `config-files/toml` | commit | `taplo fmt --check`, `taplo check` with schema |
| `config-files/yaml` | commit | `yamllint -c .gspot/yamllint.yml {files}` |
| `config-files/schema` | commit | `v8r` over files with a known schema |
| `config-files/actions` | commit | `actionlint` and `zizmor` over `.github/workflows/*` |
| `config-files/dotenv` | commit | `dotenv-linter` over tracked environment files (`.env*`, `.dev.vars*`); a tracked one holds keys only unless declared a template |
| `config-files/env-example` | push | every key the code reads through the declared accessor appears in the template |
| `config-files/plist` | commit, macos | `plutil -lint`; `plutil -convert xml1` round trip |
| `config-files/xml` | commit | `xmllint --noout` |
| `config-files/xcstrings` | commit, macos | `xcstringstool` (through xcode) |
| `config-files/manifest-schema` | commit | `package.json`, `tsconfig.json`, `knip.json`, `pyproject.toml` (through `validate-pyproject`) against their schemas |

## Settings

`tools.yamllint.rules`, `tools.taplo.rules`, `tools.v8r.schemas` (file pattern to schema URL),
`tools.dotenv.templates` (default `.env.example`, `.env.template`, `.env.sample`),
`tools.dotenv.accessor` (the function name that reads environment variables).

## Rule files

`general/code/CONFIGURATION.md`, `language/YAML.md`, `tool/tasks/TASKS.md`.
