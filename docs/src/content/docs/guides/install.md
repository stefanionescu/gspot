---
title: Install gspot
description: Install dependencies and run gspot from source.
sidebar:
    order: 1
---

Use Git and mise 2026.8.8 or later to run gspot from a source checkout:

```bash
git clone https://github.com/stefanionescu/gspot.git
cd gspot
mise install bun node
mise run repo:setup
bun packages/cli/src/main.ts --help
```

While still in the checkout, define a command for your current shell:

```bash
gspot_source="$PWD/packages/cli/src/main.ts"
gspot() { bun "$gspot_source" "$@"; }
```

Change to the repository you want to check. The function keeps using the source entry point.
For a new setup, follow [your first check](/guides/quick-start/) or
[adopt an existing repository](/guides/existing-repository/).

## Match the repository version

`gspot init` writes `.gspot/version` and, when mise runs the repository, a pin in
`.mise/conf.d/gspot-tools.toml`. This integration requires mise 2026.8.8 or newer. Everyone on the repository runs that version; another version
refuses `check` and says how to install the pinned one or move the pin with
`gspot apply`. Preview generated changes with `gspot apply --dry-run`, apply them, then run `gspot install`.

## Native binaries and npm packages

Local builds produce macOS binaries for arm64 and x64, Linux binaries for both architectures
with glibc or musl, and a Windows x64 binary. The npm launcher selects the matching operating
system, architecture, and Linux C library. It requires Node.js 18 or newer. Keep optional
dependencies enabled: they contain the executable. Installation needs no lifecycle scripts.

Git must be on `PATH`. A configured repository also needs its selected tools. `gspot install`
installs the locked private npm and Python projects under `.gspot/`; mise manages native tools
when selected. See [using gspot without mise](/guides/without-mise/) for native tool provisioning.

Every binary distribution includes `LICENSE.md`, `NOTICE.md`, and checksums. npm packages
include the same license and notice files. The [build guide](/guides/build/) describes local
candidate preparation and grammar provenance.

macOS builds are signed ad hoc. They are not Developer ID signed or notarized. A browser
download can receive a quarantine attribute and be blocked by Gatekeeper. After verifying
the binary against its release checksum, remove that attribute from the verified file:

```shell
xattr -d com.apple.quarantine ./gspot-darwin-arm64
```

Use the filename for your architecture. Windows builds are not Authenticode signed; Windows
can display an unknown-publisher warning. Windows installation and hook behavior have not been verified natively.

## Join a configured repository

Prepare the CLI version recorded in `.gspot/version`, then run from the configured repository:

```bash
gspot install
gspot check
```

Install consumes matching tool locks and sets up selected hooks. If policy and locks disagree,
the policy owner must run `gspot apply` and share the resulting changes. Installation does not
regenerate policy or add a `prepare` lifecycle script. Working-tree and staged checks warn when
hooks are missing or edited; that warning does not change the check result.
