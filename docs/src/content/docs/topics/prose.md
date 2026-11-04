---
title: Spelling and prose
description: Check spelling at every level, and prose style at level all.
configurations: [prose, spelling]
---

gspot turns on two configurations for the words of every repository:

- `spelling` runs the typos spell checker on code, comments, and docs.
- `prose` reports the dates in Markdown files and code comments that a reader can read two ways. These are dates with
  the day and the month as numbers. At level `all`, `prose` also runs the Vale style checker on Markdown, code comments,
  and commit messages.

## Spelling

`spelling.locale` is `en` by default, which accepts the spellings of every English dialect. To require one dialect,
choose `en-us`, `en-gb`, `en-ca`, or `en-au`:

```shell
gspot set spelling.locale en-gb
```

typos then also reports the spellings of the other dialects. `gspot check --fix` corrects misspellings in Markdown and
text files. It never changes the spelling of one dialect into another.

To accept a word, such as a product name, add it with a reason:

```shell
gspot set spelling.allowed_words Acmeflow --reason "Acmeflow is our product name."
```

Vale then accepts the word too.

## Prose style

At level `all`, Vale checks Markdown and code comments against the gspot writing style, and `prose/commit-message`
checks each new commit message. The [prose limits](/reference/gspot-toml/#prose), such as the longest sentence, are
settings, and raising one needs a reason. The [`prose` configuration reference](/reference/configurations/prose/) lists
every rule.
