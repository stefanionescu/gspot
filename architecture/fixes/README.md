# Fixes

One file for each step of the order in `architecture/13-roadmap.md`. A file holds one section
for each row of [18-gaps.md](../18-gaps.md) that its step closes. Every section has the same seven
labels in bold, so a reader finds the same thing in the same place.

| Label         | Holds                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------- |
| What is wrong | the evidence of the row: the file, the function, and the run that showed it                     |
| Target        | how it works afterwards, as behavior a test can hold                                            |
| Files         | what is created, moved, renamed, and deleted, as [16-file-tree.md](../16-file-tree.md) names it |
| Logic         | the functions that change, and how                                                              |
| What goes     | the workaround, flag, key, alias, cast, or suppression deleted with it                          |
| Tests         | the test that fails today and passes afterwards                                                 |
| Done when     | one sentence a reviewer can check                                                               |

Nothing is kept for an older config, flag, or file layout (D-134). A section leaves this folder in
the commit that closes its row.

## The files

- [00-delete-first.md](00-delete-first.md): the four presets, the removed commands and flags, and every key, field, and rule nothing uses.
- [01-first-fixes.md](01-first-fixes.md): CI, the checks that destroy work, the checks that pass when they did not run, and the other wrong answers.
- [02-takeover.md](02-takeover.md): what `init` reads, what it proposes, and what it carries.
- [03-hooks.md](03-hooks.md): the hook of the repository, the command names of the team, and lint tables in a shared manifest.
- [04-speed.md](04-speed.md): cache keys, one parse for a scope, one session for `init`, and an incremental Swift build.
- [05-written-files.md](05-written-files.md): the end of the local skip file, the mark, and what `apply` may delete.
- [06-config.md](06-config.md): the text of `gspot.toml`, one word for one idea, and scopes.
- [07-levels.md](07-levels.md): the level key, templates that render by level, and what `recommended` holds in each preset.
- [08-frameworks.md](08-frameworks.md): lint tools under `.gspot/`, the ESLint pin, shared rules in component files, every linter of a framework, and naming rules in the framework preset.
- [09-manifests.md](09-manifests.md): one file for each check name, and every fact about a preset in its manifest.
- [10-tests.md](10-tests.md): a harness that fails early, installs as a developer runs them, one failing case for each check, snapshots, and time.
- [11-layouts.md](11-layouts.md): checks that read their scope, and settings detected from the repository.
- [12-menu.md](12-menu.md): `gspot list`, the three questions of `init`, and the managed block as a list.
- [13-words.md](13-words.md): the renames of the source, the words a person reads, and the `layer:` key.
- [14-push.md](14-push.md): cache keys of a repository check, and a push hook that checks what is pushed.
- [15-top-level.md](15-top-level.md): the root of this repository.
- [16-output.md](16-output.md): progress lines, the summary, and what `doctor` asks git.
- [17-recommended.md](17-recommended.md): no edit of a `tsconfig.json`, and the house rules that move to `all`.
- [18-one-copy.md](18-one-copy.md): one analysis for each idea, in every language.
- [19-gitlab.md](19-gitlab.md): the flag names, and GitLab.
- [20-self-check.md](20-self-check.md): templates, tests, and documents under the gate of this repository.
- [21-manual.md](21-manual.md): the README, the guides, and the site.
- [22-launch.md](22-launch.md): Windows, and a release that fails before it ships something broken.
- [23-scenarios.md](23-scenarios.md): root pointers, no git, git edge cases, line ends, merges, more hook tools, both CI jobs, other CI systems, and other agent files.
