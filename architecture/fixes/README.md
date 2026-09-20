# Fixes

Follow the [active CI bypass](../22-remaining.md#active-ci-bypass) for every fix. CI acceptance
is deferred until the user explicitly re-enables CI; continue locally verified implementation.

Fix files group subject contracts and historical defect evidence. Implementation priority and
cleanup status live in [22-remaining.md](../22-remaining.md). File numbers are not execution order.

A fix states the actual defect, intended behavior, owner, superseded code, and observable
acceptance. Use headings or tables when they help; seven fixed labels are not a requirement.
Do not repeat current status across phase summaries, gaps, and fixes. Preserve useful failure
evidence once and link to it. Remove obsolete prescriptions when the owning contract changes.
A closed implementation detail needs no permanent test or documentation entry of its own.

No compatibility aliases or forwarding files survive a replacement (D-134). Preserve the
user-facing enforcement contract through verified replacement before deleting duplicate code.

## The files

- [00-delete-first.md](00-delete-first.md): the four presets, the removed commands and flags, and every key, field, and rule nothing uses.
- [01-first-fixes.md](01-first-fixes.md): the checks that destroy work, the checks that pass when they did not run, and the other wrong answers.
- [02-takeover.md](02-takeover.md): what `init` reads, what it proposes, and what it carries.
- [03-hooks.md](03-hooks.md): the hook of the repository, the command names of the team, and lint tables in a shared manifest.
- [04-speed.md](04-speed.md): cache keys, one parse for a scope, one session for `init`, and an incremental Swift build.
- [05-written-files.md](05-written-files.md): the end of the local skip file, the mark, and what `apply` may delete.
- [06-config.md](06-config.md): the text of `gspot.toml`, one word for one idea, and scopes.
- [07-levels.md](07-levels.md): the level key, templates that render by level, and what `recommended` holds in each preset.
- [08-frameworks.md](08-frameworks.md): lint tools under `.gspot/`, the ESLint pin, shared rules in component files, every linter of a framework, and naming rules in the framework preset.
- [09-manifests.md](09-manifests.md): domain-owned checks and preset-owned policy, without forced file inventories.
- [10-tests.md](10-tests.md): a harness that fails early, installs as a developer runs them, one failing case for each check, snapshots, and time.
- [11-layouts.md](11-layouts.md): checks that read their scope, and settings detected from the repository.
- [12-menu.md](12-menu.md): `gspot list`, the three questions of `init`, and the managed block as a list.
- [13-words.md](13-words.md): the renames of the source, the words a person reads, and the `layer:` key.
- [14-push.md](14-push.md): cache keys of a repository check, and a push hook that checks what is pushed.
- [15-top-level.md](15-top-level.md): the root of this repository.
- [16-output.md](16-output.md): progress lines, the summary, and what `doctor` asks git.
- [17-recommended.md](17-recommended.md): no edit of a `tsconfig.json`, and the house rules that move to `all`.
- [18-one-copy.md](18-one-copy.md): proven shared operations with explicit language semantics.
- [19-gitlab.md](19-gitlab.md): the flag names, and GitLab.
- [20-self-check.md](20-self-check.md): templates, tests, and documents under the gate of this repository.
- [21-manual.md](21-manual.md): the README, the guides, and the site.
- [22-launch.md](22-launch.md): Windows, and a release that fails before it ships something broken.
- [23-scenarios.md](23-scenarios.md): root pointers, no git, git edge cases, line ends, merges, more hook tools, both CI jobs, other CI systems, and other agent files.

- [24-contracts.md](24-contracts.md): path boundaries, lifecycle recovery, contract consistency, useful adoption defaults, and site deployment. Safety work is a prerequisite of its affected step; deployment follows release.

- [25-simplification.md](25-simplification.md): keep necessary build work, remove unsafe generation and silent failure handling, validate script arguments, fix file-URL paths, and unify domain names and action/result contracts.
