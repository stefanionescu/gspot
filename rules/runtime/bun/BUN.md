---
layer: runtime
preset: javascript
title: Bun
---

# Bun

Rules that hold because the code runs on Bun.

## Module resolution

- Internal imports are extensionless unless the entry point requires otherwise. Bun resolves
  TypeScript directly, so an internal import does not carry a compiled `.js` extension.

## APIs

- `Bun.*` APIs are available, and most Node built-ins are. An API that exists in only one of the
  two makes the file Bun-only, which is a decision to state rather than discover later.
