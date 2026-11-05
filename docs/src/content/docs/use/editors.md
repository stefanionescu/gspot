---
title: Editors
description: Make your editor run the same tools, with the same settings, as gspot.
---

Editor extensions read the same generated config files as gspot. The ESLint and Prettier extensions, however, run the
ESLint and Prettier packages of your project, not the copies that gspot installs. Their versions can differ.

## Before you open the editor

Run `gspot install` in each clone first. The generated config files load their plugins from `.gspot/node_modules` and
`.gspot/.venv`, which `gspot install` fills.

If your project does not depend on ESLint itself, add this setting to the VS Code workspace settings. The ESLint
extension then uses the ESLint that gspot installs:

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

The Stylelint pointer file is in the root folder, and holds one override for each scope that uses the `css`
configuration. When a `package.json` outside the root folder has a `stylelint` field, gspot points that field at the
generated config file of its scope instead.

gspot also writes the `[format]` settings into `.editorconfig`, so each editor that reads `.editorconfig` uses them.
[Files and caches](/reference/generated-files/) lists every file that gspot writes.

## Tools without a pointer file

Five tools cannot load a config file from another path, so gspot writes no pointer file for them. When gspot runs
them, it passes the config file with `--config`. An editor extension without that path uses the defaults of the tool,
and format on save then writes text that the check rejects. Give the extension the same path:

| Tool                 | Config file in `.gspot/configurations/` | VS Code setting                                                                                                           |
| -------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Taplo                | `taplo.toml` in `general/data-files/`   | `evenBetterToml.taplo.configFile.path` of [Even Better TOML](https://github.com/tamasfe/taplo/tree/master/editors/vscode) |
| typos                | `typos.toml` in `general/spelling/`     | `typos.config` of [typos-lsp](https://github.com/tekumara/typos-lsp)                                                      |
| Vale, at level `all` | `vale.ini` in `general/prose/`          | `vale.valeCLI.config` of [Vale VSCode](https://github.com/chrischinchilla/vale-vscode)                                    |
| SQLFluff             | `sqlfluff.cfg` in `language/sql/`       | `sqlfluff.config` of [vscode-sqlfluff](https://github.com/sqlfluff/vscode-sqlfluff)                                       |
| SwiftFormat          | `swiftformat` in `language/swift/`      | `swiftformat.configSearchPaths` of [vscode-swiftformat](https://github.com/vknabel/vscode-swiftformat)                    |

These paths are the files of the root.

Do not add a config file of your own for these tools, such as `.taplo.toml` in the root folder. gspot writes the
settings of these tools, so `gspot/conflicting-configs` reports such a file.

## Validate `gspot.toml`

SchemaStore lists the [JSON Schema of `gspot.toml`](https://generativespotting.com/gspot.schema.json) for the newest
gspot version. An editor that reads SchemaStore can use this schema to check `gspot.toml` as you type. That schema can
be one release ahead of or behind the gspot version that you pin. On every run, gspot itself checks `gspot.toml`
against the version that your repository pins.
