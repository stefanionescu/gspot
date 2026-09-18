---
layer: language
preset: javascript
title: JavaScript
---

# JavaScript

## Core JavaScript philosophy

JavaScript makes its contract obvious. Build code turns config, content, and assets into deterministic output. Browser code adds small, progressive behavior to static HTML. Quality tooling checks the repo; it must not leak into production code.

Prefer plain values, small functions, explicit module boundaries, and readable control flow. Avoid clever runtime indirection, implicit globals, hidden side-effects, and abstractions that obscure the source of generated HTML. `enforced-by: integrity/generated-fresh`

If enforcement differs from this document, fix the enforcement or update the rule explicitly. Do not use drift as a reason to ignore the standard.

## Runtime standard

Server-side scripts run on the runtime and version the project declares. Browser scripts must work as plain scripts loaded from static HTML. Cloudflare middleware must stay compatible with the Workers runtime.

Rules:

- Use APIs available in the declared runtime. `enforced-by: javascript/eslint n/no-unsupported-features`
- Do not rely on implicit globals. A file states its runtime, and only that runtime's globals are available. `enforced-by: javascript/eslint n/no-unsupported-features`
- Read `process.env` in one configuration owner module. Nowhere else. `enforced-by: javascript/eslint gspot/env-access-owner`
- Keep package versions exact; do not use range prefixes. `enforced-by: integrity/manifest-policy`
- Do not add a build step that requires a runtime outside the project's declared tooling without updating `mise.toml`, package policy, and documentation. `enforced-by: javascript/eslint n/no-unsupported-features`

## Source files

Keep JavaScript files as normal UTF-8 source files with imports before implementation. Do not put imports after statements. `enforced-by: javascript/eslint import-x/first`

Rules:

- Use `const` by default. `enforced-by: javascript/eslint prefer-const`
- Use `let` only for reassignment. `enforced-by: javascript/eslint prefer-const`
- Never use `var` in new module code. Existing browser scripts may keep `var` when broad browser compatibility is intentional. `enforced-by: javascript/eslint prefer-const`
- Keep side-effect imports rare and explicit. `enforced-by: javascript/eslint import-x/first`
- Do not add file-level history comments, stale path references, or generated examples that are not part of working code. `enforced-by: javascript/eslint sonarjs/no-commented-code`
- Prefer direct, searchable code over clever indirection. `unenforced`

If a module needs a short explanation, document the purpose, not how it changed.

## Modules, imports, and exports

Follow the owner boundary of the file you are editing. `unenforced`

Rules:

- Keep existing CommonJS modules CommonJS unless there is a scoped migration plan for the whole owner area. `unenforced`
- Prefer named imports and named exports for module code. `enforced-by: javascript/eslint import-x/no-default-export`
- Avoid mutable exports such as `export let`. `enforced-by: javascript/eslint import-x/no-default-export`
- Avoid default exports in app modules. `enforced-by: javascript/eslint import-x/no-default-export`
- Allow default exports for ecosystem-owned config files when the tool expects them. `enforced-by: javascript/eslint import-x/no-default-export`
- Do not create container classes or exported objects only to simulate a namespace. `enforced-by: javascript/eslint @typescript-eslint/no-namespace`
- No re-exports in application source: no `export { x } from`, no `export * from`, no index
  barrels. Import the module that declares the symbol. `enforced-by: javascript/eslint gspot/no-reexports`
- Private declarations first, public last: every non-exported function, constant, and class
  precedes the first `export`. `enforced-by: javascript/eslint gspot/private-before-public`
- JSDoc `@typedef` declarations live in `types/*.js`; source files reference them with
  `@import` or `import('./types/orders.js').Order`. No `@typedef` outside `types/`. `enforced-by: javascript/eslint gspot/types-placement`

Production code must not import quality tooling. Browser scripts must not import server-only code, config modules, middleware, or quality tooling.

## Values, literals, and coercion

Prefer explicit, unsurprising values. `unenforced`

Rules:

- Use `const` for values that do not change. `enforced-by: javascript/eslint prefer-const`
- Use frozen objects or plain constant objects for fixed value sets. `enforced-by: javascript/eslint @typescript-eslint/prefer-as-const`
- Avoid implicit coercion for user input, environment values, request values, analytics settings, and build placeholders. `enforced-by: javascript/eslint unicorn/prefer-number-properties`
- Use explicit parsing for strings, numbers, booleans, dates, and URLs that cross a runtime boundary. `enforced-by: javascript/eslint unicorn/prefer-number-properties`
- Do not use truthiness checks when `0`, `''`, `false`, `null`, and `undefined` have different meanings. `enforced-by: javascript/eslint @typescript-eslint/strict-boolean-expressions`
- Keep regular expressions close to the policy they enforce and name them by the contract they validate. `enforced-by: security/semgrep`

## Objects, arrays, and destructuring

Keep object and array handling readable. `unenforced`

Rules:

- Use object literals for grouped data instead of positional parameter lists. `unenforced`
- Use destructuring when it clarifies the fields being used. `unenforced`
- Avoid mutation of input objects unless the function name and owner contract make mutation explicit. `unenforced`
- Prefer array methods when they improve clarity, but do not contort simple loops only to satisfy style preference. `unenforced`
- Narrow indexed reads before use when the value may be absent. `enforced-by: javascript/eslint gspot/no-reexports`

