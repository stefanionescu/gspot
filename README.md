# gspot

gspot checks repository policy across code, configuration, documentation, and Git hooks.
Presets select checks and pinned tools. `gspot.toml` owns the policy; `gspot apply` generates
the files those tools read. Rule files give coding agents the selected repository instructions.

A real finding from the [reproducible example](docs/src/content/docs/guides/quick-start.md):

```text
greet.sh:1  bash/syntax  syntax error near unexpected token `then'
    help: Open the file at the line bash names and fix the quoting, bracket, or keyword it complains about.
```

The example starts with `if then`, replaces it with a valid `printf` statement, and records the
successful rerun. Its unchecked-files notice remains visible: passing one selected check does
not mean every file was checked.

## Install

Use Git and mise 2026.8.8 or later to run a contributor checkout. mise supplies the pinned Bun runtime. Installing dependencies downloads the
packages recorded in the lockfile:

```shell
git clone https://github.com/stefanionescu/gspot.git
cd gspot
mise run repo:setup
bun packages/cli/src/main.ts --help
```

For the commands below, define a shell function while still in the checkout:

```shell
GSPOT_SOURCE="$PWD/packages/cli/src/main.ts"
gspot() { bun "$GSPOT_SOURCE" "$@"; }
```

This function runs the source CLI in your current shell. It does not install a global executable.
Read the [installation guide](docs/src/content/docs/guides/install.md) for tool requirements and
platform limits, or the [build guide](docs/src/content/docs/guides/build.md) for local binaries.
Installing the CLI and configuring a repository are separate steps.

## First run

Change to the repository you want to configure. Preview its proposal first:

```shell
gspot init --dry-run
```

The proposal describes policy, generated tool configuration, locks, and selected integrations.
Review existing configuration and hook handling before accepting. Initialization can install
selected tools unless you pass `--no-install`; that option still allows lock resolution to use
the network. Run initialization and checking separately:

```shell
gspot init
gspot check
```

Init applies the accepted proposal once and runs no checks. For an existing setup, read the
[adoption guide](docs/src/content/docs/guides/existing-repository.md). A teammate who clones a
configured repository runs `gspot install`, which consumes its matching locks without resolving
new tracked configuration. Setup does not inject a `prepare` lifecycle script.

## Use it every day

| Command                     | Purpose                                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| `gspot check`               | Run the selected checks.                                                   |
| `gspot check --staged`      | Check staged content, preserving unstaged edits.                           |
| `gspot check --changed`     | Select affected checks from working-tree changes.                          |
| `gspot explain bash/syntax` | Explain a check and its correction.                                        |
| `gspot apply`               | Regenerate configuration after a policy change and resolve matching locks. |
| `gspot install`             | Install the tools already selected and locked by the repository.           |

A finding names its check and location. Follow its `help:` text, correct the input, and rerun
the check. Project-wide tools can report an existing defect in an unchanged file when a change
selects that project. Read the [finding guide](docs/src/content/docs/guides/you-got-a-finding.md)
for selection, persistent exceptions, and correction commands.

## Choose your checks

The default level is `recommended`. `all` adds naming, layout, ordering, and abstraction
preferences. Select it explicitly with `gspot set level all`, then `gspot apply`.

This complete Bash policy includes a narrow exception for a variable consumed by another script:

```toml
version = 1
presets = ["bash"]

[[ignore]]
check = "bash/shellcheck"
rule = "SC2034"
paths = ["<script-path>"]
reason = "These variables are read by the script that sources this file."
```

Replace `<script-path>` with the repository-relative Bash file. The check name selects the integration; `SC2034` selects the tool diagnostic. Apply the policy
after editing it. Prefer a specific path and reason to disabling an entire check. Read
[customization](docs/src/content/docs/guides/customize.md),
[scopes](docs/src/content/docs/guides/scopes.md), and
[profiles](docs/src/content/docs/guides/profiles.md) for larger repositories and shared policy.

## Adopt and remove

Init carries supported settings through their owning tools and identifies unsupported behavior
that stays in the original configuration. Before replacing an owned file, lifecycle operations
record original bytes and permissions for recovery. Preserve local recovery data until you no
longer need those originals. Change policy through `gspot.toml` or the writing commands; do not
edit managed output under `.gspot/`.

Preview removal with `gspot uninstall --dry-run`; follow the
[recovery guide](docs/src/content/docs/guides/uninstall.md) for retained edits. Uninstall restores an original only when its
destination is absent or unchanged since installation. It preserves later edits, unowned files,
`gspot.toml`, and recovery data. A fresh clone without local ownership records does not authorize
deletion merely because a file matches a generated template.

`git commit --no-verify` bypasses local commit hooks. `git push --no-verify` bypasses the local
push hook. Neither changes independently configured CI or server policy.

## Support and help

Use `gspot list presets` to inspect available integrations and `gspot doctor` to investigate
coverage, missing tools, and configuration drift. The
[troubleshooting guide](docs/src/content/docs/guides/troubleshooting.md) explains common failures.
The [standalone ESLint plugin](packages/eslint-plugin/README.md) also works without the CLI.

Repository CI remains paused behind `GSPOT_CI_ENABLED`. Its configured cadence is affected PR,
merge-queue, and main checks, with full platform and manual acceptance at release checkpoints or
explicit dispatch. No CI run is implied by a local test result. Contributor commands live in the
[build guide](docs/src/content/docs/guides/build.md). [Architecture](architecture/README.md) contains
contributor design contracts. The project uses [Apache-2.0](LICENSE.md).
