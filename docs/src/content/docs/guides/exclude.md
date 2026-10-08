---
title: Exclude files
description: Declare excluded, generated, vendored, and test paths without hiding unrelated findings.
---

Inventory declarations and ignores have different effects. `exclude` removes paths before source content is read. `generated` and `vendored` describe files that do not belong to authored source checks. An `[[ignore]]` accepts findings for a named check. It can accept one rule, a set of paths, or both.

## Exclude build output

```shell
gspot set exclude "build/**" "dist/**"
```

Patterns are relative to the repository root. Keep the list narrow so authored source remains checked.

## Generated and vendored files

Record the generator or upstream owner along with its paths. The [policy reference](/reference/gspot-toml/#generated) shows the accepted fields. Use `generated` for reproducible output and `vendored` for upstream files. Exported templates retain these declarations. Review their paths in each destination.

## Test files

```shell
gspot set test_files "tests/**/*.test.ts"
```

`test_files` identifies test files for test-specific rules. It does not exclude those files. A scope can declare its own test patterns.

## Ignore a finding

```shell
gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results to the terminal."
```

The command writes an `[[ignore]]` entry and applies the policy. Add `--rule <id>` to accept one rule instead of the whole check. Every ignore needs a reason.

For a naming convention rather than a check exclusion, use `[[naming.overrides]]`:

```toml
[[naming.overrides]]
paths = ["migrations/**"]
categories = ["file"]
allow_digits = true
reason = "Migration filenames begin with their numeric version."
```

## Native ignore files

A command check can declare `ignore_file = ".exampleignore"`. The file holds ordered gitignore patterns, including `!` patterns that include an excluded path again. gspot combines that file with saved check exclusions. See [command checks](/guides/command-checks/).
