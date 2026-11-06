---
title: Spelling and prose
configurations: [prose, spelling]
---

In every repository, gspot checks the spelling of code, comments, and docs, and reports ambiguous dates.

## Spelling

The typos spell checker accepts the spellings of every English dialect, because `spelling.locale` is `en` by default. To
require one dialect, choose `en-us`, `en-gb`, `en-ca`, or `en-au`:

```shell
gspot set spelling.locale en-gb
```

typos then also reports the spellings of the other dialects. `gspot check --fix` corrects misspellings in Markdown and
text files, and it never changes the spelling of one dialect into another.

To accept a word, such as a product name, add it with a reason, and Vale then accepts the word too:

```shell
gspot set spelling.allowed_words Acmeflow --reason "Acmeflow is our product name."
```

## Dates

`prose/dates` reports a date such as `03/04/2026`, which some readers take as March 4 and others as April 3. Write
`March 4, 2026` or `2026-03-04`.

## Prose style

At level `all`, Vale checks Markdown and code comments against the gspot writing style: short sentences, active voice,
and no filler words such as `simply`. `.gspot/rules/WRITING.md` holds the full style, and `prose/commit-message` checks
each new commit message. The [prose limits](/reference/gspot-toml/#prose), such as the longest sentence, are settings,
and raising one needs a reason. The [`prose` configuration reference](/reference/configurations/prose/) lists every rule.
