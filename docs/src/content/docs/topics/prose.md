---
title: Spelling and prose
description: Check spelling at every level, and prose style at level all.
configurations: [prose, spelling]
---

gspot selects two configurations in every repository:

- `spelling` runs typos on code, comments, and docs.
- `prose` reports dates that read two ways in Markdown files and code comments: dates with the day and the month as
  numbers.
  At level `all`, it also runs Vale on Markdown, code comments, and commit messages.

## Spelling

`spelling.locale` defaults to `en`, which accepts every English dialect. To require one dialect, choose `en-us`,
`en-gb`, `en-ca`, or `en-au`:

```shell
gspot set spelling.locale en-gb
```

typos then reports the spellings of the other dialects too. `gspot check --fix` corrects misspellings in Markdown and
text files. It never changes a dialect spelling.

To accept a word, such as a product name, add it with a reason:

```shell
gspot set spelling.allowed_words Acmeflow --reason "Acmeflow is our product name."
```

Vale accepts the word too.

## Prose style

At level `all`, Vale checks Markdown and code comments against the gspot style, and `prose/commit-message` checks each
new commit message. The [prose limits](/reference/gspot-toml/#prose), such as the sentence length, are settings;
raising one needs a reason. The [prose configuration](/reference/configurations/prose/) lists every rule.
