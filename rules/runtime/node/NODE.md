---
layer: runtime
preset: javascript
title: Node
---

# Node

Rules that hold because the code runs on Node, whatever language it is written in.

## Module resolution

- Compiled TypeScript uses `NodeNext` module semantics. An internal import that points at
  TypeScript source carries a runtime `.js` extension, because it must resolve after compilation.
- Use the `node:` protocol on built-in imports.
- Do not rely on CommonJS and ES module interop working by accident. A file declares which it is,
  through the package type field or its extension.

## Globals and APIs

- Use APIs the declared Node version supports. The version is a fact about the project, stated in
  one place, not repeated in prose.
- `process`, `Buffer`, and Node built-ins are available. Node also provides version-specific
  [web-compatible globals](https://nodejs.org/api/globals.html), including `fetch`.
  DOM globals such as `window` and `document` require a browser environment.
- Read configuration through one module that owns environment access. Do not read `process.env`
  from arbitrary files.

## Processes

- A script that is invoked directly carries a shebang and is executable.
- Handle the signals the process is expected to receive, and release what it holds on exit.
