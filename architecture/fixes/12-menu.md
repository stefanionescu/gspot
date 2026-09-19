# The Menu, the Questions, and the Agent Block

Rows 16 and 17 of the build order. They cover what a person sees first: what `init` asks, what
exists, and what gspot writes into `CLAUDE.md`. K-63, the level on every check, is built in
[07-levels.md](07-levels.md).

## K-62: no command lists what exists and what is on

Closes K-62 and K-63.

**What is wrong.** A developer cannot see which presets exist, which are installed, and which
checks are off, without reading manifests (A-21).

**Target.** `gspot list` prints presets in three groups: installed, found in the repository and
not selected, and the rest. Under each installed preset it prints its checks with their state:
on, off by level, off by an ignore, or waiting for a setting. `gspot list settings` prints every
setting with its value and where the value comes from (D-118, D-131).

**Files.** New `commands/list.ts`, new `output/list.ts`, `presets/listing.ts`. Deleted:
`doctor/settings.ts`.

**Logic.** `listing.ts` already builds what `explain <preset>` prints. `list` adds the state from
`presets/levels.ts`, `run/ignores.ts`, and the `waits_for` key. Each preset of the second group
ends with its `gspot add` line (D-143). `--json` prints the same data.

**What goes.** `doctor --settings`.

**Tests.** A unit test of `output/list.ts` for each of the four states, and the JSON shape test.

**Done when.** `gspot list` in this repository names every manifest once.

## K-64: one list of every proposed preset

**What is wrong.** `askPresets` in `lifecycle/questions.ts` shows one list of up to 49 entries
(A-23).

**Target.** Three questions (D-120): the languages and frameworks found, the tools found, and
the checks that fit any repository, each with its proposed set already marked.

**Files.** `lifecycle/init/questions.ts`.

**Logic.** A manifest `kind` decides the group. A group with nothing found is not asked.

**What goes.** The single list.

**Tests.** A unit test with a fake prompt holds three calls and their options.

**Done when.** It passes.

## K-65: the managed block is a padded table

**What is wrong.** `rules/managed-block.ts` writes a Markdown table padded to the longest cell. In
the app the block is 21 KB, where the file held 372 bytes before (A-25).

**Target.** The block is a plain list: one line for each selected preset, with the paths of its
rule files, then the check command and how policy changes.

**Files.** `src/rules/managed-block.ts`.

**Logic.** A list item holds the preset title and its files as links. No padding.

**What goes.** The table writer.

**Tests.** The snapshot of the block for the selection of the app holds under 3 KB.

**Done when.** It passes, and `CLAUDE.md` of this repository is rewritten by `gspot apply`.
