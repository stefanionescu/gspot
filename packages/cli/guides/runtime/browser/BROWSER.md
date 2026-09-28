---
layer: runtime
configuration: static-site
title: Browser
---

# Browser

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

Rules that hold because the code runs in a browser.

## Module resolution

- A script loaded as a plain script from HTML has no module system. Do not use `import` in one.
- A module script resolves imports as URLs or through an import map. Relative imports
  name the resource the server actually serves; preserve declared import-map aliases.

## Globals and APIs

- `document`, `window` and the DOM are available. Node built-ins are not, and a `node:` import is
  an error.
- Use APIs the declared browser support allows. Support is a fact about the project, declared in
  one place.

## The DOM as a sink

- Never assign untrusted content to `innerHTML`, `outerHTML`, `document.write`, or any other sink
  that parses HTML. Set text, or pass the content through a reviewed sanitizer.
- Build navigation and fetch URLs from values the application controls.
