---
title: "Docs"
description: "Documentation integrity: links and anchors, banned headings, stale paths, the README of every scope, and its shape."
---

Documentation integrity: links and anchors, banned headings, stale paths, the README of every scope, and its shape.

Kind: concern. Selected by default.

## Tools

- lychee 0.24.2

## Generated configuration

- `.gspot/lychee.toml`

## Checks

| Check                                                                  | Stage  | What it finds                                                                                                            |
| ---------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| [`docs/links`](/reference/rules/docs/links/)                           | commit | Checks that every relative link names a tracked file and every anchor names a heading.                                   |
| [`docs/links-external`](/reference/rules/docs/links-external/)         | manual | Checks every external link over the network.                                                                             |
| [`integrity/docs-headings`](/reference/rules/integrity/docs-headings/) | commit | Finds a heading from the banned list, such as Table of contents, or Project structure.                                   |
| [`integrity/stale-paths`](/reference/rules/integrity/stale-paths/)     | commit | Checks that every path a Markdown file names is tracked, and every mise run or bun run names a task that exists.         |
| [`docs/readme-present`](/reference/rules/docs/readme-present/)         | commit | Checks that every scope has a README.md and the root has a LICENSE.                                                      |
| [`docs/readme-shape`](/reference/rules/docs/readme-shape/)             | commit | Checks the shape of every README: one H1, an opening paragraph, a Contents list when long, a section on getting started. |

## Settings

- `tools.lychee.exclude_paths`: Files the link checks skip, each with a reason: the pages of a site whose links resolve only once it is built.
- `tools.docs.paths_allowed`: Path patterns the stale-paths check skips, each with a reason.
- `tools.docs.banned_headings`: Headings this repository bans beyond the shipped list.
- `tools.docs.require_license`: Whether the root must carry a LICENSE file.
- `tools.docs.readme_shape`: Whether the README shape check runs; false with a reason turns it off.
- `tools.docs.contents_threshold`: How many H2 headings a README may have before it needs a Contents list.
- `tools.lychee.exclude`: URL patterns lychee skips, each with a reason.

## Rule files

- `general/prose/DOCS.md`
- `general/prose/DOCS-FORMAT.md`
- `general/prose/DOCS-CONTENT.md`
- `general/prose/DOCS-MEDIA.md`
- `general/prose/DOCS-SURFACES.md`
- `general/prose/DOCS-REVIEW.md`
- `general/prose/WRITING.md`
- `general/code/COMMENTS.md`
