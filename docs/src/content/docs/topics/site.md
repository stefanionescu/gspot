---
title: Static sites
description: Check a built site, including sites deployed below a URL path.
configurations: [site]
---

The `site` configuration builds your site, then checks the built pages, the internal links, the sitemap, the styles,
and the assets. Turn it on with `gspot add site`, then run `gspot install`. `gspot add` writes the command that runs
your `build` script into `site.build_command`. `site.build_folder`, the folder of the built files, is `dist` by default.
Set either one when it does not fit your project.

Run `gspot check --only site/sitemap,site/lychee` to build the site and check its sitemap and internal links. The checks
read the built files without starting a server. The link check makes no network requests.

## Sites below a URL path

When you deploy a site below a URL path, such as `/docs/`, gspot reads that path from the sitemap index. For example,
an index that lists `https://example.com/docs/sitemap-0.xml`, with `sitemap-0.xml` in the top folder of the build, sets
the path to `/docs/`. The sitemap check removes that prefix from each URL before it looks for the built page. The link
check maps the links below that path to the same build folder.

gspot reads the path from the first nested sitemap that it finds in the build. Without a sitemap index, it uses `/`.

## Unused styles

`site/purgecss` reports each selector in the built styles that no built page uses, when the selector also appears in
the style sheets or component style blocks of the scope. Before it compares selectors, it removes the scoping markers
that frameworks add. A selector that a framework generates, or that comes from nested SCSS or Less, can differ from its
source, and the check then does not report it. To keep a class that the check reports, list it in
`site.allowed_classes`.
