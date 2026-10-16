---
title: Ignore a finding
description: Record an ignore with a reason, then inspect or remove it.
---

```shell
gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results to the terminal."
```

Every ignore needs a reason. Leave out `--rule` to ignore the whole check.
Add `--paths` to select files. Add `--until YYYY-MM-DD` for an ignore that ends at 00:00 UTC on that date.
The saved record remains for review. To ignore a dependency advisory, use
`gspot ignore dependencies/osv-scanner --rule <advisory ID> --reason "..."` with the advisory's ID and your reason.

To remove the ignore:

```shell
gspot unignore javascript/eslint --rule no-console --paths "scripts/**"
```

`gspot check --verbose` prints each applied ignore, its reason, and the number of findings it matched.

To change a limit, see [limits](/reference/gspot-toml/limits/). Use an ignore only when you can state why a check does not apply.
