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

Record the generator or upstream owner along with its paths. The [policy reference](/reference/configuration/#generated) shows the accepted fields. Use `generated` for reproducible output and `vendored` for upstream files. These declarations remain repository-specific and are omitted from exported templates.

## Test files

```shell
gspot set tests "tests/**/*.test.ts"
```

`tests` identifies test files for test-specific lint rules. It does not exclude those files. A scope can declare its own test patterns.

## Accept a finding

```shell
gspot ignore naming/paths --paths "vendor/**" --reason "These upstream paths must match the published package."
```

The command writes an `[[ignore]]` entry and applies the policy. Add `--rule <id>` to accept one rule instead of the whole check. `require_reasons = true` requires a reason.

For a naming convention rather than a check exclusion, use `[[naming.paths]]`:

```toml
[[naming.paths]]
paths = ["migrations/**"]
categories = ["file"]
allow_digits = true
reason = "Migration filenames begin with their numeric version."
```

## Native ignore files

A custom check can declare `ignore_file = ".exampleignore"`. The file holds ordered gitignore patterns, including `!` patterns that include an excluded path again. gspot combines that file with saved check exclusions. See [custom checks](/guides/repository-checks/).
