# Naming

This is the source of truth for naming in the Yap landing repo. It covers repo-owned JavaScript, Bash, HTML templates, content metadata, asset paths, quality tooling, and documentation examples.

Use this file together with the automated quality checks. This document explains how to choose names. The quality tooling enforces concrete policy such as allowed cases, banned terms, scope exceptions, and extractor behavior.

## Contents

- [Authority and Quality Enforcement](#authority-and-quality-enforcement)
- [General Naming Rules](#general-naming-rules)
- [Vocabulary and Role Words](#vocabulary-and-role-words)
- [Files and Directories](#files-and-directories)
- [Static Site Boundaries](#static-site-boundaries)
- [JavaScript](#javascript)
- [Bash](#bash)
- [HTML, CSS, and Content](#html-css-and-content)
- [Tests and Fixtures](#tests-and-fixtures)
- [Review Checklist](#review-checklist)

## Authority and Quality Enforcement

Naming decisions must satisfy both this guide and the quality tooling.

- Follow this file when choosing names for files, directories, functions, parameters, variables, constants, properties, route metadata, asset paths, shell functions, shell variables, documentation examples, and test names.
- Also follow the repository naming quality checks under `quality/repository/naming`.
- Treat quality failures as authoritative. If this guide and quality disagree, fix the disagreement instead of working around it locally.
- Do not duplicate quality implementation details here. Quality config owns exact banned terms, scope exceptions, and extractor behavior.
- Generated output may keep generator-owned names, but source code that creates generated output must follow this guide.

Bad:

```text
Use this name because it passes a local manual interpretation of the rules, even though it hides the real owner.
```

Good:

```text
Use the name that describes the owner and satisfies the current quality policy.
```

## General Naming Rules

Names should make ownership, purpose, and runtime boundary obvious.

Rules:

- Prefer concrete domain names over generic role names.
- Name values for what they represent, not where they came from.
- Name functions by the action they perform and the value they return.
- Name booleans as positive assertions: `isReady`, `hasConsent`, `canTrack`.
- Avoid vague names such as `data`, `item`, `thing`, `stuff`, `misc`, `helper`, `util`, and `manager`.
- Avoid names that describe code history, such as `oldTemplate`, `newConfig`, `legacyPath`, or `migratedPage`.
- Avoid abbreviations unless the abbreviation is the public contract or the common technical term.
- Keep names searchable. A reader should be able to find the owner with `rg`.
- Do not use prefixes or suffixes to hide weak ownership. Rename the concept instead.

Bad:

```js
const data = load();
const newConfig = build();
const helperValue = normalize(input);
```

Good:

```js
const legalPages = loadLegalPages();
const siteConfig = buildSiteConfig();
const publicPath = normalizePublicPath(input);
```

## Vocabulary and Role Words

Use role words only when the role is real in this repo.

Allowed role words:

| Word         | Use when                                                                 |
| ------------ | ------------------------------------------------------------------------ |
| `config`     | The value is global site or tool configuration.                          |
| `content`    | The value is authored copy or legal Markdown.                            |
| `template`   | The value is HTML with placeholders consumed by the build pipeline.      |
| `page`       | The value represents a generated route or page-owned metadata.           |
| `variant`    | The value represents a landing page variant.                             |
| `asset`      | The value is copied, hashed, or resolved into a public asset path.       |
| `publicPath` | The value is a browser-visible path beginning at the site root.          |
| `route`      | The value is a URL path or routing record.                               |
| `metadata`   | The value describes SEO, manifests, headers, or generated site metadata. |
| `policy`     | The value enforces a lint, security, or repository rule.                 |
| `runner`     | The value executes a tool or check.                                      |

Restricted role words:

- `helper`, `helpers`, `util`, `utils`, `misc`, and `stuff` are banned because they hide ownership.
- `manager`, `service`, `controller`, and `client` require a real boundary and should not be used for local glue code.
- `wrapper`, `compat`, `legacy`, and `forward` are forbidden for renamed behavior because this repo does not keep compatibility layers.

## Files and Directories

File and directory names should match their owner and use the case expected by the tooling.

Rules:

- Source JavaScript files use `kebab-case`.
- Bash files and task names use `kebab-case`.
- Root public files may keep platform-owned names such as `_headers`, `_redirects`, `robots.txt`, `favicon.ico`, and `site.webmanifest`.
- Directories use `kebab-case` unless the platform owns the exact name.
- One directory should represent one concept. Do not create parallel names for the same owner.
- Do not create a directory that contains one file unless the directory is an accepted boundary in quality policy.
- Page source belongs under `pages/`.
- Authored bodies belong under `content/`.
- Source media belongs under `assets/`.
- Browser JavaScript shared by generated pages belongs under `shared/`.
- Build and quality tooling stay under their owning top-level directories.

Bad:

```text
shared/device-class.js
build/steps/01_landing.js
config/pages/default.js
content/legal/privacy.md
quality/site/shell/
```

Good:

```text
shared/device.js
build/steps/landing.js
pages/landing/variants.json
content/privacy.md
quality/site/html/
quality/site/links/
```

## Static Site Boundaries

Top-level directories are source boundaries, not arbitrary buckets.

Rules:

- `assets/` contains source media and static assets.
- `build/` contains the generator and asset pipeline.
- `config/` contains global site settings only.
- `content/` contains authored content bodies.
- `functions/` contains Cloudflare Pages Functions middleware.
- `pages/` contains page-owned templates, route metadata, and variants.
- `quality/` contains linting, security, and repository policy tooling.
- `shared/` contains browser JavaScript copied to `dist/shared`.
- `dist/` is generated output and must not own source naming decisions.
- Do not name new folders after implementation language when the folder has a product owner.

Route names:

- Public routes use lowercase path segments.
- Directory routes end with `index.html` in generated output.
- Legal pages use route names that match their public path and content body.
- Landing variants use short names that identify the audience or campaign.

## JavaScript

JavaScript in this repo appears in build scripts, config modules, Cloudflare middleware, browser assets, server code, and quality tooling.

### JavaScript Case Rules

Rules:

- Functions, parameters, mutable variables, and normal constants use `lowerCamelCase`.
- Classes use `PascalCase` only when instance identity is real.
- Static constant properties and environment-owned names may use `UPPER_SNAKE_CASE`.
- Object properties use `lowerCamelCase` unless they mirror an external contract.
- Unused parameters start with `_`.
- Do not use leading underscores for privacy. Keep private values local to the module.
- Do not use all-caps variables for ordinary local constants.

Bad:

```js
const PAGE_DATA = loadPage();
function Build_HTML(page_data) {}
const _privateValue = true;
```

Good:

```js
const pageData = loadPage();
function buildHtml(pageData) {}
const isEnabled = true;
```

### JavaScript Files

Rules:

- Name module files for the concept they own.
- Prefer nouns for data/config modules and verbs for small executable scripts only when the file is command-like.
- Avoid generic file names such as `helpers.js`, `utils.js`, `index.js`, `common.js`, and `misc.js`.
- Keep aliases, template replacement, path normalization, static asset copying, and route building in the owner already established by the repo.

Bad:

```text
build/lib/utils.js
shared/helpers.js
pages/landing/page-data.js
quality/repository/misc/index.js
```

Good:

```text
build/lib/assets/pipeline.js
shared/background.js
pages/landing/variants.json
quality/repository/integrity/stale-paths.js
```

### JavaScript Functions

Rules:

- Use verbs for functions that perform work: `build`, `copy`, `render`, `resolve`, `validate`, `write`.
- Use nouns for values returned by functions only when the function name still reads as an action, such as `readPackageName`.
- Use `is`, `has`, `can`, or `should` for boolean-returning functions.
- Name boundary functions by the boundary they own: `normalizePublicPath`, `renderTemplate`, `renderLegalMarkdown`.
- Avoid pass-through names that only restate another function.

Bad:

```js
function doStuff(input) {}
function process(data) {}
function check(value) {}
```

Good:

```js
function renderLandingPage(page) {}
function renderLegalMarkdown(markdown) {}
function isMinifiableTextAsset(asset) {}
```

### JavaScript Modules and Exports

Rules:

- Prefer named exports for reusable module code.
- Avoid default exports in repo-owned modules unless a tool requires one.
- Do not create namespace objects only to group functions.
- Do not export mutable variables as a module contract.
- Import the owning leaf module instead of a broad barrel.

Bad:

```js
export default {
  renderPage() {},
};
```

Good:

```js
export function renderPage(page) {
  return page;
}
```

## Bash

Bash names follow the same ownership rules as JavaScript, with shell-specific casing.

Rules:

- Shell function and local variable names use `lower_snake_case`.
- Constants, exported environment variables, and configured skip flags use `UPPER_SNAKE_CASE`.
- Script file names use `kebab-case`.
- Function names should describe the command step they perform.
- Do not use `function` in declarations.
- Do not name shell functions after broad tools unless the function owns that tool invocation.
- Use `_dir`, `_path`, `_file`, `_root`, and `_args` suffixes when they clarify shell value shape.

Bad:

```bash
function RunThing() {
  local data="$1"
}
```

Good:

```bash
run_codeql_scan() {
  local scan_file="$1"
}
```

## HTML, CSS, and Content

Templates and authored content should use names that match the generated site contract.

Rules:

- Template placeholders use `UPPER_SNAKE_CASE` inside double braces.
- Placeholder names should include the thing being replaced, such as `ASSET_STYLES_CSS` or `PAGE_TITLE`.
- Data attributes use kebab-case because they are HTML attributes.
- CSS classes should describe the component or state they style.
- CSS custom properties use kebab-case and should identify the value's role.
- Markdown content file names match the public route or content owner.
- Do not hide user-visible copy in variable names or comments. Put copy in content, config, or page-owned metadata.

Bad:

```html
<script src="{{ASSET_DEVICE_CLASS_JS}}"></script>
<div data-deviceClass="phone"></div>
```

Good:

```html
<script src="{{ASSET_DEVICE_JS}}"></script>
<div data-device-class="phone"></div>
```

## Tests and Fixtures

This repo does not currently have a broad test suite, but any future test names must describe behavior.

Rules:

- Test files use `.test.js` when added.
- Test names describe scenario and expected outcome.
- Fixtures use names that describe the input contract.
- Do not name tests after implementation details.

Bad:

```js
test('config works', () => {});
test('line 42', () => {});
```

Good:

```js
test('build writes legal routes for every legal page', () => {});
test('asset pipeline hashes browser scripts', () => {});
```

## Review Checklist

- Does the name identify the owner?
- Does the name match the repo boundary it lives in?
- Does the name avoid copied app-stack concepts that do not exist in this repo?
- Does the name avoid vague words and compatibility language?
- Does each boolean read as a positive assertion?
- Does each route, page, content file, and asset path match the generated site contract?
- Does the name satisfy `quality/repository/naming` for the affected scope?
