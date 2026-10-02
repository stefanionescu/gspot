---
title: Quickstart
description: Set up gspot in a small TypeScript project, and see it reject an agent's commit.
---

In this example, a coding agent adds a helper that only forwards to another function. The
commit hook rejects the commit, and the fixed commit passes. You need Git and Node.js 22 or
newer.

## Create the project

1. Create a folder with a Git repository:

    ```bash
    mkdir orders && cd orders
    git init
    ```

2. Add these files:

    ```json title="package.json"
    {
        "name": "orders",
        "private": true,
        "type": "module",
        "exports": {
            "./*": "./src/*.ts"
        },
        "packageManager": "npm@11.19.0"
    }
    ```

    ```json title="tsconfig.json"
    {
        "compilerOptions": {
            "strict": true,
            "noUncheckedIndexedAccess": true,
            "exactOptionalPropertyTypes": true,
            "noImplicitOverride": true,
            "noFallthroughCasesInSwitch": true,
            "module": "nodenext",
            "target": "es2022",
            "noEmit": true
        },
        "include": ["src"]
    }
    ```

    ```markdown title="README.md"
    # Orders

    Order totals and discounts for the shop.

    ## Setup

    Run `npm install`, then `npx gspot install`.
    ```

    ```text title="LICENSE"
    Copyright 2026 The Orders authors. All rights reserved.
    ```

    ```text title=".gitignore"
    node_modules/
    ```

    ```typescript title="src/orders.ts"
    export type Order = { items: { price: number; quantity: number }[] };

    /**
     * The total price of an order.
     * @param order the order
     * @returns the sum of price times quantity over its items
     */
    export function calculateTotal(order: Order): number {
        let total = 0;
        for (const item of order.items) total += item.price * item.quantity;
        return total;
    }
    ```

    ```typescript title="src/discounts.ts"
    import type { Order } from './orders.js';

    /**
     * The order with every price lowered by a rate.
     * @param order the order
     * @param rate the share taken off each price, from 0 to 1
     * @returns the discounted order
     */
    export function applyDiscount(order: Order, rate: number): Order {
        const factor = 1 - rate;
        const items = order.items.map((item) => ({ ...item, price: item.price * factor }));
        return { items };
    }
    ```

3. Commit them:

    ```bash
    git add -A
    git commit -m "feat: Add order totals and discounts"
    ```

## Set up gspot

1. Install gspot and commit the change:

    ```bash
    npm install --save-dev --save-exact @gspothq/cli
    git add -A
    git commit -m "build: Add gspot"
    ```

2. Run `init`, and set the level to `all`:

    ```bash
    npx gspot init --yes
    npx gspot set level all
    ```

    `init` detects TypeScript, Markdown, and npm, writes `gspot.toml` and the configuration
    under `.gspot/`, installs the tools, and installs the Git hooks. The level `all` adds the
    house style, which includes the checks for trivial functions and files.

3. Commit the setup. The pre-commit hook checks it and lets it through:

    ```bash
    git add -A
    git commit -m "chore: Set up gspot"
    ```

## Commit what an agent wrote

1. Add the two files an agent wrote: a helper in `src/utils.ts`, and receipt lines that call it.

    ```typescript title="src/utils.ts"
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

    ```typescript title="src/receipt.ts"
    import type { Order } from './orders.js';
    import { getOrderTotal } from './utils.js';

    /**
     * The receipt lines of an order: one line per item, then the total.
     * @param order the order
     * @returns the lines
     */
    export function receiptLines(order: Order): string[] {
        const lines = order.items.map((item) => `${String(item.quantity)} x ${String(item.price)}`);
        lines.push(`Total: ${String(getOrderTotal(order))}`);
        return lines;
    }
    ```

2. Commit them:

    ```bash
    git add -A
    git commit -m "feat: Add receipt lines"
    ```

    The hook rejects the commit:

    ```text
    root  javascript/eslint                   fail       2 files     1.0s
      src/utils.ts:1:1  gspot/no-trivial-files  This file contains only forwarding, aliases, re-exports, or trivial functions. Move them to their owner.
      src/utils.ts:8:8  gspot/no-trivial-functions  This function has 1 statement. Functions with 2 or fewer are reported. Inline it into its callers, or explain the API it serves in a narrow suppression.
      src/utils.ts:8:31  @typescript-eslint/explicit-module-boundary-types  Argument 'order' should be typed with a non-any type.
      src/utils.ts:8:38  @typescript-eslint/no-explicit-any  Unexpected any. Specify a different type.
      src/utils.ts:9:27  @typescript-eslint/no-unsafe-argument  Unsafe argument of type `any` assigned to a parameter of type `Order`.
        help: Run gspot check --fix for the rules that fix themselves, then read each remaining line; gspot explain <rule> says what it means.
      reproduce: gspot check --only javascript/eslint --staged
    root  naming/paths                        fail       2 files     0.0s
      src/utils.ts:1:1  banned-term  typescript file "utils": "utils" is banned (roles group).
        help: Rename the file or folder, or add a path rule under [[naming.rules]] with a reason.
      reproduce: gspot check --only naming/paths --staged

    23 checks passed, 2 checks failed, 1 check skipped, 6 findings, 2.4s (failed)
    ```

`getOrderTotal` only forwards to `calculateTotal`, its parameter is typed `any`, and
`utils` names no role. The checks agree: the helper has no reason to exist.

## Fix the commit

1. Delete the helper, and call `calculateTotal` directly:

    ```bash
    git rm --cached src/utils.ts
    rm src/utils.ts
    ```

    ```typescript title="src/receipt.ts"
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

2. Commit again:

    ```bash
    git add -A
    git commit -m "feat: Add receipt lines"
    ```

    The hook passes:

    ```text
    25 checks passed, 0 checks failed, 1 check skipped, 0 findings, 2.4s
    ```

## Next steps

- [Fix findings](/guides/findings/): read a finding and run one check alone.
- [The policy file](/guides/customize/): change the level, limits, and exceptions.
- [Coding agents](/guides/agents/): the guides that `init` linked from `AGENTS.md`.
