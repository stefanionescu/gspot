# Static Site

Rules for a repository that produces HTML for a content delivery network (CDN) or an edge platform.

## Build

Escape every value the build writes into HTML. Keep public paths and internal links consistent
with the deployed site.

## Templates and browser assets

Templates and root HTML files stay declarative.

- Browser scripts check that required elements exist before binding behavior and do not
  swallow programming errors.
- A plain script has no module system, so it uses no `import`. A module script resolves imports
  as URLs or through an import map, and names the resource the server serves.
- Use the DOM in browser code. Browsers lack Node built-ins, so reject a `node:` import. Use the APIs
  the declared browser support allows.
- Build navigation and fetch URLs from values the application controls.
