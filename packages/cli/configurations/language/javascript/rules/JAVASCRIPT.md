# JavaScript

Read this rule when you change JavaScript or TypeScript code.

Keep development tools out of production runtime imports. Keep inputs and side effects explicit.

## Runtime

Use APIs supported by the runtime and version the project declares. Browser code follows the declared targets and build
pipeline. Before adding a build step that needs another runtime, declare it in the configuration and documentation.

## Modules

Do not convert existing CommonJS modules unless the task includes migrating them. Keep side-effect imports rare and
explain what each one does. Browser code imports no server implementation.

### Module conventions

<!-- level: all -->

- Prefer named imports and exports.
- Avoid mutable and default exports in application modules. Preserve a default export when a tool or framework requires
  it.
- Do not create container classes or exported objects only to simulate a namespace.
- Keep JSDoc `@typedef` declarations in the module that uses them, following the project's folder arrangement. Share
  them through type imports when another module needs the contract.
- Import the module that declares a symbol, never an index file.
- Export a symbol where you declare it. Do not re-export it, and do not export a constant that only renames another
  value. When a library publishes its API through an index file, ask the user to set `structure.reexports` to
  `index-only`.
- Do not add a file that only imports and re-exports other modules.
- Keep comments out of an import block. Put a file header above it.
- Keep each relative import inside its boundary folder: each second-level folder, such as `src/cart`, and each folder
  that `javascript.import_boundaries` lists. Import another boundary through its package name or path alias.
- Name a namespace import after its file or package, such as `fileOne` for `file-one.js`.
- Keep the exported name of an import. Add an alias only when two imports collide, and name it for its domain, such as
  `DomesticatedCat`.
- Use a default import only for a package that requires one, and name it for the exported value.

## Values

- Use frozen or plain constant objects for fixed value sets.
- Use `null` for a meaningful domain value and `undefined` for missing object properties.
- Use `??` when only `null` and `undefined` require a fallback. Do not use `||` when an empty string, zero, or false has
  a valid meaning.
- Name regular expressions after the value or contract they validate.
- Check indexed reads when a value can have no result.

## Objects and functions

Use object literals for grouped arguments, and destructure fields when that makes the code clearer. A function that
mutates its input names and documents that effect.

Write a JSDoc comment as `/**` on its own line, then lines with no leading `*`, then `*/`.

### Function conventions

<!-- level: all -->

- Give every exported function and method a JSDoc comment: a summary that says more than the name, a blank line, and
  `@param <name> <what it is>` for each parameter, with no type in braces. Document a destructured parameter and each
  of its properties, such as `@param props` and `@param props.items`.
- Do not add optional parameters to hide a broken caller contract.
- Use early returns when they make missing-value and error handling clearer.
- Keep constructors small. Add inheritance only for a real runtime relationship.
- Use decorators only where a framework requires them.

## Asynchronous work

Await a promise that must finish before the next step. Release child processes, subscriptions, and other resources in
`finally` or the cleanup mechanism of the API.

Check `response.ok` before parsing a `fetch` response, and never turn a failed read into an empty result.

## Workspaces

<!-- level: all -->

- Each workspace package builds itself. Its build file lives in it and imports only its own files.
- Code outside a package uses its public entry points and its `package.json`, never its source files. Tests and
  documentation generators of the same repository may read source files.
- Declare each dependency in the workspace package that imports it, not in the root `package.json`.
- Pass a value between packages through a declared setting or a public API, never a file that a build writes.
