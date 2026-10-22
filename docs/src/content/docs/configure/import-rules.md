---
title: Import rules
description: Describe the layers of your code once in gspot.toml, and check every import in JavaScript, TypeScript, Python, and Swift against them.
---

An import rule names a group of files and the groups they may import. gspot checks JavaScript and TypeScript imports
with ESLint, and Python and Swift imports with the built-in `structure/import-rules` check.

## Write the rules in order

Each `[[import_rule]]` record names its files in `paths`. List the base layer first:

```toml
[[import_rule]]
name = "core"
paths = ["src/core/**"]

[[import_rule]]
name = "features"
paths = ["src/features/**"]

[[import_rule]]
name = "app"
paths = ["src/app/**"]
```

Code may import its own files and the files of every rule above it, never below. Here `features` may import
`core`, and `app` may import both. A `core` file that imports a `features` file reports the rule that refused it:

```text
Import rule "core" may import only its own files, not ../features/cart.ts from import-rule:features. Move the code, move that rule above this one, or list the rules it may import in can_import.
```

A file belongs to the first rule whose paths match it.

## Allow a rule listed below

To let a rule import a rule listed below it, move that rule above it. `can_import` gives the exact list instead, and
replaces the rules above. A plugin that may import only the SDK:

```toml
[[import_rule]]
name = "plugins"
paths = ["src/plugins/**"]
can_import = ["sdk"]
```

Each name must match an import rule.

## Every code file belongs to a rule

With import rules present, `structure/import-rules` reports each code file that no rule covers. These files need no
rule:

- test files, from `test_files`;
- tool settings files, such as `vite.config.ts`, `.eslintrc.cjs`, `Package.swift`, and `setup.py`;
- the script files of `javascript.script_files`, and `mise` task scripts;
- scripts that start with a Node.js shebang, and files under `.gspot/`.

To leave other files out, record an ignore with paths and a reason:

```shell
gspot ignore structure/import-rules --paths "tools/**" --reason "Release tools run outside the app."
```

## Modules that the host provides

Code that runs inside another application imports modules that the repository lacks. Name them, so the checks skip
them:

```toml
[javascript]
externals = { value = ["../../scripts/app.js"], reason = "ComfyUI serves its frontend modules." }

[python]
externals = { value = ["folder_paths", "comfy"], reason = "ComfyUI provides these modules at run time." }
```

A Python name also covers its submodules. TypeScript still needs a declaration file for a JavaScript external.

## Python

`structure/import-rules` reads `import` and `from ... import` statements, relative imports included. It finds an
absolute module from the scope folder, from `src/`, and from each folder in `python.extra_paths`. For each dotted
name, it tries the module file, then its `.pyi` stub, then the `__init__.py` of a package folder. A module that matches
no file counts as a third-party package, and the check skips it.

```toml
[[import_rule]]
name = "domain"
paths = ["src/shop/domain/**"]

[[import_rule]]
name = "adapters"
paths = ["src/shop/adapters/**"]
```

Here `from shop.adapters import db` in a domain module reports a finding.

## Swift

Swift imports name modules. gspot maps each module to its folder: SwiftPM targets come from `Package.swift`, with
`path:` or the default `Sources/<name>` and `Tests/<name>` folders, and Xcode targets come from the project file. The
check skips a module outside the repository, such as `Foundation`.

```toml
[[import_rule]]
name = "models"
paths = ["Sources/Models/**"]

[[import_rule]]
name = "views"
paths = ["Sources/Views/**"]
```

## Move off import-linter contracts

gspot does not run import-linter. Write a layers contract as import rules, lowest layer first, and an independence
contract as rules with `can_import` lists that leave each other out. To keep a contract that import rules cannot
express, run `lint-imports` as a command check.

[Import rule settings](/reference/gspot-toml/#import_rule) lists the accepted fields.
