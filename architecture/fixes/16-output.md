# What Runs Where, and What It Prints

Row 21 of the build order. A run of 45 minutes printed nothing until it ended, then 255 lines, and
its summary held no count and no time. `doctor` printed what the config says and never asked git.
This step changes what a person reads.

## K-81: a run prints nothing until it ends

Closes K-81, K-84, and K-117.

**What is wrong.** `runText` in `output/reporter.ts:153` builds the whole output after
`execute.ts` returns. Every check gets a line, passed ones included: 135 lines here. Check lines
say `cache` for a pass that did not run again. The CI workflow runs
`gspot check --json > gspot.json`, so the log of a failed job shows an exit code and no finding.

**Target.** A line prints as each check ends (D-124). The end of the run lists failed, missing,
and skipped checks alone, then a summary with counts and the time. In CI the findings print to
the log, and the JSON report is written beside them.

**Files.** New `run/progress.ts`, `run/execute.ts`, `output/reporter.ts`, `emit/workflow.ts`
(`checkJob`).

**Logic.** `execute.ts` takes an `onResult` callback, and `progress.ts` prints one line for each
result on a terminal, and one line for each failed result elsewhere. A cached pass prints
`unchanged`. The summary is one line: checks passed, checks failed, findings, and
seconds. The workflow runs plain `gspot check`, so the findings are in the log, and it keeps
`.gspot/report.*` as artifacts. No flag is needed, because every run writes those files.

**What goes.** The end list of passed checks, the word `cache` in output, and the shell redirect
of the workflow.

**Tests.** A unit test of `progress.ts` with a fake stream. The workflow snapshot.

**Done when.** A run in this repository prints its first line within two seconds.

## K-82: `doctor` reads the config and never asks git

Closes K-82, K-83, and S-6.

**What is wrong.** `hooksLine` in `doctor/report.ts` prints `hooks .gspot/hooks installed` from
the config. Every run ends with `unchecked N files`, and the count is mostly images: 1,155 here.

**Target.** `doctor` asks git whether the hooks run in this clone. A file counts as unchecked
only when a linter exists that reads its kind, and `check` and `doctor` print the same count.

**Files.** `doctor/report.ts`, `doctor/coverage.ts`, `run/execute.ts`.

**Logic.** `hooksLine` reads `git config core.hooksPath` and the hook files, and says which of
three states holds: the hooks run, the hooks exist and this clone does not run them, or none
exist. It ends with the setup command of the repository (D-115). `coverage.ts` owns one function
that both commands call, and it leaves out files whose nature is `binary`, `generated`, or
`vendored`.

**What goes.** The second count in `execute.ts`.

**Tests.** A unit test of each hooks state. A planted repository of images alone holds a count of
zero.

**Done when.** Both pass.

## K-166: a file counts as checked when spelling reads it

**What is wrong.** The spelling and secrets checks read every text file, so `doctor` reports no
unchecked file where whole kinds of file get no parser, no formatter, and no linter.

**Target.** `doctor` and `gspot list` report which looks each file ending gets: format, syntax,
style, and types. An ending that gets only the general ones is named.

**Files.** `doctor/coverage.ts`, `output/list.ts`, `presets/manifest-schema.ts`.

**Logic.** A check already declares `inspection` in its manifest. `coverage.ts` groups the
claimed endings by the inspections of the checks that read them, and prints one line for an
ending with none of the four.

**What goes.** Nothing.

**Tests.** A planted repository with `.kt` files holds a line that names the ending.

**Done when.** It passes.

## K-122: questions and messages in made-up terms

Closes K-122, K-132, K-130, K-185, and K-243.

**What is wrong.** The init questions use the working words of the code. `askMany` in
`output/prompts.ts` returns its default list without a terminal and does not say so. `RULE_LINE`
in `lifecycle/upgrade/report.ts` finds a changed rule only in a line shaped like the ESLint
config. `gspot explain <setting>` reads the root scope alone. A config that does not load prints
half a sentence, and the uninstall plan prints a hooks line that is not true.

**Target.** Each message says what happened in the words of [19-names.md](../19-names.md).

**Files.** `lifecycle/init/questions.ts`, `output/prompts.ts`, `lifecycle/upgrade/report.ts`,
`output/explain.ts` (`settingExplanation`, `explainDotted`), `policy/messages.ts`,
`lifecycle/uninstall-command.ts`.

**Logic.** `askMany` prints the list it took and the flag that changes it. The upgrade report
compares the rule lists of two template renders as data, for every tool whose template lists
rules, through a `rules_path` key of the config in the manifest. `explain` walks every scope and
prints the value of each that holds the key. A load error prints the file, the line, and one
sentence. The uninstall plan prints the hooks line only when the path will be unset.

**What goes.** `RULE_LINE`.

**Tests.** Unit tests for each message, and an upgrade fixture where SwiftLint gains a rule.

**Done when.** They pass.
