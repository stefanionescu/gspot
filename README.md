# gspot

CLI to lint and enforce rules for LLM generated code bases.

## Requirements

- git
- mise, or an npm-compatible package manager

## Setup

```bash
mise use -g ubi:stefanionescu/gspot
gspot init
```

`init` reads the repository, proposes presets, and writes `gspot.toml`, `.gspot/` and the hooks
after a yes. `gspot check` runs every check; `gspot apply` re-renders the generated files.

## Usage

The commands are `init`, `check`, `apply`, `ignore`, `add`, `remove`, `allow`, `set`,
`declare`, `why`, `explain`, `doctor`, `upgrade` and `uninstall`. Run `gspot explain <anything>`
for what a check, a rule, or a setting means. The design documents live under `architecture/`.
