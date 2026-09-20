# One Copy of Each Rule

Row 23 of the build order. The rules gspot wrote itself exist once for each language, with their
own constants, and they do not hold in every language alike. After this step an idea that stays
is written once over the syntax tree, with one set of limits. The manifest of each language
lists it under a name of its own (D-98). TypeScript keeps its ESLint rules, so an editor still
shows them (D-02), and one fixture set holds both implementations to the same answers. This step also builds the checks the ledger promised and nobody wrote (K-248).

## K-87: three copies of one idea

Closes K-87, K-235, and K-86.

**What is wrong.** The trivial-function, call-through, and duplicate-function logic exists for
shell, for Python, and for Swift, each with `TRIVIAL_STATEMENTS = 2`, `TRIVIAL_LINES = 3`, and
`ONE_CALLER_COUNT = 2`. A small function with one caller is a finding in Bash, Python, and Swift,
and not in TypeScript. Two functions with one body are found in Bash, Swift, and TypeScript, and
not in Python. One owner of the environment is checked in Bash, Swift, and TypeScript, and not in
Python, although `PYTHON.md` states the rule.

The import layout, the import boundaries,
duplicate names in `__all__`, and export-only modules exist for TypeScript alone. The Swift doc
comment rule and the trivial function of PL/pgSQL were never written.

**Target.** This table, held by a unit test over the manifests:

| Idea                                    | Level       | Bash | Python | Swift | TypeScript | SQL |
| --------------------------------------- | ----------- | ---- | ------ | ----- | ---------- | --- |
| File and function length                | recommended | yes  | yes    | yes   | yes        | yes |
| Call-through                            | recommended | yes  | yes    | yes   | yes        | yes |
| Duplicate functions                     | recommended | yes  | yes    | yes   | yes        | no  |
| Unused functions                        | recommended | yes  | yes    | yes   | yes        | no  |
| Dead parameters                         | recommended | yes  | yes    | yes   | yes        | no  |
| Import cycles                           | recommended | no   | yes    | no    | yes        | no  |
| Environment owner                       | all         | yes  | yes    | yes   | yes        | no  |
| Import layout and boundaries            | all         | no   | yes    | no    | yes        | no  |
| Export-only files, alias constants      | all         | no   | yes    | no    | yes        | no  |
| Private before public, doc comment form | all         | yes  | yes    | yes   | yes        | no  |

**Files.** `structure/analyses/`: one file for each idea, with a small table for each language
under `structure/languages/` that names the node kinds of a function, a call, a parameter, an
import, and an export. The folders `apple/structure/` and `pyproject/structure/` fold into it.
`presets/structure/manifest.toml` holds the limits once.

**Logic.** An analysis asks the language table for nodes and never names a language. The name
stays with the language: `structure/call-through` for shell, `python/call-through`,
`swift/call-through`, and `sql/call-through`, so a baseline and an ignore hold one language
(D-98). TypeScript keeps `gspot/no-call-through` and its sibling rules in the plugin (D-02), and
reads the same limits from the same settings. A call-through replaces the trivial-function check
in every language, as K-102 found for TypeScript. A language gains an idea by adding its table
row and one manifest entry.

**What goes.** The three constant sets, the per-language copies, and the check names
`structure/trivial-function`, `python/trivial-function`, and `swift/trivial-function`. The key
`limits.sql.function_lines` gains its reader here.

**Tests.** One fixture for each cell of the table that says yes: a short file with the defect and
one without. The TypeScript fixtures run through the rule tester of ESLint, and the same cases in
the other languages run through the shared analysis, from one table of cases.

**Done when.** The unit test over the table passes, and the ledger test of K-248 passes.
