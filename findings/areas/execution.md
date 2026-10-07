# Execution, Tools, Repository, Platform, and Parsers

Architecture material from the original audit follows. It is history: where it disagrees with a later decision or with the target trees in [the source layout review](../review/source-layout.md) and [the test layout review](../review/tests-layout.md), those win. Superseded here: `tools/pins.ts` moves to `configurations/pins.ts` (`review/source-layout/003`), and the tool-output parsers live in `parsers/output/`, not `execution/output/`. Names follow [the glossary](../review/glossary.md), which wins over every name below: `snapshot/` is `execution/copy/` with `files.ts` for `workspace.ts`, an engine is a built-in check, `command/runner.ts` is `command/check.ts`, and a lock file is a lockfile. Current repository decisions are recorded in [progress](../progress.json).

## Target layout

```text
Today                                   After
execution/                              execution/
  checkout/installed.ts                   snapshot/dependencies.ts   was checkout/installed.ts; shares the tree copy with workspace.ts
  checkout/revision.ts                    snapshot/revision.ts       checkOutRevision only; Git object readers move to repository/revisions/objects.ts
  tool/workspace.ts                       snapshot/workspace.ts      every temporary copy a check runs in sits in one folder
  tool/runner.ts                          command/runner.ts          folder renamed: "tool" clashed with tools/; runCommandCheck, runEngineTool
  tool/placeholders.ts                    command/placeholders.ts
  tool/batches.ts                         command/batches.ts
  tool/findings.ts                        command/failures.ts        renamed: five of its seven exports classify failures
  tool/formats.ts                         output/parse.ts            output parsers get their own folder; ESLint parser moves to reports.ts
  tool/json.ts                            output/json.ts
  tool/reports.ts                         output/reports.ts          + parseEslintJson from formats.ts
  engines.ts                              engines.ts                 toolCheck wrapper deleted
  execute.ts                              run.ts                     uses plan.ts isActive instead of a copy
  run-report.ts                           report.ts                  takes the unstaged count instead of writing 0
  finding.ts, fixers.ts, reproduce.ts,    (unchanged)
  session.ts, planning/*
parsers/                                parsers/
  references.ts                           markdown.ts                renamed: it reads Markdown prose
  tree-sitter.ts                          tree-sitter.ts
  sql/pg.ts                               sql/pg.ts
  sql/source.ts                           sql/lexer.ts               renamed: it is the psql lexer
  sql/statements.ts                       sql/statements.ts
  sql/modules.d.ts                        (moved to types/modules.d.ts; it also declares two spdx modules)
                                          jsonc.ts                   from repository/
                                          tsconfig.ts                from repository/
                                          lockfiles.ts               repository/locked-packages.ts + the readers in tools/packages/locks.ts
platform/                               platform/
  filesystem.ts                           root/open.ts               openRoot, walkRoot; readText moves to repository/sources.ts
  root/reads.ts                           root/reads.ts
  root/writes.ts                          root/writes.ts
  safe-paths.ts                           root/rules.ts              the path rules of the root, beside it
                                          scratch.ts                 scratchFolder, from filesystem.ts
  code-points.ts                          (merged into text.ts)
  git.ts                                  git.ts                     one deadline everywhere, stdin option, gitTrimmed deleted
  paths.ts                                paths.ts                   buildFolder moves to checks/language/swift/cache.ts
  environment.ts                          environment.ts             miseHome returns the default folder
  assets.ts, errors.ts, quoting.ts,       (unchanged)
  spawn.ts, text.ts
repository/                             repository/
  tree.ts                                 read.ts                    renamed: "tree" clashes with Git trees and tree-sitter trees; Swift tags move to tags.ts
  tracked.ts                              tracked.ts                 file inventory only; one stage listing
                                          root.ts                    findRoot and isGitRepository, from tracked.ts
  packages.ts                             manifests.ts               renamed: it reads every manifest kind
  sources.ts                              sources.ts                 + readText from platform/filesystem.ts
  revisions/changes.ts                    revisions/changes.ts
  revisions/push.ts                       revisions/push.ts          + refspecs.ts (its only importer)
  revisions/refspecs.ts                   (merged into push.ts)
                                          revisions/objects.ts       getEntries, getCachedEntries, getHeadEntries, getBlobs from execution/checkout/revision.ts
  jsonc.ts, tsconfig.ts                   (moved to parsers/)
  locked-packages.ts                      (moved to parsers/lockfiles.ts)
  kind.ts, scopes.ts, selectors.ts,       (unchanged files)
  survey.ts, tags.ts
tools/                                  tools/
  command.ts                              run.ts                     runTool; every tool process goes through it, Vale included
  inspect.ts                              inspect.ts                 toolPin moves to pins.ts, locateTool deleted, one version reader
  locate.ts, mise.ts, pins.ts,            (unchanged files)
  installed-files.ts, python.ts, vale.ts
                                          credentials.ts             the registry-password guard npm and uv both copy today
  packages/                               npm/                       renamed: "packages" also means Vale packages and manifests
    commands.ts                             install.ts
    environment.ts                          registry.ts              clashed with platform/environment.ts
    identity.ts                             manager.ts               PackageTool becomes PackageManager
    locks.ts                                locks.ts                 lockMatches and the URL rewrites only
    project.ts, yarn.ts                     project.ts, yarn.ts
```
