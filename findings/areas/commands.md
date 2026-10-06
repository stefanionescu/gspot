# Commands, Lifecycle, Generation, and Output

Architecture material from the original audit follows. Current repository decisions are recorded in [progress](../progress.json).

## Target layout

```text
Today
src/
  main.ts
  commands/
    program.ts  print-result.ts  prompts.ts  edit.ts
    add.ts  remove.ts  set.ts  ignore.ts  apply.ts  export.ts  list.ts
    check/    command.ts  run.ts  content.ts  push.ts  selection.ts
    doctor/   command.ts  report.ts  changes.ts
    explain/  command.ts  subjects.ts  checks.ts  path.ts
    init/     command.ts  prepare.ts  propose.ts  questions.ts  selection.ts
              detection.ts  replaced.ts  write.ts
              plan/  build.ts  text.ts
    install/  command.ts  steps.ts
  lifecycle/
    apply.ts  write.ts  drift.ts  hooks-path.ts  version-pin.ts
    merge/      document.ts  plan.ts
    ownership/  owner.ts  apply.ts  plans.ts  log.ts  schema.ts
                installations.ts  restoration.ts  claude-file.ts
    preview/    compare.ts  gixy.ts  javascript.ts  shellcheck.ts
                sqlfluff.ts  swiftformat.ts  vale.ts
                eslint/  client.ts  declarations.ts  diff.ts  protocol.ts  worker.ts
  generation/
    outputs.ts  kits.ts  templates.ts  registry.ts  fragments.ts  pointers.ts
    headers.ts  json-format.ts  markers.ts  hooks.ts  ci.ts  bunfig.ts
    ignore-patterns.ts  javascript.ts  vale-styles.ts
    eslint/      blocks.ts  configuration.ts
    formatting/  selectors.ts  settings.ts
    tools/       environment.ts  mise.ts  packages.ts
  output/
    messages.ts  reporter.ts

After
src/
  main.ts                    unchanged (bin entry; program.ts stays importable by docs and tests)
  commands/
    program.ts               + printCommand from print-result.ts; one place maps errors to output and exit codes
    policy-edit.ts           was edit.ts: preparePolicy, writePolicy, commitPolicy, requireReason
    kits.ts                  add.ts + remove.ts merged, + installSelection (only add and remove use it)
    set.ts  ignore.ts        both gain --dry-run (commitPolicy already supports it)
    apply.ts  export.ts  list.ts
    check/
      command.ts             + run.ts (routing to staged, push, or tree); each guard runs once
      tree.ts                was content.ts (checkContent -> checkTree)
      push.ts  selection.ts
    doctor/
      command.ts             command.ts + report.ts merged; DoctorOptions deleted
      suggestions.ts         was changes.ts (getChanges/Changes -> getSuggestions/Suggestions)
    explain/
      command.ts             command.ts + subjects.ts merged (dispatch, kit, setting)
      check.ts               was checks.ts
      path.ts
    init/
      command.ts  prepare.ts  selection.ts  detection.ts  replaced.ts  write.ts
      questions.ts           + prompts.ts (only init asks questions)
      policy-text.ts         was propose.ts, + plan() from plan/build.ts renamed draftPolicy()
      plan.ts                plan/build.ts + plan/text.ts; folder plan/ deleted
    install/
      command.ts
      steps.ts               each step has run() and preview(); the dry run reads the same list
  lifecycle/
    apply.ts                 write.ts + apply.ts merged: one apply pipeline
    drift.ts  hooks-path.ts  version-pin.ts
    managed-block.ts         was generation/markers.ts (only lifecycle imports it)
    merge/       document.ts  plan.ts
    ownership/   owner.ts (test-only members removed)  commit.ts (was apply.ts)
                 plans.ts  log.ts  schema.ts  installations.ts  restoration.ts  claude-file.ts
    rule-diff/               was preview/: compare.ts, the five config readers, eslint-diff.ts (was eslint/diff.ts)
  tools/eslint/              was lifecycle/preview/eslint/{client,declarations,protocol,worker}.ts;
                             checks/language/javascript/rules-off.ts uses the worker too
  generation/
    outputs.ts               emitAll(session)
    configurations.ts        was kits.ts (name clashed with src/kits/)
    templates.ts             + eta from registry.ts, if the owner relaxes the registry rule
    fragments.ts  pointers.ts  headers.ts  json-format.ts  hooks.ts  ci.ts  bunfig.ts
    ignore-patterns.ts  vale-styles.ts
    jsconfig.ts              was javascript.ts; aliasesFor moves to repository/aliases.ts
    formatting.ts            formatting/settings.ts + the live part of selectors.ts; folder deleted
    tool-projects.ts         tools/environment.ts + mise.ts + packages.ts; folder deleted
    eslint/      blocks.ts  configuration.ts
  output/
    messages.ts  reporter.ts colors read from the module, not passed through every function
```

84 files become about 75. The four ESLint worker files move to `tools/`, which the layer edges in `gspot.toml` allow: `checks` and `lifecycle` may both import `tools`. The plan does not move `tools/` generators out of `generation/`, because `tools` may not import `generation/headers.ts`.
