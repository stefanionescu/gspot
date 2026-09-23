# gspot

CLI to lint and enforce rules for LLM generated codebases.

Choose presets for your tools, keep policy in `gspot.toml`, and generate their configuration
with `gspot apply`. Coding agents receive the selected rule guides through `AGENTS.md`.

[Get started](docs/src/content/docs/guides/install.md) ·
[First check](docs/src/content/docs/guides/quick-start.md) ·
[Existing repositories](docs/src/content/docs/guides/existing-repository.md) ·
[Build and contribute](docs/src/content/docs/guides/build.md)

## Run from source

Complete the [source installation](docs/src/content/docs/guides/install.md), including Git,
mise, and the pinned Bun and Node runtimes. The guide defines a `gspot` shell function for
the checkout.

Change to the repository you want to configure. Preview the proposal, then initialize and check:

```shell
gspot init --dry-run
gspot init
gspot check
```

Review the proposed files and integrations before accepting. Initialization installs selected
tools unless you pass `--no-install`; lock resolution can still use the network. Initialization
runs no checks. For a disposable example, follow [your first check](docs/src/content/docs/guides/quick-start.md).

## Resolve a finding

A Bash syntax failure looks like this:

```text
greet.sh:1  bash/syntax  syntax error near unexpected token `then'
    help: Open the file at the line bash names and fix the quoting, bracket, or keyword it complains about.
```

Correct the named input and rerun the check. Use `gspot explain bash/syntax` for its purpose
and correction advice. A failed check exits `1`; an execution or setup failure exits `2`.
See [findings and reports](docs/src/content/docs/guides/you-got-a-finding.md) for automatic fixes,
exceptions, and machine-readable output.

## Set repository policy

A complete policy can select one language:

```toml
version = 1
presets = ["bash"]
level = "recommended"
```

`recommended` is the default. `all` adds further naming, ordering, and style checks. Mandatory
trivial-file and trivial-function rules remain enabled at both levels. Change policy with
`gspot set` or `gspot ignore`; those commands apply their changes. Run `gspot apply` after
editing `gspot.toml` directly. Do not edit generated files under `.gspot/`.

Use [scopes](docs/src/content/docs/guides/scopes.md) for nested projects and
[profiles](docs/src/content/docs/guides/profiles.md) to share policy between repositories.
The [customization guide](docs/src/content/docs/guides/customize.md) covers settings and narrow exceptions.

## Daily commands

| Command | Purpose |
| --- | --- |
| `gspot check` | Run selected checks. |
| `gspot check --staged` | Check staged content while preserving unstaged edits. |
| `gspot check --changed` | Select affected checks from working-tree changes. |
| `gspot install` | Install the repository's locked tools and selected hooks after cloning. |
| `gspot doctor` | Diagnose missing tools, configuration drift, and check coverage. |

An affected project check can report defects in unchanged files. Local hooks can be bypassed;
[CI checks](docs/src/content/docs/guides/hooks-and-ci.md) run independently.
For removal, preview `gspot uninstall --dry-run` and follow
[restoration and recovery](docs/src/content/docs/guides/uninstall.md).
If setup or a check cannot run, use the
[troubleshooting guide](docs/src/content/docs/guides/troubleshooting.md) to diagnose the failure.

## Contribute

Read the [build and testing guide](docs/src/content/docs/guides/build.md) and the
[documentation conventions](docs/README.md). The [standalone ESLint plugin](packages/eslint-plugin/README.md)
can also run without the CLI. The project uses [Apache-2.0](LICENSE.md).
