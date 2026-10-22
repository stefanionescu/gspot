---
title: Editors
description: Make your editor run the same tools, with the same settings, as gspot.
---

Your editor reads the same tool files as gspot. A pointer file at the root of each scope leads each editor extension
to its tool file under `.gspot/configurations/`, so the editor reports what `gspot check` reports.

## Before you open the editor

Run `gspot install` in each clone first. The tool files load their plugins from `.gspot/node_modules` and
`.gspot/.venv`, so the ESLint extension, for example, fails until `gspot install` puts the tools there.

## How editors find the tool files

| Tool         | Pointer                                      |
| ------------ | -------------------------------------------- |
| ESLint       | `eslint.config.mjs`                          |
| Prettier     | `prettier.config.mjs`                        |
| Stylelint    | `.stylelintrc.json`                          |
| markdownlint | `.markdownlint.jsonc`                        |
| Ruff         | `ruff.toml`                                  |
| basedpyright | `pyrightconfig.json`                         |
| SwiftLint    | `.swiftlint.yml`, also in Swift test folders |

`.editorconfig` carries the `[format]` settings to every editor that reads it. Some tools have no pointer; gspot passes
their tool file when it runs them, so give your editor the same path. [Generated files](/reference/generated-files/)
lists every file gspot writes.

## Validate `gspot.toml`

SchemaStore lists gspot, so an editor that reads the SchemaStore catalog validates `gspot.toml` against the
[JSON Schema](https://generativespotting.com/gspot.schema.json) with no `#:schema` comment.
