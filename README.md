# ![gspot](docs/public/brand/readme/banner/light.svg#gh-light-mode-only)![gspot](docs/public/brand/readme/banner/dark.svg#gh-dark-mode-only)

[![npm: unreleased](docs/public/brand/badges/npm.svg)](#install)
[![Documentation source](docs/public/brand/badges/docs.svg)](docs/src/content/docs/guides/overview.md)
[![License: Apache-2.0](docs/public/brand/badges/license.svg)](LICENSE.md)

gspot sets up linters and checks for the languages in your repository. Git hooks and CI run those checks. It also installs instructions for coding agents.

## Status

gspot is not published on npm yet.

## Requirements

You need Git. gspot requires Node.js 24.2 or newer, or Bun 1.4.2 or newer, under every runner, including mise.

Requirements follow applicable checks. Python tools need uv. npm tools need their package manager and runtime. Native tools need mise or the pinned executables on `PATH`. Shared files count: a Python project with Markdown can need npm-based Markdown checks. `gspot doctor` prints missing tools and acquisition commands.

## Install

After publication, choose by repository:

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

Commit the install first because initialization requires a clean working tree. For other package managers, use their exact install command and commit their lockfile.

Without `package.json`, use `mise exec npm:@gspothq/cli@0.1.0 -- gspot init` and choose mise. The generated mise file pins the CLI and applicable native tools. Without mise, install `npm install --global @gspothq/cli@0.1.0` and run `gspot init`. A global installation supplies one CLI version per machine; each repository pins its version in `.gspot/version`.

Read the initialization plan before accepting it. `--no-install` writes setup without resolving tool lockfiles; run `gspot install` later. Guides use `gspot` as shorthand for the prefix in the table.

## What it catches

An agent adds `src/utils.ts` to a TypeScript project at level `all`. The file only forwards to `calculateTotal`, and a new `src/receipt.ts` imports it.

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
root  javascript/eslint                   failed     2 files     1.0s
  src/utils.ts:1:1  gspot/no-trivial-files  This file has only forwarding code, aliases, or small functions. Move that code to the module that uses it and delete this file.
  src/utils.ts:8:31  @typescript-eslint/explicit-module-boundary-types  Argument 'order' should be typed with a non-any type.
  src/utils.ts:8:38  @typescript-eslint/no-explicit-any  Unexpected any. Specify a different type.
  src/utils.ts:9:27  @typescript-eslint/no-unsafe-argument  Unsafe argument of type `any` assigned to a parameter of type `Order`.
    help: Run gspot check --fix for the rules that fix themselves, then read each remaining line; gspot explain <rule> links the rule documentation.
  reproduce: gspot check --only javascript/eslint --staged
root  naming/paths                        failed     2 files     0.0s
  src/utils.ts:1:1  banned-term  typescript file "utils": "utils" is banned (roles group).
    help: Rename the file or folder, or add a path rule under [[naming.paths]] with a reason.
  reproduce: gspot check --only naming/paths --staged

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
