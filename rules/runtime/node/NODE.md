---
layer: runtime
preset: javascript
title: Node
---

# Node

Rules that hold because the code runs on Node, whatever language it is written in.

## Module resolution

- Compiled TypeScript uses `NodeNext` module semantics. An internal import that points at
  TypeScript source carries a runtime `.js` extension, because it must resolve after compilation. `enforced-by: typescript/eslint gspot/import-path-style`
- Use the `node:` protocol on built-in imports. `enforced-by: typescript/eslint gspot/import-path-style`
- Do not rely on CommonJS and ES module interop working by accident. A file declares which it is,
  through the package type field or its extension. `enforced-by: typescript/eslint gspot/import-path-style`

## Globals and APIs

- Use APIs the declared Node version supports. The version is a fact about the project, stated in
  one place, not repeated in prose. `enforced-by: typescript/eslint n/no-unsupported-features`
- `process`, `Buffer` and the Node built-ins are available. Browser globals are not. `enforced-by: typescript/eslint n/no-unsupported-features`
- Read configuration through one module that owns environment access. Do not read `process.env`
  from arbitrary files. `enforced-by: typescript/eslint gspot/env-access-owner`

## Processes

- A script that is invoked directly carries a shebang and is executable. `enforced-by: typescript/eslint n/hashbang`
- Handle the signals the process is expected to receive, and release what it holds on exit. `enforced-by: typescript/eslint n/hashbang`
