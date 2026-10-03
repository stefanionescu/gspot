---
title: Planning
---

# Planning

## Complete change content

A plan holds the complete content of every change it proposes, so another agent can carry it
out without inventing anything.

- Show the exact diff of every code, configuration, documentation, schema, and text change, and
  the full contents of every new file. Do not summarize a change the diff can show.
- Name every command that creates, moves, renames, regenerates, or deletes a file, and every
  generated file the change rewrites.
- For an image or another binary file, give the source path, the output path, the operation, and
  the command that reproduces it.
- Leave no placeholder such as `update accordingly`, `adjust imports`, or `fix any errors`.

Bad:

```text
Update the settings screen copy.
```

Good:

```diff
--- a/app/settings/page.tsx
+++ b/app/settings/page.tsx
-<h1>Old title</h1>
+<h1>Account settings</h1>
```

## Order and detail

Each step names its files, symbols, commands, and diffs, and one step holds one change. Order the
steps so each one builds on finished work. Find out what you depend on before you edit it. Change
a shared contract before its callers, and move an owner before the imports that point at it.
Generated output follows the source that produces it, and cleanup follows the last caller.

Say why the steps run in that order, and name the constraints and assumptions that affect them.
Mention an edge case only when it belongs to the requested work.

## Verification steps

The last step runs the checks of the repository over the staged files. A plan adds tests or
other verification only when the user asked for it, scoped to the change.
