---
title: Editors
description: Make your editor run the same tools, with the same settings, as gspot.
---

Your editor reads the same config files as gspot. A pointer file at the root of each scope leads each editor extension
to its config file under `.gspot/configurations/`, so the editor reports what `gspot check` reports.

## Before you open the editor

Run `gspot install` in each clone first. The config files load their plugins from `.gspot/node_modules` and
`.gspot/.venv`, so the ESLint extension, for example, fails until `gspot install` puts the tools there.

## How editors find the config files

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
their config file when it runs them, so give your editor the same path. [Generated files](/reference/generated-files/)
lists every file gspot writes.

## Validate `gspot.toml`

gspot writes the JSON Schema of its own version to `gspot.schema.json` in the `.gspot` folder, and starts `gspot.toml`
with a line that points to it:

```toml title="gspot.toml"
#:schema ./.gspot/gspot.schema.json
```

Editors that read Taplo directives validate `gspot.toml` against the version your repository pins, and so does the v8r
check of `data-files`. SchemaStore lists the [newest schema](https://generativespotting.com/gspot.schema.json) for a
`gspot.toml` without that line.
