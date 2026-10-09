---
title: "Quickstart: TypeScript"
description: Set up gspot in a small TypeScript project, and see it reject an agent's commit.
---

In this example, a coding agent adds a helper that only forwards to another function. The
commit hook rejects the forwarding helper. Read [Requirements](/guides/requirements/) first.

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
        "description": "Order totals and discounts for the shop.",
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
            "noEmit": true,
            "noImplicitReturns": true,
            "noPropertyAccessFromIndexSignature": true
        },
        "include": [
            "src"
        ]
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

1. Install gspot and commit the change. `init` requires a clean working tree, so commit the dependency and lockfile first:

    ```bash
    npm install --save-dev --save-exact @gspothq/cli
    git add -A
    git commit -m "build: Add gspot"
    ```

2. Run `init`, and set the level to `all`:

    ```bash
    npx gspot init --yes
    npx gspot set level all
    npx gspot install
    npx gspot doctor
    ```

    `init` detects TypeScript, Markdown, and npm, writes `gspot.toml` and the configuration
    under `.gspot/`, installs the tools, and installs the Git hooks. The level `all` adds the
    level `all` conventions, including the checks for trivial functions and files.

3. Run `npx gspot check` and resolve any findings before committing the setup. Choose your [dependency license policy](/guides/dependency-licenses/) explicitly. `licenses/allowed` remains skipped until an allowed license or exception is set:

    ```bash
    git add -A
    git commit -m "chore: Set up gspot"
    ```

## Commit what an agent wrote

1. Add the two files an agent wrote: a forwarding module and receipt lines that call it.

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

    The hook rejects the commit. This excerpt highlights the findings. Timings and check counts depend on the repository:

    ```text
    root  javascript/eslint                   failed     2 files     1.0s
      src/utils.ts:1:1  gspot/no-trivial-files  This file has only forwarding code, aliases, or small functions. Move that code to the module that uses it and delete this file.
      src/utils.ts:8:31  @typescript-eslint/explicit-module-boundary-types  Argument 'order' should be typed with a non-any type.
      src/utils.ts:8:38  @typescript-eslint/no-explicit-any  Unexpected any. Specify a different type.
      src/utils.ts:9:27  @typescript-eslint/no-unsafe-argument  Unsafe argument of type `any` assigned to a parameter of type `Order`.
        help: Run gspot check --fix for the rules that fix themselves, then read each remaining line; gspot explain <rule> links the rule documentation.
      reproduce: gspot check --only javascript/eslint --staged
    root  naming/paths                        failed     2 files     0.0s
      src/utils.ts:1:1  banned-term  typescript file "utils": "utils" is banned (roles group).
        help: Rename the file or folder, or add a path rule under [[naming.overrides]] with a reason.
      reproduce: gspot check --only naming/paths --staged

    ```

`getOrderTotal` only forwards to `calculateTotal`, its parameter is typed `any`, and
`utils` is a catch-all name that gspot bans. The checks agree: the helper has no reason to exist.

## Fix the commit

1. Delete the helper, and call `calculateTotal` directly:

    ```bash title="Delete the forwarding module"
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

    The forwarding-helper findings are gone. The report lists any remaining findings and names each skipped check with its cause. A skipped check has no applicable input or unmet optional condition and does not count as passed.

## Continue

- [Fix findings](/guides/findings/): read a finding and run one check alone.
- [`gspot.toml`](/guides/policy/): change the level, limits, and exceptions.
- [Coding agents](/guides/agents/): the rules that `init` linked from `AGENTS.md`.
