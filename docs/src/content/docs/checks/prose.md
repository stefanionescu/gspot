---
title: Spelling and prose
description: Check spelling and prose, and allow words your project needs.
---

The `spelling` configuration runs typos on code, comments, and documentation. The `prose` configuration runs Vale on
documentation and comments. gspot selects both in every repository.

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

At level `recommended`, Vale checks ambiguous dates, link text, and image alt text. At level `all`, it adds the full
style, with these limits; raising one needs a reason.

| Setting                         | Default |
| ------------------------------- | ------- |
| `prose.max_sentence_words`      | `30`    |
| `prose.max_list_item_words`     | `45`    |
| `prose.max_paragraph_sentences` | `6`     |

The [prose configuration](/reference/configurations/prose/) lists the checks.
