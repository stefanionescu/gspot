---
title: "Spelling"
description: "typos over every text file, with the words this repository allows and the reason for each."
---

typos over every text file, with the words this repository allows and the reason for each.

Kind: concern. Selected by default.

## Tools

- typos 1.43.5

## Generated configuration

- `.gspot/typos.toml`

## Checks

| Check                                                | Stage  | What it finds                                                |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------ |
| [`spelling/typos`](/reference/rules/spelling/typos/) | commit | Finds misspelled words in code, comments, and documentation. |

## Settings

- `tools.typos.words`: Words typos flags that this repository uses on purpose, each with a reason (the word itself counts).
- `tools.typos.exclude`: Paths typos skips, each with a reason.
- `tools.typos.locale`: The English locale typos checks against.
