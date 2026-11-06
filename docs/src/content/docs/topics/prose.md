---
title: Prose
configurations: [prose]
---

gspot reports ambiguous dates in every repository, and checks your writing style at level `all`.

## Dates

`prose/dates` reports a date such as `03/04/2026`, which some readers take as March 4 and others as April 3. Write
`March 4, 2026` or `2026-03-04`.

## Style

At level `all`, Vale checks Markdown and code comments against the gspot writing style: short sentences, active voice,
and no filler words such as `simply`. `.gspot/rules/WRITING.md` holds the full style, and `prose/commit-message` checks
each new commit message. The [prose limits](/reference/gspot-toml/#prose), such as the longest sentence, are settings,
and raising one needs a reason. The [`prose` configuration reference](/reference/configurations/prose/) lists every rule.
