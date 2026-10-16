---
title: What gspot does
description: See what gspot checks and how it fits your Git work.
---

gspot lints code and writes rules for coding agents. Git hooks run its checks before each commit and push.
A finding stops the commit or push. CI runs the checks again.

For example, an agent writes a checkout module without waiting for a payment:

```typescript title="src/checkout.ts"
import type { Cart } from './cart.js';
import { charge } from './payments.js';

export async function pay(cart: Cart) {
    try {
        // eslint-disable-next-line
        charge(cart.total);
    } catch {}
}
```

The pre-commit hook reports the file, line, lint rule, and message. Times vary:

```text
javascript/eslint  failed  4 findings
  src/checkout.ts:4:8  @typescript-eslint/require-await  Async function 'pay' has no 'await' expression.
  src/checkout.ts:5:5  sonarjs/no-try-promise  Consider using 'await' for the promise inside this 'try' or replace it with 'Promise.prototype.catch(...)' usage.
  src/checkout.ts:6  unicorn/no-abusive-eslint-disable  Specify the rules you want to disable.
  src/checkout.ts:8:13  no-empty  Empty block statement.
  help: Run `gspot check --fix` for the rules that fix themselves, then read each remaining line; `gspot explain <rule>` links the rule documentation.
  run again: gspot check --only javascript/eslint --staged
```

The built-in `gspot/suppressions` check also rejects the limit suppression.
Use `await charge(cart.total);` and remove the suppression and empty `catch`.

## How setup works

1. `gspot init` reads your files and dependencies and shows a plan. When you accept it, gspot writes the settings,
   tool files, rules, and hooks.
2. `gspot install` installs the pinned tools and turns on the hooks.
3. Hooks and CI run `gspot check`. You can run it yourself to check every file.

Continue with the [Quickstart](/start/quickstart/), or read [Concepts](/start/concepts/) for the terms used in the docs.
