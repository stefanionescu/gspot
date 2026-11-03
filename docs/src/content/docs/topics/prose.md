---
title: Spelling and prose
description: Check spelling and prose, and allow words your project needs.
configurations: [prose, spelling]
---

The `spelling` configuration runs typos on code, comments, and documentation. The `prose` configuration runs Vale on
documentation, and at level `all` on code comments too. See the [always-selected configurations](/reference/configurations/#always-selected).

## Spelling

By default, `spelling.locale` holds `en`: typos reports real misspellings and accepts every English dialect. To ask
for one dialect, pick `en-us`, `en-gb`, `en-ca`, or `en-au`:

```shell
gspot set spelling.locale en-gb
```

The check then reports the spellings of other dialects too. `gspot check --fix` corrects only real misspellings, and
leaves a dialect spelling for you to change.

To accept a word, add it with a reason:

```shell
gspot set spelling.allowed_words Acmeflow --reason "Acmeflow is our product name."
```

Vale accepts the word too.

## Prose

`prose/dates` reports ambiguous dates in Markdown text and code comments at both levels. markdownlint reports link text
that says nothing and images without alt text. At level `all`, Vale adds the full style and the
[prose limits](/reference/gspot-toml/#prose); raising one needs a reason. Code comments then get the comment rules:
conscious language, placeholders, session identifiers, home paths, straight quotes, em dashes, and the word rules of
`WRITING.md`. `prose/commit-message` runs the word rules on a new commit message.

The [prose configuration](/reference/configurations/prose/) lists the checks.
