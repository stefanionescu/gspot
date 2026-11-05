---
title: Mistakes that gspot catches
slug: topics/real-catches
description: A vulnerable package that a dependency pulled in, a font size that ignores zoom, and a replacement string that changes itself.
---

These mistakes came up in the gspot repository, and the checks that caught them run in your repository too.

## A vulnerable package that a dependency pulls in

A package that you add brings its own dependencies, so a lockfile can hold a vulnerable package that nobody asked for.
Adding `mermaid-isomorphic` 3.1.0 to draw diagrams pulled in `katex` 0.16.47:

```json title="docs/package.json"
{
    "dependencies": {
        "mermaid-isomorphic": "3.1.0"
    }
}
```

Before each push, `dependencies/osv-scanner` looks up every locked package in the Open Source Vulnerabilities (OSV)
database, at both levels. The advisory for `katex` stopped the push:

```text
bun.lock  GHSA-238p-pmpm-9mq7  katex: 0.16.47: Existing prototype pollution can bypass trust restrictions
```

`katex` 0.18.2 and later fix the advisory. The packages that pull it in ask for version 0.16, so an override in the root
`package.json` installs the fixed version:

```json title="package.json"
{
    "overrides": {
        "katex": "0.18.11"
    }
}
```

[Fixed in commit 4c4e727d9](https://github.com/stefanionescu/gspot/commit/4c4e727d9).

## A font size in `vw` does not grow with zoom

A font size in `vw` follows the width of the window, so it does not grow when the reader zooms the page. At 200% zoom,
such a heading stays below twice its size:

```css
h1 {
    font-size: clamp(2.5rem, 1.6rem + 3.2vw, 4rem);
}
```

The rule `declaration-property-unit-allowed-list` allows only `rem`, `em`, and `%` for `font-size`, and it runs in
`css/stylelint` at both levels:

```text
declaration-property-unit-allowed-list  Disallowed unit "vw" for property "font-size"
```

To grow a heading with the window, give it a size in `rem` at each screen width:

```css
h1 {
    font-size: 2.5rem;
}

@media (width >= 50rem) {
    h1 {
        font-size: 3.25rem;
    }
}
```

[Fixed in commit bb97f7a22](https://github.com/stefanionescu/gspot/commit/bb97f7a22).

## `replace` reads patterns in its replacement

`String#replace` and `replaceAll` read `$&`, `$'`, and `$$` in a replacement string as special patterns. A replacement
from outside the code, such as a folder path or the text of a file, then changes without any error. A replacer function
returns the text unchanged:

```js
const folder = '/srv/$$app';
'/tmp/copy-1/src/a.ts'.replaceAll('/tmp/copy-1', folder);
// '/srv/$app/src/a.ts'
'/tmp/copy-1/src/a.ts'.replaceAll('/tmp/copy-1', () => folder);
// '/srv/$$app/src/a.ts'
```

The rule `unicorn/no-unsafe-string-replacement` reports a replacement value that is not a literal, and it runs in
`javascript/eslint`:

```text
src/paths.js:2:50  unicorn/no-unsafe-string-replacement  Do not use a non-literal replacement value with `String#replaceAll()`.
```

The `replace` rule runs only at level `all`. To turn it on, run `gspot set level all`, then `gspot install`.

[Fixed in commit 651f85309](https://github.com/stefanionescu/gspot/commit/651f85309).
