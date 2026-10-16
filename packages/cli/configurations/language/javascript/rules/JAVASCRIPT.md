# JavaScript

Read this rule when you change JavaScript or TypeScript code.

Keep development tooling out of production runtime imports. Keep inputs and side effects explicit. Validate the
values that the security rules list where the program receives them, before you send them to a database or another
service.

## Runtime

Use APIs supported by the runtime and version the project declares. Browser code targets the
browsers and build pipeline the project declares. Before adding a build step that needs another
runtime, update the declared runtime configuration and documentation.

## Modules

Keep existing CommonJS modules CommonJS unless the task includes migrating them. Keep side-effect
imports rare and explain their required effect. Browser code imports no server implementation.

### Module conventions

<!-- level: all -->

- Prefer named imports and named exports.
- Avoid mutable exports and default exports in application modules. Preserve a default export
  when a tool or framework requires it.
- Do not create container classes or exported objects only to simulate a namespace.
- Keep JSDoc `@typedef` declarations in the module that uses them, following the project's folder
  arrangement. Share them through type imports when another module needs the contract.
- Import the module that declares a symbol. A library can explicitly select index-only re-exports.
- Name a namespace import after the imported file or package, such as `fileOne` for `file-one.js`.
- Keep the exported name of a named import. Add an alias only when two imports collide, and name the alias for its
  domain, such as `DomesticatedCat`.
- Use a default import only for a package that requires one, and name it for what the package exports.

## Values

- Use frozen objects or plain constant objects for fixed value sets.
- Avoid truthiness checks when `0`, `''`, `false`, `null`, and `undefined` mean different things.
- Use `null` for a meaningful domain value and `undefined` for missing object properties.
- Use `??` when only `null` and `undefined` require a fallback. Do not use `||` when an empty
  string, zero, or false has a valid meaning.
- Name regular expressions after the value or contract they validate.
- Check indexed reads when a value can have no result.

## Objects and functions

Use object literals for grouped arguments and destructure fields when it makes their use clearer.
A function that mutates its input names and documents that effect.

### Function conventions

<!-- level: all -->

- Do not add optional parameters to hide a broken caller contract.
- Use early returns when they make missing-value and error handling clearer.
- Keep constructors small. Add inheritance only for a real runtime relationship.
- Use decorators only where a framework requires them.

## Asynchronous work

Await a promise that must finish before the next step. Release child processes, subscriptions,
and other resources in `finally` or the API's cleanup mechanism.

## Workspaces

<!-- level: all -->

- Each workspace package builds itself. Its build file lives in the package and imports only that package's files.
- Code outside a package uses its public entry points and its `package.json`, never its source files. Tests may read source files.
- Declare each dependency in the workspace package that imports it, not in the root `package.json`.
- Pass a value from one package to another through a declared setting or the package's public API, not through a
  file that a build writes.
