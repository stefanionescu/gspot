---
layer: language
configuration: javascript
title: JavaScript
---

# JavaScript

## Core JavaScript philosophy

JavaScript makes its contract obvious. Build code turns config, content, and assets into deterministic output. Browser code adds small, progressive behavior to static HTML. Quality tooling checks the repo; it must not leak into production code.

Prefer plain values, small functions, explicit module boundaries, and readable control flow. Avoid clever runtime indirection, implicit globals, hidden side-effects, and abstractions that obscure the source of generated HTML.

If enforcement differs from this document, fix the enforcement or update the rule explicitly. Do not use drift as a reason to ignore the standard.

## Runtime standard

Server-side scripts run on the runtime and version the project declares. Browser code targets the browsers and build pipeline the project declares. Unbundled scripts loaded from static HTML must run without build-time transforms. Cloudflare middleware must stay compatible with the Workers runtime.

Rules:

- Use APIs available in the declared runtime.
- Do not rely on implicit globals. A file states its runtime, and only that runtime's globals are available.
- Read `process.env` in one configuration owner module. Nowhere else.
- Keep package versions exact; do not use range prefixes.
- Do not add a build step that requires a runtime outside the project's declared tooling without updating `mise.toml`, package policy, and documentation.

## Source files

Keep JavaScript files as normal UTF-8 source files with imports before implementation. Do not put imports after statements.

Rules:

- Use `const` by default.
- Use `let` only for reassignment.
- Never use `var` in new module code. Existing browser scripts may keep `var` when broad browser compatibility is intentional.
- Keep side-effect imports rare and explicit.
- Do not add file-level history comments, stale path references, or generated examples that are not part of working code.
- Prefer direct, searchable code over clever indirection.

If a module needs a short explanation, document the purpose, not how it changed.

## Modules, imports, and exports

Follow the owner boundary of the file you are editing.

Rules:

- Keep existing CommonJS modules CommonJS unless there is a scoped migration plan for the whole owner area.
- Prefer named imports and named exports for module code.
- Avoid mutable exports such as `export let`.
- Avoid default exports in app modules.
- Allow default exports for ecosystem-owned config files when the tool expects them.
- Do not create container classes or exported objects only to simulate a namespace.
- No re-exports in application source: no `export { x } from`, no `export * from`, no index
  barrels. Import the module that declares the symbol.
- Private declarations first, public last: every non-exported function, constant, and class
  precedes the first `export`.
- Keep JSDoc `@typedef` declarations beside their behavioral owner. Share them through type imports when another owner needs the contract.

Production code must not import quality tooling. Browser scripts must not import server-only code, config modules, middleware, or quality tooling.

## Values, literals, and coercion

Prefer explicit, unsurprising values.

Rules:

- Use `const` for values that do not change.
- Use frozen objects or plain constant objects for fixed value sets.
- Avoid implicit coercion for user input, environment values, request values, analytics settings, and build placeholders.
- Use explicit parsing for strings, numbers, booleans, dates, and URLs that cross a runtime boundary.
- Do not use truthiness checks when `0`, `''`, `false`, `null`, and `undefined` have different meanings.
- Keep regular expressions close to the policy they enforce and name them by the contract they validate.

## Objects, arrays, and destructuring

Keep object and array handling readable.

Rules:

- Use object literals for grouped data instead of positional parameter lists.
- Use destructuring when it clarifies the fields being used.
- Avoid mutation of input objects unless the function name and owner contract make mutation explicit.
- Prefer array methods when they improve clarity, but do not contort simple loops only to satisfy style preference.
- Narrow indexed reads before use when the value may be absent.

## Functions and parameters

Make function contracts obvious from names, parameters, and call sites.

Rules:

- Keep functions small and focused.
- Avoid parameter reassignment.
- Prefer options objects once a function takes several related values.
- Do not use optional parameters to avoid fixing a caller contract.
- Keep callback nesting shallow.
- Use early returns to keep error and missing-state handling readable.
- Avoid pass-through functions that only rename another call.

For public quality-tool functions, export the function directly and test or lint it through the owning runner rather than creating a wrapper module.

## Classes

Use classes only when instance identity or encapsulated state is real.

Rules:

- Do not create static container classes for namespacing.
- Prefer plain functions and objects for stateless behavior.
- Keep constructors simple.
- Do not use decorators.
- Do not add inheritance unless it represents a real runtime relationship.

If a class has no meaningful instance state, it is a module with named exports.

## Null, undefined, and optional values

Handle absent values deliberately.

Rules:

- Use `null` only when it is a meaningful domain value.
- Let missing object properties be `undefined`.
- Use `??` when only `null` and `undefined` trigger a fallback.
- Do not use `||` as a fallback when empty strings, zero, or false are valid.
- Check DOM lookups and optional browser APIs before use.
- Keep fallback values local and explicit.

## Runtime boundaries

Runtime boundaries must be validated or escaped before use.

Boundary examples:

- Markdown content rendered into legal pages.
- Placeholder replacement into HTML templates.
- URLs and public paths.
- Cloudflare request data.
- Environment variables.
- Analytics configuration.
- File paths supplied to quality tooling.

Rules:

- Escape HTML attributes and text through the local helper APIs.
- Normalize public paths before writing generated assets.
- Validate URLs before using them in generated markup.
- Do not log sensitive environment values.
- Do not return stack traces from edge middleware.
- Avoid dynamic `require` or dynamic `import` for repo-owned modules.
- Prefer `spawn`/`execFile` with argument arrays over shell command strings.

## Errors and async code

Async code makes failure modes visible.

Rules:

- Await promises that must complete before the next step.
- Handle expected failures at the owner boundary.
- Do not catch and ignore errors unless the ignored failure is explicitly safe and documented by the local contract.
- Preserve useful error messages in build tooling.
- Do not expose internal stack traces in HTTP responses.
- Clean up spawned servers or child processes in `finally` blocks.

## Comments and JSDoc

Use comments to explain non-obvious intent, constraints, or policy. Do not describe syntax that is already clear from the code.

Rules:

- Prefer short comments near the surprising decision.
- Do not add history comments.
- Do not leave commented-out code.
- A `TODO` is `TODO(<issue-url-or-YYYY-MM-DD>): <sentence>`; the owner is an issue link or an expiry date, never a person.
- Keep every lint disable comment justified with a nearby reason on the same line or the line above.
- JSDoc is useful for exported quality helpers, but routine private functions do not need boilerplate comments.

## Generated code

Generated output belongs in `dist/` or documented artifact directories, not in source roots.

Rules:

- Do not edit generated files as the source of truth.
- Keep generated asset names deterministic and content-hashed where the build pipeline expects hashes.
- Keep generated analytics config in a shared asset, not inline in templates.
- Keep JSON-LD generation explicit and escaped.
