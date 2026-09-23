---
layer: runtime
preset: javascript
title: Bun
---

# Bun

Rules that hold because the code runs on Bun.

## Module resolution

- Match internal imports to the project entry point and TypeScript configuration. Bun
  [resolves TypeScript directly](https://bun.sh/docs/runtime/module-resolution), including
  explicit `.ts` imports and extensionless paths. Do not assume the project emits `.js` files.

## APIs

- `Bun.*` APIs are available, and most Node built-ins are. An API that exists in only one of the
  two makes the file Bun-only, which is a decision to state rather than discover later.
