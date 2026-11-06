---
title: Import rules
description: Keep the layers of your code apart in JavaScript, TypeScript, Python, and Swift.
---

Import rules keep the layers of your code apart, so that code in `src/core/` cannot import code from `src/app/`. You
list the layers in `gspot.toml`, lowest first, and gspot reports each import that reaches a higher layer. ESLint checks
the imports of JavaScript and TypeScript files, and the check `structure/import-rules` checks those of Python and Swift
files.

## Write the rules in order

Each `[[import_rule]]` record names its files in `paths`, with the code that the other layers build on first:

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

A file may import the files of its own rule and of each rule listed before it, so here `features` may import `core`, and
`app` may import both. When a `core` file imports a `features` file, the finding names the rule that refused the import:

```text
Import rule "core" may import only its own files, not ../features/cart.ts from import-rule:features. Move the code, move that rule above this one, or list the rules it may import in can_import.
```

Each file belongs to the first rule whose paths match it. gspot rejects a path that starts with `!`, except an extglob
pattern such as `!(generated)/**`. To keep some files out of a rule, put a narrower rule for them first, and list what
they may import in its `can_import`.

After you write the rules, run `gspot install`, because JavaScript and TypeScript import rules need an ESLint plugin
that it adds. Until you run it, `javascript/eslint` reports `missing`.

## Every code file belongs to a rule

Once `gspot.toml` has import rules, `structure/import-rules` reports each code file that no rule covers. These files
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

## Allow a rule that comes later

To let a rule import a rule that comes after it, move the imported rule before it, or list what it may import in
`can_import`. That list replaces the rules that come before it, so this rule lets the plugins import only `sdk`:

```toml
[[import_rule]]
name = "plugins"
paths = ["src/plugins/**"]
can_import = ["sdk"]
```

## Modules that the host provides

Code that runs inside another application imports modules that your repository does not hold. List them in `externals`,
so that the checks skip them:

```toml
[javascript]
externals = { value = ["../../scripts/app.js"], reason = "ComfyUI serves its frontend modules." }

[python]
externals = { value = ["folder_paths", "comfy"], reason = "ComfyUI provides these modules at run time." }
```

A Python name also covers its submodules. For a JavaScript external, TypeScript still needs a declaration file that
describes its types.

## Python

`structure/import-rules` reads `import` and `from ... import` statements, including relative imports. If your Python
packages are not in the scope folder or `src/`, list their folders in `python.import_folders`. A module with no file in
those folders counts as a third-party package, and the check skips it.

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
`Package.swift`, with their `path:` or the default folders `Sources/<name>` and `Tests/<name>`, and the Xcode targets
from the project file. The check skips a module from outside the repository, such as `Foundation`.

Files of one target use each other with no `import`, so a Swift rule also reads the types that each file names. The
check looks for a type that exactly one rule declares at the top level of a file. It reports the first use of that type
in each file whose rule may not import the declaring rule.

```toml
[[import_rule]]
name = "models"
paths = ["Sources/Models/**"]

[[import_rule]]
name = "views"
paths = ["Sources/Views/**"]
```

With these rules, a file of `models` that names a `CartView` struct from a file of `views` gets a finding, with or
without an `import` line.

The check matches names and does not resolve types, so it has these limits:

- It does not see a type that a file reaches only through inference, such as `let total = cart.summary.total`.
- It skips a name that several rules declare.
- It skips a name that a nested type or generic parameter declares in the rule of the file or in a rule that it may
  import.
- It does not see a type whose declaration the Swift parser cannot read.
- It reports a use of a framework type when one of your rules declares the same name.

Separate Swift packages add what names cannot: the compiler refuses a use that a target does not import.

## Replace import-linter contracts

gspot does not run import-linter. Write a layers contract as import rules, with the lowest layer first, and an
independence contract as rules whose `can_import` lists leave each other out. To keep a contract that import rules
cannot express, run `lint-imports` as a command check. [Import rule settings](/reference/gspot-toml/#import_rule) lists
every field.

## Keep relative imports inside a folder

At level `all`, the ESLint rule `gspot/import-boundaries` keeps each relative import in JavaScript and TypeScript inside
its folder. To import a file from another folder, use the import alias of `tsconfig.json` or `package.json`, which
`eslint --fix` writes for you. By default, the boundaries are each scope and each folder two levels down, such as
`src/features/`. To make each feature folder a boundary:

```toml
[javascript]
import_boundaries = ["src/features/*"]
```

A relative import from one feature folder into another then gets a finding, and the fix writes the alias:

```ts title="src/features/account/page.ts"
import { session } from '../auth/session.ts'; // the fix writes '@/features/auth/session.ts'
```

The import rules still decide whether one feature may import another.
