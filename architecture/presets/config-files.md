# `config-files`

Kind: concern. Requires: formatting. Recommends: spelling. Claims every data and configuration file no
language owns, so `.toml`, `.yaml` and `.json` files stop being spell-checked only.

## Detects and claims

|                         |                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detect                  | any repository                                                                                                                                                                                                                                                                                          |
| Claims                  | `.json`, `.jsonc`, `.json5`, `.yaml`, `.yml`, `.toml`, `.ini`, `.cfg`, `.properties`, `.env`, `.env.*` (tracked ones only), `.plist`, `.entitlements`, `.xcconfig`, `.xcstrings`, `.xml`, `.storyboard`, `.xib`, `.webmanifest`, `.nvmrc`, `.node-version`, `.python-version`, `_headers`, `_redirects` |
| Required check coverage | format, syntax, schema where a schema is known, style, spelling                                                                                                                                                                                                                                         |

## Tools

taplo, yamllint, v8r, actionlint, zizmor, dotenv-linter, plutil (host, macOS),
xmllint (host).
Prettier comes from the formatting preset.

## Generated configuration

| Target                | Holds                                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.gspot/taplo.toml`   | schema loading off (v8r owns schemas, at push); indent and column width from `[format]`; arrays never expanded or collapsed, no padding inside brackets or inline tables, the style the `gspot.toml` writer emits (D-75); `[tools.taplo] rules` on top |
| `.gspot/yamllint.yml` | `extends: default`, line length and document start off, `truthy` not on keys (the `on:` of a workflow), one space allowed inside braces and brackets (the Prettier style), indent from `[format]`                                                      |
| `.gspot/v8r.yml`      | errors for files with no known schema ignored; a custom catalog with the mise schema and every `[tools.v8r] schemas` entry on top of SchemaStore                                                                                                       |

Each has a stub at the conventional path (`.taplo.toml`, `.yamllint.yml`, `.v8rrc.yml`) so editors
and bare tool runs find it.

## Checks

| Id                              | Stage         | Command                                                                                                                                          |
| ------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config-files/json`             | commit        | Prettier parses and formats JSON, JSONC and JSON5; the findings come from `formatting/prettier`                                                  |
| `config-files/toml`             | commit        | `taplo check --no-schema {files}`: syntax alone, offline                                                                                         |
| `config-files/toml-format`      | commit        | `taplo fmt --check {files}`; fix, order format                                                                                                   |
| `config-files/yaml`             | commit        | `yamllint -c .gspot/yamllint.yml -f parsable -s {files}`                                                                                         |
| `config-files/schema`           | push, network | `v8r --ignore-errors {files}` over JSON, YAML and TOML: `package.json`, `tsconfig.json`, workflows, mise and the rest of the SchemaStore catalog |
| `config-files/actions`          | commit        | `actionlint {files}` over `.github/workflows/*`                                                                                                  |
| `config-files/actions-security` | commit        | `zizmor --offline --format github {files}` over `.github/workflows/*`                                                                            |
| `config-files/dotenv`           | commit        | `dotenv-linter check {files}` over tracked environment files (`.env*`, `.dev.vars*`); fix, order format                                          |
| `config-files/env-example`      | push          | engine: every key the code reads through `process.env`, `os.environ` or the declared accessor appears in a template                              |
| `config-files/plist`            | commit, macOS | `plutil -lint {files}` over `.plist` and `.entitlements`                                                                                         |
| `config-files/xml`              | commit        | `xmllint --noout {files}` over `.xml`, `.storyboard` and `.xib`                                                                                  |

`config-files/env-example` searches the whole scope for reads and compares them with the
templates in the scope; a scope with no template has nothing to compare and no finding.
`.xcstrings` files are claimed here and checked by the xcode preset.

## Settings

`tools.yamllint.rules`, `tools.taplo.rules`, `tools.v8r.schemas` (entries with a `pattern` and a
`schema` URL), `tools.dotenv.templates` (default `.env.example`, `.env.template`, `.env.sample`,
`.dev.vars.example`), `tools.dotenv.accessor` (the function name that reads environment
variables, on top of `process.env` and `os.environ`).

## Rule files

`general/code/CONFIGURATION.md`, `language/YAML.md`, `tool/tasks/TASKS.md`;
`tool/github-actions/GITHUB-ACTIONS.md` when `.github/workflows/` holds a workflow.

Ansible playbooks have their own preset, `ansible`, so a repository with no playbook installs no
ansible-lint. It detects `ansible.cfg` and runs `ansible/lint` in every folder that holds one.
