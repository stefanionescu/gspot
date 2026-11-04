---
title: Editors
description: Make your editor run the same tools, with the same settings, as gspot.
---

Your editor reads the same generated config files as gspot. ESLint and Prettier extensions run the packages of the
workspace, so their versions can differ from the tools that gspot installs.

## Before you open the editor

Run `gspot install` in each clone first. The generated config files load their plugins from `.gspot/node_modules` and
`.gspot/.venv`.

For a repository without its own ESLint, add this setting to VS Code's workspace settings:

```json title=".vscode/settings.json"
{
    "eslint.nodePath": ".gspot/node_modules"
}
```

Check your editor's output to confirm which ESLint and Prettier versions it runs.

## How editors find the generated config files

| Tool         | Pointer file                                 |
| ------------ | -------------------------------------------- |
| ESLint       | `eslint.config.mjs`                          |
| Prettier     | `prettier.config.mjs`                        |
| Stylelint    | `.stylelintrc.yml`, at the root only         |
| markdownlint | `.markdownlint.jsonc`                        |
| Ruff         | `ruff.toml`                                  |
| basedpyright | `pyrightconfig.json`                         |
| SwiftLint    | `.swiftlint.yml`, also in Swift test folders |

The Stylelint pointer file sits at the repository root and holds one override for each scope that selects `css`. A
`package.json` that keeps a `stylelint` field outside the root points at the generated config file of its scope instead.

`.editorconfig` carries the `[format]` settings to every editor that reads it.
[Files and caches](/reference/generated-files/) lists every file gspot writes.

## Tools without a pointer file

Five tools cannot extend a config file at another path, so gspot writes no pointer file for them. It passes their config
file with `--config` when it runs them. Without that path, an editor extension uses the defaults of the tool, and
format-on-save writes text that the check rejects. Give the extension the same path:

| Tool                 | Config file in `.gspot/configurations/` | VS Code setting                                                                                                           |
| -------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Taplo                | `taplo.toml` in `general/data-files/`   | `evenBetterToml.taplo.configFile.path` of [Even Better TOML](https://github.com/tamasfe/taplo/tree/master/editors/vscode) |
| typos                | `typos.toml` in `general/spelling/`     | `typos.config` of [typos-lsp](https://github.com/tekumara/typos-lsp)                                                      |
| Vale, at level `all` | `vale.ini` in `general/prose/`          | `vale.valeCLI.config` of [Vale VSCode](https://github.com/chrischinchilla/vale-vscode)                                    |
| SQLFluff             | `sqlfluff.cfg` in `language/sql/`       | `sqlfluff.config` of [vscode-sqlfluff](https://github.com/sqlfluff/vscode-sqlfluff)                                       |
| SwiftFormat          | `swiftformat` in `language/swift/`      | `swiftformat.configSearchPaths` of [vscode-swiftformat](https://github.com/vknabel/vscode-swiftformat)                    |

These are the files of the root scope.

A tool config of your own, such as `.taplo.toml` at the root, does not help: `gspot/conflicting-configs` reports it,
because gspot writes the settings of that tool.

## Validate `gspot.toml`

SchemaStore lists the [JSON Schema of `gspot.toml`](https://generativespotting.com/gspot.schema.json) for the newest
gspot version. An editor that reads SchemaStore can use a schema one release ahead of or behind your pinned version.
gspot checks `gspot.toml` against the version your repository pins on every run.
