---
title: Editors
description: Make your editor run the same tools, with the same settings, as gspot.
---

Editor extensions read the same generated config files as gspot. The ESLint and Prettier extensions, however, run the
ESLint and Prettier packages of your project, not the copies that gspot installs, so their versions can differ.

## Before you open the editor

Run `gspot install` in each clone first, because the generated config files load their plugins from
`.gspot/node_modules` and `.gspot/.venv`, which it fills.

If your project does not depend on ESLint itself, add this setting to the VS Code workspace settings, so that the ESLint
extension uses the ESLint that gspot installs:

```json title=".vscode/settings.json"
{
    "eslint.nodePath": ".gspot/node_modules"
}
```

To confirm which ESLint and Prettier versions your editor runs, read the output of each extension.

## How editors find the generated config files

gspot writes the config files of the tools in `.gspot/`. For most tools, it also writes a pointer file: a small config
file at the path where the tool and its editor extension look, which loads the config file in `.gspot/`.

| Tool         | Pointer file                                 |
| ------------ | -------------------------------------------- |
| ESLint       | `eslint.config.mjs`                          |
| Prettier     | `prettier.config.mjs`                        |
| Stylelint    | `.stylelintrc.yml`, at the root only         |
| markdownlint | `.markdownlint.jsonc`                        |
| Ruff         | `ruff.toml`                                  |
| basedpyright | `pyrightconfig.json`                         |
| SwiftLint    | `.swiftlint.yml`, also in Swift test folders |

gspot also writes the `[format]` settings into `.editorconfig`, so each editor that reads `.editorconfig` uses them.
[Files and caches](/reference/generated-files/) lists every file that gspot writes.

## Tools without a pointer file

Five tools cannot load a config file from another path, so gspot passes the config file with `--config` when it runs
them. An editor extension without that path uses the defaults of the tool, and format on save then writes text that the
check rejects. Vale runs at level `all` only.

| Tool        | VS Code extension                                                               |
| ----------- | ------------------------------------------------------------------------------- |
| Taplo       | [Even Better TOML](https://github.com/tamasfe/taplo/tree/master/editors/vscode) |
| typos       | [typos-lsp](https://github.com/tekumara/typos-lsp)                              |
| Vale        | [Vale VSCode](https://github.com/chrischinchilla/vale-vscode)                   |
| SQLFluff    | [vscode-sqlfluff](https://github.com/sqlfluff/vscode-sqlfluff)                  |
| SwiftFormat | [vscode-swiftformat](https://github.com/vknabel/vscode-swiftformat)             |

Give each extension that you use the same path, in `.gspot/configurations/<configuration>/`:

```json title=".vscode/settings.json"
{
    "evenBetterToml.taplo.configFile.path": ".gspot/configurations/data-files/taplo.toml",
    "typos.config": ".gspot/configurations/spelling/typos.toml",
    "vale.valeCLI.config": ".gspot/configurations/prose/vale.ini",
    "sqlfluff.config": ".gspot/configurations/sql/sqlfluff.cfg",
    "swiftformat.configSearchPaths": [".gspot/configurations/swift/swiftformat"]
}
```

Do not add a config file of your own for these tools, such as `.taplo.toml` in the root folder, because gspot writes
their settings and `gspot/conflicting-configs` reports such a file.

## Validate `gspot.toml`

SchemaStore lists the [JSON Schema of `gspot.toml`](https://generativespotting.com/gspot.schema.json) for the newest
gspot version, so an editor that reads SchemaStore checks `gspot.toml` as you type. That schema can be one release ahead
of or behind the gspot version that you pin, and on every run, gspot itself checks `gspot.toml` against the version that
your repository pins.
