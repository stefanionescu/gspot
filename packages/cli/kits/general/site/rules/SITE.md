---
title: Static Sites
---

# Static Sites

Rules for a repository whose product is generated HTML served from a CDN or an edge platform.

## Runtime isolation

Browser code must not import privileged server implementations, build code, or quality tooling.
Keep request-specific state isolated between edge requests.

## Source roots

<!-- level: all -->

- Source roots are named for what they own. Content holds authored bodies; templates hold page-owned
  markup and route metadata; assets hold source media; site configuration holds data only.

- Build holds the generator and asset pipeline; edge functions hold middleware only; browser scripts
  hold the rest.
- Generated output lives in one output directory and is never a source root. Nothing imports
  from it and nothing hand-edits it.
- Site configuration is data. It does not import the build, the edge functions, or browser code.
- Production site code never imports quality tooling. Browser scripts never import server-only
  or build code.
- Do not name a folder after an implementation language when it has a product owner.

## Build

- Asset names are content-hashed where the pipeline expects hashes; templates reference assets
  through placeholders the build resolves, never hard-coded hashed names.
- Public paths are normalized before writing output. Every internal link and asset reference
  resolves in the output tree.
- The build validates URLs before writing them into markup and escapes every value it
  interpolates through the site's escaping helper.
- Analytics and third-party configuration is generated into one shared asset, not inlined per
  template, and reads its keys from the configuration owner.

### Reproducible output

<!-- level: all -->

The same build inputs produce byte-identical output. Two consecutive builds diff clean.

## Templates and browser assets

Templates and root HTML files stay declarative.

- JSON-LD is allowed with `<script type="application/ld+json">` because it is data, not
  executable app logic.
- Do not use `document.write` or executable script URLs.
- Prefer safe DOM mutation: `textContent`, attributes, class changes, and created nodes.
- Avoid `innerHTML`, `outerHTML`, and `insertAdjacentHTML` unless a reviewed static, trusted
  markup path is the real contract.
- Browser scripts check that required elements exist before binding behavior and do not
  swallow programming errors.
- A plain script has no module system, so it uses no `import`. A module script resolves imports
  as URLs or through an import map, and names the resource the server serves.
- The DOM is available and Node built-ins are not, so a `node:` import is an error. Use the APIs
  the declared browser support allows.
- Build navigation and fetch URLs from values the application controls.

### Template organization

<!-- level: all -->

- Keep executable scripts and event handlers in separate script files.
- Keep visible copy in content, configuration, or page-owned metadata.

## Routes and pages

<!-- level: all -->

- Public routes use lowercase kebab-case path segments. Directory routes end with `index.html`
  in generated output.
- Legal pages use route names that match their public path and content body.
- Landing variants use short names that identify the audience or campaign.
- Every page declares its title, description, canonical URL, and social metadata from
  page-owned metadata; the build fails on a page missing them.

## Edge middleware

- Middleware handles redirects, headers, and locale or device negotiation. It contains no
  product behavior and never returns a stack trace.
- Middleware reads configuration from the platform's bindings, never from module-level state
  shared across requests.
