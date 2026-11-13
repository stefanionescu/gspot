# Static sites

Read this rule when you change a site that a build turns into static HTML.

## Build

Escape every value the build writes into HTML. Keep public paths and internal links consistent with the deployed site.

Delete an asset that no page, stylesheet, or script names.

## Templates and browser assets

- Browser scripts check that required elements exist before binding behavior and do not swallow programming errors.
- A plain script has no module system, so it uses no `import`. A module script resolves imports as URLs or through an
  import map, and names the resource the server serves.
- Use the DOM in browser code. Browsers lack Node built-ins, so reject a `node:` import. Use the APIs the declared
  browser support allows.
- Build navigation and fetch URLs from values the application controls.
- Delete a selector that no built page uses. List a class that a script adds under `site.allowed_classes`.
