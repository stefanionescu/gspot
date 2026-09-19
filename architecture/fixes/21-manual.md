# The README, the Manual, and the Site

This step follows the redo of the app, because the guides show real output.
[21-documentation.md](../21-documentation.md) lists every page and what it holds.

## G-10: the documentation is thin

Closes G-10 and K-202.

**What is wrong.** The README and the six guides were written before the adoption findings. They
show commands that D-129 to D-133 remove, a config that gspot refuses, and output no run prints.

**Target.** The README, the guides, and the landing page of `21-documentation.md`, written from
real output of the redo of the app and of the three examples.

**Files.** `README.md`, `docs/src/content/docs/index.md`, `docs/src/content/docs/guides/*.md`,
`packages/eslint-plugin/README.md`, `packages/npm/gspot/README.md`.

**Logic.** Each guide is a task in under two pages, and every step is one command. Every output
block is pasted from a run in `examples/`, and `docs/samples` keeps each command and each config
block true (S-11). The guide on editors says to point the ESLint extension at `.gspot/` (D-145).

**What goes.** Every sentence about `why`, `declare`, `profile check`, `apply --check`, and the
`prepare` script.

**Tests.** `docs/samples`, and the build of the manual.

**Done when.** Both pass, and a reader who follows the first guide in `examples/package/` sees
the output the guide shows.
