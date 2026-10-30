---
title: Ignore findings
description: Record an ignore with a reason, then inspect or remove it.
tableOfContents: false
---

```shell
gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results to the terminal."
```

Every ignore needs a reason. Leave out `--rule` to ignore the whole check, and add `--paths` to select files.
gspot resolves paths and globs passed to `--paths` from your current folder. It saves them relative to the repository
root in `gspot.toml`; `gspot unignore --paths` uses the same conversion.

To leave paths out of every check, see [Exclude files](/configure/files/).

To ignore a dependency advisory, give its ID as the rule:

```shell
gspot ignore dependencies/osv-scanner --rule <advisory-id> --reason "<why>"
```

To remove the ignore:

```shell
gspot unignore javascript/eslint --rule no-console --paths "scripts/**"
```

`gspot check --verbose` prints each ignore in effect and its reason.

To change a limit, see [limits](/reference/gspot-toml/#limits). Use an ignore only when you can state why the check does not fit that code.
