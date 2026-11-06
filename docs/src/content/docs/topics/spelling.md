---
title: Spelling
configurations: [spelling]
---

In every repository, gspot checks the spelling of code, comments, and docs.

The typos spell checker accepts the spellings of every English dialect, because `spelling.locale` is `en` by default. To
require one dialect, choose `en-us`, `en-gb`, `en-ca`, or `en-au`:

```shell
gspot set spelling.locale en-gb
```

typos then also reports the spellings of the other dialects.

To accept a word, such as a product name, add it with a reason, and Vale then accepts the word too:

```shell
gspot set spelling.allowed_words Acmeflow --reason "Acmeflow is our product name."
```
