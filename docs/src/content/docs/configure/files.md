---
title: Exclude files
description: Keep generator output, vendored files, and other files out of the checks.
---

gspot reads the files Git tracks, plus untracked files that `.gitignore` does not hide.
Use `.gitignore` for files outside the project.

## Mark generator output and vendored files

In `.gitattributes`, mark generator output as `linguist-generated`. Mark vendored files, which you copied from another project, as `linguist-vendored`:

```text
src/generated/** linguist-generated
vendor/** linguist-vendored
```

gspot does not check these files as your own code.

## Test files

```shell
gspot set test_files "tests/**/*.test.ts"
```

`test_files` selects the files that the test lint rules read as tests; it does not exclude them from other checks. A scope can set its own patterns.

See [`test_files`](/reference/gspot-toml/#test_files) for its accepted value.
