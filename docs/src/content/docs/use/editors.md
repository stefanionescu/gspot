---
title: Editors
description: Make your editor run the same tools, with the same settings, as gspot.
---

Your editor reads the same config files as gspot. A link file at the root of each scope leads each editor extension
to its config file under `.gspot/configurations/`, so the editor reports what `gspot check` reports.

## Before you open the editor

Run `gspot install` in each clone first. The config files load their plugins from `.gspot/node_modules` and
`.gspot/.venv`, so the ESLint extension, for example, fails until `gspot install` puts the tools there.

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
gspot version. Editors that read SchemaStore, and the v8r check of `data-files`, validate `gspot.toml` against it. gspot
itself checks `gspot.toml` against the version your repository pins on every run.
