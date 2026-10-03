---
title: Node
---

# Node

Rules that hold because the code runs on Node, whatever language it is written in.

## Module resolution

- Unbundled compiled TypeScript follows Node module resolution. Runtime imports must resolve
  in the emitted output; a `.js` import can identify the corresponding TypeScript source.
- Preserve the declared bundler or direct TypeScript execution contract when the project uses one.
- Use the `node:` protocol on built-in imports.
- Do not rely on CommonJS and ES module interop working by accident. A file declares which it is,
  through the package type field or its extension.

## Globals and APIs

- Use APIs the declared Node version supports. The version is a fact about the project, stated in
  one place, not repeated in prose.
- `process`, `Buffer`, and Node built-ins are available. Node also provides version-specific
  [web-compatible globals](https://nodejs.org/api/globals.html), including `fetch`.
  DOM globals such as `window` and `document` require a browser environment.

## Processes

- A script that is invoked directly carries a shebang and is executable.
- Handle the signals the process is expected to receive, and release what it holds on exit.
