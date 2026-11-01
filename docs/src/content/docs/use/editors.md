---
title: Editors
description: Make your editor run the same tools, with the same settings, as gspot.
---

Your editor reads the same config files as gspot. ESLint and Prettier extensions normally run the workspace's own
packages, so their versions can differ from the tools that gspot installs.

## Before you open the editor

Run `gspot install` in each clone first. The config files load their plugins from `.gspot/node_modules` and
`.gspot/.venv`.

For a repository without its own ESLint, add this setting to VS Code's workspace settings:

```json title=".vscode/settings.json"
{
    "eslint.nodePath": ".gspot/node_modules"
}
```

Check your editor's output to confirm which ESLint and Prettier versions it runs.

## How editors find the config files

| Tool         | Link file                                    |
| ------------ | -------------------------------------------- |
| ESLint       | `eslint.config.mjs`                          |
| Prettier     | `prettier.config.mjs`                        |
| Stylelint    | `.stylelintrc.yml`, at the root only         |
| markdownlint | `.markdownlint.jsonc`                        |
| Ruff         | `ruff.toml`                                  |
| basedpyright | `pyrightconfig.json`                         |
| SwiftLint    | `.swiftlint.yml`, also in Swift test folders |

The Stylelint link file sits at the repository root and holds one override for each scope that selects `css`. A
`package.json` that keeps a `stylelint` field outside the root points at the config file of its scope instead.

`.editorconfig` carries the `[format]` settings to every editor that reads it. Some tools have no link file; gspot passes
their config file when it runs them, so give your editor the same path. [Generated files](/reference/generated-files/)
lists every file gspot writes.

## Validate `gspot.toml`

SchemaStore lists the [JSON Schema of `gspot.toml`](https://generativespotting.com/gspot.schema.json) for the newest
gspot version. An editor that reads SchemaStore can use a schema one release ahead of or behind your pinned version.
gspot checks `gspot.toml` against the version your repository pins on every run.
