---
title: Ignore findings
description: Record an ignore with a reason, then inspect or remove it.
tableOfContents: false
---

```shell
gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results to the terminal."
```

Every ignore needs a reason. Leave out `--rule` to ignore the whole check, and add `--paths` to select files.

To leave paths out of every check, see [Exclude files](/configure/files/).

For `structure/trivial-functions` and `python/vulture`, `--names` limits the ignore to the definitions with those
names, such as the hooks that a framework calls by name:

```shell
gspot ignore structure/trivial-functions --names define_schema execute --reason "ComfyUI calls these node hooks."
```

Add `--until YYYY-MM-DD` for an ignore that ends at 00:00 UTC on that date. After that date, the record stays in
`gspot.toml` for review.

To ignore a dependency advisory, give its ID as the rule:

```shell
gspot ignore dependencies/osv-scanner --rule <advisory ID> --reason "..."
```

To remove the ignore:

```shell
gspot unignore javascript/eslint --rule no-console --paths "scripts/**"
```

`gspot check --verbose` prints each ignore in effect and its reason.

To change a limit, see [limits](/reference/gspot-toml/#limits). Use an ignore only when you can state why the check does not fit that code.
