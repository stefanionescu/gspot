---
title: Ignore findings
description: Which switch fits which job, where its reason goes, and how to remove it again.
---

To let something pass, use the narrowest row that works. Fix the code first.

| You want to let pass                                   | Do this                                                                                               | Where the reason goes                                                                       |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| One place in the code                                  | [A suppression comment](#suppress-one-line) of the tool                                               | `reason:` in the comment                                                                    |
| One check, lint rule, or finding, or some paths        | `gspot ignore <check> [--rule <rule-or-fingerprint>] [--paths <path>]`                                | `--reason`                                                                                  |
| Some paths in every check                              | `gspot ignore --paths <path>`                                                                         | `--reason`                                                                                  |
| A whole language or tool                               | `gspot remove <configuration>`                                                                        | `--reason`                                                                                  |
| A higher limit, or one more allowed value              | `gspot set <setting> <value>`                                                                         | `--reason`, when the `needs a reason when` column of `gspot list settings` names the change |
| Some names, one package's license, or one Swift target | Write a `[[naming.exception]]`, `[[licenses.allowed_package]]`, or `[[coverage.swift_target]]` record | `reason =` in the record                                                                    |
| The level, the Git hooks, or the rule files            | `gspot set level basic`, `hooks.enabled false`, or `rule_files.enabled false`                         | `gspot ignore gspot/weakenings --rule <level, hooks, or rule-files> --reason "<why>"`       |

A reason has two or more words. You cannot suppress a size or complexity limit, so raise it with `gspot set`. You cannot
remove a configuration that is always on, such as `spelling`, so ignore its checks. The check `gspot/weakenings` runs at
push and in CI, and fails a weaker `gspot.toml` that has no reason, as
[Changes that need a reason](/configure/gspot-toml/#changes-that-need-a-reason) shows.

Files that `.gitattributes` marks `linguist-generated` or `linguist-vendored` leave most checks, with no reason.
`--skip` and `git commit --no-verify` affect one run, and the next run reports the same findings.

## Suppress one line

To turn off a rule on one line, use the tool's own comment, and give a reason of two or more words:

```javascript
// eslint-disable-next-line no-console -- reason: the command prints its result
```

`gspot/suppressions` fails on a suppression with no reason, and on one that lifts a size or complexity limit.
[Checks](/reference/checks/) lists the form for each tool.

## Ignore a lint rule

`gspot ignore` saves the ignore in `gspot.toml` with your reason:

```shell
gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results to the terminal."
```

Leave out `--rule` to ignore the whole check, and `--paths` to cover every file. An ignore also hides new findings of
that rule in those paths, so name the rule and the paths. gspot rejects a rule name that the tool does not know, and a
check that names no lint rules takes `--paths` instead. A commit reads `gspot.toml` as you staged it, so stage the
ignore with your change.

`--rule` also takes the fingerprint of one finding, which `gspot check --json` prints for each finding of a secret scan.
The ignore then covers that finding alone:

```shell
gspot ignore secrets/gitleaks-staged --rule "<fingerprint>" --reason "<why>"
```

## Choose the paths

`--paths` takes a file, a folder, or a glob pattern, relative to your current folder, and gspot saves it relative to the
root folder of the repository. Each path must match at least one file. To give more paths, repeat the option, as in
`--paths "scripts/**" --paths "fixtures/**"`, because a comma stays part of the path.

## Ignore a dependency advisory

To ignore one security advisory of a dependency, give the advisory ID as the rule:

```shell
gspot ignore dependencies/osv-scanner --rule <advisory-id> --reason "<why>"
```

## Ignore files in every check

To keep some files out of every check, leave out the check ID:

```shell
gspot ignore --paths "fixtures/**" --reason "Fixtures copy upstream files byte for byte."
```

You do not need an ignore for the files that `.gitignore` excludes, or for these files, which most checks skip:

- generated files, which start with a comment such as `@generated` or `// Code generated by ... DO NOT EDIT.`
- vendored files, which are copies of code from other projects: license files, and files in a folder named `vendor`,
  `third_party`, `third-party`, `node_modules`, `Pods`, `Carthage`, or `.build`
- binary files

Secret scans still read every file, and dependency checks still read lockfiles. To skip other generated or vendored
files, mark them in `.gitattributes`, which GitHub reads too:

```text title=".gitattributes"
src/api/schema.ts linguist-generated
lib/upstream/** linguist-vendored
```

To see which checks read a file and which ignores cover it, run `gspot explain ./<path>`.

## Remove an ignore

After you fix the old code, remove the ignore. `--rule` and `--paths` narrow what goes, and `gspot unignore <check>`
removes every ignore of that check:

```shell
gspot unignore javascript/eslint --rule no-console --paths "scripts/**"
```

Each `--paths` value must still match a file, so after you delete the files that an ignore covers, leave `--paths` out.
For an ignore with no check, `gspot unignore --paths <path>` works while the path matches a file. After that, delete the
record from `gspot.toml` yourself, because `gspot/unmatched-paths` reports it.

`gspot check --verbose` lists each ignore that applies, with its reason.
