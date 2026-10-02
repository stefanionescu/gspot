# ![gspot](docs/public/brand/readme/banner/light.svg#gh-light-mode-only)![gspot](docs/public/brand/readme/banner/dark.svg#gh-dark-mode-only)

[![npm: unreleased](docs/public/brand/badges/npm.svg)](docs/src/content/docs/guides/install.md)
[![Documentation source](docs/public/brand/badges/docs.svg)](docs/README.md)
[![License: Apache-2.0](docs/public/brand/badges/license.svg)](LICENSE.md)

gspot is a command-line tool that lints AI-generated code and installs rules for AI coding agents.

## Install

gspot runs on Node.js 22 or newer, or on Bun. In a JavaScript or TypeScript repository:

```shell
npm install --save-dev --save-exact @gspothq/cli
npx gspot init
```

Install it once with `npm install --global @gspothq/cli`, then run `gspot init` in a target repository.

`init` reads the repository and shows a plan before it writes anything:

- the checks for your languages and frameworks
- the linter configuration it writes under `.gspot/`
- the guides for coding agents, linked from `AGENTS.md`
- the Git hooks that run the checks

Accept the plan, and gspot writes the files and installs the tools.

## What it catches

An agent adds this file to a TypeScript project that runs gspot at level `all`, and calls it
from a new `src/receipt.ts`:

```typescript
import { calculateTotal } from './orders.js';

/**
 * The total of an order.
 * @param order the order
 * @returns the total
 */
export function getOrderTotal(order: any): number {
    return calculateTotal(order);
}
```

The commit hook runs `gspot check --staged` and rejects the commit:

```text
root  typescript/eslint                   fail       2 files     1.0s
  src/utils.ts:1:1  gspot/no-trivial-files  This file contains only forwarding, aliases, re-exports, or trivial functions. Move them to their owner.
  src/utils.ts:8:8  gspot/no-trivial-functions  This function has 1 statement. Functions with 2 or fewer are reported. Inline it into its callers, or explain the API it serves in a narrow suppression.
  src/utils.ts:8:31  @typescript-eslint/explicit-module-boundary-types  Argument 'order' should be typed with a non-any type.
  src/utils.ts:8:38  @typescript-eslint/no-explicit-any  Unexpected any. Specify a different type.
  src/utils.ts:9:27  @typescript-eslint/no-unsafe-argument  Unsafe argument of type `any` assigned to a parameter of type `Order`.
    help: Run gspot check --fix for the rules that fix themselves, then read each remaining line; gspot explain <rule> says what it means.
  reproduce: gspot check --only typescript/eslint --staged
root  naming/paths                        fail       2 files     0.0s
  src/utils.ts:1:1  banned-term  typescript file "utils": "utils" is banned (roles group).
    help: Rename the file or folder, or add a path rule under [[naming.rules]] with a reason.
  reproduce: gspot check --only naming/paths --staged

23 checks passed, 2 checks failed, 1 check skipped, 6 findings, 2.4s (failed)
```

Each finding names the file, the line, the rule, and what to do. The agent deletes
`src/utils.ts` and calls `calculateTotal` directly:

```typescript
import { type Order, calculateTotal } from './orders.js';

/**
 * The receipt lines of an order: one line per item, then the total.
 * @param order the order
 * @returns the lines
 */
export function receiptLines(order: Order): string[] {
    const lines = order.items.map((item) => `${String(item.quantity)} x ${String(item.price)}`);
    lines.push(`Total: ${String(calculateTotal(order))}`);
    return lines;
}
```

The next commit passes:

```text
25 checks passed, 0 checks failed, 1 check skipped, 0 findings, 2.4s
```

The [quickstart](docs/src/content/docs/guides/quick-start.md) runs this example from an empty
folder.

## Documentation

- [Quickstart](docs/src/content/docs/guides/quick-start.md): run the example above.
- [Install](docs/src/content/docs/guides/install.md): npm, Bun, and global installs.
- [The policy file](docs/src/content/docs/guides/customize.md): choose checks, change limits,
  and record exceptions.
- [Coding agents](docs/src/content/docs/guides/agents.md): the guides gspot installs.
- [Hooks and CI](docs/src/content/docs/guides/check-automation.md): when the checks run.
- [Existing repositories](docs/src/content/docs/guides/existing-repository.md): what init
  replaces and where the originals stay.
- [Troubleshooting](docs/src/content/docs/guides/troubleshooting.md).
- [Kit reference](https://gspot.dev/reference/kits/): supported languages, frameworks, and tools.
- [ESLint plugin](packages/eslint-plugin/README.md): the gspot ESLint rules on their own.
- [Contributing](CONTRIBUTING.md), for contributors.

## License

[Apache-2.0](LICENSE.md)
