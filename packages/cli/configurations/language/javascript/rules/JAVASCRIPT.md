---
title: JavaScript
---

# JavaScript

Keep development tooling out of production runtime imports. Keep inputs and side effects explicit.
Validate values received from users, files, environment variables, or external services.
If a check and this file disagree, tell the user.

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
- Keep JSDoc `@typedef` declarations with their behavioral owner, following the project's folder
  arrangement. Share them through type imports when another module needs the contract.
- Import the module that declares a symbol. A library can explicitly select index-only re-exports.

## Values

- Use frozen objects or plain constant objects for fixed value sets.
- Parse strings, numbers, booleans, dates, and URLs received from outside the program explicitly.
- Avoid truthiness checks when `0`, `''`, `false`, `null`, and `undefined` mean different things.
- Use `null` for a meaningful domain value and `undefined` for missing object properties.
- Use `??` when only `null` and `undefined` require a fallback. Do not use `||` when an empty
  string, zero, or false is valid.
- Name regular expressions after the value or contract they validate.
- Check indexed reads when a value may be absent.

## Objects and functions

Use object literals for grouped arguments and destructure fields when it makes their use clearer.
A function that mutates its input names and documents that effect.

### Function conventions

<!-- level: all -->

- Use an options object for several related arguments.
- Do not add optional parameters to hide a broken caller contract.
- Use early returns when they make missing-value and error handling clearer.
- Keep constructors simple. Add inheritance only for a real runtime relationship.
- Use decorators only where a framework requires them.

## Asynchronous work

Await a promise that must finish before the next step. Release child processes, subscriptions,
and other resources in `finally` or the API's cleanup mechanism.
