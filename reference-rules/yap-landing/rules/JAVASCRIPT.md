# Working With JavaScript

These rules apply to JavaScript in this static landing repo: build scripts, configuration modules, Cloudflare Functions middleware, browser assets, local development server code, and quality tooling.

## Contents

- [Core JavaScript Philosophy](#core-javascript-philosophy)
- [Source Material Decisions](#source-material-decisions)
- [Scope](#scope)
- [Runtime Standard](#runtime-standard)
- [Source Files](#source-files)
- [Modules, Imports, and Exports](#modules-imports-and-exports)
- [Static Site Boundaries](#static-site-boundaries)
- [Templates and Browser Assets](#templates-and-browser-assets)
- [Naming](#naming)
- [Values, Literals, and Coercion](#values-literals-and-coercion)
- [Objects, Arrays, and Destructuring](#objects-arrays-and-destructuring)
- [Functions and Parameters](#functions-and-parameters)
- [Classes](#classes)
- [Null, Undefined, and Optional Values](#null-undefined-and-optional-values)
- [Runtime Boundaries](#runtime-boundaries)
- [Errors and Async Code](#errors-and-async-code)
- [Comments and JSDoc](#comments-and-jsdoc)
- [Generated Code](#generated-code)
- [Verification Commands](#verification-commands)

## Core JavaScript Philosophy

JavaScript in this repo should make the static-site contract obvious. Build code turns config, content, and assets into deterministic output. Browser code adds small, progressive behavior to static HTML. Quality tooling checks the repo; it must not leak into production code.

Prefer plain values, small functions, explicit module boundaries, and readable control flow. Avoid clever runtime indirection, implicit globals, hidden side-effects, and abstractions that obscure the source of generated HTML.

If enforcement differs from this document, fix the enforcement or update the rule explicitly. Do not use drift as a reason to ignore the standard.

## Source Material Decisions

These rules adapt the following source material:

- Google JavaScript style principles for modules, constants, and runtime checks.
- The source repo quality tooling conventions for ESLint, shell, security, and repository integrity policy.

| Topic              | Adopted Rule                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting         | Let Prettier and ESLint own formatting. Do not copy external formatting rules manually.                                                                                   |
| Modules            | Use CommonJS only for existing Node build/server code that already uses it. Use ES modules for quality tooling and new module-based quality code.                         |
| Browser scripts    | Keep browser files as standalone assets under `shared/`. Do not put executable inline scripts in templates.                                                               |
| Exports            | Prefer named exports for module code. Allow default exports only where ecosystem config files require them.                                                               |
| Naming             | Use `rules/NAMING.md` for identifiers, files, modules, and role names.                                                                                                    |
| Runtime boundaries | Treat config, markdown content, request data, generated paths, and analytics settings as runtime boundaries that require explicit escaping, validation, or normalization. |

Project-specific rules are authoritative when they deliberately choose a stricter or clearer standard.

## Scope

Apply this guide to:

- `server.js`
- `build/**/*.js`
- `config/**/*.js`
- `pages/**/*.js`
- `functions/**/*.js`
- `shared/**/*.js`
- `quality/**/*.js`, `quality/**/*.mjs`, and `quality/**/*.cjs`

Do not add source directories that are not part of this product layout. The landing repo's owned layout is `assets/`, `build/`, `config/`, `content/`, `functions/`, `pages/`, `shared/`, `quality/`, and `rules/`.

## Runtime Standard

Node scripts in this repo run on Node 22 as declared by `mise.toml` and `package.json`. Browser scripts must work as plain scripts loaded from static HTML. Cloudflare middleware must stay compatible with the Workers runtime.

Rules:

- Use APIs available in the declared runtime.
- Do not rely on implicit globals except the browser globals explicitly allowed by ESLint for `shared/`.
- Keep package versions exact; do not use range prefixes.
- Do not add a build step that requires a runtime outside the repo's declared tooling without updating `mise.toml`, package policy, and documentation.

## Source Files

Keep JavaScript files as normal UTF-8 source files with imports before implementation. Do not put imports after statements.

Rules:

- Use `const` by default.
- Use `let` only for reassignment.
- Never use `var` in new module code. Existing browser scripts may keep `var` when broad browser compatibility is intentional.
- Keep side-effect imports rare and explicit.
- Do not add file-level history comments, stale path references, or generated examples that are not part of working code.
- Prefer direct, searchable code over clever indirection.

If a module needs a short explanation, document the purpose, not how it changed.

## Modules, Imports, and Exports

Follow the owner boundary of the file you are editing.

Rules:

- Keep existing CommonJS build/server modules CommonJS unless there is a scoped migration plan for the whole owner area.
- Use ES modules for `quality/` code because `quality/package.json` owns module aliases for `#config`, `#site`, `#shared`, and `#repository`.
- Prefer named imports and named exports for module code.
- Avoid mutable exports such as `export let`.
- Avoid default exports in app modules.
- Allow default exports for ecosystem-owned config files when the tool expects them.
- Do not create container classes or exported objects only to simulate a namespace.
- Avoid root mega-barrels. Keep re-exports small and intentional.

Production site code must not import quality tooling. Browser scripts must not import Node-only code, config modules, middleware, or quality tooling.

## Static Site Boundaries

The repo has clear ownership boundaries:

- `config/` contains global site settings. Keep it data-only.
- `pages/` contains page-owned templates and route metadata.
- `build/` reads config/content/pages/assets and writes `dist/`.
- `functions/` contains edge middleware only.
- `shared/` contains static browser assets copied to `dist/shared/`.
- `quality/` contains linting, security, and repository policy tooling.

Rules:

- Do not import from `build/`, `functions/`, `shared/`, or `quality/` inside `config/`.
- Do not import quality code from production site code.
- Do not read or mutate production files from browser assets.
- Do not put generated output under source roots.
- Keep asset paths normalized and rooted where the build pipeline expects them.

## Templates and Browser Assets

Templates under `pages/` and root HTML files should stay declarative.

Rules:

- Do not add executable inline scripts to templates.
- JSON-LD is allowed with `<script type="application/ld+json">` because it is data, not executable app logic.
- Do not use `document.write`.
- Do not use inline event handler attributes.
- Do not use `javascript:` URLs.
- Put browser behavior in `shared/*.js`.
- Prefer safe DOM mutation: `textContent`, attributes, class changes, and created nodes.
- Avoid `innerHTML`, `outerHTML`, and `insertAdjacentHTML` unless a reviewed static, trusted markup path is the real contract.
- Keep visible copy in config/content/pages as appropriate; do not hide user copy in build-script template literals.

Browser scripts should be defensive at DOM boundaries without swallowing real programming errors. Check that required elements exist before binding behavior.

## Naming

JavaScript naming rules live in [`NAMING.md`](NAMING.md). Follow that file for identifier casing, filename casing, module names, constants, boundary names, and unused parameters.

The quality tooling under `quality/repository/naming` is authoritative for automated naming and banned-term policy.

## Values, Literals, and Coercion

Prefer explicit, unsurprising values.

Rules:

- Use `const` for values that do not change.
- Use frozen objects or plain constant objects for fixed value sets.
- Avoid implicit coercion for user input, environment values, request values, analytics settings, and build placeholders.
- Use explicit parsing for strings, numbers, booleans, dates, and URLs that cross a runtime boundary.
- Do not use truthiness checks when `0`, `''`, `false`, `null`, and `undefined` have different meanings.
- Keep regular expressions close to the policy they enforce and name them by the contract they validate.

## Objects, Arrays, and Destructuring

Keep object and array handling readable.

Rules:

- Use object literals for grouped data instead of positional parameter lists.
- Use destructuring when it clarifies the fields being used.
- Follow [`NAMING.md`](NAMING.md) for destructured local names.
- Avoid mutation of input objects unless the function name and owner contract make mutation explicit.
- Prefer array methods when they improve clarity, but do not contort simple loops only to satisfy style preference.
- Narrow indexed reads before use when the value may be absent.

## Functions and Parameters

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

If a class has no meaningful instance state, it probably should be a module with named exports.

## Null, Undefined, and Optional Values

Handle absent values deliberately.

Rules:

- Use `null` only when it is a meaningful domain value.
- Let missing object properties be `undefined`.
- Use `??` when only `null` and `undefined` should trigger a fallback.
- Do not use `||` as a fallback when empty strings, zero, or false are valid.
- Check DOM lookups and optional browser APIs before use.
- Keep fallback values local and explicit.

## Runtime Boundaries

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

## Errors and Async Code

Async code should make failure modes visible.

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
- Keep shellcheck and lint disable comments justified with a nearby reason and ticket marker when policy requires it.
- JSDoc is useful for exported quality helpers, but routine private functions do not need boilerplate comments.

## Generated Code

Generated output belongs in `dist/` or documented artifact directories, not in source roots.

Rules:

- Do not edit generated files as the source of truth.
- Keep generated asset names deterministic and content-hashed where the build pipeline expects hashes.
- Keep generated analytics config in a shared asset, not inline in templates.
- Keep JSON-LD generation explicit and escaped.

## Verification Commands

Use the repo-owned entrypoints:

```sh
bun run format:check
mise run format:check
bun run lint
mise run lint
mise run lint:quality
mise run lint:shell
bun run build
```

Also run the stale-path sanity checks from the current migration task when changing quality-tooling paths.
