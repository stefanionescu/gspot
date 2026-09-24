# gspot

gspot configures linters, runs checks, and generates instructions for coding agents from one configuration file.

**Unreleased:** use the [source installation](https://github.com/stefanionescu/gspot/blob/main/docs/src/content/docs/guides/install.md).
Local builds and package tests do not establish a published release.

This package launches the gspot binary selected for your operating system, architecture, and
Linux C library. It requires Node.js 18 or newer and Git on `PATH`.

The executable arrives as an optional dependency. Keep optional dependencies enabled.
Installation works with lifecycle scripts disabled.

From the repository root, preview the proposed file and hook changes before accepting:

```shell
gspot init
gspot check
```

`init` proposes and applies repository configuration. It runs no checks. `check` runs the
selected policy, using `recommended` by default. A teammate who clones a configured repository
runs `gspot install` to install its pinned private tools.

The platform package includes `LICENSE.md` and `NOTICE.md`. Read the
[manual source](https://github.com/stefanionescu/gspot/tree/main/docs/src/content/docs/guides)
for setup, scopes, and finding corrections.

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md).
