# ![gspot](docs/public/brand/readme/banner/light.svg#gh-light-mode-only)![gspot](docs/public/brand/readme/banner/dark.svg#gh-dark-mode-only)

[![npm: unreleased](docs/public/brand/badges/npm.svg)](docs/src/content/docs/guides/install.md)
[![Documentation source](docs/public/brand/badges/docs.svg)](docs/README.md)
[![License: Apache-2.0](docs/public/brand/badges/license.svg)](LICENSE.md)

gspot configures the linters a repository needs, runs them, and installs instructions for
coding agents, all from one policy file, `gspot.toml`.

## Install

gspot is unreleased: complete the [source installation](docs/src/content/docs/guides/install.md),
then run it in the repository you want to configure.

```shell
gspot init --dry-run
gspot init
gspot check
```

`init` proposes a policy from what the repository holds and installs the tools after a yes.
`check` runs the selected checks and prints each finding with the command that reproduces it.

## One example

A client module reads private configuration:

```javascript
"use client";
export const endpoint = process.env.PRIVATE_API_URL;
```

`gspot check` reports the read through the `gspot/no-client-environment` rule, at line 2. Keep
the private work on the server and let the client name a public route:

```javascript
"use client";
export const endpoint = "/api/search";
```

The corrected module produces no finding. The
[executable example](docs/src/content/docs/guides/client-environment.md) has the setup, the
captured diagnostic, and the verification.

## Read on

- [Your first check](docs/src/content/docs/guides/quick-start.md), a disposable walkthrough.
- [Customize the policy](docs/src/content/docs/guides/customize.md).
  [Scopes](docs/src/content/docs/guides/scopes.md) cover nested projects, and
  [profiles](docs/src/content/docs/guides/profiles.md) share a policy.
- [Generated files](docs/src/content/docs/guides/generated-files.md): what to commit, and
  how to get an original back.
- [CI](docs/src/content/docs/guides/check-automation.md), [troubleshooting](docs/src/content/docs/guides/troubleshooting.md),
  and [uninstall](docs/src/content/docs/guides/uninstall.md).
- [Kit reference](https://gspot.dev/reference/kits/) for the supported technologies, and the
  [standalone ESLint plugin](packages/eslint-plugin/README.md).
- [Build and test](docs/src/content/docs/guides/build.md) and the
  [documentation conventions](docs/README.md) for contributors.

[Apache-2.0](LICENSE.md).
