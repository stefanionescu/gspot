---
title: Real catches
slug: topics/real-catches
description: Mistakes from the Git history of gspot that its own checks report, with the rule, the code, and the commits.
---

These mistakes come from the Git history of the gspot repository. Each one says what went wrong, and names the rule
that reports it and its level. It shows the code before and after the fix, and links the commits that brought the code
in and fixed it. Each output comes from a run of gspot on the current file with the old lines put back, so its line
numbers belong to the current file.

Two of the three catches come from a rule that runs only at level `all`. `gspot init` starts at level `basic`; see
[Levels](/start/concepts/#levels).

## `String#replace` reads patterns in its replacement

The docs site builds the page of the ESLint plugin from the plugin README. It inserted the install and use text with
`String#replace` and a template string. `replace` reads `$&`, `$'`, and `$$` in a replacement string as patterns, so a
`$&` in that text turns into the matched text on the page:

```js
'## Install\n'.replace('## Install\n', '## Install\n\nUse `$&` to repeat the match.\n');
// '## Install\n\nUse `## Install\n` to repeat the match.\n'
'## Install\n'.replace('## Install\n', () => '## Install\n\nUse `$&` to repeat the match.\n');
// '## Install\n\nUse `$&` to repeat the match.\n'
```

The rule `unicorn/no-unsafe-string-replacement` reports a replacement value that is not a literal. It runs in
`javascript/eslint` at level `all`.

Before:

```ts
const introduction = readme
    .slice(readme.indexOf('\n'), readme.indexOf('## Rule reference'))
    .trim()
    .replace('## Install\n', `## Install\n\n${requirements}\n`)
    .replace('## Use\n', `## Use\n\n${formatPluginPresets()}\n`);
```

After, a replacer function returns the text as it is:

```ts
const introduction = readme
    .slice(readme.indexOf('\n'), readme.indexOf('## Rule reference'))
    .trim()
    .replace('## Install\n', () => `## Install\n\n${requirements}\n`)
    .replace('## Use\n', () => `## Use\n\n${formatPluginPresets()}\n`);
```

With the old lines back, `gspot check --only javascript/eslint` reports:

```text
failed   docs  javascript/eslint  2 findings
  docs/src/reference/eslint-plugin.ts:190:34  unicorn/no-unsafe-string-replacement  Do not use a non-literal replacement value with `String#replace()`.
  docs/src/reference/eslint-plugin.ts:191:30  unicorn/no-unsafe-string-replacement  Do not use a non-literal replacement value with `String#replace()`.
```

Commits: introduced in [commit 87e4a3d76](https://github.com/stefanionescu/gspot/commit/87e4a3d76) on
November 1, 2026, and fixed in [commit 49c1b56fa](https://github.com/stefanionescu/gspot/commit/49c1b56fa) on
November 2, 2026.

## A font size in `vw` does not grow with zoom

The home page sized its title and section headings with `clamp()` and a `vw` term. A font size in `vw` does not grow
when the reader zooms the page, so at 200% zoom the headings stayed below twice their size.

The rule `declaration-property-unit-allowed-list` allows only `rem`, `em`, and `%` for `font-size`. It runs in
`css/stylelint` at both levels.

Before:

```css
.hero h1 {
    font-size: clamp(2.5rem, 1.6rem + 3.2vw, 4rem);
}

.section h2 {
    font-size: clamp(1.75rem, 1.2rem + 1.8vw, 2.5rem);
}
```

After, each heading reads a size in `rem` from a token that steps up at two breakpoints, between the same smallest
and largest sizes. This excerpt leaves out the other tokens of `:root`:

```css
:root {
    --home-title-size: 2.5rem;
    --home-heading-size: 1.75rem;
}

@media (width >= 50rem) {
    :root {
        --home-title-size: 3.25rem;
        --home-heading-size: 2.125rem;
    }
}

@media (width >= 72rem) {
    :root {
        --home-title-size: 4rem;
        --home-heading-size: 2.5rem;
    }
}

.hero h1 {
    font-size: var(--home-title-size);
}

.section h2 {
    font-size: var(--home-heading-size);
}
```

With the old lines back, `gspot check --only css/stylelint` fails with two findings, one for each heading:

```text
declaration-property-unit-allowed-list  Disallowed unit "vw" for property "font-size"
```

Commits: the lines came in with [commit 2a0ec3345](https://github.com/stefanionescu/gspot/commit/2a0ec3345) on
October 16, 2026, and [commit bb97f7a22](https://github.com/stefanionescu/gspot/commit/bb97f7a22) fixed them on
November 2, 2026.

## `replaceAll` with a folder path

gspot runs some checks in a temporary copy of the repository. It then swaps the path of the copy for the path of the
repository in the commands and notes that it reports. The swap passed the repository path as the replacement string of
`replaceAll`, so a `$$` in a folder name turns into `$` in the reported path:

```js
'/tmp/copy-1/src/a.ts'.replaceAll('/tmp/copy-1', '/srv/$$app');
// '/srv/$app/src/a.ts'
'/tmp/copy-1/src/a.ts'.replaceAll('/tmp/copy-1', () => '/srv/$$app');
// '/srv/$$app/src/a.ts'
```

The same rule, `unicorn/no-unsafe-string-replacement`, reports it at level `all`.

Before:

```ts
for (const root of new Set([session.root, realpathSync(session.root)])) {
    command = command?.map((argument) => argument.replaceAll(root, session.toolsRoot));
    note = note?.replaceAll(root, session.toolsRoot);
}
```

After:

```ts
const roots = new Set([session.root, realpathSync(session.root)]);
for (const root of roots) {
    command = command?.map((argument) => argument.replaceAll(root, () => session.toolsRoot));
    note = note?.replaceAll(root, () => session.toolsRoot);
}
```

With the old lines back, `gspot check --only javascript/eslint` reports:

```text
failed   packages/cli  javascript/eslint  2 findings
  packages/cli/src/engine/results.ts:194:72  unicorn/no-unsafe-string-replacement  Do not use a non-literal replacement value with `String#replaceAll()`.
  packages/cli/src/engine/results.ts:195:39  unicorn/no-unsafe-string-replacement  Do not use a non-literal replacement value with `String#replaceAll()`.
```

Commits: the `replaceAll` calls came in with
[commit 1103f0e39](https://github.com/stefanionescu/gspot/commit/1103f0e39) on October 29, 2026, and
[commit 651f85309](https://github.com/stefanionescu/gspot/commit/651f85309) fixed them on November 2, 2026.
