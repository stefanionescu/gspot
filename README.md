# ![gspot](docs/public/brand/readme/banner/light.svg#gh-light-mode-only)![gspot](docs/public/brand/readme/banner/dark.svg#gh-dark-mode-only)

[![npm: unreleased](docs/public/brand/badges/npm.svg)](https://gspot.dev/guides/install/)
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
- the rules for coding agents, linked from `AGENTS.md`
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
root  javascript/eslint                   failed     2 files     1.0s
  src/utils.ts:1:1  gspot/no-trivial-files  This file contains only forwarding, aliases, re-exports, or trivial functions. Move them to their owner.
  src/utils.ts:8:8  gspot/no-trivial-functions  This function has 1 statement. Functions with 2 or fewer are reported. Inline it into its callers, or explain the API it serves in a narrow suppression.
  src/utils.ts:8:31  @typescript-eslint/explicit-module-boundary-types  Argument 'order' should be typed with a non-any type.
  src/utils.ts:8:38  @typescript-eslint/no-explicit-any  Unexpected any. Specify a different type.
  src/utils.ts:9:27  @typescript-eslint/no-unsafe-argument  Unsafe argument of type `any` assigned to a parameter of type `Order`.
    help: Run gspot check --fix for the rules that fix themselves, then read each remaining line; gspot explain <rule> says what it means.
  reproduce: gspot check --only javascript/eslint --staged
root  naming/paths                        failed     2 files     0.0s
  src/utils.ts:1:1  banned-term  typescript file "utils": "utils" is banned (roles group).
    help: Rename the file or folder, or add a path rule under [[naming.rules]] with a reason.
  reproduce: gspot check --only naming/paths --staged

23 checks passed, 2 checks failed, 1 check skipped, 6 findings, 2.4s (failed)
```

Each finding names the file, the line, the rule, and what to do. The
[quickstart](https://gspot.dev/guides/quick-start/) runs this example from an empty folder
to the commit that passes.

## Documentation

- [Quickstart](https://gspot.dev/guides/quick-start/): run the example above.
- [The policy file](https://gspot.dev/guides/customize/): choose kits, change limits, and record
  exceptions.
- [Coding agents](https://gspot.dev/guides/agents/): the rules gspot installs.
- [Kits](https://gspot.dev/reference/kits/): the languages, frameworks, and tools gspot covers.
- [Contributing](CONTRIBUTING.md): work on gspot itself.

## License

[Apache-2.0](LICENSE.md)
