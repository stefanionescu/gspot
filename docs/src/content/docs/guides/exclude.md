---
title: Exclude files and ignore findings
description: Exclude files, mark generated and copied files, and ignore findings without hiding unrelated problems.
---

gspot reads the files Git tracks, plus untracked files that `.gitignore` does not hide.
Hide files with `.gitignore`, mark generated and copied files in `.gitattributes`, ignore a finding, or allow a name.

## Mark generated and copied files

Mark files a tool writes as `linguist-generated` and files copied from another project as `linguist-vendored`:

```text
src/generated/** linguist-generated
vendor/** linguist-vendored
```

gspot does not check these files as your own code.

## Ignore a finding

```shell
gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results to the terminal."
```

Every ignore needs a reason. Leave out `--rule` to ignore the whole check.
Add `--paths` to select files. Add `--until YYYY-MM-DD` for an ignore that ends at 00:00 UTC on that date.
The saved record remains for review. To ignore a dependency advisory, use
`gspot ignore dependencies/osv --rule <advisory ID> --reason "..."` with the advisory's ID and your reason.

To remove the ignore:

```shell
gspot unignore javascript/eslint --rule no-console --paths "scripts/**"
```

`gspot check --verbose` prints each applied ignore, its reason, and the number of findings it matched.

## Allow a name

```toml
[[naming.override]]
paths = ["migrations/**"]
categories = ["files"]
allow_digits = true
reason = "Migration file names start with their version number."
```

Every naming override needs a reason. To allow specific names, use `allowed_names`.
See the [gspot.toml reference](/reference/gspot-toml/) for accepted fields.
