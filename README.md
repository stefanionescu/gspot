# ![gspot](docs/assets/readme/banner/light.svg#gh-light-mode-only)![gspot](docs/assets/readme/banner/dark.svg#gh-dark-mode-only)

[![npm: unreleased](docs/assets/readme/badges/npm.svg)](#install)
[![Documentation source](docs/assets/readme/badges/docs.svg)](docs/src/content/docs/guides/overview.md)
[![License: Apache-2.0](docs/assets/readme/badges/license.svg)](LICENSE.md)

gspot sets up linters and checks for the languages in your repository. Git hooks and CI run those checks. It also installs instructions for coding agents.

## Status

gspot is not published on npm yet.

## Requirements

Read [Requirements](docs/src/content/docs/guides/requirements.md) for the runtimes and tools each check needs.

## Install

Choose by repository:

| Repository                                   | Install                                                        | Run commands with                                             |
| -------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| Has `package.json`                           | Exact CLI development dependency using npm, pnpm, Yarn, or Bun | `npx gspot`, `pnpm exec gspot`, `yarn gspot`, or `bunx gspot` |
| Python, Swift, or another project using mise | Install the npm CLI through mise                               | `mise exec -- gspot`                                          |
| Uses neither a package manager nor mise      | Exact global npm install                                       | `gspot` on `PATH`                                             |

For npm:

```shell
npm install --save-dev --save-exact @gspothq/cli
git add package.json package-lock.json
git commit -m "build: Add gspot"
npx gspot init
npx gspot doctor
```

Follow [Install gspot](docs/src/content/docs/guides/install.md) for other package managers, mise, global installation, and setup verification.

## What it catches

An agent adds this forwarding module to a TypeScript project at level `all`. A receipt module imports it.

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

At level `all`, the commit hook rejects the forwarding helper. This is a findings excerpt:

```text
src/utils.ts:1:1  gspot/no-trivial-files  This file has only forwarding code, aliases, or small functions. Move that code to the module that uses it and delete this file.
src/utils.ts:8:31  @typescript-eslint/explicit-module-boundary-types  Argument 'order' should be typed with a non-any type.
src/utils.ts:8:38  @typescript-eslint/no-explicit-any  Unexpected any. Specify a different type.
src/utils.ts:9:27  @typescript-eslint/no-unsafe-argument  Unsafe argument of type `any` assigned to a parameter of type `Order`.
src/utils.ts:1:1  banned-term  typescript file "utils": "utils" is banned (roles group).
```

Each finding names the file, the line, the rule, and what to do. The
[TypeScript quickstart](docs/src/content/docs/guides/quickstart/typescript.md) shows the setup and correction.

## Documentation

- [What gspot does](docs/src/content/docs/guides/overview.md).
- [Requirements and installation](docs/src/content/docs/guides/install.md).
- [TypeScript](docs/src/content/docs/guides/quickstart/typescript.md), [Python](docs/src/content/docs/guides/quickstart/python.md), and [Swift](docs/src/content/docs/guides/quickstart/swift.md) quickstarts.
- [Policy](docs/src/content/docs/guides/policy.md) and [template reuse](docs/src/content/docs/guides/templates.md).
- [Coding agents](docs/src/content/docs/guides/agents.md).

## License

[Apache-2.0](LICENSE.md)
