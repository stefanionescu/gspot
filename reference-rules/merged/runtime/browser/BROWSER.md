---
layer: runtime
preset: static-site
title: Browser
---

# Browser

Rules that hold because the code runs in a browser.

## Module resolution

- A script loaded as a plain script from HTML has no module system. Do not use `import` in one. `enforced-by: typescript/eslint gspot/import-path-style`
- A module script resolves by URL, so an internal import carries its real extension. `enforced-by: typescript/eslint gspot/import-path-style`

## Globals and APIs

- `document`, `window` and the DOM are available. Node built-ins are not, and a `node:` import is
  an error. `enforced-by: typescript/eslint n/no-unsupported-features`
- Use APIs the declared browser support allows. Support is a fact about the project, declared in
  one place. `enforced-by: typescript/eslint n/no-unsupported-features`

## The DOM as a sink

- Never assign untrusted content to `innerHTML`, `outerHTML`, `document.write`, or any other sink
  that parses HTML. Set text, or pass the content through a reviewed sanitizer. `enforced-by: structure/html-scripts`
- Build a URL for navigation or fetch from values the application controls. `enforced-by: structure/html-scripts`
