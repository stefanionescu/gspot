---
title: Install
description: Build gspot from source and put it on your PATH.
sidebar:
    order: 1
---

gspot is not on npm yet, so you build it from a source checkout. You need Git, a Bash shell,
and [mise](https://mise.jdx.dev) 2026.8.8 or newer.

## Build the binary

1. Clone the repository and install its runtimes:

    ```bash
    git clone https://github.com/stefanionescu/gspot.git
    cd gspot
    mise install
    mise run repo:setup
    ```

2. Build gspot for your system:

    ```bash
    mise run build
    ```

    The build writes one executable to `dist/`. Its name ends with your system, such as
    `dist/gspot-darwin-arm64` on an Apple silicon Mac or `dist/gspot-linux-x64` on a 64-bit
    Linux machine.

3. Copy the executable to a folder on your `PATH`, under the name `gspot`:

    ```bash
    mkdir -p ~/.local/bin
    cp dist/gspot-darwin-arm64 ~/.local/bin/gspot
    ```

4. Check that your shell finds it:

    ```bash
    gspot --version
    ```

    The command prints the version, such as `0.1.0`.

The Git hooks that gspot installs call this executable, so keep it in place after you set up a
repository.

## Set up a repository

From the root of your repository, run:

```bash
gspot init
```

`init` shows a plan and writes it after you accept. The [quickstart](/guides/quick-start/) goes
through a full example.

## Join a configured repository

When a teammate already set up gspot, install the same gspot version and run:

```bash
gspot install
gspot check
```

`install` installs the tools at the versions in the committed locks and sets up the Git hooks.
It changes no tracked file. If the policy and the locks disagree, `install` stops. The person
who changed the policy runs `gspot apply` and commits the result.

## Match the repository version

`gspot init` records the gspot version in `.gspot/version`. When mise runs the repository, it
also pins that version in `.mise/conf.d/gspot-tools.toml`. Every person on the repository runs
that version.

A different version refuses `gspot check` and prints two ways forward: install the pinned
version, or move the pin. To move the pin, preview the change, apply it, and install:

```bash
gspot apply --dry-run
gspot apply
gspot install
```

## Tools gspot runs

Git must be on your `PATH`. gspot installs its npm and Python tools in a private project under
`.gspot/`, so your own dependencies do not change. When mise runs the repository, mise also
installs the native tools, such as ShellCheck. Without mise, see
[package managers](/guides/without-mise/).

## Builds for other systems

`mise run build -- --all` builds every supported system:

| System  | Architectures | Executable                                       |
| ------- | ------------- | ------------------------------------------------ |
| macOS   | arm64, x64    | `gspot-darwin-arm64`, `gspot-darwin-x64`         |
| Linux   | arm64, x64    | `gspot-linux-arm64`, `gspot-linux-x64`           |
| Linux   | musl          | `gspot-linux-arm64-musl`, `gspot-linux-x64-musl` |
| Windows | x64           | `gspot-windows-x64.exe`                          |

Every build includes `LICENSE.md`, `NOTICE.md`, and checksums. The [build guide](/guides/build/)
covers release builds.

The macOS builds carry an ad hoc signature. They are not notarized, so Gatekeeper can block a
downloaded copy. After you compare the file with its release checksum, remove the quarantine
attribute:

```shell
xattr -d com.apple.quarantine ./gspot-darwin-arm64
```

The Windows build is not Authenticode signed, so Windows can show an unknown-publisher warning.
