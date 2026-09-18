---
title: "Duplication"
description: "Copy-paste detection across every language a selected preset claims, with a ceiling for the share of duplicated lines."
---

Copy-paste detection across every language a selected preset claims, with a ceiling for the share of duplicated lines.

Kind: concern.

## Tools

- jscpd 5.2.0

## Generated configuration

- `.gspot/jscpd.json`

## Checks

| Check                                                      | Stage | What it finds                                                                             |
| ---------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------- |
| [`duplication/jscpd`](/reference/rules/duplication/jscpd/) | push  | Finds blocks of code copied between files, and fails when their share passes the ceiling. |

## Settings

- `limits.duplication.min_lines`: The fewest lines a copied block has before it counts.
- `limits.duplication.min_tokens`: The fewest tokens a copied block has before it counts.
- `limits.duplication.threshold_percent`: The largest share of duplicated lines the check accepts, as a number out of 100.
- `tools.jscpd.ignore`: Paths the duplication check skips, each with a reason.

## Rule files

- `general/agent/WORKING.md`
