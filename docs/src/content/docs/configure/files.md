---
title: Choose the files gspot checks
description: Select source files, generated files, copied files, and test files.
---

gspot reads the files Git tracks, plus untracked files that `.gitignore` does not hide.
Use `.gitignore` for files outside the project. Mark generated or copied files in `.gitattributes`.

## Mark generated and copied files

Mark files a tool writes as `linguist-generated` and files copied from another project as `linguist-vendored`:

```text
src/generated/** linguist-generated
vendor/** linguist-vendored
```

gspot does not check these files as your own code.

## Test files

```shell
gspot set test_files "tests/**/*.test.ts"
```

`test_files` identifies test files for test rules. It does not exclude those files. A scope can declare its own patterns.

See [`test_files`](/reference/gspot-toml/#test_files) for its accepted value.