## Functions and parameters

Make function contracts obvious from names, parameters, and call sites. `unenforced`

Rules:

- Keep functions small and focused. `enforced-by: structure/call-through`
- Avoid parameter reassignment. `enforced-by: javascript/eslint no-param-reassign`
- Prefer options objects once a function takes several related values. `unenforced`
- Do not use optional parameters to avoid fixing a caller contract. `enforced-by: javascript/eslint @typescript-eslint/no-redundant-type-constituents`
- Keep callback nesting shallow. `enforced-by: structure/call-through`
- Use early returns to keep error and missing-state handling readable. `enforced-by: structure/call-through`
- Avoid pass-through functions that only rename another call. `enforced-by: structure/call-through`

For public quality-tool functions, export the function directly and test or lint it through the owning runner rather than creating a wrapper module.

## Classes

Use classes only when instance identity or encapsulated state is real. `enforced-by: javascript/eslint unicorn/no-static-only-class`

Rules:

- Do not create static container classes for namespacing. `enforced-by: javascript/eslint @typescript-eslint/no-namespace`
- Prefer plain functions and objects for stateless behavior. `unenforced`
- Keep constructors simple. `enforced-by: javascript/eslint unicorn/no-static-only-class`
- Do not use decorators. `enforced-by: javascript/eslint no-restricted-syntax`
- Do not add inheritance unless it represents a real runtime relationship. `enforced-by: javascript/eslint unicorn/no-static-only-class`

If a class has no meaningful instance state, it is a module with named exports.

## Null, undefined, and optional values

Handle absent values deliberately. `unenforced`

Rules:

- Use `null` only when it is a meaningful domain value. `unenforced`
- Let missing object properties be `undefined`. `unenforced`
- Use `??` when only `null` and `undefined` trigger a fallback. `enforced-by: javascript/eslint @typescript-eslint/strict-boolean-expressions`
- Do not use `||` as a fallback when empty strings, zero, or false are valid. `enforced-by: javascript/eslint @typescript-eslint/strict-boolean-expressions`
- Check DOM lookups and optional browser APIs before use. `unenforced`
- Keep fallback values local and explicit. `unenforced`

## Runtime boundaries

Runtime boundaries must be validated or escaped before use.

Boundary examples:

- Markdown content rendered into legal pages. `unenforced`
- Placeholder replacement into HTML templates. `unenforced`
- URLs and public paths. `unenforced`
- Cloudflare request data. `unenforced`
- Environment variables. `enforced-by: security/semgrep`
- Analytics configuration. `enforced-by: static-site/build-reproducible`
- File paths supplied to quality tooling. `enforced-by: javascript/eslint boundaries/element-types`

Rules:

- Escape HTML attributes and text through the local helper APIs. `enforced-by: security/semgrep`
- Normalize public paths before writing generated assets. `enforced-by: integrity/generated-fresh`
- Validate URLs before using them in generated markup. `enforced-by: security/semgrep`
- Do not log sensitive environment values. `enforced-by: security/semgrep`
- Do not return stack traces from edge middleware. `enforced-by: security/semgrep`
- Avoid dynamic `require` or dynamic `import` for repo-owned modules. `enforced-by: security/semgrep`
- Prefer `spawn`/`execFile` with argument arrays over shell command strings. `enforced-by: security/semgrep`

## Errors and async code

Async code makes failure modes visible.

Rules:

- Await promises that must complete before the next step. `unenforced`
- Handle expected failures at the owner boundary. `unenforced`
- Do not catch and ignore errors unless the ignored failure is explicitly safe and documented by the local contract. `unenforced`
- Preserve useful error messages in build tooling. `unenforced`
- Do not expose internal stack traces in HTTP responses. `enforced-by: security/semgrep`
- Clean up spawned servers or child processes in `finally` blocks. `enforced-by: javascript/eslint @typescript-eslint/no-floating-promises`

## Comments and JSDoc

Use comments to explain non-obvious intent, constraints, or policy. Do not describe syntax that is already clear from the code. `unenforced`

Rules:

- Prefer short comments near the surprising decision. `unenforced`
- Do not add history comments. `enforced-by: javascript/eslint sonarjs/no-commented-code`
- Do not leave commented-out code. `enforced-by: javascript/eslint sonarjs/no-commented-code`
- A `TODO` is `TODO(<issue-url-or-YYYY-MM-DD>): <sentence>`; the owner is an issue link or an expiry date, never a person. `enforced-by: javascript/eslint unicorn/expiring-todo-comments`
- Keep every lint disable comment justified with a nearby reason on the same line or the line above. `enforced-by: integrity/suppressions`
- JSDoc is useful for exported quality helpers, but routine private functions do not need boilerplate comments. `enforced-by: javascript/eslint jsdoc/require-jsdoc`

## Generated code

Generated output belongs in `dist/` or documented artifact directories, not in source roots.

Rules:

- Do not edit generated files as the source of truth. `enforced-by: integrity/generated-fresh`
- Keep generated asset names deterministic and content-hashed where the build pipeline expects hashes. `enforced-by: integrity/generated-fresh`
- Keep generated analytics config in a shared asset, not inline in templates. `enforced-by: integrity/generated-fresh`
- Keep JSON-LD generation explicit and escaped. `enforced-by: static-site/build-reproducible`
