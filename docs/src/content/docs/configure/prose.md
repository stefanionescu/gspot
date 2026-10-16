---
title: Spelling and prose
description: Check spelling and prose, and allow words your project needs.
---

The spelling configuration runs typos. The prose configuration runs Vale on documentation and comments.

## Allow a project word

The spelling check reports `capitalisation` in a text file:

```text
`capitalisation` should be `capitalization`
```

If your product uses this British spelling, allow the word with its reason:

```toml
configurations = ["spelling", "prose"]
allowed_words = { value = ["capitalisation"], reason = "The product uses British spelling." }
```

```shell
gspot set allowed_words capitalisation --reason "The product uses British spelling."
```

This removes the `spelling/typos` finding for `capitalisation` and accepts the word in prose. Other spelling and prose findings still apply.
Use `gspot explain allowed_words` to inspect the value and its source.

## Prose checks

The prose rules check sentence length, word choice, and paragraph structure. Keep comments and documentation in
plain language. Use [prose settings](/reference/configurations/prose/) to inspect the checks, and the
[`allowed_words` setting](/reference/gspot-toml/#allowed_words) to inspect accepted values.
