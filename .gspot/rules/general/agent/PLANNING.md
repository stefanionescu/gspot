---
layer: agent
preset: rules
title: Planning
---

# Planning

## Complete change content

A plan must contain the complete content of every change it proposes.

Rules:

- Include a complete code diff or text diff for every code, configuration,
  documentation, data, schema, script, UI, style, and text change.
- Do not summarize a change when the exact diff can be shown.
- Do not describe a future edit without including the exact patch that makes the
  edit.
- Include every new file's full contents.
- Include every deleted file's full removed contents or the full deletion diff.
- Include every command needed to create, transform, move, rename, resize,
  regenerate, or delete an artifact.
- Include changes to generated files when the plan expects generated files to
  change.
- Include changes to images, icons, screenshots, binary assets, and other non-text artifacts. List
  the exact source path, output path, operation, dimension or metadata changes, and the command that
  reproduces the result.
- If a binary diff cannot be represented as text, include enough exact
  reproduction detail that the asset change is part of the plan rather than an
  implied follow-up.

Bad:

```text
Update the settings screen copy and resize the hero image.
```

Good:

```diff
diff --git a/app/settings/page.tsx b/app/settings/page.tsx
--- a/app/settings/page.tsx
+++ b/app/settings/page.tsx
@@
-<h1>Old title</h1>
+<h1>Account settings</h1>
```

```bash
convert assets/hero.png -resize 1200x assets/hero.png
```

```text
Asset change:
- Path: assets/hero.png
- Operation: resize in place
- Width: 1200 px
- Command: convert assets/hero.png -resize 1200x assets/hero.png
```

## Verification steps

A plan lists `gspot check --staged` as its last step. It adds test work or other verification
only when the user asked for it, scoped to the change in the plan.

## Implementation order

Plans must define the exact order of implementation.

Rules:

- Break the work into sequential steps.
- Put dependency discovery before edits that depend on that discovery.
- Put shared contract or type changes before callers that use them.
- Put data shape changes before UI or API surfaces that present the data.
- Put ownership moves before import or call-site updates.
- Put generated output after the source change that produces it.
- Put cleanup after all call sites have moved.
- Keep each step concrete enough that another agent can execute it without
  inventing missing decisions.
- State which files, symbols, assets, commands, and diffs belong to each step.
- Do not hide multiple unrelated edits inside one broad step.

Bad:

```text
1. Refactor the feature.
2. Update the UI.
```

Good:

```text
1. Add the new `MessagePreview` value shown in the diff.
2. Update `MessageRepository` to return `MessagePreview` using the exact diff.
3. Replace the inbox row inputs with `MessagePreview` using the exact diff.
4. Remove the old row-only mapping code using the exact deletion diff.
```

## Plan detail level

Plans must be extensive and detailed enough to be directly executable.

Rules:

- Include the reasoning needed to understand why the steps are ordered that way.
- Include file paths for every edit in the plan.
- Include exact names for new files, functions, types, commands, assets, and
  configuration keys.
- Include expected intermediate states when a sequence temporarily changes
  contracts, generated outputs, or asset files.
- Include all constraints, assumptions, and dependencies that affect execution.
- Include edge cases or failure modes only when they are part of the real
  requested work.
- Do not leave placeholders such as `update accordingly`, `adjust imports`, or `fix any errors`.
- Do not rely on the implementer to infer omitted code, omitted commands, or
  omitted asset operations.
