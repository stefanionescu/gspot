# `static-site`

Kind: concern. Requires: html, css, javascript. For a site built to a directory and served
as files: the checks that only make sense over built output.

## Detects and claims

|        |                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detect | `.html` files with no framework dependency and a build script in `package.json`                                                                         |
| Claims | the build output directory (`[tools.site] output`, default `dist`) as generated; `assets/**` as binary; `sitemap.xml`, `robots.txt`, `site.webmanifest` |

## Tools

html-validate, purgecss, linkinator, svgo. linkinator serves the output folder itself. Cycle
and complexity checks come from the javascript preset (import-x, sonarjs); madge and Lizard are
not used.

## Checks

| Id                                | Stage           | Command                                                                                                                                                                                                                                                                               |
| --------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `static-site/build`               | push, build     | the build script from `[tools.site] build`                                                                                                                                                                                                                                            |
| `static-site/build-reproducible`  | push, build     | build twice into two directories; the trees are identical                                                                                                                                                                                                                             |
| `static-site/html-validate-built` | push, build     | html-validate over `<output>/**/*.html` with the built config                                                                                                                                                                                                                         |
| `css/dead-selectors`              | push, build     | PurgeCSS over the built output and the template sources with `[tools.purgecss] safelist`                                                                                                                                                                                              |
| `static-site/links-internal`      | push, build     | serve the output, `linkinator --recurse --check-css --check-fragments` over the seed routes; mailto, tel, and sms skipped                                                                                                                                                             |
| `static-site/links-external`      | manual, network | the same with external links, `[tools.linkinator] status_overrides` and `skip`                                                                                                                                                                                                        |
| `static-site/dead-assets`         | push            | every file under `assets/**` is referenced from a template, a stylesheet, or a script                                                                                                                                                                                                 |
| `static-site/svg`                 | commit          | svgo over each file to standard output; a smaller result is a finding, because svgo has no check mode                                                                                                                                                                                 |
| `static-site/size`                | push, build     | the compressed weight of the output paths each entry of `[tools.site] size_limits` names; built in, so no size-limit package and no second configuration                                                                                                                              |
| `static-site/sitemap`             | push, build     | every route in the sitemap is in the output; every HTML page is in the sitemap unless excluded                                                                                                                                                                                        |
| `static-site/webmanifest`         | commit          | validates against the schema                                                                                                                                                                                                                                                          |
| `integrity/security-headers`      | commit          | `_headers` sets `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`; HTML paths carry a revalidating `Cache-Control`; hashed assets are immutable. Here because a site of files has no other place to set headers; a framework app sets them in its configuration |

## Settings

`tools.site.required_headers` (name, value pattern), `tools.site.html_paths`, `tools.site.output`, `tools.site.build`, `tools.site.serve`, `tools.site.seed_routes`,
`tools.site.size_limits`, `tools.purgecss.safelist` (reason), `tools.linkinator.skip` (pattern,
reason), `tools.linkinator.status_overrides`.

## Rule files

`repository/static-site/STATIC-SITE.md`, `runtime/browser/BROWSER.md`.
