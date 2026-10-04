# gspot

gspot sets up linters and checks for the languages in your repository. Git hooks and CI run those checks. It also installs instructions for coding agents.

## Status

gspot is not published on npm yet. To run it from source, see [Contributing](https://github.com/stefanionescu/gspot/blob/main/CONTRIBUTING.md).

## Requirements

You need Git. The npm CLI requires Node.js 24.2 or newer, or Bun. Standalone archives include the runtime for gspot; applicable tools still require their own runtimes.

Requirements follow applicable checks. Python tools need uv. npm tools need their package manager and runtime. Native tools need mise or the pinned executables on `PATH`. Shared files count: a Python project with Markdown can need npm-based Markdown checks. `gspot doctor` prints missing tools and acquisition commands.

## Install

After publication, choose by repository:

| Repository                                   | Install                                                        | Run commands with                                             |
| -------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| Has `package.json`                           | Exact CLI development dependency using npm, pnpm, Yarn, or Bun | `npx gspot`, `pnpm exec gspot`, `yarn gspot`, or `bunx gspot` |
| Python, Swift, or another project using mise | Download the standalone CLI through mise                       | `mise exec -- gspot`                                          |
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

Without `package.json`, use `mise exec github:stefanionescu/gspot@0.1.0 -- gspot init` and choose mise. The generated mise file pins the CLI and applicable native tools. Without mise, install `npm install --global @gspothq/cli@0.1.0` and run `gspot init`. A global installation supplies one CLI version per machine; each repository pins its version in `.gspot/version`.

Read the initialization plan before accepting it. `--no-install` writes setup without resolving tool locks; run `gspot install` later. Guides use `gspot` as shorthand for the prefix in the table.

## Documentation

The [documentation source](https://github.com/stefanionescu/gspot/tree/main/docs/src/content/docs) covers policy, hooks, CI, and checks. See [Contributing](https://github.com/stefanionescu/gspot/blob/main/CONTRIBUTING.md) to run the current checkout.

## License

Apache-2.0
