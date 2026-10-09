---
title: Node
---

# Node

Rules that hold because the code runs on Node, whatever language it is written in.

## Module resolution

- Unbundled compiled TypeScript follows Node module resolution. Runtime imports must resolve
  in the emitted output; a `.js` import can identify the corresponding TypeScript source.
- Preserve the declared bundler or direct TypeScript execution contract when the project uses one.
- Do not rely on CommonJS and ES module interop working by accident. A file declares which it is,
  through the package type field or its extension.

## Global variables

- `process`, `Buffer`, and Node built-ins are available. Node also provides version-specific
  [web-compatible globals](https://nodejs.org/api/globals.html), including `fetch`.
  DOM globals such as `window` and `document` require a browser environment.

## Processes

- A script that is invoked directly carries a shebang and is executable.
