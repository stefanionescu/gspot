# The Top Level of This Repository

Row 20 of the build order. The root of gspot is what a developer sees first on GitHub. It holds
two folders that belong elsewhere and lacks four files that every project it is compared with
has. [12-repository-layout.md](../12-repository-layout.md) holds the comparison.

## K-73: `prose/` and `schema/` at the top level

Closes K-73 and K-68.

**What is wrong.** `prose/` is the source of one preset. `schema/` holds two generated files, and
`docs/public/schema/` tracks the same two again, 170 KB. The root lacks `examples/`,
`CONTRIBUTING.md`, `CHANGELOG.md`, and `SECURITY.md`. `packages/cli/build/entry.ts` is a folder
with one file.

**Target.** The root of [16-file-tree.md](../16-file-tree.md).

**Files.** `prose/styles/` and `prose/vocabularies/` move to `presets/prose/`. `schema/` and
`docs/public/schema/` are deleted, and `packages/cli/schemas.ts` writes `gspot.schema.json` at
the root. `packages/cli/build/entry.ts` folds into `build.ts`. New: `examples/package/`,
`examples/two-scopes/`, `examples/swift-package/`, `CONTRIBUTING.md`, `SECURITY.md`, and
`NOTICE.md` (K-245).

**Logic.** `platform/assets.ts` reads the Vale style from the prose preset. The run record schema
is a constant of `run/record/schema.ts`, which `--json` consumers get through `gspot.schema.json`
under `$defs`. The docs build copies the schema. The planted tests install into the three
examples, so they cannot go stale. `CHANGELOG.md` arrives with the first changeset release.

**What goes.** Two top-level folders and one tracked copy of the schemas.

**Tests.** `schema/generated` compares the root file. A planted test runs `init` and `check` in
each example.

**Done when.** `ls` at the root matches the tree, and the three example tests pass.
