---
title: Spelling and prose
description: Check spelling at every level, and prose style at level all.
configurations: [prose, spelling]
---

gspot turns on two configurations for the words of every repository:

- `spelling` runs the typos spell checker on code, comments, and docs. It skips `gspot.toml`, which holds globs and tool
  names.
- `prose/dates` reports a date such as `03/04/2026`, which some readers take as March 4 and others as April 3. Write
  `March 4, 2026` or `2026-03-04`.

## Spelling

`spelling.locale` is `en` by default, which accepts the spellings of every English dialect. To require one dialect,
choose `en-us`, `en-gb`, `en-ca`, or `en-au`:

```shell
gspot set spelling.locale en-gb
```

typos then also reports the spellings of the other dialects. `gspot check --fix` corrects misspellings in Markdown and
text files, and it never changes the spelling of one dialect into another.

To accept a word, such as a product name, add it with a reason, and Vale then accepts the word too:

```shell
gspot set spelling.allowed_words Acmeflow --reason "Acmeflow is our product name."
```

## Prose style

At level `all`, Vale checks Markdown and code comments against the gspot writing style: short sentences, active voice,
and no filler words such as `simply`. `.gspot/rules/WRITING.md` holds the full style, and `prose/commit-message` checks
each new commit message. The [prose limits](/reference/gspot-toml/#prose), such as the longest sentence, are settings,
and raising one needs a reason. The [`prose` configuration reference](/reference/configurations/prose/) lists every rule.
