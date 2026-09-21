# Plain Words and Renames

Public names must describe the implemented contract. Internal names do not need global
synonym replacement. [19-names.md](../19-names.md) owns the shared vocabulary.

## K-54: `render` and `synced`

**Retired.** Occurrence counts and synonym replacement do not establish a defect.
Keep precise existing names, including native tool and library terms. Rename only when
a name misstates a public contract or hides an effect, under
[the names owner](../19-names.md#names-that-hide-effects). No rename campaign remains.

## K-66: made-up words a person reads

**What is wrong.** `surface`, `layer`, run record, `inspection`, `declare`, policy, nature,
`Re-render`, and `idempotent` reach a person through messages, help text, guides, and rule files.

**Target.** The words of [19-names.md](../19-names.md). `[runner] surface` becomes `[runner] tool`.
The run record becomes the report: `.gspot/report.json`.

`[inspection] strict` becomes `[coverage] strict`. `[[declare]]` becomes `[[generated]]` with `paths`,
and `[[vendored]]`. Policy becomes config in text a person reads.

**Files.** Policy schema, command help, output messages, doctor output, public guides, and rule
files that expose these terms. The public report name does not require a `run/report/`
directory. Follow the result and rendering owners in [16-file-tree.md](../16-file-tree.md).

**Logic.** A key rename follows D-144, with its row in the names table. Type names inside the
code change only where the table says so.

**What goes.** The nine words in text a person reads.

**Tests.** Contract tests compare domain terminology in help, reports, schemas, and generated reference against [19-names.md](../19-names.md). Do not ban words globally. A real map key, third-party identifier, historical rename, or task-runner description is not a terminology defect.

**Done when.** Public names and their implementation mappings match the canonical vocabulary, without false positives on external contracts or historical evidence.

## K-67: the `layer:` key of a rule file

**What is wrong.** Files under `rules/general/code/` say `layer: code`, and the folder says
`general`. One word holds two meanings, and the key repeats the path.

**Target.** The front matter of a rule file holds `preset` and `title`. The folder says the rest.

**Files.** All 103 rule files, `src/rules/front-matter.ts`, `src/rules/managed-block.ts`.

**Logic.** `front-matter.ts` refuses the key. The managed block groups by the first folder.

**What goes.** 103 lines.

**Tests.** The rules lint fails a file with the key.

**Done when.** It passes on `rules/`.
