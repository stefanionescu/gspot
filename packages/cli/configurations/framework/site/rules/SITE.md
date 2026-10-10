---
title: Static Sites
---

# Static Sites

Rules for a repository whose product is generated HTML served from a CDN or an edge platform.

## Runtime isolation

Browser code imports no server or build code.
Keep request-specific state isolated between edge requests.

## Build

Escape every value the build writes into HTML. Keep public paths and internal links consistent
with the deployed site.

## Templates and browser assets

Templates and root HTML files stay declarative.

- Browser scripts check that required elements exist before binding behavior and do not
  swallow programming errors.
- A plain script has no module system, so it uses no `import`. A module script resolves imports
  as URLs or through an import map, and names the resource the server serves.
- The DOM is available and Node built-ins are not, so a `node:` import is an error. Use the APIs
  the declared browser support allows.
- Build navigation and fetch URLs from values the application controls.

## Edge middleware

- Middleware handles redirects, headers, and locale or device negotiation. It contains no
  product behavior.
- Middleware reads configuration from the platform's bindings, never from module-level state
  shared across requests.
