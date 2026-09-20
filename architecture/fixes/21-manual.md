# The README, the Manual, and the Site

Publication of the adoption case study follows the redo of the app. Content planning and theme
work can start earlier; public command examples require verified release-matched output.
[21-documentation.md](../21-documentation.md) lists every page and what it holds.

## G-10: the documentation is thin

Closes G-10 and K-202.

**What is wrong.** The README and the six guides were written before the adoption findings. They
show commands that D-129 to D-133 remove, a config that gspot refuses, and output no run prints.

**Target.** The README, task navigation, guides, and landing page specified in
`21-documentation.md`, including its playful terminal field notebook theme, Spot mascot,
image-generation workflow, shared asset family, and acceptance criteria.
Use reproducible public examples and keep adoption evidence separate from introductory samples.

**Files.** `README.md`, `docs/src/content/docs/index.md`, `docs/src/content/docs/guides/*.md`,
`packages/eslint-plugin/README.md`, `packages/npm/gspot/README.md`, `docs/astro.config.ts`,
`docs/src/pages/index.astro`, `docs/src/styles/theme.css`, shared assets under
`docs/public/brand/`, and selected source art and asset records under `docs/design/`.

**Logic.** The manual documents each of the five things `gspot explain` takes. It has one
generated page for each check, each preset, and each setting, and the command reference. A rule
of a tool links to the page of that tool through `rule_page` of its manifest. One guide shows
`explain` on a finding, on a setting, and on a path.

Each guide owns one task with prerequisites, expected results, and recovery. Length follows
the task, not a page quota. Every output block is pasted from a run in `examples/`, and
`docs/samples` keeps each command and each config
block true (S-11). The guide on editors says to point the ESLint extension at `.gspot/` (D-145).

**What goes.** Every sentence about `why`, `declare`, `profile check`, `apply --check`, and the
`prepare` script. Remove the root manual index when the landing page takes its route, not the
existing guide URLs. Remove mandatory statistics cards, autoplay demonstrations, and claims
that initialization runs checks or that all existing configuration can be replaced safely.

**Tests.** `docs/samples`, reference contract checks, and the documentation build in a disposable
checkout. Review both themes, responsive layout, keyboard and screen-reader access, script-free
content, publication payloads, and loading budgets using `21-documentation.md`. Review generated
art for character and palette consistency, workplace suitability, actual transparency,
provenance, and small-size readability. Generation is a design step, not a CI dependency.

**Done when.** The checks pass and a reader follows the first guide in `examples/package/`
without inspecting source. The joining, exception, and recovery tasks also meet the acceptance
criteria of `21-documentation.md`. The site does not present target behavior as shipped behavior.

## S-19: six questions no guide answers

**What is wrong.** The list of guides in [21-documentation.md](../21-documentation.md) misses
six pages. They are a teammate who joins, an editor, another CI system, a config below the git
root, a run beside an old lint, and a folder with no git.

**Target.** Six focused guides, each written from a run in `examples/`, with prerequisites and
expected results rather than a page limit.

**Files.** `docs/src/content/docs/guides/`: `joined-a-repository.md`, `editors.md`, `other-ci.md`,
`below-the-git-root.md`, `beside-your-old-lint.md`, and `without-git.md`.

**Logic.** The first guide covers installing the supported CLI, cloning, `gspot install`,
checking the repository, and committing. It does not add a `prepare` script. The editors guide
holds the pointer table of K-269 and the setting of each editor for a tool with no pointer. The
fifth says what runs twice while both setups exist, and the order in which to remove the old
one.

**What goes.** Nothing.

**Tests.** `docs/samples` parses every command and config block of the six.

**Done when.** It passes, and each guide was followed once in `examples/` by hand.
