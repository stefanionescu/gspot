---
title: Use the ESLint plugin
description: Install and configure the published plugin without the gspot CLI.
---

The ESLint plugin checks code that AI coding agents often write. It finds files and functions that only
forward a call, exports that only rename a value, and imports through index files. It also finds comments
mixed into import blocks and private environment variables read in client code.

The [gspot CLI](https://www.npmjs.com/package/@gspothq/cli) sets this plugin up for you. Install it yourself
only when you run ESLint without gspot.

**Documentation:** [rule reference](https://generativespotting.com/reference/eslint-plugin/)

## Requirements

- Node.js 22.12 or newer.
- ESLint 9.38.0 or newer, with a flat configuration file such as `eslint.config.mjs`. ESLint 10 works too.
- For TypeScript files: TypeScript 4.8.4 or newer and older than 6.1.0, and `@typescript-eslint/parser`.

## Install

Install the plugin and ESLint as development dependencies:

| Package manager | Command                                                |
| --------------- | ------------------------------------------------------ |
| npm             | `npm install --save-dev @gspothq/eslint-plugin eslint` |
| pnpm            | `pnpm add --save-dev @gspothq/eslint-plugin eslint`    |
| Yarn            | `yarn add --dev @gspothq/eslint-plugin eslint`         |
| Bun             | `bun add --dev @gspothq/eslint-plugin eslint`          |

## Use the recommended rules

Add the `recommended` configuration to `eslint.config.mjs`:

```javascript
import gspot from '@gspothq/eslint-plugin';

export default [gspot.configs.recommended];
```

`recommended` turns on one rule, `gspot/no-client-env`, as an error. This client module, `search.js`, reads a
private environment variable:

```javascript
"use client";
export const endpoint = process.env.PRIVATE_API_URL;
```

Run ESLint:

```shell
npx eslint search.js
```

ESLint exits with `1` and reports the finding. ESLint prints the full path of each file; the examples here
shorten it.

```text
search.js
  2:25  error  A client module may read only public environment variables (NEXT_PUBLIC_*, NODE_ENV). Keep private configuration in a server-only module  gspot/no-client-env
```

Keep the private read on the server, and let `search.js` call a route of your server:

```javascript
"use client";
export const endpoint = "/api/search";
```

ESLint now reports nothing. Your server must still answer `/api/search`.

## Use all rules

`gspot.configs.all` turns on every rule except `gspot/require-server-only`:

```javascript
import gspot from '@gspothq/eslint-plugin';

export default [gspot.configs.all];
```

The `all` configuration reports four findings in these two modules. The orders module contains this code:

```javascript title="src/orders.js"
import { calculateTotal } from './prices.js';
// Order totals for the receipt page.
import { formatPrice } from './format.js';

function getItems(order) {
    return order.items;
}

export function orderTotal(order) {
    const subtotal = calculateTotal(getItems(order));
    const total = subtotal + order.shipping;
    return formatPrice(total);
}

export const getOrderTotal = orderTotal;
```

The formatting module contains this export:

```javascript title="src/format.js"
export { formatPrice } from './money.js';
```

ESLint exits with `1`:

```text
src/format.js
  1:1  error  This file has only forwarding code, aliases, or small functions. Move that code to the module that uses it and delete this file  gspot/no-trivial-files

src/orders.js
   2:1   error  Put the comment above the imports or beside the code it explains                             gspot/no-comments-in-imports
   5:1   error  This function has 1 statement. Inline it into its callers and delete it                      gspot/no-trivial-functions
  15:14  error  getOrderTotal only renames orderTotal. Export the source value directly instead of an alias  gspot/no-alias-exports
```

To fix them, import `formatPrice` from the money module and delete the formatting module, move the comment above the
first import, use `order.items` in place of `getItems(order)` and delete `getItems`, and delete `getOrderTotal`.
`eslint --fix` moves the comment for you. ESLint then reports nothing.

## Check TypeScript

The plugin brings no TypeScript parser. Install the parser and TypeScript:

```shell
npm install --save-dev @typescript-eslint/parser typescript
```

Then select your TypeScript files:

```javascript
import gspot from '@gspothq/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
    {
        ...gspot.configs.all,
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsParser,
            parserOptions: { projectService: true },
        },
    },
];
```

`projectService` reads your `tsconfig.json`. `no-trivial-functions` needs that type information to leave
alone a method that an interface or a base class declares.

## Rules

<dl>

<dt>

`gspot/no-client-env`

</dt>
<dd>

Level `recommended`. Private environment reads in client modules.

</dd>

<dt>

`gspot/no-comments-in-imports`

</dt>
<dd>

Level `all`. Comments inside or right after the import block.

</dd>

<dt>

`gspot/import-boundaries`

</dt>
<dd>

Level `all`. Relative imports that leave the nearest boundary folder.

</dd>

<dt>

`gspot/no-alias-exports`

</dt>
<dd>

Level `all`. Exported constants that only rename another value.

</dd>

<dt>

`gspot/no-index-imports`

</dt>
<dd>

Level `all`. Imports that name an index file instead of the module that declares the value.

</dd>

<dt>

`gspot/no-trivial-files`

</dt>
<dd>

Level `all`. Files with only forwarding code, aliases, re-exports, or small functions.

</dd>

<dt>

`gspot/no-trivial-functions`

</dt>
<dd>

Level `all`. Named functions of two statements or fewer that have no exports and that code uses in at most one place.

</dd>

<dt>

`gspot/require-server-only`

</dt>
<dd>

No configuration; turn it on yourself. Selected server modules that do not import `server-only` or declare `use server`.

</dd>

</dl>

Each rule's page in the [rule reference](https://generativespotting.com/reference/eslint-plugin/) lists its
options, defaults, and examples.

### Turn on require-server-only

No configuration turns on `gspot/require-server-only`, because only you know which files contain server code.
Select them with `files`:

```javascript
import gspot from '@gspothq/eslint-plugin';

export default [
    {
        files: ['src/server/**/*.js'],
        plugins: { gspot },
        rules: { 'gspot/require-server-only': 'error' },
    },
];
```

A selected file passes when it imports `server-only` or declares `"use server"`.

### Set the root for import-boundaries

`gspot/import-boundaries` reads boundary folders relative to the repository root. It uses the working folder
of ESLint, unless you set the root:

```javascript
import gspot from '@gspothq/eslint-plugin';

export default [
    gspot.configs.all,
    { settings: { gspot: { root: import.meta.dirname } } },
];
```
