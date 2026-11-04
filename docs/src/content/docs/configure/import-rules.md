---
title: Import rules
description: Describe the layers of your code once in gspot.toml, and check every import in JavaScript, TypeScript, Python, and Swift against them.
---

An import rule names a group of files, called a layer, and the layers that those files may import. gspot checks the
imports of JavaScript and TypeScript files with ESLint. It checks the imports of Python and Swift files with its own
check, `structure/import-rules`.

## Write the rules in order

Each `[[import_rule]]` record names its files in `paths`. List the lowest layer first, the code that the other layers
build on:

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

A file may import the files of its own rule and of each rule listed before it, but not of a rule listed after it. Here
`features` may import `core`, and `app` may import both. When a `core` file imports a `features` file, the finding
names the rule that refused the import:

```text
Import rule "core" may import only its own files, not ../features/cart.ts from import-rule:features. Move the code, move that rule above this one, or list the rules it may import in can_import.
```

Each file belongs to one rule: the first rule whose paths match it. gspot rejects a path that starts with `!`, except
an extglob pattern such as `!(generated)/**`. To keep some files out of a rule, put a narrower rule for them first, and
list what they may import in its `can_import`.

After you write the rules, run `gspot install`. JavaScript and TypeScript import rules need an ESLint plugin that
`gspot install` adds. Until you run it, `javascript/eslint` reports `missing`.

## Allow a rule that comes later

To let a rule import a rule that comes after it, move the imported rule before it. Or give the exact list of rules
that it may import in `can_import`. That list takes the place of the rules that come before it. This rule lets the plugins
import only the `sdk` rule:

```toml
[[import_rule]]
name = "plugins"
paths = ["src/plugins/**"]
can_import = ["sdk"]
```

Each name in `can_import` must be the name of an import rule.

## Keep relative imports inside a folder

The ESLint rule `gspot/import-boundaries` checks JavaScript and TypeScript imports at level `all` only. At level
`basic`, `javascript.import_boundaries` has no effect. The rule keeps each relative import inside its folder. To import
a file from another folder, use the import alias of `tsconfig.json` or `package.json`, which `eslint --fix` writes for
you. By default, the boundaries are each scope and each folder two levels down, such as `src/features/`. To make each
feature folder a boundary:

```toml
[javascript]
import_boundaries = ["src/features/*"]
```

A relative import from one feature folder into another then gets a finding, and the fix writes the alias:

```ts title="src/features/account/page.ts"
import { session } from '../auth/session.ts'; // the fix writes '@/features/auth/session.ts'
```

The import rules still decide whether one feature may import another.

## Every code file belongs to a rule

When `gspot.toml` has import rules, `structure/import-rules` reports each code file that no rule covers. These files
need no rule:

- test files, from `test_files`;
- tool configs, such as `vite.config.ts`, `.eslintrc.cjs`, `Package.swift`, and `setup.py`;
- the files that `[[tools.eslint.plugins]]` records name;
- the script files of `javascript.script_files`, and `mise` task scripts;
- scripts that start with a Node.js shebang, and files under `.gspot/`.

To leave out other files, add an ignore with paths and a reason:

```shell
gspot ignore structure/import-rules --paths "tools/**" --reason "Release tools run outside the app."
```

## Modules that the host provides

Code that runs inside another application imports modules that the host application provides when it runs. These
modules are not in your repository. List them in `externals`, so that the checks skip them:

```toml
[javascript]
externals = { value = ["../../scripts/app.js"], reason = "ComfyUI serves its frontend modules." }

[python]
externals = { value = ["folder_paths", "comfy"], reason = "ComfyUI provides these modules at run time." }
```

A Python name also covers its submodules. For a JavaScript external, TypeScript still needs a declaration file that
describes its types.

## Python

`structure/import-rules` reads `import` and `from ... import` statements, including relative imports. It looks for an
absolute module in the scope folder, in `src/`, and in each folder of `python.import_folders`. For each dotted name, it
looks for the module file, then its `.pyi` stub, then the `__init__.py` of a package folder. When no file matches, the
module counts as a third-party package, and the check skips it.

```toml
[[import_rule]]
name = "domain"
paths = ["src/shop/domain/**"]

[[import_rule]]
name = "adapters"
paths = ["src/shop/adapters/**"]
```

With these rules, `from shop.adapters import db` in a file of `domain` gets a finding.

## Swift

A Swift import names a module, not a file, so gspot finds the folder of each module. It reads the SwiftPM targets from
`Package.swift`, with their `path:` or the default folders `Sources/<name>` and `Tests/<name>`. It reads the Xcode
targets from the project file. The check skips a module from outside the repository, such as `Foundation`.

```toml
[[import_rule]]
name = "models"
paths = ["Sources/Models/**"]

[[import_rule]]
name = "views"
paths = ["Sources/Views/**"]
```

## Replace import-linter contracts

gspot does not run import-linter. Write a layers contract as import rules, with the lowest layer first. Write an
independence contract as rules whose `can_import` lists leave each other out. To keep a contract that import rules
cannot express, run `lint-imports` as a command check.

[Import rule settings](/reference/gspot-toml/#import_rule) lists the accepted fields.
