---
title: Install gspot
description: Run the prerelease CLI from a contributor checkout.
sidebar:
    order: 1
---

gspot is prerelease. Public npm packages and release binaries are not available yet.
Use Git and mise 2026.8.8 or later for contributor work:

```bash
git clone https://github.com/stefanionescu/gspot.git
cd gspot
mise run repo:setup
bun packages/cli/src/main.ts --help
```

Run the source entry point with Bun from the repository you want to check. Candidate package
validation uses an isolated local registry. A cross-compiled binary does not establish that
its target platform has passed acceptance.

## What the repository pins

`gspot init` writes `.gspot/version` and, when mise runs the repository, a pin in
`.mise/conf.d/gspot-tools.toml`. This integration requires mise 2026.8.8 or newer. Everyone on the repository runs that version; another version
refuses `check` and says how to install the pinned one or move the pin with
`gspot upgrade --to`.

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
can display an unknown-publisher warning. Native execution is required to validate each target;
cross-compilation alone does not establish platform support. Windows lifecycle mutations
currently refuse because their secure filesystem boundary is not implemented. Local development
evidence is from macOS arm64; the final native platform acceptance remains open.
