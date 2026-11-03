# Node

Read this rule when code runs on Node.

## Module resolution

- Unbundled compiled TypeScript follows Node module resolution. Runtime imports must resolve in the compiled output; a
  `.js` import can name its TypeScript source.
- Preserve the declared bundler or direct TypeScript execution contract when the project uses one.
- Do not rely on CommonJS and ES module interop working by accident. A file declares its module format, through the
  package type field or its extension.

## Global variables

- Use `process`, `Buffer`, and Node built-ins. Node also provides version-specific
  [web-compatible globals](https://nodejs.org/api/globals.html), including `fetch`. DOM globals such as `window` and
  `document` require a browser environment.

## Processes

- Give a directly invoked script a shebang and executable permissions.
