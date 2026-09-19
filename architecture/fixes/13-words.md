# Plain Words and Renames

Row 18 of the build order. gspot bans made-up words in the code it checks, and its own code and
output hold several. [19-names.md](../19-names.md) holds the table of every rename, with the
count of places. A rename replaces the old name everywhere in one commit, and the old name is
then an unknown word (D-134).

## K-54: `render` and `synced`

**What is wrong.** The naming policy gspot ships refuses `render` for writing a file and `sync`
for applying. The source holds `render` in 108 places and `synced` in 15.

**Target.** `emit` and `applied`, as D-92 decides.

**Files.** `emit/templates.ts`, `emit/targets.ts`, `emit/apply-command.ts`, their types and tests,
and every template helper named `render`.

**Logic.** Renames only, by the language server, one word in one commit.

**What goes.** 123 uses.

**Tests.** `naming/identifiers` on gspot with no exception for either word.

**Done when.** A search of `packages/` for both words finds only what a library names.

## K-66: made-up words a person reads

**What is wrong.** `surface`, `layer`, run record, `inspection`, `declare`, policy, nature,
`Re-render`, and `idempotent` reach a person through messages, help text, guides, and rule files.

**Target.** The words of [19-names.md](../19-names.md): tasks for `surface`, folder for `layer`,
report for run record, check group for `inspection`, config for policy in text a person reads.

**Files.** `policy/schema.ts` (the key `inspection` becomes `groups`), `commands/*.ts` help text,
`output/messages.ts`, `doctor/report.ts`, the six guides, and the rule files.

**Logic.** A key rename follows D-144, with its row in the names table. Type names inside the
code change only where the table says so.

**What goes.** The nine words in text a person reads.

**Tests.** The Vale style `gspot` gains the nine words as banned terms for `docs/` and for the
message files, so `prose/vale` holds the rule.

**Done when.** `prose/vale` passes with that list on.

## K-67: the `layer:` key of a rule file

**What is wrong.** Files under `rules/general/code/` say `layer: code`, and the folder says
`general`. One word holds two meanings, and the key repeats the path.

**Target.** The front matter of a rule file holds `preset` and `title`. The folder says the rest.

**Files.** All 103 rule files, `src/rules/front-matter.ts`, `src/rules/managed-block.ts`.

**Logic.** `front-matter.ts` refuses the key. The managed block groups by the first folder.

**What goes.** 103 lines.

**Tests.** The rules lint fails a file with the key.

**Done when.** It passes on `rules/`.
