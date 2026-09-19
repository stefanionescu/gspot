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

The list grows as each file is written.

- [00-delete-first.md](00-delete-first.md): the four presets, the removed commands and flags, and every key, field, and rule nothing uses.
- [01-first-fixes.md](01-first-fixes.md): CI, the checks that destroy work, the checks that pass when they did not run, and the other wrong answers.
- [02-takeover.md](02-takeover.md): what `init` reads, what it proposes, and what it carries.
- [03-hooks.md](03-hooks.md): the hook of the repository, the command names of the team, and lint tables in a shared manifest.
- [04-speed.md](04-speed.md): cache keys, one parse for a scope, one session for `init`, and an incremental Swift build.
