---
layer: repository
preset: static-site
title: Static Sites
---

# Static Sites

Rules for a repository whose product is generated HTML served from a CDN or an edge platform.

## Source roots

- Source roots are named for what they own. Content holds authored bodies; templates hold page-owned
  markup and route metadata; assets hold source media; site configuration holds data only.
  `enforced-by: typescript/eslint boundaries/element-types`
- Build holds the generator and asset pipeline; edge functions hold middleware only; browser scripts
  hold the rest. `enforced-by: typescript/eslint boundaries/element-types`
- Generated output lives in one output directory and is never a source root. Nothing imports
  from it and nothing hand-edits it. `enforced-by: typescript/eslint boundaries/element-types`
- Site configuration is data. It does not import the build, the edge functions, or browser code. `enforced-by: static-site/html-validate-built`
- Production site code never imports quality tooling. Browser scripts never import server-only
  or build code. `enforced-by: typescript/eslint boundaries/element-types`
- Do not name a folder after an implementation language when it has a product owner. `enforced-by: static-site/html-validate-built`

## Build

- The build is deterministic: the same inputs produce byte-identical output. Two consecutive
  builds diff clean, and the gate checks it. `enforced-by: static-site/build-reproducible`
- Asset names are content-hashed where the pipeline expects hashes; templates reference assets
  through placeholders the build resolves, never hard-coded hashed names. `enforced-by: static-site/build-reproducible`
- Public paths are normalized before writing output. Every internal link and asset reference
  resolves in the output tree. `enforced-by: static-site/links-internal`
- The build validates URLs before writing them into markup and escapes every value it
  interpolates through the site's escaping helper. `enforced-by: static-site/html-validate-built`
- Analytics and third-party configuration is generated into one shared asset, not inlined per
  template, and reads its keys from the configuration owner. `enforced-by: static-site/html-validate-built`

## Templates and browser assets

Templates and root HTML files stay declarative.

- Do not add executable inline scripts to templates. `enforced-by: structure/html-scripts`
- JSON-LD is allowed with `<script type="application/ld+json">` because it is data, not
  executable app logic. `enforced-by: structure/html-scripts`
- Do not use `document.write`, inline event handler attributes, or `javascript:` URLs. `enforced-by: structure/html-scripts`
- Put browser behavior in separate script files. `enforced-by: structure/html-scripts`
- Prefer safe DOM mutation: `textContent`, attributes, class changes, and created nodes. `enforced-by: static-site/html-validate-built`
- Avoid `innerHTML`, `outerHTML`, and `insertAdjacentHTML` unless a reviewed static, trusted
  markup path is the real contract. `enforced-by: structure/html-scripts`
- Keep visible copy in content, configuration, or page-owned metadata; do not hide user copy in
  build-script template literals. `enforced-by: structure/html-copy`
- Browser scripts check that required elements exist before binding behavior and do not
  swallow programming errors. `enforced-by: static-site/html-validate-built`

## Routes and pages

- Public routes use lowercase kebab-case path segments. Directory routes end with `index.html`
  in generated output. `enforced-by: naming/identifiers`
- Legal pages use route names that match their public path and content body. `enforced-by: naming/identifiers`
- Landing variants use short names that identify the audience or campaign. `enforced-by: naming/identifiers`
- Every page declares its title, description, canonical URL, and social metadata from
  page-owned metadata; the build fails on a page missing them. `enforced-by: naming/identifiers`

## Edge middleware

- Middleware handles redirects, headers, and locale or device negotiation. It contains no
  product behavior and never returns a stack trace. `enforced-by: cloudflare/wrangler-config`
- Middleware reads configuration from the platform's bindings, never from module-level state
  shared across requests. `enforced-by: cloudflare/wrangler-config`
